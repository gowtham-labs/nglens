/**
 * Content Script — runs in the isolated world.
 *
 * Responsibilities:
 * 1. Inject page-script.js into the page's MAIN world
 * 2. Relay messages between page script (CustomEvent) and background worker (chrome.runtime)
 * 3. Handle V1 MessageType protocol: SCAN_REQUEST, SCAN_RESULTS, OVERLAY_SHOW, OVERLAY_HIDE, DETECTION_STATUS, ERROR
 * 4. Enforce PAGE_SCRIPT_TIMEOUT_MS for scan requests
 */

import type { ExtensionMessage, PageMessage } from '../types/messages';
import {
  dispatchToPage,
  generateEventId,
  listenFromPage,
  listenFromExtension,
  sendToBackground,
} from './message-bridge';

/** Page script response timeout in ms (inlined to avoid shared chunk with page-script) */
const PAGE_SCRIPT_TIMEOUT_MS = 3000;

// --- Page Script Injection ---

function injectPageScript(): void {
  const scriptUrl = chrome.runtime.getURL('page-script.js');
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.type = 'module';
  document.documentElement.appendChild(script);
  script.onload = () => script.remove();
  script.onerror = () => {
    script.remove();
    reportError('Page script injection failed. Page access may be restricted.');
  };
}

// --- Error Reporting ---

function reportError(message: string): void {
  const errorMessage: ExtensionMessage<{ message: string }> = {
    type: 'ERROR',
    payload: { message },
    timestamp: Date.now(),
  };
  sendToBackground(errorMessage).catch(() => {
    // Background may not be ready yet; silently ignore
  });
}

// --- Pending Scan Tracking ---

interface PendingScan {
  eventId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: () => void;
}

const pendingScans = new Map<string, PendingScan>();

// --- Page Script Message Handler ---

function handlePageMessage(message: PageMessage): void {
  const { type, payload, eventId } = message;

  // If this is a response to a pending scan, clear the timeout
  const pending = pendingScans.get(eventId);
  if (pending) {
    clearTimeout(pending.timeoutId);
    pendingScans.delete(eventId);
    pending.resolve();
  }

  // Forward results to background worker
  const extensionMessage: ExtensionMessage = {
    type,
    payload,
    timestamp: Date.now(),
  };
  sendToBackground(extensionMessage).catch(() => {
    // Background not available; silently ignore
  });
}

// --- Extension Message Handler ---

function handleExtensionMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | void {
  const { type, payload } = message;

  switch (type) {
    case 'SCAN_REQUEST': {
      const eventId = generateEventId();

      // Set up timeout for page script response
      const timeoutId = setTimeout(() => {
        if (pendingScans.has(eventId)) {
          pendingScans.delete(eventId);
          reportError(
            'Scan timed out. The page script did not respond. Try refreshing the page.'
          );
        }
      }, PAGE_SCRIPT_TIMEOUT_MS);

      // Track the pending scan
      pendingScans.set(eventId, {
        eventId,
        timeoutId,
        resolve: () => { /* resolved when page responds */ },
      });

      // Forward scan request to page script via CustomEvent
      dispatchToPage(type, payload, eventId);
      sendResponse({ success: true, eventId });
      return true;
    }

    case 'OVERLAY_SHOW':
    case 'OVERLAY_HIDE': {
      // These will be handled by the overlay module (task 9.1)
      // For now, dispatch to page for any page-level handling
      const eventId = generateEventId();
      dispatchToPage(type, payload, eventId);
      sendResponse({ success: true });
      return true;
    }

    case 'DETECTION_STATUS': {
      // Request detection status from page script
      const eventId = generateEventId();

      const timeoutId = setTimeout(() => {
        if (pendingScans.has(eventId)) {
          pendingScans.delete(eventId);
          reportError('Detection status request timed out.');
        }
      }, PAGE_SCRIPT_TIMEOUT_MS);

      pendingScans.set(eventId, {
        eventId,
        timeoutId,
        resolve: () => { /* resolved when page responds */ },
      });

      dispatchToPage(type, payload, eventId);
      sendResponse({ success: true, eventId });
      return true;
    }

    default:
      return;
  }
}

// --- Initialization ---

function initialize(): void {
  // Inject the page script into the main world
  injectPageScript();

  // Listen for messages from the page script
  listenFromPage(handlePageMessage);

  // Listen for messages from the background worker / popup
  listenFromExtension(handleExtensionMessage);
}

// Start immediately
initialize();

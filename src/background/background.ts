/**
 * Background Service Worker — extension lifecycle, session storage, and message coordination.
 *
 * Responsibilities:
 * 1. Route messages between content script and popup via message-router
 * 2. Manage tab lifecycle (navigation, removal) via tab-manager
 * 3. Persist scan results in chrome.storage.session
 * 4. Re-inject content script on navigation
 * 5. Track extension install event via analytics (pending consent)
 */

import type { ExtensionMessage } from '../types/messages';
import { analyticsService } from './analytics-instance';
import { routeMessage } from './message-router';
import { clearTabState, removeTabState } from './tab-manager';

// --- Message Handling ---

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    // Route the message asynchronously
    routeMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    // Return true to indicate async sendResponse
    return true;
  }
);

// --- Tab Lifecycle ---

/**
 * When a tab navigates to a new URL, clear stored state and re-inject the content script.
 */
chrome.tabs.onUpdated.addListener(
  async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      // Clear previous state for this tab on full navigation
      await clearTabState(tabId);
    }
  }
);

/**
 * When a tab is closed, remove its stored state.
 */
chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  await removeTabState(tabId);
});

// --- Extension Install ---

/**
 * On first install, attempt to send the install event immediately if consent
 * is already granted. Otherwise, store a pending flag so the event is sent
 * later when consent is granted (handled in message-router.ts).
 * For 'update' or 'chrome_update' reasons, no flag is stored and no event is sent.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const enabled = await analyticsService.isEnabled();
    if (enabled) {
      // Consent already granted — send install event now
      const version = chrome.runtime.getManifest().version;
      await analyticsService.trackInstall(version);
    } else {
      // Consent not yet granted — store pending flag for later
      await chrome.storage.local.set({ analytics_install_pending: true });
    }
  }
  // For 'update' or 'chrome_update', do nothing — no install event should be sent
});

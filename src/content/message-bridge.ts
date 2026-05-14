/**
 * Message Bridge — CustomEvent dispatch/listen helpers and chrome.runtime relay logic.
 *
 * This module provides the communication layer between:
 * - Page Script (main world) ↔ Content Script (isolated world) via CustomEvents
 * - Content Script ↔ Background Worker via chrome.runtime messaging
 */

import type { ExtensionMessage, MessageType, PageMessage } from '../types/messages';

// Custom event names for page ↔ content communication
const PAGE_TO_CONTENT_EVENT = '__ng_perf_to_content';
const CONTENT_TO_PAGE_EVENT = '__ng_perf_to_page';

/**
 * Dispatches a CustomEvent to the page script (main world).
 */
export function dispatchToPage<T>(type: MessageType, payload: T, eventId: string): void {
  const message: PageMessage<T> = { eventId, type, payload };
  globalThis.dispatchEvent(
    new CustomEvent(CONTENT_TO_PAGE_EVENT, { detail: message })
  );
}

/**
 * Listens for CustomEvents from the page script (main world).
 * Returns a cleanup function to remove the listener.
 */
export function listenFromPage(
  handler: (message: PageMessage) => void
): () => void {
  const listener = ((event: CustomEvent<PageMessage>) => {
    if (event.detail && event.detail.type) {
      handler(event.detail);
    }
  }) as EventListener;

  globalThis.addEventListener(PAGE_TO_CONTENT_EVENT, listener);

  return () => {
    globalThis.removeEventListener(PAGE_TO_CONTENT_EVENT, listener);
  };
}

/**
 * Sends a message to the background service worker via chrome.runtime.
 */
export function sendToBackground<T>(message: ExtensionMessage<T>): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Listens for messages from the background service worker (or popup).
 * Returns a cleanup function to remove the listener.
 */
export function listenFromExtension(
  handler: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
): () => void {
  chrome.runtime.onMessage.addListener(handler);
  return () => {
    chrome.runtime.onMessage.removeListener(handler);
  };
}

/**
 * Generates a unique event ID for correlating request/response pairs
 * between content script and page script.
 */
export function generateEventId(): string {
  return `__ng_perf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export { PAGE_TO_CONTENT_EVENT, CONTENT_TO_PAGE_EVENT };

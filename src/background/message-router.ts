/**
 * Message Router — routing logic for scan requests and state queries.
 *
 * Handles:
 * - Forwarding SCAN_REQUEST from popup to content script
 * - Receiving SCAN_RESULTS from content script and storing in session
 * - Responding to state queries from popup (GET_TAB_STATE)
 * - Forwarding OVERLAY_SHOW/OVERLAY_HIDE to content script
 * - Forwarding DETECTION_STATUS requests
 * - Reporting ERROR messages to popup
 */

import type { ExtensionMessage, MessageType, ScanResultsPayload } from '../types/messages';
import { getTabState, storeScanResults, updateTabState } from './tab-manager';

/**
 * Routes an incoming message from the content script or popup.
 * Returns a response payload or undefined if no response is needed.
 */
export async function routeMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  const { type, payload } = message;
  const tabId = message.tabId ?? sender.tab?.id;

  switch (type) {
    case 'SCAN_REQUEST':
      return handleScanRequest(message, tabId);

    case 'SCAN_RESULTS':
      return handleScanResults(payload as ScanResultsPayload, tabId);

    case 'DETECTION_STATUS':
      return handleDetectionStatus(message, tabId);

    case 'OVERLAY_SHOW':
    case 'OVERLAY_HIDE':
      return forwardToContentScript(message, tabId);

    case 'ERROR':
      return handleError(message, tabId);

    case 'STATE_REQUEST':
      return handleStateRequest(tabId);

    default:
      return { success: false, error: `Unknown message type: ${type}` };
  }
}

/**
 * Forwards a SCAN_REQUEST from popup to the content script of the active tab.
 */
async function handleScanRequest(
  message: ExtensionMessage,
  tabId: number | undefined
): Promise<unknown> {
  if (!tabId) {
    return { success: false, error: 'No active tab found' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    return {
      success: false,
      error: 'Failed to communicate with content script. Try refreshing the page.',
    };
  }
}

/**
 * Handles SCAN_RESULTS received from the content script.
 * Stores results in session storage for the tab.
 */
async function handleScanResults(
  results: ScanResultsPayload,
  tabId: number | undefined
): Promise<unknown> {
  if (!tabId) {
    return { success: false, error: 'No tab ID for scan results' };
  }

  await storeScanResults(tabId, results);
  return { success: true };
}

/**
 * Forwards DETECTION_STATUS request to the content script.
 */
async function handleDetectionStatus(
  message: ExtensionMessage,
  tabId: number | undefined
): Promise<unknown> {
  if (!tabId) {
    return { success: false, error: 'No active tab found' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    return {
      success: false,
      error: 'Failed to communicate with content script.',
    };
  }
}

/**
 * Forwards overlay messages to the content script.
 */
async function forwardToContentScript(
  message: ExtensionMessage,
  tabId: number | undefined
): Promise<unknown> {
  if (!tabId) {
    return { success: false, error: 'No active tab found' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response;
  } catch (error) {
    return {
      success: false,
      error: 'Failed to forward message to content script.',
    };
  }
}

/**
 * Handles ERROR messages from the content script.
 * Updates tab state with error info.
 */
async function handleError(
  message: ExtensionMessage,
  tabId: number | undefined
): Promise<unknown> {
  if (tabId) {
    await updateTabState(tabId, {
      detection: null,
    });
  }
  // Error is logged; popup can query state to see the issue
  return { success: true };
}

/**
 * Handles STATE_REQUEST from the popup — returns stored tab state.
 */
async function handleStateRequest(tabId: number | undefined): Promise<unknown> {
  if (!tabId) {
    return { success: false, error: 'No active tab found' };
  }

  const state = await getTabState(tabId);
  if (!state) {
    return { success: true, state: null };
  }

  return { success: true, state };
}

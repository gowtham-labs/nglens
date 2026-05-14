/**
 * Tab Manager — per-tab state management using chrome.storage.session.
 *
 * Stores and retrieves TabSessionState for each tab, handling:
 * - Persisting scan results per tab
 * - Clearing state on navigation
 * - Evicting stale tab data when tabs are closed
 */

import type { ScanResultsPayload, DetectionResult } from '../types/messages';

/**
 * Per-tab session state stored in chrome.storage.session.
 */
export interface TabSessionState {
  tabId: number;
  lastScanResults: ScanResultsPayload | null;
  previousScanResults: ScanResultsPayload | null;
  detection: DetectionResult | null;
  activeProfilingSession: Record<string, unknown> | null;
  lastUpdated: number;
}

/**
 * Generates the storage key for a given tab ID.
 */
function storageKey(tabId: number): string {
  return `tab_${tabId}_state`;
}

/**
 * Creates a fresh empty state for a tab.
 */
function createEmptyState(tabId: number): TabSessionState {
  return {
    tabId,
    lastScanResults: null,
    previousScanResults: null,
    detection: null,
    activeProfilingSession: null,
    lastUpdated: Date.now(),
  };
}

/**
 * Retrieves the session state for a given tab.
 * Returns null if no state exists.
 */
export async function getTabState(tabId: number): Promise<TabSessionState | null> {
  const key = storageKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (result[key] as TabSessionState) ?? null;
}

/**
 * Stores the session state for a given tab.
 */
export async function setTabState(tabId: number, state: TabSessionState): Promise<void> {
  const key = storageKey(tabId);
  state.lastUpdated = Date.now();
  await chrome.storage.session.set({ [key]: state });
}

/**
 * Updates specific fields of the tab state, merging with existing state.
 * Creates a new state if none exists.
 */
export async function updateTabState(
  tabId: number,
  updates: Partial<Omit<TabSessionState, 'tabId'>>
): Promise<TabSessionState> {
  const existing = await getTabState(tabId);
  const state: TabSessionState = existing ?? createEmptyState(tabId);

  Object.assign(state, updates, { lastUpdated: Date.now() });
  await setTabState(tabId, state);
  return state;
}

/**
 * Stores scan results for a tab, moving current results to previousScanResults.
 */
export async function storeScanResults(
  tabId: number,
  results: ScanResultsPayload
): Promise<void> {
  const existing = await getTabState(tabId);
  const state: TabSessionState = existing ?? createEmptyState(tabId);

  // Move current to previous for comparison
  state.previousScanResults = state.lastScanResults;
  state.lastScanResults = results;
  state.detection = results.detection;
  state.lastUpdated = Date.now();

  await setTabState(tabId, state);
}

/**
 * Clears the session state for a given tab (e.g., on navigation).
 */
export async function clearTabState(tabId: number): Promise<void> {
  const key = storageKey(tabId);
  await chrome.storage.session.remove(key);
}

/**
 * Removes state for all closed tabs. Call when a tab is removed.
 */
export async function removeTabState(tabId: number): Promise<void> {
  await clearTabState(tabId);
}

/**
 * Gets all stored tab states (for debugging or eviction).
 */
export async function getAllTabStates(): Promise<TabSessionState[]> {
  const all = await chrome.storage.session.get(null);
  const states: TabSessionState[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('tab_') && key.endsWith('_state')) {
      states.push(value as TabSessionState);
    }
  }
  return states;
}

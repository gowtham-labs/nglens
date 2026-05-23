/**
 * Consent Manager Service
 *
 * Manages user consent state for analytics tracking. Consent is stored
 * in chrome.storage.local under the key `analytics_consent`. When the
 * key is absent, consent is treated as undefined (fail-closed behavior —
 * no analytics events are sent).
 *
 * Provides:
 * - getConsent(): read current consent status
 * - setConsent(): persist a consent choice
 * - hasBeenAsked(): check if the user has been prompted
 * - onConsentChanged(): listen for consent state changes
 */

import type { ConsentStatus } from '../types/analytics';

export class ConsentManager {
  private static readonly STORAGE_KEY = 'analytics_consent';

  /**
   * Get the current consent status from chrome.storage.local.
   * Returns 'granted', 'denied', or undefined if the key is absent.
   */
  async getConsent(): Promise<ConsentStatus> {
    try {
      const result = await chrome.storage.local.get(ConsentManager.STORAGE_KEY);
      const value = result[ConsentManager.STORAGE_KEY];

      if (value === 'granted' || value === 'denied') {
        return value;
      }

      // Key absent or invalid value — fail-closed
      return undefined;
    } catch {
      // Storage read failure — treat as consent not granted (fail-closed)
      return undefined;
    }
  }

  /**
   * Persist the user's consent choice to chrome.storage.local.
   */
  async setConsent(status: 'granted' | 'denied'): Promise<void> {
    await chrome.storage.local.set({
      [ConsentManager.STORAGE_KEY]: status,
    });
  }

  /**
   * Check if the user has been asked for consent (key exists in storage).
   * Returns true if the key is present with a valid value, false otherwise.
   */
  async hasBeenAsked(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(ConsentManager.STORAGE_KEY);
      const value = result[ConsentManager.STORAGE_KEY];
      return value === 'granted' || value === 'denied';
    } catch {
      return false;
    }
  }

  /**
   * Listen for consent changes via chrome.storage.onChanged.
   * The callback receives the new consent status whenever the
   * analytics_consent key changes in local storage.
   */
  onConsentChanged(callback: (status: ConsentStatus) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      const consentChange = changes[ConsentManager.STORAGE_KEY];
      if (!consentChange) {
        return;
      }

      const newValue = consentChange.newValue;
      if (newValue === 'granted' || newValue === 'denied') {
        callback(newValue);
      } else {
        // Key removed or set to invalid value — treat as undefined
        callback(undefined);
      }
    });
  }
}

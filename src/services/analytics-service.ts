// src/services/analytics-service.ts — Sends analytics events to GA4 via the Measurement Protocol

import type { AnalyticsEvent, MeasurementProtocolPayload } from '../types/analytics';
import { ConsentManager } from './consent-manager';
import { ClientIdManager } from './client-id-manager';

export class AnalyticsService {
  private readonly endpoint = 'https://www.google-analytics.com/mp/collect';
  private readonly measurementId = 'G-0XE578T3EQ';
  private readonly apiSecret: string | undefined;
  private readonly timeoutMs = 5000;

  private readonly consentManager: ConsentManager;
  private readonly clientIdManager: ClientIdManager;

  constructor() {
    this.apiSecret = import.meta.env.VITE_GA4_API_SECRET || undefined;
    this.consentManager = new ConsentManager();
    this.clientIdManager = new ClientIdManager();
  }

  /**
   * Check if analytics is enabled.
   * Returns true only when consent is granted AND the API secret is present.
   */
  async isEnabled(): Promise<boolean> {
    if (!this.apiSecret) {
      return false;
    }

    const consent = await this.consentManager.getConsent();
    return consent === 'granted';
  }

  /**
   * Send an event if consent is granted and API secret is available.
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      return;
    }

    const clientId = await this.clientIdManager.getClientId();
    const payload: MeasurementProtocolPayload = {
      client_id: clientId,
      events: [event],
    };

    await this.sendPayload(payload);
  }

  /**
   * Send the extension_installed event with retry logic.
   * - Checks `analytics_install_tracked` flag to prevent duplicate install events.
   * - Makes up to 3 total attempts (1 initial + 2 retries) with exponential backoff (1s, 2s).
   * - On success, sets `analytics_install_tracked = true` in chrome.storage.local.
   * - On final failure, silently discards the event.
   */
  async trackInstall(version: string): Promise<void> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      return;
    }

    // Check if install was already tracked
    try {
      const result = await chrome.storage.local.get('analytics_install_tracked');
      if (result.analytics_install_tracked === true) {
        return;
      }
    } catch {
      // Storage read failure — treat as not tracked yet, proceed with sending
    }

    const clientId = await this.clientIdManager.getClientId();
    const payload: MeasurementProtocolPayload = {
      client_id: clientId,
      events: [
        {
          name: 'extension_installed',
          params: { extension_version: version },
        },
      ],
    };

    const maxAttempts = 3;
    const backoffDelays = [1000, 2000]; // delays before retry 2 and retry 3

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const success = await this.sendPayload(payload);

      if (success) {
        // Mark install as tracked to prevent duplicates
        try {
          await chrome.storage.local.set({ analytics_install_tracked: true });
        } catch {
          // Storage write failure — non-critical, event was already sent
        }
        return;
      }

      // If not the last attempt, wait with exponential backoff before retrying
      if (attempt < maxAttempts - 1) {
        await this.delay(backoffDelays[attempt]);
      }
    }

    // All retries exhausted — silently discard
  }

  /**
   * Internal: wait for a specified number of milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send the analysis_run event (fire-and-forget).
   * No retry on failure — abort and discard silently.
   * Does not block or delay the caller.
   */
  trackAnalysisRun(version: string): void {
    // Fire-and-forget: run async logic without awaiting
    void (async () => {
      const enabled = await this.isEnabled();
      if (!enabled) {
        return;
      }

      const clientId = await this.clientIdManager.getClientId();
      const payload: MeasurementProtocolPayload = {
        client_id: clientId,
        events: [
          {
            name: 'analysis_run',
            params: { extension_version: version },
          },
        ],
      };

      // No retry — send once and discard result
      this.sendPayload(payload);
    })();
  }

  /**
   * Internal: send payload to the Measurement Protocol endpoint.
   * Uses AbortController with a 5000ms timeout.
   * Returns true if the request succeeded, false otherwise.
   * Failures are silently discarded.
   */
  private async sendPayload(payload: MeasurementProtocolPayload): Promise<boolean> {
    const url = `${this.endpoint}?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      return response.ok;
    } catch {
      // Network error or timeout — silently discard
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

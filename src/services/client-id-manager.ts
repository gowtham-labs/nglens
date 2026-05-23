// src/services/client-id-manager.ts — Generates and persists a UUID v4 client ID

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ClientIdManager {
  private static readonly STORAGE_KEY = 'analytics_client_id';

  /**
   * Get or create the client ID.
   * Reads from chrome.storage.local; generates a new UUID v4 if absent or invalid.
   */
  async getClientId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get(ClientIdManager.STORAGE_KEY);
      const stored = result[ClientIdManager.STORAGE_KEY];

      if (typeof stored === 'string' && UUID_V4_REGEX.test(stored)) {
        return stored;
      }
    } catch {
      // Storage read failure — fall through to generate a new ID
    }

    const newId = this.generateClientId();
    try {
      await chrome.storage.local.set({ [ClientIdManager.STORAGE_KEY]: newId });
    } catch {
      // Storage write failure — return the generated ID anyway
    }
    return newId;
  }

  /**
   * Generate a new UUID v4.
   * Uses crypto.randomUUID() with a fallback to crypto.getRandomValues().
   */
  private generateClientId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // Fallback: manual UUID v4 generation using crypto.getRandomValues()
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) in byte 6
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant (10xx) in byte 8
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }
}

import { Injectable } from '@angular/core';

/**
 * Storage service that abstracts localStorage operations for persisting application state.
 * Provides graceful degradation when storage is unavailable (e.g., private browsing mode).
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storageKey = 'nglens:clearOnRouteChange';
  private inMemoryStorage = new Map<string, boolean>();
  private isStorageAvailable = this.checkStorageAvailability();

  /**
   * Get a value from storage with fallback to default value.
   * Attempts to read from localStorage first, falls back to in-memory storage if unavailable.
   *
   * @param key - The storage key (currently unused, kept for API consistency)
   * @param defaultValue - The default value to return if key is not found
   * @returns The stored value or the default value
   */
  getValue(key: string, defaultValue: boolean): boolean {
    try {
      if (this.isStorageAvailable) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored !== null) {
          return JSON.parse(stored) as boolean;
        }
      }
    } catch (error) {
      this.logStorageError('read', error);
      // Fall through to in-memory storage
    }

    // Fall back to in-memory storage
    const inMemoryValue = this.inMemoryStorage.get(this.storageKey);
    if (inMemoryValue !== undefined) {
      return inMemoryValue;
    }

    return defaultValue;
  }

  /**
   * Set a value in storage.
   * Attempts to write to localStorage first, falls back to in-memory storage if unavailable.
   *
   * @param key - The storage key (currently unused, kept for API consistency)
   * @param value - The value to store
   */
  setValue(key: string, value: boolean): void {
    try {
      if (this.isStorageAvailable) {
        localStorage.setItem(this.storageKey, JSON.stringify(value));
      }
    } catch (error) {
      this.logStorageError('write', error);
      // Fall through to in-memory storage
    }

    // Always update in-memory storage as fallback
    this.inMemoryStorage.set(this.storageKey, value);
  }

  /**
   * Check if localStorage is available and writable.
   * Handles cases like private browsing mode where localStorage exists but is not writable.
   *
   * @returns true if localStorage is available and writable, false otherwise
   */
  private checkStorageAvailability(): boolean {
    try {
      const testKey = '__nglens_storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      this.logStorageError('availability check', error);
      return false;
    }
  }

  /**
   * Log storage errors to console for debugging without breaking functionality.
   *
   * @param operation - The operation that failed (read, write, etc.)
   * @param error - The error that occurred
   */
  private logStorageError(operation: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[ngLens] Storage ${operation} failed: ${errorMessage}. Falling back to in-memory storage.`);
  }
}

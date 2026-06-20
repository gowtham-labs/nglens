import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from './storage.service';

// Mock localStorage for Node.js environment
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('getValue', () => {
    it('should return stored value when it exists in localStorage', () => {
      mockStorage['nglens:clearOnRouteChange'] = 'true';
      const result = service.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(true);
    });

    it('should return default value when key does not exist in localStorage', () => {
      const result = service.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(false);
    });

    it('should return default value when localStorage is empty', () => {
      const result = service.getValue('nglens:clearOnRouteChange', true);
      expect(result).toBe(true);
    });

    it('should handle JSON parsing of stored boolean values', () => {
      mockStorage['nglens:clearOnRouteChange'] = JSON.stringify(true);
      const result = service.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(true);
    });

    it('should handle JSON parsing of false values', () => {
      mockStorage['nglens:clearOnRouteChange'] = JSON.stringify(false);
      const result = service.getValue('nglens:clearOnRouteChange', true);
      expect(result).toBe(false);
    });
  });

  describe('setValue', () => {
    it('should store value in localStorage', () => {
      service.setValue('nglens:clearOnRouteChange', true);
      expect(mockStorage['nglens:clearOnRouteChange']).toBe(JSON.stringify(true));
    });

    it('should store false value in localStorage', () => {
      service.setValue('nglens:clearOnRouteChange', false);
      expect(mockStorage['nglens:clearOnRouteChange']).toBe(JSON.stringify(false));
    });

    it('should overwrite existing value in localStorage', () => {
      mockStorage['nglens:clearOnRouteChange'] = JSON.stringify(false);
      service.setValue('nglens:clearOnRouteChange', true);
      expect(mockStorage['nglens:clearOnRouteChange']).toBe(JSON.stringify(true));
    });
  });

  describe('persistence', () => {
    it('should persist and retrieve value across multiple operations', () => {
      service.setValue('nglens:clearOnRouteChange', true);
      let result = service.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(true);

      service.setValue('nglens:clearOnRouteChange', false);
      result = service.getValue('nglens:clearOnRouteChange', true);
      expect(result).toBe(false);
    });

    it('should maintain value after multiple set operations', () => {
      service.setValue('nglens:clearOnRouteChange', true);
      service.setValue('nglens:clearOnRouteChange', true);
      const result = service.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should gracefully handle storage errors and fall back to in-memory storage', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw, but store in memory
      expect(() => service.setValue('nglens:clearOnRouteChange', true)).not.toThrow();

      // Restore mock
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        mockStorage[key] = value;
      });

      // Should still be able to retrieve from in-memory storage
      const result = service.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(true);
    });

    it('should handle getItem errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      // Should not throw and return default value
      const result = service.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(false);

      // Restore mock
      localStorageMock.getItem.mockImplementation((key: string) => mockStorage[key] ?? null);
    });
  });

  describe('in-memory fallback', () => {
    it('should use in-memory storage when localStorage throws', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage unavailable');
      });

      const newService = new StorageService();
      newService.setValue('nglens:clearOnRouteChange', true);

      // Should still retrieve from in-memory storage
      const result = newService.getValue('nglens:clearOnRouteChange', false);
      expect(result).toBe(true);

      // Restore mock
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        mockStorage[key] = value;
      });
    });
  });
});

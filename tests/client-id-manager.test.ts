import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientIdManager } from '../src/services/client-id-manager';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Mock chrome.storage.local
let mockStorage: Record<string, unknown> = {};

const getMock = vi.fn(async (key: string) => {
  return { [key]: mockStorage[key] };
});

const setMock = vi.fn(async (items: Record<string, unknown>) => {
  Object.assign(mockStorage, items);
});

// Assign chrome mock to globalThis before importing the module
Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: {
      local: {
        get: getMock,
        set: setMock,
      },
    },
  },
  writable: true,
  configurable: true,
});

describe('ClientIdManager', () => {
  let manager: ClientIdManager;

  beforeEach(() => {
    manager = new ClientIdManager();
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('generates a valid UUID v4 when no stored value exists', async () => {
    const clientId = await manager.getClientId();
    expect(clientId).toMatch(UUID_V4_REGEX);
  });

  it('stores the generated client ID in chrome.storage.local', async () => {
    const clientId = await manager.getClientId();
    expect(setMock).toHaveBeenCalledWith({
      analytics_client_id: clientId,
    });
  });

  it('returns the stored client ID when a valid one exists', async () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    mockStorage['analytics_client_id'] = existingId;

    const clientId = await manager.getClientId();
    expect(clientId).toBe(existingId);
  });

  it('regenerates when stored value is not a valid UUID v4', async () => {
    mockStorage['analytics_client_id'] = 'not-a-valid-uuid';

    const clientId = await manager.getClientId();
    expect(clientId).toMatch(UUID_V4_REGEX);
    expect(clientId).not.toBe('not-a-valid-uuid');
  });

  it('regenerates when stored value is not a string', async () => {
    mockStorage['analytics_client_id'] = 12345;

    const clientId = await manager.getClientId();
    expect(clientId).toMatch(UUID_V4_REGEX);
  });

  it('returns the same ID on consecutive calls (idempotent)', async () => {
    const firstId = await manager.getClientId();
    // After first call, the ID is stored in mockStorage via setMock
    const secondId = await manager.getClientId();
    expect(firstId).toBe(secondId);
  });

  it('handles chrome.storage.local.get failure gracefully', async () => {
    getMock.mockRejectedValueOnce(new Error('Storage error'));

    const clientId = await manager.getClientId();
    expect(clientId).toMatch(UUID_V4_REGEX);
  });

  it('handles chrome.storage.local.set failure gracefully', async () => {
    setMock.mockRejectedValueOnce(new Error('Storage error'));

    const clientId = await manager.getClientId();
    expect(clientId).toMatch(UUID_V4_REGEX);
  });
});

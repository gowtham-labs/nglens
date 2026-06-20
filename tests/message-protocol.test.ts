import { describe, expect, it } from 'vitest';
import {
  isPageScriptAsyncEventType,
  isPanelCommandType,
  normalizeExtensionMessage,
  normalizePageMessage,
} from '../src/utils/message-protocol';

describe('message protocol guards', () => {
  it('accepts a valid event batch from the page script', () => {
    const message = normalizePageMessage({
      eventId: 'batch-1',
      type: 'EVENT_BATCH',
      payload: {
        events: [
          {
            componentName: 'DashboardComponent',
            timestamp: 42,
            duration: 3.5,
            causes: [{ type: 'zone', source: 'setTimeout' }],
          },
        ],
      },
    });

    expect(message?.type).toBe('EVENT_BATCH');
    expect(message?.payload).toEqual({
      events: [
        {
          componentName: 'DashboardComponent',
          timestamp: 42,
          duration: 3.5,
          causes: [{ type: 'zone', source: 'setTimeout' }],
        },
      ],
    });
  });

  it('rejects unknown page message types', () => {
    expect(normalizePageMessage({
      eventId: 'x',
      type: 'SCRIPT_INJECTION',
      payload: {},
    })).toBeNull();
  });

  it('rejects malformed page event batches', () => {
    expect(normalizePageMessage({
      eventId: 'batch-2',
      type: 'EVENT_BATCH',
      payload: {
        events: [
          {
            componentName: 'DashboardComponent',
            timestamp: Number.NaN,
            duration: 3.5,
            causes: [{ type: 'zone' }],
          },
        ],
      },
    })).toBeNull();
  });

  it('accepts zone pollution events for panel forwarding', () => {
    const message = normalizePageMessage({
      eventId: 'zpd-1',
      type: 'ZONE_POLLUTION_EVENT',
      payload: {
        sources: [
          {
            source: 'setInterval',
            type: 'macroTask',
            cdCyclesPerMinute: 180,
            severity: 'critical',
            taskCount: 20,
            lastSeen: 2000,
            fixSuggestion: 'Move timer outside Angular',
          },
        ],
        totalCdCycles: 50,
        windowDurationMs: 60000,
        timestamp: 2100,
      },
    });

    expect(message?.type).toBe('ZONE_POLLUTION_EVENT');
    expect(isPageScriptAsyncEventType(message!.type)).toBe(true);
  });

  it('keeps panel commands and page async events in separate allowlists', () => {
    expect(isPanelCommandType('START_TRACKING')).toBe(true);
    expect(isPanelCommandType('EVENT_BATCH')).toBe(false);
    expect(isPageScriptAsyncEventType('EVENT_BATCH')).toBe(true);
    expect(isPageScriptAsyncEventType('START_TRACKING')).toBe(false);
  });

  it('normalizes extension messages with a timestamp fallback', () => {
    const message = normalizeExtensionMessage({
      type: 'DETECTION_STATUS',
      payload: null,
    });

    expect(message?.type).toBe('DETECTION_STATUS');
    expect(typeof message?.timestamp).toBe('number');
  });
});

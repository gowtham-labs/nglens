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

  it('rejects impossible render timing values', () => {
    expect(normalizePageMessage({
      eventId: 'batch-negative-duration',
      type: 'EVENT_BATCH',
      payload: {
        events: [
          {
            componentName: 'DashboardComponent',
            timestamp: 42,
            duration: -1,
            causes: [{ type: 'zone' }],
          },
        ],
      },
    })).toBeNull();

    expect(normalizePageMessage({
      eventId: 'batch-negative-timestamp',
      type: 'EVENT_BATCH',
      payload: {
        events: [
          {
            componentName: 'DashboardComponent',
            timestamp: -42,
            duration: 1,
            causes: [{ type: 'zone' }],
          },
        ],
      },
    })).toBeNull();
  });

  it('rejects oversized event batches and cause arrays', () => {
    expect(normalizePageMessage({
      eventId: 'too-many-events',
      type: 'EVENT_BATCH',
      payload: {
        events: Array.from({ length: 1001 }, (_, index) => ({
          componentName: `Cmp${index}`,
          timestamp: index,
          duration: 1,
          causes: [{ type: 'zone' }],
        })),
      },
    })).toBeNull();

    expect(normalizePageMessage({
      eventId: 'too-many-causes',
      type: 'EVENT_BATCH',
      payload: {
        events: [
          {
            componentName: 'DashboardComponent',
            timestamp: 42,
            duration: 1,
            causes: Array.from({ length: 11 }, () => ({ type: 'zone' })),
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

  it('accepts zoneless zone pollution summaries with a zero-duration window', () => {
    const message = normalizePageMessage({
      eventId: 'zpd-zoneless',
      type: 'ZONE_POLLUTION_EVENT',
      payload: {
        sources: [],
        totalCdCycles: 0,
        windowDurationMs: 0,
        timestamp: 2100,
        zonelessMode: true,
      },
    });

    expect(message?.type).toBe('ZONE_POLLUTION_EVENT');
  });

  it('rejects impossible zone pollution metrics', () => {
    expect(normalizePageMessage({
      eventId: 'zpd-negative',
      type: 'ZONE_POLLUTION_EVENT',
      payload: {
        sources: [
          {
            source: 'setInterval',
            type: 'macroTask',
            cdCyclesPerMinute: -1,
            severity: 'critical',
            taskCount: 20,
            lastSeen: 2000,
          },
        ],
        totalCdCycles: 50,
        windowDurationMs: 60000,
        timestamp: 2100,
      },
    })).toBeNull();

    expect(normalizePageMessage({
      eventId: 'zpd-zero-window',
      type: 'ZONE_POLLUTION_EVENT',
      payload: {
        sources: [],
        totalCdCycles: 0,
        windowDurationMs: 0,
        timestamp: 2100,
      },
    })).toBeNull();
  });

  it('rejects impossible OnPush scores and factor weights', () => {
    expect(normalizePageMessage({
      eventId: 'onpush-score',
      type: 'ONPUSH_RESULT',
      payload: {
        component: 'CardComponent',
        score: 101,
        currentStrategy: 'Default',
        factors: [],
        recommendation: 'Switch to OnPush',
      },
    })).toBeNull();

    expect(normalizePageMessage({
      eventId: 'onpush-weight',
      type: 'ONPUSH_RESULT',
      payload: {
        component: 'CardComponent',
        score: 80,
        currentStrategy: 'Default',
        factors: [
          {
            name: 'Stable inputs',
            weight: 1.5,
            met: true,
            description: 'Inputs look stable',
          },
        ],
        recommendation: 'Switch to OnPush',
      },
    })).toBeNull();
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

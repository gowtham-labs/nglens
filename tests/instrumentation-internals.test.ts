import { describe, expect, it } from 'vitest';

import { LeakDetector } from '../src/instrumentation/leak-detector';
import { TrackByDetector } from '../src/instrumentation/trackby-detector';
import { RenderTracker } from '../src/instrumentation/render-tracker';
import { ZonePollutionDetector } from '../src/instrumentation/zone-pollution-detector';
import type { LeakEvent } from '../src/types/leak-events';
import type { TaskRecord } from '../src/types/zone-pollution-events';

describe('instrumentation internal helpers', () => {
  function collectLeakEvents(): {
    events: LeakEvent[];
    cleanup: () => void;
  } {
    const eventTarget = new EventTarget();
    const globalWithEvents = globalThis as typeof globalThis & {
      addEventListener?: EventTarget['addEventListener'];
      removeEventListener?: EventTarget['removeEventListener'];
      dispatchEvent?: EventTarget['dispatchEvent'];
      CustomEvent?: typeof CustomEvent;
    };
    const originalAddEventListener = globalWithEvents.addEventListener;
    const originalRemoveEventListener = globalWithEvents.removeEventListener;
    const originalDispatchEvent = globalWithEvents.dispatchEvent;
    const originalCustomEvent = globalWithEvents.CustomEvent;

    if (!globalWithEvents.addEventListener) {
      globalWithEvents.addEventListener = eventTarget.addEventListener.bind(eventTarget);
      globalWithEvents.removeEventListener = eventTarget.removeEventListener.bind(eventTarget);
      globalWithEvents.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);
    }

    if (!globalWithEvents.CustomEvent) {
      globalWithEvents.CustomEvent = class TestCustomEvent<T = unknown> extends Event {
        readonly detail: T;

        constructor(type: string, init?: CustomEventInit<T>) {
          super(type, init);
          this.detail = init?.detail as T;
        }
      };
    }

    const events: LeakEvent[] = [];
    const listener = ((event: CustomEvent<{ type: string; payload: LeakEvent }>) => {
      if (event.detail?.type === 'LEAK_EVENT') {
        events.push(event.detail.payload);
      }
    }) as EventListener;

    globalThis.addEventListener('__ng_perf_to_content', listener);

    return {
      events,
      cleanup: () => {
        globalThis.removeEventListener('__ng_perf_to_content', listener);
        globalWithEvents.addEventListener = originalAddEventListener;
        globalWithEvents.removeEventListener = originalRemoveEventListener;
        globalWithEvents.dispatchEvent = originalDispatchEvent;
        globalWithEvents.CustomEvent = originalCustomEvent;
      },
    };
  }

  it('computes collection sizes across array-like, set, and iterable inputs', () => {
    const detector = new TrackByDetector() as any;

    const fromArray = detector.getCollectionSize([1, 2, 3]);
    const fromLength = detector.getCollectionSize({ length: 5 });
    const fromSet = detector.getCollectionSize(new Set([1, 2, 3, 4]));
    const fromIterable = detector.getCollectionSize((function* generator() {
      yield 1;
      yield 2;
      yield 3;
    })());

    expect(fromArray).toBe(3);
    expect(fromLength).toBe(5);
    expect(fromSet).toBe(4);
    expect(fromIterable).toBe(3);
  });

  it('categorizes common Zone.js task sources for render tracking', () => {
    const tracker = RenderTracker.getInstance() as any;

    expect(tracker.categorizeZoneTask({ source: 'setTimeout', type: 'macroTask' })).toBe('setTimeout');
    expect(tracker.categorizeZoneTask({ source: 'addEventListener:scroll', type: 'eventTask' })).toBe('addEventListener:scroll');
    expect(tracker.categorizeZoneTask({ source: 'Promise.then', type: 'microTask' })).toBe('Promise.then');
    expect(tracker.categorizeZoneTask({ source: 'requestAnimationFrame', type: 'macroTask' })).toBe('requestAnimationFrame');
  });

  it('groups zone pollution records by source and builds source metrics', () => {
    const detector = ZonePollutionDetector.getInstance() as any;
    const records: TaskRecord[] = [
      { source: 'setTimeout', type: 'macroTask', timestamp: 10, triggeredCd: true },
      { source: 'setTimeout', type: 'macroTask', timestamp: 20, triggeredCd: false },
      { source: 'fetch', type: 'macroTask', timestamp: 30, triggeredCd: true, library: 'rxjs' },
    ];

    const groups = detector.groupRecordsBySource(records);

    expect(groups.get('setTimeout')).toHaveLength(2);
    expect(groups.get('fetch')).toHaveLength(1);

    const fetchRecords = groups.get('fetch');
    expect(fetchRecords).toBeDefined();

    const metric = detector.createSourceMetric('fetch', fetchRecords!, 1, 60_000);
    expect(metric.source).toBe('fetch');
    expect(metric.taskCount).toBe(1);
    expect(metric.type).toBe('macroTask');
  });

  it('emits a timer cleanup risk when a component-owned interval survives destruction', () => {
    const detector = new LeakDetector();
    const leakEvents = collectLeakEvents();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    try {
      detector.start();
      detector.onComponentCreated('cmp-1', 'TimerLeakComponent');

      intervalId = setInterval(() => {
        // Simulates a component interval that was never cleared by app code.
      }, 1000);

      detector.onComponentDestroyed('cmp-1');

      expect(leakEvents.events).toHaveLength(1);
      expect(leakEvents.events[0]).toMatchObject({
        componentName: 'TimerLeakComponent',
        componentId: 'cmp-1',
        leakType: 'timer',
        severity: 'WARNING',
        source: 'setInterval',
        lifecycleState: 'destroyed',
      });
    } finally {
      if (intervalId !== null) clearInterval(intervalId);
      detector.stop();
      leakEvents.cleanup();
    }
  });

  it('adopts an interval created during component init before Angular exposes the component host', () => {
    const detector = new LeakDetector();
    const leakEvents = collectLeakEvents();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    try {
      detector.start();

      intervalId = setInterval(() => {
        // Simulates ngOnInit work observed before the MutationObserver resolves the component.
      }, 1000);

      detector.onComponentCreated('cmp-2', 'TimerLeakComponent');
      detector.setCurrentComponentContext(null);
      detector.onComponentDestroyed('cmp-2');

      expect(leakEvents.events).toHaveLength(1);
      expect(leakEvents.events[0]).toMatchObject({
        componentName: 'TimerLeakComponent',
        componentId: 'cmp-2',
        leakType: 'timer',
        source: 'setInterval',
      });
    } finally {
      if (intervalId !== null) clearInterval(intervalId);
      detector.stop();
      leakEvents.cleanup();
    }
  });

  it('does not emit a timer cleanup risk when an interval is cleared before destruction', () => {
    const detector = new LeakDetector();
    const leakEvents = collectLeakEvents();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    try {
      detector.start();
      detector.onComponentCreated('cmp-3', 'CleanTimerComponent');

      intervalId = setInterval(() => {
        // Simulates a component interval that is correctly cleared.
      }, 1000);
      clearInterval(intervalId);
      intervalId = null;

      detector.onComponentDestroyed('cmp-3');

      expect(leakEvents.events).toHaveLength(0);
    } finally {
      if (intervalId !== null) clearInterval(intervalId);
      detector.stop();
      leakEvents.cleanup();
    }
  });
});

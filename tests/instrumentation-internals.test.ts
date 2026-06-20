import { describe, expect, it } from 'vitest';

import { TrackByDetector } from '../src/instrumentation/trackby-detector';
import { RenderTracker } from '../src/instrumentation/render-tracker';
import { ZonePollutionDetector } from '../src/instrumentation/zone-pollution-detector';
import type { TaskRecord } from '../src/types/zone-pollution-events';

describe('instrumentation internal helpers', () => {
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
});

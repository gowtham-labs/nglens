import { describe, it, expect } from 'vitest';
import { PriorityScoringService } from './priority-scoring.service';
import type { EnrichedRecommendation } from '../pages/recommendations/types';

describe('PriorityScoringService', () => {
  const service = new PriorityScoringService();

  function makeRecommendation(overrides: Partial<EnrichedRecommendation>): EnrichedRecommendation {
    return {
      id: 'test-1',
      type: 'onpush',
      componentName: 'TestComponent',
      priority: 'low',
      difficulty: 'easy',
      impactEstimate: '',
      title: 'Test',
      description: 'Test description',
      recommendation: 'Test recommendation',
      isFixed: false,
      ...overrides,
    };
  }

  describe('calculatePriority', () => {
    describe('OnPush recommendations', () => {
      it('should return critical when score > 80 and rendersPerMinute > 100', () => {
        const rec = makeRecommendation({
          type: 'onpush',
          onPushData: { score: 85, rendersPerMinute: 120, componentName: 'Test' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('critical');
      });

      it('should return high when score > 70 and rendersPerMinute > 50', () => {
        const rec = makeRecommendation({
          type: 'onpush',
          onPushData: { score: 75, rendersPerMinute: 60, componentName: 'Test' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('high');
      });

      it('should return medium when score > 50', () => {
        const rec = makeRecommendation({
          type: 'onpush',
          onPushData: { score: 55, rendersPerMinute: 10, componentName: 'Test' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('medium');
      });

      it('should return low when score <= 50', () => {
        const rec = makeRecommendation({
          type: 'onpush',
          onPushData: { score: 40, rendersPerMinute: 10, componentName: 'Test' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('low');
      });

      it('should return low when onPushData is undefined', () => {
        const rec = makeRecommendation({ type: 'onpush', onPushData: undefined });
        expect(service.calculatePriority(rec)).toBe('low');
      });
    });

    describe('TrackBy recommendations', () => {
      it('should return high when collectionSize > 100', () => {
        const rec = makeRecommendation({
          type: 'trackby',
          trackByData: { collectionSize: 150, componentName: 'Test', collectionProperty: 'items' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('high');
      });

      it('should return medium when collectionSize > 20', () => {
        const rec = makeRecommendation({
          type: 'trackby',
          trackByData: { collectionSize: 50, componentName: 'Test', collectionProperty: 'items' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('medium');
      });

      it('should return low when collectionSize <= 20', () => {
        const rec = makeRecommendation({
          type: 'trackby',
          trackByData: { collectionSize: 10, componentName: 'Test', collectionProperty: 'items' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('low');
      });

      it('should return low when trackByData is undefined', () => {
        const rec = makeRecommendation({ type: 'trackby', trackByData: undefined });
        expect(service.calculatePriority(rec)).toBe('low');
      });
    });

    describe('Leak recommendations', () => {
      it('should return critical when severity is CRITICAL', () => {
        const rec = makeRecommendation({
          type: 'leak',
          leakData: { severity: 'CRITICAL', leakType: 'subscription', source: 'obs$' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('critical');
      });

      it('should return high when severity is WARNING', () => {
        const rec = makeRecommendation({
          type: 'leak',
          leakData: { severity: 'WARNING', leakType: 'subscription', source: 'obs$' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('high');
      });

      it('should return medium for other severity values', () => {
        const rec = makeRecommendation({
          type: 'leak',
          leakData: { severity: 'INFO', leakType: 'subscription', source: 'obs$' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('medium');
      });

      it('should return low when leakData is undefined', () => {
        const rec = makeRecommendation({ type: 'leak', leakData: undefined });
        expect(service.calculatePriority(rec)).toBe('low');
      });
    });

    describe('Zone Pollution recommendations', () => {
      it('should return critical when cdCyclesPerMinute > 100', () => {
        const rec = makeRecommendation({
          type: 'zone-pollution',
          zonePollutionData: { cdCyclesPerMinute: 150, source: 'Chart.js' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('critical');
      });

      it('should return high when cdCyclesPerMinute > 50', () => {
        const rec = makeRecommendation({
          type: 'zone-pollution',
          zonePollutionData: { cdCyclesPerMinute: 75, source: 'socket.io' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('high');
      });

      it('should return medium when cdCyclesPerMinute > 20', () => {
        const rec = makeRecommendation({
          type: 'zone-pollution',
          zonePollutionData: { cdCyclesPerMinute: 30, source: 'lib' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('medium');
      });

      it('should return low when cdCyclesPerMinute <= 20', () => {
        const rec = makeRecommendation({
          type: 'zone-pollution',
          zonePollutionData: { cdCyclesPerMinute: 10, source: 'lib' } as any,
        });
        expect(service.calculatePriority(rec)).toBe('low');
      });

      it('should return low when zonePollutionData is undefined', () => {
        const rec = makeRecommendation({ type: 'zone-pollution', zonePollutionData: undefined });
        expect(service.calculatePriority(rec)).toBe('low');
      });
    });

    it('should return low for unknown recommendation types', () => {
      const rec = makeRecommendation({ type: 'unknown' as any });
      expect(service.calculatePriority(rec)).toBe('low');
    });
  });

  describe('estimateImpact', () => {
    it('should return render reduction for onpush', () => {
      const rec = makeRecommendation({ type: 'onpush' });
      expect(service.estimateImpact(rec)).toBe('Will reduce renders by 70%');
    });

    it('should calculate DOM operations reduction for trackby', () => {
      const rec = makeRecommendation({
        type: 'trackby',
        trackByData: { collectionSize: 100, componentName: 'Test', collectionProperty: 'items' } as any,
      });
      expect(service.estimateImpact(rec)).toBe('Will reduce DOM operations by 80 per update');
    });

    it('should handle zero collectionSize for trackby', () => {
      const rec = makeRecommendation({
        type: 'trackby',
        trackByData: { collectionSize: 0, componentName: 'Test', collectionProperty: 'items' } as any,
      });
      expect(service.estimateImpact(rec)).toBe('Will reduce DOM operations per update');
    });

    it('should return stability message for leak', () => {
      const rec = makeRecommendation({ type: 'leak' });
      expect(service.estimateImpact(rec)).toBe('Will prevent memory leak and improve stability');
    });

    it('should calculate CD cycle reduction for zone-pollution', () => {
      const rec = makeRecommendation({
        type: 'zone-pollution',
        zonePollutionData: { cdCyclesPerMinute: 200, source: 'Chart.js' } as any,
      });
      expect(service.estimateImpact(rec)).toBe('Will reduce CD cycles by 180 per minute');
    });

    it('should handle zero cdCyclesPerMinute for zone-pollution', () => {
      const rec = makeRecommendation({
        type: 'zone-pollution',
        zonePollutionData: { cdCyclesPerMinute: 0, source: 'lib' } as any,
      });
      expect(service.estimateImpact(rec)).toBe('Will reduce CD cycles per minute');
    });
  });

  describe('estimateDifficulty', () => {
    it('should return easy for onpush', () => {
      const rec = makeRecommendation({ type: 'onpush' });
      expect(service.estimateDifficulty(rec)).toBe('easy');
    });

    it('should return easy for trackby', () => {
      const rec = makeRecommendation({ type: 'trackby' });
      expect(service.estimateDifficulty(rec)).toBe('easy');
    });

    it('should return medium for leak', () => {
      const rec = makeRecommendation({ type: 'leak' });
      expect(service.estimateDifficulty(rec)).toBe('medium');
    });

    it('should return hard for zone-pollution', () => {
      const rec = makeRecommendation({ type: 'zone-pollution' });
      expect(service.estimateDifficulty(rec)).toBe('hard');
    });

    it('should return medium for unknown types', () => {
      const rec = makeRecommendation({ type: 'unknown' as any });
      expect(service.estimateDifficulty(rec)).toBe('medium');
    });
  });
});

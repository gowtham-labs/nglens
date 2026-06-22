import { describe, expect, it } from 'vitest';

import { BestPracticesDetector } from '../src/analyzers/best-practices-detector';

describe('BestPracticesDetector internals', () => {
  it('collects public component methods and excludes lifecycle/private entries', () => {
    class FakeComponent {
      ngOnInit() {
        return;
      }

      _internal() {
        return;
      }

      getTotal() {
        return 42;
      }

      onClick() {
        return;
      }
    }

    const detector = new BestPracticesDetector() as any;
    const methods = detector.collectPublicMethods(FakeComponent.prototype);

    expect(methods).toContain('getTotal');
    expect(methods).toContain('onClick');
    expect(methods).not.toContain('constructor');
    expect(methods).not.toContain('ngOnInit');
    expect(methods).not.toContain('_internal');
  });

  it('identifies template computation-like methods', () => {
    const detector = new BestPracticesDetector() as any;

    expect(detector.looksLikeTemplateComputation('getTotal')).toBe(true);
    expect(detector.looksLikeTemplateComputation('computeCost')).toBe(true);
    expect(detector.looksLikeTemplateComputation('onClick')).toBe(false);
    expect(detector.looksLikeTemplateComputation('toString')).toBe(false);
  });

  it('builds selectors preferring id, then nghost attr, then tag name', () => {
    const detector = new BestPracticesDetector() as any;

    const idElement = {
      tagName: 'DIV',
      id: 'main',
      attributes: [],
    } as any;

    const ngHostElement = {
      tagName: 'APP-CARD',
      id: '',
      attributes: [{ name: '_nghost-c1' }],
    } as any;

    const plainElement = {
      tagName: 'SPAN',
      id: '',
      attributes: [],
    } as any;

    expect(detector.buildSelector(idElement)).toBe('#main');
    expect(detector.buildSelector(ngHostElement)).toBe('app-card[_nghost-c1]');
    expect(detector.buildSelector(plainElement)).toBe('span');
  });
});

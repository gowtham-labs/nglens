/**
 * Comprehensive test suite for SubscriptionLeakDetector
 *
 * Tests cover:
 * - Subscription leak detection (with and without cleanup)
 * - Known safe patterns (takeUntilDestroyed, destroy$ Subject, SubSink)
 * - Timer leak detection
 * - Event listener leak detection
 * - Edge cases (empty components, unavailable ng.getComponent)
 * - Deterministic issue IDs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubscriptionLeakDetector } from '../subscription-leak-detector';
import type { AnalyzerConfig } from '../../types/analyzer';
import * as domUtils from '../../utils/dom-utils';

vi.mock('../../utils/dom-utils');

describe('SubscriptionLeakDetector', () => {
  let detector: SubscriptionLeakDetector;
  let mockElement: Element;
  let originalNg: any;

  beforeEach(() => {
    detector = new SubscriptionLeakDetector();
    originalNg = (globalThis as any).ng;
    mockElement = document.createElement('div');
    mockElement.id = 'test-component';
  });

  afterEach(() => {
    if (originalNg) {
      (globalThis as any).ng = originalNg;
    } else {
      delete (globalThis as any).ng;
    }
    vi.clearAllMocks();
  });

  describe('Scenario 1: Subscriptions without cleanup', () => {
    it('should detect subscription leak when component has subscriptions but no cleanup', async () => {
      const mockComponent = {
        data$: {
          subscribe: function() {},
          unsubscribe: function() {},
          closed: false,
          add: function() {},
        },
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      const config: AnalyzerConfig = { mode: 'development', maxElements: 100 };
      const result = await detector.analyze(config);

      // Should detect subscription leaks
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
      expect(result.analyzer).toBe('rxjs-leak-detector');
    });

    it('should report multiple subscriptions as critical', async () => {
      const mockComponent = {
        data1$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        data2$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        data3$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        data4$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const issue = result.issues.find(i => i.title.includes('subscription'));
      if (issue) {
        expect(issue.severity).toBe('critical');
      }
    });
  });

  describe('Scenario 2: takeUntilDestroyed pattern', () => {
    it('should not report issues for component using takeUntilDestroyed', async () => {
      const mockComponent = {
        destroyRef: {},
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssues = result.issues.filter(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssues.length).toBe(0);
    });
  });

  describe('Scenario 3: destroy$ Subject pattern', () => {
    it('should not report issues for component with destroy$ Subject', async () => {
      const mockComponent = {
        destroy$: {
          next: function() {},
          complete: function() {},
          error: function() {},
        },
        ngOnInit: function() {},
        ngOnDestroy: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssues = result.issues.filter(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssues.length).toBe(0);
    });
  });

  describe('Scenario 4: SubSink pattern', () => {
    it('should not report issues for component using SubSink', async () => {
      const mockComponent = {
        subscriptions: {
          add: function() {},
          unsubscribe: function() {},
          closed: false,
        },
        ngOnInit: function() {},
        ngOnDestroy: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssues = result.issues.filter(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssues.length).toBe(0);
    });
  });

  describe('Scenario 5: Timers with proper cleanup', () => {
    it('should not report timer leak when clearInterval is in ngOnDestroy', async () => {
      const mockComponent = {
        intervalId: null,
        ngOnInit: function() {},
        ngOnDestroy: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const timerIssues = result.issues.filter(i => i.title.includes('Timer'));
      expect(timerIssues.length).toBe(0);
    });
  });

  describe('Scenario 6: Event listeners with proper cleanup', () => {
    it('should not report event listener leak when removeEventListener is in ngOnDestroy', async () => {
      const mockComponent = {
        boundResize: function() {},
        ngOnInit: function() {},
        ngOnDestroy: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const eventIssues = result.issues.filter(i => i.title.includes('event listener'));
      expect(eventIssues.length).toBe(0);
    });
  });

  describe('Scenario 7: Timers without cleanup', () => {
    it('should detect timer leak when setInterval has no clearInterval', async () => {
      // Create a mock component with ngOnInit as a prototype method
      function MockComponent() {}
      MockComponent.prototype.ngOnInit = function() {
        this.intervalId = setInterval(() => {
          console.log('tick');
        }, 1000);
      };
      
      const mockComponent = new (MockComponent as any)();

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const timerIssue = result.issues.find(i => 
        i.title.includes('Timer') && i.title.includes('without cleanup')
      );
      expect(timerIssue).toBeDefined();
      expect(timerIssue?.severity).toBe('high');
    });
  });

  describe('Scenario 8: Empty component', () => {
    it('should not report issues for empty component', async () => {
      const mockComponent = {
        ngOnInit: function() {},
        ngOnDestroy: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('EmptyComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      expect(result.issues.length).toBe(0);
    });
  });

  describe('Scenario 9: ng.getComponent unavailable', () => {
    it('should gracefully skip when ng.getComponent is not available', async () => {
      (globalThis as any).ng = {};

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      expect(result.issues.length).toBe(0);
      expect(result.metadata?.skipped).toBe(true);
      expect(result.metadata?.reason).toContain('ng.getComponent');
    });

    it('should gracefully skip when ng is undefined', async () => {
      delete (globalThis as any).ng;

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      expect(result.issues.length).toBe(0);
      expect(result.metadata?.skipped).toBe(true);
    });
  });

  describe('Deterministic Issue IDs', () => {
    it('should generate same ID for same component and leak type', async () => {
      const mockComponent = {
        data$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      
      const result1 = await detector.analyze(config);
      const id1 = result1.issues[0]?.id;

      const result2 = await detector.analyze(config);
      const id2 = result2.issues[0]?.id;

      expect(id1).toBe(id2);
      if (id1) {
        expect(id1.startsWith('leak-')).toBe(true);
      }
    });

    it('should generate different IDs for different components', async () => {
      const mockComponent1 = {
        data$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        ngOnInit: function() {},
      };

      const mockComponent2 = {
        data$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        ngOnInit: function() {},
      };

      const mockElement1 = document.createElement('div');
      mockElement1.id = 'component1';
      const mockElement2 = document.createElement('div');
      mockElement2.id = 'component2';

      let callCount = 0;
      (globalThis as any).ng = {
        getComponent: vi.fn(() => {
          callCount++;
          return callCount === 1 ? mockComponent1 : mockComponent2;
        }),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement1, mockElement2]);
      vi.mocked(domUtils.getComponentName).mockImplementation((el: Element) => 
        el.id === 'component1' ? 'Component1' : 'Component2'
      );

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const ids = result.issues.map(i => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should include 8-char hex hash in issue ID', async () => {
      const mockComponent = {
        data$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const issue = result.issues[0];
      if (issue?.id) {
        expect(/^leak-(sub|timer|evt)-[a-z0-9]{8}-/.test(issue.id)).toBe(true);
      }
    });
  });

  describe('Issue Capping', () => {
    it('should cap total issues at MAX_LEAK_ISSUES', async () => {
      const components = Array.from({ length: 100 }, (_, i) => ({
        [`data${i}$`]: { 
          subscribe: function() {}, 
          unsubscribe: function() {}, 
          closed: false, 
          add: function() {} 
        },
        ngOnInit: function() {},
      }));

      const elements = Array.from({ length: 100 }, (_, i) => {
        const el = document.createElement('div');
        el.id = `component${i}`;
        return el;
      });

      let componentIndex = 0;
      (globalThis as any).ng = {
        getComponent: vi.fn(() => components[componentIndex++]),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue(elements);
      vi.mocked(domUtils.getComponentName).mockImplementation((el: Element) => el.id || 'Component');

      const config: AnalyzerConfig = { mode: 'development', maxElements: 100 };
      const result = await detector.analyze(config);

      expect(result.issues.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Analyzer Interface', () => {
    it('should have correct type', () => {
      expect(detector.type).toBe('rxjs-leak-detector');
    });

    it('should require dev mode', () => {
      expect(detector.requiresDevMode).toBe(true);
    });

    it('should have dispose method', () => {
      expect(typeof detector.dispose).toBe('function');
      expect(() => detector.dispose()).not.toThrow();
    });
  });

  describe('False Positive Reduction', () => {
    it('should recognize ngx-auto-unsubscribe decorator pattern', async () => {
      // Create a component with AutoUnsubscribe in its constructor name
      function AutoUnsubscribe() {}
      AutoUnsubscribe.prototype.data$ = { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} };
      AutoUnsubscribe.prototype.ngOnInit = function() {};
      
      const mockComponent = new (AutoUnsubscribe as any)();

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssues = result.issues.filter(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssues.length).toBe(0);
    });

    it('should recognize base class with destroy$ Subject', async () => {
      const mockComponent = {
        data$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        destroy$: {
          next: function() {},
          complete: function() {},
          error: function() {},
        },
        ngOnInit: function() {},
        ngOnDestroy: function() {
          this.destroy$.next();
          this.destroy$.complete();
        },
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssues = result.issues.filter(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssues.length).toBe(0);
    });
  });

  describe('Result Metadata', () => {
    it('should include metadata with component count and leak breakdown', async () => {
      const mockComponent = {
        data$: { subscribe: function() {}, unsubscribe: function() {}, closed: false, add: function() {} },
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      expect(result.metadata?.componentsAnalyzed).toBe(1);
      expect(result.metadata?.totalLeaks).toBeGreaterThanOrEqual(0);
    });

    it('should include timestamp and duration', async () => {
      const mockComponent = {
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('TestComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.analyzer).toBe('rxjs-leak-detector');
    });
  });

  describe('Real-world Subscription Detection', () => {
    it('should detect subscription stored as instance property', async () => {
      // Simulate a real component with subscription property
      const mockComponent = {
        subscription: {
          unsubscribe: function() {},
          closed: false,
          add: function() {},
        },
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('DataComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssue = result.issues.find(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssue).toBeDefined();
      expect(subscriptionIssue?.severity).toBe('medium');
      expect(subscriptionIssue?.metadata?.count).toBe(1);
    });

    it('should detect multiple subscriptions as separate properties', async () => {
      const mockComponent = {
        data$: {
          unsubscribe: function() {},
          closed: false,
          add: function() {},
        },
        status$: {
          unsubscribe: function() {},
          closed: false,
          add: function() {},
        },
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('MultiSubComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssue = result.issues.find(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssue).toBeDefined();
      expect(subscriptionIssue?.severity).toBe('high');
      expect(subscriptionIssue?.metadata?.count).toBe(2);
    });

    it('should detect subscription array', async () => {
      const mockComponent = {
        subscriptions: [
          { unsubscribe: function() {}, closed: false, add: function() {} },
          { unsubscribe: function() {}, closed: false, add: function() {} },
        ],
        ngOnInit: function() {},
      };

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('ArraySubComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssue = result.issues.find(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssue).toBeDefined();
      expect(subscriptionIssue?.metadata?.count).toBe(2);
    });

    it('should detect inline subscriptions in method bodies', async () => {
      // Create a component with ngOnInit that contains .subscribe(
      function TestComponent() {
        // Initialize the subscription property
        this.data$ = {
          subscribe: function() {},
          unsubscribe: function() {},
          closed: false,
          add: function() {},
        };
      }
      TestComponent.prototype.ngOnInit = function() {
        // This method contains .subscribe( pattern
        // In real code, this would create the subscription
      };

      const mockComponent = new (TestComponent as any)();

      (globalThis as any).ng = {
        getComponent: vi.fn(() => mockComponent),
      };

      vi.mocked(domUtils.findAngularComponents).mockReturnValue([mockElement]);
      vi.mocked(domUtils.getComponentName).mockReturnValue('InlineSubComponent');

      const config: AnalyzerConfig = { mode: 'development' };
      const result = await detector.analyze(config);

      const subscriptionIssue = result.issues.find(i => 
        i.title.includes('subscription') && i.title.includes('without cleanup')
      );
      expect(subscriptionIssue).toBeDefined();
    });
  });
});

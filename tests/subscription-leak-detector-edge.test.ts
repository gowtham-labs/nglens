import { describe, expect, it } from 'vitest';

import { SubscriptionLeakDetector } from '../src/analyzers/subscription-leak-detector';

function detectorInternals(): any {
  return new SubscriptionLeakDetector() as any;
}

function fakeElement(): Element {
  return {
    tagName: 'APP-TEST',
    id: '',
  } as Element;
}

function rxSubscription(): any {
  return {
    closed: false,
    add() {},
    unsubscribe() {},
  };
}

describe('SubscriptionLeakDetector edge cases', () => {
  it('detects subscriptions created from regular component methods', () => {
    class RegularMethodComponent {
      loadData(): void {
        this.api.getData().subscribe(() => {});
      }

      api = {
        getData: () => ({ subscribe() {} }),
      };
    }

    const detector = detectorInternals();
    const issues = detector.detectSubscriptionLeaks(
      new RegularMethodComponent(),
      'RegularMethodComponent',
      fakeElement()
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain('subscription');
  });

  it('ignores subscribe, timer, and listener text inside comments and strings', () => {
    class CommentAndStringComponent {
      loadData(): string {
        // this.api.getData().subscribe(() => {});
        const note = 'Use .subscribe() only with cleanup';
        const timer = 'setInterval(() => poll(), 1000)';
        const listener = 'window.addEventListener("resize", onResize)';
        return `${note} ${timer} ${listener}`;
      }
    }

    const detector = detectorInternals();
    const component = new CommentAndStringComponent();
    const subscriptionProperties: string[] = [];

    expect(detector.countSubscriptions(component, subscriptionProperties)).toBe(0);
    expect(detector.findTimerMethods(component)).toEqual([]);
    expect(detector.findEventListenerMethods(component)).toEqual([]);
  });

  it('recognizes takeUntilDestroyed as a safe cleanup pattern', () => {
    class TakeUntilDestroyedComponent {
      destroyRef = {};

      ngOnInit(): void {
        this.data$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {});
      }

      data$ = {
        pipe: () => ({ subscribe() {} }),
      };
    }

    const detector = detectorInternals();
    const issues = detector.detectSubscriptionLeaks(
      new TakeUntilDestroyedComponent(),
      'TakeUntilDestroyedComponent',
      fakeElement()
    );

    expect(issues).toEqual([]);
  });

  it('recognizes subscription arrays cleaned up during ngOnDestroy', () => {
    class SubscriptionArrayComponent {
      subs = [rxSubscription(), rxSubscription()];

      ngOnInit(): void {
        this.subs.push(this.api.getData().subscribe(() => {}));
      }

      ngOnDestroy(): void {
        this.subs.forEach((subscription) => subscription.unsubscribe());
      }

      api = {
        getData: () => ({ subscribe: () => rxSubscription() }),
      };
    }

    const detector = detectorInternals();
    const issues = detector.detectSubscriptionLeaks(
      new SubscriptionArrayComponent(),
      'SubscriptionArrayComponent',
      fakeElement()
    );

    expect(issues).toEqual([]);
  });

  it('detects real timer and event-listener setup while honoring cleanup methods', () => {
    class BrowserResourceComponent {
      setupTimers(): void {
        setInterval(() => {}, 1000);
      }

      setupListeners(): void {
        window.addEventListener('resize', () => {});
      }

      ngOnDestroy(): void {
        clearInterval(1);
        window.removeEventListener('resize', () => {});
      }
    }

    const detector = detectorInternals();
    const component = new BrowserResourceComponent();

    expect(detector.findTimerMethods(component)).toEqual(['setupTimers']);
    expect(detector.findEventListenerMethods(component)).toEqual(['setupListeners']);
    expect(detector.detectTimerLeaks(component, 'BrowserResourceComponent', fakeElement())).toEqual([]);
    expect(detector.detectEventListenerLeaks(component, 'BrowserResourceComponent', fakeElement())).toEqual([]);
  });
});

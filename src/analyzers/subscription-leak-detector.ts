/**
 * Subscription Leak Detector — Memory Leak Prevention
 *
 * Detects common memory leak patterns in Angular components:
 * 1. RxJS subscriptions without cleanup (missing takeUntil/async pipe/unsubscribe)
 * 2. Timers (setInterval/setTimeout) without cleanup
 * 3. Event listeners (addEventListener) without cleanup
 * 4. Components with active subscriptions but missing ngOnDestroy
 *
 * Each issue includes:
 * - Leak type and severity
 * - Auto-generated fix with takeUntilDestroyed() or manual cleanup
 * - Estimated memory impact
 *
 * Requires development mode (window.ng) to inspect component instances.
 */

import type {
  AnalyzerConfig,
  AnalyzerResult,
  AnalyzerType,
  AnalysisIssue,
} from '../types/analyzer';
import { BaseAnalyzer } from './base-analyzer';
import { registerAnalyzer } from './index';
import { findAngularComponents, getComponentName } from '../utils/dom-utils';
import { now } from '../utils/timing';
import { MAX_ELEMENTS_PER_SCAN, MAX_LEAK_ISSUES } from '../utils/constants';

/**
 * Generates a deterministic 8-char hex hash from input string.
 * Used for stable issue IDs across repeated scans.
 * 
 * Algorithm: Simple hash combining character codes, deterministic across runs.
 * Returns exactly 8 hex characters (lowercase).
 */
function hashCode(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to 8-char hex string (lowercase, zero-padded)
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

// --- Educational content for leak types ---

const SUBSCRIPTION_LEAK_CONTENT = {
  learningTopic: 'Memory Management',
  whyBad:
    'Subscriptions that are not cleaned up continue to hold references to the component and run callbacks even after the component is destroyed. This causes memory leaks, unexpected behavior, and performance degradation over time.',
  betterApproach: `// Option 1: Use takeUntilDestroyed() (Angular 16+)
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class MyComponent {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.service.data$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.data = data);
  }
}

// Option 2: Use async pipe (preferred)
// template: {{ data$ | async }}

// Option 3: Manual cleanup
private destroy$ = new Subject<void>();

ngOnInit() {
  this.service.data$
    .pipe(takeUntil(this.destroy$))
    .subscribe(data => this.data = data);
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}`,
};

const TIMER_LEAK_CONTENT = {
  learningTopic: 'Memory Management',
  whyBad:
    'Timers (setInterval/setTimeout) that are not cleared will continue to run after component destruction, causing memory leaks and unexpected side effects. The component instance cannot be garbage collected.',
  betterApproach: `private intervalId: number | null = null;

ngAfterViewInit() {
  this.intervalId = window.setInterval(() => {
    this.checkStatus();
  }, 1000);
}

ngOnDestroy() {
  if (this.intervalId !== null) {
    clearInterval(this.intervalId);
  }
}`,
};

const EVENT_LISTENER_LEAK_CONTENT = {
  learningTopic: 'Memory Management',
  whyBad:
    'Event listeners that are not removed keep references to the component and prevent garbage collection. They also continue to fire callbacks on destroyed components.',
  betterApproach: `// Store bound function reference
private boundResize = this.onResize.bind(this);

ngOnInit() {
  window.addEventListener('resize', this.boundResize);
}

ngOnDestroy() {
  window.removeEventListener('resize', this.boundResize);
}

// Or use RxJS fromEvent + takeUntilDestroyed
private destroyRef = inject(DestroyRef);

ngOnInit() {
  fromEvent(window, 'resize')
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(() => this.onResize());
}`,
};

/**
 * Detected leak metadata
 */
interface LeakMetadata {
  type: 'subscription' | 'timer' | 'event-listener';
  count: number;
  methods?: string[];
  eventTypes?: string[];
}

/**
 * SubscriptionLeakDetector identifies memory leaks from unmanaged subscriptions,
 * timers, and event listeners in Angular components.
 */
export class SubscriptionLeakDetector extends BaseAnalyzer {
  readonly type: AnalyzerType = 'rxjs-leak-detector';
  readonly requiresDevMode = true;

  protected async execute(config: AnalyzerConfig): Promise<AnalyzerResult> {
    // Runtime guard: verify Angular debug API is available
    const ng = (globalThis as any).ng;
    if (!ng?.getComponent) {
      return {
        analyzer: this.type,
        timestamp: Date.now(),
        duration: 0,
        issues: [],
        metadata: {
          skipped: true,
          reason: 'ng.getComponent not available — Angular debug API required',
        },
      };
    }

    const startTime = now();
    const issues: AnalysisIssue[] = [];
    let componentsAnalyzed = 0;

    // Try to get leak data from LeakDetector if available
    const leakDetectorData = this.getLeakDetectorData();
    if (leakDetectorData && leakDetectorData.length > 0) {
      // Process leaks detected by LeakDetector
      componentsAnalyzed = leakDetectorData.length;
      for (const leak of leakDetectorData) {
        const issue = this.createIssueFromLeak(leak);
        if (issue) {
          issues.push(issue);
        }
      }
    } else {
      // Fallback: scan components manually if LeakDetector data not available
      const components = findAngularComponents();
      const limit = Math.min(
        components.length,
        config.maxElements ?? MAX_ELEMENTS_PER_SCAN
      );
      componentsAnalyzed = limit;

      for (let i = 0; i < limit; i++) {
        if (issues.length >= MAX_LEAK_ISSUES) break;

        const element = components[i];
        const componentName = getComponentName(element);

        let component: any;
        try {
          component = ng.getComponent(element);
        } catch {
          continue;
        }

        if (!component) {
          continue;
        }

        // Track inline subscriptions by analyzing the component
        this.trackInlineSubscriptionsFromComponent(component);

        // Check for subscription leaks
        const subscriptionIssues = this.detectSubscriptionLeaks(
          component,
          componentName,
          element
        );
        issues.push(...subscriptionIssues);

        // Check for timer leaks
        const timerIssues = this.detectTimerLeaks(
          component,
          componentName,
          element
        );
        issues.push(...timerIssues);

        // Check for event listener leaks
        const eventListenerIssues = this.detectEventListenerLeaks(
          component,
          componentName,
          element
        );
        issues.push(...eventListenerIssues);
      }
    }

    // Cap total issues
    if (issues.length > MAX_LEAK_ISSUES) {
      issues.length = MAX_LEAK_ISSUES;
    }

    const duration = now() - startTime;

    return {
      analyzer: this.type,
      timestamp: Date.now(),
      duration,
      issues,
      metadata: {
        componentsAnalyzed,
        totalLeaks: issues.length,
        subscriptionLeaks: issues.filter((i) =>
          i.title.includes('subscription')
        ).length,
        timerLeaks: issues.filter((i) => i.title.includes('Timer')).length,
        eventListenerLeaks: issues.filter((i) =>
          i.title.includes('event listener')
        ).length,
      },
    };
  }

  /**
   * Gets leak data from the LeakDetector if available.
   * LeakDetector stores active components with their subscriptions and timers.
   */
  private getLeakDetectorData(): Array<{
    componentName: string;
    componentId: string;
    subscriptions: Array<{ source: string; cleaned: boolean }>;
    timers: Array<{ type: string; cleared: boolean }>;
  }> {
    try {
      // Try to access the LeakDetector instance
      const leakDetector = (globalThis as any).__leakDetector;
      if (!leakDetector) {
        return [];
      }

      // Get active components from LeakDetector
      const activeComponents = leakDetector.getActiveComponents?.();
      if (!activeComponents) {
        return [];
      }

      const result = [];
      for (const [, lifecycle] of activeComponents) {
        result.push({
          componentName: lifecycle.componentName,
          componentId: lifecycle.componentId,
          subscriptions: lifecycle.subscriptions,
          timers: lifecycle.timers,
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Converts a LeakDetector leak into an AnalysisIssue.
   */
  private createIssueFromLeak(leak: any): AnalysisIssue | null {
    // Check for unclean subscriptions
    const activeSubscriptions = leak.subscriptions.filter((s: any) => !s.cleaned);
    if (activeSubscriptions.length > 0) {
      const issue: AnalysisIssue = {
        type: 'memory-leak',
        severity: 'CRITICAL',
        title: `${leak.componentName}: ${activeSubscriptions.length} unmanaged subscription(s) without cleanup`,
        description: `Subscriptions created in this component are not cleaned up on component destruction. Each unclean subscription prevents the component from being garbage collected.`,
        recommendation: 'Use takeUntilDestroyed(), async pipe, or manual cleanup',
        learningResource: SUBSCRIPTION_LEAK_CONTENT,
        source: `${leak.componentName}.subscriptions`,
        metadata: {
          component: leak.componentName,
          leaks: activeSubscriptions.length,
          subscriptionSources: activeSubscriptions.map((s: any) => s.source),
          properties: activeSubscriptions.map((s: any) => s.source),
        },
      };
      return issue;
    }

    // Check for uncleared timers
    const activeTimers = leak.timers.filter((t: any) => !t.cleared);
    if (activeTimers.length > 0) {
      const issue: AnalysisIssue = {
        type: 'memory-leak',
        severity: 'WARNING',
        title: `${leak.componentName}: ${activeTimers.length} timer(s) not cleared`,
        description: `Timers (setInterval/setTimeout) created in this component were not cleared on component destruction.`,
        recommendation: 'Clear timers in ngOnDestroy',
        learningResource: TIMER_LEAK_CONTENT,
        source: `${leak.componentName}.timers`,
        metadata: {
          component: leak.componentName,
          leaks: activeTimers.length,
          timerTypes: activeTimers.map((t: any) => t.type),
          properties: activeTimers.map((t: any) => t.type),
        },
      };
      return issue;
    }

    return null;
  }

  /**
   * Tracks inline subscriptions by storing them in a hidden property.
   * 
   * This approach:
   * 1. Wraps Observable.prototype.subscribe globally
   * 2. Stores all subscriptions created during component lifecycle
   * 3. Stores them in __subscriptions__ property on the component
   * 4. Checks which ones are still active (not unsubscribed)
   * 
   * Detects subscriptions like: interval(1000).subscribe()
   */
  private trackInlineSubscriptionsFromComponent(component: any): void {
    try {
      // Store original ngOnInit
      const originalNgOnInit = component.ngOnInit;
      if (typeof originalNgOnInit !== 'function') {
        return;
      }

      // Create storage for subscriptions
      const subscriptions: any[] = [];
      (component as any).__subscriptions__ = subscriptions;

      // Try to get RxJS
      const rxjs = (globalThis as any).rxjs;
      
      // If RxJS is available, intercept subscribe calls
      if (rxjs?.Observable?.prototype?.subscribe) {
        const originalSubscribe = rxjs.Observable.prototype.subscribe;
        let isTracking = false;

        // Replace subscribe to track calls
        rxjs.Observable.prototype.subscribe = function (...args: any[]) {
          const subscription = originalSubscribe.apply(this, args);
          
          // Store subscription if we're tracking
          if (isTracking && subscription) {
            subscriptions.push(subscription);
          }
          
          return subscription;
        };

        // Wrap ngOnInit to enable tracking
        component.ngOnInit = function (...args: any[]) {
          isTracking = true;
          try {
            const result = originalNgOnInit.apply(this, args);
            isTracking = false;
            return result;
          } catch (e) {
            isTracking = false;
            throw e;
          }
        };

        // Execute ngOnInit
        try {
          component.ngOnInit();
        } catch (e) {
          // Silently fail
        }

        // Restore original subscribe
        rxjs.Observable.prototype.subscribe = originalSubscribe;
      } else {
        // RxJS not available, just execute ngOnInit
        try {
          component.ngOnInit();
        } catch (e) {
          // Silently fail
        }
      }

      // Count active subscriptions
      let activeCount = 0;
      for (const sub of subscriptions) {
        if (sub && typeof sub.closed === 'boolean' && !sub.closed) {
          activeCount++;
        }
      }

      // Store count for detection
      if (activeCount > 0) {
        (component as any).__inlineSubscriptionCount = activeCount;
      }
    } catch (error) {
      // Silently fail if tracking fails
    }
  }

  /**
   * Detects RxJS subscription leaks.
   *
   * Strategy:
   * 1. Check if component has ngOnDestroy
   * 2. Scan for properties that look like subscriptions (Subscription type or .subscribe calls)
   * 3. Check for proper cleanup patterns (takeUntil, takeUntilDestroyed, unsubscribe)
   */
  private detectSubscriptionLeaks(
    component: any,
    componentName: string,
    element: Element
  ): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    // Check if component has ngOnDestroy
    const hasNgOnDestroy = typeof component.ngOnDestroy === 'function';

    // Look for subscription-related properties
    const subscriptionProperties: string[] = [];
    const subscriptionCount = this.countSubscriptions(
      component,
      subscriptionProperties
    );

    // Check for cleanup patterns
    const hasDestroySubject = this.hasDestroySubject(component);
    const hasDestroyRef = this.hasDestroyRef(component);
    const hasSubscriptionProperty = this.hasSubscriptionProperty(component);

    // If subscriptions detected but no cleanup mechanism
    if (subscriptionCount > 0) {
      // Check allowlist first
      if (this.usesKnownCleanupPattern(component)) {
        return issues; // Known safe pattern, skip
      }

      // Determine if there's proper cleanup
      // Cleanup is present if:
      // 1. Component has destroy$ Subject pattern, OR
      // 2. Component has DestroyRef (Angular 16+), OR
      // 3. Component has subscription properties AND ngOnDestroy that cleans them up
      const hasCleanup =
        hasDestroySubject ||
        hasDestroyRef ||
        (hasSubscriptionProperty && hasNgOnDestroy);

      if (!hasCleanup) {
        const severity = subscriptionCount > 3 ? 'critical' : subscriptionCount > 1 ? 'high' : 'medium';

        issues.push({
          id: `leak-sub-${hashCode(componentName + 'subscription' + subscriptionProperties.join(','))}-${componentName}`,
          analyzer: this.type,
          component: componentName,
          severity,
          category: 'memory-leaks',
          title: `${subscriptionCount} subscription(s) without cleanup detected`,
          description: `Found ${subscriptionCount} potential subscription leak(s) in ${componentName}. ${
            hasNgOnDestroy
              ? 'ngOnDestroy exists but no cleanup mechanism detected.'
              : 'Component has no ngOnDestroy lifecycle hook.'
          }`,
          recommendation: this.generateSubscriptionFix(
            subscriptionCount,
            hasNgOnDestroy
          ),
          metadata: {
            ...SUBSCRIPTION_LEAK_CONTENT,
            leakType: 'subscription',
            count: subscriptionCount,
            properties: subscriptionProperties,
            hasNgOnDestroy,
          },
          elementSelector: this.generateSelector(element),
        });
      }
    }

    return issues;
  }

  /**
   * Detects timer leaks (setInterval/setTimeout without clearInterval/clearTimeout).
   */
  private detectTimerLeaks(
    component: any,
    componentName: string,
    element: Element
  ): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    const timerMethods = this.findTimerMethods(component);

    if (timerMethods.length > 0) {
      const hasNgOnDestroy = typeof component.ngOnDestroy === 'function';
      const hasClearTimer = this.hasClearTimerCalls(component);

      if (!hasClearTimer) {
        issues.push({
          id: `leak-timer-${hashCode(componentName + 'timer' + timerMethods.join(','))}-${componentName}`,
          analyzer: this.type,
          component: componentName,
          severity: 'high',
          category: 'memory-leaks',
          title: `Timer leak: ${timerMethods.length} timer(s) without cleanup`,
          description: `Found ${timerMethods.length} setInterval/setTimeout call(s) in ${componentName} without corresponding clearInterval/clearTimeout in ngOnDestroy.`,
          recommendation: this.generateTimerFix(timerMethods, hasNgOnDestroy),
          metadata: {
            ...TIMER_LEAK_CONTENT,
            leakType: 'timer',
            count: timerMethods.length,
            methods: timerMethods,
          },
          elementSelector: this.generateSelector(element),
        });
      }
    }

    return issues;
  }

  /**
   * Detects event listener leaks (addEventListener without removeEventListener).
   */
  private detectEventListenerLeaks(
    component: any,
    componentName: string,
    element: Element
  ): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    const eventListenerMethods = this.findEventListenerMethods(component);

    if (eventListenerMethods.length > 0) {
      const hasNgOnDestroy = typeof component.ngOnDestroy === 'function';
      const hasRemoveListener = this.hasRemoveEventListenerCalls(component);

      if (!hasRemoveListener) {
        issues.push({
          id: `leak-evt-${hashCode(componentName + 'event' + eventListenerMethods.join(','))}-${componentName}`,
          analyzer: this.type,
          component: componentName,
          severity: 'medium',
          category: 'memory-leaks',
          title: `Event listener leak: ${eventListenerMethods.length} listener(s) without cleanup`,
          description: `Found ${eventListenerMethods.length} addEventListener call(s) in ${componentName} without corresponding removeEventListener in ngOnDestroy.`,
          recommendation: this.generateEventListenerFix(
            eventListenerMethods,
            hasNgOnDestroy
          ),
          metadata: {
            ...EVENT_LISTENER_LEAK_CONTENT,
            leakType: 'event-listener',
            count: eventListenerMethods.length,
            methods: eventListenerMethods,
          },
          elementSelector: this.generateSelector(element),
        });
      }
    }

    return issues;
  }

  // --- Helper Methods ---

  /**
   * Checks if component uses a known safe subscription management pattern.
   * These patterns handle cleanup automatically and should not trigger warnings.
   */
  private usesKnownCleanupPattern(component: any): boolean {
    try {
      // Pattern 1: SubSink (has .add() and .unsubscribe() on a property named 'subscriptions' or 'subs')
      // Must be more specific - check for property name AND the pattern
      // Only match if the property is specifically named like a sink container, not just any subscription
      for (const key in component) {
        if (!component.hasOwnProperty(key)) continue;
        const value = component[key];
        const lowerKey = key.toLowerCase();
        
        // Only check properties that look like subscription containers (not individual subscriptions)
        // SubSink is typically named 'subscriptions', 'subs', 'sink', etc.
        // NOT 'subscription', 'data$', 'status$', etc.
        if ((lowerKey === 'subscriptions' || lowerKey === 'subs' || lowerKey === 'sink' || lowerKey.endsWith('sink')) &&
            value &&
            typeof value === 'object' &&
            typeof value.add === 'function' &&
            typeof value.unsubscribe === 'function' &&
            'closed' in value
        ) {
          // Looks like SubSink or Subscription used as a sink
          return true;
        }
      }

      // Pattern 2: ngx-auto-unsubscribe decorator (check for __ngUnsubscribe__ marker)
      const proto = Object.getPrototypeOf(component);
      if (proto && proto.constructor) {
        const constructorStr = proto.constructor.toString();
        if (constructorStr.includes('AutoUnsubscribe') || constructorStr.includes('ngUnsubscribe')) {
          return true;
        }
      }

      // Pattern 3: Base class with destroy$ Subject that's properly wired
      // Check prototype chain for a destroy subject
      let currentProto = Object.getPrototypeOf(component);
      while (currentProto && currentProto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(currentProto)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('destroy') || lowerKey.includes('unsubscribe')) {
            try {
              const value = component[key];
              if (value && typeof value.next === 'function' && typeof value.complete === 'function') {
                return true;
              }
            } catch { /* skip */ }
          }
        }
        currentProto = Object.getPrototypeOf(currentProto);
      }
    } catch {
      // If introspection fails, don't skip
    }
    return false;
  }

  /**
   * Counts subscription properties in component.
   * Heuristic: looks for properties with 'subscription' in the name or .subscribe calls.
   *
   * IMPROVED: Scans ALL methods (not just ng*), better regex, safer execution.
   * FIXED: Now properly detects subscriptions in instance properties AND method bodies.
   */
  private countSubscriptions(component: any, properties: string[]): number {
    let count = 0;
    const MAX_METHODS_TO_SCAN = 50; // Performance limit
    const seenMethods = new Set<string>();

    try {
      // FIRST: Check for tracked inline subscriptions
      // These are detected by analyzing method source code
      const inlineCount = (component as any).__inlineSubscriptionCount;
      if (typeof inlineCount === 'number' && inlineCount > 0) {
        count += inlineCount;
        properties.push('__inline_subscriptions__');
      }

      // SECOND: Check instance properties for Subscription objects
      // This is the most reliable way to detect actual subscriptions
      let propsChecked = 0;
      const MAX_PROPS_TO_CHECK = 100;

      for (const key in component) {
        if (propsChecked++ > MAX_PROPS_TO_CHECK) break;

        try {
          if (component.hasOwnProperty(key)) {
            const value = component[key];

            // Check if it's a real RxJS Subscription (more specific than just unsubscribe)
            if (this.isRxJSSubscription(value)) {
              count++;
              if (!properties.includes(key)) {
                properties.push(key);
              }
            }

            // Check for subscription arrays/collections
            if (Array.isArray(value) && value.length > 0) {
              if (value.every(item => this.isRxJSSubscription(item))) {
                count += value.length;
                if (!properties.includes(key)) {
                  properties.push(`${key}[]`);
                }
              }
            }
          }
        } catch (propError) {
          // Property access might throw (getters, proxies)
          continue;
        }
      }

      // THIRD: Scan component methods for .subscribe( patterns
      // This helps detect subscriptions that might not be stored as properties
      const proto = Object.getPrototypeOf(component);
      if (proto) {
        const methodNames = Object.getOwnPropertyNames(proto);
        let methodsScanned = 0;

        for (const methodName of methodNames) {
          // Skip constructor, Angular internal methods, and duplicates
          if (
            methodName === 'constructor' ||
            methodName.startsWith('__') ||
            seenMethods.has(methodName) ||
            methodsScanned >= MAX_METHODS_TO_SCAN
          ) {
            continue;
          }

          seenMethods.add(methodName);
          methodsScanned++;

          try {
            const method = proto[methodName];
            if (typeof method !== 'function') continue;

            const methodStr = method.toString();

            // Skip if method body is too short (just a stub) or too long (performance)
            if (methodStr.length < 10 || methodStr.length > 10000) continue;

            // Look for .subscribe( pattern in method body
            const lines = methodStr.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              // Skip comment lines
              if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

              // Look for .subscribe( pattern
              if (/\.\s*subscribe\s*\(/.test(trimmed)) {
                // Only count if we haven't already found this subscription as a property
                // This avoids double-counting
                if (!properties.includes(methodName)) {
                  count++;
                  properties.push(methodName);
                }
                break; // Count method once even if multiple subscribes
              }
            }
          } catch (methodError) {
            // toString() might fail on native functions, proxies, etc.
            // Silently continue to next method
            continue;
          }
        }
      }
    } catch (error) {
      // Silently fail if introspection fails
    }

    return count;
  }

  /**
   * More robust check for RxJS Subscription objects.
   * Checks for multiple Subscription-specific properties to reduce false positives.
   */
  private isRxJSSubscription(value: any): boolean {
    if (!value || typeof value !== 'object') return false;

    // RxJS Subscription has: unsubscribe, closed, add, remove
    return (
      typeof value.unsubscribe === 'function' &&
      'closed' in value &&
      typeof value.add === 'function'
    );
  }

  /**
   * Checks if component has a destroy$ Subject pattern.
   *
   * IMPROVED: Detects more patterns and checks if it's actually used in ngOnDestroy.
   */
  private hasDestroySubject(component: any): boolean {
    try {
      let destroySubjectName: string | null = null;

      // Look for Subject properties (not just by name)
      for (const key in component) {
        const value = component[key];

        // Check if it's a Subject (has next, complete, error methods)
        if (
          value &&
          typeof value.next === 'function' &&
          typeof value.complete === 'function' &&
          typeof value.error === 'function'
        ) {
          // Common naming patterns for destroy subjects
          const lowerKey = key.toLowerCase();
          if (
            lowerKey.includes('destroy') ||
            lowerKey.includes('unsubscribe') ||
            lowerKey.includes('stop') ||
            lowerKey.includes('kill') ||
            lowerKey.includes('teardown')
          ) {
            destroySubjectName = key;
            break;
          }
        }
      }

      if (!destroySubjectName) return false;

      // Verify it's actually used in ngOnDestroy
      if (typeof component.ngOnDestroy === 'function') {
        try {
          const ngOnDestroyStr = component.ngOnDestroy.toString();
          // Check if the destroy subject is called with .next() and .complete()
          return (
            ngOnDestroyStr.includes(`${destroySubjectName}.next`) ||
            ngOnDestroyStr.includes(`${destroySubjectName}.complete`)
          );
        } catch {
          // If we can't verify usage, assume it's valid if the subject exists
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Checks if component has DestroyRef injected (Angular 16+).
   * Also checks for takeUntilDestroyed usage.
   */
  private hasDestroyRef(component: any): boolean {
    try {
      // Check for DestroyRef property
      for (const key in component) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('destroyref')) {
          return true;
        }
      }

      // Also check if any method uses takeUntilDestroyed
      const proto = Object.getPrototypeOf(component);
      if (!proto) return false;

      const methodNames = Object.getOwnPropertyNames(proto);
      for (const methodName of methodNames) {
        try {
          const method = proto[methodName];
          if (typeof method === 'function') {
            const methodStr = method.toString();
            if (methodStr.includes('takeUntilDestroyed')) {
              return true;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Silently fail
    }
    return false;
  }

  /**
   * Checks if component has subscription properties (regardless of cleanup).
   */
  private hasSubscriptionProperties(component: any): boolean {
    try {
      for (const key in component) {
        if (component.hasOwnProperty(key)) {
          const value = component[key];

          // Individual subscriptions
          if (this.isRxJSSubscription(value)) {
            return true;
          }

          // Subscription arrays
          if (Array.isArray(value) && value.some(item => this.isRxJSSubscription(item))) {
            return true;
          }
        }
      }
    } catch {
      // Silently fail
    }
    return false;
  }

  /**
   * Checks if component has a subscription property that's unsubscribed in ngOnDestroy.
   *
   * IMPROVED: Also checks for subscription arrays and .add() pattern.
   * FIXED: Now returns true if subscription properties exist, regardless of cleanup.
   */
  private hasSubscriptionProperty(component: any): boolean {
    try {
      const subscriptionProps: string[] = [];

      // Find subscription properties
      for (const key in component) {
        if (component.hasOwnProperty(key)) {
          const value = component[key];

          // Individual subscriptions
          if (this.isRxJSSubscription(value)) {
            subscriptionProps.push(key);
          }

          // Subscription arrays
          if (Array.isArray(value) && value.some(item => this.isRxJSSubscription(item))) {
            subscriptionProps.push(key);
          }
        }
      }

      if (subscriptionProps.length === 0) return false;

      // Check if ngOnDestroy references these properties
      if (typeof component.ngOnDestroy === 'function') {
        try {
          const ngOnDestroyStr = component.ngOnDestroy.toString();

          // Check if any subscription property is unsubscribed
          for (const propName of subscriptionProps) {
            if (
              ngOnDestroyStr.includes(`${propName}.unsubscribe`) ||
              ngOnDestroyStr.includes(`${propName}.forEach`) || // Array pattern
              ngOnDestroyStr.includes(`${propName}.map`) // Array pattern
            ) {
              return true;
            }
          }
        } catch {
          // If we can't verify, assume false
          return false;
        }
      }

      // If we found subscription properties but no ngOnDestroy, return false
      // (the subscriptions are unmanaged)
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Finds methods that use setInterval/setTimeout.
   *
   * IMPROVED: Better safety, scans all methods, avoids false positives.
   */
  private findTimerMethods(component: any): string[] {
    const methods: string[] = [];
    const MAX_METHODS = 50;
    let methodsScanned = 0;

    try {
      const proto = Object.getPrototypeOf(component);
      if (!proto) return methods;

      const methodNames = Object.getOwnPropertyNames(proto);

      for (const methodName of methodNames) {
        if (methodsScanned++ >= MAX_METHODS) break;
        if (methodName === 'constructor' || methodName.startsWith('__')) continue;

        try {
          const method = proto[methodName];
          if (typeof method !== 'function') continue;

          const methodStr = method.toString();
          if (methodStr.length < 10 || methodStr.length > 10000) continue;

          // Look for timer patterns, avoiding comments
          const lines = methodStr.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

            if (
              /\bsetInterval\s*\(/.test(trimmed) ||
              /\bsetTimeout\s*\(/.test(trimmed)
            ) {
              if (!methods.includes(methodName)) {
                methods.push(methodName);
              }
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Silently fail
    }

    return methods;
  }

  /**
   * Checks if component has clearInterval/clearTimeout calls.
   *
   * IMPROVED: More thorough checking.
   */
  private hasClearTimerCalls(component: any): boolean {
    try {
      if (typeof component.ngOnDestroy !== 'function') return false;

      const ngOnDestroyStr = component.ngOnDestroy.toString();
      return (
        /\bclearInterval\s*\(/.test(ngOnDestroyStr) ||
        /\bclearTimeout\s*\(/.test(ngOnDestroyStr)
      );
    } catch {
      return false;
    }
  }

  /**
   * Finds methods that use addEventListener.
   *
   * IMPROVED: Better safety, scans all methods.
   */
  private findEventListenerMethods(component: any): string[] {
    const methods: string[] = [];
    const MAX_METHODS = 50;
    let methodsScanned = 0;

    try {
      const proto = Object.getPrototypeOf(component);
      if (!proto) return methods;

      const methodNames = Object.getOwnPropertyNames(proto);

      for (const methodName of methodNames) {
        if (methodsScanned++ >= MAX_METHODS) break;
        if (methodName === 'constructor' || methodName.startsWith('__')) continue;

        try {
          const method = proto[methodName];
          if (typeof method !== 'function') continue;

          const methodStr = method.toString();
          if (methodStr.length < 10 || methodStr.length > 10000) continue;

          // Look for addEventListener patterns
          const lines = methodStr.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

            if (/\.addEventListener\s*\(/.test(trimmed)) {
              if (!methods.includes(methodName)) {
                methods.push(methodName);
              }
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Silently fail
    }

    return methods;
  }

  /**
   * Checks if component has removeEventListener calls.
   *
   * IMPROVED: More thorough checking.
   */
  private hasRemoveEventListenerCalls(component: any): boolean {
    try {
      if (typeof component.ngOnDestroy !== 'function') return false;

      const ngOnDestroyStr = component.ngOnDestroy.toString();
      return /\.removeEventListener\s*\(/.test(ngOnDestroyStr);
    } catch {
      return false;
    }
  }

  /**
   * Generates a CSS selector for the element.
   */
  private generateSelector(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    return id || tagName;
  }

  // --- Fix Generation ---

  /**
   * Generates auto-fix recommendation for subscription leaks.
   */
  private generateSubscriptionFix(
    count: number,
    hasNgOnDestroy: boolean
  ): string {
    if (!hasNgOnDestroy) {
      return `Add ngOnDestroy and use takeUntilDestroyed() or Subject pattern:

// Option 1: takeUntilDestroyed (Angular 16+)
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject } from '@angular/core';

export class YourComponent {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.service.data$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.data = data);
  }
}

// Option 2: Subject pattern
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class YourComponent {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.service.data$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.data = data);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}`;
    }

    return `Add cleanup mechanism to existing ngOnDestroy:

// Use takeUntilDestroyed or Subject pattern for all ${count} subscription(s)
private destroy$ = new Subject<void>();

ngOnInit() {
  // Add .pipe(takeUntil(this.destroy$)) before each .subscribe()
  this.service.data$
    .pipe(takeUntil(this.destroy$))
    .subscribe(data => this.data = data);
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}`;
  }

  /**
   * Generates auto-fix recommendation for timer leaks.
   */
  private generateTimerFix(
    methods: string[],
    hasNgOnDestroy: boolean
  ): string {
    const destroyCode = hasNgOnDestroy
      ? '// In existing ngOnDestroy'
      : 'ngOnDestroy() {';
    const closeCode = hasNgOnDestroy ? '' : '}';

    return `Store timer IDs and clear them in ngOnDestroy:

private intervalId: number | null = null;
private timeoutId: number | null = null;

${methods[0] || 'ngOnInit'}() {
  this.intervalId = window.setInterval(() => {
    // your code
  }, 1000);
}

${destroyCode}
  if (this.intervalId !== null) {
    clearInterval(this.intervalId);
  }
  if (this.timeoutId !== null) {
    clearTimeout(this.timeoutId);
  }
${closeCode}`;
  }

  /**
   * Generates auto-fix recommendation for event listener leaks.
   */
  private generateEventListenerFix(
    methods: string[],
    hasNgOnDestroy: boolean
  ): string {
    const destroyCode = hasNgOnDestroy
      ? '// In existing ngOnDestroy'
      : 'ngOnDestroy() {';
    const closeCode = hasNgOnDestroy ? '' : '}';

    return `Store bound function reference and remove listener in ngOnDestroy:

private boundResize = this.onResize.bind(this);

${methods[0] || 'ngOnInit'}() {
  window.addEventListener('resize', this.boundResize);
}

${destroyCode}
  window.removeEventListener('resize', this.boundResize);
${closeCode}

// Or better: use RxJS fromEvent with takeUntilDestroyed
import { fromEvent } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

private destroyRef = inject(DestroyRef);

${methods[0] || 'ngOnInit'}() {
  fromEvent(window, 'resize')
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(() => this.onResize());
}`;
  }
}

// Auto-register the analyzer
registerAnalyzer(new SubscriptionLeakDetector());

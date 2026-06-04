/**
 * Leak Detector — Component Lifecycle Tracking
 *
 * Runs in the page's MAIN world. Hooks into Angular's component
 * creation/destruction lifecycle to track active components and
 * detect potential memory leaks (subscriptions, timers) that
 * survive component destruction.
 *
 * For Angular 17+, components use DestroyRef which can be intercepted.
 * This module patches Angular's component factory to intercept creation
 * and listens for DestroyRef callbacks to detect destruction.
 */

import type { ComponentLifecycle, LeakEvent, SubscriptionRecord, TimerRecord } from '../types/leak-events';
import type { PageMessage } from '../types/messages';

/** Custom event name for page-script → content-script communication */
const PAGE_TO_CONTENT_EVENT = '__ng_perf_to_content';

/** Unique ID counter for component instances */
let nextComponentId = 0;

/** Unique ID counter for subscription records */
let nextSubscriptionId = 0;

/** Unique ID counter for timer records */
let nextTimerId = 0;

/**
 * Generates a unique subscription record ID.
 */
function generateSubscriptionId(): string {
  return `sub_${nextSubscriptionId++}`;
}

/**
 * Generates a unique timer record ID.
 */
function generateTimerId(): string {
  return `timer_${nextTimerId++}`;
}

/**
 * Generates a unique component ID combining the component name
 * and a monotonically increasing counter.
 */
function generateComponentId(componentName: string): string {
  return `${componentName}_${nextComponentId++}`;
}

/**
 * LeakDetector tracks Angular component lifecycle events (creation and destruction)
 * and maintains a registry of active components. When a component is destroyed,
 * it triggers leak checking (actual leak detection logic is added in task 7.3).
 */
export class LeakDetector {
  private readonly activeComponents = new Map<string, ComponentLifecycle>();
  private running = false;
  private originalCreateComponent: ((...args: unknown[]) => unknown) | null = null;
  private patchedFactories = new WeakSet<object>();

  /**
   * Tracks the currently active component context. When a component is being
   * created or executing code, this holds its ID so that subscriptions and
   * timers created during that time can be associated with it.
   */
  private currentComponentId: string | null = null;

  /**
   * Stack-based context for nested component initialization.
   * Supports correct attribution when lifecycle hooks trigger nested
   * component creation (e.g., parent's ngAfterViewInit triggers child init).
   */
  private readonly contextStack: string[] = [];

  /**
   * Maps timer IDs (from setInterval/setTimeout) to the component that owns them.
   * Used to associate clearInterval/clearTimeout calls with the correct timer record.
   */
  private readonly timerToComponent = new Map<number, { componentId: string; recordId: string }>();

  /** Original setInterval function, stored for restoration on stop() */
  private originalSetInterval: ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => number) | null = null;
  /** Original setTimeout function, stored for restoration on stop() */
  private originalSetTimeout: ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => number) | null = null;
  /** Original clearInterval function, stored for restoration on stop() */
  private originalClearInterval: ((id?: number) => void) | null = null;
  /** Original clearTimeout function, stored for restoration on stop() */
  private originalClearTimeout: ((id?: number) => void) | null = null;
  /** Original Observable.prototype.subscribe, stored for restoration on stop() */
  private originalSubscribe: ((...args: unknown[]) => unknown) | null = null;
  /** Reference to the Observable prototype that was patched */
  private patchedObservableProto: { subscribe?: (...args: unknown[]) => unknown } | null = null;

  /**
   * Returns the current active components map.
   * Useful for external inspection and testing.
   */
  getActiveComponents(): ReadonlyMap<string, ComponentLifecycle> {
    return this.activeComponents;
  }

  /**
   * Returns whether the detector is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Starts the leak detector by hooking into Angular's component lifecycle,
   * subscription creation, and timer creation.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[ngLens] LeakDetector: Starting...');
    this.hookComponentLifecycle();
    this.hookSubscriptionCreation();
    this.hookTimerCreation();
    console.log('[ngLens] LeakDetector: Started successfully');
  }

  /**
   * Stops the leak detector, unhooks lifecycle/subscription/timer interception,
   * and clears all tracked state.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.unhookComponentLifecycle();
    this.unhookSubscriptionCreation();
    this.unhookTimerCreation();
    this.activeComponents.clear();
    this.timerToComponent.clear();
    this.currentComponentId = null;
    this.contextStack.length = 0;
  }

  /**
   * Called when a new component instance is created.
   * Records the component in the activeComponents map with its
   * creation timestamp and empty subscription/timer arrays.
   * 
   * CRITICAL FIX: We do NOT set currentComponentId here because
   * subscriptions created during initialization should be tracked
   * via the patched lifecycle hooks, not via global context.
   * The context is managed per-method via patchLifecycleHooks.
   */
  onComponentCreated(componentId: string, componentName: string): void {
    this.activeComponents.set(componentId, {
      componentId,
      componentName,
      createdAt: performance.now(),
      destroyedAt: null,
      subscriptions: [],
      timers: [],
    });
    // NOTE: Do NOT set currentComponentId here
    // It will be set by patchLifecycleHooks when methods execute
  }

  /**
   * Called when a component is destroyed.
   * Records the destruction timestamp and checks for surviving
   * subscriptions (CRITICAL) and timers (WARNING), emitting
   * LeakEvents for any detected leaks.
   * 
   * IMPROVED: Also scans component properties for subscriptions that
   * may not have been tracked during creation (e.g., subscriptions
   * created in methods or stored as properties).
   */
  onComponentDestroyed(componentId: string): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle) return;

    // Clear component context if it's the current one
    if (this.currentComponentId === componentId) {
      this.setCurrentComponentContext(null);
    }

    lifecycle.destroyedAt = performance.now();

    // IMPROVED: Scan component properties for untracked subscriptions
    // This catches subscriptions that were created outside of tracked contexts
    this.scanComponentForUncleanedSubscriptions(componentId);

    // Check for surviving subscriptions (CRITICAL severity)
    const activeSubscriptions = lifecycle.subscriptions.filter(s => !s.cleaned);
    console.log(`[ngLens] Component destroyed: ${lifecycle.componentName}, subscriptions: ${lifecycle.subscriptions.length}, uncleaned: ${activeSubscriptions.length}`);
    
    for (const sub of activeSubscriptions) {
      console.log(`[ngLens] LEAK DETECTED: ${lifecycle.componentName} - ${sub.source}`);
      this.emitLeakEvent({
        id: `leak-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        componentName: lifecycle.componentName,
        componentId,
        leakType: 'subscription',
        severity: 'CRITICAL',
        source: sub.source,
        createdAt: sub.createdAt,
        detectedAt: performance.now(),
        lifecycleState: 'destroyed',
      });
    }

    // Check for surviving timers (WARNING severity)
    const activeTimers = lifecycle.timers.filter(t => !t.cleared);
    for (const timer of activeTimers) {
      this.emitLeakEvent({
        id: `leak-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        componentName: lifecycle.componentName,
        componentId,
        leakType: 'timer',
        severity: 'WARNING',
        source: timer.type,
        createdAt: timer.createdAt,
        detectedAt: performance.now(),
        lifecycleState: 'destroyed',
      });
    }

    // Remove from active components
    this.activeComponents.delete(componentId);
  }

  /**
   * Scans a component instance for untracked subscriptions stored as properties.
   * This catches subscriptions that were created outside of the tracked context
   * (e.g., in methods, event handlers, or stored in arrays).
   * 
   * IMPROVED: Detects subscriptions that have unsubscribe() but weren't cleaned up.
   */
  private scanComponentForUncleanedSubscriptions(componentId: string): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle) return;

    // Try to get the component instance from the DOM
    const trackedElements = document.querySelectorAll(`[data-nglens-tracked="${componentId}"]`);
    if (trackedElements.length === 0) return;

    const element = trackedElements[0] as HTMLElement;
    const ng = (globalThis as unknown as { ng?: NgGlobals }).ng;
    if (!ng?.getComponent) return;

    try {
      const component = ng.getComponent(element);
      if (!component || typeof component !== 'object') return;

      // Scan component properties for Subscription objects
      const MAX_PROPS_TO_CHECK = 100;
      let propsChecked = 0;

      for (const key in component) {
        if (propsChecked++ > MAX_PROPS_TO_CHECK) break;

        try {
          if (!component.hasOwnProperty(key)) continue;

          const value = component[key] as any;

          // Check if it's a real RxJS Subscription (has unsubscribe, closed, add)
          if (
            value &&
            typeof value === 'object' &&
            typeof value.unsubscribe === 'function' &&
            'closed' in value &&
            typeof value.add === 'function'
          ) {
            // Check if this subscription is already tracked
            const isTracked = lifecycle.subscriptions.some(
              s => s.source.includes(key) || s.source.includes(value.constructor?.name ?? '')
            );

            // IMPROVED: Track ANY untracked subscription, regardless of closed state
            // If it's a property on the component and wasn't explicitly unsubscribed by our tracking,
            // it's a potential leak
            if (!isTracked) {
              const record: SubscriptionRecord = {
                id: generateSubscriptionId(),
                source: `${key} (property)`,
                createdAt: performance.now(), // Approximate
                cleaned: value.closed, // Mark as cleaned if already closed
                cleanedAt: value.closed ? performance.now() : null,
              };
              lifecycle.subscriptions.push(record);
            }
          }

          // Check for subscription arrays
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              const item = value[i] as any;
              if (
                item &&
                typeof item === 'object' &&
                typeof item.unsubscribe === 'function' &&
                'closed' in item &&
                typeof item.add === 'function'
              ) {
                const isTracked = lifecycle.subscriptions.some(
                  s => s.source.includes(`${key}[${i}]`)
                );

                // IMPROVED: Track ANY untracked subscription in arrays
                if (!isTracked) {
                  const record: SubscriptionRecord = {
                    id: generateSubscriptionId(),
                    source: `${key}[${i}] (array)`,
                    createdAt: performance.now(),
                    cleaned: item.closed,
                    cleanedAt: item.closed ? performance.now() : null,
                  };
                  lifecycle.subscriptions.push(record);
                }
              }
            }
          }
        } catch {
          // Property access might throw (getters, proxies); skip
          continue;
        }
      }
    } catch {
      // Component introspection failed; skip
    }
  }

  /**
   * Dispatches a LeakEvent to the content script via CustomEvent,
   * following the same pattern used for EVENT_BATCH.
   */
  private emitLeakEvent(event: LeakEvent): void {
    const message = {
      type: 'LEAK_EVENT',
      payload: event,
    };

    // Emit on the 'nglens-event' channel so the content script can forward it
    globalThis.dispatchEvent(
      new CustomEvent('nglens-event', { detail: message })
    );
  }

  /**
   * Hooks into Angular's component creation/destruction lifecycle.
   *
   * Strategy for Angular 17+:
   * 1. Patch the global `ng` utilities to intercept component access
   * 2. Use MutationObserver to detect new Angular component elements
   * 3. For each new component, extract its instance via ng.getComponent()
   * 4. Register a DestroyRef.onDestroy() callback to detect destruction
   *
   * Falls back to patching ViewContainerRef.createComponent if available.
   */
  private hookComponentLifecycle(): void {
    this.hookViaAngularInternals();
    this.hookViaMutationObserver();
  }

  /**
   * Patches Observable.prototype.subscribe to record subscriptions with
   * component context. When subscribe is called, the returned Subscription
   * is wrapped so that unsubscribe calls are tracked as cleanup.
   * 
   * CRITICAL FIX: Track subscriptions even if currentComponentId is null,
   * then associate them with the component when it's destroyed.
   * This catches subscriptions created outside of tracked contexts.
   */
  private hookSubscriptionCreation(): void {
    // Try to access rxjs Observable prototype from the page's global scope
    const rxjs = (globalThis as unknown as { rxjs?: { Observable?: { prototype?: ObservablePrototype } } }).rxjs;
    const observableProto = rxjs?.Observable?.prototype ?? this.findObservablePrototype();
    
    if (observableProto && typeof observableProto.subscribe === 'function') {
      console.log('[ngLens] Successfully patching Observable.prototype.subscribe');
      this.patchObservableSubscribe(observableProto);
      return;
    }

    // Fallback: Try to patch Subscriber.prototype.unsubscribe
    console.log('[ngLens] Observable.prototype.subscribe not available, trying Subscriber fallback');
    if (this.patchSubscriberUnsubscribe()) {
      return;
    }

    console.warn('[ngLens] Could not patch RxJS subscriptions - inline subscription detection disabled');
  }

  /**
   * Patches Observable.prototype.subscribe to track subscriptions.
   */
  private patchObservableSubscribe(observableProto: ObservablePrototype): void {
    this.originalSubscribe = observableProto.subscribe;
    this.patchedObservableProto = observableProto;

    const getState = () => ({
      running: this.running,
      currentComponentId: this.currentComponentId,
      activeComponents: this.activeComponents,
      originalSubscribe: this.originalSubscribe,
      inferSource: (obs: unknown) => this.inferSubscriptionSource(obs),
    });

    observableProto.subscribe = function patchedSubscribe(this: unknown, ...args: unknown[]): unknown {
      const state = getState();
      console.log('[ngLens] Observable.subscribe called. Running:', state.running, 'ComponentId:', state.currentComponentId);
      
      if (!state.originalSubscribe) return undefined;
      
      let subscription: SubscriptionLike;
      try {
        subscription = state.originalSubscribe.apply(this, args) as SubscriptionLike;
      } catch (e) {
        console.error('[ngLens] Error calling original subscribe:', e);
        return undefined;
      }

      if (!state.running) {
        console.log('[ngLens] LeakDetector not running, skipping subscription tracking');
        return subscription;
      }

      // If we have a component context, track it immediately
      if (state.currentComponentId && subscription) {
        const componentId = state.currentComponentId;
        const lifecycle = state.activeComponents.get(componentId);
        if (lifecycle) {
          const record: SubscriptionRecord = {
            id: generateSubscriptionId(),
            source: state.inferSource(this),
            createdAt: performance.now(),
            cleaned: false,
            cleanedAt: null,
          };
          lifecycle.subscriptions.push(record);
          console.log(`[ngLens] Tracked subscription: ${record.source} for ${componentId}`);

          // Wrap unsubscribe to mark cleanup
          if (subscription && typeof subscription.unsubscribe === 'function') {
            const originalUnsubscribe = subscription.unsubscribe.bind(subscription);
            subscription.unsubscribe = () => {
              record.cleaned = true;
              record.cleanedAt = performance.now();
              console.log(`[ngLens] Subscription cleaned: ${record.source}`);
              originalUnsubscribe();
            };
          }

          // Also track if subscription is added to a collection
          if (subscription && typeof subscription.add === 'function') {
            const originalAdd = subscription.add.bind(subscription);
            subscription.add = (teardown: unknown) => {
              if (teardown && typeof (teardown as SubscriptionLike).unsubscribe === 'function') {
                const addedSub = teardown as SubscriptionLike;
                const addedRecord: SubscriptionRecord = {
                  id: generateSubscriptionId(),
                  source: `${record.source} (added)`,
                  createdAt: performance.now(),
                  cleaned: false,
                  cleanedAt: null,
                };
                lifecycle.subscriptions.push(addedRecord);

                const originalAddedUnsubscribe = addedSub.unsubscribe.bind(addedSub);
                addedSub.unsubscribe = () => {
                  addedRecord.cleaned = true;
                  addedRecord.cleanedAt = performance.now();
                  originalAddedUnsubscribe();
                };
              }
              return originalAdd(teardown);
            };
          }
        }
      }

      return subscription;
    };
  }

  /**
   * Fallback: Patches Subscriber.prototype.unsubscribe to track cleanup.
   * This is more reliable across RxJS versions.
   */
  private patchSubscriberUnsubscribe(): boolean {
    try {
      const win = globalThis as unknown as Record<string, unknown>;
      
      // Find Subscriber
      let subscriber: any = null;
      for (const key in win) {
        try {
          const value = win[key];
          if (value && typeof value === 'object' && (value as any)?.Subscriber?.prototype?.unsubscribe) {
            subscriber = (value as any).Subscriber;
            console.log(`[ngLens] Found Subscriber at window.${key}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!subscriber) {
        console.log('[ngLens] Subscriber not found');
        return false;
      }

      console.log('[ngLens] Patching Subscriber.prototype.unsubscribe');
      
      const originalUnsubscribe = subscriber.prototype.unsubscribe;
      const getState = () => ({
        running: this.running,
        activeComponents: this.activeComponents,
      });

      subscriber.prototype.unsubscribe = function() {
        const state = getState();
        
        // If this subscriber is tracked, mark as cleaned
        if (this.__leakId !== undefined && state.running) {
          const lifecycles = Array.from(state.activeComponents.values());
          for (const lifecycle of lifecycles) {
            for (const sub of lifecycle.subscriptions) {
              if (sub.id === this.__leakId) {
                sub.cleaned = true;
                sub.cleanedAt = performance.now();
                break;
              }
            }
          }
        }
        
        return originalUnsubscribe.apply(this);
      };

      return true;
    } catch (error) {
      console.error('[ngLens] Failed to patch Subscriber:', error);
      return false;
    }
  }

  /**
   * Restores the original Observable.prototype.subscribe.
   */
  private unhookSubscriptionCreation(): void {
    if (this.patchedObservableProto && this.originalSubscribe) {
      this.patchedObservableProto.subscribe = this.originalSubscribe;
    }
    this.originalSubscribe = null;
    this.patchedObservableProto = null;
  }

  /**
   * Wraps setInterval/setTimeout to track timer ownership, and
   * clearInterval/clearTimeout to mark timer cleanup.
   */
  private hookTimerCreation(): void {
    // Store originals
    this.originalSetInterval = globalThis.setInterval.bind(globalThis);
    this.originalSetTimeout = globalThis.setTimeout.bind(globalThis);
    this.originalClearInterval = globalThis.clearInterval.bind(globalThis);
    this.originalClearTimeout = globalThis.clearTimeout.bind(globalThis);

    const getTimerState = () => ({
      running: this.running,
      currentComponentId: this.currentComponentId,
      activeComponents: this.activeComponents,
      timerToComponent: this.timerToComponent,
      originalSetInterval: this.originalSetInterval,
      originalSetTimeout: this.originalSetTimeout,
      originalClearInterval: this.originalClearInterval,
      originalClearTimeout: this.originalClearTimeout,
      markTimerCleared: (id: number) => this.markTimerCleared(id),
    });

    // Patch setInterval
    (globalThis as unknown as Record<string, unknown>)['setInterval'] = (
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ): number => {
      const state = getTimerState();
      if (!state.originalSetInterval) return 0;
      const timerId = state.originalSetInterval(handler, timeout, ...args);

      if (state.running && state.currentComponentId) {
        const componentId = state.currentComponentId;
        const lifecycle = state.activeComponents.get(componentId);
        if (lifecycle) {
          const record: TimerRecord = {
            id: generateTimerId(),
            type: 'interval',
            createdAt: performance.now(),
            cleared: false,
          };
          lifecycle.timers.push(record);
          state.timerToComponent.set(timerId, { componentId, recordId: record.id });
        }
      }

      return timerId;
    };

    // Patch setTimeout
    (globalThis as unknown as Record<string, unknown>)['setTimeout'] = (
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ): number => {
      const state = getTimerState();
      if (!state.originalSetTimeout) return 0;
      const timerId = state.originalSetTimeout(handler, timeout, ...args);

      if (state.running && state.currentComponentId) {
        const componentId = state.currentComponentId;
        const lifecycle = state.activeComponents.get(componentId);
        if (lifecycle) {
          const record: TimerRecord = {
            id: generateTimerId(),
            type: 'timeout',
            createdAt: performance.now(),
            cleared: false,
          };
          lifecycle.timers.push(record);
          state.timerToComponent.set(timerId, { componentId, recordId: record.id });
        }
      }

      return timerId;
    };

    // Patch clearInterval
    (globalThis as unknown as Record<string, unknown>)['clearInterval'] = (
      id?: number
    ): void => {
      const state = getTimerState();
      if (id !== undefined) {
        state.markTimerCleared(id);
      }
      if (state.originalClearInterval) state.originalClearInterval(id);
    };

    // Patch clearTimeout
    (globalThis as unknown as Record<string, unknown>)['clearTimeout'] = (
      id?: number
    ): void => {
      const state = getTimerState();
      if (id !== undefined) {
        state.markTimerCleared(id);
      }
      if (state.originalClearTimeout) state.originalClearTimeout(id);
    };
  }

  /**
   * Restores the original setInterval/setTimeout/clearInterval/clearTimeout.
   */
  private unhookTimerCreation(): void {
    if (this.originalSetInterval) {
      (globalThis as unknown as Record<string, unknown>)['setInterval'] = this.originalSetInterval;
    }
    if (this.originalSetTimeout) {
      (globalThis as unknown as Record<string, unknown>)['setTimeout'] = this.originalSetTimeout;
    }
    if (this.originalClearInterval) {
      (globalThis as unknown as Record<string, unknown>)['clearInterval'] = this.originalClearInterval;
    }
    if (this.originalClearTimeout) {
      (globalThis as unknown as Record<string, unknown>)['clearTimeout'] = this.originalClearTimeout;
    }
    this.originalSetInterval = null;
    this.originalSetTimeout = null;
    this.originalClearInterval = null;
    this.originalClearTimeout = null;
  }

  /**
   * Marks a timer as cleared by looking up its component association.
   */
  private markTimerCleared(timerId: number): void {
    const mapping = this.timerToComponent.get(timerId);
    if (!mapping) return;

    const lifecycle = this.activeComponents.get(mapping.componentId);
    if (lifecycle) {
      const timerRecord = lifecycle.timers.find(t => t.id === mapping.recordId);
      if (timerRecord) {
        timerRecord.cleared = true;
      }
    }
    this.timerToComponent.delete(timerId);
  }

  /**
   * Attempts to find the Observable prototype from rxjs loaded in the page.
   * Tries multiple strategies to locate RxJS in different module systems.
   */
  private findObservablePrototype(): ObservablePrototype | null {
    const win = globalThis as unknown as Record<string, unknown>;

    // Strategy 1: Check common global patterns
    const candidates = [
      (win['rxjs'] as { Observable?: { prototype?: ObservablePrototype } })?.Observable?.prototype,
      (win['Rx'] as { Observable?: { prototype?: ObservablePrototype } })?.Observable?.prototype,
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate.subscribe === 'function') {
        console.log('[ngLens] Found RxJS Observable at common location');
        return candidate;
      }
    }

    // Strategy 2: Search all window properties for RxJS
    console.log('[ngLens] Searching window properties for RxJS...');
    for (const key in win) {
      try {
        const value = win[key];
        if (
          value &&
          typeof value === 'object' &&
          (value as any)?.Observable?.prototype?.subscribe
        ) {
          console.log(`[ngLens] Found RxJS Observable at window.${key}`);
          return (value as any).Observable.prototype;
        }
      } catch {
        // Skip properties that throw on access
        continue;
      }
    }

    // Strategy 3: Check for Subscriber directly (fallback)
    console.log('[ngLens] Searching for RxJS Subscriber...');
    for (const key in win) {
      try {
        const value = win[key];
        if (
          value &&
          typeof value === 'object' &&
          (value as any)?.Subscriber?.prototype?.unsubscribe
        ) {
          console.log(`[ngLens] Found RxJS Subscriber at window.${key}`);
          // Return Observable if available, otherwise null (will use Subscriber fallback)
          return (value as any).Observable?.prototype ?? null;
        }
      } catch {
        continue;
      }
    }

    console.warn('[ngLens] RxJS not found in window properties');
    return null;
  }

  /**
   * Infers the source of a subscription from the Observable instance.
   * Attempts to extract a meaningful name from the observable's operator chain.
   */
  private inferSubscriptionSource(observable: unknown): string {
    if (!observable || typeof observable !== 'object') return 'unknown';

    const obs = observable as Record<string, unknown>;

    // Try to get source info from the observable's operator or source
    if (obs['source'] && typeof obs['source'] === 'object') {
      const source = obs['source'] as Record<string, unknown>;
      if (typeof source['constructor'] === 'function') {
        return source['constructor'].name ?? 'Observable';
      }
    }

    // Try constructor name
    if (typeof obs['constructor'] === 'function') {
      const name = (obs['constructor'] as { name?: string }).name;
      if (name && name !== 'Observable') return name;
    }

    return 'Observable';
  }

  /**
   * Sets the current component context. Used externally to associate
   * subscriptions/timers with a specific component during its execution.
   */
  setCurrentComponentContext(componentId: string | null): void {
    this.currentComponentId = componentId;
  }

  /**
   * Gets the current component context ID.
   */
  getCurrentComponentContext(): string | null {
    return this.currentComponentId;
  }

  /**
   * Pushes a component context onto the stack.
   * Used to wrap lifecycle hook execution so that subscriptions/timers
   * created during hooks are attributed to the correct component.
   */
  pushContext(componentId: string): void {
    this.contextStack.push(componentId);
    this.currentComponentId = componentId;
  }

  /**
   * Pops the current context from the stack, restoring the previous one.
   * If the stack is empty after popping, currentComponentId is set to null.
   */
  popContext(): void {
    this.contextStack.pop();
    this.currentComponentId = this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : null;
  }

  /**
   * Patches lifecycle hooks on a component instance to wrap their execution
   * with push/pop context. This ensures subscriptions and timers created
   * during ngOnInit, ngAfterViewInit, etc. are attributed to the correct component.
   * 
   * IMPROVED: Also patches all enumerable methods to maintain context during
   * any method execution, not just lifecycle hooks. This catches subscriptions
   * created in custom methods, event handlers, etc.
   */
  private patchLifecycleHooks(component: ComponentInstance, componentId: string): void {
    const hooks = ['ngOnInit', 'ngAfterViewInit', 'ngAfterContentInit', 'ngDoCheck', 'ngOnDestroy'] as const;

    // Patch known lifecycle hooks
    for (const hook of hooks) {
      const original = component[hook];
      if (typeof original === 'function') {
        component[hook] = this.wrapMethodWithContext(original as () => unknown, componentId);
      }
    }

    // IMPROVED: Also patch all other methods to maintain context
    // This catches subscriptions created in custom methods, event handlers, etc.
    const proto = Object.getPrototypeOf(component);
    if (proto && proto !== Object.prototype) {
      const methodNames = Object.getOwnPropertyNames(proto);
      const MAX_METHODS_TO_PATCH = 100; // Performance limit
      let methodsPatched = 0;

      for (const methodName of methodNames) {
        if (methodsPatched >= MAX_METHODS_TO_PATCH) break;
        
        // Skip lifecycle hooks (already patched), constructor, and private methods
        if (
          hooks.includes(methodName as any) ||
          methodName === 'constructor' ||
          methodName.startsWith('_') ||
          methodName.startsWith('__')
        ) {
          continue;
        }

        try {
          const method = proto[methodName];
          if (typeof method === 'function' && !method.toString().includes('[native code]')) {
            // Wrap the method to maintain component context
            component[methodName] = this.wrapMethodWithContext(
              method.bind(component),
              componentId
            );
            methodsPatched++;
          }
        } catch {
          // Skip methods that can't be patched (getters, setters, etc.)
          continue;
        }
      }
    }
  }

  /**
   * Wraps a method to maintain component context during execution.
   * This ensures subscriptions and timers created during method execution
   * are attributed to the correct component.
   */
  private wrapMethodWithContext(
    method: (...args: unknown[]) => unknown,
    componentId: string
  ): (...args: unknown[]) => unknown {
    return (...args: unknown[]) => {
      this.pushContext(componentId);
      try {
        return method(...args);
      } finally {
        this.popContext();
      }
    };
  }

  /**
   * Attempts to hook into Angular's internal component creation by patching
   * the ViewContainerRef prototype's createComponent method.
   */
  private hookViaAngularInternals(): void {
    const ng = (globalThis as unknown as { ng?: NgGlobals }).ng;
    if (!ng) return;

    // Try to patch ViewContainerRef.createComponent via Angular's internal APIs
    // Angular 17+ exposes component creation through the framework's DI system
    try {
      const appRef = this.getApplicationRef(ng);
      if (appRef?.components) {
        // Track already-existing components
        for (const componentRef of appRef.components) {
          this.trackExistingComponent(componentRef, ng);
        }
      }
    } catch {
      // Angular internals may not be accessible; fall back to MutationObserver
    }
  }

  /**
   * Uses a MutationObserver to detect new Angular component elements
   * added to the DOM. When a new element with Angular component markers
   * is detected, it extracts the component instance and tracks it.
   */
  private mutationObserver: MutationObserver | null = null;

  private hookViaMutationObserver(): void {
    const ng = (globalThis as unknown as { ng?: NgGlobals }).ng;
    if (!ng?.getComponent) {
      console.log('[ngLens] ng.getComponent not available, MutationObserver disabled');
      return;
    }

    console.log('[ngLens] MutationObserver enabled');

    this.mutationObserver = new MutationObserver((mutations) => {
      if (!this.running) return;

      for (const mutation of mutations) {
        this.processAddedNodes(mutation.addedNodes, ng);
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    console.log('[ngLens] MutationObserver started');
  }

  /**
   * Processes added DOM nodes from a mutation, checking each for
   * Angular component instances to track.
   */
  private processAddedNodes(nodes: NodeList, ng: NgGlobals): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node instanceof HTMLElement) {
        this.checkAndTrackElement(node, ng);
        // Also check child elements for nested components
        const children = node.querySelectorAll('*');
        for (let j = 0; j < children.length; j++) {
          const child = children[j];
          if (child instanceof HTMLElement) {
            this.checkAndTrackElement(child, ng);
          }
        }
      }
    }
  }

  /**
   * Checks if an element hosts an Angular component and tracks it if so.
   * 
   * IMPROVED: Sets the component as the current context immediately after creation,
   * so that subscriptions created during component initialization are tracked.
   */
  private checkAndTrackElement(element: HTMLElement, ng: NgGlobals): void {
    try {
      const component = ng.getComponent(element);
      if (!component) return;

      // Avoid tracking the same component instance twice
      if (this.isAlreadyTracked(element)) return;

      const componentName = component.constructor?.name ?? 'UnknownComponent';
      const componentId = generateComponentId(componentName);

      console.log(`[ngLens] Tracking component: ${componentName} (${componentId})`);

      // Mark element as tracked
      this.markAsTracked(element, componentId);

      // Record creation
      this.onComponentCreated(componentId, componentName);

      // CRITICAL: Set component context immediately so subscriptions created
      // during initialization (before lifecycle hooks) are tracked
      this.setCurrentComponentContext(componentId);

      // Patch lifecycle hooks to maintain context during hook execution
      this.patchLifecycleHooks(component, componentId);

      // Hook destruction via DestroyRef if available (Angular 17+)
      this.hookDestroyRef(element, componentId, ng);
    } catch (error) {
      console.error('[ngLens] Error tracking component:', error);
    }
  }

  /**
   * Tracks an existing component that was already in the DOM when
   * the detector started.
   */
  private trackExistingComponent(componentRef: ComponentRef, ng: NgGlobals): void {
    try {
      const instance = componentRef.instance;
      if (!instance) return;

      const element = componentRef.location?.nativeElement;
      if (!element || !(element instanceof HTMLElement)) return;

      if (this.isAlreadyTracked(element)) return;

      const componentName = instance.constructor?.name ?? 'UnknownComponent';
      const componentId = generateComponentId(componentName);

      this.markAsTracked(element, componentId);
      this.onComponentCreated(componentId, componentName);
      this.hookDestroyRef(element, componentId, ng);
    } catch {
      // Skip components that can't be tracked
    }
  }

  /**
   * Hooks into Angular's DestroyRef for a component to detect when
   * it is destroyed. For Angular 17+, DestroyRef is the standard
   * mechanism for cleanup callbacks.
   */
  private hookDestroyRef(
    element: HTMLElement,
    componentId: string,
    ng: NgGlobals
  ): void {
    try {
      // Angular 17+ provides DestroyRef via the injector
      const injector = ng.getOwningInjector?.(element);
      if (injector) {
        const destroyRef = injector.get?.(this.getDestroyRefToken(ng)) as any;
        if (destroyRef && typeof destroyRef.onDestroy === 'function') {
          console.log(`[ngLens] Registered DestroyRef for ${componentId}`);
          destroyRef.onDestroy(() => {
            console.log(`[ngLens] DestroyRef callback fired for ${componentId}`);
            this.onComponentDestroyed(componentId);
          });
          return;
        }
      }

      // Fallback: use ngOnDestroy hook if the component implements it
      const component = ng.getComponent(element);
      if (component && typeof component.ngOnDestroy === 'function') {
        console.log(`[ngLens] Patching ngOnDestroy for ${componentId}`);
        const originalOnDestroy = component.ngOnDestroy.bind(component);
        component.ngOnDestroy = () => {
          console.log(`[ngLens] ngOnDestroy called for ${componentId}`);
          this.onComponentDestroyed(componentId);
          originalOnDestroy();
        };
      } else if (component) {
        console.log(`[ngLens] Component ${componentId} has no ngOnDestroy hook`);
      }
    } catch (error) {
      console.warn(`[ngLens] Failed to hook destruction for ${componentId}:`, error);
      // DestroyRef not available; destruction won't be tracked for this component
    }
  }

  /**
   * Attempts to get the DestroyRef injection token from Angular's internals.
   */
  private getDestroyRefToken(ng: NgGlobals): unknown {
    // Angular 17+ exposes DestroyRef as a class that can be used as a token
    // Try to access it via the framework's exported symbols
    const angularCore = (globalThis as unknown as { [key: string]: unknown })['@angular/core'];
    if (angularCore && typeof angularCore === 'object' && 'DestroyRef' in angularCore) {
      return (angularCore as Record<string, unknown>)['DestroyRef'];
    }

    // Fallback: try to find it via ng APIs
    if (ng.ɵDestroyRef) {
      return ng.ɵDestroyRef;
    }

    return null;
  }

  /**
   * Gets the ApplicationRef instance from Angular's global utilities.
   */
  private getApplicationRef(ng: NgGlobals): ApplicationRef | null {
    try {
      // Angular dev mode exposes getComponent and other utilities
      // We can get ApplicationRef from the root element's injector
      const rootElement = document.querySelector('[ng-version]');
      if (!rootElement) return null;

      const injector = ng.getOwningInjector?.(rootElement as HTMLElement);
      if (!injector) return null;

      // Try to get ApplicationRef from the injector
      const appRef = injector.get?.(this.getApplicationRefToken()) as any;
      return appRef ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Attempts to get the ApplicationRef injection token.
   */
  private getApplicationRefToken(): unknown {
    const angularCore = (globalThis as unknown as { [key: string]: unknown })['@angular/core'];
    if (angularCore && typeof angularCore === 'object' && 'ApplicationRef' in angularCore) {
      return (angularCore as Record<string, unknown>)['ApplicationRef'];
    }
    return null;
  }

  /**
   * Checks if an element has already been tracked by this detector.
   */
  private isAlreadyTracked(element: HTMLElement): boolean {
    return 'nglensTracked' in element.dataset;
  }

  /**
   * Marks an element as tracked by this detector.
   */
  private markAsTracked(element: HTMLElement, componentId: string): void {
    element.dataset['nglensTracked'] = componentId;
  }

  /**
   * Removes tracking attributes from DOM elements
   */
  private unhookComponentLifecycle(): void {
    // Stop the MutationObserver
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // Remove tracking attributes from DOM elements
    const trackedElements = document.querySelectorAll('[data-nglens-tracked]');
    for (let i = 0; i < trackedElements.length; i++) {
      const el = trackedElements[i];
      if (el instanceof HTMLElement) {
        delete el.dataset['nglensTracked'];
      }
    }

    // Reset state
    this.patchedFactories = new WeakSet<object>();
    this.originalCreateComponent = null;
  }
}

// --- Type Definitions for Angular Internals ---

interface NgGlobals {
  getComponent: (element: HTMLElement) => ComponentInstance | null;
  getOwningInjector?: (element: HTMLElement) => Injector | null;
  ɵDestroyRef?: unknown;
}

interface ComponentInstance {
  constructor?: { name?: string };
  ngOnDestroy?: () => void;
  [key: string]: unknown;
}

interface Injector {
  get?: (token: unknown) => DestroyRefInstance | ApplicationRef | null;
}

interface DestroyRefInstance {
  onDestroy: (callback: () => void) => void;
}

interface ComponentRef {
  instance: ComponentInstance | null;
  location?: { nativeElement: unknown };
}

interface ApplicationRef {
  components?: ComponentRef[];
}

// --- Type Definitions for Subscription/Timer Tracking ---

interface ObservablePrototype {
  subscribe: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

interface SubscriptionLike {
  unsubscribe: () => void;
  [key: string]: unknown;
}

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
   */
  onComponentCreated(componentId: string, componentName: string, hostElement?: HTMLElement): void {
    this.activeComponents.set(componentId, {
      componentId,
      componentName,
      createdAt: performance.now(),
      destroyedAt: null,
      subscriptions: [],
      timers: [],
      hostElement,
    });
  }

  /**
   * Called when a component is destroyed.
   * Records the destruction timestamp and checks for surviving
   * subscriptions (CRITICAL) and timers (WARNING), emitting
   * LeakEvents for any detected leaks.
   * 
   * The scan happens BEFORE deletion from activeComponents map,
   * using the stored hostElement reference (works even if element is detached from DOM).
   */
  onComponentDestroyed(componentId: string): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle) return;

    // Clear component context if it's the current one
    if (this.currentComponentId === componentId) {
      this.setCurrentComponentContext(null);
    }

    lifecycle.destroyedAt = performance.now();

    // CRITICAL: Scan component properties for subscriptions BEFORE element is fully gone.
    // ng.getComponent works on the element via __ngContext__ even if detached from DOM.
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

    // Clean up: remove element reference to avoid memory retention
    lifecycle.hostElement = undefined;
    
    // Remove from active components
    this.activeComponents.delete(componentId);
  }

  /**
   * Scans a component instance for subscription properties that haven't been cleaned up.
   * Uses the stored hostElement reference (avoids DOM query which fails after removal).
   * Detects RxJS Subscription objects stored as component properties.
   */
  private scanComponentForUncleanedSubscriptions(componentId: string): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle) return;

    const ng = (globalThis as unknown as { ng?: NgGlobals }).ng;
    if (!ng?.getComponent) return;

    // Use stored element reference — critical because element may already be detached from DOM
    const element = lifecycle.hostElement;
    if (!element) return;

    try {
      const component = ng.getComponent(element);
      if (!component || typeof component !== 'object') return;

      this.scanObjectForSubscriptions(component, lifecycle);
    } catch {
      // Component introspection failed; skip
    }
  }

  /**
   * Scans an object (component instance) for RxJS Subscription properties.
   * Adds any untracked, unclosed subscriptions to the lifecycle record.
   */
  private scanObjectForSubscriptions(component: Record<string, unknown>, lifecycle: ComponentLifecycle): void {
    const MAX_PROPS_TO_CHECK = 100;
    let propsChecked = 0;

    // Check own properties
    const keys = Object.keys(component);
    for (const key of keys) {
      if (propsChecked++ > MAX_PROPS_TO_CHECK) break;
      // Skip private/internal and Angular metadata
      if (key.startsWith('__') || key.startsWith('ɵ')) continue;

      try {
        const value = component[key] as any;
        if (!value || typeof value !== 'object') continue;

        // Check if it's a real RxJS Subscription (has unsubscribe, closed, add)
        if (this.isSubscriptionLike(value)) {
          this.trackSubscriptionProperty(key, value, lifecycle);
        }

        // Check for subscription arrays (e.g., subscriptions: Subscription[])
        if (Array.isArray(value)) {
          for (let i = 0; i < Math.min(value.length, 50); i++) {
            const item = value[i];
            if (item && typeof item === 'object' && this.isSubscriptionLike(item)) {
              this.trackSubscriptionProperty(`${key}[${i}]`, item, lifecycle);
            }
          }
        }
      } catch {
        // Property access might throw (getters, proxies); skip
        continue;
      }
    }

    // Also check prototype methods that return subscription-like values stored as instance fields
    // Sometimes subscriptions are stored in inherited properties
    try {
      const proto = Object.getPrototypeOf(component);
      if (proto && proto !== Object.prototype) {
        const descriptors = Object.getOwnPropertyDescriptors(proto);
        for (const [key, desc] of Object.entries(descriptors)) {
          if (propsChecked++ > MAX_PROPS_TO_CHECK) break;
          if (key.startsWith('_') || key === 'constructor') continue;
          // Only check getters that might return subscription-like objects
          if (desc.get && !desc.set) {
            try {
              const value = (component as any)[key];
              if (value && typeof value === 'object' && this.isSubscriptionLike(value)) {
                this.trackSubscriptionProperty(key, value, lifecycle);
              }
            } catch { continue; }
          }
        }
      }
    } catch { /* skip prototype scanning errors */ }
  }

  /**
   * Checks if an object looks like an RxJS Subscription.
   */
  private isSubscriptionLike(obj: any): boolean {
    return (
      typeof obj.unsubscribe === 'function' &&
      'closed' in obj &&
      (typeof obj.add === 'function' || typeof obj._teardowns !== 'undefined')
    );
  }

  /**
   * Tracks a subscription found as a component property.
   * Only adds it if not already tracked and if it's not closed (leaked).
   */
  private trackSubscriptionProperty(
    propertyName: string,
    subscription: any,
    lifecycle: ComponentLifecycle
  ): void {
    // Check if this subscription is already tracked
    const isTracked = lifecycle.subscriptions.some(
      s => s.source === `${propertyName} (property)` || s.source === propertyName
    );
    if (isTracked) return;

    const record: SubscriptionRecord = {
      id: generateSubscriptionId(),
      source: `${propertyName} (property)`,
      createdAt: lifecycle.createdAt, // Approximate: use component creation time
      cleaned: !!subscription.closed,
      cleanedAt: subscription.closed ? performance.now() : null,
    };
    lifecycle.subscriptions.push(record);
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
   * 
   * In modern bundled Angular apps, RxJS is not on window globals.
   * Strategy: find a component with an Observable property and extract its prototype.
   */
  private findObservablePrototype(): ObservablePrototype | null {
    const win = globalThis as unknown as Record<string, unknown>;

    // Strategy 1: Check common global patterns (works for non-bundled / UMD)
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

    // Strategy 2: Search window properties
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
        continue;
      }
    }

    // Strategy 3: Find Observable prototype from Angular component properties
    // In bundled apps, components often have Observable properties (e.g., from services)
    // We can extract the prototype from any Observable instance found on a component.
    console.log('[ngLens] Searching Angular components for Observable instances...');
    const ng = (globalThis as any).ng;
    if (ng?.getComponent) {
      try {
        const allElements = document.querySelectorAll('*');
        const limit = Math.min(allElements.length, 200);
        
        for (let i = 0; i < limit; i++) {
          try {
            const comp = ng.getComponent(allElements[i]);
            if (!comp) continue;
            
            // Search component properties for Observable-like objects
            const keys = Object.keys(comp);
            for (const key of keys) {
              try {
                const value = (comp as any)[key];
                if (
                  value &&
                  typeof value === 'object' &&
                  typeof value.subscribe === 'function' &&
                  typeof value.pipe === 'function' &&
                  value.constructor?.prototype?.subscribe
                ) {
                  const proto = value.constructor.prototype;
                  if (typeof proto.subscribe === 'function') {
                    console.log(`[ngLens] Found Observable prototype via component property '${key}'`);
                    return proto as ObservablePrototype;
                  }
                }
              } catch { continue; }
            }
          } catch { continue; }
        }
      } catch {
        // Component scanning failed
      }
    }

    // Strategy 4: Create a minimal Observable to extract the prototype
    // If Zone.js patched Promise, we can find RxJS through its internal async scheduling
    try {
      const zone = (globalThis as any).Zone;
      if (zone?.__symbol__) {
        // Zone.js is present — look for RxJS schedulers in Zone patches
        const asyncScheduler = (win as any).__zone_symbol__rxjs_async_scheduler;
        if (asyncScheduler?.constructor?.prototype) {
          const rxjsModule = asyncScheduler.constructor.prototype;
          if (rxjsModule.Observable?.prototype?.subscribe) {
            console.log('[ngLens] Found Observable via Zone.js RxJS scheduler');
            return rxjsModule.Observable.prototype;
          }
        }
      }
    } catch {
      // No Zone.js RxJS integration found
    }

    console.warn('[ngLens] RxJS Observable.prototype not found - will rely on property scanning for leak detection');
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
        // Track new components
        this.processAddedNodes(mutation.addedNodes, ng);
        
        // Detect component removal (fallback for when ngOnDestroy isn't called)
        this.processRemovedNodes(mutation.removedNodes);
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    console.log('[ngLens] MutationObserver started');
  }

  /**
   * Processes removed DOM nodes to detect component destruction.
   * This is a fallback for cases where ngOnDestroy/DestroyRef wasn't hooked
   * or didn't fire (e.g., router outlet replacement).
   */
  private processRemovedNodes(nodes: NodeList): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node instanceof HTMLElement) {
        this.checkRemovedElement(node);
        // Also check child elements
        const children = node.querySelectorAll('[data-nglens-tracked]');
        for (let j = 0; j < children.length; j++) {
          const child = children[j];
          if (child instanceof HTMLElement) {
            this.checkRemovedElement(child);
          }
        }
      }
    }
  }

  /**
   * Checks if a removed element was a tracked component and triggers destruction.
   */
  private checkRemovedElement(element: HTMLElement): void {
    const componentId = element.dataset['nglensTracked'];
    if (!componentId) return;
    
    // Only process if the component is still in our active map
    // (it may have already been handled by ngOnDestroy/DestroyRef)
    if (this.activeComponents.has(componentId)) {
      console.log(`[ngLens] Component removed from DOM (fallback): ${componentId}`);
      this.onComponentDestroyed(componentId);
    }
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
   * Immediately scans for existing subscriptions (catching ngOnInit subs).
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

      // Record creation with element reference stored
      this.onComponentCreated(componentId, componentName, element);

      // Set component context so future subscriptions are attributed
      this.setCurrentComponentContext(componentId);

      // Patch lifecycle hooks to maintain context during hook execution
      this.patchLifecycleHooks(component, componentId);

      // CRITICAL: Immediately scan component properties for existing subscriptions.
      // MutationObserver fires AFTER ngOnInit has already run, so subscriptions
      // created there are already stored as component properties.
      this.scanComponentForExistingSubscriptions(componentId);

      // Hook destruction via DestroyRef if available (Angular 17+)
      this.hookDestroyRef(element, componentId, ng);
    } catch (error) {
      console.error('[ngLens] Error tracking component:', error);
    }
  }

  /**
   * Scans a component immediately after tracking to find subscriptions
   * that already exist (created during ngOnInit or constructor).
   */
  private scanComponentForExistingSubscriptions(componentId: string): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle?.hostElement) return;

    const ng = (globalThis as unknown as { ng?: NgGlobals }).ng;
    if (!ng?.getComponent) return;

    try {
      const component = ng.getComponent(lifecycle.hostElement);
      if (!component || typeof component !== 'object') return;

      this.scanObjectForSubscriptions(component as Record<string, unknown>, lifecycle);
      
      if (lifecycle.subscriptions.length > 0) {
        console.log(`[ngLens] Found ${lifecycle.subscriptions.length} existing subscription(s) in ${lifecycle.componentName}`);
      }
    } catch {
      // Component not yet fully initialized; skip
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
      this.onComponentCreated(componentId, componentName, element);
      
      // Scan for existing subscriptions
      this.scanComponentForExistingSubscriptions(componentId);
      
      this.hookDestroyRef(element, componentId, ng);
    } catch {
      // Skip components that can't be tracked
    }
  }

  /**
   * Hooks into Angular's destruction mechanism for a component.
   *
   * Strategy order:
   * 1. Angular 17+: Use DestroyRef via ng.getOwningInjector()
   * 2. Angular 16: Use DestroyRef via component injector from __ngContext__
   * 3. Angular 15-16 fallback: Patch ngOnDestroy on the component instance
   * 4. Angular 15-16 fallback: Add a synthetic ngOnDestroy if none exists
   */
  private hookDestroyRef(
    element: HTMLElement,
    componentId: string,
    ng: NgGlobals
  ): void {
    try {
      // Strategy 1: Angular 17+ — DestroyRef via getOwningInjector
      if (typeof ng.getOwningInjector === 'function') {
        try {
          const injector = ng.getOwningInjector(element);
          if (injector) {
            const token = this.getDestroyRefToken(ng);
            if (token) {
              const destroyRef = injector.get?.(token) as any;
              if (destroyRef && typeof destroyRef.onDestroy === 'function') {
                console.log(`[ngLens] Registered DestroyRef for ${componentId}`);
                destroyRef.onDestroy(() => {
                  console.log(`[ngLens] DestroyRef callback fired for ${componentId}`);
                  this.onComponentDestroyed(componentId);
                });
                return;
              }
            }
          }
        } catch {
          // getOwningInjector may throw on some elements; fall through
        }
      }

      // Strategy 2: Angular 16 — DestroyRef via component's injector from LView
      try {
        const destroyRef = this.getDestroyRefFromLView(element, ng);
        if (destroyRef && typeof destroyRef.onDestroy === 'function') {
          console.log(`[ngLens] Registered DestroyRef (LView) for ${componentId}`);
          destroyRef.onDestroy(() => {
            console.log(`[ngLens] DestroyRef callback fired for ${componentId}`);
            this.onComponentDestroyed(componentId);
          });
          return;
        }
      } catch {
        // LView-based DestroyRef not available; fall through
      }

      // Strategy 3: Angular 15-16 fallback — patch ngOnDestroy
      const component = ng.getComponent(element);
      if (component && typeof component.ngOnDestroy === 'function') {
        console.log(`[ngLens] Patching ngOnDestroy for ${componentId}`);
        const originalOnDestroy = component.ngOnDestroy.bind(component);
        const self = this;
        component.ngOnDestroy = () => {
          console.log(`[ngLens] ngOnDestroy called for ${componentId}`);
          // CRITICAL: Scan and emit BEFORE calling original ngOnDestroy,
          // because the original may trigger further cleanup that affects property state
          self.onComponentDestroyed(componentId);
          originalOnDestroy();
        };
        return;
      }

      // Strategy 4: Component has no ngOnDestroy — add a synthetic one
      // This is needed for Angular 15-16 components without ngOnDestroy
      if (component) {
        console.log(`[ngLens] Adding synthetic ngOnDestroy for ${componentId}`);
        const self = this;
        component.ngOnDestroy = () => {
          console.log(`[ngLens] Synthetic ngOnDestroy called for ${componentId}`);
          self.onComponentDestroyed(componentId);
        };

        // Also register on the ɵcmp definition so Angular calls it
        const cmp = component.constructor?.ɵcmp as any;
        if (cmp && cmp.onDestroy === null) {
          cmp.onDestroy = component.ngOnDestroy;
        }
      }
    } catch (error) {
      console.warn(`[ngLens] Failed to hook destruction for ${componentId}:`, error);
    }
  }

  /**
   * Attempts to get DestroyRef from the component's LView/injector for Angular 16.
   * In Angular 16, DestroyRef exists but getOwningInjector may not be exposed globally.
   */
  private getDestroyRefFromLView(element: HTMLElement, ng: NgGlobals): DestroyRefInstance | null {
    const ngContext = (element as any).__ngContext__;
    if (ngContext == null) return null;

    // In Angular 15-16, __ngContext__ is often a number (LView index) or an LView array
    // In Angular 16+, the LView may have an injector at a known offset
    if (Array.isArray(ngContext)) {
      // Walk the LView looking for an injector-like object
      for (let i = 0; i < Math.min(ngContext.length, 30); i++) {
        const item = ngContext[i];
        if (item && typeof item === 'object' && typeof item.get === 'function') {
          try {
            const token = this.getDestroyRefToken(ng);
            if (token) {
              const destroyRef = item.get(token);
              if (destroyRef && typeof destroyRef.onDestroy === 'function') {
                return destroyRef as DestroyRefInstance;
              }
            }
          } catch {
            continue;
          }
        }
      }
    }

    return null;
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
   * Supports Angular 15-21 with multiple fallback strategies.
   */
  private getApplicationRef(ng: NgGlobals): ApplicationRef | null {
    try {
      const rootElement = document.querySelector('[ng-version]');
      if (!rootElement) return null;

      // Strategy 1: Angular 17+ — use getOwningInjector
      if (typeof ng.getOwningInjector === 'function') {
        try {
          const injector = ng.getOwningInjector(rootElement as HTMLElement);
          if (injector) {
            const token = this.getApplicationRefToken();
            if (token) {
              const appRef = injector.get?.(token) as any;
              if (appRef?.components) return appRef;
            }
          }
        } catch {
          // Fall through to next strategy
        }
      }

      // Strategy 2: Angular 15-16 — access via getAllAngularRootElements + component injector
      try {
        const getAllRootElements = (globalThis as any).getAllAngularRootElements;
        if (typeof getAllRootElements === 'function') {
          const roots = getAllRootElements();
          if (roots?.length > 0) {
            const rootComp = ng.getComponent(roots[0]);
            if (rootComp) {
              // In Angular 15-16, the root component's injector may have ApplicationRef
              const ngContext = (roots[0] as any).__ngContext__;
              if (Array.isArray(ngContext)) {
                // Look for injector in the LView
                for (let i = 0; i < Math.min(ngContext.length, 20); i++) {
                  const item = ngContext[i];
                  if (item && typeof item === 'object' && typeof item.get === 'function') {
                    try {
                      const token = this.getApplicationRefToken();
                      if (token) {
                        const appRef = item.get(token);
                        if (appRef?.components) return appRef as ApplicationRef;
                      }
                    } catch {
                      continue;
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Fall through
      }

      return null;
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
  constructor?: { name?: string; ɵcmp?: unknown };
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

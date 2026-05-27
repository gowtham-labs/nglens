// src/instrumentation/render-tracker.ts
// Hybrid approach: MutationObserver + ng.getComponent + Zone.js
// Works reliably on Angular 17-20+ without depending on internal APIs

import type { RenderEvent, RenderCause, EventBatch } from '../types/render-events';

const PAGE_TO_CONTENT_EVENT = '__ng_perf_to_content';

export class RenderTracker {
  private static instance: RenderTracker | null = null;

  private readonly eventBuffer: RenderEvent[] = [];
  private isRunning = false;
  private batchSequence = 0;
  private flushInterval: number | null = null;
  private mutationObserver: MutationObserver | null = null;

  // Zone.js tracking
  private lastZoneCause: RenderCause | null = null;
  private originalZoneScheduleTask: any = null;
  private zoneDelegate: any = null;

  // Component registry: maps host elements to component names
  private readonly componentElements = new Map<Element, string>();
  // Debounce: avoid recording the same component multiple times per frame
  private readonly pendingComponents = new Set<string>();
  private frameRequestId: number | null = null;

  // Component discovery interval
  private discoveryInterval: number | null = null;

  private constructor() {}

  static getInstance(): RenderTracker {
    if (!RenderTracker.instance) {
      RenderTracker.instance = new RenderTracker();
    }
    return RenderTracker.instance;
  }

  start(): void {
    if (this.isRunning) return;

    // console.log('[ngLens RenderTracker] Starting hybrid approach (MutationObserver + Zone.js)');

    // 1. Discover all Angular components on the page
    this.discoverComponents();

    // 2. Set up MutationObserver on document body
    this.setupMutationObserver();

    // 3. Hook Zone.js for cause attribution
    this.hookZoneJs();

    // 4. Start batching
    this.startBatching();

    // 5. Periodically re-discover components (for lazy-loaded ones)
    this.startComponentDiscovery();

    this.isRunning = true;
    // console.log(`[ngLens RenderTracker] Tracking ${this.componentElements.size} components`);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.flush();

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.discoveryInterval !== null) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.frameRequestId !== null) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }
    this.unhookZoneJs();
    this.componentElements.clear();
    this.pendingComponents.clear();
    this.isRunning = false;
  }

  recordCause(cause: RenderCause): void {
    this.lastZoneCause = cause;
  }

  getBuffer(): RenderEvent[] {
    return this.eventBuffer;
  }

  clearBuffer(): RenderEvent[] {
    return this.eventBuffer.splice(0);
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  // --- Component Discovery ---

  private startComponentDiscovery(): void {
    // Re-discover every 3 seconds to catch lazy-loaded components
    this.discoveryInterval = globalThis.setInterval(() => this.discoverComponents(), 3000);
  }

  private discoverComponents(): void {
    const ng = (globalThis as any).ng;
    if (!ng?.getComponent) return;

    // Walk all elements looking for Angular components
    const allElements = document.querySelectorAll('*');
    const limit = Math.min(allElements.length, 2000);

    for (let i = 0; i < limit; i++) {
      const el = allElements[i];
      if (this.componentElements.has(el)) continue; // Already tracked

      try {
        const component = ng.getComponent(el);
        if (component) {
          const name = component.constructor?.name ?? 'UnknownComponent';
          this.componentElements.set(el, name);
        }
      } catch {
        // Not a component element
      }
    }
  }

  // --- MutationObserver ---

  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      if (!this.isRunning) return;

      let routeChanged = false;

      for (const mutation of mutations) {
        // Detect Angular route changes: router-outlet child nodes being replaced
        if (mutation.type === 'childList' && mutation.target instanceof Element) {
          const tagName = mutation.target.tagName?.toLowerCase();
          if (tagName === 'router-outlet' || mutation.target.querySelector?.(':scope > router-outlet')) {
            if (mutation.addedNodes.length > 0) {
              routeChanged = true;
            }
          }
        }

        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (!target) continue;

        // Find the nearest component host element
        const componentName = this.findOwnerComponent(target);
        if (componentName && !this.isRootComponent(componentName)) {
          this.pendingComponents.add(componentName);
        }
      }

      // Emit route change event if detected
      if (routeChanged) {
        this.emitRouteChanged();
      }

      // Debounce: process pending components once per frame
      if (this.pendingComponents.size > 0 && this.frameRequestId === null) {
        this.frameRequestId = requestAnimationFrame(() => {
          this.processPendingMutations();
          this.frameRequestId = null;
        });
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  private lastRouteChangeTime = 0;

  private emitRouteChanged(): void {
    // Debounce: don't emit more than once per 500ms
    const now = performance.now();
    if (now - this.lastRouteChangeTime < 500) return;
    this.lastRouteChangeTime = now;

    const message = {
      eventId: `route-${Date.now()}`,
      type: 'ROUTE_CHANGED',
      payload: { timestamp: now },
    };
    globalThis.dispatchEvent(new CustomEvent(PAGE_TO_CONTENT_EVENT, { detail: message }));
  }

  private processPendingMutations(): void {
    const timestamp = performance.now();
    const cause: RenderCause = this.lastZoneCause ?? { type: 'zone', source: 'unknown' };

    for (const componentName of this.pendingComponents) {
      const event: RenderEvent = {
        componentName,
        timestamp,
        duration: 0, // Can't measure duration with MutationObserver
        causes: [cause],
      };
      this.eventBuffer.push(event);
    }

    this.pendingComponents.clear();
    // Reset the zone cause after attributing it
    // (keep it for a short window so multiple components in the same CD cycle get the same cause)
    setTimeout(() => { this.lastZoneCause = null; }, 50);
  }

  private findOwnerComponent(element: Element): string | null {
    let current: Element | null = element;
    while (current) {
      const name = this.componentElements.get(current);
      if (name) return name;
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Checks if a component name is a root/shell component that should be excluded
   * from render tracking. These components wrap the entire app and produce
   * false positives because all child mutations bubble up to them.
   */
  private isRootComponent(name: string): boolean {
    // Match AppComponent, _AppComponent, or any minified variant ending in AppComponent
    return /^_*App(Component)?$/.test(name) || name === 'AppComponent';
  }

  // --- Zone.js Hook ---

  private hookZoneJs(): void {
    const zone = (globalThis as any).Zone?.current;
    if (!zone) return;

    const zoneDelegate = zone._zoneDelegate;
    if (!zoneDelegate || typeof zoneDelegate.scheduleTask !== 'function') return;

    this.zoneDelegate = zoneDelegate;
    this.originalZoneScheduleTask = zoneDelegate.scheduleTask.bind(zoneDelegate);

    const originalScheduleTask = this.originalZoneScheduleTask;

    zoneDelegate.scheduleTask = (targetZone: any, task: any): any => {
      const source = this.categorizeZoneTask(task);
      if (source) {
        this.lastZoneCause = { type: 'zone', source };
      }
      return originalScheduleTask(targetZone, task);
    };
  }

  private unhookZoneJs(): void {
    if (this.originalZoneScheduleTask && this.zoneDelegate) {
      this.zoneDelegate.scheduleTask = this.originalZoneScheduleTask;
      this.originalZoneScheduleTask = null;
      this.zoneDelegate = null;
    }
  }

  private categorizeZoneTask(task: any): string | null {
    if (!task) return null;
    const taskSource: string = task.source ?? '';
    const taskType: string = task.type ?? '';

    if (taskSource.includes('setTimeout')) return 'setTimeout';
    if (taskSource.includes('setInterval')) return 'setInterval';
    if (taskSource.includes('XMLHttpRequest')) return 'XMLHttpRequest';
    if (taskSource.includes('fetch')) return 'fetch';
    if (taskSource.includes('addEventListener')) {
      const match = /addEventListener:(\w+)/.exec(taskSource);
      return match ? `addEventListener:${match[1]}` : 'addEventListener';
    }
    if (taskType === 'microTask' || taskSource.includes('Promise')) return 'Promise.then';
    if (taskSource.includes('requestAnimationFrame')) return 'requestAnimationFrame';
    return taskSource || null;
  }

  // --- Batching ---

  private startBatching(): void {
    this.flushInterval = globalThis.setInterval(() => this.flush(), 100);
  }

  private flush(): void {
    const events = this.clearBuffer();
    if (events.length === 0) return;

    const batch: EventBatch = {
      events,
      batchTimestamp: performance.now(),
      sequenceNumber: ++this.batchSequence,
    };

    const message = {
      eventId: `batch-${batch.sequenceNumber}-${Date.now()}`,
      type: 'EVENT_BATCH',
      payload: batch,
    };

    globalThis.dispatchEvent(new CustomEvent(PAGE_TO_CONTENT_EVENT, { detail: message }));
  }
}

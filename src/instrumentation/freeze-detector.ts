/**
 * ngLens - Angular Performance Analyzer
 * Copyright (c) 2026 ngLens Contributors
 * Licensed under MIT
 *
 * https://github.com/gowtham-labs/nglens
 *
 * Freeze Detector
 *
 * Detects main-thread freezes and long-running tasks using PerformanceObserver.
 * Tracks:
 * - Long tasks (>50ms blocking the main thread)
 * - Expensive lifecycle hooks
 * - UI thread hangs during initialization
 * - Layout thrashing
 */

export interface FreezeEvent {
  componentName?: string;
  duration: number;
  startTime: number;
  cause?: string;
  lifecycle?: string;
  severity: 'medium' | 'high' | 'critical';
  timestamp: number;
}

export class FreezeDetector {
  private enabled = false;
  private observer: PerformanceObserver | null = null;
  private freezeEvents: FreezeEvent[] = [];
  private longTaskThreshold = 50; // ms
  private initStartTime = 0;
  private lastComponentTime = 0;
  private performanceMarkers = new Map<string, number>();

  constructor() {
    this.setupMarkingHooks();
  }

  start(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.initStartTime = performance.now();

    // Setup PerformanceObserver for long tasks
    if ('PerformanceObserver' in window && 'getLongTasks' in PerformanceObserver) {
      try {
        this.observer = new PerformanceObserver((list: PerformanceObserverEntryList) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > this.longTaskThreshold) {
              this.recordFreezeEvent({
                duration: entry.duration,
                startTime: entry.startTime,
                severity: this.calculateSeverity(entry.duration),
                cause: this.detectFreezeCause(entry),
                timestamp: Date.now(),
              });
            }
          }
        });

        this.observer.observe({ entryTypes: ['longtask', 'measure', 'navigation'] });
      } catch (error) {
        console.debug('[FreezeDetector] PerformanceObserver setup failed:', error);
      }
    }

    // Hook into lifecycle methods to track expensive operations
    this.setupLifecycleTracking();
  }

  stop(): void {
    if (!this.enabled) return;
    this.enabled = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Mark the start of a performance-sensitive operation
   */
  markStart(name: string): void {
    if (!this.enabled) return;
    this.performanceMarkers.set(name, performance.now());
  }

  /**
   * Mark the end of a performance-sensitive operation and check duration
   */
  markEnd(name: string, componentName?: string, lifecycle?: string): void {
    if (!this.enabled) return;

    const startTime = this.performanceMarkers.get(name);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    this.performanceMarkers.delete(name);

    if (duration > this.longTaskThreshold) {
      this.recordFreezeEvent({
        componentName,
        duration,
        startTime,
        lifecycle,
        cause: `${name} lifecycle hook`,
        severity: this.calculateSeverity(duration),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Setup hooks into lifecycle methods
   */
  private setupLifecycleTracking(): void {
    // Hook Angular lifecycle methods if available
    const ng = (globalThis as any).ng;
    if (!ng) return;

    try {
      // Try to patch common lifecycle hooks
      const lifecycleHooks = ['ngOnInit', 'ngAfterViewInit', 'ngAfterContentInit'];

      for (const hook of lifecycleHooks) {
        // This is a simplified version - actual implementation would need
        // to intercept component factory creation
        performance.mark(`ng-${hook}-start`);
      }
    } catch (error) {
      console.debug('[FreezeDetector] Lifecycle hook setup failed:', error);
    }
  }

  /**
   * Setup performance marking hooks
   */
  private setupMarkingHooks(): void {
    const original = performance.mark;
    const detector = this;

    performance.mark = function (markName: string) {
      if (markName.startsWith('ng:')) {
        detector.markStart(markName);
      }
      return original.call(this, markName);
    };

    const originalMeasure = performance.measure;
    performance.measure = function (measureName: string, startMarkName?: string, endMarkName?: string) {
      if (startMarkName?.startsWith('ng:') || measureName.startsWith('ng:')) {
        const startMark = startMarkName ? performance.getEntriesByName(startMarkName)[0] : null;
        if (startMark) {
          const duration = performance.now() - startMark.startTime;
          if (duration > detector.longTaskThreshold) {
            detector.recordFreezeEvent({
              duration,
              startTime: startMark.startTime,
              cause: measureName,
              severity: detector.calculateSeverity(duration),
              timestamp: Date.now(),
            });
          }
        }
      }
      return originalMeasure.call(this, measureName, startMarkName, endMarkName);
    };
  }

  /**
   * Record a freeze event
   */
  private recordFreezeEvent(event: FreezeEvent): void {
    this.freezeEvents.push(event);
    this.lastComponentTime = event.startTime;

    // Dispatch event for real-time monitoring
    window.dispatchEvent(
      new CustomEvent('ngLens:freeze', {
        detail: event,
      })
    );
  }

  /**
   * Calculate freeze severity
   */
  private calculateSeverity(
    duration: number
  ): 'medium' | 'high' | 'critical' {
    if (duration > 200) return 'critical';
    if (duration > 100) return 'high';
    return 'medium';
  }

  /**
   * Detect the cause of a freeze event
   */
  private detectFreezeCause(entry: PerformanceEntry): string | undefined {
    // Try to infer cause from performance timeline
    if (entry.name.includes('script')) return 'Script execution';
    if (entry.name.includes('layout')) return 'Layout thrashing';
    if (entry.name.includes('paint')) return 'Rendering/painting';
    if (entry.name.includes('ng')) return 'Angular operation';
    return undefined;
  }

  /**
   * Get all recorded freeze events
   */
  getEvents(): FreezeEvent[] {
    return [...this.freezeEvents];
  }

  /**
   * Get freeze events for a specific component
   */
  getComponentEvents(componentName: string): FreezeEvent[] {
    return this.freezeEvents.filter(e => e.componentName === componentName);
  }

  /**
   * Get freeze statistics
   */
  getStatistics(): {
    totalEvents: number;
    avgDuration: number;
    maxDuration: number;
    criticalCount: number;
  } {
    if (this.freezeEvents.length === 0) {
      return {
        totalEvents: 0,
        avgDuration: 0,
        maxDuration: 0,
        criticalCount: 0,
      };
    }

    const durations = this.freezeEvents.map(e => e.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const criticalCount = this.freezeEvents.filter(e => e.severity === 'critical').length;

    return {
      totalEvents: this.freezeEvents.length,
      avgDuration: totalDuration / this.freezeEvents.length,
      maxDuration: Math.max(...durations),
      criticalCount,
    };
  }

  /**
   * Clear recorded events
   */
  clear(): void {
    this.freezeEvents = [];
    this.performanceMarkers.clear();
  }

  /**
   * Set the long task threshold (default 50ms)
   */
  setThreshold(ms: number): void {
    this.longTaskThreshold = ms;
  }
}

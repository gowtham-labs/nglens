/**
 * ngLens - Angular Performance Analyzer
 * Copyright (c) 2026 ngLens Contributors
 * Licensed under GPL v3
 *
 * https://github.com/gowtham-labs/nglens
 *
 * Zone Pollution Detector (Enhanced)
 *
 * Detects async sources causing excessive change detection cycles:
 * - setTimeout/setInterval
 * - addEventListener
 * - fetch/XHR
 * - WebSocket
 * - Microtasks
 * - Third-party libraries (Chart.js, moment.js, etc.)
 *
 * Provides per-source attribution and aggregated metrics.
 */

export interface ZonePollutionSource {
  type: 'timeout' | 'interval' | 'listener' | 'fetch' | 'websocket' | 'microtask' | 'unknown';
  library?: string;
  callCount: number;
  cdCycles: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastOccurrence: number;
  stack?: string;
}

export interface ZonePollutionEvent {
  source: string;
  type: string;
  cdCycles: number;
  timestamp: number;
  library?: string;
  stack?: string;
}

export class ZonePollutionDetector {
  private enabled = false;
  private sources = new Map<string, ZonePollutionSource>();
  private events: ZonePollutionEvent[] = [];

  private changeDetectionHookCount = 0;
  private lastCdTime = 0;
  private cdCyclesPerSource = new Map<string, number>();

  private originalSetTimeout: any;
  private originalSetInterval: any;
  private originalAddEventListener: any;
  private originalFetch: any;
  private originalXhr: any;

  constructor() {
    // Initialize tracking
  }

  start(): void {
    if (this.enabled) return;
    this.enabled = true;

    // Hook into Zone.js scheduleTask to track CD cycles
    this.hookZoneJs();

    // Intercept async sources
    this.interceptAsync();
  }

  stop(): void {
    if (!this.enabled) return;
    this.enabled = false;

    this.restoreAsync();
  }

  /**
   * Hook Zone.js to track change detection cycles
   */
  private hookZoneJs(): void {
    const zone = (globalThis as any).Zone?.current;
    if (!zone) return;

    const zoneDelegate = zone._zoneDelegate;
    if (!zoneDelegate) return;

    const originalScheduleTask = zoneDelegate.scheduleTask.bind(zoneDelegate);
    const detector = this;

    zoneDelegate.scheduleTask = (targetZone: any, task: any): any => {
      // Track if this is a change detection task
      if (task.type === 'macroTask' || task.type === 'microTask') {
        const source = detector.detectAsyncSource(task);
        detector.recordSourceActivity(source, task);
      }

      return originalScheduleTask(targetZone, task);
    };
  }

  /**
   * Intercept async operations to track sources
   */
  private interceptAsync(): void {
    this.interceptSetTimeout();
    this.interceptSetInterval();
    this.interceptEventListener();
    this.interceptFetch();
    this.interceptXhr();
  }

  private interceptSetTimeout(): void {
    this.originalSetTimeout = globalThis.setTimeout;
    const detector = this;

    globalThis.setTimeout = function (callback: any, delay: number, ...args: any[]) {
      if (detector.enabled) {
        const stack = new Error().stack || '';
        const source = detector.parseLibraryFromStack(stack);
        detector.recordSource(
          `setTimeout(${delay}ms)`,
          'timeout',
          source,
          stack
        );
      }
      return detector.originalSetTimeout.call(globalThis, callback, delay, ...args);
    };
  }

  private interceptSetInterval(): void {
    this.originalSetInterval = globalThis.setInterval;
    const detector = this;

    globalThis.setInterval = function (callback: any, delay: number, ...args: any[]) {
      if (detector.enabled) {
        const stack = new Error().stack || '';
        const source = detector.parseLibraryFromStack(stack);
        detector.recordSource(
          `setInterval(${delay}ms)`,
          'interval',
          source,
          stack
        );
      }
      return detector.originalSetInterval.call(globalThis, callback, delay, ...args);
    };
  }

  private interceptEventListener(): void {
    this.originalAddEventListener = globalThis.addEventListener;
    const detector = this;

    globalThis.addEventListener = function (type: string, listener: any, options?: any) {
      if (detector.enabled) {
        const stack = new Error().stack || '';
        const source = detector.parseLibraryFromStack(stack);
        detector.recordSource(`addEventListener(${type})`, 'listener', source, stack);
      }
      return detector.originalAddEventListener.call(this, type, listener, options);
    };

    // Also intercept Element.addEventListener
    if (Element.prototype.addEventListener) {
      const originalEAL = Element.prototype.addEventListener;
      Element.prototype.addEventListener = function (type: string, listener: any, options?: any) {
        if (detector.enabled) {
          const stack = new Error().stack || '';
          const source = detector.parseLibraryFromStack(stack);
          detector.recordSource(`addEventListener(${type})`, 'listener', source, stack);
        }
        return originalEAL.call(this, type, listener, options);
      };
    }
  }

  private interceptFetch(): void {
    if (!globalThis.fetch) return;

    this.originalFetch = globalThis.fetch;
    const detector = this;

    globalThis.fetch = function (...args: any[]) {
      if (detector.enabled) {
        const stack = new Error().stack || '';
        const source = detector.parseLibraryFromStack(stack);
        const url = typeof args[0] === 'string' ? args[0].substring(0, 50) : 'unknown';
        detector.recordSource(`fetch(${url})`, 'fetch', source, stack);
      }
      return detector.originalFetch.apply(this, args);
    };
  }

  private interceptXhr(): void {
    if (!globalThis.XMLHttpRequest) return;

    const originalOpen = XMLHttpRequest.prototype.open;
    const detector = this;

    XMLHttpRequest.prototype.open = function (method: string, url: string, ...args: any[]) {
      if (detector.enabled) {
        const stack = new Error().stack || '';
        const source = detector.parseLibraryFromStack(stack);
        const urlStr = url.substring(0, 50);
        detector.recordSource(`XMLHttpRequest(${method} ${urlStr})`, 'fetch', source, stack);
      }
      return originalOpen.call(this, method, url, ...args);
    };
  }

  private restoreAsync(): void {
    if (this.originalSetTimeout) globalThis.setTimeout = this.originalSetTimeout;
    if (this.originalSetInterval) globalThis.setInterval = this.originalSetInterval;
    if (this.originalAddEventListener) globalThis.addEventListener = this.originalAddEventListener;
    if (this.originalFetch) globalThis.fetch = this.originalFetch;
  }

  /**
   * Detect which async source triggered this Zone.js task
   */
  private detectAsyncSource(task: any): string {
    const source = task.source || task.type || 'unknown';
    return source;
  }

  /**
   * Record activity for a source
   */
  private recordSourceActivity(source: string, task: any): void {
    // Check if this triggered a change detection
    const now = performance.now();
    const timeSinceLastCd = now - this.lastCdTime;

    // If this task resulted in CD, attribute it
    if (timeSinceLastCd < 50) {
      // Likely same CD cycle
      const key = `zone:${source}`;
      const current = this.cdCyclesPerSource.get(key) || 0;
      this.cdCyclesPerSource.set(key, current + 1);
      this.lastCdTime = now;
    }
  }

  /**
   * Record an async source
   */
  private recordSource(
    description: string,
    type: string,
    library: string | undefined,
    stack: string
  ): void {
    const key = `${type}:${library || 'unknown'}`;
    const existing = this.sources.get(key);

    if (existing) {
      existing.callCount++;
      existing.lastOccurrence = Date.now();
    } else {
      this.sources.set(key, {
        type: type as any,
        library,
        callCount: 1,
        cdCycles: 0,
        severity: 'low',
        lastOccurrence: Date.now(),
        stack,
      });
    }

    this.events.push({
      source: key,
      type,
      cdCycles: 0,
      timestamp: Date.now(),
      library,
      stack,
    });

    // Dispatch event for real-time monitoring
    window.dispatchEvent(
      new CustomEvent('ngLens:zonePollution', {
        detail: {
          source: key,
          type,
          library,
          callCount: (this.sources.get(key)?.callCount || 0),
        },
      })
    );
  }

  /**
   * Parse library name from stack trace
   */
  private parseLibraryFromStack(stack: string): string | undefined {
    // Common third-party libraries
    const libraries = [
      'chart.js',
      'moment.js',
      'lodash',
      'rxjs',
      'jquery',
      'gsap',
      'three.js',
      'bootstrap',
      'popper.js',
      'plotly',
      'echarts',
      'highcharts',
    ];

    for (const lib of libraries) {
      if (stack.includes(lib)) return lib;
    }

    // Check for node_modules patterns
    const match = stack.match(/node_modules\/([^\/]+)/);
    if (match) return match[1];

    // Check for common URLs
    if (stack.includes('cdn.')) {
      const urlMatch = stack.match(/https?:\/\/[^\/]+\/([^\/]+)/);
      if (urlMatch) return urlMatch[1];
    }

    return undefined;
  }

  /**
   * Get all detected pollution sources
   */
  getSources(): ZonePollutionSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get sources sorted by severity (most critical first)
   */
  getTopSources(limit = 10): ZonePollutionSource[] {
    return Array.from(this.sources.values())
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff =
          severityOrder[a.severity as keyof typeof severityOrder] -
          severityOrder[b.severity as keyof typeof severityOrder];
        if (severityDiff !== 0) return severityDiff;
        return b.callCount - a.callCount;
      })
      .slice(0, limit);
  }

  /**
   * Get pollution sources for a specific library
   */
  getLibrarySources(library: string): ZonePollutionSource[] {
    return Array.from(this.sources.values()).filter(s => s.library === library);
  }

  /**
   * Calculate severity for a source based on frequency
   */
  private calculateSeverity(callCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (callCount > 500) return 'critical';
    if (callCount > 200) return 'high';
    if (callCount > 50) return 'medium';
    return 'low';
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalSources: number;
    totalCalls: number;
    criticalSources: number;
    topLibrary?: string;
  } {
    const sources = Array.from(this.sources.values());
    const totalCalls = sources.reduce((sum, s) => sum + s.callCount, 0);
    const critical = sources.filter(s => s.severity === 'critical').length;

    const topLibrary = sources
      .filter(s => s.library)
      .sort((a, b) => b.callCount - a.callCount)[0]?.library;

    return {
      totalSources: sources.length,
      totalCalls,
      criticalSources: critical,
      topLibrary,
    };
  }

  /**
   * Clear tracked data
   */
  clear(): void {
    this.sources.clear();
    this.events = [];
    this.cdCyclesPerSource.clear();
  }
}

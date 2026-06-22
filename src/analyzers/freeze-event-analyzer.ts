/**
 * ngLens - Angular Performance Analyzer
 * Copyright (c) 2026 ngLens Contributors
 * Licensed under MIT
 *
 * https://github.com/gowtham-labs/nglens
 *
 * Freeze Event Analyzer
 *
 * Analyzes main-thread freezes and provides optimization recommendations.
 */

import type {
  Analyzer,
  AnalyzerConfig,
  AnalyzerResult,
  AnalysisIssue,
} from '../types/analyzer';
import { registerAnalyzer } from './index';

interface FreezeEvent {
  componentName?: string;
  duration: number;
  startTime: number;
  cause?: string;
  severity: 'medium' | 'high' | 'critical';
  timestamp: number;
}

class FreezeEventAnalyzer implements Analyzer {
  readonly type = 'freeze-event-analyzer' as const;
  readonly requiresDevMode = false;

  private freezeEvents: FreezeEvent[] = [];

  constructor() {
    this.setupEventListener();
  }

  private setupEventListener(): void {
    // Listen for freeze events from the instrumentation layer
    window.addEventListener('ngLens:freeze', (event: any) => {
      const detail = event.detail;
      if (detail) {
        this.freezeEvents.push(detail);
      }
    });
  }

  async analyze(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const issues: AnalysisIssue[] = [];

    if (this.freezeEvents.length === 0) {
      return {
        analyzer: this.type,
        issues: [],
        timestamp: Date.now(),
        duration: 0,
        metadata: { totalFreezes: 0 },
      };
    }

    // Group freezes by component/cause
    const freezesByComponent = new Map<string, FreezeEvent[]>();
    const freezesByCause = new Map<string, FreezeEvent[]>();

    for (const freeze of this.freezeEvents) {
      const component = freeze.componentName || 'Unknown';
      if (!freezesByComponent.has(component)) {
        freezesByComponent.set(component, []);
      }
      freezesByComponent.get(component)!.push(freeze);

      const cause = freeze.cause || 'Unknown';
      if (!freezesByCause.has(cause)) {
        freezesByCause.set(cause, []);
      }
      freezesByCause.get(cause)!.push(freeze);
    }

    // Create issues for critical freezes
    for (const [component, events] of freezesByComponent) {
      const criticalEvents = events.filter(e => e.severity === 'critical');
      const highEvents = events.filter(e => e.severity === 'high');
      const avgDuration =
        events.reduce((sum, e) => sum + e.duration, 0) / events.length;
      const maxDuration = Math.max(...events.map(e => e.duration));

      if (criticalEvents.length > 0) {
        issues.push({
          id: `freeze-critical-${component}`,
          analyzer: this.type,
          component,
          severity: 'critical',
          category: 'render-performance',
          title: `UI freeze detected in ${component}`,
          description: `${component} caused ${criticalEvents.length} main-thread freeze(s) lasting ${maxDuration.toFixed(0)}ms. This blocks user interaction and degrades UX.`,
          recommendation: `Optimize ${component}:
1. Break expensive operations into smaller chunks using requestIdleCallback()
2. Move heavy computations to Web Workers
3. Use async operations with await to yield to the browser
4. Profile with Chrome DevTools to identify the bottleneck
5. Consider lazy loading or virtualization for large lists`,
          elementSelector: `[ng-component="${component}"]`,
          metadata: {
            component,
            criticalCount: criticalEvents.length,
            totalCount: events.length,
            avgDuration: parseFloat(avgDuration.toFixed(2)),
            maxDuration: parseFloat(maxDuration.toFixed(2)),
            causes: [...new Set(events.map(e => e.cause))],
          },
        });
      }

      if (highEvents.length > 2) {
        issues.push({
          id: `freeze-high-${component}`,
          analyzer: this.type,
          component,
          severity: 'high',
          category: 'render-performance',
          title: `Frequent UI freezes in ${component}`,
          description: `${component} had ${highEvents.length} freeze events (${highEvents[0].duration.toFixed(0)}ms+). Repeated freezes degrade the user experience.`,
          recommendation: `Review ${component}'s initialization and update logic. Consider:
1. Deferring non-critical work with setTimeout(..., 0)
2. Using OnPush change detection strategy
3. Implementing pagination or virtualization
4. Optimizing data fetching and transformations`,
          elementSelector: `[ng-component="${component}"]`,
          metadata: {
            component,
            highCount: highEvents.length,
            totalCount: events.length,
            avgDuration: parseFloat(avgDuration.toFixed(2)),
          },
        });
      }
    }

    // Create issues for specific causes
    const heaviestCause = Array.from(freezesByCause.entries()).sort(
      (a, b) =>
        b[1].reduce((sum, e) => sum + e.duration, 0) -
        a[1].reduce((sum, e) => sum + e.duration, 0)
    )[0];

    if (heaviestCause) {
      const [cause, events] = heaviestCause;
      const totalDuration = events.reduce((sum, e) => sum + e.duration, 0);
      const avgDuration = totalDuration / events.length;

      if (avgDuration > 50) {
        issues.push({
          id: `freeze-cause-${cause.replace(/\s+/g, '-')}`,
          analyzer: this.type,
          component: 'Application',
          severity: 'high',
          category: 'render-performance',
          title: `${cause} is causing freezes`,
          description: `"${cause}" was responsible for ${events.length} freeze event(s) totaling ${totalDuration.toFixed(0)}ms. This is a significant performance bottleneck.`,
          recommendation: `Optimize or defer the "${cause}" operation:
1. Profile to identify the exact bottleneck
2. Consider using requestIdleCallback() for non-urgent work
3. Break the work into smaller chunks
4. Use Web Workers for CPU-intensive tasks
5. Implement progressive enhancement or lazy loading`,
          metadata: {
            cause,
            eventCount: events.length,
            totalDuration: parseFloat(totalDuration.toFixed(2)),
            avgDuration: parseFloat(avgDuration.toFixed(2)),
          },
        });
      }
    }

    // Clear old events to prevent memory buildup
    if (this.freezeEvents.length > 1000) {
      this.freezeEvents = this.freezeEvents.slice(-100);
    }

    return {
      analyzer: this.type,
      issues,
      timestamp: Date.now(),
      duration: 0,
      metadata: {
        totalFreezes: this.freezeEvents.length,
        criticalCount: this.freezeEvents.filter(e => e.severity === 'critical').length,
        highCount: this.freezeEvents.filter(e => e.severity === 'high').length,
      },
    };
  }

  dispose(): void {
    this.freezeEvents = [];
  }
}

// Auto-register the analyzer
registerAnalyzer(new FreezeEventAnalyzer());

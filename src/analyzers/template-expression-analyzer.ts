/**
 * ngLens - Angular Performance Analyzer
 * Copyright (c) 2026 ngLens Contributors
 * Licensed under GPL v3
 *
 * https://github.com/gowtham-labs/nglens
 *
 * Template Expression Analyzer
 *
 * Detects expensive template expressions and provides recommendations.
 */

import type {
  Analyzer,
  AnalyzerConfig,
  AnalyzerResult,
  AnalysisIssue,
} from '../types/analyzer';
import { findAngularComponents } from '../utils/dom-utils';
import { registerAnalyzer } from './index';

class TemplateExpressionAnalyzer implements Analyzer {
  readonly type = 'template-expression-analyzer' as const;
  readonly requiresDevMode = true;

  private trackedExpressions = new Map<string, any[]>();

  constructor() {
    this.setupEventListener();
  }

  private setupEventListener(): void {
    // Listen for template expression events from the instrumentation layer
    window.addEventListener('ngLens:templateExpression', (event: any) => {
      const detail = event.detail;
      if (!detail) return;

      const key = `${detail.componentName}#${detail.expressionName}`;
      if (!this.trackedExpressions.has(key)) {
        this.trackedExpressions.set(key, []);
      }
      this.trackedExpressions.get(key)!.push(detail);
    });
  }

  async analyze(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const issues: AnalysisIssue[] = [];

    // Analyze collected template expressions
    for (const [key, events] of this.trackedExpressions) {
      const [componentName, expressionName] = key.split('#');

      if (events.length === 0) continue;

      // Calculate statistics
      const durations = events.map(e => e.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const callCount = events.length;

      // Check for expensive expressions
      if (avgDuration > 2 || maxDuration > 5) {
        issues.push({
          id: `template-expr-${componentName}-${expressionName}`,
          analyzer: this.type,
          component: componentName,
          severity: this.calculateSeverity(avgDuration, maxDuration),
          category: 'render-performance',
          title: `Expensive template expression: ${expressionName}()`,
          description: `Template expression '${expressionName}()' in ${componentName} was called ${callCount} times with an average duration of ${avgDuration.toFixed(2)}ms (max: ${maxDuration.toFixed(2)}ms). This can slow down change detection.`,
          recommendation: `Move expensive logic outside of templates:
1. Create a memoized getter or signal instead
2. Use a pipe with memoization
3. Use computed() signal to cache results
4. Consider async transformation with RxJS`,
          elementSelector: `[ng-component="${componentName}"]`,
          metadata: {
            expressionName,
            expressionType: events[0]?.expressionType || 'method',
            callCount,
            avgDuration: parseFloat(avgDuration.toFixed(2)),
            maxDuration: parseFloat(maxDuration.toFixed(2)),
            lastCallTime: events[events.length - 1]?.timestamp || 0,
          },
        });
      }

      // Check for frequently called expressions
      if (callCount > 100) {
        issues.push({
          id: `template-expr-frequent-${componentName}-${expressionName}`,
          analyzer: this.type,
          component: componentName,
          severity: 'medium',
          category: 'best-practices',
          title: `Frequently called template expression: ${expressionName}()`,
          description: `Template expression '${expressionName}()' in ${componentName} was called ${callCount} times. Even fast expressions become expensive when called too frequently.`,
          recommendation: `Consider:
1. Caching the result with a signal or getter
2. Using memoization or a pipe
3. Reducing change detection frequency with OnPush
4. Batching updates with debouncing`,
          elementSelector: `[ng-component="${componentName}"]`,
          metadata: {
            expressionName,
            callCount,
            avgDuration: parseFloat(avgDuration.toFixed(2)),
          },
        });
      }
    }

    return {
      analyzer: this.type,
      issues,
      timestamp: Date.now(),
      duration: 0,
      metadata: {
        trackedExpressions: this.trackedExpressions.size,
      },
    };
  }

  private calculateSeverity(avg: number, max: number): 'low' | 'medium' | 'high' | 'critical' {
    if (max > 10 || avg > 5) return 'critical';
    if (max > 5 || avg > 2) return 'high';
    if (max > 2 || avg > 1) return 'medium';
    return 'low';
  }

  dispose(): void {
    this.trackedExpressions.clear();
  }
}

// Auto-register the analyzer
registerAnalyzer(new TemplateExpressionAnalyzer());

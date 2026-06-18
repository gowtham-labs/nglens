/**
 * ngLens - Angular Performance Analyzer
 * Copyright (c) 2026 ngLens Contributors
 * Licensed under GPL v3
 *
 * https://github.com/gowtham-labs/nglens
 *
 * Zone Pollution Analyzer
 *
 * Analyzes async sources causing excessive change detection and provides fixes.
 */

import type {
  Analyzer,
  AnalyzerConfig,
  AnalyzerResult,
  AnalysisIssue,
} from '../types/analyzer';
import { registerAnalyzer } from './index';

interface PollutionSource {
  type: string;
  library?: string;
  callCount: number;
  severity: string;
  lastOccurrence: number;
}

class ZonePollutionAnalyzer implements Analyzer {
  readonly type = 'zone-pollution-analyzer' as const;
  readonly requiresDevMode = false;

  private pollutionSources: PollutionSource[] = [];

  constructor() {
    this.setupEventListener();
  }

  private setupEventListener(): void {
    window.addEventListener('ngLens:zonePollution', (event: any) => {
      const detail = event.detail;
      if (detail) {
        const existing = this.pollutionSources.find(s => s.type === detail.type && s.library === detail.library);
        if (existing) {
          existing.callCount += 1;
          existing.lastOccurrence = Date.now();
        } else {
          this.pollutionSources.push({
            type: detail.type,
            library: detail.library,
            callCount: detail.callCount || 1,
            severity: this.calculateSeverity(detail.callCount || 1),
            lastOccurrence: Date.now(),
          });
        }
      }
    });
  }

  async analyze(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const issues: AnalysisIssue[] = [];

    if (this.pollutionSources.length === 0) {
      return {
        analyzer: this.type,
        issues: [],
        timestamp: Date.now(),
        duration: 0,
        metadata: { totalSources: 0 },
      };
    }

    // Sort by call count (worst first)
    const sorted = [...this.pollutionSources].sort((a, b) => b.callCount - a.callCount);

    // Report on heavy async sources
    for (const source of sorted) {
      if (source.severity === 'critical' || source.severity === 'high') {
        const recommendation = this.getRecommendation(source.type, source.library);

        issues.push({
          id: `zone-pollution-${source.type}-${source.library || 'unknown'}`,
          analyzer: this.type,
          component: 'Unknown',
          severity: source.severity as any,
          category: 'render-performance',
          title: `Zone pollution: Excessive ${source.type} calls${source.library ? ` from ${source.library}` : ''}`,
          description: `${source.callCount} ${source.type} operations detected, likely causing excessive change detection cycles. ${
            source.library ? `This is coming from the ${source.library} library.` : ''
          } Each operation triggers Angular's Zone.js, causing change detection overhead.`,
          recommendation,
          metadata: {
            sourceType: source.type,
            library: source.library,
            callCount: source.callCount,
            severity: source.severity,
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
        totalSources: this.pollutionSources.length,
        highSeverity: sorted.filter(s => s.severity === 'high' || s.severity === 'critical').length,
      },
    };
  }

  private calculateSeverity(callCount: number): string {
    if (callCount > 500) return 'critical';
    if (callCount > 200) return 'high';
    if (callCount > 50) return 'medium';
    return 'low';
  }

  private getRecommendation(type: string, library?: string): string {
    const libHint = library ? ` in ${library}` : '';

    switch (type) {
      case 'timeout':
        return `Use \`NgZone.runOutsideAngular()\` to wrap ${type}${libHint}:
\`\`\`typescript
constructor(private ngZone: NgZone) {}
method() {
  this.ngZone.runOutsideAngular(() => {
    setTimeout(() => {
      // This won't trigger change detection
    }, 100);
  });
}
\`\`\``;

      case 'interval':
        return `Use \`NgZone.runOutsideAngular()\` for intervals${libHint}:
\`\`\`typescript
ngOnInit() {
  this.ngZone.runOutsideAngular(() => {
    setInterval(() => {
      // Update happens without triggering CD
      this.ngZone.run(() => {
        // Only run CD if you need to update UI
      });
    }, 1000);
  });
}
\`\`\``;

      case 'listener':
        return `Wrap event listeners in \`NgZone.runOutsideAngular()\`${libHint}:
\`\`\`typescript
constructor(private ngZone: NgZone) {}
setupListener() {
  this.ngZone.runOutsideAngular(() => {
    element.addEventListener('mousemove', () => {
      // This won't trigger change detection
    });
  });
}
\`\`\``;

      case 'fetch':
        return `Consider using async pipe or RxJS operators to manage async operations${libHint}:
\`\`\`typescript
// Instead of fetch, use HttpClient with async pipe
data$ = this.http.get('/api/data');

// In template:
<div>{{ data$ | async }}</div>
\`\`\``;

      default:
        return `Move ${type} operations outside Angular's Zone using \`NgZone.runOutsideAngular()\` to prevent unnecessary change detection.`;
    }
  }

  dispose(): void {
    this.pollutionSources = [];
  }
}

// Auto-register the analyzer
registerAnalyzer(new ZonePollutionAnalyzer());

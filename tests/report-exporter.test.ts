import { describe, expect, it } from 'vitest';

import { buildReportData } from '../src/services/report-exporter';
import type { AnalysisIssue, AnalyzerResult } from '../src/types/analyzer';
import type { PerformanceScore } from '../src/types/scoring';

function createIssue(id: string, severity: AnalysisIssue['severity']): AnalysisIssue {
  return {
    id,
    analyzer: 'dom-inspector',
    component: 'DemoComponent',
    severity,
    category: 'dom-complexity',
    title: `Issue ${id}`,
    description: 'desc',
    recommendation: 'fix it',
  };
}

function createResult(
  analyzer: AnalyzerResult['analyzer'],
  issues: AnalysisIssue[],
  score?: PerformanceScore
): AnalyzerResult {
  return {
    analyzer,
    timestamp: Date.now(),
    duration: 1,
    issues,
    metadata: score ? { score } : undefined,
  };
}

describe('report-exporter buildReportData', () => {
  it('sorts action items by severity rank', () => {
    const issues = [
      createIssue('low-1', 'low'),
      createIssue('critical-1', 'critical'),
      createIssue('medium-1', 'medium'),
    ];

    const data = buildReportData(
      [createResult('dom-inspector', issues)],
      'https://example.com',
      '19.2.0',
      3
    );

    expect(data.actionItems.map((item) => item.id)).toEqual([
      'critical-1',
      'medium-1',
      'low-1',
    ]);
    expect(data.actionItems.map((item) => item.rank)).toEqual([1, 2, 3]);
  });

  it('uses scorer metadata score when available', () => {
    const score: PerformanceScore = {
      overall: 88,
      subScores: {
        changeDetection: { name: 'Change Detection', score: 90, weight: 0.4, details: 'ok' },
        componentTreeDepth: { name: 'Component Tree Depth', score: 80, weight: 0.2, details: 'ok' },
        templateComplexity: { name: 'Template Complexity', score: 85, weight: 0.2, details: 'ok' },
        detectedBottlenecks: { name: 'Detected Bottlenecks', score: 92, weight: 0.2, details: 'ok' },
      },
      timestamp: Date.now(),
      mode: 'development',
    };

    const data = buildReportData(
      [createResult('performance-scorer', [], score)],
      'https://example.com',
      '19.2.0',
      0
    );

    expect(data.score.overall).toBe(88);
  });

  it('uses a default score when scorer metadata is missing', () => {
    const data = buildReportData(
      [createResult('dom-inspector', [createIssue('i1', 'high')])],
      'https://example.com',
      null,
      1
    );

    expect(data.score.overall).toBe(0);
    expect(data.score.mode).toBe('development');
  });
});

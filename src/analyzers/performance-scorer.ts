/**
 * Performance Scorer Analyzer
 *
 * Computes a weighted performance score (0-100) for an Angular application
 * based on four sub-scores:
 * - Change Detection Strategy (40%): ratio of OnPush vs Default components
 * - Component Tree Depth (20%): penalizes deep nesting
 * - Template Complexity (20%): penalizes high average template declarations
 * - Detected Bottlenecks (20%): penalizes detected performance issues
 *
 * Requires development mode (window.ng) for full analysis.
 * In production mode, returns score 0 with a degradation notice.
 */

import type {
  AnalyzerConfig,
  AnalyzerResult,
  AnalyzerType,
} from '../types/analyzer';
import type { PerformanceScore, PerformanceSubScore } from '../types/scoring';
import { BaseAnalyzer } from './base-analyzer';
import { registerAnalyzer } from './index';
import { SCORE_WEIGHTS } from '../utils/constants';
import {
  findAngularComponents,
  countSubtreeNodes,
  calculateComponentDepth,
} from '../utils/dom-utils';

export class PerformanceScorer extends BaseAnalyzer {
  readonly type: AnalyzerType = 'performance-scorer';
  readonly requiresDevMode = true;

  protected async execute(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const startTime = performance.now();

    // In production mode, return score 0 with degradation notice
    if (config.mode === 'production' || !(window as any).ng) {
      const score = this.buildDegradedScore();
      const duration = performance.now() - startTime;

      return {
        analyzer: this.type,
        timestamp: Date.now(),
        duration,
        issues: [],
        metadata: {
          score,
          degraded: true,
          reason: 'Full inspection requires development mode (window.ng unavailable)',
        },
      };
    }

    // Find all Angular components in the DOM
    const components = findAngularComponents();

    // If no components found, return score 0
    if (components.length === 0) {
      const score = this.buildEmptyScore();
      const duration = performance.now() - startTime;

      return {
        analyzer: this.type,
        timestamp: Date.now(),
        duration,
        issues: [],
        metadata: {
          score,
          reason: 'No Angular components found for analysis',
        },
      };
    }

    // Compute sub-scores
    const changeDetectionSubScore = this.computeChangeDetectionScore(components);
    const treeDepthSubScore = this.computeTreeDepthScore(components);
    const templateComplexitySubScore = this.computeTemplateComplexityScore(components);
    const bottlenecksSubScore = this.computeBottlenecksScore(components);

    // Compute weighted overall score
    const overall = Math.round(
      changeDetectionSubScore.score * SCORE_WEIGHTS.changeDetection +
      treeDepthSubScore.score * SCORE_WEIGHTS.componentTreeDepth +
      templateComplexitySubScore.score * SCORE_WEIGHTS.templateComplexity +
      bottlenecksSubScore.score * SCORE_WEIGHTS.detectedBottlenecks
    );

    // Clamp to [0, 100]
    const clampedOverall = Math.max(0, Math.min(100, overall));

    const score: PerformanceScore = {
      overall: clampedOverall,
      subScores: {
        changeDetection: changeDetectionSubScore,
        componentTreeDepth: treeDepthSubScore,
        templateComplexity: templateComplexitySubScore,
        detectedBottlenecks: bottlenecksSubScore,
      },
      timestamp: Date.now(),
      mode: 'development',
    };

    const duration = performance.now() - startTime;

    return {
      analyzer: this.type,
      timestamp: Date.now(),
      duration,
      issues: [],
      metadata: {
        score,
      },
    };
  }

  /**
   * CD Strategy sub-score: ratio of components using OnPush vs Default.
   * 100 = all OnPush, 0 = all Default.
   */
  private computeChangeDetectionScore(components: Element[]): PerformanceSubScore {
    let onPushCount = 0;

    for (const element of components) {
      try {
        const ngContext = (window as any).ng?.getComponent(element);
        if (ngContext) {
          const cmp = ngContext.constructor?.ɵcmp;
          // changeDetection === 1 means OnPush in Angular
          if (cmp?.onPush || cmp?.changeDetection === 1) {
            onPushCount++;
          }
        }
      } catch {
        // Skip components that can't be inspected
      }
    }

    const ratio = components.length > 0 ? onPushCount / components.length : 0;
    const score = Math.round(ratio * 100);

    return {
      name: 'Change Detection Strategy',
      score,
      weight: SCORE_WEIGHTS.changeDetection,
      details: `${onPushCount}/${components.length} components use OnPush`,
    };
  }

  /**
   * Component Tree Depth sub-score:
   * 100 for depth ≤ 5, decreasing linearly to 0 at depth ≥ 20.
   */
  private computeTreeDepthScore(components: Element[]): PerformanceSubScore {
    // Calculate max depth from document body
    const root = document.body || document.documentElement;
    const maxDepth = calculateComponentDepth(root);

    let score: number;
    if (maxDepth <= 5) {
      score = 100;
    } else if (maxDepth >= 20) {
      score = 0;
    } else {
      // Linear interpolation: 100 at depth 5, 0 at depth 20
      score = Math.round(100 * (1 - (maxDepth - 5) / 15));
    }

    return {
      name: 'Component Tree Depth',
      score,
      weight: SCORE_WEIGHTS.componentTreeDepth,
      details: `Maximum component nesting depth: ${maxDepth}`,
    };
  }

  /**
   * Template Complexity sub-score:
   * Based on average ɵcmp.decls count.
   * 100 for avg ≤ 10, decreasing to 0 at avg ≥ 100.
   */
  private computeTemplateComplexityScore(components: Element[]): PerformanceSubScore {
    let totalDecls = 0;
    let measuredCount = 0;

    for (const element of components) {
      try {
        const ngContext = (window as any).ng?.getComponent(element);
        if (ngContext) {
          const cmp = ngContext.constructor?.ɵcmp;
          if (cmp && typeof cmp.decls === 'number') {
            totalDecls += cmp.decls;
            measuredCount++;
          }
        }
      } catch {
        // Skip components that can't be inspected
      }
    }

    const avgDecls = measuredCount > 0 ? totalDecls / measuredCount : 0;

    let score: number;
    if (avgDecls <= 10) {
      score = 100;
    } else if (avgDecls >= 100) {
      score = 0;
    } else {
      // Linear interpolation: 100 at avg 10, 0 at avg 100
      score = Math.round(100 * (1 - (avgDecls - 10) / 90));
    }

    return {
      name: 'Template Complexity',
      score,
      weight: SCORE_WEIGHTS.templateComplexity,
      details: `Average template declarations: ${avgDecls.toFixed(1)} (${measuredCount} components measured)`,
    };
  }

  /**
   * Detected Bottlenecks sub-score:
   * 100 for 0 issues, decreasing by 10 per issue, min 0.
   */
  private computeBottlenecksScore(components: Element[]): PerformanceSubScore {
    let issueCount = 0;

    for (const element of components) {
      // Check for excessive DOM nodes in component subtree
      const nodeCount = countSubtreeNodes(element);
      if (nodeCount > 800) {
        issueCount++;
      }
    }

    const score = Math.max(0, 100 - issueCount * 10);

    return {
      name: 'Detected Bottlenecks',
      score,
      weight: SCORE_WEIGHTS.detectedBottlenecks,
      details: `${issueCount} bottleneck${issueCount !== 1 ? 's' : ''} detected`,
    };
  }

  /**
   * Builds a degraded score for production mode (window.ng unavailable).
   */
  private buildDegradedScore(): PerformanceScore {
    return {
      overall: 0,
      subScores: {
        changeDetection: {
          name: 'Change Detection Strategy',
          score: 0,
          weight: SCORE_WEIGHTS.changeDetection,
          details: 'Unavailable: requires development mode',
        },
        componentTreeDepth: {
          name: 'Component Tree Depth',
          score: 0,
          weight: SCORE_WEIGHTS.componentTreeDepth,
          details: 'Unavailable: requires development mode',
        },
        templateComplexity: {
          name: 'Template Complexity',
          score: 0,
          weight: SCORE_WEIGHTS.templateComplexity,
          details: 'Unavailable: requires development mode',
        },
        detectedBottlenecks: {
          name: 'Detected Bottlenecks',
          score: 0,
          weight: SCORE_WEIGHTS.detectedBottlenecks,
          details: 'Unavailable: requires development mode',
        },
      },
      timestamp: Date.now(),
      mode: 'production',
    };
  }

  /**
   * Builds a score for when no components are found.
   */
  private buildEmptyScore(): PerformanceScore {
    return {
      overall: 0,
      subScores: {
        changeDetection: {
          name: 'Change Detection Strategy',
          score: 0,
          weight: SCORE_WEIGHTS.changeDetection,
          details: 'No components found',
        },
        componentTreeDepth: {
          name: 'Component Tree Depth',
          score: 0,
          weight: SCORE_WEIGHTS.componentTreeDepth,
          details: 'No components found',
        },
        templateComplexity: {
          name: 'Template Complexity',
          score: 0,
          weight: SCORE_WEIGHTS.templateComplexity,
          details: 'No components found',
        },
        detectedBottlenecks: {
          name: 'Detected Bottlenecks',
          score: 0,
          weight: SCORE_WEIGHTS.detectedBottlenecks,
          details: 'No components found',
        },
      },
      timestamp: Date.now(),
      mode: 'development',
    };
  }
}

// Auto-register the analyzer
registerAnalyzer(new PerformanceScorer());

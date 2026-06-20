import { Injectable } from '@angular/core';
import type { EnrichedRecommendation, PriorityLevel, DifficultyLevel } from '../pages/recommendations/types';

/**
 * Pure computation service for priority level assignment, impact estimation,
 * and difficulty classification of enriched recommendations.
 *
 * All methods are deterministic pure functions with no side effects.
 * Missing or undefined fields default to 'low' priority.
 */
@Injectable({ providedIn: 'root' })
export class PriorityScoringService {
  /**
   * Calculate the priority level for a recommendation based on type-specific threshold rules.
   *
   * OnPush: score > 80 AND rendersPerMinute > 100 → Critical
   *         score > 70 AND rendersPerMinute > 50  → High
   *         score > 50                            → Medium
   *         otherwise                             → Low
   *
   * TrackBy: collectionSize > 100 → High
   *          collectionSize > 20  → Medium
   *          otherwise            → Low
   *
   * Leak: severity === 'CRITICAL' → Critical
   *        severity === 'WARNING'  → High
   *        otherwise               → Medium
   *
   * Zone: cdCyclesPerMinute > 100 → Critical
   *        cdCyclesPerMinute > 50  → High
   *        cdCyclesPerMinute > 20  → Medium
   *        otherwise               → Low
   */
  calculatePriority(recommendation: EnrichedRecommendation): PriorityLevel {
    switch (recommendation.type) {
      case 'onpush':
        return this.calculateOnPushPriority(recommendation);
      case 'trackby':
        return this.calculateTrackByPriority(recommendation);
      case 'leak':
        return this.calculateLeakPriority(recommendation);
      case 'zone-pollution':
        return this.calculateZonePollutionPriority(recommendation);
      default:
        return 'low';
    }
  }

  /**
   * Estimate the performance impact of implementing a recommendation.
   *
   * OnPush:     "Will reduce renders by 70%"
   * TrackBy:    "Will reduce DOM operations by {collectionSize × 0.8} per update"
   * Leak:       "Will prevent memory leak and improve stability"
   * Zone:       "Will reduce CD cycles by {cdCyclesPerMinute × 0.9} per minute"
   */
  estimateImpact(recommendation: EnrichedRecommendation): string {
    switch (recommendation.type) {
      case 'onpush':
        return 'Will reduce renders by 70%';
      case 'trackby':
        return this.estimateTrackByImpact(recommendation);
      case 'leak':
        return 'Will prevent memory leak and improve stability';
      case 'zone-pollution':
        return this.estimateZonePollutionImpact(recommendation);
      default:
        return 'Will improve performance';
    }
  }

  /**
   * Estimate the implementation difficulty for a recommendation.
   *
   * OnPush:         Easy (single decorator change)
   * TrackBy:        Easy (add function + template attribute)
   * Leak:           Medium (requires understanding subscription lifecycle)
   * Zone Pollution: Hard (requires NgZone understanding and refactoring)
   */
  estimateDifficulty(recommendation: EnrichedRecommendation): DifficultyLevel {
    switch (recommendation.type) {
      case 'onpush':
        return 'easy';
      case 'trackby':
        return 'easy';
      case 'leak':
        return 'medium';
      case 'zone-pollution':
        return 'hard';
      default:
        return 'medium';
    }
  }

  private calculateOnPushPriority(recommendation: EnrichedRecommendation): PriorityLevel {
    const score = recommendation.onPushData?.score;
    const rendersPerMinute = (recommendation.onPushData as { rendersPerMinute?: number } | undefined)?.rendersPerMinute;

    if (score == null || rendersPerMinute == null) {
      return 'low';
    }

    if (score > 80 && rendersPerMinute > 100) {
      return 'critical';
    }
    if (score > 70 && rendersPerMinute > 50) {
      return 'high';
    }
    if (score > 50) {
      return 'medium';
    }
    return 'low';
  }

  private calculateTrackByPriority(recommendation: EnrichedRecommendation): PriorityLevel {
    const collectionSize = recommendation.trackByData?.collectionSize;

    if (collectionSize == null) {
      return 'low';
    }

    if (collectionSize > 100) {
      return 'high';
    }
    if (collectionSize > 20) {
      return 'medium';
    }
    return 'low';
  }

  private calculateLeakPriority(recommendation: EnrichedRecommendation): PriorityLevel {
    const severity = recommendation.leakData?.severity;

    if (severity == null) {
      return 'low';
    }

    if (severity === 'CRITICAL') {
      return 'critical';
    }
    if (severity === 'WARNING') {
      return 'high';
    }
    return 'medium';
  }

  private calculateZonePollutionPriority(recommendation: EnrichedRecommendation): PriorityLevel {
    const cdCyclesPerMinute = recommendation.zonePollutionData?.cdCyclesPerMinute;

    if (cdCyclesPerMinute == null) {
      return 'low';
    }

    if (cdCyclesPerMinute > 100) {
      return 'critical';
    }
    if (cdCyclesPerMinute > 50) {
      return 'high';
    }
    if (cdCyclesPerMinute > 20) {
      return 'medium';
    }
    return 'low';
  }

  private estimateTrackByImpact(recommendation: EnrichedRecommendation): string {
    const collectionSize = recommendation.trackByData?.collectionSize;

    if (collectionSize == null || collectionSize === 0) {
      return 'Will reduce DOM operations per update';
    }

    const reduction = Math.round(collectionSize * 0.8);
    return `Will reduce DOM operations by ${reduction} per update`;
  }

  private estimateZonePollutionImpact(recommendation: EnrichedRecommendation): string {
    const cdCyclesPerMinute = recommendation.zonePollutionData?.cdCyclesPerMinute;

    if (cdCyclesPerMinute == null || cdCyclesPerMinute === 0) {
      return 'Will reduce CD cycles per minute';
    }

    const reduction = Math.round(cdCyclesPerMinute * 0.9);
    return `Will reduce CD cycles by ${reduction} per minute`;
  }
}

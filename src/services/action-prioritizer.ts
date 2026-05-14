/**
 * Action Prioritizer Service
 *
 * Computes impact scores for analysis issues and produces a ranked,
 * capped list of ActionItems. Detects resolved issues by comparing
 * current scan results against previous scan results.
 *
 * Impact score formula:
 *   severity_weight × category_multiplier + frequency_bonus
 *
 * Frequency bonus: +10 per additional occurrence of the same issue type,
 * capped at +50.
 *
 * Impact levels:
 *   ≥100 = high, ≥50 = medium, <50 = low
 */

import type { ActionItem, ImpactLevel } from '../types/actions';
import type { AnalysisIssue, IssueCategory, Severity } from '../types/analyzer';
import {
  SEVERITY_WEIGHTS,
  CATEGORY_MULTIPLIERS,
  IMPACT_LEVEL_HIGH_THRESHOLD,
  IMPACT_LEVEL_MEDIUM_THRESHOLD,
  MAX_ACTION_ITEMS_DISPLAY,
} from '../utils/constants';

/** Maximum frequency bonus that can be applied */
const MAX_FREQUENCY_BONUS = 50;

/** Bonus points per additional occurrence of the same issue type */
const FREQUENCY_BONUS_PER_OCCURRENCE = 10;

/**
 * Compute the impact score for a single issue given its occurrence count.
 *
 * Formula: severity_weight × category_multiplier + frequency_bonus
 * Frequency bonus = min(10 × (occurrences - 1), 50)
 */
export function computeImpactScore(issue: AnalysisIssue, occurrences: number): number {
  const severityWeight = SEVERITY_WEIGHTS[issue.severity] ?? 0;
  const categoryMultiplier = CATEGORY_MULTIPLIERS[issue.category] ?? 1;
  const additionalOccurrences = Math.max(0, occurrences - 1);
  const frequencyBonus = Math.min(
    additionalOccurrences * FREQUENCY_BONUS_PER_OCCURRENCE,
    MAX_FREQUENCY_BONUS
  );

  return severityWeight * categoryMultiplier + frequencyBonus;
}

/**
 * Map a numeric impact score to an ImpactLevel.
 */
function toImpactLevel(score: number): ImpactLevel {
  if (score >= IMPACT_LEVEL_HIGH_THRESHOLD) return 'high';
  if (score >= IMPACT_LEVEL_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Generate a human-readable estimated gain description based on impact level.
 */
function estimatedGainDescription(impactLevel: ImpactLevel): string {
  switch (impactLevel) {
    case 'high':
      return 'Large performance improvement expected';
    case 'medium':
      return 'Moderate performance improvement expected';
    case 'low':
      return 'Minor performance improvement expected';
  }
}

/**
 * Count occurrences of each issue type (by title + category combination)
 * across the full issue set.
 */
function countOccurrences(issues: AnalysisIssue[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    const key = `${issue.category}::${issue.title}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Determine which issue IDs from the previous scan are no longer present
 * in the current issues (i.e., resolved).
 */
function findResolvedIds(
  currentIssues: AnalysisIssue[],
  previousItems: ActionItem[]
): Set<string> {
  const currentIds = new Set(currentIssues.map((issue) => issue.id));
  const resolvedIds = new Set<string>();

  for (const item of previousItems) {
    if (!currentIds.has(item.issue.id)) {
      resolvedIds.add(item.issue.id);
    }
  }

  return resolvedIds;
}

/**
 * Main prioritization function.
 *
 * Takes the current set of analysis issues and optionally the previous
 * scan's action items. Returns a ranked list of ActionItems sorted by
 * impact score descending, capped at MAX_ACTION_ITEMS_DISPLAY (50).
 *
 * Resolved issues (present in previous but absent in current) are appended
 * at the end with `resolved: true`.
 */
export function prioritizeIssues(
  issues: AnalysisIssue[],
  previousItems?: ActionItem[]
): ActionItem[] {
  const occurrenceCounts = countOccurrences(issues);

  // Score and create action items for current issues
  const scoredItems: Array<{ item: ActionItem; score: number }> = issues.map((issue) => {
    const key = `${issue.category}::${issue.title}`;
    const occurrences = occurrenceCounts.get(key) ?? 1;
    const score = computeImpactScore(issue, occurrences);
    const impactLevel = toImpactLevel(score);

    return {
      score,
      item: {
        id: issue.id,
        rank: 0, // Will be assigned after sorting
        issue,
        impactLevel,
        estimatedGain: estimatedGainDescription(impactLevel),
        resolved: false,
      },
    };
  });

  // Sort descending by impact score
  scoredItems.sort((a, b) => b.score - a.score);

  // Assign ranks and cap at display limit
  const activeItems: ActionItem[] = scoredItems
    .slice(0, MAX_ACTION_ITEMS_DISPLAY)
    .map((entry, index) => ({
      ...entry.item,
      rank: index + 1,
    }));

  // Detect resolved issues from previous scan
  if (previousItems && previousItems.length > 0) {
    const resolvedIds = findResolvedIds(issues, previousItems);

    for (const prevItem of previousItems) {
      if (resolvedIds.has(prevItem.issue.id)) {
        // Only add resolved items if we haven't hit the cap
        if (activeItems.length < MAX_ACTION_ITEMS_DISPLAY) {
          activeItems.push({
            ...prevItem,
            rank: activeItems.length + 1,
            resolved: true,
          });
        }
      }
    }
  }

  return activeItems;
}

/**
 * Filter action items by issue category.
 * Returns only items whose issue category is in the provided list.
 */
export function filterByCategory(
  items: ActionItem[],
  categories: IssueCategory[]
): ActionItem[] {
  if (categories.length === 0) return items;
  const categorySet = new Set(categories);
  return items.filter((item) => categorySet.has(item.issue.category));
}

/**
 * Filter action items by severity.
 * Returns only items whose issue severity is in the provided list.
 */
export function filterBySeverity(
  items: ActionItem[],
  severities: Severity[]
): ActionItem[] {
  if (severities.length === 0) return items;
  const severitySet = new Set(severities);
  return items.filter((item) => severitySet.has(item.issue.severity));
}

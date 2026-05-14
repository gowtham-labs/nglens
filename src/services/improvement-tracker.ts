/**
 * Improvement Tracker Service
 *
 * Compares current scan results against previous scan results to show
 * improvements, regressions, and resolved issues. Provides positive
 * reinforcement messages when meaningful progress is detected.
 *
 * Comparison logic:
 * - Score change: current.score.overall - previous.score.overall
 * - Issues fixed: issues in previous but not in current (by id)
 * - New issues: issues in current but not in previous (by id)
 * - Metric changes: compare each sub-score with % change
 * - Positive messages when score improves by 5+ points
 */

import type { ScanResultsPayload } from '../types/messages';
import type { AnalysisIssue } from '../types/analyzer';

/** Represents a change in a single metric between scans */
export interface MetricChange {
  name: string;
  previousValue: number;
  currentValue: number;
  percentChange: number;
  improved: boolean;
}

/** Summary of improvements and regressions between two scans */
export interface ImprovementSummary {
  scoreChange: number;
  issuesFixed: number;
  newIssues: number;
  metricChanges: MetricChange[];
  positiveMessage: string | null;
  resolvedIssueIds: string[];
}

/** Minimum score improvement to trigger a positive message */
const POSITIVE_MESSAGE_THRESHOLD = 5;

/**
 * Determine if this is the first scan (no previous data available).
 */
export function isFirstScan(previous: ScanResultsPayload | null): boolean {
  return previous === null;
}

/**
 * Get a positive reinforcement message if the score improved by 5+ points.
 * Returns null if the improvement is below the threshold.
 */
export function getPositiveMessage(scoreImprovement: number): string | null {
  if (scoreImprovement < POSITIVE_MESSAGE_THRESHOLD) {
    return null;
  }

  return `Nice work! Your optimizations improved the score by ${scoreImprovement} points`;
}

/**
 * Compute the percentage change between two values.
 * Returns 0 if the previous value is 0 (avoids division by zero).
 */
function computePercentChange(previous: number, current: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Extract all issue IDs from scan results.
 */
function collectIssueIds(results: ScanResultsPayload): Set<string> {
  const ids = new Set<string>();

  for (const result of results.results) {
    for (const issue of result.issues) {
      ids.add(issue.id);
    }
  }

  // Also include action item issue IDs
  for (const item of results.actionItems) {
    ids.add(item.issue.id);
  }

  return ids;
}

/**
 * Find issue IDs that were in the previous scan but not in the current scan.
 */
function findResolvedIssueIds(
  current: ScanResultsPayload,
  previous: ScanResultsPayload
): string[] {
  const currentIds = collectIssueIds(current);
  const previousIds = collectIssueIds(previous);

  const resolved: string[] = [];
  for (const id of previousIds) {
    if (!currentIds.has(id)) {
      resolved.push(id);
    }
  }

  return resolved;
}

/**
 * Find issue IDs that are in the current scan but not in the previous scan.
 */
function countNewIssues(
  current: ScanResultsPayload,
  previous: ScanResultsPayload
): number {
  const currentIds = collectIssueIds(current);
  const previousIds = collectIssueIds(previous);

  let count = 0;
  for (const id of currentIds) {
    if (!previousIds.has(id)) {
      count++;
    }
  }

  return count;
}

/**
 * Compare sub-scores between current and previous scans to produce
 * metric change entries.
 */
function compareMetrics(
  current: ScanResultsPayload,
  previous: ScanResultsPayload
): MetricChange[] {
  const changes: MetricChange[] = [];

  const subScoreKeys = [
    'changeDetection',
    'componentTreeDepth',
    'templateComplexity',
    'detectedBottlenecks',
  ] as const;

  for (const key of subScoreKeys) {
    const prevSubScore = previous.score.subScores[key];
    const currSubScore = current.score.subScores[key];

    const previousValue = prevSubScore.score;
    const currentValue = currSubScore.score;
    const percentChange = computePercentChange(previousValue, currentValue);
    const improved = currentValue > previousValue;

    changes.push({
      name: currSubScore.name,
      previousValue,
      currentValue,
      percentChange,
      improved,
    });
  }

  return changes;
}

/**
 * Count total issues in a scan result.
 */
function countTotalIssues(results: ScanResultsPayload): number {
  return collectIssueIds(results).size;
}

/**
 * Track improvement between current and previous scan results.
 *
 * For the first scan (previous is null), returns a summary with
 * scoreChange=0, issuesFixed=0, newIssues=current issue count,
 * positiveMessage=null, and empty resolvedIssueIds.
 */
export function trackImprovement(
  current: ScanResultsPayload,
  previous: ScanResultsPayload | null
): ImprovementSummary {
  // First scan case
  if (previous === null) {
    return {
      scoreChange: 0,
      issuesFixed: 0,
      newIssues: countTotalIssues(current),
      metricChanges: [],
      positiveMessage: null,
      resolvedIssueIds: [],
    };
  }

  const scoreChange = current.score.overall - previous.score.overall;
  const resolvedIssueIds = findResolvedIssueIds(current, previous);
  const issuesFixed = resolvedIssueIds.length;
  const newIssues = countNewIssues(current, previous);
  const metricChanges = compareMetrics(current, previous);

  // Generate positive message based on score improvement
  let positiveMessage = getPositiveMessage(scoreChange);

  // If no score-based message but issues were fixed, provide alternative encouragement
  if (positiveMessage === null && issuesFixed > 0) {
    positiveMessage = `Great progress! You fixed ${issuesFixed} issue${issuesFixed > 1 ? 's' : ''}`;
  }

  return {
    scoreChange,
    issuesFixed,
    newIssues,
    metricChanges,
    positiveMessage,
    resolvedIssueIds,
  };
}

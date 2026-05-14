/**
 * Contextual Help Service
 *
 * Provides access to static help content bundled within the extension.
 * All content is loaded at import time from the local JSON file —
 * zero network requests are made.
 *
 * Help entries cover V1 issue types:
 * - change-detection: default-strategy, missing-trackby
 * - dom-complexity: excessive-nodes
 * - render-performance: layout-thrashing, long-render-phase, forced-reflow
 * - best-practices: template-function, missing-trackby-pattern
 */

import type { HelpEntry } from '../types/help';
import type { IssueCategory } from '../types/analyzer';
import helpEntriesData from '../data/help-entries.json';

/** All help entries loaded from the bundled JSON at import time */
const helpEntries: HelpEntry[] = helpEntriesData as HelpEntry[];

/**
 * Get the help entry for a specific issue type within a category.
 *
 * @param category - The issue category (e.g., 'change-detection')
 * @param issueType - The specific issue identifier (e.g., 'default-strategy')
 * @returns The matching HelpEntry or null if not found
 */
export function getHelpForIssue(
  category: IssueCategory,
  issueType: string
): HelpEntry | null {
  return (
    helpEntries.find(
      (entry) => entry.issueCategory === category && entry.issueType === issueType
    ) ?? null
  );
}

/**
 * Get all help entries for a given issue category.
 *
 * @param category - The issue category to filter by
 * @returns Array of HelpEntry objects for the category (may be empty)
 */
export function getHelpForCategory(category: IssueCategory): HelpEntry[] {
  return helpEntries.filter((entry) => entry.issueCategory === category);
}

/**
 * Get all available help entries.
 *
 * @returns The complete array of bundled HelpEntry objects
 */
export function getAllHelpEntries(): HelpEntry[] {
  return helpEntries;
}

/**
 * Check whether help content exists for a given issue category.
 *
 * @param category - The issue category to check
 * @returns true if at least one help entry exists for the category
 */
export function hasHelpForCategory(category: IssueCategory): boolean {
  return helpEntries.some((entry) => entry.issueCategory === category);
}

/**
 * Fix Difficulty Assessor Service
 *
 * Assigns a difficulty level and expected performance gain to each
 * analysis issue, enabling users to identify "quick wins" — easy fixes
 * with large or medium expected gains.
 *
 * Difficulty levels:
 *   - Easy: single-line change or decorator addition, no architectural impact
 *   - Moderate: requires modifying 2-5 lines or understanding a new concept
 *   - Hard: requires architectural refactoring or changes across multiple files
 *
 * Expected gain categories:
 *   - Large: likely to improve performance score by 10+ points
 *   - Medium: likely to improve score by 5-10 points
 *   - Small: likely to improve score by 1-5 points
 */

import type { AnalysisIssue, IssueCategory } from '../types/analyzer';

export type FixDifficulty = 'easy' | 'moderate' | 'hard';
export type ExpectedGain = 'large' | 'medium' | 'small';

export interface DifficultyAssessment {
  difficulty: FixDifficulty;
  gain: ExpectedGain;
  difficultyReason: string;
  gainReason: string;
}

/**
 * Known issue title patterns mapped to their difficulty/gain assessment.
 * Checked via case-insensitive substring matching against issue title.
 */
interface IssueRule {
  pattern: string;
  difficulty: FixDifficulty;
  gain: ExpectedGain;
  difficultyReason: string;
  gainReason: string;
}

const ISSUE_RULES: IssueRule[] = [
  // trackBy / track expression issues — Easy + Large
  {
    pattern: 'trackby',
    difficulty: 'easy',
    gain: 'large',
    difficultyReason: 'Adding a trackBy function is a single-line change in the template',
    gainReason: 'Prevents full list re-render on data changes, significant performance gain for large lists',
  },
  {
    pattern: 'track expression',
    difficulty: 'easy',
    gain: 'large',
    difficultyReason: 'Adding a track expression is a single-line template change',
    gainReason: 'Prevents full list re-render on data changes, significant performance gain for large lists',
  },
  // OnPush / change detection strategy — Easy + Large
  {
    pattern: 'onpush',
    difficulty: 'easy',
    gain: 'large',
    difficultyReason: 'Adding changeDetection: ChangeDetectionStrategy.OnPush is a single decorator property',
    gainReason: 'Reduces unnecessary change detection checks on frequently-checked components',
  },
  {
    pattern: 'change detection strategy',
    difficulty: 'easy',
    gain: 'large',
    difficultyReason: 'Switching to OnPush requires adding one property to the component decorator',
    gainReason: 'Significantly reduces change detection overhead for the component subtree',
  },
  {
    pattern: 'default change detection',
    difficulty: 'easy',
    gain: 'large',
    difficultyReason: 'Switching to OnPush requires adding one property to the component decorator',
    gainReason: 'Significantly reduces change detection overhead for the component subtree',
  },
  // Template function calls — Moderate + Medium
  {
    pattern: 'function',
    difficulty: 'moderate',
    gain: 'medium',
    difficultyReason: 'Requires creating a pipe or computing the value in the component class',
    gainReason: 'Eliminates repeated function execution on every change detection cycle',
  },
  {
    pattern: 'template method',
    difficulty: 'moderate',
    gain: 'medium',
    difficultyReason: 'Requires creating a pipe or moving logic to a computed property',
    gainReason: 'Reduces unnecessary recalculations during change detection',
  },
  // DOM complexity — Hard + Medium
  {
    pattern: 'excessive dom',
    difficulty: 'hard',
    gain: 'medium',
    difficultyReason: 'Requires splitting the component into smaller sub-components or virtualizing the DOM',
    gainReason: 'Reduces rendering time and memory usage for complex component trees',
  },
  {
    pattern: 'dom complexity',
    difficulty: 'hard',
    gain: 'medium',
    difficultyReason: 'Requires architectural restructuring to reduce DOM node count',
    gainReason: 'Reduces rendering time and memory usage for complex component trees',
  },
  {
    pattern: 'dom node',
    difficulty: 'hard',
    gain: 'medium',
    difficultyReason: 'Requires splitting the component or implementing virtual scrolling',
    gainReason: 'Reduces rendering time and memory usage for complex component trees',
  },
  // Layout thrashing — Hard + Large
  {
    pattern: 'layout thrashing',
    difficulty: 'hard',
    gain: 'large',
    difficultyReason: 'Requires restructuring DOM read/write operations across the component logic',
    gainReason: 'Eliminates forced reflows which cause significant rendering delays',
  },
  {
    pattern: 'forced reflow',
    difficulty: 'hard',
    gain: 'large',
    difficultyReason: 'Requires batching DOM reads and writes to avoid forced synchronous layouts',
    gainReason: 'Eliminates forced reflows which cause significant rendering delays',
  },
  // Render bottleneck — Moderate + Medium
  {
    pattern: 'render bottleneck',
    difficulty: 'moderate',
    gain: 'medium',
    difficultyReason: 'Requires identifying and optimizing the heavy rendering operations',
    gainReason: 'Reduces frame drops and improves perceived responsiveness',
  },
  {
    pattern: 'excessive mutation',
    difficulty: 'moderate',
    gain: 'medium',
    difficultyReason: 'Requires batching DOM mutations or reducing change detection frequency',
    gainReason: 'Reduces rendering overhead per change detection cycle',
  },
  // Subscription leaks — Moderate + Small
  {
    pattern: 'subscription',
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'Requires adding takeUntilDestroyed or unsubscribe logic',
    gainReason: 'Prevents memory leaks but has limited immediate performance impact',
  },
  {
    pattern: 'leak',
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'Requires adding proper cleanup patterns for observables',
    gainReason: 'Prevents memory leaks but has limited immediate performance impact',
  },
  // Lazy loading — Hard + Medium
  {
    pattern: 'lazy load',
    difficulty: 'hard',
    gain: 'medium',
    difficultyReason: 'Requires restructuring routes and module boundaries',
    gainReason: 'Reduces initial bundle size and improves time-to-interactive',
  },
  // Bundle size — Hard + Medium
  {
    pattern: 'bundle',
    difficulty: 'hard',
    gain: 'medium',
    difficultyReason: 'Requires code splitting or dependency optimization across the build',
    gainReason: 'Reduces initial load time and improves time-to-interactive',
  },
  // Signals migration — Moderate + Small
  {
    pattern: 'signal',
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'Requires understanding Signals API and refactoring reactive patterns',
    gainReason: 'Improves fine-grained reactivity but gains depend on component complexity',
  },
];

/**
 * Category-level fallback rules when no specific issue title pattern matches.
 */
const CATEGORY_DEFAULTS: Record<IssueCategory, { difficulty: FixDifficulty; gain: ExpectedGain; difficultyReason: string; gainReason: string }> = {
  'change-detection': {
    difficulty: 'easy',
    gain: 'large',
    difficultyReason: 'Change detection fixes typically involve decorator or template changes',
    gainReason: 'Change detection optimizations have high impact on overall performance',
  },
  'dom-complexity': {
    difficulty: 'hard',
    gain: 'medium',
    difficultyReason: 'DOM complexity issues typically require architectural changes',
    gainReason: 'Reducing DOM complexity improves rendering performance moderately',
  },
  'render-performance': {
    difficulty: 'moderate',
    gain: 'medium',
    difficultyReason: 'Render performance fixes require identifying and optimizing hot paths',
    gainReason: 'Render optimizations improve frame rate and responsiveness',
  },
  'memory-leaks': {
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'Memory leak fixes require adding cleanup patterns',
    gainReason: 'Leak fixes prevent degradation over time but have limited immediate impact',
  },
  'bundle-size': {
    difficulty: 'hard',
    gain: 'medium',
    difficultyReason: 'Bundle size reduction requires build configuration and code splitting changes',
    gainReason: 'Smaller bundles improve initial load time',
  },
  'signals-migration': {
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'Signals migration requires learning new APIs and refactoring patterns',
    gainReason: 'Signals improve reactivity but gains vary by component',
  },
  'zone-triggers': {
    difficulty: 'moderate',
    gain: 'medium',
    difficultyReason: 'Zone optimization requires understanding NgZone and async operations',
    gainReason: 'Reducing unnecessary zone triggers cuts change detection overhead',
  },
  'network-correlation': {
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'Network-render correlation fixes require async handling improvements',
    gainReason: 'Optimizing response-to-render time has moderate user-perceived impact',
  },
  'state-management': {
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'State management fixes require understanding store patterns',
    gainReason: 'State optimizations reduce unnecessary re-renders in specific areas',
  },
  'best-practices': {
    difficulty: 'moderate',
    gain: 'medium',
    difficultyReason: 'Best practice fixes vary in scope but typically require moderate effort',
    gainReason: 'Following best practices improves maintainability and performance',
  },
};

/**
 * Assess the difficulty and expected gain for a single analysis issue.
 *
 * First attempts to match the issue title against known patterns.
 * Falls back to category-level defaults if no pattern matches.
 */
export function assessDifficulty(issue: AnalysisIssue): DifficultyAssessment {
  const titleLower = issue.title.toLowerCase();

  // Check specific issue rules by pattern matching on title
  for (const rule of ISSUE_RULES) {
    if (titleLower.includes(rule.pattern)) {
      return {
        difficulty: rule.difficulty,
        gain: rule.gain,
        difficultyReason: rule.difficultyReason,
        gainReason: rule.gainReason,
      };
    }
  }

  // Fall back to category defaults
  const categoryDefault = CATEGORY_DEFAULTS[issue.category];
  if (categoryDefault) {
    return {
      difficulty: categoryDefault.difficulty,
      gain: categoryDefault.gain,
      difficultyReason: categoryDefault.difficultyReason,
      gainReason: categoryDefault.gainReason,
    };
  }

  // Ultimate fallback for unknown categories
  return {
    difficulty: 'moderate',
    gain: 'small',
    difficultyReason: 'Unable to determine difficulty — review the issue details',
    gainReason: 'Expected gain is uncertain without more context',
  };
}

/**
 * Get "quick wins" — issues that are easy to fix AND have large or medium
 * expected gain. These are the best candidates for immediate action.
 *
 * Returns issues sorted by expected gain descending (large before medium).
 */
export function getQuickWins(issues: AnalysisIssue[]): AnalysisIssue[] {
  const quickWins: Array<{ issue: AnalysisIssue; assessment: DifficultyAssessment }> = [];

  for (const issue of issues) {
    const assessment = assessDifficulty(issue);
    if (assessment.difficulty === 'easy' && (assessment.gain === 'large' || assessment.gain === 'medium')) {
      quickWins.push({ issue, assessment });
    }
  }

  // Sort: large gain first, then medium
  quickWins.sort((a, b) => {
    if (a.assessment.gain === b.assessment.gain) return 0;
    return a.assessment.gain === 'large' ? -1 : 1;
  });

  return quickWins.map((entry) => entry.issue);
}

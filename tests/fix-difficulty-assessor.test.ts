import { describe, expect, it } from 'vitest';

import { assessDifficulty, getQuickWins } from '../src/services/fix-difficulty-assessor';
import type { AnalysisIssue, IssueCategory } from '../src/types/analyzer';

function createIssue(overrides: Partial<AnalysisIssue> = {}): AnalysisIssue {
  return {
    id: 'issue-1',
    analyzer: 'best-practices-detector',
    component: 'AppComponent',
    severity: 'medium',
    category: 'best-practices',
    title: 'Generic issue',
    description: 'description',
    recommendation: 'recommendation',
    ...overrides,
  };
}

describe('fix-difficulty-assessor', () => {
  it('uses title pattern match before category fallback', () => {
    const issue = createIssue({
      category: 'memory-leaks',
      title: 'Missing trackBy in ngFor list',
    });

    const assessment = assessDifficulty(issue);

    expect(assessment.difficulty).toBe('easy');
    expect(assessment.gain).toBe('large');
  });

  it('uses category defaults when no pattern matches', () => {
    const issue = createIssue({
      category: 'zone-triggers',
      title: 'Unknown but zone related issue',
    });

    const assessment = assessDifficulty(issue);

    expect(assessment.difficulty).toBe('moderate');
    expect(assessment.gain).toBe('medium');
  });

  it('uses unknown-category fallback when category is not recognized', () => {
    const issue = createIssue({
      category: 'best-practices' as IssueCategory,
      title: 'Unmapped title',
    }) as AnalysisIssue & { category: string };

    issue.category = 'unknown-category';

    const assessment = assessDifficulty(issue as AnalysisIssue);

    expect(assessment.difficulty).toBe('moderate');
    expect(assessment.gain).toBe('small');
  });

  it('returns only easy high-value quick wins', () => {
    const anotherQuickWin = createIssue({
      id: 'issue-large-2',
      title: 'Use track expression in @for loop',
      category: 'change-detection',
    });
    const largeQuickWin = createIssue({
      id: 'issue-large',
      title: 'Default change detection detected',
      category: 'change-detection',
    });
    const notQuickWin = createIssue({
      id: 'issue-hard',
      title: 'Layout thrashing found in component',
      category: 'render-performance',
    });

    const quickWins = getQuickWins([anotherQuickWin, notQuickWin, largeQuickWin]);

    expect(quickWins.map((issue) => issue.id)).toEqual(['issue-large-2', 'issue-large']);
  });
});

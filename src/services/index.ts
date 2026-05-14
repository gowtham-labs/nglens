export {
  prioritizeIssues,
  filterByCategory,
  filterBySeverity,
  computeImpactScore,
} from './action-prioritizer';

export {
  getHelpForIssue,
  getHelpForCategory,
  getAllHelpEntries,
  hasHelpForCategory,
} from './help-content';

export {
  assessDifficulty,
  getQuickWins,
} from './fix-difficulty-assessor';

export type {
  FixDifficulty,
  ExpectedGain,
  DifficultyAssessment,
} from './fix-difficulty-assessor';

export {
  trackImprovement,
  getPositiveMessage,
  isFirstScan,
} from './improvement-tracker';

export type { MetricChange, ImprovementSummary } from './improvement-tracker';

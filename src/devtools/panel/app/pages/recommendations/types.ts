// src/devtools/panel/app/pages/recommendations/types.ts

import type { OnPushScore, TrackByIssue } from '../../../../../types/recommendation-events';
import type { LeakEvent } from '../../../../../types/leak-events';
import type { PollutionSourceMetrics } from '../../../../../types/zone-pollution-events';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type RecommendationType = 'onpush' | 'trackby' | 'leak' | 'zone-pollution';

export interface EnrichedRecommendation {
  id: string;
  type: RecommendationType;
  componentName: string;
  priority: PriorityLevel;
  difficulty: DifficultyLevel;
  impactEstimate: string;
  title: string;
  description: string;
  recommendation: string;
  isFixed: boolean;

  // Source data (one will be populated based on type)
  onPushData?: OnPushScore;
  trackByData?: TrackByIssue;
  leakData?: LeakEvent;
  zonePollutionData?: PollutionSourceMetrics;
}

export interface FilterState {
  priorityFilters: PriorityLevel[];
  typeFilters: RecommendationType[];
  searchText: string;
  showOnlyActionable: boolean;
}

export interface ProgressState {
  fixedIds: string[];
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  createdAt: number;
}

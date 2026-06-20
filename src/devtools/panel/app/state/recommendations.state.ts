import { Injectable, signal, computed, inject } from '@angular/core';
import { PanelState } from './panel.state';
import { PriorityScoringService } from '../services/priority-scoring.service';
import type {
  EnrichedRecommendation,
  FilterState,
  PriorityLevel,
  ProgressState,
  RecommendationType,
} from '../pages/recommendations/types';

const STORAGE_KEY_FILTERS = 'nglens:recommendations:filters';
const STORAGE_KEY_PROGRESS = 'nglens:recommendations:progress';

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Manages filter state, progress tracking, and derived recommendation lists.
 *
 * Combines raw recommendation data from PanelState with priority scoring
 * to produce enriched, filterable, and sortable recommendations.
 * Persists filter preferences and progress to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class RecommendationsState {
  private readonly panelState = inject(PanelState);
  private readonly priorityScoringService = inject(PriorityScoringService);

  // Filter signals
  readonly activePriorityFilters = signal<Set<PriorityLevel>>(new Set());
  readonly activeTypeFilters = signal<Set<RecommendationType>>(new Set());
  readonly searchText = signal<string>('');
  readonly showOnlyActionable = signal<boolean>(false);

  // Progress signal
  readonly fixedRecommendationIds = signal<Set<string>>(new Set());

  // Derived: enrich raw data from PanelState with priority scores
  readonly enrichedRecommendations = computed<EnrichedRecommendation[]>(() => {
    const onPushScores = this.panelState.onPushRecommendations();
    const trackByIssues = this.panelState.trackByIssues();
    const leakEvents = this.panelState.leakEvents();
    const zoneSources = this.panelState.zonePollutionSources();
    const fixedIds = this.fixedRecommendationIds();
    const componentStats = this.panelState.componentStats();

    const enriched: EnrichedRecommendation[] = [];

    // Build a rendersPerMinute lookup from componentStats
    const rendersPerMinuteMap = new Map<string, number>();
    for (const stat of componentStats) {
      rendersPerMinuteMap.set(stat.componentName, stat.rendersPerMinute);
    }

    // OnPush recommendations
    for (const score of onPushScores) {
      const id = `onpush-${score.component}`;
      const rendersPerMinute = rendersPerMinuteMap.get(score.component) ?? 0;
      // Create a partial to pass to scoring service (it reads onPushData.score and casts for rendersPerMinute)
      const partial: EnrichedRecommendation = {
        id,
        type: 'onpush',
        componentName: score.component,
        priority: 'low',
        difficulty: 'easy',
        impactEstimate: '',
        title: `Add OnPush to ${score.component}`,
        description: score.recommendation,
        recommendation: score.recommendation,
        isFixed: fixedIds.has(id),
        onPushData: Object.assign({}, score, { rendersPerMinute }) as unknown as typeof partial.onPushData,
      };
      partial.priority = this.priorityScoringService.calculatePriority(partial);
      partial.difficulty = this.priorityScoringService.estimateDifficulty(partial);
      partial.impactEstimate = this.priorityScoringService.estimateImpact(partial);
      enriched.push(partial);
    }

    // TrackBy recommendations
    for (const issue of trackByIssues) {
      const id = `trackby-${issue.id}`;
      const partial: EnrichedRecommendation = {
        id,
        type: 'trackby',
        componentName: issue.componentName,
        priority: 'low',
        difficulty: 'easy',
        impactEstimate: '',
        title: `Add trackBy to ${issue.componentName}`,
        description: `Collection "${issue.collectionProperty}" has ${issue.collectionSize} items without trackBy.`,
        recommendation: issue.recommendation,
        isFixed: fixedIds.has(id),
        trackByData: issue,
      };
      partial.priority = this.priorityScoringService.calculatePriority(partial);
      partial.difficulty = this.priorityScoringService.estimateDifficulty(partial);
      partial.impactEstimate = this.priorityScoringService.estimateImpact(partial);
      enriched.push(partial);
    }

    // Leak recommendations
    for (const leak of leakEvents) {
      const id = `leak-${leak.id}`;
      const partial: EnrichedRecommendation = {
        id,
        type: 'leak',
        componentName: leak.componentName,
        priority: 'low',
        difficulty: 'medium',
        impactEstimate: '',
        title: `Fix ${leak.leakType} leak in ${leak.componentName}`,
        description: `Unclean ${leak.leakType} from "${leak.source}" detected after component destruction.`,
        recommendation: `Fix the ${leak.leakType} leak by properly unsubscribing or cleaning up.`,
        isFixed: fixedIds.has(id),
        leakData: leak,
      };
      partial.priority = this.priorityScoringService.calculatePriority(partial);
      partial.difficulty = this.priorityScoringService.estimateDifficulty(partial);
      partial.impactEstimate = this.priorityScoringService.estimateImpact(partial);
      enriched.push(partial);
    }

    // Zone pollution recommendations
    for (const source of zoneSources) {
      const id = `zone-pollution-${source.source}`;
      const partial: EnrichedRecommendation = {
        id,
        type: 'zone-pollution',
        componentName: source.library ?? source.source,
        priority: 'low',
        difficulty: 'hard',
        impactEstimate: '',
        title: `Fix zone pollution: ${source.library ?? source.source}`,
        description: source.fixSuggestion ?? `${source.source} is triggering excessive change detection.`,
        recommendation: source.fixSuggestion ?? `Move ${source.source} outside NgZone using runOutsideAngular.`,
        isFixed: fixedIds.has(id),
        zonePollutionData: source,
      };
      partial.priority = this.priorityScoringService.calculatePriority(partial);
      partial.difficulty = this.priorityScoringService.estimateDifficulty(partial);
      partial.impactEstimate = this.priorityScoringService.estimateImpact(partial);
      enriched.push(partial);
    }

    return enriched;
  });

  // Derived: apply all active filters with AND logic, then sort
  readonly filteredRecommendations = computed<EnrichedRecommendation[]>(() => {
    const all = this.enrichedRecommendations();
    const priorityFilters = this.activePriorityFilters();
    const typeFilters = this.activeTypeFilters();
    const search = this.searchText().toLowerCase();
    const onlyActionable = this.showOnlyActionable();

    let filtered = all;

    // Priority filter
    if (priorityFilters.size > 0) {
      filtered = filtered.filter(r => priorityFilters.has(r.priority));
    }

    // Type filter
    if (typeFilters.size > 0) {
      filtered = filtered.filter(r => typeFilters.has(r.type));
    }

    // Search filter (case-insensitive on componentName)
    if (search.length > 0) {
      filtered = filtered.filter(r => r.componentName.toLowerCase().includes(search));
    }

    // Show only actionable (hide fixed)
    if (onlyActionable) {
      filtered = filtered.filter(r => !r.isFixed);
    }

    // Sort: Critical > High > Medium > Low, then by numeric impact descending
    return [...filtered].sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Extract numeric impact for secondary sort (descending)
      const impactA = this.extractNumericImpact(a.impactEstimate);
      const impactB = this.extractNumericImpact(b.impactEstimate);
      return impactB - impactA;
    });
  });

  // Progress computations
  readonly totalCount = computed<number>(() => this.enrichedRecommendations().length);

  readonly fixedCount = computed<number>(() => {
    const fixedIds = this.fixedRecommendationIds();
    const allIds = new Set(this.enrichedRecommendations().map(r => r.id));
    // Only count IDs that exist in current recommendations
    let count = 0;
    for (const id of fixedIds) {
      if (allIds.has(id)) count++;
    }
    return count;
  });

  readonly progressPercentage = computed<number>(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.fixedCount() / total) * 100);
  });

  constructor() {
    this.loadFromStorage();
  }

  // Action methods

  togglePriorityFilter(level: PriorityLevel): void {
    this.activePriorityFilters.update(current => {
      const next = new Set(current);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
    this.saveFiltersToStorage();
  }

  toggleTypeFilter(type: RecommendationType): void {
    this.activeTypeFilters.update(current => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    this.saveFiltersToStorage();
  }

  setSearchText(text: string): void {
    this.searchText.set(text);
    this.saveFiltersToStorage();
  }

  toggleShowOnlyActionable(): void {
    this.showOnlyActionable.update(v => !v);
    this.saveFiltersToStorage();
  }

  toggleFixed(id: string): void {
    this.fixedRecommendationIds.update(current => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    this.saveProgressToStorage();
  }

  resetProgress(): void {
    this.fixedRecommendationIds.set(new Set());
    this.saveProgressToStorage();
  }

  clearFilters(): void {
    this.activePriorityFilters.set(new Set());
    this.activeTypeFilters.set(new Set());
    this.searchText.set('');
    this.showOnlyActionable.set(false);
    this.removeFiltersFromStorage();
  }

  // Persistence helpers (using localStorage directly for JSON data)

  private saveFiltersToStorage(): void {
    const state: FilterState = {
      priorityFilters: [...this.activePriorityFilters()],
      typeFilters: [...this.activeTypeFilters()],
      searchText: this.searchText(),
      showOnlyActionable: this.showOnlyActionable(),
    };
    try {
      localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(state));
    } catch {
      // Silently fail — localStorage may be unavailable or full
    }
  }

  private saveProgressToStorage(): void {
    const state: ProgressState = {
      fixedIds: [...this.fixedRecommendationIds()],
    };
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(state));
    } catch {
      // Silently fail
    }
  }

  private removeFiltersFromStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_FILTERS);
    } catch {
      // Silently fail
    }
  }

  private loadFromStorage(): void {
    // Load filters
    try {
      const filtersJson = localStorage.getItem(STORAGE_KEY_FILTERS);
      if (filtersJson) {
        const parsed = JSON.parse(filtersJson) as FilterState;
        this.activePriorityFilters.set(new Set(parsed.priorityFilters ?? []));
        this.activeTypeFilters.set(new Set(parsed.typeFilters ?? []));
        this.searchText.set(parsed.searchText ?? '');
        this.showOnlyActionable.set(parsed.showOnlyActionable ?? false);
      }
    } catch {
      // On parse error, use defaults
    }

    // Load progress
    try {
      const progressJson = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (progressJson) {
        const parsed = JSON.parse(progressJson) as ProgressState;
        this.fixedRecommendationIds.set(new Set(parsed.fixedIds ?? []));
      }
    } catch {
      // On parse error, use defaults
    }
  }

  private extractNumericImpact(impactEstimate: string): number {
    const match = impactEstimate.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

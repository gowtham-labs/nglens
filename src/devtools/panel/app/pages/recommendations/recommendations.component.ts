import { Component, computed, inject, signal } from '@angular/core';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import type { OnPushScore, TrackByIssue } from '../../../../../types/recommendation-events';

export interface RecommendationCard {
  componentName: string;
  displayName: string;
  type: 'onpush' | 'trackby';
  problem: string;
  cause: string;
  fix: string;
}

export function deriveRecommendationCard(item: OnPushScore | TrackByIssue, type: 'onpush' | 'trackby'): RecommendationCard {
  if (type === 'onpush') {
    const score = item as OnPushScore;
    return {
      componentName: score.component,
      displayName: displayName(score.component),
      type: 'onpush',
      problem: 'Excessive re-renders without OnPush strategy',
      cause: score.factors.filter(f => f.met).map(f => f.description).join('; ') || 'Multiple factors indicate OnPush eligibility',
      fix: score.recommendation,
    };
  }
  const issue = item as TrackByIssue;
  return {
    componentName: issue.componentName,
    displayName: displayName(issue.componentName),
    type: 'trackby',
    problem: 'Collection rendered without trackBy function',
    cause: `Collection "${issue.collectionProperty}" with ${issue.collectionSize} items causes full DOM diffing`,
    fix: issue.recommendation,
  };
}

interface RecommendationGroup {
  componentName: string;
  displayName: string;
  cards: RecommendationCard[];
}

@Component({
  selector: 'app-recommendations',
  standalone: true,
  template: `
    @if (isEmpty()) {
      <p class="p-4 text-gray-400">No recommendations yet</p>
    } @else {
      <div class="p-4 space-y-1">
        @for (group of groupedRecommendations(); track group.componentName) {
          <!-- Group header -->
          <div
            class="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-gray-800 rounded"
            (click)="toggleGroup(group.componentName)"
          >
            <span class="text-[10px] text-gray-500">{{ isGroupCollapsed(group.componentName) ? '▶' : '▼' }}</span>
            <span class="text-xs font-medium text-gray-300 flex-1">{{ group.displayName }}</span>
            <span class="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">{{ group.cards.length }}</span>
          </div>
          <!-- Group cards -->
          @if (!isGroupCollapsed(group.componentName)) {
            @for (card of group.cards; track $index) {
              <div class="p-3 rounded border border-gray-700 ml-4 space-y-2">
                <!-- Card header -->
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium text-gray-200">{{ card.displayName }}</span>
                  <span
                    class="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    [class]="card.type === 'onpush' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'"
                  >
                    {{ card.type === 'onpush' ? 'OnPush' : 'TrackBy' }}
                  </span>
                </div>
                <!-- Problem -->
                <div>
                  <span class="text-[10px] text-gray-500 uppercase font-medium block">Problem</span>
                  <span class="text-xs text-gray-300">{{ card.problem }}</span>
                </div>
                <!-- Cause -->
                <div>
                  <span class="text-[10px] text-gray-500 uppercase font-medium block">Cause</span>
                  <span class="text-xs text-gray-300">{{ card.cause }}</span>
                </div>
                <!-- Suggested Fix -->
                <div>
                  <span class="text-[10px] text-gray-500 uppercase font-medium block">Suggested Fix</span>
                  <span class="text-xs text-gray-300">{{ card.fix }}</span>
                </div>
              </div>
            }
          }
        }
      </div>
    }
  `,
})
export class RecommendationsComponent {
  private readonly state = inject(PanelState);

  readonly trackByIssues = this.state.trackByIssues;
  readonly onPushRecommendations = this.state.onPushRecommendations;

  readonly isEmpty = computed(
    () => this.trackByIssues().length === 0 && this.onPushRecommendations().length === 0
  );

  private readonly expandedGroups = signal<Set<string>>(new Set());

  readonly groupedRecommendations = computed<RecommendationGroup[]>(() => {
    const groupMap = new Map<string, RecommendationCard[]>();

    for (const rec of this.onPushRecommendations()) {
      const cards = groupMap.get(rec.component) ?? [];
      cards.push(deriveRecommendationCard(rec, 'onpush'));
      groupMap.set(rec.component, cards);
    }

    for (const issue of this.trackByIssues()) {
      const cards = groupMap.get(issue.componentName) ?? [];
      cards.push(deriveRecommendationCard(issue, 'trackby'));
      groupMap.set(issue.componentName, cards);
    }

    return Array.from(groupMap.entries()).map(([componentName, cards]) => ({
      componentName,
      displayName: displayName(componentName),
      cards,
    }));
  });

  isGroupCollapsed(componentName: string): boolean {
    return !this.expandedGroups().has(componentName);
  }

  toggleGroup(componentName: string): void {
    this.expandedGroups.update(set => {
      const next = new Set(set);
      if (next.has(componentName)) {
        next.delete(componentName);
      } else {
        next.add(componentName);
      }
      return next;
    });
  }
}

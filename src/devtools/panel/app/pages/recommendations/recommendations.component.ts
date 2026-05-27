import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import type { OnPushScore, TrackByIssue } from '../../../../../types/recommendation-events';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <!-- Summary -->
      <section class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm">
        <h2 class="text-sm font-semibold text-gray-100 mb-4">Performance Recommendations</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="p-4 rounded-lg border border-purple-800/50 bg-purple-900/30">
            <div class="text-xs text-gray-400 mb-2 uppercase font-semibold">OnPush Candidates</div>
            <div class="text-3xl font-bold text-purple-300">{{ getOnPushCandidates().length }}</div>
            <div class="text-xs text-purple-400/80 mt-1">components can optimize</div>
          </div>

          <div class="p-4 rounded-lg border border-orange-800/50 bg-orange-900/30">
            <div class="text-xs text-gray-400 mb-2 uppercase font-semibold">Missing trackBy</div>
            <div class="text-3xl font-bold text-orange-300">{{ getTrackByIssues().length }}</div>
            <div class="text-xs text-orange-400/80 mt-1">*ngFor directives</div>
          </div>
        </div>
      </section>

      @if (getOnPushCandidates().length === 0 && getTrackByIssues().length === 0) {
        <div class="border border-green-800/50 rounded-lg p-8 bg-green-900/20 text-center">
          <div class="text-2xl mb-2">✓</div>
          <div class="text-green-300 font-semibold mb-1">No Recommendations</div>
          <div class="text-xs text-gray-400">Your Angular app is well-optimized!</div>
        </div>
      }

      <!-- OnPush Recommendations -->
      @if (getOnPushCandidates().length > 0) {
        <section class="border border-purple-700/50 rounded-lg overflow-hidden bg-purple-900/20 backdrop-blur-sm">
          <div class="px-4 py-3 border-b border-purple-700/50 bg-purple-900/40">
            <h3 class="text-sm font-semibold text-purple-200 uppercase">
              OnPush Strategy Candidates ({{ getOnPushCandidates().length }})
            </h3>
            <p class="text-xs text-gray-400 mt-1">
              These components are candidates for ChangeDetectionStrategy.OnPush optimization
            </p>
          </div>

          <div class="divide-y divide-purple-700/30 max-h-64 overflow-auto">
            @for (item of getOnPushCandidates(); track item.component) {
              <div class="px-4 py-3 hover:bg-purple-900/30 cursor-pointer transition-colors group" (click)="selectRecommendation(item)">
                <div class="flex items-start gap-3">
                  <div class="text-2xl font-bold text-purple-400 group-hover:scale-110 transition-transform">{{ item.score }}<span class="text-xs">/100</span></div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-100 group-hover:text-purple-200 transition-colors">{{ displayName(item.component) }}</div>
                    <div class="text-xs text-gray-400 mt-1">
                      <span class="inline-block mr-2">✓ Input-driven:</span>
                      {{ item.factors.filter(f => f.name === 'Has inputs')[0]?.description }}
                    </div>
                    <div class="mt-2 p-2 rounded bg-purple-900/40 border border-purple-800/30 text-xs text-gray-300">
                      <strong class="text-purple-200">Recommendation:</strong> {{ item.recommendation }}
                    </div>
                  </div>
                  <span class="text-[10px] text-purple-400 font-bold whitespace-nowrap">{{ item.currentStrategy }}</span>
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- TrackBy Issues -->
      @if (getTrackByIssues().length > 0) {
        <section class="border border-orange-700/50 rounded-lg overflow-hidden bg-orange-900/20 backdrop-blur-sm">
          <div class="px-4 py-3 border-b border-orange-700/50 bg-orange-900/40">
            <h3 class="text-sm font-semibold text-orange-200 uppercase">
              Missing trackBy Functions ({{ getTrackByIssues().length }})
            </h3>
            <p class="text-xs text-gray-400 mt-1">
              Add trackBy functions to improve list rendering performance
            </p>
          </div>

          <div class="divide-y divide-orange-700/30 max-h-64 overflow-auto">
            @for (item of getTrackByIssues(); track item.componentName) {
              <div class="px-4 py-3 hover:bg-orange-900/30 cursor-pointer transition-colors group" (click)="selectRecommendation(item)">
                <div class="flex items-start gap-3">
                  <div class="w-12 h-12 rounded-lg bg-orange-900/40 flex items-center justify-center border border-orange-700/50 group-hover:border-orange-600 transition-colors">
                    <span class="text-sm font-bold text-orange-400">{{ item.collectionSize }}</span>
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-100 group-hover:text-orange-200 transition-colors">{{ displayName(item.componentName) }}</div>
                    <div class="text-xs text-gray-400 mt-1">
                      Collection <strong class="text-orange-300">{{ item.collectionProperty }}</strong> has {{ item.collectionSize }} items
                    </div>
                    <div class="mt-2 p-2 rounded bg-orange-900/40 border border-orange-700/30 text-xs text-gray-300 font-mono">
                      <div class="mb-1">Add to your component:</div>
                      <div class="bg-black/50 p-1.5 rounded text-orange-300 text-[10px] leading-relaxed">
                        trackBy = (i: number, item: any) => item.id;
                      </div>
                    </div>
                    <div class="mt-2 text-xs text-gray-300">
                      <strong class="text-orange-200">In template:</strong> *ngFor="let item of items; trackBy: trackBy"
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- Best Practices Guide -->
      <section class="border border-blue-700/50 rounded-lg p-4 bg-blue-900/20 backdrop-blur-sm">
        <h3 class="text-xs font-semibold text-blue-300 mb-3 uppercase">Best Practices</h3>
        <div class="space-y-3 text-xs text-gray-300">
          <div class="p-3 rounded bg-blue-900/30 border border-blue-800/30">
            <strong class="block text-blue-300 mb-1">1. Use ChangeDetectionStrategy.OnPush</strong>
            <p class="text-gray-400 text-xs">For components that only depend on inputs, this dramatically reduces change detection cycles.</p>
          </div>
          <div class="p-3 rounded bg-blue-900/30 border border-blue-800/30">
            <strong class="block text-blue-300 mb-1">2. Always Use trackBy in *ngFor</strong>
            <p class="text-gray-400 text-xs">Without trackBy, Angular recreates DOM elements for every change, wasting performance.</p>
          </div>
          <div class="p-3 rounded bg-blue-900/30 border border-blue-800/30">
            <strong class="block text-blue-300 mb-1">3. Memoize Expensive Computations</strong>
            <p class="text-gray-400 text-xs">Use Angular Signals computed() to cache expensive operations until dependencies change.</p>
          </div>
          <div class="p-3 rounded bg-blue-900/30 border border-blue-800/30">
            <strong class="block text-blue-300 mb-1">4. Lazy Load Modules</strong>
            <p class="text-gray-400 text-xs">Use feature modules and lazy loading to reduce initial bundle size and improve startup time.</p>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class RecommendationsComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;

  getOnPushCandidates(): OnPushScore[] {
    return this.state.onPushResults().filter(r => r.score > 50);
  }

  getTrackByIssues(): TrackByIssue[] {
    return this.state.trackByIssues();
  }

  selectRecommendation(item: OnPushScore | TrackByIssue): void {
    if ('component' in item) {
      // OnPush score
      this.state.selectedComponent.set((item as OnPushScore).component);
    } else {
      // TrackBy issue
      this.state.selectedComponent.set((item as TrackByIssue).componentName);
    }
  }
}
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

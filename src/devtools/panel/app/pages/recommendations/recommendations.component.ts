import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import {
  buildRecommendationActions,
  confidenceClass,
  difficultyClass,
  gainClass,
  topQuickWins,
  type ActionKind,
  type RecommendationAction,
} from '../../utils/recommendation-actions';

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <section class="border border-gray-800 rounded bg-gray-900 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-100">Action Center</h2>
            <p class="text-xs text-gray-400 mt-1">
              Ranked fixes from render hotspots, trackBy checks, OnPush suitability, zone activity, and cleanup signals.
            </p>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 min-w-[360px]">
            <div class="summary-cell">
              <span>Total actions</span>
              <strong>{{ actions().length }}</strong>
            </div>
            <div class="summary-cell">
              <span>Quick wins</span>
              <strong>{{ quickWins().length }}</strong>
            </div>
            <div class="summary-cell">
              <span>High confidence</span>
              <strong>{{ highConfidenceCount() }}</strong>
            </div>
            <div class="summary-cell">
              <span>Large gain</span>
              <strong>{{ largeGainCount() }}</strong>
            </div>
          </div>
        </div>
      </section>

      @if (actions().length === 0) {
        <div class="border border-green-800/50 rounded p-8 bg-green-900/15 text-center">
          <div class="text-green-300 font-semibold mb-1">No ranked actions yet</div>
          <div class="text-xs text-gray-400">Use the app while tracking to collect recommendation evidence.</div>
        </div>
      } @else {
        <section class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-xs font-semibold text-gray-300 uppercase">Fix First</h3>
              <p class="text-[10px] text-gray-500 mt-0.5">Sorted by impact, confidence, and practicality.</p>
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (entry of kindCounts(); track entry.kind) {
                <span class="count-pill">{{ kindLabel(entry.kind) }} {{ entry.count }}</span>
              }
            </div>
          </div>

          <div class="divide-y divide-gray-800">
            @for (action of actions(); track action.id; let index = $index) {
              <button
                type="button"
                class="w-full text-left p-4 hover:bg-gray-800/55 transition-colors"
                (click)="selectAction(action)"
              >
                <div class="grid grid-cols-[36px_1fr] gap-3">
                  <div class="rank-box" [ngClass]="rankClass(index)">
                    {{ index + 1 }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="kind-pill" [ngClass]="kindClass(action.kind)">
                            {{ kindLabel(action.kind) }}
                          </span>
                          <span class="text-xs text-gray-500 truncate">
                            {{ displayName(action.source) }}
                          </span>
                        </div>
                        <h4 class="text-sm font-semibold text-gray-100 mt-2">{{ action.title }}</h4>
                        <p class="text-xs text-gray-400 mt-1">{{ action.suggestedFix }}</p>
                      </div>

                      <div class="flex flex-wrap gap-1.5 justify-end">
                        <span class="badge" [ngClass]="confidenceClass(action.confidence)">
                          {{ action.confidence }}
                        </span>
                        <span class="badge" [ngClass]="difficultyClass(action.difficulty)">
                          {{ action.difficulty }}
                        </span>
                        <span class="badge" [ngClass]="gainClass(action.expectedGain)">
                          {{ action.expectedGain }} gain
                        </span>
                      </div>
                    </div>

                    <div class="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
                      <div class="evidence-box">
                        <span>Evidence</span>
                        <strong>{{ action.evidence }}</strong>
                      </div>

                      @if (action.snippet) {
                        <pre class="snippet"><code>{{ action.snippet }}</code></pre>
                      } @else {
                        <div class="evidence-box">
                          <span>Next step</span>
                          <strong>Open Render Inspector and inspect the selected component evidence.</strong>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </button>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .summary-cell,
    .evidence-box {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
    }

    .summary-cell span,
    .evidence-box span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
    }

    .summary-cell strong {
      display: block;
      color: #f3f4f6;
      font-size: 18px;
      margin-top: 2px;
    }

    .evidence-box strong {
      display: block;
      color: #d1d5db;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.45;
      margin-top: 4px;
    }

    .rank-box {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      border: 1px solid rgb(75 85 99 / 0.7);
      background: rgb(31 41 55 / 0.55);
      font-size: 12px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .badge,
    .kind-pill,
    .count-pill {
      border: 1px solid rgb(75 85 99 / 0.55);
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .count-pill {
      color: #d1d5db;
      background: rgb(31 41 55 / 0.45);
    }

    .snippet {
      margin: 0;
      min-height: 68px;
      max-height: 132px;
      overflow: auto;
      white-space: pre-wrap;
      background: rgb(3 7 18 / 0.7);
      border: 1px solid rgb(55 65 81 / 0.75);
      border-radius: 4px;
      color: #bfdbfe;
      font-size: 11px;
      line-height: 1.45;
      padding: 8px;
    }
  `],
})
export class RecommendationsComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;
  readonly confidenceClass = confidenceClass;
  readonly difficultyClass = difficultyClass;
  readonly gainClass = gainClass;

  readonly actions = computed(() => buildRecommendationActions({
    trackByIssues: this.state.trackByIssues(),
    onPushRecommendations: this.state.onPushRecommendations(),
    hotspots: this.state.componentHotspots(),
    zonePollutionSources: this.state.zonePollutionSources(),
    leakEvents: this.state.leakEvents(),
  }));

  readonly quickWins = computed(() => topQuickWins(this.actions(), 3));
  readonly highConfidenceCount = computed(() => this.actions().filter(action => action.confidence === 'High').length);
  readonly largeGainCount = computed(() => this.actions().filter(action => action.expectedGain === 'Large').length);

  readonly kindCounts = computed(() => {
    const counts = new Map<ActionKind, number>();
    for (const action of this.actions()) {
      counts.set(action.kind, (counts.get(action.kind) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([kind, count]) => ({ kind, count }));
  });

  selectAction(action: RecommendationAction): void {
    this.state.selectedComponent.set(action.componentName);
    const matchingIssue = this.state.allIssues().find(issue =>
      issue.id === action.id ||
      issue.id === `zone-pollution-${action.componentName}` ||
      issue.id === `hotspot-${action.componentName}`
    );
    if (matchingIssue) {
      this.state.selectedIssue.set(matchingIssue);
    }
  }

  kindLabel(kind: ActionKind): string {
    switch (kind) {
      case 'trackby': return 'List';
      case 'onpush': return 'OnPush';
      case 'zone': return 'Zone';
      case 'render-hotspot': return 'Render';
      case 'memory-cleanup': return 'Memory';
    }
  }

  kindClass(kind: ActionKind): string {
    switch (kind) {
      case 'trackby': return 'text-orange-300 bg-orange-500/15 border-orange-500/30';
      case 'onpush': return 'text-purple-300 bg-purple-500/15 border-purple-500/30';
      case 'zone': return 'text-blue-300 bg-blue-500/15 border-blue-500/30';
      case 'render-hotspot': return 'text-amber-300 bg-amber-500/15 border-amber-500/30';
      case 'memory-cleanup': return 'text-red-300 bg-red-500/15 border-red-500/30';
    }
  }

  rankClass(index: number): string {
    if (index === 0) return 'text-red-300';
    if (index === 1) return 'text-amber-300';
    if (index === 2) return 'text-yellow-300';
    return 'text-gray-300';
  }
}

import { Component, inject, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import {
  buildRecommendationActions,
  confidenceClass,
  difficultyClass,
  gainClass,
  topQuickWins,
  type RecommendationAction,
} from '../../utils/recommendation-actions';
import type { ComponentHotspot } from '../../../../../types/panel';

interface HealthSummary {
  label: string;
  detail: string;
  className: string;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <section class="border border-gray-800 rounded bg-gray-900 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                [ngClass]="{
                  'bg-green-500': state.connectionState() === 'connected',
                  'bg-red-500': state.connectionState() === 'disconnected',
                  'bg-amber-500': state.connectionState() === 'reconnecting'
                }"
              ></span>
              <span class="text-xs text-gray-400 capitalize">{{ state.connectionState() }}</span>
              @if (state.degradedMode()) {
                <span class="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
                  Degraded
                </span>
              }
            </div>
            <h2 class="text-lg font-semibold mt-3" [ngClass]="healthSummary().className">
              {{ healthSummary().label }}
            </h2>
            <p class="text-xs text-gray-400 mt-1 max-w-3xl">{{ healthSummary().detail }}</p>
          </div>

          <div class="grid grid-cols-3 gap-2 text-right min-w-[260px]">
            <div class="metric-cell">
              <span>Issues</span>
              <strong>{{ issuesCount() }}</strong>
            </div>
            <div class="metric-cell">
              <span>Hotspots</span>
              <strong>{{ hotspotsCount() }}</strong>
            </div>
            <div class="metric-cell">
              <span>Actions</span>
              <strong>{{ actions().length }}</strong>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mt-4">
          <div class="metric-cell">
            <span>Components</span>
            <strong>{{ componentsCount() }}</strong>
            <small>rendered</small>
          </div>
          <div class="metric-cell">
            <span>Renders</span>
            <strong>{{ state.renderEvents().length }}</strong>
            <small>{{ renderRate() }} / min</small>
          </div>
          <div class="metric-cell">
            <span>Avg render</span>
            <strong>{{ averageRenderDuration() }}ms</strong>
            <small>per event</small>
          </div>
          <div class="metric-cell">
            <span>Memory risks</span>
            <strong>{{ memoryRiskCount() }}</strong>
            <small>cleanup signals</small>
          </div>
          <div class="metric-cell">
            <span>Quick wins</span>
            <strong>{{ quickWins().length }}</strong>
            <small>ranked first</small>
          </div>
          <div class="metric-cell">
            <span>Interactions</span>
            <strong>{{ interactionsCount() }}</strong>
            <small>render bursts</small>
          </div>
        </div>

        @if (!hasActivity()) {
          <div class="mt-4 border border-dashed border-gray-700 rounded p-4 bg-gray-800/30">
            <div class="text-sm font-medium text-gray-200">No tracking data yet</div>
            <p class="text-xs text-gray-400 mt-1">
              Start tracking, use the Angular page normally, then Overview will rank hotspots and quick wins from the captured evidence.
            </p>
          </div>
        }
      </section>

      @if (state.latestComparison(); as comparison) {
        <section class="border border-gray-800 rounded bg-gray-900 p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Latest Snapshot Comparison</h3>
            <span class="text-[10px] text-gray-500">
              {{ comparison.baseline.label }} to {{ comparison.current.label }}
            </span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div class="metric-cell">
              <span>Renders</span>
              <strong [ngClass]="deltaClass(comparison.delta.renders)">{{ signed(comparison.delta.renders) }}</strong>
            </div>
            <div class="metric-cell">
              <span>Avg ms</span>
              <strong [ngClass]="deltaClass(comparison.delta.averageRenderDuration)">
                {{ signed(comparison.delta.averageRenderDuration) }}
              </strong>
            </div>
            <div class="metric-cell">
              <span>Issues</span>
              <strong [ngClass]="deltaClass(comparison.delta.issues)">{{ signed(comparison.delta.issues) }}</strong>
            </div>
            <div class="metric-cell">
              <span>Hotspots</span>
              <strong [ngClass]="deltaClass(comparison.delta.hotspots)">{{ signed(comparison.delta.hotspots) }}</strong>
            </div>
          </div>
        </section>
      }

      <section class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Top Component Hotspots</h3>
            <span class="text-[10px] text-gray-500">{{ topHotspots().length }} shown</span>
          </div>

          @if (topHotspots().length === 0) {
            <div class="p-4 text-sm text-gray-500">No component hotspots in this recording.</div>
          } @else {
            <div class="divide-y divide-gray-800">
              @for (hotspot of topHotspots(); track hotspot.componentName; let index = $index) {
                <button
                  type="button"
                  (click)="selectHotspot(hotspot)"
                  class="w-full text-left px-4 py-3 hover:bg-gray-800/60 transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <div class="rank-pill" [ngClass]="scoreClass(hotspot.score)">
                      {{ index + 1 }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-gray-100 truncate">
                            {{ displayName(hotspot.componentName) }}
                          </div>
                          <div class="text-xs text-gray-500 mt-0.5 truncate">
                            {{ hotspot.reasons.join(', ') }}
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="text-sm font-bold" [ngClass]="scoreClass(hotspot.score)">
                            {{ hotspot.score }}/100
                          </div>
                          <div class="text-[10px] text-gray-500">{{ causeLabel(hotspot.primaryCause) }}</div>
                        </div>
                      </div>
                      <div class="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <span class="evidence-chip">{{ hotspot.renderCount }} renders</span>
                        <span class="evidence-chip">{{ hotspot.rendersPerMinute.toFixed(1) }}/min</span>
                        <span class="evidence-chip">{{ hotspot.averageDuration.toFixed(1) }}ms avg</span>
                      </div>
                    </div>
                  </div>
                </button>
              }
            </div>
          }
        </div>

        <div class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Top Quick Wins</h3>
            <span class="text-[10px] text-gray-500">{{ quickWins().length }} shown</span>
          </div>

          @if (quickWins().length === 0) {
            <div class="p-4 text-sm text-gray-500">No quick wins ranked yet.</div>
          } @else {
            <div class="divide-y divide-gray-800">
              @for (action of quickWins(); track action.id; let index = $index) {
                <button
                  type="button"
                  (click)="selectAction(action)"
                  class="w-full text-left px-4 py-3 hover:bg-gray-800/60 transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <div class="rank-pill text-green-300">
                      {{ index + 1 }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-100 truncate">{{ action.title }}</div>
                      <div class="text-xs text-gray-500 mt-0.5 truncate">{{ displayName(action.componentName) }}</div>
                      <div class="text-xs text-gray-300 mt-2">{{ action.evidence }}</div>
                      <div class="flex flex-wrap gap-1.5 mt-3">
                        <span class="badge" [ngClass]="confidenceClass(action.confidence)">{{ action.confidence }}</span>
                        <span class="badge" [ngClass]="difficultyClass(action.difficulty)">{{ action.difficulty }}</span>
                        <span class="badge" [ngClass]="gainClass(action.expectedGain)">{{ action.expectedGain }} gain</span>
                      </div>
                    </div>
                  </div>
                </button>
              }
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .metric-cell {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
    }

    .metric-cell span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .metric-cell strong {
      display: block;
      color: #f3f4f6;
      font-size: 15px;
      margin-top: 2px;
    }

    .metric-cell small {
      display: block;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.2;
      margin-top: 2px;
    }

    .rank-pill {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      border: 1px solid rgb(75 85 99 / 0.7);
      background: rgb(31 41 55 / 0.55);
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .evidence-chip,
    .badge {
      border: 1px solid rgb(75 85 99 / 0.55);
      border-radius: 4px;
      padding: 3px 6px;
      min-width: 0;
    }

    .evidence-chip {
      color: #d1d5db;
      background: rgb(17 24 39 / 0.45);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
  `],
})
export class OverviewComponent {
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
  readonly topHotspots = computed(() => this.state.componentHotspots().slice(0, 3));

  readonly issuesCount = computed(() => this.state.allIssues().length);
  readonly componentsCount = computed(() => this.state.componentStats().length);
  readonly memoryRiskCount = computed(() => this.state.leakEvents().length);
  readonly hotspotsCount = computed(() => this.state.componentHotspots().filter(h => h.score >= 70).length);
  readonly interactionsCount = computed(() => this.state.interactionProfiles().length);

  readonly hasActivity = computed(() =>
    this.state.renderEvents().length > 0 ||
    this.state.leakEvents().length > 0 ||
    this.state.trackByIssues().length > 0 ||
    this.state.onPushRecommendations().length > 0 ||
    this.state.zonePollutionSources().length > 0
  );

  readonly healthSummary = computed<HealthSummary>(() => {
    if (!this.hasActivity()) {
      return {
        label: 'Waiting for tracking data',
        detail: 'Overview will summarize the current recording once ngLens sees renders, recommendations, or memory cleanup signals.',
        className: 'text-gray-200',
      };
    }

    const topScore = this.topHotspots()[0]?.score ?? 0;
    const criticalMemory = this.state.leakEvents().some(event => event.severity === 'CRITICAL');
    const criticalZone = this.state.zonePollutionSources().some(source => source.severity === 'critical');

    if (topScore >= 90 || criticalMemory || criticalZone) {
      return {
        label: 'Critical attention needed',
        detail: 'Start with the highest-ranked action. The current recording contains a critical hotspot, zone trigger, or cleanup risk.',
        className: 'text-red-400',
      };
    }

    if (topScore >= 70 || this.actions().length > 0) {
      return {
        label: 'Actionable performance work found',
        detail: 'The recording has enough evidence to rank practical fixes. Start with quick wins, then inspect the top component hotspot.',
        className: 'text-amber-400',
      };
    }

    return {
      label: 'No major risk in this recording',
      detail: 'Captured activity looks healthy. Keep this snapshot as a baseline before making performance-sensitive changes.',
      className: 'text-green-400',
    };
  });

  renderRate(): string {
    const events = this.state.renderEvents();
    if (events.length === 0) return '0.0';
    const first = events[0].timestamp;
    const last = events[events.length - 1].timestamp;
    const minutes = Math.max((last - first) / 60000, 1 / 60);
    return (events.length / minutes).toFixed(1);
  }

  averageRenderDuration(): string {
    const events = this.state.renderEvents();
    if (events.length === 0) return '0.0';
    const total = events.reduce((sum, event) => sum + event.duration, 0);
    return (total / events.length).toFixed(1);
  }

  selectHotspot(hotspot: ComponentHotspot): void {
    this.state.selectedComponent.set(hotspot.componentName);
  }

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

  signed(value: number): string {
    const rounded = Math.abs(value) >= 10 ? Math.round(value) : Number(value.toFixed(1));
    return value > 0 ? `+${rounded}` : `${rounded}`;
  }

  deltaClass(value: number): string {
    if (value === 0) return 'text-gray-300';
    return value < 0 ? 'text-green-400' : 'text-red-400';
  }

  scoreClass(score: number): string {
    if (score >= 90) return 'text-red-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 40) return 'text-yellow-300';
    return 'text-green-400';
  }

  causeLabel(cause: ComponentHotspot['primaryCause']): string {
    switch (cause) {
      case 'signal': return 'Signal';
      case 'input': return 'Input';
      case 'zone': return 'Zone';
      case 'parent': return 'Cascade';
      case 'manual-cd': return 'Manual CD';
      default: return 'Unknown';
    }
  }
}

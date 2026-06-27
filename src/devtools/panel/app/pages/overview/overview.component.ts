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
import { CommandService } from '../../services/command.service';
import type { ComponentHotspot, SnapshotComparison } from '../../../../../types/panel';

interface HealthSummary {
  label: string;
  detail: string;
  className: string;
}

interface DiagnosisCard {
  label: string;
  value: string;
  detail: string;
  className: string;
}

interface CompareMetric {
  label: string;
  baseline: string;
  current: string;
  delta: string;
  verdict: 'better' | 'worse' | 'same';
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
              <span>Open risks</span>
              <strong>{{ issuesCount() }}</strong>
              <small>needs review</small>
            </div>
            <div class="metric-cell">
              <span>Top render risk</span>
              <strong [ngClass]="scoreClass(highestHotspotScore())">{{ highestHotspotScore() }}/100</strong>
              <small>{{ riskLabel(highestHotspotScore()) }}</small>
            </div>
            <div class="metric-cell">
              <span>Fix candidates</span>
              <strong>{{ actions().length }}</strong>
              <small>{{ quickWins().length }} quick wins</small>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-4">
          @for (card of diagnosisCards(); track card.label) {
            <div class="diagnosis-card">
              <span>{{ card.label }}</span>
              <strong [ngClass]="card.className">{{ card.value }}</strong>
              <small>{{ card.detail }}</small>
            </div>
          }
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mt-4">
          <div class="metric-cell">
            <span>Recorded renders</span>
            <strong>{{ state.renderEvents().length }}</strong>
            <small>events captured</small>
          </div>
          <div class="metric-cell">
            <span>Components seen</span>
            <strong>{{ componentsCount() }}</strong>
            <small>rendered at least once</small>
          </div>
          <div class="metric-cell">
            <span>Render frequency</span>
            <strong>{{ renderRate() }}/min</strong>
            <small>all components</small>
          </div>
          <div class="metric-cell">
            <span>Avg render cost</span>
            <strong>{{ averageRenderDuration() }}ms</strong>
            <small>per captured render</small>
          </div>
          <div class="metric-cell">
            <span>Cleanup risks</span>
            <strong>{{ memoryRiskCount() }}</strong>
            <small>missing teardown</small>
          </div>
          <div class="metric-cell">
            <span>Action windows</span>
            <strong>{{ interactionsCount() }}</strong>
            <small>render bursts grouped</small>
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

      <section class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Compare Runs</h3>
            <p class="text-[10px] text-gray-500 mt-0.5">{{ comparisonStatus() }}</p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="compare-button" (click)="saveBaseline()">Save Baseline</button>
            <button
              type="button"
              class="compare-button"
              [class.opacity-50]="state.snapshots().length === 0"
              [class.cursor-not-allowed]="state.snapshots().length === 0"
              [disabled]="state.snapshots().length === 0"
              (click)="captureCurrent()"
            >
              Capture Current
            </button>
            @if (state.snapshots().length > 0) {
              <button type="button" class="compare-button muted" (click)="resetComparison()">Reset</button>
            }
          </div>
        </div>

        @if (state.latestComparison(); as comparison) {
          <div class="overflow-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-500 border-b border-gray-800">
                  <th class="text-left py-2 px-4 font-medium">Metric</th>
                  <th class="text-right py-2 px-3 font-medium">{{ comparison.baseline.label }}</th>
                  <th class="text-right py-2 px-3 font-medium">{{ comparison.current.label }}</th>
                  <th class="text-right py-2 px-4 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                @for (metric of comparisonMetrics(comparison); track metric.label) {
                  <tr class="border-b border-gray-900 last:border-b-0">
                    <td class="py-2.5 px-4 text-gray-300 font-medium">{{ metric.label }}</td>
                    <td class="py-2.5 px-3 text-right text-gray-400">{{ metric.baseline }}</td>
                    <td class="py-2.5 px-3 text-right text-gray-200">{{ metric.current }}</td>
                    <td class="py-2.5 px-4 text-right">
                      <span class="change-pill" [ngClass]="changeClass(metric.verdict)">
                        {{ metric.delta }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="compare-empty">
              <span>Baseline</span>
              <strong>{{ state.snapshots().length > 0 ? state.snapshots()[0].label : 'Not saved' }}</strong>
            </div>
            <div class="compare-empty">
              <span>Current</span>
              <strong>{{ state.snapshots().length > 0 ? 'Ready to capture' : 'Waiting for baseline' }}</strong>
            </div>
          </div>
        }
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Top Render Hotspots</h3>
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
                        <div class="flex flex-col items-end gap-1">
                          <div class="text-sm font-bold" [ngClass]="scoreClass(hotspot.score)">
                            {{ hotspot.score }}/100
                          </div>
                          <div class="text-[10px] text-gray-500">{{ causeLabel(hotspot.primaryCause) }}</div>
                          <span
                            role="button"
                            tabindex="0"
                            title="Inspect in Elements panel"
                            class="inspect-element-btn"
                            (click)="$event.stopPropagation(); inspectElement(hotspot.componentName)"
                            (keydown.enter)="$event.stopPropagation(); inspectElement(hotspot.componentName)"
                          >⬡ Inspect</span>
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
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Fix First</h3>
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
    .metric-cell,
    .diagnosis-card {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
    }

    .diagnosis-card {
      min-height: 98px;
    }

    .metric-cell span,
    .diagnosis-card span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .metric-cell strong,
    .diagnosis-card strong {
      display: block;
      color: #f3f4f6;
      font-size: 15px;
      margin-top: 2px;
      overflow-wrap: anywhere;
    }

    .metric-cell small,
    .diagnosis-card small {
      display: block;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.2;
      margin-top: 2px;
      overflow-wrap: anywhere;
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

    .compare-button {
      border: 1px solid rgb(75 85 99 / 0.75);
      border-radius: 4px;
      color: #d1d5db;
      background: rgb(31 41 55 / 0.65);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      padding: 6px 8px;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .compare-button:hover:not(:disabled) {
      background: rgb(55 65 81 / 0.85);
      border-color: rgb(96 165 250 / 0.55);
      color: #f3f4f6;
    }

    .compare-button.muted {
      color: #9ca3af;
      background: rgb(17 24 39 / 0.45);
    }

    .compare-empty {
      border: 1px dashed rgb(75 85 99 / 0.65);
      border-radius: 4px;
      padding: 10px;
      background: rgb(17 24 39 / 0.35);
      min-width: 0;
    }

    .compare-empty span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .compare-empty strong {
      display: block;
      color: #d1d5db;
      font-size: 13px;
      margin-top: 4px;
    }

    .change-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      border-radius: 4px;
      border: 1px solid rgb(75 85 99 / 0.6);
      padding: 3px 6px;
      font-size: 11px;
      font-weight: 800;
    }

    .inspect-element-btn {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 10px;
      color: #6b7280;
      cursor: pointer;
      border-radius: 3px;
      padding: 2px 4px;
      border: 1px solid transparent;
      line-height: 1;
      transition: color 100ms ease, background 100ms ease, border-color 100ms ease;
      user-select: none;
      white-space: nowrap;
    }

    .inspect-element-btn:hover,
    .inspect-element-btn:focus {
      color: #60a5fa;
      background: rgb(96 165 250 / 0.12);
      border-color: rgb(96 165 250 / 0.3);
      outline: none;
    }
  `],
})
export class OverviewComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;
  readonly confidenceClass = confidenceClass;
  readonly difficultyClass = difficultyClass;
  readonly gainClass = gainClass;
  private readonly commandService = inject(CommandService);

  readonly actions = computed(() => buildRecommendationActions({
    trackByIssues: this.state.trackByIssues(),
    onPushRecommendations: this.state.onPushRecommendations(),
    hotspots: this.state.componentHotspots(),
    zonePollutionSources: this.state.zonePollutionSources(),
    leakEvents: this.state.leakEvents(),
  }));

  readonly quickWins = computed(() => topQuickWins(this.actions(), 3));
  readonly topAction = computed(() => this.quickWins()[0] ?? this.actions()[0] ?? null);
  readonly topHotspots = computed(() => this.state.componentHotspots().slice(0, 3));

  readonly issuesCount = computed(() => this.state.allIssues().length);
  readonly componentsCount = computed(() => this.state.componentStats().length);
  readonly memoryRiskCount = computed(() => this.state.leakEvents().length);
  readonly hotspotsCount = computed(() => this.state.componentHotspots().filter(h => h.score >= 70).length);
  readonly interactionsCount = computed(() => this.state.interactionProfiles().length);
  readonly highestHotspotScore = computed(() => this.topHotspots()[0]?.score ?? 0);

  readonly hasActivity = computed(() =>
    this.state.renderEvents().length > 0 ||
    this.state.leakEvents().length > 0 ||
    this.state.trackByIssues().length > 0 ||
    this.state.onPushRecommendations().length > 0 ||
    this.state.zonePollutionSources().length > 0
  );

  readonly diagnosisCards = computed<DiagnosisCard[]>(() => {
    const topAction = this.topAction();
    const topHotspot = this.topHotspots()[0];

    if (!this.hasActivity()) {
      return [
        {
          label: 'What happened',
          value: 'Nothing captured yet',
          detail: 'Start tracking and use the Angular page to collect render, cleanup, and recommendation signals.',
          className: 'text-gray-200',
        },
        {
          label: 'Why it matters',
          value: 'No evidence',
          detail: 'ngLens will avoid ranking fixes until it has runtime activity from the current page.',
          className: 'text-gray-300',
        },
        {
          label: 'Where to look',
          value: 'Waiting',
          detail: 'The top component or source will appear here after the first meaningful recording.',
          className: 'text-gray-300',
        },
        {
          label: 'Fix first',
          value: 'Record a workflow',
          detail: 'Repeat the interaction that feels slow or suspicious, then compare the ranked evidence.',
          className: 'text-cyan-300',
        },
      ];
    }

    return [
      this.whatHappenedCard(topAction, topHotspot),
      this.whyItMattersCard(topAction, topHotspot),
      this.whereToLookCard(topAction, topHotspot),
      this.fixFirstCard(topAction),
    ];
  });

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

  saveBaseline(): void {
    this.state.clearSnapshots();
    this.state.captureSnapshot('Baseline');
  }

  captureCurrent(): void {
    if (this.state.snapshots().length === 0) return;
    this.state.captureSnapshot('Current');
  }

  resetComparison(): void {
    this.state.clearSnapshots();
  }

  comparisonStatus(): string {
    const count = this.state.snapshots().length;
    if (count === 0) return 'Save a baseline before comparing a later run.';
    if (count === 1) return 'Baseline saved. Capture current after the next run.';
    return 'Lower render cost, risk, and cleanup counts are better.';
  }

  comparisonMetrics(comparison: SnapshotComparison): CompareMetric[] {
    const baseline = comparison.baseline.metrics;
    const current = comparison.current.metrics;
    const delta = comparison.delta;

    return [
      this.lowerIsBetterMetric('Render events', baseline.renders, current.renders, delta.renders),
      this.lowerIsBetterMetric('Render frequency', baseline.rendersPerMinute, current.rendersPerMinute, delta.rendersPerMinute, '/min'),
      this.lowerIsBetterMetric('Avg render cost', baseline.averageRenderDuration, current.averageRenderDuration, delta.averageRenderDuration, 'ms'),
      this.lowerIsBetterMetric('Total render cost', baseline.totalRenderDuration, current.totalRenderDuration, delta.totalRenderDuration, 'ms'),
      this.lowerIsBetterMetric('Open risks', baseline.issues, current.issues, delta.issues),
      this.lowerIsBetterMetric('Cleanup risks', baseline.leaks, current.leaks, delta.leaks),
      this.lowerIsBetterMetric('Render hotspots', baseline.hotspots, current.hotspots, delta.hotspots),
    ];
  }

  changeClass(verdict: CompareMetric['verdict']): string {
    switch (verdict) {
      case 'better':
        return 'text-green-300 bg-green-500/15 border-green-500/30';
      case 'worse':
        return 'text-red-300 bg-red-500/15 border-red-500/30';
      case 'same':
        return 'text-gray-300 bg-gray-700/25 border-gray-600/60';
    }
  }

  selectHotspot(hotspot: ComponentHotspot): void {
    this.state.selectedComponent.set(hotspot.componentName);
  }

  inspectElement(componentName: string): void {
    this.commandService.inspectInElementsPanel(componentName);
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

  riskLabel(score: number): string {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'watch';
    return 'low';
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

  private lowerIsBetterMetric(
    label: string,
    baseline: number,
    current: number,
    delta: number,
    unit = ''
  ): CompareMetric {
    return {
      label,
      baseline: this.formatMetricValue(baseline, unit),
      current: this.formatMetricValue(current, unit),
      delta: this.formatMetricDelta(delta, unit),
      verdict: delta < 0 ? 'better' : delta > 0 ? 'worse' : 'same',
    };
  }

  private formatMetricValue(value: number, unit: string): string {
    const rounded = Math.abs(value) >= 10 || unit === ''
      ? Math.round(value).toString()
      : value.toFixed(1);
    return unit ? `${rounded}${unit}` : rounded;
  }

  private formatMetricDelta(value: number, unit: string): string {
    if (value === 0) return unit ? `0${unit}` : '0';
    const rounded = Math.abs(value) >= 10 || unit === ''
      ? Math.round(Math.abs(value)).toString()
      : Math.abs(value).toFixed(1);
    return `${value > 0 ? '+' : '-'}${rounded}${unit}`;
  }

  private whatHappenedCard(
    action: RecommendationAction | null,
    hotspot: ComponentHotspot | undefined
  ): DiagnosisCard {
    if (this.memoryRiskCount() > 0 && action?.kind === 'memory-cleanup') {
      return {
        label: 'What happened',
        value: 'Cleanup risk surfaced',
        detail: `${this.memoryRiskCount()} destroyed-component cleanup signal(s) need review.`,
        className: 'text-amber-300',
      };
    }

    if (hotspot) {
      return {
        label: 'What happened',
        value: `${displayName(hotspot.componentName)} is hottest`,
        detail: `${hotspot.renderCount} renders at ${hotspot.rendersPerMinute.toFixed(1)}/min. Main cause: ${this.causeLabel(hotspot.primaryCause)}.`,
        className: this.scoreClass(hotspot.score),
      };
    }

    if (action) {
      return {
        label: 'What happened',
        value: `${this.actions().length} fix candidate(s)`,
        detail: action.evidence,
        className: this.actionTone(action),
      };
    }

    return {
      label: 'What happened',
      value: 'Low-risk activity',
      detail: 'ngLens captured activity, but no major hotspot or cleanup signal stands out yet.',
      className: 'text-green-300',
    };
  }

  private whyItMattersCard(
    action: RecommendationAction | null,
    hotspot: ComponentHotspot | undefined
  ): DiagnosisCard {
    if (action) {
      return {
        label: 'Why it matters',
        value: `${action.expectedGain} gain potential`,
        detail: action.evidence,
        className: this.actionTone(action),
      };
    }

    if (hotspot) {
      return {
        label: 'Why it matters',
        value: `${this.riskLabel(hotspot.score)} render risk`,
        detail: `${hotspot.averageDuration.toFixed(1)}ms average render cost across ${hotspot.renderCount} captured renders.`,
        className: this.scoreClass(hotspot.score),
      };
    }

    return {
      label: 'Why it matters',
      value: 'Healthy baseline',
      detail: 'This recording can be kept as a baseline before a risky UI or state-management change.',
      className: 'text-green-300',
    };
  }

  private whereToLookCard(
    action: RecommendationAction | null,
    hotspot: ComponentHotspot | undefined
  ): DiagnosisCard {
    const target = action?.componentName ?? hotspot?.componentName;

    if (target) {
      return {
        label: 'Where to look',
        value: displayName(target),
        detail: action?.source
          ? `Evidence source: ${action.source}.`
          : hotspot?.reasons.join(', ') ?? 'Open the row for component-level evidence.',
        className: 'text-gray-100',
      };
    }

    return {
      label: 'Where to look',
      value: 'No clear owner',
      detail: 'There is not enough component-level evidence to point at a specific source yet.',
      className: 'text-gray-300',
    };
  }

  private fixFirstCard(action: RecommendationAction | null): DiagnosisCard {
    if (!action) {
      return {
        label: 'Fix first',
        value: 'No fix ranked',
        detail: 'Keep recording or interact with the page until ngLens can rank a concrete action.',
        className: 'text-gray-300',
      };
    }

    return {
      label: 'Fix first',
      value: action.title,
      detail: `${action.confidence} confidence. ${action.suggestedFix}`,
      className: this.actionTone(action),
    };
  }

  private actionTone(action: RecommendationAction): string {
    if (action.expectedGain === 'Large' || action.confidence === 'High') return 'text-green-300';
    if (action.expectedGain === 'Medium' || action.confidence === 'Medium') return 'text-cyan-300';
    return 'text-amber-300';
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import { getSeverityLabels, type SeverityLabel } from '../../utils/severity-labels';
import { RenderTimelineComponent } from './render-timeline.component';
import { CommandService } from '../../services/command.service';
import type {
  ComponentHotspot,
  ComponentStats,
  HeatmapSortField,
  InteractionProfile,
  SortDirection,
} from '../../../../../types/panel';
import type { RenderCause } from '../../../../../types/render-events';

interface RenderStoryCard {
  label: string;
  value: string;
  detail: string;
  className: string;
}

@Component({
  selector: 'app-rendering',
  standalone: true,
  imports: [NgClass, RenderTimelineComponent],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <section class="border border-gray-800 rounded p-3 bg-gray-900">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-xs font-semibold text-gray-300 uppercase">Render Inspector</h2>
            <p class="text-sm mt-1" [ngClass]="pageHealthClass()">{{ pageHealthSummary() }}</p>
          </div>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded"
            [ngClass]="state.isTracking() ? 'bg-green-500/15 text-green-400' : 'bg-gray-800 text-gray-400'"
          >
            {{ state.isTracking() ? 'tracking live' : 'tracking off' }}
          </span>
        </div>

        @if (!state.isTracking()) {
          <div class="mt-3 border border-amber-500/30 bg-amber-500/10 rounded p-3">
            @if (state.trackingError()) {
              <div class="text-sm font-medium text-red-300">Tracking could not start</div>
              <p class="text-xs text-red-100/70 mt-1">{{ state.trackingError() }}</p>
            } @else {
              <div class="text-sm font-medium text-amber-300">Tracking is off</div>
              <p class="text-xs text-amber-100/70 mt-1">
                Start tracking, repeat the slow action, then compare the rendered components and causes.
              </p>
            }
          </div>
        }

        <div class="grid grid-cols-2 xl:grid-cols-4 gap-2 mt-3">
          <div class="metric-cell">
            <span>Captured renders</span>
            <strong>{{ state.renderEvents().length }}</strong>
            <small>component update events</small>
          </div>
          <div class="metric-cell">
            <span>Components rendered</span>
            <strong>{{ state.componentStats().length }}</strong>
            <small>unique components</small>
          </div>
          <div class="metric-cell">
            <span>Worst component risk</span>
            <strong [ngClass]="scoreClass(highestRisk())">{{ highestRisk() }}/100</strong>
            <small>{{ riskLabel(highestRisk()) }}</small>
          </div>
          <div class="metric-cell">
            <span>Most common cause</span>
            <strong>{{ dominantCauseLabel() }}</strong>
            <small>{{ causeHint(dominantCause()) }}</small>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-3">
          @for (card of renderStoryCards(); track card.label) {
            <div class="guidance-cell">
              <span>{{ card.label }}</span>
              <strong [ngClass]="card.className">{{ card.value }}</strong>
              <small>{{ card.detail }}</small>
            </div>
          }
        </div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div class="border border-gray-800 rounded overflow-hidden">
          <div class="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Interaction Render Bursts</h3>
            <span class="text-[10px] text-gray-500">{{ interactions().length }} windows</span>
          </div>
          @if (interactions().length === 0) {
            <div class="p-3 text-sm text-gray-500">
              Interact with the page to group renders into action windows.
            </div>
          } @else {
            <div class="overflow-auto max-h-64">
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-gray-400 border-b border-gray-800">
                    <th class="text-left py-2 px-2 font-medium">Burst</th>
                    <th class="text-right py-2 px-2 font-medium">Render events</th>
                    <th class="text-right py-2 px-2 font-medium">Components touched</th>
                    <th class="text-left py-2 px-2 font-medium">Dominant cause</th>
                    <th class="text-left py-2 px-2 font-medium">Slowest component</th>
                  </tr>
                </thead>
                <tbody>
                  @for (profile of interactions(); track profile.id) {
                    <tr class="border-b border-gray-900 hover:bg-gray-800/50">
                      <td class="py-1.5 px-2 text-gray-200">
                        {{ actionLabel(profile) }}
                        <span class="block text-[10px] text-gray-500">{{ profile.duration.toFixed(1) }}ms window</span>
                      </td>
                      <td class="py-1.5 px-2 text-right text-gray-300">{{ profile.renderCount }}</td>
                      <td class="py-1.5 px-2 text-right text-gray-300">{{ profile.componentCount }}</td>
                      <td class="py-1.5 px-2 text-gray-300">{{ burstCauseDetail(profile) }}</td>
                      <td class="py-1.5 px-2 text-gray-300 truncate max-w-[160px]">
                        {{ profile.slowestComponent ? displayName(profile.slowestComponent) : 'Unknown' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <div class="border border-gray-800 rounded overflow-hidden">
          <div class="px-3 py-2 border-b border-gray-800">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Why Renders Happened</h3>
          </div>
          <div class="p-3 space-y-2">
            @for (cause of causeBreakdown(); track cause.type) {
              <div>
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="text-gray-300">{{ causeLabel(cause.type) }}</span>
                  <span class="text-gray-500">{{ cause.count }}</span>
                </div>
                <div class="h-1.5 bg-gray-800 rounded overflow-hidden">
                  <div
                    class="h-full rounded"
                    [ngClass]="causeBarClass(cause.type)"
                    [style.width.%]="cause.percent"
                  ></div>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <app-render-timeline />

      <section class="border border-gray-800 rounded overflow-hidden">
        <div class="px-3 py-2 border-b border-gray-800 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Component Render Hotspots</h3>
            <p class="text-[10px] text-gray-500 mt-0.5">Sorted by render frequency, total cost, and risk score.</p>
          </div>
          <span class="text-[10px] text-gray-500">{{ sortedStats().length }} components</span>
        </div>

        @if (sortedStats().length === 0) {
          <div class="p-4 text-sm text-gray-500">
            No render data yet. Start tracking and perform a real page interaction.
          </div>
        } @else {
          <div class="overflow-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-400 border-b border-gray-800">
                  <th class="text-left py-2 px-2 font-medium">Component</th>
                  <th class="text-left py-2 px-2 font-medium">Dominant cause</th>
                  <th class="text-right py-2 px-2 font-medium">Risk score</th>
                  <th
                    class="text-right py-2 px-2 font-medium cursor-pointer hover:text-gray-200"
                    (click)="toggleSort('renderCount')"
                  >
                    Renders
                    @if (sortField() === 'renderCount') {
                      <span>{{ sortDirection() === 'asc' ? '↑' : '↓' }}</span>
                    }
                  </th>
                  <th
                    class="text-right py-2 px-2 font-medium cursor-pointer hover:text-gray-200"
                    (click)="toggleSort('rendersPerMinute')"
                  >
                    Renders/min
                    @if (sortField() === 'rendersPerMinute') {
                      <span>{{ sortDirection() === 'asc' ? '↑' : '↓' }}</span>
                    }
                  </th>
                  <th
                    class="text-right py-2 px-2 font-medium cursor-pointer hover:text-gray-200"
                    (click)="toggleSort('totalDuration')"
                  >
                    Total cost
                    @if (sortField() === 'totalDuration') {
                      <span>{{ sortDirection() === 'asc' ? '↑' : '↓' }}</span>
                    }
                  </th>
                  <th
                    class="text-right py-2 px-2 font-medium cursor-pointer hover:text-gray-200"
                    (click)="toggleSort('averageDuration')"
                  >
                    Avg cost
                    @if (sortField() === 'averageDuration') {
                      <span>{{ sortDirection() === 'asc' ? '↑' : '↓' }}</span>
                    }
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (stat of sortedStats(); track stat.componentName) {
                  <tr
                    class="border-b border-gray-900 hover:bg-gray-800/50 cursor-pointer"
                    (click)="selectComponent(stat.componentName)"
                  >
                    <td class="py-2 px-2 text-gray-200 max-w-[240px]">
                      <div class="flex items-center gap-1 min-w-0">
                        <span
                          class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          [ngClass]="getSeverityClass(stat.rendersPerMinute)"
                        ></span>
                        <span class="truncate flex-1">{{ displayName(stat.componentName) }}</span>
                        <span
                          role="button"
                          tabindex="0"
                          title="Inspect in Elements panel"
                          class="inspect-element-btn flex-shrink-0"
                          (click)="$event.stopPropagation(); inspectElement(stat.componentName)"
                          (keydown.enter)="$event.stopPropagation(); inspectElement(stat.componentName)"
                        >⬡</span>
                        <span
                          role="button"
                          tabindex="0"
                          title="Open component file in Sources panel"
                          class="inspect-element-btn flex-shrink-0"
                          (click)="$event.stopPropagation(); openInSources(stat.componentName)"
                          (keydown.enter)="$event.stopPropagation(); openInSources(stat.componentName)"
                        ><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
                      </div>
                      <div class="mt-1">
                        @for (label of getLabels(stat); track label) {
                          <span
                            class="text-[10px] font-bold px-1 py-0.5 rounded mr-1"
                            [ngClass]="getLabelClass(label)"
                          >{{ label }}</span>
                        }
                      </div>
                    </td>
                    <td class="py-2 px-2 text-gray-400 max-w-[320px]">
                      <span class="text-gray-300">{{ causeLabel(primaryCause(stat)) }}</span>
                      <span class="block text-[10px] text-gray-500">{{ componentHint(stat) }}</span>
                    </td>
                    <td class="py-2 px-2 text-right">
                      <span class="font-bold" [ngClass]="scoreClass(hotspotScore(stat.componentName))">
                        {{ hotspotScore(stat.componentName) }}/100
                      </span>
                      <span class="block text-[10px]" [ngClass]="scoreClass(hotspotScore(stat.componentName))">
                        {{ riskLabel(hotspotScore(stat.componentName)) }}
                      </span>
                    </td>
                    <td class="py-2 px-2 text-right text-gray-300">{{ stat.renderCount }}</td>
                    <td class="py-2 px-2 text-right text-gray-300">{{ stat.rendersPerMinute.toFixed(1) }}</td>
                    <td class="py-2 px-2 text-right text-gray-300">{{ stat.totalDuration.toFixed(1) }}</td>
                    <td class="py-2 px-2 text-right text-gray-300">{{ stat.averageDuration.toFixed(1) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .metric-cell,
    .guidance-cell {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
    }

    .metric-cell span,
    .guidance-cell span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .metric-cell strong,
    .guidance-cell strong {
      display: block;
      color: #f3f4f6;
      font-size: 13px;
      margin-top: 2px;
      overflow-wrap: anywhere;
    }

    .metric-cell small,
    .guidance-cell small {
      display: block;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.2;
      margin-top: 2px;
      overflow-wrap: anywhere;
    }

    .inspect-element-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #6b7280;
      cursor: pointer;
      border-radius: 3px;
      padding: 1px 3px;
      line-height: 1;
      transition: color 100ms ease, background 100ms ease;
      user-select: none;
    }

    .inspect-element-btn:hover,
    .inspect-element-btn:focus {
      color: #60a5fa;
      background: rgb(96 165 250 / 0.12);
      outline: none;
    }
  `],
})
export class RenderingComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;
  private readonly commandService = inject(CommandService);

  readonly sortField = signal<HeatmapSortField>('rendersPerMinute');
  readonly sortDirection = signal<SortDirection>('desc');

  readonly sortedStats = computed(() => {
    const stats = [...this.state.componentStats()];
    const field = this.sortField();
    const dir = this.sortDirection();
    return stats.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      return dir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  });

  readonly interactions = computed(() => this.state.interactionProfiles().slice(0, 12));
  readonly hotspots = computed(() => this.state.componentHotspots());
  readonly topHotspot = computed(() => this.hotspots()[0] ?? null);
  readonly highestRisk = computed(() => this.hotspots()[0]?.score ?? 0);

  readonly hotspotScoreMap = computed(() => {
    const scores = new Map<string, number>();
    for (const hotspot of this.hotspots()) {
      scores.set(hotspot.componentName, hotspot.score);
    }
    return scores;
  });

  readonly causeBreakdown = computed(() => {
    const totals: Record<RenderCause['type'], number> = {
      signal: 0,
      input: 0,
      zone: 0,
      parent: 0,
      'manual-cd': 0,
    };

    for (const stat of this.state.componentStats()) {
      for (const [type, count] of Object.entries(stat.causesBreakdown) as [RenderCause['type'], number][]) {
        totals[type] += count;
      }
    }

    const total = Math.max(Object.values(totals).reduce((sum, count) => sum + count, 0), 1);
    return (Object.entries(totals) as [RenderCause['type'], number][])
      .map(([type, count]) => ({
        type,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  });

  readonly dominantCause = computed<RenderCause['type'] | 'unknown'>(() =>
    this.causeBreakdown().find(cause => cause.count > 0)?.type ?? 'unknown'
  );

  readonly dominantCauseLabel = computed(() => this.causeLabel(this.dominantCause()));

  readonly renderStoryCards = computed<RenderStoryCard[]>(() => {
    const top = this.topHotspot();

    if (!top) {
      return [
        {
          label: 'What happened',
          value: 'No renders ranked',
          detail: 'Start tracking and repeat the slow or important user action.',
          className: 'text-gray-200',
        },
        {
          label: 'Likely cause',
          value: this.dominantCauseLabel(),
          detail: this.causeHint(this.dominantCause()),
          className: 'text-gray-300',
        },
        {
          label: 'Where to look',
          value: 'Waiting',
          detail: 'The hottest component appears here after render events are captured.',
          className: 'text-gray-300',
        },
        {
          label: 'Next action',
          value: 'Record workflow',
          detail: 'Use the page naturally, then inspect the top component row.',
          className: 'text-cyan-300',
        },
      ];
    }

    return [
      {
        label: 'What happened',
        value: this.renderActivityLabel(top),
        detail: `${top.renderCount} renders, ${top.rendersPerMinute.toFixed(1)}/min, ${top.averageDuration.toFixed(1)}ms average.`,
        className: this.scoreClass(top.score),
      },
      {
        label: 'Likely cause',
        value: this.causeLabel(top.primaryCause),
        detail: this.causeHint(top.primaryCause),
        className: this.causeTextClass(top.primaryCause),
      },
      {
        label: 'Where to look',
        value: displayName(top.componentName),
        detail: top.reasons.join(', '),
        className: 'text-gray-100',
      },
      {
        label: 'Next action',
        value: this.firstFix(),
        detail: this.renderConfidence(top),
        className: 'text-cyan-300',
      },
    ];
  });

  toggleSort(field: HeatmapSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }

  selectComponent(componentName: string): void {
    this.state.selectedComponent.set(componentName);
  }

  inspectElement(componentName: string): void {
    this.commandService.inspectInElementsPanel(componentName);
  }

  openInSources(componentName: string): void {
    this.commandService.openInSources(componentName);
  }

  getLabels(stat: ComponentStats): SeverityLabel[] {
    return getSeverityLabels(stat);
  }

  getLabelClass(label: SeverityLabel): string {
    switch (label) {
      case 'EXCESSIVE': return 'text-red-400 bg-red-500/20';
      case 'HOT': return 'text-amber-400 bg-amber-500/20';
      case 'CASCADE': return 'text-purple-400 bg-purple-500/20';
      case 'ZONE TRIGGERED': return 'text-blue-400 bg-blue-500/20';
    }
  }

  getSeverityClass(rendersPerMinute: number): string {
    if (rendersPerMinute > 100) return 'bg-red-500';
    if (rendersPerMinute > 20) return 'bg-amber-500';
    return 'bg-green-500';
  }

  hotspotScore(componentName: string): number {
    return this.hotspotScoreMap().get(componentName) ?? 0;
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

  pageHealthSummary(): string {
    const risk = this.highestRisk();
    if (risk >= 90) return 'Critical render risk found. Start with the top hotspot and its render cause.';
    if (risk >= 70) return 'High render risk found. One or more components are likely affecting interaction responsiveness.';
    if (risk >= 40) return 'Watch this page. Rendering is frequent enough to inspect the causes.';
    if (this.state.componentStats().length === 0) return 'No render data yet. Start tracking and use the page to see what re-renders.';
    return 'No major render risk found in the current recording.';
  }

  pageHealthClass(): string {
    const risk = this.highestRisk();
    if (risk >= 90) return 'text-red-400';
    if (risk >= 70) return 'text-amber-400';
    if (risk >= 40) return 'text-yellow-300';
    return 'text-green-400';
  }

  primaryRisk(): string {
    const top = this.hotspots()[0];
    if (!top) return 'No risky component detected yet';
    if (top.averageDuration >= 16) return `${displayName(top.componentName)} renders slowly`;
    if (top.rendersPerMinute >= 100) return `${displayName(top.componentName)} renders too often`;
    return `${displayName(top.componentName)} has moderate render activity`;
  }

  riskImpact(): string {
    const top = this.hotspots()[0];
    if (!top) return 'Use the app while tracking to collect render signals';
    if (top.averageDuration >= 16) return 'Slow renders can block smooth clicking, typing, and scrolling';
    if (top.rendersPerMinute >= 100) return 'Frequent renders can waste CPU and hide parent-child cascades';
    return 'This is not urgent, but repeated renders can grow expensive on data-heavy pages';
  }

  firstFix(): string {
    const top = this.hotspots()[0];
    if (!top) return 'Start tracking, then repeat the action that feels slow';
    if (top.primaryCause === 'parent') return 'Check parent inputs, OnPush, and child component stability';
    if (top.primaryCause === 'zone') return 'Check event handlers, timers, HTTP callbacks, and broad change detection';
    if (top.primaryCause === 'signal') return 'Check computed signals and repeated signal updates';
    if (top.primaryCause === 'input') return 'Check array/object reference changes passed into child components';
    if (top.rendersPerMinute >= 100) return 'Check trackBy, OnPush, and repeated state updates';
    return 'Select the component row and inspect its render causes';
  }

  actionLabel(profile: InteractionProfile): string {
    // Look up the actual render events in this burst window to get specific sources
    const burstEvents = this.state.renderEvents().filter(e =>
      e.timestamp >= profile.startTime && e.timestamp <= profile.endTime
    );

    const sources = new Map<string, number>();
    for (const event of burstEvents) {
      for (const cause of event.causes) {
        const label = cause.source ?? cause.type;
        if (label && label !== 'unknown') {
          sources.set(label, (sources.get(label) ?? 0) + 1);
        }
      }
    }

    if (sources.size === 0) return profile.label;

    // Show top source as the label
    const topSource = Array.from(sources.entries()).sort((a, b) => b[1] - a[1])[0];
    return this.formatSourceName(topSource[0]);
  }

  burstCauseDetail(profile: InteractionProfile): string {
    const burstEvents = this.state.renderEvents().filter(e =>
      e.timestamp >= profile.startTime && e.timestamp <= profile.endTime
    );

    const sources = new Map<string, number>();
    for (const event of burstEvents) {
      for (const cause of event.causes) {
        const label = cause.source ?? cause.type;
        if (label && label !== 'unknown') {
          sources.set(label, (sources.get(label) ?? 0) + 1);
        }
      }
    }

    if (sources.size === 0) return this.causeLabel(profile.dominantCause);

    const sorted = Array.from(sources.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 2)
      .map(([source, count]) => `${this.formatSourceName(source)} (${count}x)`)
      .join(', ');
  }

  causeLabel(cause: RenderCause['type'] | 'unknown'): string {
    switch (cause) {
      case 'signal': return 'Signal update';
      case 'input': return 'Input changed';
      case 'zone': return 'Async/DOM event';
      case 'parent': return 'Parent re-render';
      case 'manual-cd': return 'Manual change detection';
      default: return 'Unknown cause';
    }
  }

  causeHint(cause: RenderCause['type'] | 'unknown'): string {
    switch (cause) {
      case 'signal': return 'signals changed values';
      case 'input': return 'inputs or references changed';
      case 'zone': return 'events, timers, or async work';
      case 'parent': return 'cascade from parent render';
      case 'manual-cd': return 'explicit Angular CD call';
      default: return 'waiting for render causes';
    }
  }

  causeBarClass(cause: RenderCause['type']): string {
    switch (cause) {
      case 'parent': return 'bg-purple-500';
      case 'input': return 'bg-cyan-500';
      case 'zone': return 'bg-blue-500';
      case 'signal': return 'bg-green-500';
      case 'manual-cd': return 'bg-amber-500';
    }
  }

  causeTextClass(cause: RenderCause['type'] | 'unknown'): string {
    switch (cause) {
      case 'parent': return 'text-purple-300';
      case 'input': return 'text-cyan-300';
      case 'zone': return 'text-blue-300';
      case 'signal': return 'text-green-300';
      case 'manual-cd': return 'text-amber-300';
      default: return 'text-gray-300';
    }
  }

  primaryCause(stat: ComponentStats): RenderCause['type'] | 'unknown' {
    let winner: RenderCause['type'] | 'unknown' = 'unknown';
    let highest = 0;
    for (const [cause, count] of Object.entries(stat.causesBreakdown) as [RenderCause['type'], number][]) {
      if (count > highest) {
        winner = cause;
        highest = count;
      }
    }
    return winner;
  }

  componentHint(stat: ComponentStats): string {
    // Show the actual trigger sources from render events for this component
    const events = this.state.renderEvents().filter(e => e.componentName === stat.componentName);
    const sources = new Map<string, number>();
    for (const event of events) {
      for (const cause of event.causes) {
        const label = cause.source ?? cause.type;
        sources.set(label, (sources.get(label) ?? 0) + 1);
      }
    }

    if (sources.size === 0) return 'Render cause is not clear yet.';

    // Show top 3 specific sources with counts
    const sorted = Array.from(sources.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 3)
      .map(([source, count]) => `${this.formatSourceName(source)} (${count}x)`)
      .join(', ');
  }

  private formatSourceName(source: string): string {
    if (source.startsWith('addEventListener:')) return source.replace('addEventListener:', '') + ' event';
    if (source === 'setTimeout') return 'setTimeout';
    if (source === 'setInterval') return 'setInterval';
    if (source === 'fetch') return 'fetch/HTTP';
    if (source === 'XMLHttpRequest') return 'XHR/HTTP';
    if (source === 'Promise.then') return 'Promise';
    if (source === 'requestAnimationFrame') return 'rAF';
    if (source === 'unknown') return 'zone (unidentified)';
    return source;
  }

  private renderActivityLabel(hotspot: ComponentHotspot): string {
    if (hotspot.score >= 90) return 'Critical render hotspot';
    if (hotspot.score >= 70) return 'High render hotspot';
    if (hotspot.rendersPerMinute >= 100) return 'Frequent renders';
    if (hotspot.averageDuration >= 16) return 'Slow render cost';
    return 'Moderate render activity';
  }

  private renderConfidence(hotspot: ComponentHotspot): string {
    const events = this.state.renderEvents().length;
    if (events < 5) return 'Low evidence so far. Capture more interactions before changing architecture.';
    if (hotspot.score >= 70) return 'High confidence: this component has repeated evidence in the current recording.';
    if (hotspot.score >= 40) return 'Heuristic confidence: worth checking before optimizing broadly.';
    return 'Low risk: keep as supporting evidence unless the user-visible action still feels slow.';
  }
}

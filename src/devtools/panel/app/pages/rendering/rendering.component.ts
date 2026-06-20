import { Component, computed, inject, signal } from '@angular/core';
import { NgClass, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import { getSeverityLabels, type SeverityLabel } from '../../utils/severity-labels';
import { RenderFlameGraphComponent } from './render-flame-graph.component';
import { RenderCausationTreeComponent } from './render-causation-tree.component';
import { ComponentTreeBrowserComponent } from './component-tree-browser.component';
import { ZonePollutionHeatmapComponent } from './zone-pollution-heatmap.component';
import type {
  ComponentHotspot,
  ComponentStats,
  HeatmapSortField,
  InteractionProfile,
  SortDirection,
} from '../../../../../types/panel';
import type { RenderCause } from '../../../../../types/render-events';

@Component({
  selector: 'app-rendering',
  standalone: true,
  imports: [NgClass, CommonModule, FormsModule, RenderFlameGraphComponent, RenderCausationTreeComponent, ComponentTreeBrowserComponent, ZonePollutionHeatmapComponent],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <!-- Flame Graph -->
      <app-render-flame-graph></app-render-flame-graph>

      <!-- Causation Tree -->
      <app-render-causation-tree></app-render-causation-tree>

      <!-- Component Tree Browser -->
      <app-component-tree-browser></app-component-tree-browser>

      <!-- Zone Pollution Heatmap -->
      <app-zone-pollution-heatmap></app-zone-pollution-heatmap>

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
                Click Start, perform the page action, then this view will show what rendered and why.
              </p>
            }
          </div>
        }

        <div class="grid grid-cols-2 xl:grid-cols-4 gap-2 mt-3">
          <div class="metric-cell">
            <span>Render events</span>
            <strong>{{ state.renderEvents().length }}</strong>
            <small>component updates captured</small>
          </div>
          <div class="metric-cell">
            <span>Components</span>
            <strong>{{ state.componentStats().length }}</strong>
            <small>components affected</small>
          </div>
          <div class="metric-cell">
            <span>Top risk</span>
            <strong [ngClass]="scoreClass(highestRisk())">{{ highestRisk() }}/100</strong>
            <small>{{ riskLabel(highestRisk()) }}</small>
          </div>
          <div class="metric-cell">
            <span>Main cause</span>
            <strong>{{ dominantCauseLabel() }}</strong>
            <small>{{ causeHint(dominantCause()) }}</small>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-3">
          <div class="guidance-cell">
            <span>What looks risky</span>
            <strong>{{ primaryRisk() }}</strong>
          </div>
          <div class="guidance-cell">
            <span>Why it matters</span>
            <strong>{{ riskImpact() }}</strong>
          </div>
          <div class="guidance-cell">
            <span>Try first</span>
            <strong>{{ firstFix() }}</strong>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div class="border border-gray-800 rounded overflow-hidden">
          <div class="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Live Interaction Bursts</h3>
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
                    <th class="text-left py-2 px-2 font-medium">Action Window</th>
                    <th class="text-right py-2 px-2 font-medium">Renders</th>
                    <th class="text-right py-2 px-2 font-medium">Components</th>
                    <th class="text-left py-2 px-2 font-medium">Likely Cause</th>
                    <th class="text-left py-2 px-2 font-medium">Slowest</th>
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
                      <td class="py-1.5 px-2 text-gray-300">{{ causeLabel(profile.dominantCause) }}</td>
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
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Render Cause Mix</h3>
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

      <section class="border border-gray-800 rounded overflow-hidden">
        <div class="px-3 py-2 border-b border-gray-800 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Component Render Hotspots</h3>
            <p class="text-[10px] text-gray-500 mt-0.5">Select a row to open the detailed "Why did this render?" panel.</p>
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
                  <th class="text-left py-2 px-2 font-medium">Why it rendered</th>
                  <th class="text-right py-2 px-2 font-medium">Risk</th>
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
                    /min
                    @if (sortField() === 'rendersPerMinute') {
                      <span>{{ sortDirection() === 'asc' ? '↑' : '↓' }}</span>
                    }
                  </th>
                  <th
                    class="text-right py-2 px-2 font-medium cursor-pointer hover:text-gray-200"
                    (click)="toggleSort('totalDuration')"
                  >
                    Total ms
                    @if (sortField() === 'totalDuration') {
                      <span>{{ sortDirection() === 'asc' ? '↑' : '↓' }}</span>
                    }
                  </th>
                  <th
                    class="text-right py-2 px-2 font-medium cursor-pointer hover:text-gray-200"
                    (click)="toggleSort('averageDuration')"
                  >
                    Avg ms
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
                    <td class="py-2 px-2 text-gray-200 truncate max-w-[240px]">
                      <span
                        class="inline-block w-2 h-2 rounded-full mr-2"
                        [ngClass]="getSeverityClass(stat.rendersPerMinute)"
                      ></span>
                      {{ displayName(stat.componentName) }}
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
    }

    .metric-cell small {
      display: block;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.2;
      margin-top: 2px;
    }
  `],
})
export class RenderingComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;

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
    if (profile.dominantCause === 'zone') return 'Async or DOM event burst';
    if (profile.dominantCause === 'input') return 'Input-driven render burst';
    if (profile.dominantCause === 'parent') return 'Parent-to-child cascade';
    if (profile.dominantCause === 'signal') return 'Signal update burst';
    if (profile.dominantCause === 'manual-cd') return 'Manual change detection burst';
    return profile.label;
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
    const cause = this.primaryCause(stat);
    if (cause === 'parent') return 'A parent render is repeatedly pulling this component into the update.';
    if (cause === 'input') return 'Inputs or array/object references may be changing more often than expected.';
    if (cause === 'zone') return 'A DOM event, timer, promise, or HTTP callback likely triggered this update.';
    if (cause === 'signal') return 'A signal update is driving this component render.';
    if (cause === 'manual-cd') return 'Manual detectChanges or markForCheck appears involved.';
    return 'Render cause is not clear yet.';
  }
}

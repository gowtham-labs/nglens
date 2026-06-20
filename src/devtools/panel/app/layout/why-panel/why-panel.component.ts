import { Component, inject, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import type { ComponentStats } from '../../../../../types/panel';
import type { RenderCause } from '../../../../../types/render-events';

interface CauseEntry {
  type: RenderCause['type'];
  label: string;
  count: number;
  percent: number;
  source: string;
  isDominant: boolean;
}

@Component({
  selector: 'app-why-panel',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="h-full flex flex-col p-4 bg-gray-900">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div class="min-w-0">
          <h2 class="text-sm font-bold text-white truncate">{{ componentDisplayName() }}</h2>
          <p class="text-xs text-gray-400 mt-1">{{ renderExplanation() }}</p>
        </div>
        <button
          type="button"
          class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          (click)="dismiss()"
        >Dismiss</button>
      </div>

      @if (!selectedStats()) {
        <div class="border border-gray-800 rounded p-3 bg-gray-800/45 text-sm text-gray-500">
          No render statistics are available for this selection yet.
        </div>
      } @else {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div class="detail-cell">
            <span>Total renders</span>
            <strong>{{ selectedStats()!.renderCount }}</strong>
          </div>
          <div class="detail-cell">
            <span>Recent renders</span>
            <strong>{{ recentRenderCount() }}</strong>
          </div>
          <div class="detail-cell">
            <span>Render rate</span>
            <strong>{{ selectedStats()!.rendersPerMinute.toFixed(1) }}/min</strong>
          </div>
          <div class="detail-cell">
            <span>Avg duration</span>
            <strong>{{ selectedStats()!.averageDuration.toFixed(1) }}ms</strong>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <div class="detail-cell">
            <span>Render cause</span>
            <strong>{{ causeLabel(dominantCause()) }}</strong>
          </div>
          <div class="detail-cell">
            <span>Trigger source</span>
            <strong>{{ triggerSource() }}</strong>
          </div>
          <div class="detail-cell">
            <span>Parent cascade</span>
            <strong [ngClass]="cascadeClass()">{{ cascadeIndicator() }}</strong>
          </div>
        </div>

        <div class="border border-gray-800 rounded bg-gray-800/45 p-3 mb-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <span class="text-[10px] text-gray-400 uppercase font-bold">Cause evidence</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded border" [ngClass]="confidenceClass()">
              {{ confidenceLabel() }} confidence
            </span>
          </div>

          <div class="space-y-2">
            @for (entry of causesBreakdown(); track entry.type) {
              <div>
                <div class="flex items-center justify-between gap-2 text-xs mb-1">
                  <span [ngClass]="entry.isDominant ? 'text-gray-100 font-semibold' : 'text-gray-400'">
                    {{ entry.label }}
                  </span>
                  <span class="text-gray-500">{{ entry.count }} renders</span>
                </div>
                <div class="h-1.5 bg-gray-900 rounded overflow-hidden">
                  <div
                    class="h-full rounded"
                    [ngClass]="causeBarClass(entry.type)"
                    [style.width.%]="entry.percent"
                  ></div>
                </div>
                @if (entry.source !== 'No source captured') {
                  <div class="text-[10px] text-gray-500 mt-1">Source: {{ entry.source }}</div>
                }
              </div>
            }
          </div>
        </div>

        <div class="border border-gray-800 rounded bg-gray-800/45 p-3">
          <span class="text-[10px] text-gray-400 uppercase font-bold block mb-1">Likely fix</span>
          <p class="text-xs text-gray-200 leading-relaxed">{{ suggestedFix() }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-cell {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
    }

    .detail-cell span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
    }

    .detail-cell strong {
      display: block;
      color: #f3f4f6;
      font-size: 13px;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `],
})
export class WhyPanelComponent {
  private readonly state = inject(PanelState);

  readonly componentDisplayName = computed(() =>
    displayName(this.state.selectedComponent() ?? '')
  );

  readonly selectedEvents = computed(() => {
    const selected = this.state.selectedComponent();
    if (!selected) return [];
    return this.state.renderEvents().filter(event => event.componentName === selected);
  });

  readonly selectedStats = computed<ComponentStats | null>(() => {
    const selected = this.state.selectedComponent();
    if (!selected) return null;
    return this.state.componentStats().find(stats => stats.componentName === selected) ?? null;
  });

  readonly recentRenderCount = computed(() => {
    const events = this.selectedEvents();
    if (events.length === 0) return 0;
    const latest = Math.max(...events.map(event => event.timestamp));
    const sixtySecondsAgo = latest - 60_000;
    return events.filter(event => event.timestamp >= sixtySecondsAgo).length;
  });

  readonly causesBreakdown = computed<CauseEntry[]>(() => {
    const stats = this.selectedStats();
    if (!stats) return [];

    const entries = Object.entries(stats.causesBreakdown) as [RenderCause['type'], number][];
    const maxCount = Math.max(...entries.map(([, count]) => count));
    const total = Math.max(entries.reduce((sum, [, count]) => sum + count, 0), 1);

    return entries
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        label: causeLabel(type),
        count,
        percent: Math.max(4, Math.round((count / total) * 100)),
        source: this.topSourceForCause(type),
        isDominant: count === maxCount && count > 0,
      }))
      .sort((a, b) => b.count - a.count);
  });

  readonly dominantCause = computed<RenderCause['type'] | null>(() => {
    const dominant = this.causesBreakdown().find(entry => entry.isDominant);
    return dominant?.type ?? null;
  });

  readonly triggerSource = computed(() => {
    const dominant = this.dominantCause();
    if (!dominant) return 'No source captured';
    return this.topSourceForCause(dominant);
  });

  readonly cascadeIndicator = computed(() => {
    const stats = this.selectedStats();
    if (!stats) return 'No render data';
    const total = Math.max(Object.values(stats.causesBreakdown).reduce((sum, count) => sum + count, 0), 1);
    const parentCount = stats.causesBreakdown.parent;
    if (parentCount === 0) return 'Not observed';
    const percent = Math.round((parentCount / total) * 100);
    return `${parentCount} render(s), ${percent}%`;
  });

  readonly suggestedFix = computed(() => {
    const cause = this.dominantCause();
    const stats = this.selectedStats();
    return getSuggestedFix(cause, stats);
  });

  readonly renderExplanation = computed(() => {
    const stats = this.selectedStats();
    if (!stats) return 'Select a rendered component to inspect cause evidence.';
    return `${stats.renderCount} renders at ${stats.rendersPerMinute.toFixed(1)}/min, mostly from ${causeLabel(this.dominantCause())}.`;
  });

  readonly confidenceLabel = computed(() => {
    const events = this.selectedEvents();
    const dominant = this.causesBreakdown()[0];
    if (!dominant) return 'Heuristic';
    if (events.length >= 10 && dominant.percent >= 60) return 'High';
    if (events.length >= 3) return 'Medium';
    return 'Heuristic';
  });

  dismiss(): void {
    this.state.selectedComponent.set(null);
  }

  causeLabel(cause: RenderCause['type'] | null): string {
    return causeLabel(cause);
  }

  cascadeClass(): string {
    const stats = this.selectedStats();
    if (!stats || stats.causesBreakdown.parent === 0) return 'text-green-300';
    return stats.causesBreakdown.parent >= 5 ? 'text-amber-300' : 'text-gray-200';
  }

  confidenceClass(): string {
    switch (this.confidenceLabel()) {
      case 'High': return 'text-green-300 bg-green-500/15 border-green-500/30';
      case 'Medium': return 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30';
      default: return 'text-amber-300 bg-amber-500/15 border-amber-500/30';
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

  private topSourceForCause(type: RenderCause['type']): string {
    const counts = new Map<string, number>();
    for (const event of this.selectedEvents()) {
      for (const cause of event.causes) {
        if (cause.type !== type || !cause.source) continue;
        counts.set(cause.source, (counts.get(cause.source) ?? 0) + 1);
      }
    }

    let topSource = '';
    let topCount = 0;
    for (const [source, count] of counts) {
      if (count > topCount) {
        topSource = source;
        topCount = count;
      }
    }

    return topSource || 'No source captured';
  }
}

function causeLabel(cause: RenderCause['type'] | null): string {
  switch (cause) {
    case 'zone': return 'Async/DOM event';
    case 'parent': return 'Parent cascade';
    case 'input': return 'Input changed';
    case 'signal': return 'Signal update';
    case 'manual-cd': return 'Manual change detection';
    default: return 'Unknown cause';
  }
}

export function getSuggestedFix(
  dominantCause: RenderCause['type'] | null,
  stats?: ComponentStats | null
): string {
  if (stats?.rendersPerMinute && stats.rendersPerMinute > 100) {
    return 'This component renders very frequently. Check parent state churn, list trackBy coverage, and repeated async callbacks before micro-optimizing the template.';
  }

  switch (dominantCause) {
    case 'zone':
      return 'Move high-frequency event handlers, timers, or third-party callbacks outside Angular, then re-enter Angular only when UI state changes.';
    case 'parent':
      return 'Stabilize parent inputs, avoid recreating arrays or objects in templates, and consider OnPush for this component and its parent.';
    case 'input':
      return 'Find which input reference changes most often. Memoize derived arrays/objects or pass stable references when values have not changed.';
    case 'signal':
      return 'Review signal writes and computed signals so unchanged values are not emitted repeatedly into this component.';
    case 'manual-cd':
      return 'Audit detectChanges and markForCheck calls around this component and remove repeated manual change detection.';
    default:
      return 'Collect a few more interactions or inspect the component row in Render Inspector for stronger cause evidence.';
  }
}

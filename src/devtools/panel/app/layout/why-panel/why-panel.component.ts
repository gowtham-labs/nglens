import { Component, inject, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import type { RenderCause } from '../../../../../types/render-events';

@Component({
  selector: 'app-why-panel',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="h-full flex flex-col p-4 bg-gray-900">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-bold text-white">{{ componentDisplayName() }}</h2>
        <button
          class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          (click)="dismiss()"
        >✕ Dismiss</button>
      </div>

      <!-- Render count in last 60s -->
      <div class="bg-gray-800 rounded p-3 mb-4">
        <span class="text-[10px] text-gray-400 uppercase">Renders (last 60s)</span>
        <p class="text-lg font-bold text-white">{{ recentRenderCount() }}</p>
      </div>

      <!-- Causes breakdown -->
      <div class="bg-gray-800 rounded p-3 mb-4">
        <span class="text-[10px] text-gray-400 uppercase mb-2 block">Causes Breakdown</span>
        @for (entry of causesBreakdown(); track entry.type) {
          <div class="flex items-center gap-2 py-1">
            <span class="text-xs" [ngClass]="entry.isDominant ? 'text-green-400' : 'text-red-400'">
              {{ entry.isDominant ? '✓' : '✗' }}
            </span>
            <span class="text-xs text-gray-300 flex-1">{{ entry.type }}</span>
            <span class="text-xs text-gray-400">{{ entry.count }}</span>
          </div>
        }
      </div>

      <!-- Suggested fix -->
      <div class="bg-gray-800 rounded p-3">
        <span class="text-[10px] text-gray-400 uppercase mb-1 block">Suggested Fix</span>
        <p class="text-xs text-gray-200">{{ suggestedFix() }}</p>
      </div>
    </div>
  `,
})
export class WhyPanelComponent {
  private readonly state = inject(PanelState);

  readonly componentDisplayName = computed(() =>
    displayName(this.state.selectedComponent() ?? '')
  );

  readonly recentRenderCount = computed(() => {
    const selected = this.state.selectedComponent();
    if (!selected) return 0;
    const now = performance.now();
    const sixtySecondsAgo = now - 60_000;
    return this.state.renderEvents()
      .filter(e => e.componentName === selected && e.timestamp >= sixtySecondsAgo)
      .length;
  });

  readonly causesBreakdown = computed(() => {
    const selected = this.state.selectedComponent();
    if (!selected) return [];
    const stats = this.state.componentStats().find(s => s.componentName === selected);
    if (!stats) return [];

    const entries = Object.entries(stats.causesBreakdown) as [RenderCause['type'], number][];
    const maxCount = Math.max(...entries.map(([, count]) => count));

    return entries.map(([type, count]) => ({
      type,
      count,
      isDominant: count === maxCount && count > 0,
    }));
  });

  readonly dominantCause = computed(() => {
    const breakdown = this.causesBreakdown();
    const dominant = breakdown.find(e => e.isDominant);
    return dominant?.type ?? null;
  });

  readonly suggestedFix = computed(() => {
    return getSuggestedFix(this.dominantCause());
  });

  dismiss(): void {
    this.state.selectedComponent.set(null);
  }
}

export function getSuggestedFix(dominantCause: RenderCause['type'] | null): string {
  switch (dominantCause) {
    case 'zone': return 'Use OnPush change detection or runOutsideAngular for event handlers';
    case 'parent': return 'Use OnPush change detection and verify input bindings use immutable references';
    case 'input': return 'Verify parent component minimizes input reference changes';
    case 'signal': return 'Rendering is signal-driven — verify signal updates are necessary';
    case 'manual-cd': return 'Remove explicit detectChanges/markForCheck calls where possible';
    default: return 'No specific suggestion available';
  }
}

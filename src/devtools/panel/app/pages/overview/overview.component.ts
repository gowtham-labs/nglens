import { Component, inject, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="p-4 space-y-4">
      <!-- Connection status -->
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
          <span class="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
            Degraded
          </span>
        }
      </div>

      <!-- Metrics Bar: single row -->
      <div class="flex items-center gap-6 bg-gray-800 rounded px-4 py-3">
        <div class="flex flex-col">
          <span class="text-[10px] text-gray-400 uppercase font-medium">Issues</span>
          <span class="text-sm font-bold text-white">{{ issuesCount() }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-gray-400 uppercase font-medium">Components</span>
          <span class="text-sm font-bold text-white">{{ componentsCount() }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-gray-400 uppercase font-medium">Leaks</span>
          <span class="text-sm font-bold text-white">{{ leaksCount() }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-gray-400 uppercase font-medium">Recommendations</span>
          <span class="text-sm font-bold text-white">{{ recommendationsCount() }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-gray-400 uppercase font-medium">Hotspots</span>
          <span class="text-sm font-bold text-white">{{ hotspotsCount() }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] text-gray-400 uppercase font-medium">Interactions</span>
          <span class="text-sm font-bold text-white">{{ interactionsCount() }}</span>
        </div>
      </div>

      @if (state.latestComparison(); as comparison) {
        <div class="bg-gray-800 rounded px-4 py-3">
          <div class="flex items-center justify-between gap-3 mb-2">
            <span class="text-xs font-medium text-gray-300">Latest before / after</span>
            <span class="text-[10px] text-gray-500">
              {{ comparison.baseline.label }} → {{ comparison.current.label }}
            </span>
          </div>
          <div class="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span class="block text-[10px] text-gray-500 uppercase font-medium">Renders</span>
              <span [ngClass]="deltaClass(comparison.delta.renders)">{{ signed(comparison.delta.renders) }}</span>
            </div>
            <div>
              <span class="block text-[10px] text-gray-500 uppercase font-medium">Avg ms</span>
              <span [ngClass]="deltaClass(comparison.delta.averageRenderDuration)">
                {{ signed(comparison.delta.averageRenderDuration) }}
              </span>
            </div>
            <div>
              <span class="block text-[10px] text-gray-500 uppercase font-medium">Issues</span>
              <span [ngClass]="deltaClass(comparison.delta.issues)">{{ signed(comparison.delta.issues) }}</span>
            </div>
            <div>
              <span class="block text-[10px] text-gray-500 uppercase font-medium">Hotspots</span>
              <span [ngClass]="deltaClass(comparison.delta.hotspots)">{{ signed(comparison.delta.hotspots) }}</span>
            </div>
          </div>
        </div>
      }

      @if (topHotspot(); as hotspot) {
        <button
          (click)="state.selectedComponent.set(hotspot.componentName)"
          class="w-full text-left bg-gray-800 rounded px-4 py-3 hover:bg-gray-750 transition-colors">
          <div class="flex items-center gap-3">
            <div class="text-lg font-bold" [ngClass]="scoreClass(hotspot.score)">{{ hotspot.score }}</div>
            <div class="min-w-0">
              <div class="text-xs font-medium text-gray-300 truncate">Top hotspot: {{ hotspot.componentName }}</div>
              <div class="text-xs text-gray-500 truncate">{{ hotspot.reasons.join(', ') }}</div>
            </div>
          </div>
        </button>
      }
    </div>
  `,
})
export class OverviewComponent {
  readonly state = inject(PanelState);

  readonly issuesCount = computed(() => this.state.allIssues().length);
  readonly componentsCount = computed(() => this.state.componentStats().length);
  readonly leaksCount = computed(() => this.state.leakEvents().length);
  readonly recommendationsCount = computed(() =>
    this.state.trackByIssues().length +
    this.state.onPushRecommendations().filter(r => r.score > 70).length
  );
  readonly hotspotsCount = computed(() => this.state.componentHotspots().filter(h => h.score >= 70).length);
  readonly interactionsCount = computed(() => this.state.interactionProfiles().length);
  readonly topHotspot = computed(() => this.state.componentHotspots()[0] ?? null);

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
    return 'text-green-400';
  }
}

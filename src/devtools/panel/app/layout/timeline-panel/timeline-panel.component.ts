import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';

@Component({
  selector: 'app-timeline-panel',
  standalone: true,
  template: `
    <div class="h-full flex flex-col bg-gray-900">
      <div class="px-3 py-1.5 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <span class="text-xs font-medium text-gray-400 uppercase">Activity</span>
        <span class="text-[10px] text-gray-500">{{ recentEvents().length }} renders</span>
      </div>
      @if (recentEvents().length === 0) {
        <div class="flex-1 flex items-center justify-center text-gray-500 text-xs">
          Interact with the page to see render activity
        </div>
      } @else {
        <div class="flex-1 overflow-y-scroll">
          @for (event of recentEvents(); track $index) {
            <div class="px-3 py-1.5 border-b border-gray-800">
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-gray-600 w-10 flex-shrink-0">{{ getRelativeTime(event.timestamp) }}</span>
                <span class="text-xs text-gray-200 font-medium truncate">{{ displayName(event.componentName) }}</span>
              </div>
              <div class="pl-12">
                <span class="text-[10px] text-gray-400">Cause: {{ formatCauseExplanation(event.causes[0]?.type, event.causes[0]?.source) }}</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TimelinePanelComponent implements OnInit, OnDestroy {
  private readonly state = inject(PanelState);
  readonly displayName = displayName;

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private readonly tick = signal(0);

  /** Show last 100 events, newest first — a simple chronological log */
  recentEvents = computed(() => {
    this.tick();
    const events = this.state.renderEvents();
    // Newest first, cap at 100 for performance
    return [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  });

  ngOnInit(): void {
    this.refreshInterval = setInterval(() => this.tick.update(v => v + 1), 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  getRelativeTime(timestamp: number): string {
    const diffMs = performance.now() - timestamp;
    if (diffMs < 1000) return 'now';
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
    return `${Math.floor(diffMs / 3600000)}h`;
  }

  formatCauseExplanation(type?: string, source?: string): string {
    if (!type) return 'unknown';
    // Source-based matches take priority
    if (source) {
      if (source.includes('setTimeout') || source.includes('setInterval')) return 'timer callback';
      if (source.includes('fetch') || source.includes('XMLHttpRequest')) return 'HTTP response';
      if (source.includes('addEventListener:click')) return 'click event';
      if (source.includes('addEventListener:scroll')) return 'scroll event';
      if (source.includes('addEventListener:input')) return 'input event';
    }
    // Type-based fallback
    switch (type) {
      case 'input': return 'parent input changed';
      case 'parent': return 'parent re-rendered';
      case 'signal': return 'signal updated';
      case 'zone': return 'zone triggered';
      case 'manual-cd': return 'manual change detection';
      default: return type;
    }
  }
}

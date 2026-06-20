import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { RenderEvent, RenderCause } from '../../../../../types/render-events';
import { displayName } from '../../utils/display-name';

interface TimelineRow {
  componentName: string;
  events: TimelineEvent[];
  totalRenders: number;
  totalDuration: number;
}

interface TimelineEvent {
  timestamp: number;
  duration: number;
  causes: RenderCause[];
  index: number;
}

@Component({
  selector: 'app-render-flame-graph',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Render Flame Graph</h3>
          <p class="text-xs text-gray-400 mt-1">Timeline view of all render events by component</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="timeWindow.set(5000)"
            [ngClass]="timeWindow() === 5000 ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            5s
          </button>
          <button
            (click)="timeWindow.set(10000)"
            [ngClass]="timeWindow() === 10000 ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            10s
          </button>
          <button
            (click)="timeWindow.set(30000)"
            [ngClass]="timeWindow() === 30000 ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            30s
          </button>
          <button
            (click)="timeWindow.set(0)"
            [ngClass]="timeWindow() === 0 ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            All
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-4 gap-3 text-xs">
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Total Renders</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().totalRenders }}</div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Components</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().uniqueComponents }}</div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Avg Duration</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().avgDuration.toFixed(2) }}<span class="text-xs">ms</span></div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Max Duration</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().maxDuration.toFixed(2) }}<span class="text-xs">ms</span></div>
        </div>
      </div>

      <!-- Timeline Header -->
      <div class="text-xs text-gray-400 px-2 mb-2">
        <div class="flex gap-2">
          <span class="w-32">Component</span>
          <span class="flex-1">Timeline ({{ formatTimeRange() }})</span>
        </div>
      </div>

      <!-- Flame Graph -->
      <div class="space-y-1 max-h-96 overflow-auto bg-gray-900/30 rounded p-2">
        @if (timelineRows().length === 0) {
          <div class="text-sm text-gray-500 p-8 text-center">
            <div class="text-gray-600 mb-1">📊</div>
            No render events captured yet. Start tracking to see flame graph.
          </div>
        } @else {
          @for (row of timelineRows(); track row.componentName) {
            <div class="flex gap-2 items-start py-2 hover:bg-gray-700/30 rounded px-2 transition-colors group">
              <!-- Component Name -->
              <div class="w-32 flex-shrink-0">
                <div class="text-xs font-medium text-gray-300 truncate">{{ displayName(row.componentName) }}</div>
                <div class="text-[10px] text-gray-500">{{ row.totalRenders }} renders, {{ row.totalDuration.toFixed(1) }}ms</div>
              </div>

              <!-- Timeline Bars -->
              <div class="flex-1 relative h-6 bg-gray-800/50 rounded border border-gray-700/50 min-w-0">
                @for (event of row.events; track event.timestamp) {
                  <div
                    class="absolute h-5 top-0.5 rounded shadow-sm hover:shadow-md transition-all cursor-pointer"
                    [style.left.%]="getPositionPercent(event.timestamp)"
                    [style.width.%]="getWidthPercent(event.duration)"
                    [ngClass]="getDurationClass(event.duration)"
                    [title]="getEventTooltip(event)"
                  >
                    <span class="text-[10px] text-white/70 px-1 truncate inline-block w-full">
                      {{ event.duration.toFixed(1) }}ms
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>

      <!-- Legend -->
      <div class="grid grid-cols-5 gap-2 text-xs pt-4 border-t border-gray-700">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded bg-green-500/80"></div>
          <span class="text-gray-400">&lt;2ms</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded bg-yellow-500/80"></div>
          <span class="text-gray-400">2-5ms</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded bg-orange-500/80"></div>
          <span class="text-gray-400">5-10ms</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded bg-red-500/80"></div>
          <span class="text-gray-400">&gt;10ms</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-gray-600"></div>
          <span class="text-gray-400">Jank threshold (16ms)</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class RenderFlameGraphComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;

  readonly timeWindow = signal<number>(10000); // milliseconds, 0 = all

  readonly timelineRows = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) return [];

    const window = this.timeWindow();
    let filteredEvents = events;

    if (window > 0 && events.length > 0) {
      const latestEvent = events[events.length - 1];
      const cutoff = latestEvent.timestamp - window;
      filteredEvents = events.filter(e => e.timestamp >= cutoff);
    }

    // Group by component name
    const grouped = new Map<string, TimelineEvent[]>();
    for (let i = 0; i < filteredEvents.length; i++) {
      const event = filteredEvents[i];
      if (!grouped.has(event.componentName)) {
        grouped.set(event.componentName, []);
      }
      grouped.get(event.componentName)!.push({
        timestamp: event.timestamp,
        duration: event.duration,
        causes: event.causes,
        index: i,
      });
    }

    // Convert to rows sorted by total duration (descending)
    const rows: TimelineRow[] = [];
    for (const [componentName, rowEvents] of grouped) {
      const totalDuration = rowEvents.reduce((sum, e) => sum + e.duration, 0);
      rows.push({
        componentName,
        events: rowEvents,
        totalRenders: rowEvents.length,
        totalDuration,
      });
    }

    return rows.sort((a, b) => b.totalDuration - a.totalDuration);
  });

  readonly stats = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) {
      return {
        totalRenders: 0,
        uniqueComponents: 0,
        avgDuration: 0,
        maxDuration: 0,
      };
    }

    const uniqueComponents = new Set(events.map(e => e.componentName)).size;
    const durations = events.map(e => e.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    return {
      totalRenders: events.length,
      uniqueComponents,
      avgDuration,
      maxDuration,
    };
  });

  getPositionPercent(timestamp: number): number {
    const events = this.state.renderEvents();
    if (events.length === 0) return 0;

    const window = this.timeWindow();
    let minTime: number, maxTime: number;

    if (window > 0) {
      const latestEvent = events[events.length - 1];
      minTime = Math.max(0, latestEvent.timestamp - window);
      maxTime = latestEvent.timestamp;
    } else {
      minTime = events[0].timestamp;
      maxTime = events[events.length - 1].timestamp;
    }

    const range = maxTime - minTime;
    if (range === 0) return 0;

    return ((timestamp - minTime) / range) * 100;
  }

  getWidthPercent(duration: number): number {
    const events = this.state.renderEvents();
    if (events.length === 0) return 0;

    const window = this.timeWindow();
    let maxDuration: number;

    if (window > 0) {
      maxDuration = window;
    } else {
      const latestEvent = events[events.length - 1];
      const oldestEvent = events[0];
      maxDuration = latestEvent.timestamp - oldestEvent.timestamp;
    }

    if (maxDuration === 0) return 0;

    // Cap width at 95% to show all bars
    return Math.min((duration / maxDuration) * 100, 95);
  }

  getDurationClass(duration: number): string {
    if (duration > 10) return 'bg-red-500/80';
    if (duration > 5) return 'bg-orange-500/80';
    if (duration > 2) return 'bg-yellow-500/80';
    return 'bg-green-500/80';
  }

  getEventTooltip(event: TimelineEvent): string {
    const causes = event.causes
      .map(c => (c.source ? `${c.type}(${c.source})` : c.type))
      .join(', ');
    const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3 as any,
    });
    return `${event.duration.toFixed(2)}ms @ ${time}\nCauses: ${causes}`;
  }

  formatTimeRange(): string {
    const window = this.timeWindow();
    if (window === 0) return 'All events';
    return `Last ${(window / 1000).toFixed(1)}s`;
  }
}

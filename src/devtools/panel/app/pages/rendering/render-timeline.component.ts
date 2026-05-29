import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { RenderEvent } from '../../../../../types/render-events';

@Component({
  selector: 'app-render-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Render Timeline</h3>
          <p class="text-xs text-gray-400 mt-1">Last 100 render events with detailed metrics</p>
        </div>
        <div class="flex gap-1">
          <button (click)="zoomLevel.set(1)" [ngClass]="zoomLevel() === 1 ? 'bg-blue-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors">1m</button>
          <button (click)="zoomLevel.set(5)" [ngClass]="zoomLevel() === 5 ? 'bg-blue-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors">5m</button>
          <button (click)="zoomLevel.set(10)" [ngClass]="zoomLevel() === 10 ? 'bg-blue-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors">10m</button>
        </div>
      </div>

      <div class="space-y-1 max-h-80 overflow-auto bg-gray-900/30 rounded p-2">
        @if (timelineEvents().length === 0) {
          <div class="text-sm text-gray-500 p-8 text-center">
            <div class="text-gray-600 mb-1">⏱️</div>
            No render events captured yet. Start tracking to see timeline.
          </div>
        } @else {
          @for (event of timelineEvents(); track event.timestamp) {
            <div
              class="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-gray-700/50 transition-colors group cursor-pointer"
              [title]="eventDescription(event)"
            >
              <span class="text-gray-600 w-16 font-mono text-right">{{ formatTime(event.timestamp) }}</span>
              <div class="flex-1 flex items-center gap-2 min-w-0">
                <div
                  class="h-2.5 rounded-full shadow-sm"
                  [style.width.%]="getBarWidth(event.duration)"
                  [ngClass]="getEventColor(event)"
                ></div>
                <span class="text-gray-300 flex-1 truncate font-medium group-hover:text-gray-100">{{ event.componentName }}</span>
              </div>
              <span class="text-gray-500 font-mono w-14 text-right">{{ event.duration.toFixed(2) }}ms</span>
              <span
                class="text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
                [ngClass]="getCauseColor(event.causes[0]?.type)"
              >
                {{ event.causes[0]?.type || 'unknown' }}
              </span>
            </div>
          }
        }
      </div>

      <div class="mt-4 pt-4 border-t border-gray-700 grid grid-cols-4 gap-3 text-xs">
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Total</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().total }}</div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Avg</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().avg.toFixed(1) }}<span class="text-xs">ms</span></div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Max</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().max.toFixed(1) }}<span class="text-xs">ms</span></div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Min</div>
          <div class="text-lg font-semibold text-gray-100">{{ stats().min.toFixed(1) }}<span class="text-xs">ms</span></div>
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
export class RenderTimelineComponent {
  readonly state = inject(PanelState);
  readonly zoomLevel = signal<number>(5);

  readonly timelineEvents = computed(() => {
    const events = this.state.renderEvents().slice(0, 100); // Last 100 events
    const zoom = this.zoomLevel();
    // Group events by zoom level if needed
    return events;
  });

  readonly stats = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) {
      return { total: 0, avg: 0, max: 0, min: 0 };
    }

    const durations = events.map(e => e.duration);
    const total = events.length;
    const avg = durations.reduce((a, b) => a + b, 0) / total;
    const max = Math.max(...durations);
    const min = Math.min(...durations);

    return { total, avg, max, min };
  });

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  getBarWidth(duration: number): number {
    // Scale bar width based on duration (max 100px = 100%)
    return Math.min((duration / 10) * 100, 100);
  }

  getEventColor(event: RenderEvent): string {
    const duration = event.duration;
    if (duration > 10) return 'bg-red-500/80';
    if (duration > 5) return 'bg-orange-500/80';
    if (duration > 2) return 'bg-yellow-500/80';
    return 'bg-green-500/80';
  }

  getCauseColor(cause: string | undefined): string {
    if (!cause) return 'bg-gray-700 text-gray-300';
    switch (cause) {
      case 'input':
        return 'bg-blue-900/60 text-blue-200';
      case 'signal':
        return 'bg-purple-900/60 text-purple-200';
      case 'zone':
        return 'bg-red-900/60 text-red-200';
      case 'parent':
        return 'bg-green-900/60 text-green-200';
      case 'manual-cd':
        return 'bg-orange-900/60 text-orange-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  }

  eventDescription(event: RenderEvent): string {
    const causes = event.causes.map(c => c.source ? `${c.type}(${c.source})` : c.type).join(', ');
    return `${event.componentName} - ${event.duration.toFixed(2)}ms - Causes: ${causes}`;
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { RenderEvent, RenderCause } from '../../../../../types/render-events';

interface RenderCascade {
  root: string;
  depth: number;
  children: string[];
  totalComponents: number;
  totalDuration: number;
  causedBy?: RenderCause;
}

@Component({
  selector: 'app-render-cascade',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Render Cascade</h3>
          <p class="text-xs text-gray-400 mt-1">Parent-child render propagation analysis</p>
        </div>
        <button
          (click)="showCascades.set(!showCascades())"
          [ngClass]="showCascades() ? 'bg-blue-600 text-gray-100' : 'bg-gray-700 text-gray-300'"
          class="text-xs px-3 py-1.5 rounded font-medium">{{ showCascades() ? '▼ Showing' : '▶ Hidden' }}</button>
      </div>

      @if (cascades().length === 0) {
        <div class="text-sm text-gray-500 p-8 text-center rounded bg-gray-900/30">
          <div class="text-gray-600 mb-1">✓</div>
          No render cascades detected. Components render independently.
        </div>
      } @else {
        @if (showCascades()) {
          <div class="space-y-3 max-h-96 overflow-auto">
            @for (cascade of cascades(); track cascade.root) {
              <div class="p-3 rounded border border-gray-600/50 bg-gray-900/40 hover:bg-gray-900/60 transition-colors">
                <!-- Root cause -->
                <div class="flex items-start gap-3 mb-2">
                  <div class="flex-1">
                    <div class="font-semibold text-gray-100">{{ cascade.root }}</div>
                    <div class="text-xs text-gray-400 mt-0.5">
                      Triggered {{ cascade.children.length }} child render{{ cascade.children.length !== 1 ? 's' : '' }}
                    </div>
                  </div>
                  <span
                    class="text-[10px] px-2.5 py-1 rounded font-semibold whitespace-nowrap"
                    [ngClass]="getCauseColor(cascade.causedBy?.type)"
                  >
                    {{ cascade.causedBy?.type || 'unknown' }}
                  </span>
                </div>

                <!-- Tree view -->
                <div class="ml-3 space-y-2">
                  <!-- Stats -->
                  <div class="text-xs text-gray-400 space-x-3 flex">
                    <span>
                      <strong class="text-gray-300">{{ cascade.children.length }}</strong> children
                    </span>
                    <span>•</span>
                    <span>
                      Depth: <strong class="text-gray-300">{{ cascade.depth }}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      <strong class="text-gray-300">{{ cascade.totalDuration.toFixed(1) }}</strong>ms total
                    </span>
                  </div>

                  <!-- Children tree -->
                  @if (cascade.children.length > 0) {
                    <div class="font-mono text-xs space-y-1 ml-2 pt-1 border-l border-gray-600/50 pl-2">
                      @for (child of cascade.children; track child; let last = $last) {
                        <div class="flex items-center gap-1 text-gray-400 hover:text-gray-300 transition-colors">
                          <span class="text-gray-600">{{ last ? '└──' : '├──' }}</span>
                          <span class="text-gray-300">{{ child }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Warning if deep -->
                @if (cascade.depth > 5) {
                  <div class="mt-2 p-2 rounded bg-orange-900/40 border border-orange-800/50 text-xs text-orange-300">
                    <span class="font-semibold">⚠ Deep cascade:</span> {{ cascade.depth }} levels deep. Consider OnPush to break the chain.
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Summary stats -->
        <div class="mt-4 pt-4 border-t border-gray-700 grid grid-cols-3 gap-3 text-xs">
          <div class="p-2 rounded bg-gray-700/40">
            <div class="text-gray-400 mb-1">Most Impacted</div>
            <div class="font-semibold text-gray-100 truncate">{{ getMostImpacted() || 'N/A' }}</div>
          </div>
          <div class="p-2 rounded bg-gray-700/40">
            <div class="text-gray-400 mb-1">Deepest Cascade</div>
            <div class="font-semibold text-gray-100">{{ getDeepestCascade() }} levels</div>
          </div>
          <div class="p-2 rounded bg-gray-700/40">
            <div class="text-gray-400 mb-1">Cascades</div>
            <div class="font-semibold text-gray-100">{{ cascades().length }} detected</div>
          </div>
        </div>
      }
    </div>
  `,
})
export class RenderCascadeComponent {
  readonly state = inject(PanelState);
  readonly showCascades = signal(true);

  readonly cascades = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) return [];

    // Build cascades from event patterns
    const cascades: RenderCascade[] = [];

    // Group by timestamp windows (100ms) to detect cascades
    const windows = new Map<number, RenderEvent[]>();
    for (const event of events) {
      const windowKey = Math.floor(event.timestamp / 100);
      if (!windows.has(windowKey)) {
        windows.set(windowKey, []);
      }
      windows.get(windowKey)!.push(event);
    }

    // Analyze each window for cascades
    for (const [, windowEvents] of windows) {
      if (windowEvents.length > 1) {
        // Multiple components rendered in same window - potential cascade
        const root = windowEvents[0];
        const children = windowEvents.slice(1).map(e => e.componentName);
        const totalDuration = windowEvents.reduce((sum, e) => sum + e.duration, 0);

        cascades.push({
          root: root.componentName,
          depth: 2, // Simple depth for now
          children,
          totalComponents: windowEvents.length,
          totalDuration,
          causedBy: root.causes[0],
        });
      }
    }

    return cascades.slice(0, 10); // Limit to top 10
  });

  getCauseColor(type?: string): string {
    if (!type) return 'bg-gray-700 text-gray-300';
    switch (type) {
      case 'input':
        return 'bg-blue-900/60 text-blue-200';
      case 'signal':
        return 'bg-purple-900/60 text-purple-200';
      case 'zone':
        return 'bg-red-900/60 text-red-200';
      case 'parent':
        return 'bg-green-900/60 text-green-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  }

  getMostImpacted(): string | null {
    const cascades = this.cascades();
    if (cascades.length === 0) return null;
    return cascades.reduce((max, c) => (c.totalComponents > max.totalComponents ? c : max)).root;
  }

  getDeepestCascade(): number {
    const cascades = this.cascades();
    if (cascades.length === 0) return 0;
    return Math.max(...cascades.map(c => c.depth));
  }
}

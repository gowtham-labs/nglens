import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { LeakEvent } from '../../../../../types/leak-events';

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <!-- Summary -->
      <section class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm">
        <h2 class="text-sm font-semibold text-gray-100 mb-4">Memory Leak Detection</h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="p-4 rounded-lg border border-red-800/50 bg-red-900/30">
            <div class="text-xs text-gray-400 mb-2 uppercase font-semibold">Total Leaks</div>
            <div class="text-3xl font-bold text-red-300">{{ state.leakEvents().length }}</div>
            <div class="text-xs text-red-400/80 mt-1">detected</div>
          </div>

          <div class="p-4 rounded-lg border border-gray-600/50 bg-gray-700/30">
            <div class="text-xs text-gray-400 mb-2 uppercase font-semibold">Subscription Leaks</div>
            <div class="text-3xl font-bold text-gray-100">{{ getLeaksByType('subscription').length }}</div>
            <div class="text-xs text-gray-500 mt-1">unclean subscriptions</div>
          </div>

          <div class="p-4 rounded-lg border border-gray-600/50 bg-gray-700/30">
            <div class="text-xs text-gray-400 mb-2 uppercase font-semibold">Timer/Listener Leaks</div>
            <div class="text-3xl font-bold text-gray-100">{{ getLeaksByType('timer').length + getLeaksByType('listener').length }}</div>
            <div class="text-xs text-gray-500 mt-1">timers & listeners</div>
          </div>
        </div>
      </section>

      <!-- Leak List -->
      @if (state.leakEvents().length === 0) {
        <div class="border border-green-800/50 rounded-lg p-8 bg-green-900/20 text-center">
          <div class="text-2xl mb-2">✓</div>
          <div class="text-green-300 font-semibold mb-1">No Leaks Detected</div>
          <div class="text-xs text-gray-400">All components are properly cleaning up resources</div>
        </div>
      } @else {
        <section class="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/40 backdrop-blur-sm">
          <div class="px-4 py-3 border-b border-gray-700 bg-gray-900/60">
            <h3 class="text-sm font-semibold text-gray-100">Detected Leaks</h3>
            <p class="text-xs text-gray-400 mt-1">{{ state.leakEvents().length }} resource(s) not cleaned up</p>
          </div>

          <div class="divide-y divide-gray-700 max-h-96 overflow-auto">
            @for (event of state.leakEvents(); track event.id) {
              <div
                class="px-4 py-3 hover:bg-gray-700/30 cursor-pointer transition-colors group"
                (click)="selectLeak(event)"
                [ngClass]="state.selectedIssue()?.id === event.id ? 'bg-gray-700/20' : ''"
              >
                <div class="flex items-start gap-3">
                  <span
                    class="text-xs font-bold px-2 py-1 rounded whitespace-nowrap mt-0.5 group-hover:scale-105 transition-transform"
                    [ngClass]="getSeverityClass(event.severity)"
                  >
                    {{ event.severity | uppercase }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-100 group-hover:text-gray-50 transition-colors">{{ event.componentName }}</div>
                    <div class="text-xs text-gray-400 mt-1 space-x-2">
                      <span class="inline">
                        <strong class="text-gray-300">Type:</strong> {{ event.leakType }}
                      </span>
                      <span class="inline">
                        <strong class="text-gray-300">Source:</strong> {{ event.source }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-500 mt-2">
                      Unclean resource after component destruction
                    </div>
                  </div>
                  <span class="text-[10px] text-gray-500 whitespace-nowrap mt-0.5">
                    {{ formatTime(event.detectedAt) }}
                  </span>
                </div>

                <!-- Recommendation -->
                <div class="mt-3 p-2 rounded bg-gray-900/60 text-xs text-gray-300 border border-gray-600/30 group-hover:border-gray-600/50 transition-colors">
                  <div class="font-semibold text-gray-200 mb-1">💡 Fix:</div>
                  {{ getLeakFix(event.leakType) }}
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- Quick Tips -->
      <section class="border border-blue-700/50 rounded-lg p-4 bg-blue-900/20 backdrop-blur-sm">
        <h3 class="text-xs font-semibold text-blue-300 mb-3 uppercase">Prevention Tips</h3>
        <ul class="space-y-2.5 text-xs text-gray-300">
          <li class="flex gap-2">
            <span class="text-blue-400 font-bold">•</span>
            <span>Use <code class="bg-gray-800/60 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[10px]">takeUntilDestroyed()</code> for subscriptions in standalone components</span>
          </li>
          <li class="flex gap-2">
            <span class="text-blue-400 font-bold">•</span>
            <span>Always unsubscribe in <code class="bg-gray-800/60 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[10px]">ngOnDestroy</code> or use <code class="bg-gray-800/60 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[10px]">takeUntil()</code></span>
          </li>
          <li class="flex gap-2">
            <span class="text-blue-400 font-bold">•</span>
            <span>Remove event listeners: <code class="bg-gray-800/60 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[10px]">removeEventListener()</code> in cleanup</span>
          </li>
          <li class="flex gap-2">
            <span class="text-blue-400 font-bold">•</span>
            <span>Clear timers: <code class="bg-gray-800/60 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[10px]">clearTimeout/clearInterval()</code></span>
          </li>
        </ul>
      </section>
    </div>
  `,
  styles: [`
    code {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
    }
  `],
})
export class MemoryComponent {
  readonly state = inject(PanelState);

  getLeaksByType(type: string): LeakEvent[] {
    return this.state.leakEvents().filter(e => e.leakType === type);
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'bg-red-600/80 text-white';
      case 'high':
        return 'bg-orange-600/80 text-white';
      case 'medium':
        return 'bg-yellow-600/80 text-white';
      default:
        return 'bg-gray-600 text-gray-100';
    }
  }

  getLeakFix(leakType: string): string {
    switch (leakType) {
      case 'subscription':
        return 'Use `takeUntilDestroyed()` or `takeUntil()` with ngOnDestroy cleanup';
      case 'timer':
        return 'Call `clearTimeout()` or `clearInterval()` in ngOnDestroy';
      case 'listener':
        return 'Use `removeEventListener()` in ngOnDestroy';
      case 'interval':
        return 'Clear the interval handle before component destruction';
      default:
        return 'Ensure all resources are properly cleaned up before component destruction';
    }
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  selectLeak(event: LeakEvent): void {
    const leakType = event.leakType.charAt(0).toUpperCase() + event.leakType.slice(1);
    this.state.selectedIssue.set({
      id: event.id,
      type: 'leak',
      componentName: event.componentName,
      severity: event.severity,
      title: `${leakType} leak in ${event.componentName}`,
      description: `Unclean ${event.leakType} from "${event.source}" detected after component destruction. This can cause memory buildup over time.`,
      timestamp: event.detectedAt,
    });
  }
}

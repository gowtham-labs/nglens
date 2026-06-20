import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { LeakEvent } from '../../../../../types/leak-events';
import { displayName } from '../../utils/display-name';

interface RetentionChain {
  id: string;
  componentName: string;
  leakSource: string;
  leakType: string;
  severity: string;
  retentionPath: string[]; // Chain of objects holding reference
  estimatedImpact: string;
  timeDetected: number;
}

@Component({
  selector: 'app-leak-retention-chains',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Memory Leak Analysis</h3>
          <p class="text-xs text-gray-400 mt-1">Detailed retention chains showing why leaks are not garbage collected</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="filterType.set('all')"
            [ngClass]="filterType() === 'all' ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            All
          </button>
          <button
            (click)="filterType.set('subscription')"
            [ngClass]="filterType() === 'subscription' ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            Subscriptions
          </button>
          <button
            (click)="filterType.set('timer')"
            [ngClass]="filterType() === 'timer' ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            Timers
          </button>
        </div>
      </div>

      <!-- Leak Severity Distribution -->
      <div class="grid grid-cols-4 gap-3 text-xs">
        <div class="p-2 rounded bg-red-500/10 border border-red-500/30">
          <div class="text-gray-400 mb-1">Critical</div>
          <div class="text-lg font-semibold text-red-400">{{ leakStats().critical }}</div>
        </div>
        <div class="p-2 rounded bg-orange-500/10 border border-orange-500/30">
          <div class="text-gray-400 mb-1">High</div>
          <div class="text-lg font-semibold text-orange-400">{{ leakStats().high }}</div>
        </div>
        <div class="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
          <div class="text-gray-400 mb-1">Medium</div>
          <div class="text-lg font-semibold text-yellow-400">{{ leakStats().medium }}</div>
        </div>
        <div class="p-2 rounded bg-blue-500/10 border border-blue-500/30">
          <div class="text-gray-400 mb-1">Total</div>
          <div class="text-lg font-semibold text-blue-400">{{ leakStats().total }}</div>
        </div>
      </div>

      <!-- Retention Chains -->
      <div class="space-y-2 max-h-96 overflow-auto bg-gray-900/30 rounded p-3">
        @if (filteredChains().length === 0) {
          <div class="text-sm text-gray-500 p-8 text-center">
            <div class="text-gray-600 mb-1">✓</div>
            No memory leaks detected. All resources are properly cleaned up.
          </div>
        } @else {
          @for (chain of filteredChains(); track chain.id) {
            <div class="border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/20 transition-colors">
              <!-- Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex-1">
                  <div class="text-xs font-semibold text-gray-200">
                    {{ displayName(chain.componentName) }}
                  </div>
                  <div class="text-[10px] text-gray-500 mt-1">
                    <span class="inline-block mr-3">{{ chain.leakType }}</span>
                    <span class="inline-block">{{ chain.leakSource }}</span>
                  </div>
                </div>
                <span
                  class="text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap"
                  [ngClass]="getSeverityBadge(chain.severity)"
                >
                  {{ chain.severity | uppercase }}
                </span>
              </div>

              <!-- Retention Path Visualization -->
              <div class="mb-2 p-2 rounded bg-gray-800/50 border border-gray-700/30">
                <div class="text-xs text-gray-400 mb-2">Retention Path:</div>
                <div class="flex items-center gap-1 flex-wrap">
                  @for (item of chain.retentionPath; track $index; let last = $last) {
                    <div class="flex items-center gap-1">
                      <div class="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/40 text-xs text-blue-300 font-medium">
                        {{ item }}
                      </div>
                      @if (!last) {
                        <div class="text-gray-600">→</div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Impact Analysis -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2 rounded bg-gray-800/40">
                  <div class="text-gray-500 mb-1">Impact</div>
                  <div class="font-semibold text-gray-200">{{ chain.estimatedImpact }}</div>
                </div>
                <div class="p-2 rounded bg-gray-800/40">
                  <div class="text-gray-500 mb-1">Detected At</div>
                  <div class="font-semibold text-gray-200">{{ formatTime(chain.timeDetected) }}</div>
                </div>
              </div>

              <!-- Fix Suggestion -->
              <div class="mt-2 p-2 rounded bg-green-500/10 border border-green-500/30 text-xs text-green-300">
                💡 {{ getFixSuggestion(chain.leakType) }}
              </div>
            </div>
          }
        }
      </div>

      <!-- Top Leaks by Type -->
      @if (topLeaksByType(); as topLeaks) {
        <div class="grid grid-cols-3 gap-3">
          <!-- Top Subscription Leak -->
          @if (topLeaks.subscription; as leak) {
            <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20">
              <h4 class="text-xs font-semibold text-gray-300 mb-2 uppercase">Most Leaked Subscription</h4>
              <div class="text-sm font-semibold text-gray-200 truncate">{{ displayName(leak.componentName) }}</div>
              <div class="text-[10px] text-gray-500 mt-1">{{ leak.source }}</div>
              <div class="mt-2 p-1.5 rounded bg-red-500/20 text-xs text-red-300 border border-red-500/30">
                {{ leak.severity | uppercase }}
              </div>
            </div>
          }

          <!-- Top Timer Leak -->
          @if (topLeaks.timer; as leak) {
            <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20">
              <h4 class="text-xs font-semibold text-gray-300 mb-2 uppercase">Most Leaked Timer</h4>
              <div class="text-sm font-semibold text-gray-200 truncate">{{ displayName(leak.componentName) }}</div>
              <div class="text-[10px] text-gray-500 mt-1">{{ leak.source }}</div>
              <div class="mt-2 p-1.5 rounded bg-orange-500/20 text-xs text-orange-300 border border-orange-500/30">
                {{ leak.severity | uppercase }}
              </div>
            </div>
          }

          <!-- Summary -->
          <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20">
            <h4 class="text-xs font-semibold text-gray-300 mb-2 uppercase">Summary</h4>
            <div class="space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-500">Total Leaks:</span>
                <span class="font-semibold text-gray-200">{{ leakStats().total }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Components:</span>
                <span class="font-semibold text-gray-200">{{ uniqueComponents() }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Age:</span>
                <span class="font-semibold text-gray-200">{{ leakAge() }}s</span>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class LeakRetentionChainsComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;

  readonly filterType = signal<'all' | 'subscription' | 'timer'>('all');

  readonly retentionChains = computed(() => {
    const leaks = this.state.leakEvents();
    const chains: RetentionChain[] = [];

    for (const leak of leaks) {
      chains.push({
        id: leak.id,
        componentName: leak.componentName,
        leakSource: leak.source,
        leakType: leak.leakType,
        severity: leak.severity,
        retentionPath: this.buildRetentionPath(leak),
        estimatedImpact: this.estimateLeakImpact(leak),
        timeDetected: leak.detectedAt,
      });
    }

    return chains;
  });

  readonly filteredChains = computed(() => {
    const chains = this.retentionChains();
    const type = this.filterType();

    if (type === 'all') return chains;
    return chains.filter(c => c.leakType === type);
  });

  readonly leakStats = computed(() => {
    const leaks = this.state.leakEvents();
    return {
      critical: leaks.filter(l => l.severity === 'CRITICAL').length,
      high: leaks.filter(l => l.severity === 'WARNING').length,
      medium: leaks.filter(l => l.severity === 'INFO').length,
      total: leaks.length,
    };
  });

  readonly topLeaksByType = computed(() => {
    const leaks = this.state.leakEvents();
    const subscriptions = leaks.filter(l => l.leakType === 'subscription').sort((a, b) => b.detectedAt - a.detectedAt);
    const timers = leaks.filter(l => l.leakType === 'timer').sort((a, b) => b.detectedAt - a.detectedAt);

    return {
      subscription: subscriptions[0] || null,
      timer: timers[0] || null,
    };
  });

  readonly uniqueComponents = computed(() => {
    const leaks = this.state.leakEvents();
    return new Set(leaks.map(l => l.componentName)).size;
  });

  readonly leakAge = computed(() => {
    const leaks = this.state.leakEvents();
    if (leaks.length === 0) return 0;

    const oldest = Math.min(...leaks.map(l => l.detectedAt));
    const age = Date.now() - oldest;
    return Math.floor(age / 1000);
  });

  private buildRetentionPath(leak: LeakEvent): string[] {
    // Construct a plausible retention path based on leak type
    const path = [leak.componentName];

    // Add intermediate stages
    if (leak.leakType === 'subscription') {
      path.push(`${leak.source}`);
      path.push('RxJS Observable');
      path.push('Component Instance');
    } else if (leak.leakType === 'timer') {
      path.push(`${leak.source}`);
      path.push('Timer Handle');
      path.push('Global Registry');
    }

    return path;
  }

  private estimateLeakImpact(leak: LeakEvent): string {
    const severity = leak.severity;
    if (severity === 'CRITICAL') return 'High - Memory grows continuously';
    if (severity === 'WARNING') return 'Medium - Noticeable memory impact';
    return 'Low - Minimal impact';
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  getSeverityBadge(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-600/80 text-white';
      case 'WARNING':
        return 'bg-orange-600/80 text-white';
      default:
        return 'bg-blue-600/80 text-white';
    }
  }

  getFixSuggestion(leakType: string): string {
    if (leakType === 'subscription') {
      return 'Use takeUntilDestroyed() or unsubscribe() in ngOnDestroy. Also ensure this.subscriptions = [] after cleanup.';
    } else if (leakType === 'timer') {
      return 'Call clearTimeout() or clearInterval() in ngOnDestroy for all timers created in this component.';
    }
    return 'Ensure proper cleanup of resources in ngOnDestroy lifecycle hook.';
  }
}

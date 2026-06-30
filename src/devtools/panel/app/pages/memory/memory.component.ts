import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import type { LeakEvent } from '../../../../../types/leak-events';

type LeakType = LeakEvent['leakType'];
type ViewMode = 'live' | 'destroyed';

interface LiveComponent {
  name: string;
  displayName: string;
  subscriptions: number;
  timers: number;
  listeners: number;
  total: number;
  status: 'healthy' | 'at-risk';
  riskReason: string | null;
}

interface DestroyedComponent {
  name: string;
  displayName: string;
  leaked: LeakEvent[];
  leakedCount: number;
  cleanedCount: number;
  severity: 'CRITICAL' | 'WARNING';
}

@Component({
  selector: 'app-memory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="h-full overflow-auto">

      <!-- Status Bar -->
      <div class="sticky top-0 z-20 px-4 py-2.5 bg-gray-900/95 backdrop-blur border-b border-gray-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-semibold text-gray-100">Memory</h2>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="text-gray-500">{{ liveComponents().length }} active</span>
            <span class="text-gray-700">·</span>
            <span [ngClass]="destroyedWithLeaks().length > 0 ? 'text-red-400' : 'text-green-400'">
              {{ destroyedWithLeaks().length }} leaked
            </span>
          </div>
        </div>
        <div class="flex gap-1">
          <button (click)="viewMode.set('live')"
            class="text-[10px] px-2.5 py-1 rounded-full font-medium border transition-colors"
            [ngClass]="viewMode() === 'live'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'">
            Live View
          </button>
          <button (click)="viewMode.set('destroyed')"
            class="text-[10px] px-2.5 py-1 rounded-full font-medium border transition-colors"
            [ngClass]="viewMode() === 'destroyed'
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'">
            Leak Report
          </button>
        </div>
      </div>

      <!-- ═══ LIVE VIEW: What's running right now ═══ -->
      @if (viewMode() === 'live') {
        <div class="p-4 space-y-3">

          <!-- Health summary -->
          <div class="grid grid-cols-3 gap-3">
            <div class="px-3 py-2.5 rounded-lg border border-gray-700 bg-gray-800/40">
              <div class="text-[9px] text-gray-500 uppercase tracking-wide">Active Resources</div>
              <div class="text-xl font-bold text-gray-100 mt-1">{{ totalActiveResources() }}</div>
              <div class="text-[9px] text-gray-500 mt-0.5">subscriptions + timers + listeners</div>
            </div>
            <div class="px-3 py-2.5 rounded-lg border border-gray-700 bg-gray-800/40">
              <div class="text-[9px] text-gray-500 uppercase tracking-wide">Components at Risk</div>
              <div class="text-xl font-bold mt-1"
                   [ngClass]="atRiskCount() > 0 ? 'text-amber-400' : 'text-green-400'">
                {{ atRiskCount() }}
              </div>
              <div class="text-[9px] text-gray-500 mt-0.5">high resource count without cleanup</div>
            </div>
            <div class="px-3 py-2.5 rounded-lg border border-gray-700 bg-gray-800/40">
              <div class="text-[9px] text-gray-500 uppercase tracking-wide">Confirmed Leaks</div>
              <div class="text-xl font-bold mt-1"
                   [ngClass]="destroyedWithLeaks().length > 0 ? 'text-red-400' : 'text-green-400'">
                {{ destroyedWithLeaks().length }}
              </div>
              <div class="text-[9px] text-gray-500 mt-0.5">components destroyed without cleanup</div>
            </div>
          </div>

          <!-- What Junior sees: simple list of what's running -->
          <!-- What Senior sees: risk indicators per component -->
          <!-- What Architect sees: systemic patterns -->

          @if (liveComponents().length === 0) {
            <div class="rounded-lg border border-gray-700 p-6 text-center">
              <div class="text-2xl opacity-20 mb-2">🧹</div>
              <p class="text-sm text-gray-400">No active resources tracked yet.</p>
              <p class="text-[10px] text-gray-600 mt-1">Start recording and interact with the page to see live resources.</p>
            </div>
          } @else {
            <div class="space-y-1">
              @for (comp of liveComponents(); track comp.name) {
                <div class="flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors"
                     [ngClass]="comp.status === 'at-risk'
                       ? 'border-amber-800/40 bg-amber-950/20 hover:bg-amber-950/30'
                       : 'border-gray-800 bg-gray-800/30 hover:bg-gray-800/50'">
                  <!-- Status dot -->
                  <span class="w-2 h-2 rounded-full flex-shrink-0"
                        [ngClass]="comp.status === 'at-risk' ? 'bg-amber-500' : 'bg-green-500'"></span>
                  <!-- Component name -->
                  <span class="text-xs font-mono text-gray-200 flex-1 min-w-0 truncate">{{ comp.displayName }}</span>
                  <!-- Resource counts -->
                  @if (comp.subscriptions > 0) {
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/30">
                      {{ comp.subscriptions }} sub{{ comp.subscriptions > 1 ? 's' : '' }}
                    </span>
                  }
                  @if (comp.timers > 0) {
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/30">
                      {{ comp.timers }} timer{{ comp.timers > 1 ? 's' : '' }}
                    </span>
                  }
                  @if (comp.listeners > 0) {
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/30">
                      {{ comp.listeners }} listener{{ comp.listeners > 1 ? 's' : '' }}
                    </span>
                  }
                  <!-- Risk warning -->
                  @if (comp.riskReason) {
                    <span class="text-[9px] text-amber-400 flex-shrink-0">{{ comp.riskReason }}</span>
                  }
                </div>
              }
            </div>

            <!-- Architect insight: systemic pattern -->
            @if (systemicPattern()) {
              <div class="mt-3 px-4 py-3 rounded-lg border border-indigo-800/40 bg-indigo-950/20">
                <div class="flex items-start gap-2">
                  <span class="text-[10px] mt-0.5">🏗️</span>
                  <div>
                    <div class="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">Architecture Insight</div>
                    <p class="text-[11px] text-indigo-300 mt-0.5">{{ systemicPattern() }}</p>
                  </div>
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- ═══ LEAK REPORT: What leaked after navigation ═══ -->
      @if (viewMode() === 'destroyed') {
        <div class="p-4 space-y-3">

          @if (destroyedWithLeaks().length === 0) {
            <div class="rounded-lg border border-green-800/40 p-6 text-center bg-green-950/10">
              <div class="text-2xl opacity-30 mb-2">✓</div>
              <p class="text-sm text-green-300">No leaks detected</p>
              <p class="text-[10px] text-gray-500 mt-1">
                Navigate between pages while recording. Components that fail to clean up their resources will appear here.
              </p>
            </div>
          } @else {
            <!-- Leak explanation for junior developers -->
            <div class="px-3 py-2.5 rounded border border-gray-700 bg-gray-800/40 text-[10px] text-gray-400">
              <strong class="text-gray-300">What is a memory leak?</strong>
              A component was destroyed (navigated away) but its subscriptions or timers are still running in the background, consuming memory and CPU.
            </div>

            @for (comp of destroyedWithLeaks(); track comp.name) {
              <div class="rounded-lg border overflow-hidden"
                   [ngClass]="comp.severity === 'CRITICAL' ? 'border-red-800/50 bg-red-950/10' : 'border-amber-800/40 bg-amber-950/10'">
                <!-- Header -->
                <div class="px-4 py-3 flex items-center gap-3">
                  <span class="text-sm"
                        [ngClass]="comp.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'">⚠</span>
                  <div class="flex-1 min-w-0">
                    <span class="text-xs font-semibold text-gray-100">{{ comp.displayName }}</span>
                    <span class="text-[9px] text-gray-500 ml-2">destroyed but resources still active</span>
                  </div>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        [ngClass]="comp.severity === 'CRITICAL'
                          ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'">
                    {{ comp.leakedCount }} leaked
                  </span>
                </div>
                <!-- Leaked resources — grouped and collapsible -->
                <div class="border-t border-gray-800/50">
                  <button
                    class="w-full px-4 py-2 pl-10 flex items-center gap-2 text-[10px] hover:bg-gray-800/30 select-none"
                    (click)="toggleGroup(comp.name)">
                    <span class="text-gray-400">{{ isExpanded(comp.name) ? '▾' : '▸' }}</span>
                    <span class="text-gray-400">{{ comp.leakedCount }} resource{{ comp.leakedCount > 1 ? 's' : '' }} — click to expand</span>
                  </button>
                  @if (isExpanded(comp.name)) {
                    <div class="divide-y divide-gray-800/30">
                      @for (group of groupLeakEvents(comp.leaked); track group.key) {
                        <div class="px-4 py-2 pl-14 flex items-center gap-2 text-[10px]"
                             [title]="group.type + ': ' + group.source + ' (×' + group.count + ')'">
                          <span class="px-1.5 py-0.5 rounded font-medium border"
                                [ngClass]="group.type === 'subscription' ? 'text-purple-300 bg-purple-900/40 border-purple-700/30'
                                          : group.type === 'timer' ? 'text-amber-300 bg-amber-900/40 border-amber-700/30'
                                          : 'text-blue-300 bg-blue-900/40 border-blue-700/30'">
                            {{ group.type === 'subscription' ? 'Sub' : group.type === 'timer' ? 'Timer' : 'Listener' }}
                          </span>
                          <span class="text-gray-200 font-mono flex-1 truncate">{{ group.source }}</span>
                          @if (group.count > 1) {
                            <span class="text-gray-300 flex-shrink-0">×{{ group.count }}</span>
                          }
                          <span class="text-red-400 flex-shrink-0">still running</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    code {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 10px;
      color: #bfdbfe;
      background: rgb(17 24 39 / 0.75);
      border-radius: 3px;
      padding: 1px 4px;
    }
  `],
})
export class MemoryComponent {
  readonly state = inject(PanelState);
  readonly viewMode = signal<ViewMode>('destroyed');

  // ── Live View: components currently active with their resource counts ──

  readonly liveComponents = computed<LiveComponent[]>(() => {
    const events = this.state.leakEvents();
    // Show all components with resources (both active and destroyed)
    const map = new Map<string, { subs: number; timers: number; listeners: number; hasDestroyed: boolean }>();

    for (const event of events) {
      const existing = map.get(event.componentName) ?? { subs: 0, timers: 0, listeners: 0, hasDestroyed: false };
      if (event.leakType === 'subscription') existing.subs++;
      else if (event.leakType === 'timer') existing.timers++;
      else existing.listeners++;
      if (event.lifecycleState === 'destroyed') existing.hasDestroyed = true;
      map.set(event.componentName, existing);
    }

    return Array.from(map.entries())
      .filter(([, counts]) => !counts.hasDestroyed) // Only show non-destroyed (still alive)
      .map(([name, counts]) => {
        const total = counts.subs + counts.timers + counts.listeners;
        const atRisk = total >= 5;
        return {
          name,
          displayName: displayName(name),
          subscriptions: counts.subs,
          timers: counts.timers,
          listeners: counts.listeners,
          total,
          status: atRisk ? 'at-risk' as const : 'healthy' as const,
          riskReason: atRisk ? `${total} resources — will leak if not cleaned on destroy` : null,
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  readonly totalActiveResources = computed(() =>
    this.liveComponents().reduce((s, c) => s + c.total, 0)
  );

  readonly atRiskCount = computed(() =>
    this.liveComponents().filter(c => c.status === 'at-risk').length
  );

  // ── Leak Report: components that were destroyed without cleanup ──

  readonly destroyedWithLeaks = computed<DestroyedComponent[]>(() => {
    const events = this.state.leakEvents();
    const destroyed = events.filter(e => e.lifecycleState === 'destroyed');

    const map = new Map<string, LeakEvent[]>();
    for (const event of destroyed) {
      const existing = map.get(event.componentName) ?? [];
      existing.push(event);
      map.set(event.componentName, existing);
    }

    return Array.from(map.entries())
      .map(([name, leaked]) => ({
        name,
        displayName: displayName(name),
        leaked,
        leakedCount: leaked.length,
        cleanedCount: 0,
        severity: leaked.some(e => e.severity === 'CRITICAL') ? 'CRITICAL' as const : 'WARNING' as const,
      }))
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'CRITICAL' ? -1 : 1;
        return b.leakedCount - a.leakedCount;
      });
  });

  // ── Expand/collapse for leak details ──

  readonly expandedGroups = signal(new Set<string>());

  toggleGroup(name: string): void {
    const next = new Set(this.expandedGroups());
    if (next.has(name)) { next.delete(name); } else { next.add(name); }
    this.expandedGroups.set(next);
  }

  isExpanded(name: string): boolean {
    return this.expandedGroups().has(name);
  }

  groupLeakEvents(events: LeakEvent[]): Array<{ key: string; type: LeakType; source: string; count: number }> {
    const map = new Map<string, { type: LeakType; source: string; count: number }>();
    for (const e of events) {
      const key = `${e.leakType}::${e.source}`;
      const existing = map.get(key);
      if (existing) { existing.count++; }
      else { map.set(key, { type: e.leakType, source: e.source, count: 1 }); }
    }
    return Array.from(map.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Architect insight: detect systemic patterns ──

  readonly systemicPattern = computed<string | null>(() => {
    const live = this.liveComponents();
    const totalTimers = live.reduce((s, c) => s + c.timers, 0);
    const totalSubs = live.reduce((s, c) => s + c.subscriptions, 0);
    const atRisk = this.atRiskCount();

    if (totalTimers > 10 && atRisk > 2) {
      return `${totalTimers} active timers across ${atRisk} components. Consider a centralized polling service with automatic cleanup, instead of per-component setInterval calls.`;
    }
    if (totalSubs > 15) {
      return `${totalSubs} active subscriptions. Consider using takeUntilDestroyed() as a project-wide pattern, or migrate to signals to eliminate manual subscription management.`;
    }
    if (live.length > 5 && atRisk > Math.floor(live.length / 2)) {
      return `More than half of active components have high resource counts. This suggests missing cleanup patterns at the architecture level — consider a base component class with automatic teardown.`;
    }
    return null;
  });
}

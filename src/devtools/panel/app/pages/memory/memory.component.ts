import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { CommandService } from '../../services/command.service';
import { displayName } from '../../utils/display-name';
import type { LeakEvent } from '../../../../../types/leak-events';

type LeakType = LeakEvent['leakType'];

interface ComponentLeakGroup {
  componentName: string;
  displayName: string;
  totalCount: number;
  subscriptions: LeakEvent[];
  timers: LeakEvent[];
  eventListeners: LeakEvent[];
  hasCritical: boolean;
}

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <!-- Summary -->
      <section class="border border-gray-800 rounded bg-gray-900 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-100">Memory Cleanup Risks</h2>
            <p class="text-xs text-gray-400 mt-1">
              Grouped by component. Expand to see specific resources without detected cleanup.
            </p>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 min-w-[360px]">
            <div class="summary-cell">
              <span>Components</span>
              <strong>{{ componentGroups().length }}</strong>
            </div>
            <div class="summary-cell">
              <span>Total risks</span>
              <strong>{{ state.leakEvents().length }}</strong>
            </div>
            <div class="summary-cell">
              <span>Subscriptions</span>
              <strong>{{ subscriptionCount() }}</strong>
            </div>
            <div class="summary-cell">
              <span>Timers/Listeners</span>
              <strong>{{ timerListenerCount() }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- Type filter tabs -->
      <div class="flex gap-1.5 flex-wrap">
        <button
          (click)="activeFilter.set('all')"
          class="filter-btn"
          [ngClass]="activeFilter() === 'all' ? 'filter-btn-active' : 'filter-btn-inactive'">
          All ({{ state.leakEvents().length }})
        </button>
        <button
          (click)="activeFilter.set('subscription')"
          class="filter-btn"
          [ngClass]="activeFilter() === 'subscription' ? 'filter-btn-active' : 'filter-btn-inactive'">
          Subscriptions ({{ subscriptionCount() }})
        </button>
        <button
          (click)="activeFilter.set('timer')"
          class="filter-btn"
          [ngClass]="activeFilter() === 'timer' ? 'filter-btn-active' : 'filter-btn-inactive'">
          Timers ({{ timerCount() }})
        </button>
        <button
          (click)="activeFilter.set('event-listener')"
          class="filter-btn"
          [ngClass]="activeFilter() === 'event-listener' ? 'filter-btn-active' : 'filter-btn-inactive'">
          Listeners ({{ listenerCount() }})
        </button>
      </div>

      @if (filteredGroups().length === 0) {
        <div class="border border-green-800/50 rounded p-8 bg-green-900/15 text-center">
          <div class="text-green-300 font-semibold mb-1">No cleanup risks observed</div>
          <div class="text-xs text-gray-400">
            No surviving subscription, timer, or listener signals have been captured.
          </div>
        </div>
      } @else {
        <!-- Component groups -->
        <div class="space-y-2">
          @for (group of filteredGroups(); track group.componentName) {
            <section class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
              <!-- Component header -->
              <div class="flex items-stretch">
                <button
                  type="button"
                  class="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
                  (click)="toggleGroup(group.componentName)"
                >
                  <span class="text-[10px] text-gray-500 flex-shrink-0">
                    {{ isExpanded(group.componentName) ? '▼' : '▶' }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-gray-100">{{ group.displayName }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                        {{ group.totalCount }} {{ group.totalCount === 1 ? 'risk' : 'risks' }}
                      </span>
                      @if (group.hasCritical) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                          Critical
                        </span>
                      }
                    </div>
                    <div class="flex gap-2 mt-1 text-[10px] text-gray-500">
                      @if (group.subscriptions.length > 0) {
                        <span>{{ group.subscriptions.length }} subscription{{ group.subscriptions.length > 1 ? 's' : '' }}</span>
                      }
                      @if (group.timers.length > 0) {
                        <span>{{ group.timers.length }} timer{{ group.timers.length > 1 ? 's' : '' }}</span>
                      }
                      @if (group.eventListeners.length > 0) {
                        <span>{{ group.eventListeners.length }} listener{{ group.eventListeners.length > 1 ? 's' : '' }}</span>
                      }
                    </div>
                  </div>
                </button>
                <!-- Open component file in Sources panel -->
                <button
                  type="button"
                  class="flex-shrink-0 px-3 flex items-center text-gray-600 hover:text-blue-400 transition-colors border-l border-gray-800"
                  title="Open component file in Sources panel"
                  (click)="openInSources(group.componentName)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </button>
              </div>

              <!-- Expanded: deduplicated leak sources -->
              @if (isExpanded(group.componentName)) {
                <div class="border-t border-gray-800 divide-y divide-gray-800/50">
                  @for (item of getFilteredEvents(group); track item.source + item.type) {
                    <div class="px-4 py-2.5 pl-10 flex items-center gap-3">
                      <span
                        class="text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap"
                        [ngClass]="typeClass(item.type)"
                      >
                        {{ typeLabel(item.type) }}
                      </span>
                      <div class="flex-1 min-w-0">
                        <span class="text-xs text-gray-200 font-medium">{{ item.source }}</span>
                        @if (item.count > 1) {
                          <span class="text-[10px] text-gray-500 ml-2">x{{ item.count }}</span>
                        }
                      </div>
                      <span class="text-[10px] text-gray-500">{{ item.timing }}</span>
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                        [ngClass]="severityClass(item.severity)"
                      >
                        {{ item.severity }}
                      </span>
                    </div>
                  }
                </div>
              }
            </section>
          }
        </div>

        <!-- Fix patterns -->
        <section class="border border-gray-800 rounded bg-gray-900 p-4">
          <h3 class="text-xs font-semibold text-gray-300 mb-3 uppercase">Cleanup Patterns</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-300">
            <div class="pattern-cell">
              <strong>Subscriptions</strong>
              <p>Use <code>takeUntilDestroyed()</code> or <code>AsyncPipe</code></p>
            </div>
            <div class="pattern-cell">
              <strong>Timers</strong>
              <p>Store handle, call <code>clearTimeout</code>/<code>clearInterval</code> on destroy</p>
            </div>
            <div class="pattern-cell">
              <strong>Event Listeners</strong>
              <p>Use <code>Renderer2</code> or store ref for <code>removeEventListener</code></p>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .summary-cell {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
    }

    .summary-cell span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
    }

    .summary-cell strong {
      display: block;
      color: #f3f4f6;
      font-size: 18px;
      margin-top: 2px;
    }

    .filter-btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
    }

    .filter-btn-active {
      background: rgb(59 130 246 / 0.2);
      border-color: rgb(59 130 246 / 0.5);
      color: #93c5fd;
    }

    .filter-btn-inactive {
      background: rgb(31 41 55 / 0.45);
      border-color: rgb(55 65 81 / 0.55);
      color: #9ca3af;
    }

    .filter-btn-inactive:hover {
      color: #d1d5db;
      border-color: rgb(75 85 99 / 0.7);
    }

    .pattern-cell {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
    }

    .pattern-cell strong {
      display: block;
      color: #dbeafe;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .pattern-cell p {
      color: #9ca3af;
      line-height: 1.45;
      margin: 0;
    }

    code {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
      color: #bfdbfe;
      background: rgb(17 24 39 / 0.75);
      border-radius: 4px;
      padding: 1px 4px;
    }
  `],
})
export class MemoryComponent {
  readonly state = inject(PanelState);
  private readonly commandService = inject(CommandService);

  readonly activeFilter = signal<'all' | LeakType>('all');
  readonly expandedComponents = signal<Set<string>>(new Set());

  readonly subscriptionCount = computed(() =>
    this.state.leakEvents().filter(e => e.leakType === 'subscription').length
  );
  readonly timerCount = computed(() =>
    this.state.leakEvents().filter(e => e.leakType === 'timer').length
  );
  readonly listenerCount = computed(() =>
    this.state.leakEvents().filter(e => e.leakType === 'event-listener').length
  );
  readonly timerListenerCount = computed(() => this.timerCount() + this.listenerCount());

  readonly componentGroups = computed<ComponentLeakGroup[]>(() => {
    const map = new Map<string, LeakEvent[]>();
    for (const event of this.state.leakEvents()) {
      const existing = map.get(event.componentName) ?? [];
      existing.push(event);
      map.set(event.componentName, existing);
    }

    const groups: ComponentLeakGroup[] = [];
    for (const [componentName, events] of map) {
      groups.push({
        componentName,
        displayName: displayName(componentName),
        totalCount: events.length,
        subscriptions: events.filter(e => e.leakType === 'subscription'),
        timers: events.filter(e => e.leakType === 'timer'),
        eventListeners: events.filter(e => e.leakType === 'event-listener'),
        hasCritical: events.some(e => e.severity === 'CRITICAL'),
      });
    }

    return groups.sort((a, b) => {
      if (a.hasCritical !== b.hasCritical) return a.hasCritical ? -1 : 1;
      return b.totalCount - a.totalCount;
    });
  });

  readonly filteredGroups = computed<ComponentLeakGroup[]>(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.componentGroups();

    return this.componentGroups()
      .map(group => {
        const filtered = this.filterEventsByType(group, filter);
        return { ...group, totalCount: filtered.length };
      })
      .filter(group => group.totalCount > 0);
  });

  toggleGroup(componentName: string): void {
    this.expandedComponents.update(set => {
      const next = new Set(set);
      if (next.has(componentName)) {
        next.delete(componentName);
      } else {
        next.add(componentName);
      }
      return next;
    });
  }

  isExpanded(componentName: string): boolean {
    return this.expandedComponents().has(componentName);
  }

  openInSources(componentName: string): void {
    this.commandService.openInSources(componentName);
  }

  getFilteredEvents(group: ComponentLeakGroup): { source: string; type: LeakType; count: number; severity: string; timing: string }[] {
    const filter = this.activeFilter();
    let events: LeakEvent[];
    if (filter === 'all') {
      events = [...group.subscriptions, ...group.timers, ...group.eventListeners];
    } else {
      events = this.filterEventsByType(group, filter);
    }

    // Deduplicate: group by source + leakType
    const deduped = new Map<string, { source: string; type: LeakType; count: number; severity: string; latestDetected: number; createdAt: number }>();
    for (const event of events) {
      const key = `${event.source}::${event.leakType}`;
      const existing = deduped.get(key);
      if (existing) {
        existing.count++;
        if (event.severity === 'CRITICAL') existing.severity = 'CRITICAL';
        if (event.detectedAt > existing.latestDetected) existing.latestDetected = event.detectedAt;
      } else {
        deduped.set(key, {
          source: event.source,
          type: event.leakType,
          count: 1,
          severity: event.severity,
          latestDetected: event.detectedAt,
          createdAt: event.createdAt,
        });
      }
    }

    return Array.from(deduped.values()).map(d => ({
      source: d.source,
      type: d.type,
      count: d.count,
      severity: d.severity,
      timing: `Detected ${this.formatElapsed(d.latestDetected)}`,
    }));
  }

  typeLabel(type: LeakType): string {
    switch (type) {
      case 'subscription': return 'Sub';
      case 'timer': return 'Timer';
      case 'event-listener': return 'Listener';
    }
  }

  typeClass(type: LeakType): string {
    switch (type) {
      case 'subscription': return 'text-purple-300 bg-purple-500/15 border-purple-500/30';
      case 'timer': return 'text-amber-300 bg-amber-500/15 border-amber-500/30';
      case 'event-listener': return 'text-blue-300 bg-blue-500/15 border-blue-500/30';
    }
  }

  severityClass(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'text-red-300 bg-red-500/15 border-red-500/30';
      case 'WARNING': return 'text-amber-300 bg-amber-500/15 border-amber-500/30';
      default: return 'text-gray-300 bg-gray-700/50 border-gray-600/50';
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatElapsed(timestamp: number): string {
    return `${(timestamp / 1000).toFixed(1)}s into session`;
  }

  private filterEventsByType(group: ComponentLeakGroup, type: LeakType): LeakEvent[] {
    switch (type) {
      case 'subscription': return group.subscriptions;
      case 'timer': return group.timers;
      case 'event-listener': return group.eventListeners;
    }
  }
}

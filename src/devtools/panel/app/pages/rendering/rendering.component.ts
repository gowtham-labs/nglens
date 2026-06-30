import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import { CommandService } from '../../services/command.service';
import type { InteractionProfile } from '../../../../../types/panel';
import type { RenderCause, RenderEvent, FlowEvent } from '../../../../../types/render-events';

/** A single entry in the unified timeline (either a flow event or a render event). */
interface TimelineEntry {
  id: string;
  timestamp: number;
  kind: 'flow' | 'render';
  icon: string;
  label: string;
  detail: string;
  colorClass: string;
  depth: number;
  duration?: number;
  count?: number;
  /** Nested flow events (API calls, state changes) associated with this component render */
  flowDetails?: Array<{ icon: string; label: string; detail: string; colorClass: string }>;
}

/** A user action and the cascade of renders it produced. */
interface ActionReplay {
  id: string;
  trigger: string;
  triggerIcon: string;
  targetSelector: string | null;
  triggerComponent: string | null;
  timestamp: number;
  totalRenders: number;
  uniqueComponents: number;
  duration: number;
  frameBudgetExceeded: boolean;
  framesDropped: number;
  timeline: TimelineEntry[];
  tree: CascadeNode[];
}

/** A node in the render cascade tree. */
interface CascadeNode {
  componentName: string;
  count: number;
  totalDuration: number;
  cause: RenderCause;
  depth: number;
  children: CascadeNode[];
}

@Component({
  selector: 'app-rendering',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  template: `
    <div class="h-full overflow-auto">

      <!-- ═══ Status Bar ═══ -->
      <div class="sticky top-0 z-20 px-4 py-2.5 bg-gray-900/95 backdrop-blur border-b border-gray-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-sm font-semibold text-gray-100">Render Inspector</h2>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="text-gray-500">{{ state.renderEvents().length }} renders</span>
            <span class="text-gray-700">·</span>
            <span class="text-gray-500">{{ state.componentStats().length }} components</span>
          </div>
        </div>
        <span
          class="text-[10px] px-2 py-1 rounded-full font-medium"
          [ngClass]="state.isTracking()
            ? 'bg-green-500/15 text-green-400 border border-green-500/30'
            : 'bg-gray-800 text-gray-500 border border-gray-700'"
        >{{ state.isTracking() ? '● Recording' : '○ Stopped' }}</span>
      </div>

      <!-- ═══ Empty State ═══ -->
      @if (state.renderEvents().length === 0) {
        <div class="flex flex-col items-center justify-center p-8 text-center">
          <div class="text-3xl opacity-20 mb-3">⚡</div>
          <h3 class="text-sm font-medium text-gray-300 mb-1">No render activity captured</h3>
          <p class="text-xs text-gray-500 max-w-md">
            Start recording to see the full action flow — which components re-render on each interaction and why.
          </p>
          @if (!state.isTracking()) {
            <div class="mt-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-300">
              Press <strong>Start</strong> in the toolbar to begin recording.
            </div>
          }
        </div>
      } @else {
      <div class="p-4 space-y-3">

        <!-- ═══ Action Replay Cards ═══ -->
        @for (action of actionReplays(); track action.id) {
          <div class="rounded-lg border overflow-hidden transition-colors"
               [ngClass]="expandedActions().has(action.id) ? 'border-gray-600 bg-gray-800/30' : 'border-gray-800 hover:border-gray-700'">

            <!-- Action header: what the user did -->
            <div class="px-4 py-3 flex items-center gap-3 cursor-pointer select-none"
                 (click)="toggleAction(action.id)">
              <span class="text-lg flex-shrink-0">{{ action.triggerIcon }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-semibold text-gray-100">{{ action.trigger }}</span>
                  @if (action.targetSelector) {
                    <code class="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded font-mono">{{ action.targetSelector }}</code>
                  }
                  @if (action.triggerComponent) {
                    <span class="text-[10px] text-indigo-400">in {{ displayName(action.triggerComponent) }}</span>
                  }
                </div>
                <div class="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                  <span><strong class="text-gray-300">{{ action.totalRenders }}</strong> renders</span>
                  <span><strong class="text-gray-300">{{ action.uniqueComponents }}</strong> components</span>
                  <span>{{ action.duration.toFixed(0) }}ms</span>
                  <span class="text-gray-600">{{ formatTime(action.timestamp) }}</span>
                </div>
              </div>
              <span class="text-gray-600 text-sm">{{ expandedActions().has(action.id) ? '▾' : '▸' }}</span>
            </div>

            <!-- Expanded: unified timeline showing flow events + render cascade -->
            @if (expandedActions().has(action.id)) {
              <div class="border-t border-gray-700/50 bg-gray-900/40">

                <!-- Frame budget warning -->
                @if (action.frameBudgetExceeded) {
                  <div class="px-4 py-2 bg-red-950/30 border-b border-red-900/30 flex items-center gap-2">
                    <span class="text-red-400 text-[10px] font-semibold">⚠ JANK</span>
                    <span class="text-[10px] text-red-300">
                      {{ action.duration.toFixed(0) }}ms total — {{ action.framesDropped }} frames dropped (budget: 16ms/frame)
                    </span>
                  </div>
                }

                <!-- Unified timeline -->
                <div class="px-2 py-2">
                  <div class="text-[9px] text-gray-600 uppercase tracking-wide font-semibold px-2 mb-1.5">
                    Timeline
                  </div>
                  @for (entry of action.timeline; track entry.id) {
                    <div class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/40"
                         [style.paddingLeft.px]="entry.depth * 16 + 8"
                         [title]="entry.label + ' — ' + entry.detail + (entry.duration ? ' (' + entry.duration.toFixed(1) + 'ms)' : '')">
                      <!-- Icon -->
                      <span class="text-xs flex-shrink-0 w-4 text-center">{{ entry.icon }}</span>
                      <!-- Label -->
                      <span class="text-[11px] flex-1 min-w-0 truncate" [ngClass]="entry.colorClass">
                        {{ entry.label }}
                      </span>
                      <!-- Detail -->
                      @if (entry.detail) {
                        <span class="text-[9px] text-gray-400 truncate max-w-[140px] flex-shrink-0">{{ entry.detail }}</span>
                      }
                      <!-- Count -->
                      @if (entry.count && entry.count > 1) {
                        <span class="text-[9px] text-gray-400 flex-shrink-0">×{{ entry.count }}</span>
                      }
                      <!-- Duration -->
                      @if (entry.duration) {
                        <span class="text-[10px] font-mono w-14 text-right flex-shrink-0"
                              [ngClass]="entry.duration > 16 ? 'text-red-400' : entry.duration > 5 ? 'text-amber-400' : 'text-gray-600'">
                          {{ entry.duration.toFixed(1) }}ms
                        </span>
                      }
                    </div>
                    <!-- Nested flow details (API calls, state changes) — collapsed by default -->
                    @if (entry.flowDetails && entry.flowDetails.length > 0) {
                      <div class="flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-gray-800/40 rounded select-none"
                           [style.paddingLeft.px]="(entry.depth + 1) * 16 + 16"
                           (click)="toggleFlowDetails(entry.id)">
                        <span class="text-[9px] text-gray-600">{{ expandedFlows().has(entry.id) ? '▾' : '▸' }}</span>
                        <span class="text-[10px] text-cyan-400 font-medium">{{ entry.flowDetails.length }} API/state event{{ entry.flowDetails.length > 1 ? 's' : '' }}</span>
                      </div>
                      @if (expandedFlows().has(entry.id)) {
                        @for (flow of entry.flowDetails; track flow.label) {
                          <div class="flex items-center gap-2 py-1 px-2"
                               [style.paddingLeft.px]="(entry.depth + 1) * 16 + 28"
                               [title]="flow.label + (flow.detail ? ' — ' + flow.detail : '')">
                            <span class="text-[10px] flex-shrink-0 w-4 text-center">{{ flow.icon }}</span>
                            <span class="text-[10px] truncate flex-1 font-medium" [ngClass]="flow.colorClass">{{ flow.label }}</span>
                            @if (flow.detail) {
                              <span class="text-[9px] text-gray-500 truncate max-w-[180px] flex-shrink-0" [title]="flow.detail">{{ flow.detail }}</span>
                            }
                          </div>
                        }
                      }
                    }
                  }
                </div>

                <!-- Fix suggestion (brief, inline) -->
                @if (getSuggestion(action)) {
                  <div class="px-4 py-2 border-t border-gray-800 bg-indigo-950/20">
                    <span class="text-[9px] text-gray-500 uppercase font-semibold">Suggestion</span>
                    <p class="text-[11px] text-indigo-300 mt-0.5">{{ getSuggestion(action) }}</p>
                  </div>
                }
              </div>
            }
          </div>
        }

      </div>
      }
    </div>
  `,
  styles: [`:host { display: block; height: 100%; }`],
})
export class RenderingComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;
  private readonly commandService = inject(CommandService);
  readonly expandedActions = signal(new Set<string>());
  readonly expandedFlows = signal(new Set<string>());

  // ── Action Replays ────────────────────────────────────────────────────────

  /** Time window (ms) from first event that counts as "page load". */
  private readonly PAGE_LOAD_WINDOW = 8000;

  readonly actionReplays = computed<ActionReplay[]>(() => {
    const profiles = this.state.interactionProfiles();
    const allEvents = this.state.renderEvents();
    if (allEvents.length === 0) return [];

    const allFlow = this.state.flowEvents();

    // ── Detect page load: first N seconds of activity with no user interaction ──
    const firstEventTs = allEvents[0]?.timestamp ?? 0;
    const pageLoadCutoff = firstEventTs + this.PAGE_LOAD_WINDOW;

    const pageLoadEvents = allEvents.filter(e => e.timestamp <= pageLoadCutoff);
    const postLoadEvents = allEvents.filter(e => e.timestamp > pageLoadCutoff);

    const results: ActionReplay[] = [];

    // Create page load card only if there are meaningful non-interactive renders
    if (pageLoadEvents.length >= 3) {
      const pageLoadFlow = allFlow.filter(f => f.timestamp <= pageLoadCutoff);
      const httpCount = pageLoadFlow.filter(f => f.type === 'http-response').length;
      const signalCount = pageLoadFlow.filter(f => f.type === 'signal-write').length;
      const subjectCount = pageLoadFlow.filter(f => f.type === 'subject-emit').length;
      const duration = (pageLoadEvents[pageLoadEvents.length - 1]?.timestamp ?? firstEventTs) - firstEventTs;

      // Find re-render offenders (components that rendered many times during load)
      const renderCounts = new Map<string, number>();
      for (const e of pageLoadEvents) {
        renderCounts.set(e.componentName, (renderCounts.get(e.componentName) ?? 0) + 1);
      }
      const offenders = Array.from(renderCounts.entries())
        .filter(([, count]) => count > 3)
        .sort((a, b) => b[1] - a[1]);

      // Build suggestion based on offenders
      let loadSuggestion: string | null = null;
      if (offenders.length > 0 && httpCount > 5) {
        const [topName, topCount] = offenders[0];
        loadSuggestion = `${this.displayName(topName)} rendered ${topCount}× during page load (likely once per API response). Use forkJoin() or combineLatest() to batch API responses before updating state.`;
      } else if (offenders.length > 0) {
        const [topName, topCount] = offenders[0];
        loadSuggestion = `${this.displayName(topName)} rendered ${topCount}× during load. Consider batching state updates or deferring non-visible component initialization.`;
      }

      // Build trigger label
      const parts: string[] = [];
      if (httpCount > 0) parts.push(`${httpCount} API calls`);
      if (signalCount > 0) parts.push(`${signalCount} signal writes`);
      if (subjectCount > 0) parts.push(`${subjectCount} subject emissions`);
      const triggerDetail = parts.length > 0 ? parts.join(' · ') : 'Initial render';

      results.push({
        id: 'page-load',
        trigger: 'Page Load',
        triggerIcon: '🚀',
        targetSelector: triggerDetail,
        triggerComponent: null,
        timestamp: firstEventTs,
        totalRenders: pageLoadEvents.length,
        uniqueComponents: new Set(pageLoadEvents.map(e => e.componentName)).size,
        duration,
        frameBudgetExceeded: pageLoadEvents.reduce((s, e) => s + e.duration, 0) > 500,
        framesDropped: Math.max(0, Math.floor(pageLoadEvents.reduce((s, e) => s + e.duration, 0) / 16.67) - 1),
        timeline: this.buildTimeline(pageLoadEvents, pageLoadFlow),
        tree: this.buildCascadeTree(pageLoadEvents),
        _pageLoadSuggestion: loadSuggestion,
      } as ActionReplay & { _pageLoadSuggestion: string | null });
    }

    // Add post-load actions (or all actions if no page load card was created)
    const eventsForGrouping = results.length > 0 ? postLoadEvents : allEvents;
    if (profiles.length === 0) {
      results.push(...this.groupEventsByInteraction(eventsForGrouping));
    } else {
      const relevantProfiles = results.length > 0
        ? profiles.filter(p => p.startTime > pageLoadCutoff)
        : profiles;
      results.push(...relevantProfiles.slice(0, 30).map(p => this.buildReplay(p, allEvents)));
    }

    return results;
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  toggleAction(id: string): void {
    const next = new Set(this.expandedActions());
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    this.expandedActions.set(next);
  }

  toggleFlowDetails(entryId: string): void {
    const next = new Set(this.expandedFlows());
    if (next.has(entryId)) { next.delete(entryId); } else { next.add(entryId); }
    this.expandedFlows.set(next);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatTime(ts: number): string {
    const now = Date.now();
    const diffMs = now - ts;
    if (diffMs < 5000) return 'just now';
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    return new Date(ts).toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
  }

  formatCauseSource(cause: RenderCause): string {
    const src = cause.source ?? cause.type;
    if (src.startsWith('addEventListener:')) return src.replace('addEventListener:', '') + ' event';
    if (src === 'setTimeout') return 'timer';
    if (src === 'setInterval') return 'interval';
    if (src === 'fetch' || src === 'XMLHttpRequest') return 'HTTP response';
    if (src === 'Promise.then') return 'async';
    return src;
  }

  causePillClass(type: RenderCause['type'] | 'unknown'): string {
    switch (type) {
      case 'zone': return 'bg-blue-900/60 text-blue-300';
      case 'signal': return 'bg-green-900/60 text-green-300';
      case 'input': return 'bg-cyan-900/60 text-cyan-300';
      case 'parent': return 'bg-purple-900/60 text-purple-300';
      case 'manual-cd': return 'bg-amber-900/60 text-amber-300';
      default: return 'bg-gray-700 text-gray-400';
    }
  }

  flattenTree(tree: CascadeNode[]): CascadeNode[] {
    const result: CascadeNode[] = [];
    const walk = (nodes: CascadeNode[]): void => {
      for (const node of nodes) {
        result.push(node);
        walk(node.children);
      }
    };
    walk(tree);
    return result;
  }

  // ── Private: build action replays ─────────────────────────────────────────

  private buildReplay(profile: InteractionProfile, allEvents: RenderEvent[]): ActionReplay {
    const events = allEvents.filter(e =>
      e.timestamp >= profile.startTime && e.timestamp <= profile.endTime
    );
    const flowEvents = this.state.flowEvents().filter(f =>
      f.timestamp >= profile.startTime && f.timestamp <= profile.endTime
    );
    const interaction = events.find(e => e.interactionComponent);
    const duration = profile.duration;
    return {
      id: profile.id,
      trigger: this.detectTrigger(events),
      triggerIcon: this.detectIcon(events),
      targetSelector: interaction?.interactionTarget ?? null,
      triggerComponent: interaction?.interactionComponent ?? null,
      timestamp: profile.startTime,
      totalRenders: events.length,
      uniqueComponents: new Set(events.map(e => e.componentName)).size,
      duration,
      frameBudgetExceeded: events.reduce((s, e) => s + e.duration, 0) > 100,
      framesDropped: Math.max(0, Math.floor(events.reduce((s, e) => s + e.duration, 0) / 16.67) - 1),
      timeline: this.buildTimeline(events, flowEvents),
      tree: this.buildCascadeTree(events),
    };
  }

  private groupEventsByInteraction(events: RenderEvent[]): ActionReplay[] {
    // Group events that are within 50ms of each other (same CD cycle)
    const rawGroups: RenderEvent[][] = [];
    let current: RenderEvent[] = [];

    for (const event of events) {
      if (current.length === 0 || event.timestamp - current[current.length - 1].timestamp < 50) {
        current.push(event);
      } else {
        rawGroups.push(current);
        current = [event];
      }
    }
    if (current.length > 0) rawGroups.push(current);

    // ── Merge rapid input events on the same element (within 500ms) ──
    const merged: RenderEvent[][] = [];
    for (let i = 0; i < rawGroups.length; i++) {
      const group = rawGroups[i];
      const prev = merged[merged.length - 1];
      const groupInteraction = group.find(e => e.interactionComponent);
      const prevInteraction = prev?.find(e => e.interactionComponent);

      const isSameInputElement =
        prev && prevInteraction && groupInteraction &&
        prevInteraction.interactionTarget === groupInteraction.interactionTarget &&
        groupInteraction.causes[0]?.source?.includes('input') &&
        prevInteraction.causes[0]?.source?.includes('input') &&
        group[0].timestamp - prev[prev.length - 1].timestamp < 500;

      if (isSameInputElement) {
        // Merge into previous group
        prev.push(...group);
      } else {
        merged.push(group);
      }
    }

    const allFlow = this.state.flowEvents();

    // ── Limit to last 20 cards (pagination) ──
    const visible = merged.slice(-20);

    return visible.map((group, i) => {
      const interaction = group.find(e => e.interactionComponent);
      const startTs = group[0].timestamp;
      const endTs = group[group.length - 1].timestamp;
      const duration = endTs - startTs || group.reduce((s, e) => s + e.duration, 0);
      const flowInWindow = allFlow.filter(f => f.timestamp >= startTs - 50 && f.timestamp <= endTs + 50);

      // Count how many input keystrokes were merged
      const inputCount = group.filter(e => e.causes[0]?.source?.includes('input')).length;
      const isInputBurst = inputCount > 1;

      const trigger = isInputBurst
        ? `input event (${inputCount} keystrokes)`
        : this.detectTrigger(group);

      return {
        id: `group-${i}`,
        trigger,
        triggerIcon: this.detectIcon(group),
        targetSelector: interaction?.interactionTarget ?? null,
        triggerComponent: interaction?.interactionComponent ?? null,
        timestamp: startTs,
        totalRenders: group.length,
        uniqueComponents: new Set(group.map(e => e.componentName)).size,
        duration,
        frameBudgetExceeded: group.reduce((s, e) => s + e.duration, 0) > 100,
        framesDropped: Math.max(0, Math.floor(group.reduce((s, e) => s + e.duration, 0) / 16.67) - 1),
        timeline: this.buildTimeline(group, flowInWindow),
        tree: this.buildCascadeTree(group),
      };
    });
  }

  private buildCascadeTree(events: RenderEvent[]): CascadeNode[] {
    // Build tree using the depth and parentComponent from instrumentation
    const nodeMap = new Map<string, CascadeNode>();

    for (const event of events) {
      const existing = nodeMap.get(event.componentName);
      if (existing) {
        existing.count++;
        existing.totalDuration += event.duration;
      } else {
        nodeMap.set(event.componentName, {
          componentName: event.componentName,
          count: 1,
          totalDuration: event.duration,
          cause: event.causes[0] ?? { type: 'zone', source: 'unknown' },
          depth: event.depth ?? 0,
          children: [],
        });
      }
    }

    // Build parent→child relationships
    const roots: CascadeNode[] = [];
    for (const event of events) {
      const node = nodeMap.get(event.componentName);
      if (!node) continue;

      if (event.parentComponent && nodeMap.has(event.parentComponent)) {
        const parent = nodeMap.get(event.parentComponent)!;
        if (!parent.children.includes(node)) {
          parent.children.push(node);
        }
      } else if (!roots.includes(node)) {
        roots.push(node);
      }
    }

    // Sort children by duration (most expensive first)
    const sortTree = (nodes: CascadeNode[]): void => {
      nodes.sort((a, b) => b.totalDuration - a.totalDuration);
      for (const n of nodes) sortTree(n.children);
    };
    sortTree(roots);

    return roots;
  }

  private buildTimeline(renderEvents: RenderEvent[], flowEvents: FlowEvent[]): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    let entryId = 0;

    // Only show component renders in the timeline (not flow events at top level)
    for (const r of renderEvents) {
      entries.push({
        id: `t-${entryId++}`,
        timestamp: r.timestamp,
        kind: 'render',
        icon: '🔄',
        label: this.displayName(r.componentName),
        detail: r.depth === 0 ? this.formatCauseSource(r.causes[0] ?? { type: 'zone' }) : 'parent cascade',
        colorClass: r.depth === 0 ? 'text-white font-medium' : 'text-gray-300',
        depth: r.depth ?? 0,
        duration: r.duration,
        count: 1,
      });
    }

    // Sort by timestamp
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Deduplicate consecutive renders of the same component
    const deduped: TimelineEntry[] = [];
    for (const entry of entries) {
      const last = deduped[deduped.length - 1];
      if (last && last.kind === 'render' && entry.kind === 'render' &&
          last.label === entry.label && last.depth === entry.depth) {
        last.count = (last.count ?? 1) + 1;
        last.duration = (last.duration ?? 0) + (entry.duration ?? 0);
      } else {
        deduped.push({ ...entry });
      }
    }

    // Attach flow events to the component that initiated them (via ownerClass)
    // or fallback to nearest render in time
    for (const f of flowEvents) {
      let target: TimelineEntry | null = null;

      // Strategy 1: Match by ownerClass (the component that triggered the API call)
      if (f.ownerClass) {
        target = deduped.find(e => e.kind === 'render' && e.label === this.displayName(f.ownerClass!)) ?? null;
      }

      // Strategy 2: Nearest render in time (within 500ms)
      if (!target) {
        let minDistance = 500;
        for (const entry of deduped) {
          if (entry.kind !== 'render') continue;
          const distance = Math.abs(entry.timestamp - f.timestamp);
          if (distance < minDistance) {
            minDistance = distance;
            target = entry;
          }
        }
      }

      // Strategy 3: Attach to last render entry as fallback
      if (!target && deduped.length > 0) {
        target = deduped[deduped.length - 1];
      }

      if (target) {
        if (!target.flowDetails) target.flowDetails = [];
        target.flowDetails.push({
          icon: this.flowIcon(f.type),
          label: f.label,
          detail: f.detail ?? '',
          colorClass: this.flowColor(f.type),
        });
      }
    }

    return deduped;
  }

  private flowIcon(type: string): string {
    switch (type) {
      case 'signal-write': return '⚡';
      case 'subject-emit': return '📡';
      case 'http-response': return '🌐';
      case 'route-change': return '🧭';
      default: return '•';
    }
  }

  private flowColor(type: string): string {
    switch (type) {
      case 'signal-write': return 'text-green-300';
      case 'subject-emit': return 'text-purple-300';
      case 'http-response': return 'text-cyan-300';
      case 'route-change': return 'text-amber-300';
      default: return 'text-gray-400';
    }
  }

  // ── Per-Component Diagnostics ─────────────────────────────────────────────

  getDiagnostics(action: ActionReplay): Array<{ component: string; severity: 'high' | 'medium'; problem: string; reason: string; fix: string }> {
    const diagnostics: Array<{ component: string; severity: 'high' | 'medium'; problem: string; reason: string; fix: string }> = [];

    for (const node of this.flattenTree(action.tree)) {
      // Skip components that only rendered once — that's normal
      if (node.count <= 2) continue;

      const cause = node.cause.type;
      const source = node.cause.source ?? '';

      // ── Excessive re-renders from parent cascade ──
      if (cause === 'parent' && node.count >= 3) {
        diagnostics.push({
          component: node.componentName,
          severity: node.count >= 5 ? 'high' : 'medium',
          problem: `rendered ${node.count}× from parent cascade`,
          reason: `This component re-renders every time its parent does, even if its own inputs haven't changed.`,
          fix: `Add changeDetection: ChangeDetectionStrategy.OnPush to this component. It will only re-render when its @Input() references change or a signal it reads is written.`,
        });
        continue;
      }

      // ── Multiple renders from timer/interval ──
      if ((source.includes('setTimeout') || source.includes('setInterval')) && node.count >= 3) {
        diagnostics.push({
          component: node.componentName,
          severity: node.count >= 5 ? 'high' : 'medium',
          problem: `rendered ${node.count}× from timers`,
          reason: `Each setTimeout/setInterval callback triggers a Zone.js change detection cycle that re-renders this component.`,
          fix: `Move timer logic to a service and run it outside Angular zone: this.ngZone.runOutsideAngular(() => setInterval(...)). Manually trigger CD only when UI needs updating.`,
        });
        continue;
      }

      // ── Multiple renders from HTTP/async ──
      if ((source.includes('fetch') || source.includes('XMLHttpRequest') || source.includes('Promise')) && node.count >= 3) {
        diagnostics.push({
          component: node.componentName,
          severity: 'medium',
          problem: `rendered ${node.count}× from async operations`,
          reason: `Multiple HTTP responses or Promise resolutions each triggered a separate change detection cycle.`,
          fix: `Batch API calls with forkJoin() or combineLatest(). Or use OnPush + a single signal/subject that updates once after all data arrives.`,
        });
        continue;
      }

      // ── Multiple renders from click/input events ──
      if (source.includes('addEventListener') && node.count >= 3) {
        diagnostics.push({
          component: node.componentName,
          severity: node.count >= 5 ? 'high' : 'medium',
          problem: `rendered ${node.count}× from DOM events`,
          reason: `Multiple event handlers (or event bubbling) are each triggering change detection on this component.`,
          fix: `Consider debouncing rapid events, or use OnPush so the component only re-renders when its state actually changes.`,
        });
        continue;
      }

      // ── Generic excessive render ──
      if (node.count >= 4) {
        diagnostics.push({
          component: node.componentName,
          severity: node.count >= 6 ? 'high' : 'medium',
          problem: `rendered ${node.count}× in one action`,
          reason: `This component re-renders too frequently. Each re-render recalculates the template, diffing the DOM unnecessarily.`,
          fix: `Use ChangeDetectionStrategy.OnPush, or convert state to signals so Angular only marks this component dirty when its actual dependencies change.`,
        });
      }
    }

    return diagnostics;
  }

  getSuggestion(action: ActionReplay): string | null {
    // Check for page-load-specific suggestion
    if ((action as any)._pageLoadSuggestion) {
      return (action as any)._pageLoadSuggestion;
    }
    if (action.totalRenders <= 2) return null;
    const topNode = action.tree[0];
    if (!topNode) return null;

    if (action.framesDropped > 3) {
      return `This action dropped ${action.framesDropped} frames (${action.duration.toFixed(0)}ms). Consider debouncing the trigger or reducing the number of re-rendered components.`;
    }
    if (action.tree.some(n => n.children.length > 3)) {
      return `Multiple children re-rendered from a parent cascade. Consider adding OnPush change detection to child components that don't need to re-render.`;
    }
    if (action.totalRenders > 8) {
      return `${action.totalRenders} renders from one action is high. Check if all components actually need to update, or if some are cascading unnecessarily.`;
    }
    return null;
  }

  private detectTrigger(events: RenderEvent[]): string {
    // Use interaction data if available
    const interaction = events.find(e => e.interactionComponent);
    if (interaction?.causes[0]?.source) {
      return this.formatCauseSource(interaction.causes[0]);
    }
    // Fall back to most common cause source
    const sources = new Map<string, number>();
    for (const e of events) {
      const s = e.causes[0]?.source ?? e.causes[0]?.type ?? 'unknown';
      if (s !== 'unknown') sources.set(s, (sources.get(s) ?? 0) + 1);
    }
    if (sources.size === 0) return 'Page activity';
    const top = Array.from(sources.entries()).sort((a, b) => b[1] - a[1])[0][0];
    return this.formatCauseSource({ type: 'zone', source: top });
  }

  private detectIcon(events: RenderEvent[]): string {
    const src = events[0]?.causes[0]?.source ?? '';
    if (src.includes('click')) return '🖱️';
    if (src.includes('input') || src.includes('key')) return '⌨️';
    if (src.includes('scroll')) return '📜';
    if (src.includes('fetch') || src.includes('XMLHttpRequest')) return '🌐';
    if (src.includes('setTimeout') || src.includes('setInterval')) return '⏱️';
    if (src.includes('Promise')) return '⚡';
    if (src.includes('navigation') || src.includes('route')) return '🧭';
    return '▸';
  }
}

import { Injectable, signal, computed } from '@angular/core';
import type { RenderEvent, RenderCause } from '../../../../types/render-events';
import type { LeakEvent } from '../../../../types/leak-events';
import type { TrackByIssue, OnPushScore } from '../../../../types/recommendation-events';
import type { PollutionSourceMetrics } from '../../../../types/zone-pollution-events';
import type {
  ComponentHotspot,
  ComponentStats,
  InteractionProfile,
  Issue,
  PerformanceSnapshot,
  SnapshotComparison,
} from '../../../../types/panel';

@Injectable({ providedIn: 'root' })
export class PanelState {
  // Connection
  readonly connectionState = signal<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  // Tracking
  readonly isTracking = signal(false);
  readonly trackingError = signal<string | null>(null);
  readonly degradedMode = signal(false);
  readonly clearOnRouteChange = signal(false);

  // Navigation
  readonly activeTab = signal<'overview' | 'rendering' | 'memory' | 'recommendations'>('overview');
  readonly selectedComponent = signal<string | null>(null);
  readonly selectedIssue = signal<Issue | null>(null);

  // Data
  readonly renderEvents = signal<RenderEvent[]>([]);
  readonly leakEvents = signal<LeakEvent[]>([]);
  readonly trackByIssues = signal<TrackByIssue[]>([]);
  readonly onPushRecommendations = signal<OnPushScore[]>([]);
  readonly snapshots = signal<PerformanceSnapshot[]>([]);
  readonly zonePollutionSources = signal<PollutionSourceMetrics[]>([]);

  // Computed: aggregate render events into per-component stats
  readonly componentStats = computed(() => this.aggregateStats(this.renderEvents()));

  // Computed: components exceeding 100 renders per minute
  readonly hotComponents = computed(() =>
    this.componentStats().filter(s => s.rendersPerMinute > 100)
  );

  readonly componentHotspots = computed<ComponentHotspot[]>(() =>
    this.rankHotspots(this.componentStats())
  );

  readonly interactionProfiles = computed<InteractionProfile[]>(() =>
    this.buildInteractionProfiles(this.renderEvents())
  );

  readonly latestComparison = computed<SnapshotComparison | null>(() =>
    this.compareSnapshots(this.snapshots())
  );

  readonly criticalPollutionCount = computed<number>(() =>
    this.zonePollutionSources().filter(s => s.severity === 'critical').length
  );

  readonly zonePollutionIssues = computed<Issue[]>(() =>
    this.zonePollutionSources()
      .filter(s => s.severity !== 'low')
      .map(s => this.pollutionSourceToIssue(s))
  );

  // Computed: per-component render count derived from cumulative render events
  readonly renderCountMap = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const event of this.renderEvents()) {
      counts.set(event.componentName, (counts.get(event.componentName) ?? 0) + 1);
    }
    return counts;
  });

  // Computed: all issues from all sources combined (OnPush excluded — lives in Recommendations only)
  readonly allIssues = computed<Issue[]>(() => this.collectIssues());

  /**
   * Resets all mutable state signals to their initial values.
   */
  clearAll(): void {
    this.connectionState.set('disconnected');
    this.isTracking.set(false);
    this.trackingError.set(null);
    this.degradedMode.set(false);
    this.activeTab.set('overview');
    this.selectedComponent.set(null);
    this.selectedIssue.set(null);
    this.renderEvents.set([]);
    this.leakEvents.set([]);
    this.trackByIssues.set([]);
    this.onPushRecommendations.set([]);
    this.snapshots.set([]);
    this.zonePollutionSources.set([]);
  }

  captureSnapshot(label?: string): void {
    const snapshot = this.createSnapshot(label ?? this.nextSnapshotLabel());
    this.snapshots.update(current => {
      if (current.length === 0) return [snapshot];
      return [current[0], snapshot];
    });
  }

  clearSnapshots(): void {
    this.snapshots.set([]);
  }

  clearActivity(): void {
    this.renderEvents.set([]);
    this.leakEvents.set([]);
    this.trackByIssues.set([]);
    this.onPushRecommendations.set([]);
    this.zonePollutionSources.set([]);
    this.selectedIssue.set(null);
    this.selectedComponent.set(null);
  }

  setTrackingError(message: string): void {
    this.trackingError.set(message);
    this.isTracking.set(false);
  }

  private nextSnapshotLabel(): string {
    const count = this.snapshots().length;
    if (count === 0) return 'Baseline';
    return 'Current run';
  }

  /**
   * Aggregates raw render events into per-component statistics.
   */
  private aggregateStats(events: RenderEvent[]): ComponentStats[] {
    if (events.length === 0) return [];

    const statsMap = new Map<string, {
      renderCount: number;
      totalDuration: number;
      causesBreakdown: Record<RenderCause['type'], number>;
      firstSeen: number;
      lastSeen: number;
    }>();

    for (const event of events) {
      let entry = statsMap.get(event.componentName);
      if (!entry) {
        entry = {
          renderCount: 0,
          totalDuration: 0,
          causesBreakdown: { signal: 0, input: 0, zone: 0, parent: 0, 'manual-cd': 0 },
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
        };
        statsMap.set(event.componentName, entry);
      }

      entry.renderCount++;
      entry.totalDuration += event.duration;
      if (event.timestamp < entry.firstSeen) entry.firstSeen = event.timestamp;
      if (event.timestamp > entry.lastSeen) entry.lastSeen = event.timestamp;

      for (const cause of event.causes) {
        entry.causesBreakdown[cause.type]++;
      }
    }

    const results: ComponentStats[] = [];
    for (const [componentName, entry] of statsMap) {
      const timeSpanMinutes = Math.max((entry.lastSeen - entry.firstSeen) / 60000, 1 / 60);
      results.push({
        componentName,
        renderCount: entry.renderCount,
        rendersPerMinute: entry.renderCount / timeSpanMinutes,
        averageDuration: entry.totalDuration / entry.renderCount,
        totalDuration: entry.totalDuration,
        causesBreakdown: entry.causesBreakdown,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
      });
    }

    return results;
  }

  private createSnapshot(label: string): PerformanceSnapshot {
    const stats = this.componentStats();
    const renderCount = this.renderEvents().length;
    const totalRenderDuration = stats.reduce((sum, stat) => sum + stat.totalDuration, 0);
    const averageRenderDuration = renderCount > 0 ? totalRenderDuration / renderCount : 0;
    const firstRender = this.renderEvents()[0]?.timestamp;
    const lastRender = this.renderEvents()[this.renderEvents().length - 1]?.timestamp;
    const elapsedMinutes = firstRender && lastRender
      ? Math.max((lastRender - firstRender) / 60000, 1 / 60)
      : 1 / 60;

    return {
      id: `snapshot-${Date.now()}`,
      label,
      createdAt: Date.now(),
      metrics: {
        issues: this.allIssues().length,
        components: stats.length,
        renders: renderCount,
        rendersPerMinute: renderCount / elapsedMinutes,
        averageRenderDuration,
        totalRenderDuration,
        leaks: this.leakEvents().length,
        recommendations: this.trackByIssues().length + this.onPushRecommendations().length,
        hotspots: this.componentHotspots().filter(h => h.score >= 70).length,
      },
    };
  }

  private collectIssues(): Issue[] {
    const leaks = this.mapToIssues(this.leakEvents(), event => this.leakToIssue(event));
    const trackby = this.mapToIssues(this.trackByIssues(), issue => this.trackByToIssue(issue));
    const hot = this.mapToIssues(this.hotComponents(), stat => this.hotComponentToIssue(stat));
    const hotspots = this.mapToIssues(
      this.componentHotspots().filter(h => h.score >= 70),
      hotspot => this.hotspotToIssue(hotspot)
    );
    return [...leaks, ...trackby, ...hot, ...hotspots, ...this.zonePollutionIssues()];
  }

  private compareSnapshots(snapshots: PerformanceSnapshot[]): SnapshotComparison | null {
    if (snapshots.length < 2) return null;

    const baseline = snapshots[snapshots.length - 2];
    const current = snapshots[snapshots.length - 1];
    return {
      baseline,
      current,
      delta: this.metricDelta(baseline, current),
    };
  }

  private metricDelta(
    baseline: PerformanceSnapshot,
    current: PerformanceSnapshot
  ): PerformanceSnapshot['metrics'] {
    return {
      issues: current.metrics.issues - baseline.metrics.issues,
      components: current.metrics.components - baseline.metrics.components,
      renders: current.metrics.renders - baseline.metrics.renders,
      rendersPerMinute: current.metrics.rendersPerMinute - baseline.metrics.rendersPerMinute,
      averageRenderDuration: current.metrics.averageRenderDuration - baseline.metrics.averageRenderDuration,
      totalRenderDuration: current.metrics.totalRenderDuration - baseline.metrics.totalRenderDuration,
      leaks: current.metrics.leaks - baseline.metrics.leaks,
      recommendations: current.metrics.recommendations - baseline.metrics.recommendations,
      hotspots: current.metrics.hotspots - baseline.metrics.hotspots,
    };
  }

  private mapToIssues<T>(items: T[], mapper: (item: T) => Issue): Issue[] {
    return items.map(mapper);
  }

  private rankHotspots(stats: ComponentStats[]): ComponentHotspot[] {
    return stats
      .map(stat => {
        const reasons: string[] = [];
        const renderRateScore = Math.min(stat.rendersPerMinute / 120, 1) * 40;
        const durationScore = Math.min(stat.averageDuration / 16, 1) * 30;
        const totalCostScore = Math.min(stat.totalDuration / 250, 1) * 20;
        const cascadeScore = stat.causesBreakdown.parent > 5 ? 10 : 0;

        if (stat.rendersPerMinute > 100) reasons.push('excessive render frequency');
        if (stat.averageDuration > 16) reasons.push('slow average render time');
        if (stat.totalDuration > 250) reasons.push('high cumulative render cost');
        if (stat.causesBreakdown.parent > 5) reasons.push('frequent parent-triggered renders');
        if (reasons.length === 0) reasons.push('moderate render activity');

        return {
          componentName: stat.componentName,
          score: Math.round(Math.min(renderRateScore + durationScore + totalCostScore + cascadeScore, 100)),
          renderCount: stat.renderCount,
          rendersPerMinute: stat.rendersPerMinute,
          averageDuration: stat.averageDuration,
          totalDuration: stat.totalDuration,
          primaryCause: this.primaryCause(stat.causesBreakdown),
          reasons,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private buildInteractionProfiles(events: RenderEvent[]): InteractionProfile[] {
    if (events.length === 0) return [];

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const groups: RenderEvent[][] = [];
    let current: RenderEvent[] = [];

    for (const event of sorted) {
      const previous = current[current.length - 1];
      if (!previous || event.timestamp - previous.timestamp <= 750) {
        current.push(event);
      } else {
        groups.push(current);
        current = [event];
      }
    }
    if (current.length > 0) groups.push(current);

    return groups.slice(-25).map((group, index) => {
      const startTime = group[0].timestamp;
      const endTime = group[group.length - 1].timestamp;
      const componentNames = new Set(group.map(event => event.componentName));
      const totalRenderDuration = group.reduce((sum, event) => sum + event.duration, 0);
      const slowest = [...group].sort((a, b) => b.duration - a.duration)[0];
      const causeCounts = this.countCauses(group.flatMap(event => event.causes));

      return {
        id: `interaction-${startTime}-${index}`,
        label: `Interaction ${groups.length - groups.slice(-25).length + index + 1}`,
        startTime,
        endTime,
        duration: Math.max(endTime - startTime, slowest.duration),
        renderCount: group.length,
        componentCount: componentNames.size,
        totalRenderDuration,
        averageRenderDuration: totalRenderDuration / group.length,
        slowestComponent: slowest.componentName,
        dominantCause: this.primaryCause(causeCounts),
      };
    }).reverse();
  }

  private countCauses(causes: RenderCause[]): Record<RenderCause['type'], number> {
    const counts: Record<RenderCause['type'], number> = {
      signal: 0,
      input: 0,
      zone: 0,
      parent: 0,
      'manual-cd': 0,
    };
    for (const cause of causes) {
      counts[cause.type]++;
    }
    return counts;
  }

  private primaryCause(causes: Record<RenderCause['type'], number>): RenderCause['type'] | 'unknown' {
    let winner: RenderCause['type'] | 'unknown' = 'unknown';
    let highest = 0;
    for (const [cause, count] of Object.entries(causes) as [RenderCause['type'], number][]) {
      if (count > highest) {
        winner = cause;
        highest = count;
      }
    }
    return winner;
  }

  private leakToIssue(event: LeakEvent): Issue {
    return {
      id: event.id,
      type: 'leak',
      componentName: event.componentName,
      severity: event.severity,
      title: `${event.leakType} leak in ${event.componentName}`,
      description: `Unclean ${event.leakType} from "${event.source}" detected after component destruction.`,
      timestamp: event.detectedAt,
    };
  }

  private trackByToIssue(issue: TrackByIssue): Issue {
    return {
      id: issue.id,
      type: 'trackby',
      componentName: issue.componentName,
      severity: issue.severity,
      title: `Missing trackBy in ${issue.componentName}`,
      description: `Collection "${issue.collectionProperty}" has ${issue.collectionSize} items without trackBy.`,
      timestamp: Date.now(),
    };
  }

  private hotComponentToIssue(stats: ComponentStats): Issue {
    return {
      id: `hot-${stats.componentName}`,
      type: 'render-hot',
      componentName: stats.componentName,
      severity: 'WARNING',
      title: `Hot component: ${stats.componentName}`,
      description: `Rendering ${Math.round(stats.rendersPerMinute)} times per minute (avg ${stats.averageDuration.toFixed(1)}ms).`,
      timestamp: stats.lastSeen,
    };
  }

  private hotspotToIssue(hotspot: ComponentHotspot): Issue {
    return {
      id: `hotspot-${hotspot.componentName}`,
      type: 'hotspot',
      componentName: hotspot.componentName,
      severity: hotspot.score >= 90 ? 'CRITICAL' : 'WARNING',
      title: `Performance hotspot: ${hotspot.componentName}`,
      description: `${hotspot.score}/100 hotspot score from ${hotspot.reasons.join(', ')}.`,
      timestamp: Date.now(),
    };
  }

  private pollutionSourceToIssue(source: PollutionSourceMetrics): Issue {
    const severityMap: Record<string, Issue['severity']> = {
      critical: 'CRITICAL',
      high: 'WARNING',
      medium: 'WARNING',
    };
    return {
      id: `zone-pollution-${source.source}`,
      type: 'zone-pollution',
      componentName: source.library ?? source.source,
      severity: severityMap[source.severity] ?? 'WARNING',
      title: `Zone pollution: ${source.library ?? source.source} (${Math.round(source.cdCyclesPerMinute)} CD/min)`,
      description: source.fixSuggestion ?? `${source.source} is triggering excessive change detection`,
      timestamp: source.lastSeen,
    };
  }
}

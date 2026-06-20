import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { RenderEvent } from '../../../../../types/render-events';

interface MetricPoint {
  timestamp: number;
  value: number;
}

interface MetricTrend {
  name: string;
  unit: string;
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  points: MetricPoint[];
}

@Component({
  selector: 'app-metrics-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Live Metrics</h3>
          <p class="text-xs text-gray-400 mt-1">Real-time performance trends over the last 60 seconds</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="autoRefresh.set(!autoRefresh())"
            [ngClass]="autoRefresh() ? 'bg-green-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            {{ autoRefresh() ? '● Live' : 'Paused' }}
          </button>
        </div>
      </div>

      <!-- Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <!-- Render Frequency -->
        <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20 hover:bg-gray-700/40 transition-colors">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-300 uppercase">Renders/min</span>
            <span [ngClass]="rendersPerMinuteTrend().trend === 'up' ? 'text-red-400' : 'text-green-400'" class="text-xs font-semibold">
              {{ getTrendIcon(rendersPerMinuteTrend().trend) }}
            </span>
          </div>
          <div class="text-2xl font-bold text-gray-100 mb-2">{{ rendersPerMinuteTrend().current.toFixed(1) }}</div>
          <svg
            class="w-full h-12"
            [innerHTML]="getSparklineSVG(rendersPerMinuteTrend().points, '#3b82f6')"
          ></svg>
          <div class="mt-2 text-[10px] text-gray-500">
            <span>Prev: {{ rendersPerMinuteTrend().previous.toFixed(1) }}</span>
          </div>
        </div>

        <!-- Avg Render Duration -->
        <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20 hover:bg-gray-700/40 transition-colors">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-300 uppercase">Avg Duration</span>
            <span [ngClass]="avgDurationTrend().trend === 'up' ? 'text-red-400' : 'text-green-400'" class="text-xs font-semibold">
              {{ getTrendIcon(avgDurationTrend().trend) }}
            </span>
          </div>
          <div class="text-2xl font-bold text-gray-100 mb-2">{{ avgDurationTrend().current.toFixed(2) }}<span class="text-sm">ms</span></div>
          <svg
            class="w-full h-12"
            [innerHTML]="getSparklineSVG(avgDurationTrend().points, '#f59e0b')"
          ></svg>
          <div class="mt-2 text-[10px] text-gray-500">
            <span>Prev: {{ avgDurationTrend().previous.toFixed(2) }}ms</span>
          </div>
        </div>

        <!-- Component Count -->
        <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20 hover:bg-gray-700/40 transition-colors">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-300 uppercase">Active Components</span>
            <span [ngClass]="activeComponentsTrend().trend === 'up' ? 'text-amber-400' : 'text-green-400'" class="text-xs font-semibold">
              {{ getTrendIcon(activeComponentsTrend().trend) }}
            </span>
          </div>
          <div class="text-2xl font-bold text-gray-100 mb-2">{{ activeComponentsTrend().current.toFixed(0) }}</div>
          <svg
            class="w-full h-12"
            [innerHTML]="getSparklineSVG(activeComponentsTrend().points, '#10b981')"
          ></svg>
          <div class="mt-2 text-[10px] text-gray-500">
            <span>Prev: {{ activeComponentsTrend().previous.toFixed(0) }}</span>
          </div>
        </div>

        <!-- Total Events -->
        <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20 hover:bg-gray-700/40 transition-colors">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-300 uppercase">Total Events</span>
            <span class="text-xs font-semibold text-gray-400">📊</span>
          </div>
          <div class="text-2xl font-bold text-gray-100 mb-2">{{ totalEventsTrend().current.toFixed(0) }}</div>
          <svg
            class="w-full h-12"
            [innerHTML]="getSparklineSVG(totalEventsTrend().points, '#8b5cf6')"
          ></svg>
          <div class="mt-2 text-[10px] text-gray-500">
            <span>Rate: {{ eventRate().toFixed(1) }}/s</span>
          </div>
        </div>
      </div>

      <!-- Detailed Metrics Table -->
      <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20">
        <h4 class="text-xs font-semibold text-gray-300 mb-3 uppercase">Detailed Breakdown</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div class="p-2 rounded bg-gray-800/40">
            <div class="text-gray-500 mb-1">Min Render</div>
            <div class="font-semibold text-gray-200">{{ renderStats().min.toFixed(2) }}ms</div>
          </div>
          <div class="p-2 rounded bg-gray-800/40">
            <div class="text-gray-500 mb-1">Max Render</div>
            <div class="font-semibold text-gray-200">{{ renderStats().max.toFixed(2) }}ms</div>
          </div>
          <div class="p-2 rounded bg-gray-800/40">
            <div class="text-gray-500 mb-1">Std Dev</div>
            <div class="font-semibold text-gray-200">{{ renderStats().stdDev.toFixed(2) }}ms</div>
          </div>
          <div class="p-2 rounded bg-gray-800/40">
            <div class="text-gray-500 mb-1">Jank Count</div>
            <div class="font-semibold" [ngClass]="renderStats().jankCount > 0 ? 'text-red-400' : 'text-green-400'">
              {{ renderStats().jankCount }}
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Assessment -->
      <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-gray-300 uppercase">Performance Health</h4>
          <span [ngClass]="performanceScore().score >= 80 ? 'text-green-400' : performanceScore().score >= 60 ? 'text-amber-400' : 'text-red-400'" class="text-sm font-bold">
            {{ performanceScore().score }}/100
          </span>
        </div>
        <div class="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
          <div
            class="h-full rounded-full transition-all duration-500"
            [style.width.%]="performanceScore().score"
            [ngClass]="performanceScore().score >= 80 ? 'bg-green-500' : performanceScore().score >= 60 ? 'bg-amber-500' : 'bg-red-500'"
          ></div>
        </div>
        <p class="text-xs text-gray-400">{{ performanceScore().assessment }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    svg {
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }
  `],
})
export class MetricsDashboardComponent {
  readonly state = inject(PanelState);
  readonly autoRefresh = signal(true);

  // Time window for metrics (60 seconds)
  readonly timeWindow = 60000;
  readonly bucketSize = 1000; // 1 second buckets

  readonly rendersPerMinuteTrend = computed(() => this.calculateTrend('renders'));
  readonly avgDurationTrend = computed(() => this.calculateTrend('avgDuration'));
  readonly activeComponentsTrend = computed(() => this.calculateTrend('components'));
  readonly totalEventsTrend = computed(() => this.calculateTrend('totalEvents'));

  readonly renderStats = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) {
      return { min: 0, max: 0, stdDev: 0, jankCount: 0, avg: 0 };
    }

    const durations = events.map(e => e.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    // Standard deviation
    const squaredDiffs = durations.map(d => Math.pow(d - avg, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / durations.length);

    // Jank count (renders > 16ms = 60fps threshold)
    const jankCount = durations.filter(d => d > 16).length;

    return { min, max, stdDev, jankCount, avg };
  });

  readonly eventRate = computed(() => {
    const events = this.state.renderEvents();
    if (events.length < 2) return 0;

    const timeSpan = events[events.length - 1].timestamp - events[0].timestamp;
    if (timeSpan === 0) return 0;

    return (events.length / timeSpan) * 1000; // events per second
  });

  readonly performanceScore = computed(() => {
    const stats = this.renderStats();
    const rate = this.eventRate();
    const trends = this.rendersPerMinuteTrend();

    let score = 100;

    // Deduct for high jank
    if (stats.jankCount > 5) score -= 30;
    else if (stats.jankCount > 0) score -= 10;

    // Deduct for high render frequency
    if (trends.current > 100) score -= 20;
    else if (trends.current > 50) score -= 10;

    // Deduct for high avg duration
    if (stats.avg > 10) score -= 15;
    else if (stats.avg > 5) score -= 5;

    score = Math.max(0, Math.min(100, score));

    let assessment = '';
    if (score >= 80) assessment = 'Excellent performance. Application is responsive.';
    else if (score >= 60) assessment = 'Good performance. Minor optimization opportunities.';
    else if (score >= 40) assessment = 'Fair performance. Consider investigating render causes.';
    else assessment = 'Poor performance. Immediate optimization recommended.';

    return { score, assessment };
  });

  private calculateTrend(type: 'renders' | 'avgDuration' | 'components' | 'totalEvents'): MetricTrend {
    const events = this.state.renderEvents();
    if (events.length === 0) {
      return { name: type, unit: '', current: 0, previous: 0, trend: 'stable', points: [] };
    }

    const now = events[events.length - 1].timestamp;
    const cutoff = now - this.timeWindow;

    // Create time buckets
    const buckets = new Map<number, RenderEvent[]>();
    for (const event of events) {
      if (event.timestamp >= cutoff) {
        const bucketKey = Math.floor(event.timestamp / this.bucketSize);
        if (!buckets.has(bucketKey)) {
          buckets.set(bucketKey, []);
        }
        buckets.get(bucketKey)!.push(event);
      }
    }

    // Calculate metrics for each bucket
    const points: MetricPoint[] = [];
    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);

    for (const [_, bucketEvents] of sortedBuckets) {
      let value = 0;

      switch (type) {
        case 'renders':
          value = (bucketEvents.length / (this.bucketSize / 1000)) * 60; // renders per minute
          break;
        case 'avgDuration':
          value = bucketEvents.reduce((sum, e) => sum + e.duration, 0) / bucketEvents.length;
          break;
        case 'components':
          value = new Set(bucketEvents.map(e => e.componentName)).size;
          break;
        case 'totalEvents':
          value = bucketEvents.length;
          break;
      }

      points.push({
        timestamp: bucketEvents[0].timestamp,
        value,
      });
    }

    const current = points.length > 0 ? points[points.length - 1].value : 0;
    const previous = points.length > 1 ? points[points.length - 2].value : current;

    const trend: 'up' | 'down' | 'stable' =
      current > previous * 1.1 ? 'up' : current < previous * 0.9 ? 'down' : 'stable';

    const unit =
      type === 'renders'
        ? '/min'
        : type === 'avgDuration'
          ? 'ms'
          : type === 'components'
            ? 'cmp'
            : 'evt';

    return { name: type, unit, current, previous, trend, points };
  }

  getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
    }
  }

  getSparklineSVG(points: MetricPoint[], color: string): string {
    if (points.length === 0) {
      return '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"><text x="50" y="20" text-anchor="middle" fill="#999">No data</text></svg>';
    }

    const width = 100;
    const height = 40;
    const padding = 2;

    // Find min/max for scaling
    const values = points.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Generate path
    let pathData = '';
    const stepX = (width - padding * 2) / (points.length - 1 || 1);

    for (let i = 0; i < points.length; i++) {
      const x = padding + i * stepX;
      const normalizedValue = (points[i].value - min) / range;
      const y = height - padding - normalizedValue * (height - padding * 2);

      if (i === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
    }

    // Close path for fill
    const lastX = padding + (points.length - 1) * stepX;
    const fillPath = pathData + ` L ${lastX} ${height - padding} L ${padding} ${height - padding} Z`;

    return `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
          </linearGradient>
        </defs>
        <path d="${fillPath}" fill="url(#grad)" stroke="none"/>
        <path d="${pathData}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
}

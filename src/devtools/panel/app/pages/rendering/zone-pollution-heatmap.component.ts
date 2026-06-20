import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { Issue } from '../../../../../types/panel';

interface PollutionSource {
  name: string;
  cdCyclesPerMinute: number;
  taskCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  library?: string;
  percentage: number;
}

@Component({
  selector: 'app-zone-pollution-heatmap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Zone.js Pollution Sources</h3>
          <p class="text-xs text-gray-400 mt-1">External libraries triggering excessive change detection</p>
        </div>
        <div class="text-right">
          <div class="text-xs text-gray-400">Total Zone Tasks</div>
          <div class="text-2xl font-bold text-gray-100">{{ totalZoneTasks() }}</div>
        </div>
      </div>

      <!-- Severity Summary -->
      <div class="grid grid-cols-4 gap-2 text-xs">
        <div class="p-2 rounded bg-green-500/10 border border-green-500/30">
          <div class="text-gray-400 mb-1">Low</div>
          <div class="text-lg font-semibold text-green-400">{{ severityStats().low }}</div>
        </div>
        <div class="p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
          <div class="text-gray-400 mb-1">Medium</div>
          <div class="text-lg font-semibold text-yellow-400">{{ severityStats().medium }}</div>
        </div>
        <div class="p-2 rounded bg-orange-500/10 border border-orange-500/30">
          <div class="text-gray-400 mb-1">High</div>
          <div class="text-lg font-semibold text-orange-400">{{ severityStats().high }}</div>
        </div>
        <div class="p-2 rounded bg-red-500/10 border border-red-500/30">
          <div class="text-gray-400 mb-1">Critical</div>
          <div class="text-lg font-semibold text-red-400">{{ severityStats().critical }}</div>
        </div>
      </div>

      <!-- Heatmap -->
      <div class="space-y-2 max-h-80 overflow-auto bg-gray-900/30 rounded p-3">
        @if (pollutionSources().length === 0) {
          <div class="text-sm text-gray-500 p-8 text-center">
            <div class="text-gray-600 mb-1">✓</div>
            No Zone.js pollution detected. Application is running clean.
          </div>
        } @else {
          @for (source of pollutionSources(); track source.name) {
            <div class="space-y-1">
              <!-- Source Header -->
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-xs font-semibold text-gray-200 flex items-center gap-2">
                    <span
                      class="w-2 h-2 rounded-full"
                      [ngClass]="getSeverityColor(source.severity)"
                    ></span>
                    {{ source.name }}
                    @if (source.library) {
                      <span class="text-[10px] text-gray-500">({{ source.library }})</span>
                    }
                  </div>
                </div>
                <div class="text-xs text-gray-400">{{ source.cdCyclesPerMinute.toFixed(1) }}/min</div>
              </div>

              <!-- Progress Bar with Heatmap -->
              <div class="flex gap-2 items-center">
                <div class="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
                  <div
                    class="h-full rounded transition-all"
                    [style.width.%]="source.percentage"
                    [ngClass]="getHeatmapColor(source.severity, source.percentage)"
                  ></div>
                </div>
                <div class="text-xs text-gray-500 w-12 text-right">{{ source.percentage.toFixed(0) }}%</div>
              </div>

              <!-- Task Count -->
              <div class="text-[10px] text-gray-500 pl-2">
                {{ source.taskCount }} tasks · Severity: <span [ngClass]="getSeverityTextColor(source.severity)">{{ source.severity }}</span>
              </div>
            </div>
          }
        }
      </div>

      <!-- Recommendations -->
      @if (pollutionSources().length > 0) {
        <div class="border border-blue-600/30 rounded-lg p-3 bg-blue-500/10">
          <h4 class="text-xs font-semibold text-blue-300 mb-2">💡 Optimization Recommendations</h4>
          <ul class="text-xs text-blue-200/80 space-y-1">
            <li class="flex gap-2">
              <span class="text-blue-400">•</span>
              <span>Wrap third-party library calls with <code class="bg-gray-800 px-1 rounded text-blue-300">ngZone.runOutsideAngular()</code></span>
            </li>
            <li class="flex gap-2">
              <span class="text-blue-400">•</span>
              <span>Run frequently-triggered operations (scroll, resize, mousemove) outside Angular zone</span>
            </li>
            <li class="flex gap-2">
              <span class="text-blue-400">•</span>
              <span>Consider deferring updates with <code class="bg-gray-800 px-1 rounded text-blue-300">setTimeout(..., 0)</code> after zone exit</span>
            </li>
          </ul>
        </div>
      }

      <!-- Top Source Detail -->
      @if (topSource(); as top) {
        <div class="border border-gray-600/30 rounded-lg p-3 bg-gray-700/20">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-semibold text-gray-200">Top Source: {{ top.name }}</h4>
            <span
              class="text-[10px] px-2 py-0.5 rounded font-semibold"
              [ngClass]="getSeverityBadgeClass(top.severity)"
            >
              {{ top.severity | uppercase }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div class="text-gray-500">CD Cycles/min</div>
              <div class="font-semibold text-gray-200">{{ top.cdCyclesPerMinute.toFixed(1) }}</div>
            </div>
            <div>
              <div class="text-gray-500">Task Count</div>
              <div class="font-semibold text-gray-200">{{ top.taskCount }}</div>
            </div>
            <div>
              <div class="text-gray-500">Impact</div>
              <div class="font-semibold" [ngClass]="getImpactClass(top.cdCyclesPerMinute)">
                {{ getImpactLabel(top.cdCyclesPerMinute) }}
              </div>
            </div>
          </div>
          @if (top.library) {
            <div class="mt-2 p-2 rounded bg-gray-800/40 text-xs text-gray-300">
              <strong>Library:</strong> {{ top.library }}
            </div>
          }
        </div>
      }

      <!-- Legend -->
      <div class="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-700">
        <div class="flex items-center gap-2">
          <span class="text-[10px]">Severity Scale:</span>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <div class="flex items-center gap-1">
            <div class="w-2 h-2 rounded bg-green-500/60"></div>
            <span>&lt;10/min</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-2 h-2 rounded bg-yellow-500/60"></div>
            <span>10-30/min</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-2 h-2 rounded bg-orange-500/60"></div>
            <span>30-75/min</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-2 h-2 rounded bg-red-500/60"></div>
            <span>&gt;75/min</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    code {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 10px;
    }
  `],
})
export class ZonePollutionHeatmapComponent {
  readonly state = inject(PanelState);

  readonly pollutionSources = computed(() => {
    const issues = this.state.allIssues().filter(i => i.type === 'zone-pollution');
    if (issues.length === 0) return [];

    // Extract pollution data from issues
    const sources = new Map<string, PollutionSource>();

    for (const issue of issues) {
      const name = this.extractSourceName(issue.description);
      if (!sources.has(name)) {
        // Extract CD cycles per minute from description
        const cdMatch = issue.description.match(/(\d+)\s*(?:CD cycles?|change detections?)/i);
        const cdCyclesPerMinute = cdMatch ? parseInt(cdMatch[1]) : 0;

        const taskMatch = issue.description.match(/(\d+)\s*(?:tasks?|events?)/i);
        const taskCount = taskMatch ? parseInt(taskMatch[1]) : 0;

        sources.set(name, {
          name,
          cdCyclesPerMinute,
          taskCount,
          severity: this.calculateSeverity(cdCyclesPerMinute),
          library: this.extractLibrary(issue.description),
          percentage: 0,
        });
      }
    }

    // Calculate percentages
    const values = Array.from(sources.values());
    const maxCd = Math.max(...values.map(v => v.cdCyclesPerMinute), 1);

    for (const source of values) {
      source.percentage = (source.cdCyclesPerMinute / maxCd) * 100;
    }

    // Sort by CD cycles (descending)
    return values.sort((a, b) => b.cdCyclesPerMinute - a.cdCyclesPerMinute);
  });

  readonly topSource = computed(() => this.pollutionSources()[0] || null);

  readonly totalZoneTasks = computed(() => {
    return this.pollutionSources().reduce((sum, s) => sum + s.taskCount, 0);
  });

  readonly severityStats = computed(() => {
    const sources = this.pollutionSources();
    return {
      low: sources.filter(s => s.severity === 'low').length,
      medium: sources.filter(s => s.severity === 'medium').length,
      high: sources.filter(s => s.severity === 'high').length,
      critical: sources.filter(s => s.severity === 'critical').length,
    };
  });

  private calculateSeverity(cdCyclesPerMinute: number): 'low' | 'medium' | 'high' | 'critical' {
    if (cdCyclesPerMinute < 10) return 'low';
    if (cdCyclesPerMinute < 30) return 'medium';
    if (cdCyclesPerMinute < 75) return 'high';
    return 'critical';
  }

  private extractSourceName(description: string): string {
    const match = description.match(/(?:from|triggered by|source:?)\s*([^\s,\.]+)/i);
    return match ? match[1] : 'Unknown';
  }

  private extractLibrary(description: string): string | undefined {
    const match = description.match(/library:?\s*([^\s,\.]+)|(?:Chart\.js|socket\.io|jQuery|lodash)/i);
    return match ? match[1] : undefined;
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  }

  getSeverityTextColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      default:
        return 'text-green-400';
    }
  }

  getSeverityBadgeClass(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'bg-red-600/80 text-white';
      case 'high':
        return 'bg-orange-600/80 text-white';
      case 'medium':
        return 'bg-yellow-600/80 text-white';
      default:
        return 'bg-green-600/80 text-white';
    }
  }

  getHeatmapColor(severity: string, percentage: number): string {
    if (severity === 'critical') return 'bg-red-500/80';
    if (severity === 'high') return 'bg-orange-500/80';
    if (severity === 'medium') return 'bg-yellow-500/80';
    return 'bg-green-500/80';
  }

  getImpactClass(cdCyclesPerMinute: number): string {
    if (cdCyclesPerMinute > 75) return 'text-red-400';
    if (cdCyclesPerMinute > 30) return 'text-orange-400';
    if (cdCyclesPerMinute > 10) return 'text-yellow-400';
    return 'text-green-400';
  }

  getImpactLabel(cdCyclesPerMinute: number): string {
    if (cdCyclesPerMinute > 75) return 'Critical';
    if (cdCyclesPerMinute > 30) return 'High';
    if (cdCyclesPerMinute > 10) return 'Medium';
    return 'Low';
  }
}

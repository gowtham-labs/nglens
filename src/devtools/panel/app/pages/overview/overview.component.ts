import { Component, inject, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { displayName } from '../../utils/display-name';
import {
  buildRecommendationActions,
  confidenceClass,
  difficultyClass,
  gainClass,
  topQuickWins,
  type RecommendationAction,
} from '../../utils/recommendation-actions';
import type { ComponentHotspot, SnapshotComparison, Issue } from '../../../../../types/panel';

interface HealthSummary {
  label: string;
  detail: string;
  className: string;
}

interface DiagnosisCard {
  label: string;
  value: string;
  detail: string;
  className: string;
  tooltip: string;
}

interface CompareMetric {
  label: string;
  baseline: string;
  current: string;
  delta: string;
  verdict: 'better' | 'worse' | 'same';
}

interface TopIssueData {
  title: string;
  description: string;
  affectedCount: number;
  tab: 'overview' | 'rendering' | 'memory' | 'recommendations';
  componentName?: string;
}

interface EnvironmentProfileData {
  idle_cd_rate: number;
  active_zone_sources_count: number;
  active_streams_count: number;
  recommendation: string;
  profile_label: string;
  health_class: string;
}

interface ZonePollutionSource {
  id: string;
  description: string;
  severity: 'critical' | 'high' | 'low';
  affectedComponents: string[];
  renderImpact: number;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [NgClass],
  template: `
    <!-- Tooltip container (positioned at root for proper z-index) -->
    <div #tooltipContainer class="tooltip-container"></div>
    <div class="h-full overflow-auto p-4 space-y-4">
      <!-- HEALTH SUMMARY & KEY METRICS HEADER -->
      <section class="border border-gray-800 rounded bg-gray-900 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                [ngClass]="{
                  'bg-green-500': state.connectionState() === 'connected',
                  'bg-red-500': state.connectionState() === 'disconnected',
                  'bg-amber-500': state.connectionState() === 'reconnecting'
                }"
              ></span>
              <span class="text-xs text-gray-400 capitalize">{{ state.connectionState() }}</span>
              @if (state.degradedMode()) {
                <span class="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
                  Degraded
                </span>
              }
            </div>
            <h2 class="text-lg font-semibold mt-3" [ngClass]="healthSummary().className">
              {{ healthSummary().label }}
            </h2>
            <p class="text-xs text-gray-400 mt-1 max-w-3xl">{{ healthSummary().detail }}</p>
          </div>

          <div class="grid grid-cols-3 gap-2 text-right min-w-[260px]">
            <div class="metric-cell group relative top-metric">
              <div class="flex items-center justify-between">
                <span>Open risks</span>
                <div class="tooltip-wrapper" [attr.data-tooltip]="'Total number of performance and memory-related issues detected'">
                  <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
              <strong>{{ issuesCount() }}</strong>
              <small>needs review</small>
            </div>
            <div class="metric-cell group relative top-metric">
              <div class="flex items-center justify-between">
                <span>Top render risk</span>
                <div class="tooltip-wrapper" [attr.data-tooltip]="'Risk score (0-100) of the top-ranked render hotspot. Higher scores indicate more severe performance issues'">
                  <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
              <strong [ngClass]="scoreClass(highestHotspotScore())">{{ highestHotspotScore() }}/100</strong>
              <small>{{ riskLabel(highestHotspotScore()) }}</small>
            </div>
            <div class="metric-cell group relative top-metric">
              <div class="flex items-center justify-between">
                <span>Fix candidates</span>
                <div class="tooltip-wrapper" [attr.data-tooltip]="'Number of actionable fixes ranked and ready to implement. Quick wins are prioritized'">
                  <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
              <strong>{{ actions().length }}</strong>
              <small>{{ quickWins().length }} quick wins</small>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-4">
          @for (card of diagnosisCards(); track card.label) {
            <div class="diagnosis-card group relative">
              <div class="flex items-start justify-between gap-2">
                <span>{{ card.label }}</span>
                <div class="tooltip-wrapper" [attr.data-tooltip]="card.tooltip">
                  <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
              <strong [ngClass]="card.className">{{ card.value }}</strong>
              <small>{{ card.detail }}</small>
            </div>
          }
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 mt-4">
          <div class="metric-cell group relative">
            <div class="flex items-center justify-between gap-1">
              <span>Recorded renders</span>
              <div class="tooltip-wrapper" [attr.data-tooltip]="'Total number of render events captured during the recording'">
                <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            <strong>{{ state.renderEvents().length }}</strong>
            <small>events captured</small>
          </div>
          <div class="metric-cell group relative">
            <div class="flex items-center justify-between gap-1">
              <span>Components seen</span>
              <div class="tooltip-wrapper" [attr.data-tooltip]="'Total number of unique components that rendered at least once'">
                <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            <strong>{{ componentsCount() }}</strong>
            <small>rendered at least once</small>
          </div>
          <div class="metric-cell group relative">
            <div class="flex items-center justify-between gap-1">
              <span>Render frequency</span>
              <div class="tooltip-wrapper" [attr.data-tooltip]="'Average number of renders per minute across all components'">
                <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            <strong>{{ renderRate() }}/min</strong>
            <small>all components</small>
          </div>
          <div class="metric-cell group relative">
            <div class="flex items-center justify-between gap-1">
              <span>Avg render cost</span>
              <div class="tooltip-wrapper" [attr.data-tooltip]="'Average time spent rendering per captured event'">
                <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            <strong>{{ averageRenderDuration() }}ms</strong>
            <small>per captured render</small>
          </div>
          <div class="metric-cell group relative">
            <div class="flex items-center justify-between gap-1">
              <span>Cleanup risks</span>
              <div class="tooltip-wrapper" [attr.data-tooltip]="'Number of components with potential memory cleanup issues (subscriptions, timers, event listeners not unsubscribed)'">
                <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            <strong>{{ memoryRiskCount() }}</strong>
            <small>missing teardown</small>
          </div>
          <div class="metric-cell group relative">
            <div class="flex items-center justify-between gap-1">
              <span>Action windows</span>
              <div class="tooltip-wrapper" [attr.data-tooltip]="'Number of user interaction-driven render bursts captured and grouped for analysis'">
                <svg class="w-3.5 h-3.5 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
            <strong>{{ interactionsCount() }}</strong>
            <small>render bursts grouped</small>
          </div>
        </div>

        @if (!hasActivity()) {
          <div class="mt-4 border border-dashed border-gray-700 rounded p-4 bg-gray-800/30">
            <div class="text-sm font-medium text-gray-200">No tracking data yet</div>
            <p class="text-xs text-gray-400 mt-1">
              Start tracking, use the Angular page normally, then Overview will rank hotspots and quick wins from the captured evidence.
            </p>
          </div>
        }
      </section>

      <section class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <div>
              <h3 class="text-xs font-semibold text-gray-300 uppercase">Compare Runs</h3>
              <p class="text-[10px] text-gray-500 mt-0.5">{{ comparisonStatus() }}</p>
            </div>
            <div class="tooltip-wrapper" [attr.data-tooltip]="'Capture two snapshots to compare performance metrics: save a baseline, then capture after making changes. View metrics side-by-side to measure improvement or regression.'">
              <svg class="w-4 h-4 text-gray-500 transition-opacity cursor-help" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="compare-button" (click)="saveBaseline()" title="Record baseline metrics from current performance data">Save Baseline</button>
            <button
              type="button"
              class="compare-button"
              [class.opacity-50]="state.snapshots().length === 0"
              [class.cursor-not-allowed]="state.snapshots().length === 0"
              [disabled]="state.snapshots().length === 0"
              (click)="captureCurrent()"
              title="Capture current metrics after making code changes to compare against baseline"
            >
              Capture Current
            </button>
            @if (state.snapshots().length > 0) {
              <button type="button" class="compare-button muted" (click)="resetComparison()" title="Clear baseline and start a new comparison">Reset</button>
            }
          </div>
        </div>

        @if (state.latestComparison(); as comparison) {
          <div class="overflow-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-500 border-b border-gray-800">
                  <th class="text-left py-2 px-4 font-medium">Metric</th>
                  <th class="text-right py-2 px-3 font-medium">{{ comparison.baseline.label }}</th>
                  <th class="text-right py-2 px-3 font-medium">{{ comparison.current.label }}</th>
                  <th class="text-right py-2 px-4 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                @for (metric of comparisonMetrics(comparison); track metric.label) {
                  <tr class="border-b border-gray-900 last:border-b-0">
                    <td class="py-2.5 px-4 text-gray-300 font-medium">{{ metric.label }}</td>
                    <td class="py-2.5 px-3 text-right text-gray-400">{{ metric.baseline }}</td>
                    <td class="py-2.5 px-3 text-right text-gray-200">{{ metric.current }}</td>
                    <td class="py-2.5 px-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <div class="tooltip-wrapper" [attr.data-tooltip]="getMetricChangeExplanation(metric.label, metric.verdict)">
                          <span class="change-pill" [ngClass]="changeClass(metric.verdict)">
                            {{ metric.delta }}
                          </span>
                        </div>
                        <span class="text-[10px] font-medium" [ngClass]="verdictClass(metric.verdict)">
                          {{ verdictLabel(metric.verdict) }}
                        </span>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div class="compare-empty">
                <span>Baseline</span>
                <strong>{{ state.snapshots().length > 0 ? state.snapshots()[0].label : 'Not saved' }}</strong>
              </div>
              <div class="compare-empty">
                <span>Current</span>
                <strong>{{ state.snapshots().length > 0 ? 'Ready to capture' : 'Waiting for baseline' }}</strong>
              </div>
            </div>
            
            <div class="bg-gray-800/40 border border-gray-700/50 rounded p-3 text-xs text-gray-300 space-y-2">
              <div class="font-semibold text-gray-200">How to use Compare Runs:</div>
              <ol class="space-y-2 list-decimal list-inside">
                <li><strong>Save Baseline:</strong> Click to record current performance metrics as your reference point</li>
                <li><strong>Make Changes:</strong> Modify your Angular component (e.g., add OnPush, fix a memory leak, optimize change detection)</li>
                <li><strong>Capture Current:</strong> Click to record metrics after your changes. This enables the comparison table</li>
                <li><strong>Review Metrics:</strong> Look at the Change column to see if metrics improved (green) or regressed (red)</li>
                <li><strong>Measure Impact:</strong> Lower render counts, frequency, and costs indicate better performance</li>
              </ol>
              <div class="text-[11px] text-gray-400 mt-3">
                💡 Tip: Make small, focused changes between baseline and current to isolate the impact of each fix
              </div>
            </div>
          </div>
        }
      </section>

      <!-- NEW: ENVIRONMENT PROFILE + ROOT CAUSE ANALYSIS -->
      <section class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <!-- Environment Profile (Left) -->
        <div class="border border-gray-800 rounded bg-gray-900 p-4">
          <h3 class="text-xs font-semibold text-gray-300 uppercase mb-3">Environment Profile</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Profile Label</span>
              <strong [ngClass]="environmentHealthClass()">{{ environmentProfile() }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Idle CD Rate</span>
              <strong class="text-gray-100">{{ idleCdRate() }}/sec</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Zone Pollution Sources</span>
              <strong class="text-gray-100">{{ activeZoneSources().length }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Active Streams</span>
              <strong class="text-gray-100">{{ state.interactionProfiles().length }}</strong>
            </div>
            <div class="pt-2 border-t border-gray-800">
              <p class="text-[11px] text-gray-400 leading-relaxed">
                @if (environmentProfile().includes('High Idle') && environmentProfile().includes('Zone')) {
                  Consider reviewing zone configuration and idle-time change detection triggers.
                } @else if (environmentProfile().includes('Zone')) {
                  Zone pollution detected. Isolate zone-triggering operations to reduce render cascades.
                } @else if (environmentProfile().includes('High Idle')) {
                  High idle-time CD activity. Ensure ngOnInit cleanup and limit signal subscriptions.
                } @else {
                  Environment looks healthy. Continue monitoring for changes.
                }
              </p>
            </div>
          </div>
        </div>

        <!-- Root Cause Analysis (Right) -->
        <div class="border border-gray-800 rounded bg-gray-900 p-4">
          <h3 class="text-xs font-semibold text-gray-300 uppercase mb-3">Root Cause Analysis</h3>
          @if (topIssue(); as issue) {
            <div class="space-y-3">
              <div class="p-2 border border-red-500/30 bg-red-500/10 rounded">
                <div class="text-xs font-semibold text-red-300">{{ issue.title }}</div>
                <div class="text-[11px] text-red-200 mt-1">{{ issue.description }}</div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Severity</span>
                <span class="text-xs font-bold text-red-400">{{ issue.severity }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Affected Components</span>
                <strong class="text-gray-100">{{ state.componentHotspots().length }}</strong>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Estimated Improvement</span>
                <strong class="text-green-400">{{ impactEstimate() }}% gain</strong>
              </div>
              <button
                type="button"
                class="compare-button w-full mt-2"
                (click)="navigateToTab('recommendations')"
                title="View all issues and recommendations"
              >
                View Details
              </button>
            </div>
          } @else {
            <div class="space-y-3">
              <div class="p-3 border border-dashed border-gray-700 rounded bg-gray-800/30">
                <div class="text-xs text-gray-400">No critical issues detected in current analysis.</div>
              </div>
              <p class="text-[11px] text-gray-400 leading-relaxed">
                Continue recording and interacting with the page to surface potential systemic issues.
              </p>
            </div>
          }
        </div>
      </section>

      <!-- NEW: PERFORMANCE BOTTLENECK + MEMORY STATUS -->
      <section class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <!-- Performance Bottleneck (Left) -->
        <div class="border border-gray-800 rounded bg-gray-900 p-4">
          <h3 class="text-xs font-semibold text-gray-300 uppercase mb-3">Performance Bottleneck</h3>
          @if (topHotspots()[0]; as hotspot) {
            <div class="space-y-3">
              <div class="p-2 border border-amber-500/30 bg-amber-500/10 rounded">
                <div class="text-xs font-semibold text-amber-300">{{ displayName(hotspot.componentName) }}</div>
                <div class="text-[11px] text-amber-200 mt-1">{{ hotspot.reasons.join(', ') }}</div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Primary Cause</span>
                <span class="text-xs font-bold" [ngClass]="scoreClass(hotspot.score)">
                  {{ formatCauses(hotspot.primaryCause) }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Render Frequency</span>
                <strong class="text-gray-100">{{ hotspot.rendersPerMinute.toFixed(1) }}/min</strong>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Est. Improvement</span>
                <strong class="text-green-400">{{ calculateGain(hotspot) }}% gain</strong>
              </div>
              <button
                type="button"
                class="compare-button w-full mt-2"
                (click)="navigateToComponent(hotspot.componentName)"
                title="Navigate to component details"
              >
                Investigate Component
              </button>
            </div>
          } @else {
            <div class="p-3 border border-dashed border-gray-700 rounded bg-gray-800/30">
              <div class="text-xs text-gray-400">No performance bottleneck detected yet.</div>
            </div>
          }
        </div>

        <!-- Memory Status (Right) -->
        <div class="border border-gray-800 rounded bg-gray-900 p-4">
          <h3 class="text-xs font-semibold text-gray-300 uppercase mb-3">Memory Status</h3>
          @if (memoryRiskCount() > 0) {
            <div class="space-y-3">
              <div class="p-2 border border-red-500/30 bg-red-500/10 rounded">
                <div class="text-xs font-semibold text-red-300">Cleanup Risk Detected</div>
                <div class="text-[11px] text-red-200 mt-1">{{ memoryRiskCount() }} component(s) with missing teardown</div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Leak Events</span>
                <strong class="text-red-400">{{ memoryRiskCount() }}</strong>
              </div>
              <div class="text-[11px] text-gray-400 leading-relaxed">
                Review subscription cleanup in ngOnDestroy. Timers and event listeners must be unsubscribed.
              </div>
              <button
                type="button"
                class="compare-button w-full mt-2"
                (click)="navigateToTab('memory')"
                title="View memory cleanup details"
              >
                Review Memory Issues
              </button>
            </div>
          } @else {
            <div class="space-y-3">
              <div class="p-3 border border-dashed border-gray-700 rounded bg-gray-800/30">
                <div class="text-xs text-gray-400">No memory cleanup issues detected.</div>
              </div>
              <p class="text-[11px] text-gray-400 leading-relaxed">
                Memory profile appears healthy. Continue monitoring for changes.
              </p>
            </div>
          }
        </div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Top Render Hotspots</h3>
            <span class="text-[10px] text-gray-500">{{ topHotspots().length }} shown</span>
          </div>

          @if (topHotspots().length === 0) {
            <div class="p-4 text-sm text-gray-500">No component hotspots in this recording.</div>
          } @else {
            <div class="divide-y divide-gray-800">
              @for (hotspot of topHotspots(); track hotspot.componentName; let index = $index) {
                <button
                  type="button"
                  (click)="selectHotspot(hotspot)"
                  class="w-full text-left px-4 py-3 hover:bg-gray-800/60 transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <div class="rank-pill" [ngClass]="scoreClass(hotspot.score)">
                      {{ index + 1 }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-gray-100 truncate">
                            {{ displayName(hotspot.componentName) }}
                          </div>
                          <div class="text-xs text-gray-500 mt-0.5 truncate">
                            {{ hotspot.reasons.join(', ') }}
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="text-sm font-bold" [ngClass]="scoreClass(hotspot.score)">
                            {{ hotspot.score }}/100
                          </div>
                          <div class="text-[10px] text-gray-500">{{ causeLabel(hotspot.primaryCause) }}</div>
                        </div>
                      </div>
                      <div class="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <span class="evidence-chip">{{ hotspot.renderCount }} renders</span>
                        <span class="evidence-chip">{{ hotspot.rendersPerMinute.toFixed(1) }}/min</span>
                        <span class="evidence-chip">{{ hotspot.averageDuration.toFixed(1) }}ms avg</span>
                      </div>
                    </div>
                  </div>
                </button>
              }
            </div>
          }
        </div>

        <div class="border border-gray-800 rounded bg-gray-900 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Fix First</h3>
            <span class="text-[10px] text-gray-500">{{ quickWins().length }} shown</span>
          </div>

          @if (quickWins().length === 0) {
            <div class="p-4 text-sm text-gray-500">No quick wins ranked yet.</div>
          } @else {
            <div class="divide-y divide-gray-800">
              @for (action of quickWins(); track action.id; let index = $index) {
                <button
                  type="button"
                  (click)="selectAction(action)"
                  class="w-full text-left px-4 py-3 hover:bg-gray-800/60 transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <div class="rank-pill text-green-300">
                      {{ index + 1 }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-100 truncate">{{ action.title }}</div>
                      <div class="text-xs text-gray-500 mt-0.5 truncate">{{ displayName(action.componentName) }}</div>
                      <div class="text-xs text-gray-300 mt-2">{{ action.evidence }}</div>
                      <div class="flex flex-wrap gap-1.5 mt-3">
                        <span class="badge" [ngClass]="confidenceClass(action.confidence)">{{ action.confidence }}</span>
                        <span class="badge" [ngClass]="difficultyClass(action.difficulty)">{{ action.difficulty }}</span>
                        <span class="badge" [ngClass]="gainClass(action.expectedGain)">{{ action.expectedGain }} gain</span>
                      </div>
                    </div>
                  </div>
                </button>
              }
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .metric-cell,
    .diagnosis-card {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
      position: relative;
    }

    .diagnosis-card {
      min-height: 98px;
    }

    .metric-cell span,
    .diagnosis-card span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .metric-cell strong,
    .diagnosis-card strong {
      display: block;
      color: #f3f4f6;
      font-size: 15px;
      margin-top: 2px;
      overflow-wrap: anywhere;
    }

    .metric-cell small,
    .diagnosis-card small {
      display: block;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.2;
      margin-top: 2px;
      overflow-wrap: anywhere;
    }

    /* Tooltip wrapper for icon-only hover */
    .tooltip-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    /* Tooltip styles for bottom metrics (show above) */
    .metric-cell:not(.top-metric) .tooltip-wrapper:hover::after,
    .diagnosis-card .tooltip-wrapper:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      right: 0;
      background: #1f2937;
      border: 1px solid #4b5563;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 11px;
      color: #d1d5db;
      font-weight: 400;
      text-transform: none;
      white-space: normal;
      max-width: 220px;
      width: max-content;
      z-index: 10;
      margin-bottom: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      line-height: 1.4;
      word-break: break-word;
    }

    .metric-cell:not(.top-metric) .tooltip-wrapper:hover::before,
    .diagnosis-card .tooltip-wrapper:hover::before {
      content: '';
      position: absolute;
      bottom: calc(100% - 2px);
      right: 8px;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #1f2937;
      z-index: 10;
    }

    /* Tooltip styles for top metrics (show below) */
    .metric-cell.top-metric .tooltip-wrapper {
      position: relative;
    }

    .metric-cell.top-metric .tooltip-wrapper:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      top: 100%;
      right: 0;
      background: #1f2937;
      border: 1px solid #4b5563;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 11px;
      color: #d1d5db;
      font-weight: 400;
      text-transform: none;
      white-space: normal;
      max-width: 240px;
      width: max-content;
      z-index: 50;
      margin-top: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      line-height: 1.4;
      word-break: break-word;
    }

    .metric-cell.top-metric .tooltip-wrapper:hover::before {
      content: '';
      position: absolute;
      top: calc(100% - 2px);
      right: 8px;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid #1f2937;
      z-index: 50;
    }

    .rank-pill {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      border: 1px solid rgb(75 85 99 / 0.7);
      background: rgb(31 41 55 / 0.55);
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .evidence-chip,
    .badge {
      border: 1px solid rgb(75 85 99 / 0.55);
      border-radius: 4px;
      padding: 3px 6px;
      min-width: 0;
    }

    .evidence-chip {
      color: #d1d5db;
      background: rgb(17 24 39 / 0.45);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .compare-button {
      border: 1px solid rgb(75 85 99 / 0.75);
      border-radius: 4px;
      color: #d1d5db;
      background: rgb(31 41 55 / 0.65);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      padding: 6px 8px;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .compare-button:hover:not(:disabled) {
      background: rgb(55 65 81 / 0.85);
      border-color: rgb(96 165 250 / 0.55);
      color: #f3f4f6;
    }

    .compare-button.muted {
      color: #9ca3af;
      background: rgb(17 24 39 / 0.45);
    }

    .compare-empty {
      border: 1px dashed rgb(75 85 99 / 0.65);
      border-radius: 4px;
      padding: 10px;
      background: rgb(17 24 39 / 0.35);
      min-width: 0;
    }

    .compare-empty span {
      display: block;
      color: #9ca3af;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .compare-empty strong {
      display: block;
      color: #d1d5db;
      font-size: 13px;
      margin-top: 4px;
    }

    .change-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      border-radius: 4px;
      border: 1px solid rgb(75 85 99 / 0.6);
      padding: 3px 6px;
      font-size: 11px;
      font-weight: 800;
    }

    /* Verdict label styling */
    .change-pill + span {
      white-space: nowrap;
    }
  `],
})
export class OverviewComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;
  readonly confidenceClass = confidenceClass;
  readonly difficultyClass = difficultyClass;
  readonly gainClass = gainClass;

  readonly actions = computed(() => buildRecommendationActions({
    trackByIssues: this.state.trackByIssues(),
    onPushRecommendations: this.state.onPushRecommendations(),
    hotspots: this.state.componentHotspots(),
    zonePollutionSources: this.state.zonePollutionSources(),
    leakEvents: this.state.leakEvents(),
  }));

  readonly quickWins = computed(() => topQuickWins(this.actions(), 3));
  readonly topAction = computed(() => this.quickWins()[0] ?? this.actions()[0] ?? null);
  readonly topHotspots = computed(() => this.state.componentHotspots().slice(0, 3));

  // ============================================================================
  // NEW COMPUTED HELPER METHODS (Action-Oriented Command Center)
  // ============================================================================

  readonly idleCdRate = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) return 0;
    // Calculate idle renders (renders with no user interaction detected)
    const idleEvents = events.filter(e => !e.interactionComponent);
    const first = events[0].timestamp;
    const last = events[events.length - 1].timestamp;
    const seconds = Math.max((last - first) / 1000, 1);
    return Number((idleEvents.length / seconds).toFixed(2));
  });

  readonly activeZoneSources = computed(() => {
    return this.state.zonePollutionSources().filter(source => source.severity !== 'low');
  });

  readonly environmentProfile = computed(() => {
    const idleRate = this.idleCdRate();
    const zoneSources = this.activeZoneSources().length;
    const hasHighActivity = idleRate > 5;
    const hasZonePollution = zoneSources > 0;

    if (hasZonePollution && hasHighActivity) return 'High Idle Activity + Zone Pollution';
    if (hasZonePollution) return 'Zone Pollution Detected';
    if (hasHighActivity) return 'High Idle Activity';
    return 'Clean Environment';
  });

  readonly environmentHealthClass = computed(() => {
    const profile = this.environmentProfile();
    if (profile.includes('High Idle') && profile.includes('Zone')) return 'text-red-400';
    if (profile.includes('Zone') || profile.includes('High Idle')) return 'text-amber-400';
    return 'text-green-400';
  });

  readonly topIssue = computed(() => {
    const criticalIssues = this.state.allIssues().filter(i => i.severity === 'CRITICAL');
    if (criticalIssues.length === 0) return null;
    return criticalIssues[0];
  });

  readonly impactEstimate = computed(() => {
    const topAction = this.topAction();
    if (!topAction) return 0;
    // Extract numeric percentage from expectedGain like "25% gain"
    const match = topAction.expectedGain.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 15;
  });

  readonly criticalIssueCount = computed(() => {
    return this.state.allIssues().filter(i => i.severity === 'CRITICAL').length;
  });

  readonly calculateGain = (hotspot: ComponentHotspot): number => {
    // Estimate improvement percentage based on render count and frequency
    const frequency = hotspot.rendersPerMinute;
    if (frequency > 100) return 40;
    if (frequency > 50) return 25;
    if (frequency > 20) return 15;
    return 8;
  };

  readonly formatCauses = (cause: string): string => {
    const causeMap: Record<string, string> = {
      zone: 'Zone Pollution',
      parent: 'Parent Cascade',
      input: 'Input Changes',
      signal: 'Signal Update',
      'manual-cd': 'Manual Trigger',
      unknown: 'Unknown',
    };
    return causeMap[cause] || cause;
  };

  readonly navigateToTab = (tab: 'memory' | 'recommendations' | 'rendering' | 'overview') => {
    this.state.activeTab.set(tab);
  };

  readonly navigateToComponent = (name: string) => {
    this.state.selectedComponent.set(name);
  };

  readonly verdictClass = (verdict: CompareMetric['verdict']): string => {
    switch (verdict) {
      case 'better':
        return 'text-green-400';
      case 'worse':
        return 'text-red-400';
      case 'same':
        return 'text-gray-400';
    }
  };

  readonly verdictLabel = (verdict: CompareMetric['verdict']): string => {
    switch (verdict) {
      case 'better':
        return '✓ Better';
      case 'worse':
        return '✗ Worse';
      case 'same':
        return '— No change';
    }
  };

  // ============================================================================
  // END NEW COMPUTED HELPER METHODS
  // ============================================================================

  readonly issuesCount = computed(() => this.state.allIssues().length);
  readonly componentsCount = computed(() => this.state.componentStats().length);
  readonly memoryRiskCount = computed(() => this.state.leakEvents().length);
  readonly hotspotsCount = computed(() => this.state.componentHotspots().filter(h => h.score >= 70).length);
  readonly interactionsCount = computed(() => this.state.interactionProfiles().length);
  readonly highestHotspotScore = computed(() => this.topHotspots()[0]?.score ?? 0);

  readonly hasActivity = computed(() =>
    this.state.renderEvents().length > 0 ||
    this.state.leakEvents().length > 0 ||
    this.state.trackByIssues().length > 0 ||
    this.state.onPushRecommendations().length > 0 ||
    this.state.zonePollutionSources().length > 0
  );

  readonly diagnosisCards = computed<DiagnosisCard[]>(() => {
    const topAction = this.topAction();
    const topHotspot = this.topHotspots()[0];

    if (!this.hasActivity()) {
      return [
        {
          label: 'What happened',
          value: 'Nothing captured yet',
          detail: 'Start tracking and use the Angular page to collect render, cleanup, and recommendation signals.',
          className: 'text-gray-200',
          tooltip: 'Summary of the most critical event detected in the current recording. Shows memory cleanup issues, hotspots, or findings.',
        },
        {
          label: 'Why it matters',
          value: 'No evidence',
          detail: 'ngLens will avoid ranking fixes until it has runtime activity from the current page.',
          className: 'text-gray-300',
          tooltip: 'Explains the performance impact and why addressing this issue is important for application user experience.',
        },
        {
          label: 'Where to look',
          value: 'Waiting',
          detail: 'The top component or source will appear here after the first meaningful recording.',
          className: 'text-gray-300',
          tooltip: 'Identifies the specific component or system area where the issue originates.',
        },
        {
          label: 'Fix first',
          value: 'Record a workflow',
          detail: 'Repeat the interaction that feels slow or suspicious, then compare the ranked evidence.',
          className: 'text-cyan-300',
          tooltip: 'The recommended first fix to implement for maximum performance improvement. Prioritized by impact and effort.',
        },
      ];
    }

    return [
      this.whatHappenedCard(topAction, topHotspot),
      this.whyItMattersCard(topAction, topHotspot),
      this.whereToLookCard(topAction, topHotspot),
      this.fixFirstCard(topAction),
    ];
  });

  readonly healthSummary = computed<HealthSummary>(() => {
    if (!this.hasActivity()) {
      return {
        label: 'Waiting for tracking data',
        detail: 'Overview will summarize the current recording once ngLens sees renders, recommendations, or memory cleanup signals.',
        className: 'text-gray-200',
      };
    }

    const topScore = this.topHotspots()[0]?.score ?? 0;
    const criticalMemory = this.state.leakEvents().some(event => event.severity === 'CRITICAL');
    const criticalZone = this.state.zonePollutionSources().some(source => source.severity === 'critical');

    if (topScore >= 90 || criticalMemory || criticalZone) {
      return {
        label: 'Critical attention needed',
        detail: 'Start with the highest-ranked action. The current recording contains a critical hotspot, zone trigger, or cleanup risk.',
        className: 'text-red-400',
      };
    }

    if (topScore >= 70 || this.actions().length > 0) {
      return {
        label: 'Actionable performance work found',
        detail: 'The recording has enough evidence to rank practical fixes. Start with quick wins, then inspect the top component hotspot.',
        className: 'text-amber-400',
      };
    }

    return {
      label: 'No major risk in this recording',
      detail: 'Captured activity looks healthy. Keep this snapshot as a baseline before making performance-sensitive changes.',
      className: 'text-green-400',
    };
  });

  renderRate(): string {
    const events = this.state.renderEvents();
    if (events.length === 0) return '0.0';
    const first = events[0].timestamp;
    const last = events[events.length - 1].timestamp;
    const minutes = Math.max((last - first) / 60000, 1 / 60);
    return (events.length / minutes).toFixed(1);
  }

  averageRenderDuration(): string {
    const events = this.state.renderEvents();
    if (events.length === 0) return '0.0';
    const total = events.reduce((sum, event) => sum + event.duration, 0);
    return (total / events.length).toFixed(1);
  }

  saveBaseline(): void {
    this.state.clearSnapshots();
    this.state.captureSnapshot('Baseline');
  }

  captureCurrent(): void {
    if (this.state.snapshots().length === 0) return;
    this.state.captureSnapshot('Current');
  }

  resetComparison(): void {
    this.state.clearSnapshots();
  }

  comparisonStatus(): string {
    const count = this.state.snapshots().length;
    if (count === 0) return 'Save a baseline before comparing a later run.';
    if (count === 1) return 'Baseline saved. Capture current after the next run.';
    return 'Lower render cost, risk, and cleanup counts are better.';
  }

  comparisonMetrics(comparison: SnapshotComparison): CompareMetric[] {
    const baseline = comparison.baseline.metrics;
    const current = comparison.current.metrics;
    const delta = comparison.delta;

    return [
      this.lowerIsBetterMetric('Render events', baseline.renders, current.renders, delta.renders),
      this.lowerIsBetterMetric('Render frequency', baseline.rendersPerMinute, current.rendersPerMinute, delta.rendersPerMinute, '/min'),
      this.lowerIsBetterMetric('Avg render cost', baseline.averageRenderDuration, current.averageRenderDuration, delta.averageRenderDuration, 'ms'),
      this.lowerIsBetterMetric('Total render cost', baseline.totalRenderDuration, current.totalRenderDuration, delta.totalRenderDuration, 'ms'),
      this.lowerIsBetterMetric('Open risks', baseline.issues, current.issues, delta.issues),
      this.lowerIsBetterMetric('Cleanup risks', baseline.leaks, current.leaks, delta.leaks),
      this.lowerIsBetterMetric('Render hotspots', baseline.hotspots, current.hotspots, delta.hotspots),
    ];
  }

  changeClass(verdict: CompareMetric['verdict']): string {
    switch (verdict) {
      case 'better':
        return 'text-green-300 bg-green-500/15 border-green-500/30';
      case 'worse':
        return 'text-red-300 bg-red-500/15 border-red-500/30';
      case 'same':
        return 'text-gray-300 bg-gray-700/25 border-gray-600/60';
    }
  }

  selectHotspot(hotspot: ComponentHotspot): void {
    this.state.selectedComponent.set(hotspot.componentName);
  }

  selectAction(action: RecommendationAction): void {
    this.state.selectedComponent.set(action.componentName);
    const matchingIssue = this.state.allIssues().find(issue =>
      issue.id === action.id ||
      issue.id === `zone-pollution-${action.componentName}` ||
      issue.id === `hotspot-${action.componentName}`
    );
    if (matchingIssue) {
      this.state.selectedIssue.set(matchingIssue);
    }
  }

  signed(value: number): string {
    const rounded = Math.abs(value) >= 10 ? Math.round(value) : Number(value.toFixed(1));
    return value > 0 ? `+${rounded}` : `${rounded}`;
  }

  deltaClass(value: number): string {
    if (value === 0) return 'text-gray-300';
    return value < 0 ? 'text-green-400' : 'text-red-400';
  }

  scoreClass(score: number): string {
    if (score >= 90) return 'text-red-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 40) return 'text-yellow-300';
    return 'text-green-400';
  }

  riskLabel(score: number): string {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'watch';
    return 'low';
  }
  getMetricChangeExplanation(metricLabel: string, verdict: CompareMetric['verdict']): string {
    const verdictText = verdict === 'better' ? 'improved' : verdict === 'worse' ? 'regressed' : 'unchanged';
    
    switch (metricLabel) {
      case 'Render events':
        return `Total renders ${verdictText}. Fewer is better. Check "Top Render Hotspots" section to identify components re-rendering excessively.`;
      
      case 'Render frequency':
        return `Render rate per minute ${verdictText}. Fewer renders/min indicates better change detection. Lower values reduce CPU usage.`;
      
      case 'Avg render cost':
        return `Average render duration ${verdictText}. Shorter render times mean faster DOM updates. Lower values improve responsiveness.`;
      
      case 'Total render cost':
        return `Total time spent rendering ${verdictText}. This is the cumulative impact. Lower totals mean better overall performance.`;
      
      case 'Open risks':
        return `Number of performance issues ${verdictText}. Fewer issues is better. Click issues in the Recommendations tab to learn how to fix them.`;
      
      case 'Cleanup risks':
        return `Memory cleanup issues ${verdictText}. Unsubscribed listeners and timers cause memory leaks. Review the Memory tab for details.`;
      
      case 'Render hotspots':
        return `Components with high render frequency ${verdictText}. Focus on optimizing top hotspots. Use OnPush strategy or memo() to reduce re-renders.`;
      
      default:
        return `Metric ${verdictText}. ${verdict === 'better' ? 'Great! Your changes improved performance.' : verdict === 'worse' ? 'This metric regressed. Review your recent changes.' : 'No significant change detected.'}`;
    }
  }

  causeLabel(cause: ComponentHotspot['primaryCause']): string {
    switch (cause) {
      case 'signal': return 'Signal';
      case 'input': return 'Input';
      case 'zone': return 'Zone';
      case 'parent': return 'Cascade';
      case 'manual-cd': return 'Manual CD';
      default: return 'Unknown';
    }
  }

  private lowerIsBetterMetric(
    label: string,
    baseline: number,
    current: number,
    delta: number,
    unit = ''
  ): CompareMetric {
    return {
      label,
      baseline: this.formatMetricValue(baseline, unit),
      current: this.formatMetricValue(current, unit),
      delta: this.formatMetricDelta(delta, unit),
      verdict: delta < 0 ? 'better' : delta > 0 ? 'worse' : 'same',
    };
  }

  private formatMetricValue(value: number, unit: string): string {
    const rounded = Math.abs(value) >= 10 || unit === ''
      ? Math.round(value).toString()
      : value.toFixed(1);
    return unit ? `${rounded}${unit}` : rounded;
  }

  private formatMetricDelta(value: number, unit: string): string {
    if (value === 0) return unit ? `0${unit}` : '0';
    const rounded = Math.abs(value) >= 10 || unit === ''
      ? Math.round(Math.abs(value)).toString()
      : Math.abs(value).toFixed(1);
    return `${value > 0 ? '+' : '-'}${rounded}${unit}`;
  }

  private whatHappenedCard(
    action: RecommendationAction | null,
    hotspot: ComponentHotspot | undefined
  ): DiagnosisCard {
    if (this.memoryRiskCount() > 0 && action?.kind === 'memory-cleanup') {
      return {
        label: 'What happened',
        value: 'Cleanup risk surfaced',
        detail: `${this.memoryRiskCount()} destroyed-component cleanup signal(s) need review.`,
        className: 'text-amber-300',
        tooltip: 'Summary of the most critical event detected in the current recording. Shows memory cleanup issues, hotspots, or findings.',
      };
    }

    if (hotspot) {
      return {
        label: 'What happened',
        value: `${displayName(hotspot.componentName)} is hottest`,
        detail: `${hotspot.renderCount} renders at ${hotspot.rendersPerMinute.toFixed(1)}/min. Main cause: ${this.causeLabel(hotspot.primaryCause)}.`,
        className: this.scoreClass(hotspot.score),
        tooltip: 'Summary of the most critical event detected in the current recording. Shows memory cleanup issues, hotspots, or findings.',
      };
    }

    if (action) {
      return {
        label: 'What happened',
        value: `${this.actions().length} fix candidate(s)`,
        detail: action.evidence,
        className: this.actionTone(action),
        tooltip: 'Summary of the most critical event detected in the current recording. Shows memory cleanup issues, hotspots, or findings.',
      };
    }

    return {
      label: 'What happened',
      value: 'Low-risk activity',
      detail: 'ngLens captured activity, but no major hotspot or cleanup signal stands out yet.',
      className: 'text-green-300',
      tooltip: 'Summary of the most critical event detected in the current recording. Shows memory cleanup issues, hotspots, or findings.',
    };
  }

  private whyItMattersCard(
    action: RecommendationAction | null,
    hotspot: ComponentHotspot | undefined
  ): DiagnosisCard {
    if (action) {
      return {
        label: 'Why it matters',
        value: `${action.expectedGain} gain potential`,
        detail: action.evidence,
        className: this.actionTone(action),
        tooltip: 'Explains the performance impact and why addressing this issue is important for application user experience.',
      };
    }

    if (hotspot) {
      return {
        label: 'Why it matters',
        value: `${this.riskLabel(hotspot.score)} render risk`,
        detail: `${hotspot.averageDuration.toFixed(1)}ms average render cost across ${hotspot.renderCount} captured renders.`,
        className: this.scoreClass(hotspot.score),
        tooltip: 'Explains the performance impact and why addressing this issue is important for application user experience.',
      };
    }

    return {
      label: 'Why it matters',
      value: 'Healthy baseline',
      detail: 'This recording can be kept as a baseline before a risky UI or state-management change.',
      className: 'text-green-300',
      tooltip: 'Explains the performance impact and why addressing this issue is important for application user experience.',
    };
  }

  private whereToLookCard(
    action: RecommendationAction | null,
    hotspot: ComponentHotspot | undefined
  ): DiagnosisCard {
    const target = action?.componentName ?? hotspot?.componentName;

    if (target) {
      return {
        label: 'Where to look',
        value: displayName(target),
        detail: action?.source
          ? `Evidence source: ${action.source}.`
          : hotspot?.reasons.join(', ') ?? 'Open the row for component-level evidence.',
        className: 'text-gray-100',
        tooltip: 'Identifies the specific component or system area where the issue originates.',
      };
    }

    return {
      label: 'Where to look',
      value: 'No clear owner',
      detail: 'There is not enough component-level evidence to point at a specific source yet.',
      className: 'text-gray-300',
      tooltip: 'Identifies the specific component or system area where the issue originates.',
    };
  }

  private fixFirstCard(action: RecommendationAction | null): DiagnosisCard {
    if (!action) {
      return {
        label: 'Fix first',
        value: 'No fix ranked',
        detail: 'Keep recording or interact with the page until ngLens can rank a concrete action.',
        className: 'text-gray-300',
        tooltip: 'The recommended first fix to implement for maximum performance improvement. Prioritized by impact and effort.',
      };
    }

    return {
      label: 'Fix first',
      value: action.title,
      detail: `${action.confidence} confidence. ${action.suggestedFix}`,
      className: this.actionTone(action),
      tooltip: 'The recommended first fix to implement for maximum performance improvement. Prioritized by impact and effort.',
    };
  }

  private actionTone(action: RecommendationAction): string {
    if (action.expectedGain === 'Large' || action.confidence === 'High') return 'text-green-300';
    if (action.expectedGain === 'Medium' || action.confidence === 'Medium') return 'text-cyan-300';
    return 'text-amber-300';
  }
}

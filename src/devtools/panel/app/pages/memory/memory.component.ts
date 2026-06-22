import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { LeakEvent } from '../../../../../types/leak-events';
import type { SeverityLevel } from '../../../../../types/panel';

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <section class="border border-gray-800 rounded bg-gray-900 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-100">Memory Cleanup Risks</h2>
            <p class="text-xs text-gray-400 mt-1">
              Heuristic cleanup signals from destroyed components. These are leads to verify, not proof of retained memory.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 min-w-[360px]">
            <div class="summary-cell border-amber-800/50 bg-amber-900/20">
              <span>Possible risks</span>
              <strong class="text-amber-300">{{ state.leakEvents().length }}</strong>
              <small>cleanup not detected</small>
            </div>
            <div class="summary-cell">
              <span>Subscriptions</span>
              <strong>{{ getLeaksByType('subscription').length }}</strong>
              <small>observable cleanup</small>
            </div>
            <div class="summary-cell">
              <span>Timers/listeners</span>
              <strong>{{ getLeaksByType('timer').length + getLeaksByType('event-listener').length }}</strong>
              <small>async resources</small>
            </div>
          </div>
        </div>
      </section>

      @if (state.leakEvents().length === 0) {
        <div class="border border-green-800/50 rounded p-8 bg-green-900/15 text-center">
          <div class="text-green-300 font-semibold mb-1">No cleanup risks observed</div>
          <div class="text-xs text-gray-400">
            No surviving subscription, timer, or listener signals have been captured in the current recording.
          </div>
        </div>
      } @else {
        <section class="border border-gray-800 rounded overflow-hidden bg-gray-900">
          <div class="px-4 py-3 border-b border-gray-800">
            <h3 class="text-xs font-semibold text-gray-300 uppercase">Possible Leak Risks</h3>
            <p class="text-[10px] text-gray-500 mt-0.5">
              {{ state.leakEvents().length }} cleanup signal(s) need review.
            </p>
          </div>

          <div class="divide-y divide-gray-800">
            @for (event of state.leakEvents(); track event.id) {
              <button
                type="button"
                class="w-full text-left px-4 py-3 hover:bg-gray-800/55 transition-colors"
                (click)="selectLeak(event)"
                [ngClass]="state.selectedIssue()?.id === event.id ? 'bg-gray-800/45' : ''"
              >
                <div class="flex items-start gap-3">
                  <span
                    class="text-[10px] font-bold px-2 py-1 rounded border whitespace-nowrap mt-0.5"
                    [ngClass]="getSeverityClass(event.severity)"
                  >
                    {{ severityLabel(event.severity) }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="font-semibold text-gray-100 truncate">
                          Possible leak risk in {{ event.componentName }}
                        </div>
                        <div class="text-xs text-gray-400 mt-1">
                          Cleanup not detected for {{ leakTypeLabel(event.leakType) }} from "{{ event.source }}".
                        </div>
                      </div>
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                        [ngClass]="confidenceClass(event)"
                      >
                        {{ confidenceLabel(event) }} confidence
                      </span>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                      <div class="evidence-cell">
                        <span>Evidence source</span>
                        <strong>{{ event.source }}</strong>
                      </div>
                      <div class="evidence-cell">
                        <span>Lifecycle</span>
                        <strong>{{ lifecycleEvidence(event) }}</strong>
                      </div>
                      <div class="evidence-cell">
                        <span>Detected</span>
                        <strong>{{ formatElapsed(event.detectedAt) }}</strong>
                      </div>
                    </div>

                    @if (state.selectedIssue()?.id === event.id) {
                      <div class="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
                        <div class="detail-box">
                          <span>Suggested fix</span>
                          <strong>{{ getLeakFix(event.leakType) }}</strong>
                        </div>
                        <div class="detail-box">
                          <span>What to verify</span>
                          <strong>{{ verificationHint(event.leakType) }}</strong>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </button>
            }
          </div>
        </section>
      }

      <section class="border border-gray-800 rounded bg-gray-900 p-4">
        <h3 class="text-xs font-semibold text-gray-300 mb-3 uppercase">Cleanup Patterns</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-300">
          <div class="pattern-cell">
            <strong>Subscriptions</strong>
            <p>Prefer AsyncPipe or <code>takeUntilDestroyed()</code> for component-owned streams.</p>
          </div>
          <div class="pattern-cell">
            <strong>Timers and listeners</strong>
            <p>Keep cleanup handles and clear timers or remove listeners during component teardown.</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .summary-cell,
    .evidence-cell,
    .detail-box,
    .pattern-cell {
      background: rgb(31 41 55 / 0.45);
      border: 1px solid rgb(55 65 81 / 0.55);
      border-radius: 4px;
      padding: 8px;
      min-width: 0;
    }

    .summary-cell span,
    .evidence-cell span,
    .detail-box span {
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

    .summary-cell small {
      display: block;
      color: #6b7280;
      font-size: 10px;
      line-height: 1.2;
      margin-top: 2px;
    }

    .evidence-cell strong,
    .detail-box strong {
      display: block;
      color: #d1d5db;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.45;
      margin-top: 4px;
      overflow-wrap: anywhere;
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

  getLeaksByType(type: LeakEvent['leakType']): LeakEvent[] {
    return this.state.leakEvents().filter(event => event.leakType === type);
  }

  getSeverityClass(severity: SeverityLevel): string {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      case 'WARNING':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'INFO':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
  }

  severityLabel(severity: SeverityLevel): string {
    switch (severity) {
      case 'CRITICAL': return 'Critical';
      case 'WARNING': return 'Warning';
      case 'INFO': return 'Info';
    }
  }

  confidenceLabel(event: LeakEvent): 'Medium' | 'Heuristic' {
    return event.leakType === 'subscription' ? 'Medium' : 'Heuristic';
  }

  confidenceClass(event: LeakEvent): string {
    return this.confidenceLabel(event) === 'Medium'
      ? 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30'
      : 'text-amber-300 bg-amber-500/15 border-amber-500/30';
  }

  leakTypeLabel(leakType: LeakEvent['leakType']): string {
    switch (leakType) {
      case 'subscription': return 'subscription';
      case 'timer': return 'timer';
      case 'event-listener': return 'event listener';
    }
  }

  lifecycleEvidence(event: LeakEvent): string {
    const elapsed = Math.max(event.detectedAt - event.createdAt, 0);
    return `${this.formatDuration(elapsed)} after create`;
  }

  getLeakFix(leakType: LeakEvent['leakType']): string {
    switch (leakType) {
      case 'subscription':
        return 'Use takeUntilDestroyed, AsyncPipe, or explicit unsubscribe when the component is destroyed.';
      case 'timer':
        return 'Store the timer handle and call clearTimeout or clearInterval during component cleanup.';
      case 'event-listener':
        return 'Store the listener cleanup function or call removeEventListener during component cleanup.';
    }
  }

  verificationHint(leakType: LeakEvent['leakType']): string {
    switch (leakType) {
      case 'subscription':
        return 'Check whether the subscription is owned by this component or intentionally managed by a longer-lived service.';
      case 'timer':
        return 'Confirm the timer is still needed after the component is destroyed; one-shot timeouts may be benign if already fired.';
      case 'event-listener':
        return 'Confirm the listener target outlives the component and that teardown removes the handler reference.';
    }
  }

  formatElapsed(timestamp: number): string {
    return `${(timestamp / 1000).toFixed(1)}s into page session`;
  }

  selectLeak(event: LeakEvent): void {
    const leakType = this.leakTypeLabel(event.leakType);
    this.state.selectedIssue.set({
      id: event.id,
      type: 'leak',
      componentName: event.componentName,
      severity: event.severity,
      title: `Possible leak risk in ${event.componentName}`,
      description: `Cleanup not detected for ${leakType} from "${event.source}" after component destruction.`,
      timestamp: event.detectedAt,
    });
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
}

import { Component, inject } from '@angular/core';
import { PanelState } from '../../state/panel.state';
import type { LeakEvent } from '../../../../../types/leak-events';

@Component({
  selector: 'app-memory',
  standalone: true,
  template: `
    @if (leakEvents().length === 0) {
      <p class="p-4 text-gray-400">No memory leaks detected</p>
    } @else {
      <div class="p-4 space-y-2">
        @for (event of leakEvents(); track event.id) {
          <button
            (click)="selectLeak(event)"
            class="w-full text-left p-3 rounded border border-gray-700 hover:border-gray-500 transition-colors"
            [class.border-blue-500]="state.selectedIssue()?.id === event.id">
            <div class="flex items-center gap-2">
              <span
                class="text-xs font-medium px-1.5 py-0.5 rounded"
                [class]="severityClass(event.severity)">
                {{ event.severity }}
              </span>
              <span class="text-sm text-gray-200">{{ event.componentName }}</span>
            </div>
            <div class="mt-1 text-xs text-gray-400">
              {{ event.leakType }} leak — source: {{ event.source }}
            </div>
          </button>
        }
      </div>
    }
  `,
})
export class MemoryComponent {
  readonly state = inject(PanelState);
  readonly leakEvents = this.state.leakEvents;

  selectLeak(event: LeakEvent): void {
    this.state.selectedIssue.set({
      id: event.id,
      type: 'leak',
      componentName: event.componentName,
      severity: event.severity,
      title: `${event.leakType} leak in ${event.componentName}`,
      description: `Unclean ${event.leakType} from "${event.source}" detected after component destruction.`,
      timestamp: event.detectedAt,
    });
  }

  severityClass(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400';
      case 'WARNING':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-blue-500/20 text-blue-400';
    }
  }
}

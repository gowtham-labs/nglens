import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { displayName } from '../../utils/display-name';
import { getSeverityLabels, type SeverityLabel } from '../../utils/severity-labels';
import { PanelState } from '../../state/panel.state';
import type { Issue } from '../../../../../types/panel';

@Component({
  selector: 'app-issue-row',
  standalone: true,
  imports: [NgClass],
  template: `
    <div
      class="px-3 py-2 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors"
      [ngClass]="{ 'bg-gray-700': selected }"
      (click)="clicked.emit()"
    >
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-medium text-gray-200 truncate flex-1">{{ displayName(issue.componentName) }}</span>
        @if (issue.type === 'render-hot') {
          @for (label of severityLabels(); track label) {
            <span
              class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
              [ngClass]="getLabelClass(label)"
            >{{ label }}</span>
          }
        } @else {
          <span
            class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
            [ngClass]="{
              'text-red-500 bg-red-500/10': issue.severity === 'CRITICAL',
              'text-amber-500 bg-amber-500/10': issue.severity === 'WARNING',
              'text-blue-500 bg-blue-500/10': issue.severity === 'INFO'
            }"
          >{{ issue.severity }}</span>
        }
      </div>
      <p class="text-xs text-gray-400 truncate">{{ displayName(issue.title) }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 72px;
    }
  `],
})
export class IssueRowComponent {
  readonly displayName = displayName;
  private readonly state = inject(PanelState);

  @Input({ required: true }) issue!: Issue;
  @Input() selected = false;
  @Output() clicked = new EventEmitter<void>();

  /** For render-hot issues, compute severity labels from component stats */
  readonly severityLabels = computed(() => {
    if (!this.issue || this.issue.type !== 'render-hot') return [];
    const stats = this.state.componentStats().find(s => s.componentName === this.issue.componentName);
    if (!stats) return [];
    return getSeverityLabels(stats);
  });

  getLabelClass(label: SeverityLabel): string {
    switch (label) {
      case 'EXCESSIVE': return 'text-red-400 bg-red-500/20';
      case 'HOT': return 'text-amber-400 bg-amber-500/20';
      case 'CASCADE': return 'text-purple-400 bg-purple-500/20';
      case 'ZONE TRIGGERED': return 'text-blue-400 bg-blue-500/20';
    }
  }
}

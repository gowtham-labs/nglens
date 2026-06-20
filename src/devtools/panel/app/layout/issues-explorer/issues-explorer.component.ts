import { Component, inject, computed, signal } from '@angular/core';
import { IssueRowComponent } from './issue-row.component';
import { PanelState } from '../../state/panel.state';
import { HighlightService } from '../../services/highlight.service';
import type { Issue } from '../../../../../types/panel';

interface IssueGroup {
  type: Issue['type'];
  label: string;
  issues: Issue[];
  icon: string;
}

@Component({
  selector: 'app-issues-explorer',
  standalone: true,
  imports: [IssueRowComponent],
  template: `
    <div class="h-full flex flex-col bg-gray-900">
      <div class="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
        <span class="text-xs font-medium text-gray-400 uppercase">Issues</span>
        <span class="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">{{ issues().length }}</span>
      </div>
      @if (issues().length === 0) {
        <div class="flex-1 flex items-center justify-center text-gray-500 text-xs">
          No issues detected
        </div>
      } @else {
        <div class="flex-1 overflow-auto">
          @for (group of groupedIssues(); track group.type) {
            <!-- Group header -->
            <div
              class="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2 cursor-pointer hover:bg-gray-800 sticky top-0 z-10"
              (click)="toggleGroup(group.type)"
            >
              <span class="text-[10px] text-gray-500">{{ isGroupCollapsed(group.type) ? '▶' : '▼' }}</span>
              <span class="text-xs text-gray-400">{{ group.icon }}</span>
              <span class="text-xs font-medium text-gray-300 flex-1">{{ group.label }}</span>
              <span class="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">{{ group.issues.length }}</span>
            </div>
            <!-- Group items -->
            @if (!isGroupCollapsed(group.type)) {
              @for (issue of group.issues; track issue.id) {
                <app-issue-row
                  [issue]="issue"
                  [selected]="issue === selectedIssue()"
                  (clicked)="selectIssue(issue)"
                />
              }
            }
          }
        </div>
      }
    </div>
  `,
})
export class IssuesExplorerComponent {
  private readonly state = inject(PanelState);
  private readonly highlightService = inject(HighlightService);
  issues = this.state.allIssues;
  selectedIssue = this.state.selectedIssue;

  private readonly collapsedGroups = signal<Set<string>>(new Set());

  groupedIssues = computed<IssueGroup[]>(() => {
    const issues = this.issues();
    const groupMap = new Map<Issue['type'], Issue[]>();

    for (const issue of issues) {
      const existing = groupMap.get(issue.type) ?? [];
      existing.push(issue);
      groupMap.set(issue.type, existing);
    }

    const groupConfig: Record<Issue['type'], { label: string; icon: string; order: number }> = {
      'render-hot': { label: 'Hot Components', icon: '🔥', order: 0 },
      'hotspot': { label: 'Performance Hotspots', icon: '📈', order: 1 },
      'leak': { label: 'Memory Risks', icon: '💧', order: 2 },
      'trackby': { label: 'Missing trackBy', icon: '🔄', order: 3 },
      'onpush': { label: 'OnPush Candidates', icon: '⚡', order: 4 },
      'zone-pollution': { label: 'Zone Pollution', icon: '⚡🔄', order: 5 },
    };

    const groups: IssueGroup[] = [];
    for (const [type, issues] of groupMap) {
      const config = groupConfig[type];
      groups.push({
        type,
        label: config.label,
        icon: config.icon,
        issues,
      });
    }

    return groups.sort((a, b) => groupConfig[a.type].order - groupConfig[b.type].order);
  });

  isGroupCollapsed(type: string): boolean {
    return this.collapsedGroups().has(type);
  }

  toggleGroup(type: string): void {
    this.collapsedGroups.update(set => {
      const next = new Set(set);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  selectIssue(issue: Issue): void {
    this.state.selectedIssue.set(issue);
    this.highlightService.highlightComponent(issue.componentName, issue.type);
  }
}

import { Component, inject, computed } from '@angular/core';
import { PanelState } from '../../state/panel.state';

@Component({
  selector: 'app-insight-panel',
  standalone: true,
  template: `
    @if (!selectedIssue()) {
      <div class="h-full flex items-center justify-center text-gray-500 text-sm">
        Select an issue to view details
      </div>
    } @else {
      <div class="h-full overflow-auto p-4">
        <div class="mb-4">
          <h2 class="text-sm font-semibold text-gray-200">{{ selectedIssue()!.title }}</h2>
          <p class="text-xs text-gray-400 mt-1">{{ selectedIssue()!.componentName }}</p>
        </div>

        @switch (selectedIssue()!.type) {
          @case ('render-hot') {
            <div class="space-y-3">
              <h3 class="text-xs font-medium text-gray-300 uppercase">Causes Breakdown</h3>
              @if (hotComponentDetail()) {
                @for (entry of hotComponentDetail()!.causes; track entry.type) {
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-400">{{ entry.type }}</span>
                    <span class="text-gray-200">{{ entry.count }}</span>
                  </div>
                }
              }
            </div>
          }
          @case ('leak') {
            <div class="space-y-3">
              <div class="text-xs">
                <span class="text-gray-400">Source: </span>
                <span class="text-gray-200">{{ leakDetail()?.source }}</span>
              </div>
              <div class="text-xs">
                <span class="text-gray-400">Created at: </span>
                <span class="text-gray-200">{{ leakDetail()?.createdAt | number }}</span>
              </div>
              <div class="text-xs">
                <span class="text-gray-400">Leak type: </span>
                <span class="text-gray-200">{{ leakDetail()?.leakType }}</span>
              </div>
            </div>
          }
          @case ('trackby') {
            <div class="space-y-3">
              <div class="text-xs">
                <span class="text-gray-400">Collection: </span>
                <span class="text-gray-200">{{ trackByDetail()?.collectionProperty }}</span>
              </div>
              <div class="text-xs">
                <span class="text-gray-400">Collection size: </span>
                <span class="text-gray-200">{{ trackByDetail()?.collectionSize }}</span>
              </div>
              <div class="text-xs text-amber-400 mt-2">
                ⚠ DOM recreation risk: Without trackBy, Angular recreates all DOM nodes on every change.
              </div>
              <div class="text-xs text-gray-300 mt-2">
                <span class="text-gray-400">Suggestion: </span>
                {{ trackByDetail()?.recommendation }}
              </div>
            </div>
          }
          @case ('onpush') {
            <div class="space-y-3">
              <div class="text-xs">
                <span class="text-gray-400">Score: </span>
                <span class="text-gray-200 font-medium">{{ onPushDetail()?.score }}/100</span>
              </div>
              <h3 class="text-xs font-medium text-gray-300 uppercase mt-3">Factors</h3>
              @if (onPushDetail()) {
                @for (factor of onPushDetail()!.factors; track factor.name) {
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-400">{{ factor.name }}</span>
                    <span [class]="factor.met ? 'text-green-400' : 'text-red-400'">
                      {{ factor.met ? '✓' : '✗' }} ({{ factor.weight * 100 }}%)
                    </span>
                  </div>
                }
              }
            </div>
          }
        }

        <div class="mt-4 pt-3 border-t border-gray-700">
          <p class="text-xs text-gray-400">{{ selectedIssue()!.description }}</p>
        </div>
      </div>
    }
  `,
})
export class InsightPanelComponent {
  private readonly state = inject(PanelState);
  selectedIssue = this.state.selectedIssue;

  hotComponentDetail = computed(() => {
    const issue = this.selectedIssue();
    if (!issue || issue.type !== 'render-hot') return null;
    const stats = this.state.componentStats().find(s => s.componentName === issue.componentName);
    if (!stats) return null;
    const causes = Object.entries(stats.causesBreakdown).map(([type, count]) => ({ type, count }));
    return { causes };
  });

  leakDetail = computed(() => {
    const issue = this.selectedIssue();
    if (!issue || issue.type !== 'leak') return null;
    return this.state.leakEvents().find(e => e.id === issue.id) ?? null;
  });

  trackByDetail = computed(() => {
    const issue = this.selectedIssue();
    if (!issue || issue.type !== 'trackby') return null;
    return this.state.trackByIssues()?.find(t => t.id === issue.id) ?? null;
  });

  onPushDetail = computed(() => {
    const issue = this.selectedIssue();
    if (!issue || issue.type !== 'onpush') return null;
    return this.state.onPushRecommendations()?.find(r => `onpush-${r.component}` === issue.id) ?? null;
  });
}

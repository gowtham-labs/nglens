import { Component, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { RecommendationsState } from '../../state/recommendations.state';
import { CodeSnippetService } from '../../services/code-snippet.service';
import { ClipboardService } from '../../services/clipboard.service';
import { ToastService } from '../../services/toast.service';
import { ProgressBarComponent } from './components/progress-bar.component';
import { FilterBarComponent } from './components/filter-bar.component';
import { RecommendationItemComponent } from './components/recommendation-item.component';
import { ToastComponent } from './components/toast.component';
import type { EnrichedRecommendation } from './types';

/**
 * Enhanced Recommendations Component
 *
 * Displays actionable performance optimization recommendations with:
 * - Progress tracking (ProgressBarComponent)
 * - Filtering by priority, type, and search (FilterBarComponent)
 * - Individual recommendation cards with copy-to-clipboard and mark-as-fixed (RecommendationItemComponent)
 * - Toast notifications for user feedback (ToastComponent)
 *
 * Wires together all services and state to provide a complete recommendations workflow.
 *
 * Validates: Requirements 1.1, 1.6, 1.7, 2.8, 2.9, 5.5, 5.6, 5.7, 5.8, 5.9, 6.4, 7.1, 7.8
 */
@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [
    CommonModule,
    ProgressBarComponent,
    FilterBarComponent,
    RecommendationItemComponent,
    ToastComponent,
  ],
  template: `
    <div class="h-full overflow-auto p-4 space-y-4">
      <!-- Toast notifications -->
      <app-toast></app-toast>

      <!-- Progress bar -->
      <app-progress-bar
        [percentage]="recommendationsState.progressPercentage()"
        [fixedCount]="recommendationsState.fixedCount()"
        [totalCount]="recommendationsState.totalCount()"
      ></app-progress-bar>

      <!-- Filter bar -->
      <app-filter-bar
        [visibleCount]="visibleCount"
      ></app-filter-bar>

      <!-- Recommendations list or empty state -->
      @if (recommendationsState.filteredRecommendations().length === 0) {
        @if (recommendationsState.enrichedRecommendations().length === 0) {
          <!-- No recommendations at all -->
          <div class="border border-green-800/50 rounded-lg p-8 bg-green-900/20 text-center">
            <div class="text-2xl mb-2">✓</div>
            <div class="text-green-300 font-semibold mb-1">No Recommendations</div>
            <div class="text-xs text-gray-400">Your Angular app is well-optimized!</div>
          </div>
        } @else {
          <!-- Recommendations exist but filtered out -->
          <div class="border border-yellow-800/50 rounded-lg p-8 bg-yellow-900/20 text-center">
            <div class="text-2xl mb-2">🔍</div>
            <div class="text-yellow-300 font-semibold mb-1">No Matching Recommendations</div>
            <div class="text-xs text-gray-400">Try adjusting your filters to see more recommendations.</div>
          </div>
        }
      } @else {
        <!-- Recommendations list -->
        <div class="space-y-3">
          @for (recommendation of recommendationsState.filteredRecommendations(); track recommendation.id) {
            <app-recommendation-item
              [recommendation]="recommendation"
              (copyCode)="onCopyCode($event)"
              (markFixed)="onMarkAsFixed($event)"
            ></app-recommendation-item>
          }
        </div>
      }
    </div>
  `,
})
export class RecommendationsComponent {
  readonly panelState = inject(PanelState);
  readonly recommendationsState = inject(RecommendationsState);
  private readonly codeSnippetService = inject(CodeSnippetService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly toastService = inject(ToastService);

  // Computed signal for visible count to pass to filter bar
  readonly visibleCount = computed(() => this.recommendationsState.filteredRecommendations().length);

  constructor() {
    // Hook into PanelState.clearActivity() to reset progress
    effect(() => {
      // This effect runs whenever panelState changes
      // We check if activity was cleared by monitoring renderEvents
      const renderEvents = this.panelState.renderEvents();
      if (renderEvents.length === 0) {
        // Activity was cleared, reset progress
        this.recommendationsState.resetProgress();
      }
    });
  }

  /**
   * Handle copy code action from recommendation item
   */
  onCopyCode(recommendation: EnrichedRecommendation): void {
    // The actual copy is handled in RecommendationItemComponent
    // This is here for potential future tracking or analytics
  }

  /**
   * Handle mark as fixed action from recommendation item
   */
  onMarkAsFixed(recommendation: EnrichedRecommendation): void {
    this.recommendationsState.toggleFixed(recommendation.id);
  }
}

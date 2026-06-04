import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { EnrichedRecommendation } from '../types';
import { CodeSnippetService } from '../../../services/code-snippet.service';
import { ClipboardService } from '../../../services/clipboard.service';
import { ToastService } from '../../../services/toast.service';

/**
 * Recommendation item component that displays a single enriched recommendation.
 * Shows priority badge, difficulty level, impact estimate, and action buttons.
 * Supports keyboard navigation and accessibility features.
 *
 * Validates: Requirements 2.2-2.7, 6.1-6.11, 13.1-13.3, 13.7
 */
@Component({
  selector: 'app-recommendation-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      [class]="getContainerClasses()"
      class="border rounded-lg p-4 transition-all duration-200"
    >
      <!-- Header with badges -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-gray-100 mb-2">{{ recommendation.title }}</h3>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Priority badge -->
            <span
              [class]="getPriorityBadgeClasses()"
              class="px-2 py-1 rounded text-xs font-semibold"
            >
              {{ recommendation.priority | uppercase }}
            </span>

            <!-- Difficulty badge -->
            <span
              [class]="getDifficultyBadgeClasses()"
              class="px-2 py-1 rounded text-xs font-semibold"
            >
              {{ recommendation.difficulty | uppercase }}
            </span>

            <!-- Fixed indicator -->
            @if (recommendation.isFixed) {
              <span class="px-2 py-1 rounded text-xs font-semibold bg-green-900/50 text-green-300 border border-green-700/50">
                ✓ Fixed
              </span>
            }
          </div>
        </div>

        <!-- Component name -->
        <div class="text-right">
          <div class="text-xs text-gray-400">Component</div>
          <div class="text-sm font-mono text-gray-300">{{ recommendation.componentName }}</div>
        </div>
      </div>

      <!-- Impact estimate -->
      <div class="mb-3 p-2 rounded bg-gray-900/50 border border-gray-700/50">
        <div class="text-xs text-gray-400">Estimated Impact</div>
        <div class="text-sm text-gray-200 font-medium">{{ recommendation.impactEstimate }}</div>
      </div>

      <!-- Description -->
      <p class="text-sm text-gray-300 mb-3">{{ recommendation.description }}</p>

      <!-- Action buttons -->
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        <!-- Copy Code button -->
        <button
          (click)="onCopyCode()"
          (keydown.enter)="onCopyCode()"
          [attr.aria-label]="'Copy code snippet for ' + recommendation.title"
          class="px-3 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          📋 Copy Code
        </button>

        <!-- Explain Why button -->
        <button
          (click)="toggleExplanation()"
          (keydown.space)="toggleExplanation()"
          [attr.aria-label]="'Explain why this recommendation is needed for ' + recommendation.title"
          [attr.aria-expanded]="isExplanationExpanded()"
          class="px-3 py-2 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          ℹ️ Explain Why
        </button>

        <!-- Mark as Fixed button -->
        <button
          (click)="onMarkAsFixed()"
          (keydown.space)="onMarkAsFixed()"
          [attr.aria-label]="(recommendation.isFixed ? 'Unmark as fixed: ' : 'Mark as fixed: ') + recommendation.title"
          [attr.aria-pressed]="recommendation.isFixed"
          [class]="recommendation.isFixed ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'"
          class="px-3 py-2 rounded text-xs font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900"
          [class.focus:ring-green-400]="recommendation.isFixed"
          [class.focus:ring-gray-400]="!recommendation.isFixed"
        >
          {{ recommendation.isFixed ? '✓ Fixed' : '☐ Mark as Fixed' }}
        </button>
      </div>

      <!-- Explanation section (expandable) -->
      @if (isExplanationExpanded()) {
        <div class="mt-4 pt-4 border-t border-gray-700/50 space-y-3">
          <!-- Recommendation text -->
          <div>
            <h4 class="text-xs font-semibold text-gray-300 mb-2 uppercase">What to do</h4>
            <p class="text-sm text-gray-300">{{ recommendation.recommendation }}</p>
          </div>

          <!-- Code example -->
          <div>
            <h4 class="text-xs font-semibold text-gray-300 mb-2 uppercase">Code Example</h4>
            <div class="bg-black/50 p-3 rounded border border-gray-700/50 text-xs font-mono text-gray-300 overflow-x-auto">
              <pre>{{ getCodeExample() }}</pre>
            </div>
          </div>

          <!-- Documentation links -->
          <div>
            <h4 class="text-xs font-semibold text-gray-300 mb-2 uppercase">Learn More</h4>
            <div class="space-y-1">
              @for (link of getDocumentationLinks(); track link.title) {
                <a
                  [href]="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-blue-400 hover:text-blue-300 underline block focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900 rounded px-1"
                >
                  → {{ link.title }}
                </a>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class RecommendationItemComponent {
  @Input() recommendation!: EnrichedRecommendation;
  @Output() copyCode = new EventEmitter<EnrichedRecommendation>();
  @Output() markFixed = new EventEmitter<EnrichedRecommendation>();

  private readonly codeSnippetService = inject(CodeSnippetService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly toastService = inject(ToastService);

  private readonly isExplanationExpandedSignal = signal(false);
  readonly isExplanationExpanded = this.isExplanationExpandedSignal.asReadonly();

  /**
   * Get container classes based on fixed status
   */
  getContainerClasses(): string {
    const baseClasses = 'border-gray-700/50 bg-gray-900/30 backdrop-blur-sm';
    if (this.recommendation.isFixed) {
      return `${baseClasses} opacity-60`;
    }
    return baseClasses;
  }

  /**
   * Get priority badge classes based on priority level
   */
  getPriorityBadgeClasses(): string {
    switch (this.recommendation.priority) {
      case 'critical':
        return 'bg-red-900/50 text-red-300 border border-red-700/50';
      case 'high':
        return 'bg-orange-900/50 text-orange-300 border border-orange-700/50';
      case 'medium':
        return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50';
      case 'low':
        return 'bg-gray-700/50 text-gray-300 border border-gray-600/50';
      default:
        return 'bg-gray-700/50 text-gray-300 border border-gray-600/50';
    }
  }

  /**
   * Get difficulty badge classes
   */
  getDifficultyBadgeClasses(): string {
    switch (this.recommendation.difficulty) {
      case 'easy':
        return 'bg-green-900/50 text-green-300 border border-green-700/50';
      case 'medium':
        return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50';
      case 'hard':
        return 'bg-red-900/50 text-red-300 border border-red-700/50';
      default:
        return 'bg-gray-700/50 text-gray-300 border border-gray-600/50';
    }
  }

  /**
   * Handle copy code button click
   */
  async onCopyCode(): Promise<void> {
    const snippet = this.generateCodeSnippet();
    const success = await this.clipboardService.copyToClipboard(snippet);

    if (success) {
      this.toastService.showSuccess('Copied code to clipboard!');
      this.copyCode.emit(this.recommendation);
    } else {
      this.toastService.showError('Failed to copy code');
    }
  }

  /**
   * Toggle explanation section visibility
   */
  toggleExplanation(): void {
    this.isExplanationExpandedSignal.update(v => !v);
  }

  /**
   * Handle mark as fixed button click
   */
  onMarkAsFixed(): void {
    this.markFixed.emit(this.recommendation);
  }

  /**
   * Generate code snippet based on recommendation type
   */
  private generateCodeSnippet(): string {
    switch (this.recommendation.type) {
      case 'onpush':
        return this.codeSnippetService.generateOnPushSnippet(this.recommendation.componentName);
      case 'trackby':
        return this.codeSnippetService.generateTrackBySnippet(
          this.recommendation.trackByData?.collectionProperty || 'items'
        );
      case 'leak':
        return this.codeSnippetService.generateLeakFixSnippet(
          this.recommendation.leakData?.leakType || 'subscription',
          this.recommendation.leakData?.source || 'myObservable$'
        );
      case 'zone-pollution':
        return this.codeSnippetService.generateZonePollutionSnippet(
          this.recommendation.zonePollutionData?.source || 'unknownSource',
          this.recommendation.zonePollutionData?.fixSuggestion
        );
      default:
        return '';
    }
  }

  /**
   * Get code example for the explanation section
   */
  getCodeExample(): string {
    return this.generateCodeSnippet();
  }

  /**
   * Get documentation links based on recommendation type
   */
  getDocumentationLinks(): Array<{ title: string; url: string }> {
    switch (this.recommendation.type) {
      case 'onpush':
        return [
          {
            title: 'Angular ChangeDetectionStrategy Documentation',
            url: 'https://angular.io/api/core/ChangeDetectionStrategy',
          },
          {
            title: 'Angular Change Detection Guide',
            url: 'https://angular.io/guide/change-detection',
          },
        ];
      case 'trackby':
        return [
          {
            title: 'Angular *ngFor trackBy Documentation',
            url: 'https://angular.io/api/common/NgForOf#trackby',
          },
          {
            title: 'Angular Performance Guide',
            url: 'https://angular.io/guide/performance-best-practices',
          },
        ];
      case 'leak':
        return [
          {
            title: 'Angular takeUntilDestroyed Documentation',
            url: 'https://angular.io/api/core/rxjs-interop/takeUntilDestroyed',
          },
          {
            title: 'RxJS Subscription Management',
            url: 'https://rxjs.dev/guide/subscription',
          },
        ];
      case 'zone-pollution':
        return [
          {
            title: 'Angular NgZone Documentation',
            url: 'https://angular.io/api/core/NgZone',
          },
          {
            title: 'Angular Zone.js Guide',
            url: 'https://angular.io/guide/zone',
          },
        ];
      default:
        return [];
    }
  }
}

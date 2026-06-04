import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecommendationsState } from '../../../state/recommendations.state';
import type { PriorityLevel, RecommendationType } from '../types';

/**
 * Filter bar component for the recommendations panel.
 * Renders priority filter buttons, type filter buttons, search input, and actionable toggle.
 * Supports keyboard navigation (Space to toggle filters) and emits filter change events.
 * Displays count of visible recommendations.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.10, 5.11, 13.1, 13.2, 13.6, 13.8
 */
@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm space-y-4">
      <!-- Priority Filters -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-gray-300 uppercase">Priority</label>
        <div class="flex flex-wrap gap-2">
          @for (priority of priorityLevels; track priority) {
            <button
              [attr.aria-pressed]="isActivePriority(priority)"
              [class]="getPriorityButtonClasses(priority)"
              (click)="togglePriority(priority)"
              (keydown.space)="togglePriority(priority)"
              class="px-3 py-1.5 rounded text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900"
              [attr.tabindex]="0"
            >
              {{ priority | titlecase }}
            </button>
          }
        </div>
      </div>

      <!-- Type Filters -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-gray-300 uppercase">Type</label>
        <div class="flex flex-wrap gap-2">
          @for (type of typeLabels; track type.value) {
            <button
              [attr.aria-pressed]="isActiveType(type.value)"
              [class]="getTypeButtonClasses(type.value)"
              (click)="toggleType(type.value)"
              (keydown.space)="toggleType(type.value)"
              class="px-3 py-1.5 rounded text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900"
              [attr.tabindex]="0"
            >
              {{ type.label }}
            </button>
          }
        </div>
      </div>

      <!-- Search Input -->
      <div class="space-y-2">
        <label for="search-input" class="text-xs font-semibold text-gray-300 uppercase">Search Component</label>
        <input
          id="search-input"
          type="text"
          placeholder="Filter by component name..."
          [value]="searchText()"
          (input)="onSearchChange($event)"
          class="w-full px-3 py-2 rounded bg-gray-900/50 border border-gray-700 text-gray-100 placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Show Only Actionable Toggle -->
      <div class="flex items-center gap-2">
        <button
          [attr.aria-pressed]="showOnlyActionable()"
          [class]="getActionableButtonClasses()"
          (click)="toggleActionable()"
          (keydown.space)="toggleActionable()"
          class="px-3 py-1.5 rounded text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900"
          [attr.tabindex]="0"
        >
          {{ showOnlyActionable() ? '✓' : '' }} Show only actionable
        </button>
      </div>

      <!-- Visible Count -->
      <div class="pt-2 border-t border-gray-700">
        <div class="text-xs text-gray-400">
          <span class="font-semibold text-gray-300">{{ visibleCount() }}</span>
          {{ visibleCount() === 1 ? 'recommendation' : 'recommendations' }} visible
        </div>
      </div>
    </div>
  `,
})
export class FilterBarComponent {
  private readonly state = inject(RecommendationsState);

  @Input() visibleCount: () => number = () => 0;
  @Output() filterChange = new EventEmitter<void>();

  readonly priorityLevels: PriorityLevel[] = ['critical', 'high', 'medium', 'low'];
  readonly typeLabels: Array<{ value: RecommendationType; label: string }> = [
    { value: 'onpush', label: 'OnPush' },
    { value: 'trackby', label: 'TrackBy' },
    { value: 'leak', label: 'Memory Leaks' },
    { value: 'zone-pollution', label: 'Zone Pollution' },
  ];

  // Expose state signals for template
  readonly activePriorityFilters = this.state.activePriorityFilters;
  readonly activeTypeFilters = this.state.activeTypeFilters;
  readonly searchText = this.state.searchText;
  readonly showOnlyActionable = this.state.showOnlyActionable;

  isActivePriority(priority: PriorityLevel): boolean {
    return this.state.activePriorityFilters().has(priority);
  }

  isActiveType(type: RecommendationType): boolean {
    return this.state.activeTypeFilters().has(type);
  }

  togglePriority(priority: PriorityLevel): void {
    this.state.togglePriorityFilter(priority);
    this.filterChange.emit();
  }

  toggleType(type: RecommendationType): void {
    this.state.toggleTypeFilter(type);
    this.filterChange.emit();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.state.setSearchText(input.value);
    this.filterChange.emit();
  }

  toggleActionable(): void {
    this.state.toggleShowOnlyActionable();
    this.filterChange.emit();
  }

  getPriorityButtonClasses(priority: PriorityLevel): string {
    const isActive = this.isActivePriority(priority);
    const baseClasses = 'border';

    switch (priority) {
      case 'critical':
        return isActive
          ? `${baseClasses} bg-red-600 border-red-500 text-white`
          : `${baseClasses} bg-red-900/30 border-red-700/50 text-red-300 hover:bg-red-900/50`;
      case 'high':
        return isActive
          ? `${baseClasses} bg-orange-600 border-orange-500 text-white`
          : `${baseClasses} bg-orange-900/30 border-orange-700/50 text-orange-300 hover:bg-orange-900/50`;
      case 'medium':
        return isActive
          ? `${baseClasses} bg-yellow-600 border-yellow-500 text-white`
          : `${baseClasses} bg-yellow-900/30 border-yellow-700/50 text-yellow-300 hover:bg-yellow-900/50`;
      case 'low':
        return isActive
          ? `${baseClasses} bg-gray-600 border-gray-500 text-white`
          : `${baseClasses} bg-gray-700/30 border-gray-600/50 text-gray-300 hover:bg-gray-700/50`;
    }
  }

  getTypeButtonClasses(type: RecommendationType): string {
    const isActive = this.isActiveType(type);
    const baseClasses = 'border';

    switch (type) {
      case 'onpush':
        return isActive
          ? `${baseClasses} bg-purple-600 border-purple-500 text-white`
          : `${baseClasses} bg-purple-900/30 border-purple-700/50 text-purple-300 hover:bg-purple-900/50`;
      case 'trackby':
        return isActive
          ? `${baseClasses} bg-blue-600 border-blue-500 text-white`
          : `${baseClasses} bg-blue-900/30 border-blue-700/50 text-blue-300 hover:bg-blue-900/50`;
      case 'leak':
        return isActive
          ? `${baseClasses} bg-pink-600 border-pink-500 text-white`
          : `${baseClasses} bg-pink-900/30 border-pink-700/50 text-pink-300 hover:bg-pink-900/50`;
      case 'zone-pollution':
        return isActive
          ? `${baseClasses} bg-cyan-600 border-cyan-500 text-white`
          : `${baseClasses} bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/50`;
    }
  }

  getActionableButtonClasses(): string {
    const isActive = this.showOnlyActionable();
    const baseClasses = 'border';

    return isActive
      ? `${baseClasses} bg-green-600 border-green-500 text-white`
      : `${baseClasses} bg-green-900/30 border-green-700/50 text-green-300 hover:bg-green-900/50`;
  }
}

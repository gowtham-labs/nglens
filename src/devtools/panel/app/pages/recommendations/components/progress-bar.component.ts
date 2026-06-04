import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-2">
      <!-- Progress text -->
      <div class="text-sm font-semibold text-gray-200">
        {{ fixedCount }} of {{ totalCount }} recommendations addressed
      </div>

      <!-- Progress bar -->
      <div
        class="w-full h-2 rounded-full bg-gray-700 overflow-hidden"
        role="progressbar"
        [attr.aria-valuenow]="percentage"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full transition-all duration-300"
          [ngClass]="getProgressBarColor()"
          [style.width.%]="percentage"
        ></div>
      </div>

      <!-- Percentage text -->
      <div class="text-xs text-gray-400">
        {{ percentage }}% complete
      </div>
    </div>
  `,
})
export class ProgressBarComponent {
  @Input() percentage: number = 0;
  @Input() fixedCount: number = 0;
  @Input() totalCount: number = 0;

  getProgressBarColor(): string {
    if (this.percentage < 30) {
      return 'bg-red-500';
    } else if (this.percentage <= 70) {
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
    }
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../services/toast.service';
import type { Toast } from '../types';

/**
 * Toast notification component that displays stacked notifications in the top-right corner.
 * Supports success (green) and error (red) styles with auto-dismiss and click-to-dismiss.
 * Includes accessibility features with role="alert" for screen reader announcements.
 *
 * Validates: Requirements 11.1, 11.3, 11.4, 11.5, 11.6, 11.7, 13.4
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          [attr.role]="'alert'"
          [class]="getToastClasses(toast.type)"
          (click)="toastService.dismiss(toast.id)"
          class="cursor-pointer transition-opacity duration-300 hover:opacity-90"
        >
          <div class="flex items-center gap-2">
            @if (toast.type === 'success') {
              <span class="text-lg">✓</span>
            } @else if (toast.type === 'error') {
              <span class="text-lg">✕</span>
            }
            <span class="text-sm font-medium">{{ toast.message }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  /**
   * Returns the appropriate Tailwind CSS classes for the toast based on its type.
   * Success toasts: green background with white text
   * Error toasts: red background with white text
   */
  getToastClasses(type: 'success' | 'error'): string {
    const baseClasses = 'px-4 py-3 rounded-md shadow-lg text-white';
    if (type === 'success') {
      return `${baseClasses} bg-green-600`;
    }
    return `${baseClasses} bg-red-600`;
  }
}

import { Injectable, signal } from '@angular/core';
import type { Toast } from '../pages/recommendations/types';

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 2000;

/**
 * Service for managing toast notifications using Angular signals.
 * Handles success/error toasts with auto-dismiss and overflow management.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  /**
   * Display a success toast notification.
   * Auto-dismisses after 2 seconds.
   */
  showSuccess(message: string): void {
    this.addToast(message, 'success');
  }

  /**
   * Display an error toast notification.
   * Auto-dismisses after 2 seconds.
   */
  showError(message: string): void {
    this.addToast(message, 'error');
  }

  /**
   * Dismiss a toast by its unique ID.
   */
  dismiss(id: string): void {
    this._toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  private addToast(message: string, type: 'success' | 'error'): void {
    const id = this.generateId();
    const toast: Toast = {
      id,
      message,
      type,
      createdAt: Date.now(),
    };

    this._toasts.update(toasts => {
      const updated = [...toasts, toast];
      // Limit to MAX_TOASTS, dismiss oldest when exceeded
      if (updated.length > MAX_TOASTS) {
        return updated.slice(updated.length - MAX_TOASTS);
      }
      return updated;
    });

    // Auto-dismiss after 2 seconds
    setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
  }

  private generateId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return Date.now().toString();
    }
  }
}

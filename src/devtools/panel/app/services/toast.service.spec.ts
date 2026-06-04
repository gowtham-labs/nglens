import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ToastService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('showSuccess', () => {
    it('should add a success toast', () => {
      service.showSuccess('Copied!');
      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toBe('Copied!');
    });

    it('should generate a unique ID for each toast', () => {
      service.showSuccess('First');
      service.showSuccess('Second');
      const toasts = service.toasts();
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });

    it('should set createdAt timestamp', () => {
      const now = Date.now();
      service.showSuccess('Test');
      const toast = service.toasts()[0];
      expect(toast.createdAt).toBeGreaterThanOrEqual(now);
    });
  });

  describe('showError', () => {
    it('should add an error toast', () => {
      service.showError('Failed!');
      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('error');
      expect(toasts[0].message).toBe('Failed!');
    });
  });

  describe('dismiss', () => {
    it('should remove a toast by ID', () => {
      service.showSuccess('Test');
      const id = service.toasts()[0].id;
      service.dismiss(id);
      expect(service.toasts()).toHaveLength(0);
    });

    it('should not affect other toasts when dismissing one', () => {
      service.showSuccess('First');
      service.showSuccess('Second');
      const firstId = service.toasts()[0].id;
      service.dismiss(firstId);
      expect(service.toasts()).toHaveLength(1);
      expect(service.toasts()[0].message).toBe('Second');
    });

    it('should handle dismissing non-existent ID gracefully', () => {
      service.showSuccess('Test');
      service.dismiss('non-existent-id');
      expect(service.toasts()).toHaveLength(1);
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss toast after 2 seconds', () => {
      service.showSuccess('Auto dismiss me');
      expect(service.toasts()).toHaveLength(1);

      vi.advanceTimersByTime(2000);
      expect(service.toasts()).toHaveLength(0);
    });

    it('should not dismiss before 2 seconds', () => {
      service.showSuccess('Still here');
      vi.advanceTimersByTime(1999);
      expect(service.toasts()).toHaveLength(1);
    });
  });

  describe('max toasts limit', () => {
    it('should limit to 5 simultaneous toasts', () => {
      for (let i = 0; i < 6; i++) {
        service.showSuccess(`Toast ${i}`);
      }
      expect(service.toasts()).toHaveLength(5);
    });

    it('should keep the newest toasts when limit is exceeded', () => {
      for (let i = 0; i < 7; i++) {
        service.showSuccess(`Toast ${i}`);
      }
      const toasts = service.toasts();
      expect(toasts[0].message).toBe('Toast 2');
      expect(toasts[4].message).toBe('Toast 6');
    });
  });

  describe('multiple operations', () => {
    it('should handle mixed success and error toasts', () => {
      service.showSuccess('Good');
      service.showError('Bad');
      const toasts = service.toasts();
      expect(toasts).toHaveLength(2);
      expect(toasts[0].type).toBe('success');
      expect(toasts[1].type).toBe('error');
    });

    it('should handle rapid add and dismiss', () => {
      service.showSuccess('One');
      service.showSuccess('Two');
      const firstId = service.toasts()[0].id;
      service.dismiss(firstId);
      service.showSuccess('Three');
      expect(service.toasts()).toHaveLength(2);
      expect(service.toasts()[0].message).toBe('Two');
      expect(service.toasts()[1].message).toBe('Three');
    });
  });
});

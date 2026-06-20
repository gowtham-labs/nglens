import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

/**
 * Test component with PROPER subscription cleanup
 * This component should NOT be flagged by SubscriptionLeakDetector
 */
@Component({
  selector: 'app-test-safe',
  template: `<div>Test Safe Component</div>`,
})
export class TestSafeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private destroyRef = inject(DestroyRef);

  // ✅ SAFE: Using destroy$ Subject pattern
  subscription1!: Subscription;

  // ✅ SAFE: Using takeUntilDestroyed (Angular 16+)
  subscription2!: Subscription;

  // ✅ SAFE: Using SubSink pattern
  subscriptions: Subscription[] = [];

  constructor() {}

  ngOnInit() {
    // SAFE 1: Using destroy$ Subject with takeUntil
    this.subscription1 = interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('Safe Tick 1');
      });

    // SAFE 2: Using takeUntilDestroyed (Angular 16+)
    this.subscription2 = interval(2000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        console.log('Safe Tick 2');
      });

    // SAFE 3: Array of subscriptions with cleanup
    this.subscriptions.push(
      interval(3000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          console.log('Safe Tick 3');
        })
    );

    this.subscriptions.push(
      interval(4000)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          console.log('Safe Tick 4');
        })
    );
  }

  ngOnDestroy() {
    // ✅ PROPER CLEANUP
    this.destroy$.next();
    this.destroy$.complete();
    // Note: takeUntilDestroyed subscriptions auto-cleanup via destroyRef
  }
}

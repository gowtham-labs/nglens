import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subject } from 'rxjs';
import { Subscription } from 'rxjs';

/**
 * Test component with intentional subscription leaks
 * This component is designed to be detected by SubscriptionLeakDetector
 */
@Component({
  selector: 'app-test-leak',
  template: `<div>Test Leak Component</div>`,
})
export class TestLeakComponent implements OnInit, OnDestroy {
  // ✅ LEAK 1: Single subscription without cleanup
  subscription1: Subscription;

  // ✅ LEAK 2: Multiple subscriptions without cleanup
  subscription2: Subscription;
  subscription3: Subscription;

  // ✅ LEAK 3: Subscription array without cleanup
  subscriptions: Subscription[] = [];

  constructor() {}

  ngOnInit() {
    // LEAK 1: Subscription stored but never unsubscribed
    this.subscription1 = interval(1000).subscribe(() => {
      console.log('Tick 1');
    });

    // LEAK 2: Multiple subscriptions without cleanup
    this.subscription2 = interval(2000).subscribe(() => {
      console.log('Tick 2');
    });

    this.subscription3 = interval(3000).subscribe(() => {
      console.log('Tick 3');
    });

    // LEAK 3: Array of subscriptions without cleanup
    this.subscriptions.push(
      interval(4000).subscribe(() => {
        console.log('Tick 4');
      })
    );

    this.subscriptions.push(
      interval(5000).subscribe(() => {
        console.log('Tick 5');
      })
    );
  }

  ngOnDestroy() {
    // ❌ NO CLEANUP - This is intentional to demonstrate leaks
    // In a real app, you would do:
    // this.subscription1?.unsubscribe();
    // this.subscription2?.unsubscribe();
    // this.subscription3?.unsubscribe();
    // this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}

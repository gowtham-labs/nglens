/**
 * Test component demonstrating inline subscription leak detection.
 * 
 * This component has inline subscriptions that are NOT assigned to properties:
 * - interval(1000).subscribe() - creates a leak
 * - timer(0, 500).subscribe() - creates a leak
 * 
 * These are now detected by the enhanced SubscriptionLeakDetector.
 */

import { Component, OnInit } from '@angular/core';
import { interval, timer } from 'rxjs';

@Component({
  selector: 'app-test-inline-leak',
  template: `<div>Inline Leak Test Component</div>`,
})
export class TestInlineLeakComponent implements OnInit {
  ngOnInit() {
    // LEAK 1: Inline subscription - not assigned to property
    // This will emit every 1000ms and never unsubscribe
    interval(1000).subscribe(value => {
      console.log('Interval tick:', value);
    });

    // LEAK 2: Another inline subscription
    // This will emit every 500ms and never unsubscribe
    timer(0, 500).subscribe(value => {
      console.log('Timer tick:', value);
    });

    // LEAK 3: Observable chain with inline subscription
    // This will never unsubscribe
    interval(2000)
      .subscribe(value => {
        console.log('Another interval:', value);
      });
  }

  // No ngOnDestroy - subscriptions will never be cleaned up
}

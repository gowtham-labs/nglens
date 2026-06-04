/**
 * Test Component with Intentional Subscription Leak
 * 
 * Add this to your dashboard module to test the detector
 * 
 * Usage:
 * 1. Import this component in your module
 * 2. Add it to declarations
 * 3. Add <app-test-leak></app-test-leak> to your template
 * 4. Open ngLens Memory tab
 * 5. You should see "1 unclean subscriptions" reported
 */

import { Component, OnInit } from '@angular/core';
import { interval } from 'rxjs';

@Component({
  selector: 'app-test-leak',
  template: `<div>Test Leak Component - Check ngLens Memory tab</div>`,
  standalone: true
})
export class TestLeakComponent implements OnInit {
  ngOnInit() {
    // INTENTIONAL LEAK: This subscription is never cleaned up
    interval(1000).subscribe(value => {
      console.log('Interval tick:', value);
    });

    // INTENTIONAL LEAK: Another subscription
    interval(2000).subscribe(value => {
      console.log('Another interval:', value);
    });
  }
}

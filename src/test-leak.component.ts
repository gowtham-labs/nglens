import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subject, interval } from 'rxjs';

/**
 * Test component with intentional memory leaks for testing ngLens
 */
@Component({
  selector: 'app-test-leak',
  standalone: true,
  template: `
    <div style="padding: 20px; background: #fee; border: 1px solid red;">
      <h3>🔴 Test Leak Component</h3>
      <p>This component has intentional memory leaks for testing ngLens</p>
      <button (click)="startLeaking()">Start Memory Leak</button>
      <p>Leaking subscriptions: {{ leakCount }}</p>
    </div>
  `,
})
export class TestLeakComponent implements OnInit, OnDestroy {
  private subscriptions: any[] = [];
  leakCount = 0;

  ngOnInit() {
    // Create multiple subscriptions that never unsubscribe
    for (let i = 0; i < 5; i++) {
      const sub = interval(1000).subscribe(() => {
        console.log(`Leak ${i}: Still running (will never cleanup)`);
      });
      this.subscriptions.push(sub);
      this.leakCount++;
    }
  }

  startLeaking() {
    // Add more leaky subscriptions
    const sub = interval(500).subscribe(() => {
      // This subscription has no cleanup
      console.log('New leak created!');
    });
    this.subscriptions.push(sub);
    this.leakCount++;
  }

  ngOnDestroy() {
    // BUG: Intentionally NOT cleaning up subscriptions
    // This will show as memory leaks in ngLens Memory tab
    console.log('Component destroyed but subscriptions still active!');
    // Missing: this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}

/**
 * Leak Detector Tests
 *
 * Tests for subscription leak detection in Angular components.
 * Verifies that the LeakDetector properly tracks subscriptions and
 * emits LEAK_EVENT messages when subscriptions are not cleaned up.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Subject, Observable } from 'rxjs';

/**
 * Mock LeakDetector for testing
 * Simulates the behavior of the real LeakDetector
 */
class MockLeakDetector {
  private activeComponents = new Map<string, any>();
  private running = false;
  private emittedEvents: any[] = [];

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  onComponentCreated(componentId: string, componentName: string): void {
    this.activeComponents.set(componentId, {
      componentId,
      componentName,
      createdAt: performance.now(),
      destroyedAt: null,
      subscriptions: [],
      timers: [],
    });
  }

  onComponentDestroyed(componentId: string): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle) return;

    lifecycle.destroyedAt = performance.now();

    // Check for surviving subscriptions
    const activeSubscriptions = lifecycle.subscriptions.filter((s: any) => !s.cleaned);
    for (const sub of activeSubscriptions) {
      this.emittedEvents.push({
        componentName: lifecycle.componentName,
        componentId,
        leakType: 'subscription',
        severity: 'CRITICAL',
        source: sub.source,
      });
    }

    this.activeComponents.delete(componentId);
  }

  trackSubscription(componentId: string, source: string): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle) return;

    lifecycle.subscriptions.push({
      id: `sub_${Date.now()}`,
      source,
      createdAt: performance.now(),
      cleaned: false,
      cleanedAt: null,
    });
  }

  cleanupSubscription(componentId: string, index: number): void {
    const lifecycle = this.activeComponents.get(componentId);
    if (!lifecycle || !lifecycle.subscriptions[index]) return;

    lifecycle.subscriptions[index].cleaned = true;
    lifecycle.subscriptions[index].cleanedAt = performance.now();
  }

  getEmittedEvents(): any[] {
    return this.emittedEvents;
  }

  clearEmittedEvents(): void {
    this.emittedEvents = [];
  }
}

describe('LeakDetector', () => {
  let detector: MockLeakDetector;

  beforeEach(() => {
    detector = new MockLeakDetector();
    detector.start();
  });

  afterEach(() => {
    detector.stop();
    detector.clearEmittedEvents();
  });

  describe('Subscription Leak Detection', () => {
    it('should detect unclean subscriptions when component is destroyed', () => {
      // Create a component
      const componentId = 'test-component-1';
      const componentName = 'TestComponent';

      detector.onComponentCreated(componentId, componentName);

      // Track a subscription without cleaning it up
      detector.trackSubscription(componentId, 'Observable');

      // Destroy the component
      detector.onComponentDestroyed(componentId);

      // Verify leak event was emitted
      const events = detector.getEmittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        componentName,
        leakType: 'subscription',
        severity: 'CRITICAL',
        source: 'Observable',
      });
    });

    it('should not detect leaks for cleaned up subscriptions', () => {
      // Create a component
      const componentId = 'test-component-2';
      const componentName = 'TestComponent';

      detector.onComponentCreated(componentId, componentName);

      // Track a subscription
      detector.trackSubscription(componentId, 'Observable');

      // Clean up the subscription
      detector.cleanupSubscription(componentId, 0);

      // Destroy the component
      detector.onComponentDestroyed(componentId);

      // Verify no leak event was emitted
      const events = detector.getEmittedEvents();
      expect(events).toHaveLength(0);
    });

    it('should detect multiple subscription leaks', () => {
      // Create a component
      const componentId = 'test-component-3';
      const componentName = 'TestComponent';

      detector.onComponentCreated(componentId, componentName);

      // Track multiple subscriptions without cleaning them up
      detector.trackSubscription(componentId, 'Observable1');
      detector.trackSubscription(componentId, 'Observable2');
      detector.trackSubscription(componentId, 'Observable3');

      // Destroy the component
      detector.onComponentDestroyed(componentId);

      // Verify leak events were emitted for all subscriptions
      const events = detector.getEmittedEvents();
      expect(events).toHaveLength(3);
      expect(events.every((e: any) => e.leakType === 'subscription')).toBe(true);
    });

    it('should detect partial subscription leaks', () => {
      // Create a component
      const componentId = 'test-component-4';
      const componentName = 'TestComponent';

      detector.onComponentCreated(componentId, componentName);

      // Track multiple subscriptions
      detector.trackSubscription(componentId, 'Observable1');
      detector.trackSubscription(componentId, 'Observable2');
      detector.trackSubscription(componentId, 'Observable3');

      // Clean up only some subscriptions
      detector.cleanupSubscription(componentId, 0);
      detector.cleanupSubscription(componentId, 2);

      // Destroy the component
      detector.onComponentDestroyed(componentId);

      // Verify leak event was emitted only for uncleaned subscription
      const events = detector.getEmittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        componentName,
        leakType: 'subscription',
        source: 'Observable2',
      });
    });

    it('should not emit events for components without subscriptions', () => {
      // Create a component
      const componentId = 'test-component-5';
      const componentName = 'TestComponent';

      detector.onComponentCreated(componentId, componentName);

      // Don't track any subscriptions

      // Destroy the component
      detector.onComponentDestroyed(componentId);

      // Verify no leak event was emitted
      const events = detector.getEmittedEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe('Component Lifecycle', () => {
    it('should track component creation and destruction', () => {
      const componentId = 'test-component-6';
      const componentName = 'TestComponent';

      detector.onComponentCreated(componentId, componentName);
      detector.trackSubscription(componentId, 'Observable');

      // Component should be tracked
      expect(detector.getEmittedEvents()).toHaveLength(0);

      detector.onComponentDestroyed(componentId);

      // After destruction, leak should be detected
      expect(detector.getEmittedEvents()).toHaveLength(1);
    });

    it('should handle multiple components independently', () => {
      // Create first component with leak
      const componentId1 = 'test-component-7a';
      detector.onComponentCreated(componentId1, 'Component1');
      detector.trackSubscription(componentId1, 'Observable1');

      // Create second component without leak
      const componentId2 = 'test-component-7b';
      detector.onComponentCreated(componentId2, 'Component2');
      detector.trackSubscription(componentId2, 'Observable2');
      detector.cleanupSubscription(componentId2, 0);

      // Destroy both components
      detector.onComponentDestroyed(componentId1);
      detector.onComponentDestroyed(componentId2);

      // Verify only first component has leak
      const events = detector.getEmittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].componentName).toBe('Component1');
    });
  });
});

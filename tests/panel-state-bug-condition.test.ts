/**
 * Property 1: Bug Condition Exploration Test
 *
 * This property-based test explores the bug condition where the clearOnRouteChange
 * toggle state is not persisted to browser storage. When the DevTools panel is
 * closed and reopened (or the extension is reloaded), the toggle state resets to
 * its default value instead of being restored from storage.
 *
 * **Expected Behavior**: The test MUST FAIL on unfixed code to confirm the bug exists.
 * The failure demonstrates that clearOnRouteChange() does not equal the previously
 * set value after simulating a panel close/reopen cycle.
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Injector, runInInjectionContext } from '@angular/core';
import { PanelState } from '../src/devtools/panel/app/state/panel.state';
import { StorageService } from '../src/devtools/panel/app/services/storage.service';

describe('Property 1: Bug Condition Exploration - clearOnRouteChange Persistence', () => {
  let mockLocalStorage: Record<string, string>;
  let injector: Injector;

  /**
   * Creates a PanelState instance within an Angular injection context.
   * This is needed because PanelState uses inject(StorageService).
   */
  function createPanelState(): PanelState {
    return runInInjectionContext(injector, () => new PanelState());
  }

  beforeEach(() => {
    // Mock localStorage for testing
    mockLocalStorage = {};

    global.localStorage = {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        mockLocalStorage = {};
      },
      length: 0,
      key: () => null,
    } as Storage;

    // Create a simple injector with StorageService provided as a value instance
    const storageService = new StorageService();
    injector = Injector.create({
      providers: [
        { provide: StorageService, useValue: storageService },
      ],
    });
  });

  afterEach(() => {
    mockLocalStorage = {};
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Bug Condition: When a user sets clearOnRouteChange to true and then the panel
   * is closed and reopened (simulated by creating a new PanelState instance),
   * the toggle state should be restored from storage but currently resets to false.
   *
   * This test MUST FAIL on unfixed code, proving the bug exists.
   */
  it('should restore clearOnRouteChange from storage after panel reopen', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (toggleValue: boolean) => {
          // Clear storage before test
          mockLocalStorage = {};

          // Step 1: Create initial PanelState and set clearOnRouteChange
          const initialState = createPanelState();
          initialState.clearOnRouteChange.set(toggleValue);

          // Step 2: Simulate panel close/reopen by creating a new PanelState instance
          // In real scenario, this would be after localStorage is persisted
          const reopenedState = createPanelState();

          // Step 3: Verify that the toggle state is restored from storage
          // BUG: On unfixed code, this will fail because the new instance
          // initializes to false (default) instead of reading from storage
          expect(reopenedState.clearOnRouteChange()).toBe(toggleValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Bug Condition: Verify that the bug manifests for both true and false toggle states.
   * The test explores both toggle states to ensure the bug is consistent.
   */
  it('should preserve clearOnRouteChange=true across panel reopen', () => {
    fc.assert(
      fc.property(fc.nat(), (seed: number) => {
        mockLocalStorage = {};

        const state1 = createPanelState();
        state1.clearOnRouteChange.set(true);

        // Simulate panel reopen
        const state2 = createPanelState();

        // BUG: state2.clearOnRouteChange() should be true but will be false
        expect(state2.clearOnRouteChange()).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Bug Condition: Verify that the bug manifests when toggling from false to true.
   * This explores the specific scenario where a user enables the toggle.
   */
  it('should preserve clearOnRouteChange when toggled from false to true', () => {
    fc.assert(
      fc.property(fc.nat(), (seed: number) => {
        mockLocalStorage = {};

        // Start with default (false)
        const state1 = createPanelState();
        expect(state1.clearOnRouteChange()).toBe(false);

        // User toggles to true
        state1.clearOnRouteChange.set(true);
        expect(state1.clearOnRouteChange()).toBe(true);

        // Simulate panel reopen
        const state2 = createPanelState();

        // BUG: state2.clearOnRouteChange() should be true but will be false
        expect(state2.clearOnRouteChange()).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Bug Condition: Verify that multiple toggle changes are not persisted.
   * This explores the scenario where a user toggles multiple times.
   */
  it('should preserve clearOnRouteChange after multiple toggles', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
        (toggleSequence: boolean[]) => {
          mockLocalStorage = {};

          const state1 = createPanelState();

          // Apply multiple toggles
          for (const value of toggleSequence) {
            state1.clearOnRouteChange.set(value);
          }

          const finalValue = toggleSequence[toggleSequence.length - 1];

          // Simulate panel reopen
          const state2 = createPanelState();

          // BUG: state2.clearOnRouteChange() should equal finalValue but will be false
          expect(state2.clearOnRouteChange()).toBe(finalValue);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Bug Condition: Verify that the bug affects the ROUTE_CHANGED handler behavior.
   * When clearOnRouteChange is not persisted, the handler will not respect the
   * user's toggle preference after panel reopen.
   */
  it('should maintain clearOnRouteChange state for ROUTE_CHANGED handler after reopen', () => {
    fc.assert(
      fc.property(fc.boolean(), (shouldClear: boolean) => {
        mockLocalStorage = {};

        // Step 1: User sets their preference
        const state1 = createPanelState();
        state1.clearOnRouteChange.set(shouldClear);

        // Add some render events
        state1.renderEvents.set([
          {
            componentName: 'TestComponent',
            timestamp: Date.now(),
            duration: 10,
            causes: [{ type: 'signal', source: 'test' }],
          },
        ]);

        // Step 2: Simulate panel reopen
        const state2 = createPanelState();

        // Step 3: Verify toggle state is preserved
        // BUG: This will fail because state2.clearOnRouteChange() will be false
        // instead of the user's preference (shouldClear)
        expect(state2.clearOnRouteChange()).toBe(shouldClear);
      }),
      { numRuns: 50 }
    );
  });
});

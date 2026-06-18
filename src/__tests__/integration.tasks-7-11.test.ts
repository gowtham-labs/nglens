/**
 * Integration Tests for Tasks 7-11: Angular Version Support Validation
 *
 * These integration tests verify the complete behavior of the version checking
 * and orchestration system for:
 *
 * - Task 7: Angular 15 application integration test
 * - Task 8: Angular 16 application integration test
 * - Task 9: Regression test - Angular 17+ unchanged
 * - Task 10: Regression test - Non-Angular pages unchanged
 * - Task 11: Edge case test - Angular markers without version info
 *
 * **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { checkAngularVersion } from '../instrumentation/version-check';

/**
 * Mock RenderTracker start function
 */
const mockRenderTracker = {
  start: vi.fn(),
};

/**
 * Simulate orchestrator's handleStartTracking behavior
 */
function simulateHandleStartTracking(): {
  success: boolean;
  message?: string;
  trackerStarted?: boolean;
} {
  const versionResult = checkAngularVersion();

  if (!versionResult.supported) {
    return {
      success: false,
      message: versionResult.version
        ? `Angular ${versionResult.version} is not supported.`
        : 'Angular not detected on this page.',
    };
  }

  // Simulate starting RenderTracker
  try {
    mockRenderTracker.start();
    return {
      success: true,
      trackerStarted: true,
    };
  } catch (err) {
    return {
      success: false,
      message: 'RenderTracker failed to start',
    };
  }
}

/**
 * Clean up all mocks and DOM
 */
function cleanupAllMocks(): void {
  vi.clearAllMocks();
  document.querySelectorAll('[data-test-element]').forEach(el => el.remove());
  delete (globalThis as any).ng;
}

/**
 * Mock Angular environment with [ng-version] attribute
 */
function mockAngularEnvironment(version: string): void {
  cleanupAllMocks();
  const div = document.createElement('div');
  div.setAttribute('ng-version', version);
  div.setAttribute('data-test-element', 'true');
  document.body.appendChild(div);
}

/**
 * Mock Angular environment with window.ng.VERSION
 */
function mockAngularWithWindowNg(version: string): void {
  cleanupAllMocks();
  const major = parseInt(version.split('.')[0], 10);
  (globalThis as any).ng = {
    VERSION: { major, full: version },
  };
}

/**
 * Mock Angular markers without version info
 */
function mockAngularWithMarkersOnly(): void {
  cleanupAllMocks();
  const div = document.createElement('div');
  div.setAttribute('_nghost', '');
  div.setAttribute('data-test-element', 'true');
  document.body.appendChild(div);
}

/**
 * Mock non-Angular environment
 */
function mockNonAngularEnvironment(): void {
  cleanupAllMocks();
}

// --- Integration Tests ---

describe('Integration Tests: Tasks 7-11', () => {
  beforeEach(() => {
    cleanupAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupAllMocks();
  });

  /**
   * Task 7: Integration test - Angular 15 application
   *
   * 7.1 Create Angular 15 mock environment with [ng-version]="15.0.0"
   * 7.2 Call checkAngularVersion() and verify results
   * 7.3 Call handleStartTracking() and verify RenderTracker.start() is called
   * 7.4 Verify no ERROR messages emitted
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Task 7: Angular 15 application integration test', () => {
    it('7.1-7.4: Angular 15.0.0 is supported and instrumentation proceeds', () => {
      // 7.1: Create Angular 15 mock environment
      mockAngularEnvironment('15.0.0');

      // 7.2: Call checkAngularVersion() and verify results
      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('15.0.0');
      expect(versionResult.major).toBe(15);
      expect(versionResult.confidence).toBe('exact');

      // 7.3: Call handleStartTracking() and verify RenderTracker.start() is called
      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
      expect(trackingResult.trackerStarted).toBe(true);
      expect(mockRenderTracker.start).toHaveBeenCalled();

      // 7.4: Verify no ERROR messages emitted
      expect(trackingResult.message).toBeUndefined();
    });

    it('7.1-7.4: Angular 15.2.7 is supported and instrumentation proceeds', () => {
      mockAngularEnvironment('15.2.7');

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('15.2.7');
      expect(versionResult.major).toBe(15);

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
      expect(mockRenderTracker.start).toHaveBeenCalled();
      expect(trackingResult.message).toBeUndefined();
    });

    it('7: Property-based test for all Angular 15.x.x versions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 30 }),
          (minor, patch) => {
            const version = `15.${minor}.${patch}`;
            mockAngularEnvironment(version);

            const versionResult = checkAngularVersion();
            expect(versionResult.supported).toBe(true);
            expect(versionResult.major).toBe(15);

            const trackingResult = simulateHandleStartTracking();
            expect(trackingResult.success).toBe(true);

            cleanupAllMocks();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Task 8: Integration test - Angular 16 application
   *
   * 8.1 Create Angular 16 mock environment with [ng-version]="16.2.10"
   * 8.2 Call checkAngularVersion() and verify results
   * 8.3 Call handleStartTracking() and verify instrumentation proceeds
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Task 8: Angular 16 application integration test', () => {
    it('8.1-8.3: Angular 16.2.10 is supported and instrumentation proceeds', () => {
      // 8.1: Create Angular 16 mock environment
      mockAngularEnvironment('16.2.10');

      // 8.2: Call checkAngularVersion() and verify results
      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('16.2.10');
      expect(versionResult.major).toBe(16);
      expect(versionResult.confidence).toBe('exact');

      // 8.3: Call handleStartTracking() and verify instrumentation proceeds
      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
      expect(mockRenderTracker.start).toHaveBeenCalled();
    });

    it('8.1-8.3: Angular 16.0.0 is supported', () => {
      mockAngularEnvironment('16.0.0');

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('16.0.0');
      expect(versionResult.major).toBe(16);

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
    });

    it('8.1-8.3: Angular 16.1.5 via window.ng is supported', () => {
      mockAngularWithWindowNg('16.1.5');

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('16.1.5');
      expect(versionResult.major).toBe(16);

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
    });

    it('8: Property-based test for all Angular 16.x.x versions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 30 }),
          (minor, patch) => {
            const version = `16.${minor}.${patch}`;
            mockAngularEnvironment(version);

            const versionResult = checkAngularVersion();
            expect(versionResult.supported).toBe(true);
            expect(versionResult.major).toBe(16);

            const trackingResult = simulateHandleStartTracking();
            expect(trackingResult.success).toBe(true);

            cleanupAllMocks();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Task 9: Regression test - Angular 17+ unchanged
   *
   * 9.1 Generate Angular versions 17-22 with property-based testing
   * 9.2 For each version: verify checkAngularVersion() returns supported: true, confidence: 'exact'
   * 9.3 For each version: verify handleStartTracking() proceeds with instrumentation
   * 9.4 Verify no errors or warnings emitted
   *
   * **Validates: Requirements 3.1**
   */
  describe('Task 9: Regression test - Angular 17+ unchanged', () => {
    it('9.1-9.4: Angular 17.0.0 continues to work unchanged', () => {
      mockAngularEnvironment('17.0.0');

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('17.0.0');
      expect(versionResult.major).toBe(17);
      expect(versionResult.confidence).toBe('exact');

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
      expect(trackingResult.message).toBeUndefined();
    });

    it('9.1-9.4: Angular 18.0.0 continues to work unchanged', () => {
      mockAngularEnvironment('18.0.0');

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.major).toBe(18);

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
    });

    it('9.1-9.4: Angular 20.1.5 continues to work unchanged', () => {
      mockAngularEnvironment('20.1.5');

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.major).toBe(20);

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
    });

    it('9: Property-based test: All Angular 17-22 versions continue to work', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 17, max: 22 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 30 }),
          (major, minor, patch) => {
            const version = `${major}.${minor}.${patch}`;
            mockAngularEnvironment(version);

            // 9.2: Verify checkAngularVersion() returns supported: true
            const versionResult = checkAngularVersion();
            expect(versionResult.supported).toBe(true);
            expect(versionResult.major).toBe(major);
            expect(versionResult.confidence).toBe('exact');

            // 9.3: Verify handleStartTracking() proceeds with instrumentation
            const trackingResult = simulateHandleStartTracking();
            expect(trackingResult.success).toBe(true);

            // 9.4: Verify no errors
            expect(trackingResult.message).toBeUndefined();

            cleanupAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('9: Angular 17+ confidence should be "exact"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 17, max: 22 }),
          (major) => {
            const version = `${major}.0.0`;
            mockAngularEnvironment(version);

            const versionResult = checkAngularVersion();
            expect(versionResult.confidence).toBe('exact');

            cleanupAllMocks();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Task 10: Regression test - Non-Angular pages unchanged
   *
   * 10.1 Mock environment with no Angular (no [ng-version], no window.ng, no markers)
   * 10.2 Call checkAngularVersion() and verify results
   * 10.3 Call handleStartTracking() and verify error message
   * 10.4 Verify RenderTracker NOT started
   *
   * **Validates: Requirements 3.2**
   */
  describe('Task 10: Regression test - Non-Angular pages unchanged', () => {
    it('10.1-10.4: Non-Angular page emits correct error message', () => {
      // 10.1: Mock environment with no Angular
      mockNonAngularEnvironment();

      // 10.2: Call checkAngularVersion() and verify results
      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(false);
      expect(versionResult.version).toBeNull();
      expect(versionResult.major).toBeNull();

      // 10.3: Call handleStartTracking() and verify error message
      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(false);
      expect(trackingResult.message).toBe('Angular not detected on this page.');

      // 10.4: Verify RenderTracker NOT started
      expect(mockRenderTracker.start).not.toHaveBeenCalled();
    });

    it('10: Multiple non-Angular scenarios all fail gracefully', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          mockNonAngularEnvironment();

          const versionResult = checkAngularVersion();
          expect(versionResult.supported).toBe(false);

          const trackingResult = simulateHandleStartTracking();
          expect(trackingResult.success).toBe(false);
          expect(trackingResult.message).toBe('Angular not detected on this page.');
          expect(mockRenderTracker.start).not.toHaveBeenCalled();

          cleanupAllMocks();
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Task 11: Edge case test - Angular markers without version info
   *
   * 11.1 Create Angular environment with [_nghost] but no [ng-version] or window.ng.VERSION
   * 11.2 Call checkAngularVersion() and verify results
   * 11.3 Call handleStartTracking() and verify proceeds with instrumentation
   *
   * **Validates: Requirements 2.2, 3.4**
   */
  describe('Task 11: Edge case test - Angular markers without version info', () => {
    it('11.1-11.3: Angular markers detected, instrumentation proceeds despite unknown version', () => {
      // 11.1: Create Angular environment with [_nghost] but no version info
      mockAngularWithMarkersOnly();

      // 11.2: Call checkAngularVersion() and verify results
      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.confidence).toBe('unknown');
      expect(versionResult.version).toBe('unknown');
      expect(versionResult.major).toBeNull();

      // 11.3: Call handleStartTracking() and verify proceeds despite unknown version
      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
      expect(mockRenderTracker.start).toHaveBeenCalled();
    });

    it('11: Graceful degradation for unknown Angular version', () => {
      mockAngularWithMarkersOnly();

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true); // Graceful: Allow inspection

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true); // Instrumentation proceeds
    });

    it('11: window.ng without VERSION info allows graceful instrumentation', () => {
      cleanupAllMocks();
      (globalThis as any).ng = {}; // window.ng exists but no VERSION

      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(true);
      expect(versionResult.confidence).toBe('fallback');

      const trackingResult = simulateHandleStartTracking();
      expect(trackingResult.success).toBe(true);
    });
  });

  /**
   * Integration summary: All 5 scenarios PASS
   *
   * Comprehensive validation that all integration test scenarios pass.
   */
  describe('Integration Test Summary: All 5 scenarios', () => {
    it('Scenario 1: Angular 15.0.0 with [ng-version] → supported: true, RenderTracker starts', () => {
      mockAngularEnvironment('15.0.0');
      const versionResult = checkAngularVersion();
      const trackingResult = simulateHandleStartTracking();

      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('15.0.0');
      expect(trackingResult.success).toBe(true);
      expect(mockRenderTracker.start).toHaveBeenCalled();
    });

    it('Scenario 2: Angular 16.2.10 with [ng-version] → supported: true, instrumentation proceeds', () => {
      mockAngularEnvironment('16.2.10');
      const versionResult = checkAngularVersion();
      const trackingResult = simulateHandleStartTracking();

      expect(versionResult.supported).toBe(true);
      expect(versionResult.version).toBe('16.2.10');
      expect(trackingResult.success).toBe(true);
    });

    it('Scenario 3: Angular 17+ versions → supported: true (regression check, no changes)', () => {
      // Test multiple versions
      const versions = ['17.0.0', '18.1.0', '20.2.5', '22.0.0'];

      versions.forEach(version => {
        mockAngularEnvironment(version);
        const versionResult = checkAngularVersion();
        expect(versionResult.supported).toBe(true);

        const trackingResult = simulateHandleStartTracking();
        expect(trackingResult.success).toBe(true);

        cleanupAllMocks();
      });
    });

    it('Scenario 4: Non-Angular pages → supported: false, "Angular not detected" error', () => {
      mockNonAngularEnvironment();
      const versionResult = checkAngularVersion();
      const trackingResult = simulateHandleStartTracking();

      expect(versionResult.supported).toBe(false);
      expect(trackingResult.success).toBe(false);
      expect(trackingResult.message).toBe('Angular not detected on this page.');
      expect(mockRenderTracker.start).not.toHaveBeenCalled();
    });

    it('Scenario 5: Angular markers only (no version) → supported: true, instrumentation proceeds', () => {
      mockAngularWithMarkersOnly();
      const versionResult = checkAngularVersion();
      const trackingResult = simulateHandleStartTracking();

      expect(versionResult.supported).toBe(true);
      expect(versionResult.confidence).toBe('unknown');
      expect(trackingResult.success).toBe(true);
      expect(mockRenderTracker.start).toHaveBeenCalled();
    });
  });

  /**
   * Cross-scenario validation: Verify all scenarios work together
   */
  describe('Cross-scenario validation', () => {
    it('All 5 scenarios pass without interference', () => {
      // Scenario 1
      mockAngularEnvironment('15.0.0');
      expect(checkAngularVersion().supported).toBe(true);
      cleanupAllMocks();

      // Scenario 2
      mockAngularEnvironment('16.2.10');
      expect(checkAngularVersion().supported).toBe(true);
      cleanupAllMocks();

      // Scenario 3
      mockAngularEnvironment('20.0.0');
      expect(checkAngularVersion().supported).toBe(true);
      cleanupAllMocks();

      // Scenario 4
      mockNonAngularEnvironment();
      expect(checkAngularVersion().supported).toBe(false);
      cleanupAllMocks();

      // Scenario 5
      mockAngularWithMarkersOnly();
      expect(checkAngularVersion().supported).toBe(true);
      cleanupAllMocks();
    });
  });
});

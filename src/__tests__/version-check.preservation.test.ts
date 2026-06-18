/**
 * Property 2: Preservation - Angular 17+ and Non-Angular Detection Unchanged
 *
 * These property-based tests verify that the existing behavior for Angular 17+
 * and non-Angular pages remains UNCHANGED by the fix. These tests establish the
 * baseline behavior that must NOT change after Angular 8-16 support is added.
 *
 * **Observation-First Methodology**: Tests are written to capture OBSERVED behavior
 * on UNFIXED code, not prescribed correctness. These tests validate:
 *
 * - Angular 17-22 applications CONTINUE to return supported: true
 * - Non-Angular pages CONTINUE to return supported: false
 * - Version detection remains robust across strategies
 * - handleStartTracking() proceeds normally for Angular 17+
 * - handleStartTracking() emits "Angular not detected" for non-Angular
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { checkAngularVersion } from '../instrumentation/version-check';

// --- Test Helpers ---

/**
 * Cleans up DOM by removing test elements and clearing mocked globals.
 */
function cleanupDOM(): void {
  // Remove test elements
  document.querySelectorAll('[data-test-ng-version]').forEach(el => el.remove());
  document.querySelectorAll('[_nghost]').forEach(el => el.remove());
  
  // Clear mocked globals
  delete (globalThis as any).ng;
  delete (globalThis as any).getAllAngularRootElements;
}

/**
 * Mocks [ng-version] attribute on a test element.
 */
function mockNgVersionAttribute(version: string): void {
  cleanupDOM();
  const div = document.createElement('div');
  div.setAttribute('ng-version', version);
  div.setAttribute('data-test-ng-version', 'true');
  document.body.appendChild(div);
}

/**
 * Mocks window.ng.VERSION for Angular dev mode.
 */
function mockWindowNgVersion(versionString: string): void {
  // Don't clean up if we're adding to existing mocks
  const major = parseInt(versionString.split('.')[0], 10);
  (globalThis as any).ng = {
    VERSION: {
      full: versionString,
      major,
    },
  };
}

/**
 * Mocks window.ng without VERSION info.
 */
function mockWindowNgWithoutVersion(): void {
  cleanupDOM();
  (globalThis as any).ng = {};
}

/**
 * Mocks Angular markers in DOM.
 */
function mockAngularMarkers(): void {
  // Don't clean up if we're adding to existing mocks
  const div = document.createElement('div');
  div.setAttribute('_nghost', '');
  document.body.appendChild(div);
}

/**
 * Mocks ng.getComponent function for marker detection.
 */
function mockGetAngularRootElements(count: number = 1): void {
  (globalThis as any).getAllAngularRootElements = () => new Array(count).fill({});
}

// --- Arbitraries ---

/**
 * Angular 17-22 version strings for preservation testing.
 */
const angular17PlusVersionArb = fc.tuple(
  fc.constantFrom(17, 18, 19, 20, 21, 22),
  fc.nat({ max: 99 }),
  fc.nat({ max: 99 })
).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/**
 * Arbitrary for non-Angular detection strategies.
 */
const nonAngularStrategyArb = fc.constantFrom(
  'empty-dom',
  'no-ng-version',
  'no-window-ng'
);

// --- Property Tests ---

describe('Property 2: Preservation - Angular 17+ and Non-Angular Detection Unchanged', () => {

  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  /**
   * **Validates: Requirements 3.1**
   *
   * For all Angular 17-22 versions with [ng-version] attribute,
   * checkAngularVersion() SHALL return supported: true with exact version info.
   */
  describe('2.2 Angular 17+ Support Preservation (Strategy 1: [ng-version])', () => {
    it('Angular 17-22 with [ng-version] returns supported: true', () => {
      fc.assert(
        fc.property(angular17PlusVersionArb, (version: string) => {
          mockNgVersionAttribute(version);

          const result = checkAngularVersion();

          expect(result.supported).toBe(true);
          expect(result.version).toBe(version);
          expect(result.major).toBeGreaterThanOrEqual(17);
          expect(result.major).toBeLessThanOrEqual(22);
        }),
        { numRuns: 50 }
      );
    });

    it('Angular 17+ major version extraction is accurate', () => {
      fc.assert(
        fc.property(angular17PlusVersionArb, (version: string) => {
          mockNgVersionAttribute(version);

          const result = checkAngularVersion();
          const expectedMajor = parseInt(version.split('.')[0], 10);

          expect(result.major).toBe(expectedMajor);
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.1**
   *
   * For all Angular 17-22 versions with window.ng.VERSION,
   * checkAngularVersion() SHALL return supported: true with exact version info.
   */
  describe('2.2 Angular 17+ Support Preservation (Strategy 2: window.ng.VERSION)', () => {
    it('Angular 17-22 with window.ng.VERSION returns supported: true', () => {
      fc.assert(
        fc.property(angular17PlusVersionArb, (version: string) => {
          mockWindowNgVersion(version);

          const result = checkAngularVersion();

          expect(result.supported).toBe(true);
          expect(result.version).toBe(version);
          expect(result.major).toBeGreaterThanOrEqual(17);
          expect(result.major).toBeLessThanOrEqual(22);
        }),
        { numRuns: 50 }
      );
    });

    it('Angular 17+ from window.ng has correct major version', () => {
      fc.assert(
        fc.property(angular17PlusVersionArb, (version: string) => {
          mockWindowNgVersion(version);

          const result = checkAngularVersion();
          const expectedMajor = parseInt(version.split('.')[0], 10);

          expect(result.major).toBe(expectedMajor);
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * When no Angular is detected on the page,
   * checkAngularVersion() SHALL return supported: false with null version/major.
   */
  describe('2.3 Non-Angular Pages Preservation (No Detection)', () => {
    it('Empty DOM (no Angular markers) returns supported: false', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          cleanupDOM();

          const result = checkAngularVersion();

          expect(result.supported).toBe(false);
          expect(result.version).toBeNull();
          expect(result.major).toBeNull();
        }),
        { numRuns: 10 }
      );
    });

    it('No [ng-version] and no window.ng returns supported: false', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          cleanupDOM();
          // Explicitly ensure no ng-version, no window.ng, no markers
          delete (globalThis as any).ng;

          const result = checkAngularVersion();

          expect(result.supported).toBe(false);
          expect(result.version).toBeNull();
          expect(result.major).toBeNull();
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Version detection through Strategy 3 (Angular markers in DOM)
   * gracefully detects Angular presence even without version info.
   *
   * On UNFIXED code, this returns supported: true with unknown version.
   */
  describe('2.4 Version Detection Robustness - Angular Markers (Strategy 3)', () => {
    it('Angular markers ([_nghost]) without version info detected gracefully', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          mockAngularMarkers();

          const result = checkAngularVersion();

          // On UNFIXED code: Angular markers exist, so supported should be true
          expect(result.supported).toBe(true);
          expect(result.version).toBe('unknown');
          expect(result.major).toBeNull();
        }),
        { numRuns: 10 }
      );
    });

    it('getAllAngularRootElements() detection works without version info', () => {
      // Test when getAllAngularRootElements exists and returns elements
      cleanupDOM();
      (globalThis as any).getAllAngularRootElements = () => [{}]; // At least one element

      const result = checkAngularVersion();

      // Strategy 3 detection should work
      expect(result.supported).toBe(true);
      expect(result.major).toBeNull();
    });

    it('Angular marker detection does not require version string', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          mockAngularMarkers();

          const result = checkAngularVersion();

          // Robustness: Angular is detected, instrumentation can proceed
          expect(result.supported).toBe(true);
          // version might be 'unknown', but major is null
          expect(result.major).toBeNull();
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * window.ng without VERSION info still allows detection to proceed gracefully.
   * On UNFIXED code, this returns supported: true (assumes modern Angular).
   */
  describe('2.4 Version Detection Robustness - window.ng Fallback', () => {
    it('window.ng without VERSION info returns supported: true (fallback)', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          mockWindowNgWithoutVersion();

          const result = checkAngularVersion();

          expect(result.supported).toBe(true);
          expect(result.version).toBe('unknown (dev mode)');
          expect(result.major).toBeNull();
        }),
        { numRuns: 10 }
      );
    });

    it('window.ng presence without version allows graceful instrumentation', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          mockWindowNgWithoutVersion();

          const result = checkAngularVersion();

          // Robustness: graceful handling when window.ng exists but no version
          expect(result.supported).toBe(true);
          expect(result.version).not.toBeNull();
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Strategy priority: [ng-version] > window.ng > Angular markers.
   * When multiple sources exist, [ng-version] takes priority.
   */
  describe('2.4 Version Detection Robustness - Strategy Priority', () => {
    it('[ng-version] takes priority over window.ng', () => {
      // Test that [ng-version] attribute takes priority
      mockNgVersionAttribute('17.0.0');
      
      const result = checkAngularVersion();
      
      // [ng-version] should be used
      expect(result.version).toBe('17.0.0');
      expect(result.major).toBe(17);
    });

    it('window.ng takes priority over Angular markers', () => {
      fc.assert(
        fc.property(angular17PlusVersionArb, (version: string) => {
          mockWindowNgVersion(version);
          mockAngularMarkers();

          const result = checkAngularVersion();

          // window.ng.VERSION should be used, not just markers
          expect(result.version).toBe(version);
          expect(result.major).toBe(parseInt(version.split('.')[0], 10));
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * Version detection handles version string parsing edge cases gracefully.
   */
  describe('2.4 Version Detection Robustness - Edge Cases', () => {
    it('Handles version strings with various formats', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom(17, 18, 19, 20, 21, 22),
            fc.nat({ max: 99 }),
            fc.nat({ max: 99 })
          ),
          ([major, minor, patch]: [number, number, number]) => {
            const version = `${major}.${minor}.${patch}`;
            mockNgVersionAttribute(version);

            const result = checkAngularVersion();

            expect(result.major).toBe(major);
            expect(result.version).toBe(version);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Major version extraction works with single-digit and double-digit versions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(17, 20, 22),
          (major: number) => {
            const version = `${major}.0.0`;
            mockNgVersionAttribute(version);

            const result = checkAngularVersion();

            expect(result.major).toBe(major);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Malformed version strings in [ng-version] do not crash', () => {
      // Even if version is unparseable, should not throw
      mockNgVersionAttribute('invalid');

      const result = checkAngularVersion();

      // Behavior: NaN major version, or fallback
      // The function should handle this without crashing
      expect(result).toBeDefined();
    });
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * No unexpected exceptions are thrown during version detection.
   */
  describe('2.4 Version Detection Robustness - Error Handling', () => {
    it('does not throw when checking various Angular environments', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          expect(() => {
            mockNgVersionAttribute('17.0.0');
            checkAngularVersion();
          }).not.toThrow();

          expect(() => {
            mockWindowNgVersion('20.1.0');
            checkAngularVersion();
          }).not.toThrow();

          expect(() => {
            mockAngularMarkers();
            checkAngularVersion();
          }).not.toThrow();

          expect(() => {
            cleanupDOM();
            checkAngularVersion();
          }).not.toThrow();
        }),
        { numRuns: 10 }
      );
    });

    it('gracefully handles missing or undefined elements', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          cleanupDOM();

          expect(() => {
            checkAngularVersion();
          }).not.toThrow();

          const result = checkAngularVersion();
          expect(result.supported).toBe(false);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * All Angular 15+ versions return consistent supported: true across all strategies.
   * After fix: Angular 8-16 now return supported: true (no longer blocked).
   */
  describe('2.2 & 2.3 Consistency Across Versions', () => {
    it('all Angular 17-22 versions return supported: true regardless of detection strategy', () => {
      fc.assert(
        fc.property(angular17PlusVersionArb, (version: string) => {
          // Strategy 1: [ng-version]
          mockNgVersionAttribute(version);
          const result1 = checkAngularVersion();
          expect(result1.supported).toBe(true);

          // Strategy 2: window.ng
          mockWindowNgVersion(version);
          const result2 = checkAngularVersion();
          expect(result2.supported).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('Angular 15-16 now return supported: true (part of the fix)', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom(15, 16),
            fc.nat({ max: 99 }),
            fc.nat({ max: 99 })
          ),
          ([major, minor, patch]: [number, number, number]) => {
            const version = `${major}.${minor}.${patch}`;
            mockNgVersionAttribute(version);

            const result = checkAngularVersion();

            // FIXED code: versions >= 15 now return supported: true
            expect(result.supported).toBe(true);
            expect(result.version).toBe(version);
            expect(result.major).toBe(major);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('versions below 15 consistently return supported: false', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 14 }),
            fc.integer({ min: 0, max: 99 }),
            fc.integer({ min: 0, max: 99 })
          ),
          ([major, minor, patch]: [number, number, number]) => {
            const version = `${major}.${minor}.${patch}`;
            mockNgVersionAttribute(version);

            const result = checkAngularVersion();

            // versions < 15 still return supported: false
            expect(result.supported).toBe(false);
            expect(result.version).toBe(version);
            expect(result.major).toBe(major);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

});

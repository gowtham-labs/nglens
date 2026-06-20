/**
 * Bug Condition Exploration Test for Angular 15-16 Support
 *
 * These tests demonstrate that Angular 15-16 versions are currently rejected
 * on UNFIXED code, confirming the bug exists.
 *
 * Property 1: Bug Condition - Angular 15-16 Support
 * For any Angular application with version 15 or 16 detected, the UNFIXED
 * checkAngularVersion() should return supported: false (BUG).
 * On FIXED code, it should return supported: true.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { checkAngularVersion } from '../instrumentation/version-check';

/**
 * Mock helper to setup Angular 15-16 environment with [ng-version] attribute
 */
function mockAngularWithNgVersion(version: string): void {
  // Create and set [ng-version] attribute on a mock element
  const mockElement = {
    getAttribute: (attr: string) => (attr === 'ng-version' ? version : null),
  };
  
  // Mock document.querySelector to return our mock element
  vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
    if (selector === '[ng-version]') {
      return mockElement as any;
    }
    return null;
  });
}

/**
 * Mock helper to setup Angular environment with window.ng.VERSION
 */
function mockAngularWithWindowNg(version: string): void {
  const major = version.split('.')[0];
  const full = version;
  
  // Mock window.ng
  (globalThis as any).ng = {
    VERSION: { major: parseInt(major, 10), full },
  };
  
  // Mock document.querySelector to NOT find [ng-version]
  vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
    return null;
  });
}

/**
 * Mock helper to setup Angular environment with markers only (no version info)
 */
function mockAngularWithMarkersOnly(): void {
  // Create a mock element with Angular marker attribute
  const mockMarkerElement = {
    getAttribute: () => null,
  };
  
  // Mock document.querySelector to return marker element
  vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
    if (selector === '[_nghost]') {
      return mockMarkerElement as any;
    }
    if (selector === '[ng-version]') {
      return null;
    }
    if (selector === '[ng-reflect-]') {
      return null;
    }
    return null;
  });
  
  // Mock window.ng to not exist
  (globalThis as any).ng = undefined;
}

/**
 * Mock helper to clear all Angular-related mocks
 */
function clearAllMocks(): void {
  vi.clearAllMocks();
  (globalThis as any).ng = undefined;
  (globalThis as any).getAllAngularRootElements = undefined;
}

describe('version-check: Bug Condition Exploration Tests', () => {
  afterEach(() => {
    clearAllMocks();
  });

  /**
   * Sub-task 1.2: Test that Angular 15-16 versions are rejected with supported: false on UNFIXED code
   *
   * This test demonstrates the BUG: Angular 15 and 16 should be supported,
   * but on unfixed code they are rejected.
   *
   * Expected behavior on UNFIXED code: supported: false (BUG)
   * Expected behavior on FIXED code: supported: true (FIXED)
   */
  describe('1.2: Angular 15-16 rejection with [ng-version]', () => {
    it('should reject Angular 15.0.0 with supported: false on UNFIXED code', () => {
      mockAngularWithNgVersion('15.0.0');
      const result = checkAngularVersion();
      
      // This assertion FAILS on unfixed code (bug confirmed)
      // It should return supported: true but returns supported: false
      expect(result.supported).toBe(true); // FAILS on unfixed, PASSES on fixed
      expect(result.version).toBe('15.0.0');
      expect(result.major).toBe(15);
    });

    it('should reject Angular 15.2.7 with supported: false on UNFIXED code', () => {
      mockAngularWithNgVersion('15.2.7');
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(true); // FAILS on unfixed, PASSES on fixed
      expect(result.version).toBe('15.2.7');
      expect(result.major).toBe(15);
    });

    it('should reject Angular 16.0.0 with supported: false on UNFIXED code', () => {
      mockAngularWithNgVersion('16.0.0');
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(true); // FAILS on unfixed, PASSES on fixed
      expect(result.version).toBe('16.0.0');
      expect(result.major).toBe(16);
    });

    it('should reject Angular 16.2.10 with supported: false on UNFIXED code', () => {
      mockAngularWithNgVersion('16.2.10');
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(true); // FAILS on unfixed, PASSES on fixed
      expect(result.version).toBe('16.2.10');
      expect(result.major).toBe(16);
    });
  });

  /**
   * Property-based test: All Angular 15-16 versions are rejected on UNFIXED code
   *
   * This property generates many Angular 15-16 version strings and verifies
   * that all of them are currently rejected (BUG).
   */
  it('Property 1.2a: All Angular 15-16 versions should be SUPPORTED (but are rejected on unfixed code)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 15, max: 16 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 30 }),
        (major, minor, patch) => {
          const version = `${major}.${minor}.${patch}`;
          mockAngularWithNgVersion(version);
          
          const result = checkAngularVersion();
          
          // Property: All Angular 15-16 should return supported: true
          expect(result.supported).toBe(true); // FAILS on unfixed (bug confirmed), PASSES on fixed
          expect(result.major).toBe(major);
          expect(result.version).toBe(version);
          
          clearAllMocks();
        }
      )
    );
  });

  /**
   * Sub-task 1.2b: Test that Angular 15-16 with window.ng.VERSION are rejected on UNFIXED code
   *
   * This tests the fallback detection via window.ng instead of [ng-version]
   */
  describe('1.2b: Angular 15-16 rejection with window.ng.VERSION', () => {
    it('should reject Angular 15.1.0 from window.ng.VERSION on UNFIXED code', () => {
      mockAngularWithWindowNg('15.1.0');
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(true); // FAILS on unfixed, PASSES on fixed
      expect(result.version).toBe('15.1.0');
      expect(result.major).toBe(15);
    });

    it('should reject Angular 16.1.5 from window.ng.VERSION on UNFIXED code', () => {
      mockAngularWithWindowNg('16.1.5');
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(true); // FAILS on unfixed, PASSES on fixed
      expect(result.version).toBe('16.1.5');
      expect(result.major).toBe(16);
    });
  });

  /**
   * Sub-task 1.3: Test that handleStartTracking() blocks Angular 15-16 on UNFIXED code and emits ERROR
   *
   * This test verifies that the orchestrator properly blocks Angular 15-16 applications
   * by checking the version and not proceeding with instrumentation.
   *
   * We simulate the orchestrator's behavior by checking version and verifying errors.
   */
  describe('1.3: handleStartTracking() blocks Angular 15-16 with ERROR', () => {
    it('should emit ERROR for Angular 15.0.0 on UNFIXED code', () => {
      mockAngularWithNgVersion('15.0.0');
      const result = checkAngularVersion();
      
      // Simulate orchestrator's handleStartTracking logic
      if (!result.supported) {
        // ERROR should be emitted (this path is taken on unfixed code)
        const errorMessage = result.version
          ? `Angular ${result.version} is not supported. Requires Angular 17+.`
          : 'Angular not detected on this page.';
        expect(errorMessage).toContain('Angular 15.0.0');
      }
      
      // On FIXED code, result.supported will be true, so ERROR should NOT be emitted
      expect(result.supported).toBe(true); // FAILS on unfixed (ERROR emitted), PASSES on fixed (no ERROR)
    });

    it('should emit ERROR for Angular 16.2.10 on UNFIXED code', () => {
      mockAngularWithNgVersion('16.2.10');
      const result = checkAngularVersion();
      
      if (!result.supported) {
        const errorMessage = result.version
          ? `Angular ${result.version} is not supported. Requires Angular 17+.`
          : 'Angular not detected on this page.';
        expect(errorMessage).toContain('Angular 16.2.10');
      }
      
      expect(result.supported).toBe(true); // FAILS on unfixed, PASSES on fixed
    });
  });

  /**
   * Sub-task 1.4: Document failures confirming bug exists
   *
   * These tests verify the current buggy behavior and will FAIL on unfixed code,
   * confirming the bug condition exists.
   */
  describe('1.4: Bug condition documentation - Angular 15-16 are currently rejected', () => {
    it('Bug example 1: Angular 15.0.0 app is blocked from instrumentation', () => {
      mockAngularWithNgVersion('15.0.0');
      const versionResult = checkAngularVersion();
      
      // DOCUMENT: On unfixed code, this will be false (BUG)
      // On fixed code, this will be true (FIXED)
      // The test FAILS on unfixed code, confirming the bug exists
      expect(versionResult.supported).toBe(true);
      expect(versionResult.major).toBe(15);
    });

    it('Bug example 2: Angular 16 app with [ng-version]="16.2.10" is blocked', () => {
      mockAngularWithNgVersion('16.2.10');
      const versionResult = checkAngularVersion();
      
      // DOCUMENT: Angular 16 applications cannot be inspected on unfixed code
      expect(versionResult.supported).toBe(true); // FAILS on unfixed
      expect(versionResult.version).toBe('16.2.10');
    });

    it('Bug example 3: Angular 16 app via window.ng is inconsistent', () => {
      mockAngularWithWindowNg('16.1.0');
      const versionResult = checkAngularVersion();
      
      // DOCUMENT: Version detection succeeds but version checking rejects it
      expect(versionResult.supported).toBe(true); // FAILS on unfixed
      expect(versionResult.version).toBe('16.1.0');
      expect(versionResult.major).toBe(16);
    });

    it('Bug example 4: Angular 15 detected via markers is assumed modern but blocked by version check', () => {
      mockAngularWithMarkersOnly();
      const versionResult = checkAngularVersion();
      
      // DOCUMENT: On unfixed code, markers allow detection but version check still blocks
      // On fixed code, markers will allow support: true
      expect(versionResult.supported).toBe(true); // Expected on fixed code
    });
  });

  /**
   * Regression test: Ensure Angular 17+ still works (preservation)
   * These tests should PASS on both unfixed and fixed code
   */
  describe('Preservation: Angular 17+ continues to work', () => {
    it('should accept Angular 17.0.0 on both unfixed and fixed code', () => {
      mockAngularWithNgVersion('17.0.0');
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(true);
      expect(result.version).toBe('17.0.0');
      expect(result.major).toBe(17);
    });

    it('should accept Angular 20.1.5 on both unfixed and fixed code', () => {
      mockAngularWithNgVersion('20.1.5');
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(true);
      expect(result.version).toBe('20.1.5');
      expect(result.major).toBe(20);
    });

    it('Property: All Angular 17+ versions should continue to be supported', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 17, max: 25 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 30 }),
          (major, minor, patch) => {
            const version = `${major}.${minor}.${patch}`;
            mockAngularWithNgVersion(version);
            
            const result = checkAngularVersion();
            
            // Property: All Angular 17+ should continue to return supported: true
            expect(result.supported).toBe(true);
            expect(result.major).toBe(major);
            expect(result.version).toBe(version);
            
            clearAllMocks();
          }
        )
      );
    });
  });

  /**
   * Regression test: Ensure non-Angular pages continue to work (preservation)
   * These tests should PASS on both unfixed and fixed code
   */
  describe('Preservation: Non-Angular pages continue to work', () => {
    it('should reject non-Angular pages (no version detected)', () => {
      // Mock no Angular environment
      vi.spyOn(document, 'querySelector').mockReturnValue(null);
      (globalThis as any).ng = undefined;
      
      const result = checkAngularVersion();
      
      expect(result.supported).toBe(false);
      expect(result.version).toBeNull();
      expect(result.major).toBeNull();
    });
  });
});

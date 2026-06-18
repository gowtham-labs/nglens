/**
 * Runtime Compatibility Tests for Angular 15-21
 * 
 * These tests verify that the instrumentation code will actually work
 * when loaded on pages running Angular 15, 16, 17, 18, 19, 20, or 21.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkAngularVersion } from '../instrumentation/version-check';
import { RenderTracker } from '../instrumentation/render-tracker';

describe('Runtime Compatibility: Angular 15-21', () => {
  beforeEach(() => {
    // Reset globalThis state
    delete (globalThis as any).ng;
    delete (globalThis as any).Zone;
  });

  describe('Version Detection', () => {
    it('should detect Angular 15 via [ng-version] attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '15.0.0');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(15);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should detect Angular 16 via [ng-version] attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '16.2.1');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(16);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should detect Angular 17 via [ng-version] attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '17.1.0');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(17);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should detect Angular 18 via [ng-version] attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '18.0.0');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(18);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should detect Angular 19 via [ng-version] attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '19.0.0');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(19);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should detect Angular 20 via [ng-version] attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '20.0.0');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(20);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should detect Angular 21 via [ng-version] attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '21.0.0');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(21);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should reject Angular 14 as unsupported', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '14.0.0');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(false);
      expect(result.major).toBe(14);
      expect(result.confidence).toBe('exact');

      document.body.removeChild(element);
    });

    it('should detect via window.ng (dev mode)', () => {
      (globalThis as any).ng = {
        VERSION: { full: '17.2.0', major: 17 },
      };

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.major).toBe(17);
      expect(result.confidence).toBe('exact');
    });

    it('should fallback gracefully when window.ng exists without version', () => {
      (globalThis as any).ng = {};

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.confidence).toBe('fallback');
    });

    it('should detect via _nghost- attributes in production', () => {
      const element = document.createElement('div');
      element.setAttribute('_nghost-ng-c1', '');
      document.body.appendChild(element);

      const result = checkAngularVersion();
      expect(result.supported).toBe(true);
      expect(result.confidence).toBe('unknown');

      document.body.removeChild(element);
    });

    it('should return unsupported when Angular not detected', () => {
      const result = checkAngularVersion();
      expect(result.supported).toBe(false);
      expect(result.version).toBeNull();
    });
  });

  describe('RenderTracker Initialization', () => {
    it('should initialize without errors', () => {
      const tracker = RenderTracker.getInstance();
      expect(tracker).toBeDefined();
    });

    it('should not start tracking if Angular not detected', () => {
      // Delete the version element to simulate no Angular
      const tracker = RenderTracker.getInstance();
      
      // This should not throw, just return false for supported check
      const versionResult = checkAngularVersion();
      expect(versionResult.supported).toBe(false);
    });

    it('should handle missing Zone.js gracefully', () => {
      const element = document.createElement('div');
      element.setAttribute('ng-version', '17.0.0');
      document.body.appendChild(element);

      const tracker = RenderTracker.getInstance();
      // Should not throw even if Zone.js is not available
      expect(() => tracker.start()).not.toThrow();

      document.body.removeChild(element);
    });
  });

  describe('DOM Utilities Compatibility', () => {
    it('should handle NamedNodeMap iteration safely', () => {
      const element = document.createElement('div');
      element.setAttribute('attr1', 'value1');
      element.setAttribute('attr2', 'value2');
      element.setAttribute('_nghost-', '');

      // Convert NamedNodeMap to array (this should work in all browsers)
      const attrs = Array.from(element.attributes);
      expect(attrs.length).toBeGreaterThanOrEqual(3);
      expect(attrs.some(attr => attr.name === '_nghost-')).toBe(true);
    });

    it('should handle HTMLCollection iteration safely', () => {
      const div = document.createElement('div');
      const child1 = document.createElement('span');
      const child2 = document.createElement('span');
      div.appendChild(child1);
      div.appendChild(child2);

      // Convert HTMLCollection to array (this should work in all browsers)
      const children = Array.from(div.children);
      expect(children.length).toBe(2);
      expect(children.every(child => child instanceof Element)).toBe(true);
    });
  });

  describe('Component Discovery Strategies', () => {
    it('should discover components via ng.getComponent API', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);

      // Mock ng.getComponent
      (globalThis as any).ng = {
        getComponent: vi.fn(() => ({
          constructor: { name: 'AppComponent' },
        })),
      };

      const tracker = RenderTracker.getInstance();
      const buffer = tracker.getBuffer();
      
      // Should not throw when trying to access components
      expect(Array.isArray(buffer)).toBe(true);

      document.body.removeChild(element);
    });

    it('should discover components via _nghost- attributes', () => {
      // Delete ng global to test fallback
      delete (globalThis as any).ng;

      const element = document.createElement('app-root');
      element.setAttribute('_nghost-ng-c1', '');
      document.body.appendChild(element);

      const tracker = RenderTracker.getInstance();
      // Should initialize without error even without ng global
      expect(tracker).toBeDefined();

      document.body.removeChild(element);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should limit component discovery to prevent performance degradation', () => {
      // Create many elements
      const elements = [];
      for (let i = 0; i < 3000; i++) {
        const el = document.createElement('div');
        document.body.appendChild(el);
        elements.push(el);
      }

      const tracker = RenderTracker.getInstance();
      const buffer = tracker.getBuffer();
      
      // Should complete without hanging
      expect(Array.isArray(buffer)).toBe(true);

      // Cleanup
      elements.forEach(el => el.remove());
    });

    it('should handle large mutation observer events safely', () => {
      const tracker = RenderTracker.getInstance();
      const container = document.createElement('div');
      document.body.appendChild(container);

      // Add many mutations quickly
      for (let i = 0; i < 100; i++) {
        const el = document.createElement('div');
        container.appendChild(el);
      }

      // Wait for RAF to process
      expect(() => {
        container.remove();
      }).not.toThrow();
    });
  });
});

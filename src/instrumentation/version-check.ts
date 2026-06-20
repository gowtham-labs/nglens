// src/instrumentation/version-check.ts

export interface VersionCheckResult {
  supported: boolean;
  version: string | null;
  major: number | null;
  confidence: 'exact' | 'fallback' | 'unknown';
}

/**
 * Detects the Angular version from the [ng-version] attribute on the root element.
 * Also checks for window.ng (available in Angular dev mode).
 * Returns whether the version is supported (>= 15) for instrumentation.
 *
 * - If no Angular detected at all, returns { supported: false, version: null, major: null, confidence: 'unknown' }
 * - If major version < 15, returns { supported: false, version, major, confidence: 'exact' }
 * - If version >= 15, returns { supported: true, version, major, confidence: 'exact' }
 * - If window.ng exists without version info, returns { supported: true, version: 'unknown (dev mode)', major: null, confidence: 'fallback' }
 * - If Angular markers detected, returns { supported: true, version: 'unknown', major: null, confidence: 'unknown' }
 */
export function checkAngularVersion(): VersionCheckResult {
  // Strategy 1: Check [ng-version] attribute
  const versionElement = document.querySelector('[ng-version]');
  if (versionElement) {
    const version = versionElement.getAttribute('ng-version');
    if (version) {
      const major = Number.parseInt(version.split('.')[0], 10);
      if (!Number.isNaN(major)) {
        return { supported: major >= 15, version, major, confidence: 'exact' };
      }
    }
  }

  // Strategy 2: Check for window.ng (Angular dev mode global)
  const ng = (globalThis as any).ng;
  if (ng) {
    // window.ng exists — Angular is present in dev mode
    // Try to get version from ng.VERSION if available
    const ngVersion = ng.VERSION?.full ?? ng.VERSION?.major;
    if (ngVersion) {
      const version = String(ngVersion);
      const major = Number.parseInt(version.split('.')[0], 10);
      if (!Number.isNaN(major)) {
        return { supported: major >= 15, version, major, confidence: 'exact' };
      }
    }
    // window.ng exists but no version info — assume Angular 15+ is present (fallback)
    return { supported: true, version: 'unknown (dev mode)', major: null, confidence: 'fallback' };
  }

  // Strategy 3: Check for Angular component markers in DOM
  // Angular 15-16 use _nghost-<hash> attributes; Angular 17+ use _nghost- or ng-version
  const hasAngularMarkers = document.querySelector('[_nghost]') !== null
    || document.querySelector('[ng-reflect-]') !== null
    || (globalThis as any).getAllAngularRootElements?.()?.length > 0
    || hasNgHostAttributes();

  if (hasAngularMarkers) {
    return { supported: true, version: 'unknown', major: null, confidence: 'unknown' };
  }

  return { supported: false, version: null, major: null, confidence: 'unknown' };
}

/**
 * Checks for Angular _nghost-* attributes in the DOM.
 * Angular 15-16 production mode uses _nghost-<component-hash> attributes
 * that follow the pattern _nghost-ng-c<number> or _nghost-<hash>.
 * Angular 17+ may also use these but with different patterns.
 */
function hasNgHostAttributes(): boolean {
  const allElements = document.querySelectorAll('*');
  const limit = Math.min(allElements.length, 500);

  for (let i = 0; i < limit; i++) {
    const el = allElements[i];
    for (let j = 0; j < el.attributes.length; j++) {
      const attrName = el.attributes[j].name;
      if (attrName.startsWith('_nghost-') || attrName.startsWith('_ngcontent-')) {
        return true;
      }
    }
  }
  return false;
}

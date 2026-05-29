// src/instrumentation/version-check.ts

export interface VersionCheckResult {
  supported: boolean;
  version: string | null;
  major: number | null;
}

/**
 * Detects the Angular version from the [ng-version] attribute on the root element.
 * Also checks for window.ng (available in Angular dev mode).
 * Returns whether the version is supported (>= 17) for instrumentation.
 *
 * - If no Angular detected at all, returns { supported: false, version: null, major: null }
 * - If major version < 17, returns { supported: false, version, major }
 * - If version >= 17, returns { supported: true, version, major }
 */
export function checkAngularVersion(): VersionCheckResult {
  // Strategy 1: Check [ng-version] attribute
  const versionElement = document.querySelector('[ng-version]');
  if (versionElement) {
    const version = versionElement.getAttribute('ng-version');
    if (version) {
      const major = Number.parseInt(version.split('.')[0], 10);
      if (!Number.isNaN(major)) {
        return { supported: major >= 17, version, major };
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
        return { supported: major >= 17, version, major };
      }
    }
    // window.ng exists but no version info — assume modern Angular (17+)
    return { supported: true, version: 'unknown (dev mode)', major: null };
  }

  // Strategy 3: Check for Angular component markers in DOM
  const hasAngularMarkers = document.querySelector('[_nghost]') !== null
    || document.querySelector('[ng-reflect-]') !== null
    || (globalThis as any).getAllAngularRootElements?.()?.length > 0;

  if (hasAngularMarkers) {
    return { supported: true, version: 'unknown', major: null };
  }

  return { supported: false, version: null, major: null };
}

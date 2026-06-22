// src/instrumentation/version-check.ts

export interface VersionCheckResult {
  supported: boolean;
  version: string | null;
  major: number | null;
}

const DOM_MARKER_SCAN_LIMIT = 1000;

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
  const doc = globalThis.document;

  // Strategy 1: Check [ng-version] attribute
  const versionElement = doc?.querySelector?.('[ng-version]') ?? null;
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
  const hasAngularMarkers = hasAngularDomMarkers(doc)
    || ((globalThis as any).getAllAngularRootElements?.()?.length ?? 0) > 0;

  if (hasAngularMarkers) {
    return { supported: true, version: 'unknown', major: null };
  }

  return { supported: false, version: null, major: null };
}

function hasAngularDomMarkers(doc: Document | undefined): boolean {
  if (!doc?.querySelectorAll) return false;

  const elements = doc.querySelectorAll('*');
  const limit = Math.min(elements.length, DOM_MARKER_SCAN_LIMIT);

  for (let index = 0; index < limit; index++) {
    const element = elements[index];
    for (const attr of Array.from(element.attributes)) {
      if (
        attr.name.startsWith('_nghost') ||
        attr.name.startsWith('_ngcontent') ||
        attr.name.startsWith('ng-reflect-')
      ) {
        return true;
      }
    }
  }

  return false;
}

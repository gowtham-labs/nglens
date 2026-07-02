import type { AppProviderCategory } from '../../types/app-structure';
import { LIBRARY_NAME_PATTERNS, PROVIDER_CATEGORY_PATTERNS } from './constants';

// ─── Per-scan mutable state ───────────────────────────────────────────────────
/** class name → source package. Reset at the start of each scan. */
export const _classNameToSource = new Map<string, string>();

// ─── Library source matching ──────────────────────────────────────────────────

/** Returns the npm package name if the class name matches a known library. */
export function matchKnownLibrary(name: string): string | null {
  if (!name) return null;
  for (const [pattern, pkg] of LIBRARY_NAME_PATTERNS) {
    if (pattern.test(name)) return pkg;
  }
  return null;
}

/**
 * Extract npm package name from a node_modules file path.
 * e.g. "/node_modules/@coreui/angular/src/..." → "@coreui/angular"
 */
export function extractPackageFromPath(filePath: string): string | null {
  const nmIdx = filePath.indexOf('node_modules/');
  if (nmIdx === -1) return null;
  const after = filePath.slice(nmIdx + 13);
  const parts = after.split('/');
  if (!parts[0]) return null;
  return parts[0].startsWith('@') && parts.length >= 2
    ? `${parts[0]}/${parts[1]}`
    : parts[0];
}

/**
 * Detect the npm package source for an NgModule constructor.
 * Tries: ɵmod.id → debugInfo.filePath → class name pattern.
 */
export function detectModuleSource(moduleCtor: any, mod: any): string | null {
  try {
    const modId = mod?.id ?? moduleCtor?.ɵmod?.id;
    if (typeof modId === 'string' && modId) return modId;

    const filePath = tryGetFilePathFromCtor(moduleCtor);
    if (filePath) {
      const pkg = extractPackageFromPath(filePath);
      if (pkg) return pkg;
    }

    return matchKnownLibrary(moduleCtor?.name ?? '');
  } catch {
    return null;
  }
}

// ─── Provider category ────────────────────────────────────────────────────────

export function categorizeProvider(name: string): AppProviderCategory {
  for (const [pattern, cat] of PROVIDER_CATEGORY_PATTERNS) {
    if (pattern.test(name)) return cat;
  }
  return 'app';
}

// ─── Ivy def helpers ──────────────────────────────────────────────────────────

export function extractSelector(selectorDef: any): string {
  if (!selectorDef) return '';
  if (typeof selectorDef === 'string') return selectorDef;
  if (Array.isArray(selectorDef)) {
    return selectorDef
      .map((s: any) => (Array.isArray(s) ? s.filter(Boolean).join('') : String(s)))
      .filter(Boolean)
      .join(', ');
  }
  return String(selectorDef);
}

export function tryGetFilePath(def: any): string | null {
  try {
    if (typeof def?.debugInfo?.filePath === 'string') return def.debugInfo.filePath;
    if (typeof def?.templateUrl === 'string') return def.templateUrl;
  } catch { /* ignore */ }
  return null;
}

/**
 * Try every Angular Ivy metadata symbol on a constructor to find a file path.
 */
export function tryGetFilePathFromCtor(ctor: any): string | null {
  if (!ctor || typeof ctor !== 'function') return null;
  return tryGetFilePath(ctor.ɵcmp)
    ?? tryGetFilePath(ctor.ɵdir)
    ?? tryGetFilePath(ctor.ɵpipe)
    ?? tryGetFilePath(ctor.ɵmod)
    ?? tryGetFilePath(ctor.ɵprov)
    ?? null;
}

export function resolveFnOrArray(value: any): any[] {
  if (!value) return [];
  if (typeof value === 'function') {
    try { return value() ?? []; } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

export function getCtorName(value: any): string {
  if (!value) return '';
  if (typeof value === 'function') return value.name ?? '';
  if (Array.isArray(value) && typeof value[0] === 'function') return value[0].name ?? '';
  return '';
}

export function resolveProviderName(provider: any): string {
  if (!provider) return '';
  if (typeof provider === 'function') return provider.name ?? '';
  if (provider.provide) {
    if (typeof provider.provide === 'function') return provider.provide.name ?? '';
    if (typeof provider.provide === 'string') return provider.provide;
  }
  return '';
}

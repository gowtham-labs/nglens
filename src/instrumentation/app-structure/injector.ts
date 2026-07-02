import type {
  AppProviderEntry,
  InterceptorRegistryEntry,
  NgrxEntry,
  NgrxStoreType,
  ObservableStateEntry,
  SignalStateEntry,
  TokenRegistryEntry,
} from '../../types/app-structure';
import { PROVIDER_SKIP_PREFIXES } from './constants';
import { categorizeProvider, tryGetFilePathFromCtor } from './utils';
import { scanInstanceState } from './state-scanner';

// ─── Injector Introspection ───────────────────────────────────────────────────

/**
 * Get the injector records Map from any Angular injector object.
 * Handles both Angular <21 (_records) and Angular 21+ (records) naming,
 * plus wrapper objects (.injector / ._injector).
 */
export function getInjectorMap(obj: any): Map<any, any> | null {
  if (!obj || typeof obj !== 'object') return null;
  // Angular 21+: R3Injector uses public `records` field
  if (obj.records instanceof Map) return obj.records;
  // Angular <21: R3Injector used private convention `_records`
  if (obj._records instanceof Map) return obj._records;
  return null;
}

/**
 * Extract an R3Injector (one with a records Map) from any injector-like object.
 * Handles NodeInjector (._lView[9/10]) and wrapper types (.injector / ._injector).
 * Returns the original object if no better candidate is found.
 */
export function unwrapToR3Injector(obj: any): any {
  if (!obj) return obj;
  // Already an R3Injector
  if (getInjectorMap(obj)) return obj;
  // NodeInjector: extract from _lView[INJECTOR=9] or [ENVIRONMENT=10]
  if (Array.isArray(obj._lView)) {
    for (const idx of [9, 10]) {
      const candidate = obj._lView[idx];
      if (!candidate) continue;
      if (getInjectorMap(candidate)) return candidate;
      const inner = candidate.injector ?? candidate._injector;
      if (inner && getInjectorMap(inner)) return inner;
    }
  }
  // Wrapper: .injector or ._injector holds the real R3Injector
  const inner = obj.injector ?? obj._injector;
  if (inner && getInjectorMap(inner)) return inner;
  return obj;
}

export function tryGetInjector(ng: any, el: Element): any {
  try {
    const inj = ng.getInjector(el);
    if (!inj) return null;
    // unwrapToR3Injector handles NodeInjector → R3Injector extraction
    return unwrapToR3Injector(inj);
  } catch { return null; }
}

export function getInjectorRecords(injector: any): Map<any, any> | null {
  try {
    // Direct: R3Injector (Angular 21: .records; older: ._records)
    const direct = getInjectorMap(injector);
    if (direct) return direct;

    // R3EnvironmentInjector wraps R3Injector in .injector or ._injector
    const wrapped = getInjectorMap(injector.injector) ?? getInjectorMap(injector._injector);
    if (wrapped) return wrapped;

    // Legacy NgModule injector
    const legacy = injector._def?.providers;
    if (legacy instanceof Map) return legacy;

    return null;
  } catch {
    return null;
  }
}

/** Detect NgRx Store, ComponentStore, SignalStore, Actions, and Effects in the injector. */
export function detectNgrx(
  injector: any,
  signalMap: Map<string, SignalStateEntry>,
  obsMap: Map<string, ObservableStateEntry>,
): NgrxEntry[] {
  const records = getInjectorRecords(injector);
  if (!records) return [];

  const entries: NgrxEntry[] = [];
  const seen = new Set<string>();

  for (const [token] of records) {
    let inst: any;
    try {
      inst = injector.get(token, null, { optional: true } as any);
    } catch { continue; }
    if (!inst) continue;

    const name: string = inst.constructor?.name ?? '';
    if (!name || seen.has(name)) continue;

    let storeType: NgrxStoreType | null = null;

    if (
      typeof inst.dispatch === 'function' &&
      typeof inst.select === 'function' &&
      typeof inst.pipe === 'function'
    ) {
      storeType = 'store';
    } else if (
      typeof inst.setState === 'function' &&
      typeof inst.patchState === 'function' &&
      typeof inst.updater === 'function'
    ) {
      storeType = 'component-store';
    } else if (
      name === 'Actions' &&
      typeof inst.pipe === 'function'
    ) {
      storeType = 'actions';
    } else if (
      name.includes('Effects') &&
      inst.constructor?.ɵprov
    ) {
      storeType = 'effects';
    }

    if (storeType) {
      seen.add(name);
      const features = tryGetNgrxFeatures(inst);
      const filePath = tryGetFilePathFromCtor(inst.constructor);
      entries.push({ className: name, filePath, storeType, features });
    }

    // Also scan NgRx service instances for signal/observable state
    if (name && (name.includes('Store') || name.includes('State') || name.includes('Facade'))) {
      scanInstanceState(inst, name, 'service', new Set(), signalMap, obsMap);
    }
  }

  return entries;
}

function tryGetNgrxFeatures(store: any): string[] {
  try {
    const state = store.source?.value ?? store['_state']?.getValue?.() ?? {};
    return Object.keys(state).slice(0, 20);
  } catch {
    return [];
  }
}

/** Collect HTTP interceptors registered under the HTTP_INTERCEPTORS multi-token. */
export function collectInterceptors(injector: any): InterceptorRegistryEntry[] {
  const records = getInjectorRecords(injector);
  if (!records) return [];

  const results: InterceptorRegistryEntry[] = [];
  let order = 0;
  const seen = new Set<string>();

  for (const [token] of records) {
    try {
      // HTTP_INTERCEPTORS token has specific description
      const tokenDesc: string = token?._desc ?? token?.description ?? '';
      if (tokenDesc.toLowerCase().includes('http_interceptors') ||
          tokenDesc.toLowerCase().includes('httpinterceptor')) {
        // It's a multi-provider; get all values
        const arr: any[] = injector.get(token, [], { optional: true } as any);
        if (Array.isArray(arr)) {
          for (const interceptor of arr) {
            const name = interceptor?.constructor?.name ?? 'Unknown';
            if (!seen.has(name)) {
              seen.add(name);
              const functional = !interceptor.constructor?.prototype?.intercept;
              const filePath = tryGetFilePathFromCtor(interceptor.constructor);
              results.push({ className: name, functional, order: order++, filePath });
            }
          }
        }
        continue;
      }

      // Also detect by duck-typing: instance has intercept(req, next) method
      const inst = injector.get(token, null, { optional: true } as any);
      if (!inst) continue;
      const proto = Object.getPrototypeOf(inst);
      if (typeof proto?.intercept === 'function') {
        const name = inst.constructor?.name ?? 'Unknown';
        if (!seen.has(name)) {
          seen.add(name);
          results.push({ className: name, functional: false, order: order++, filePath: tryGetFilePathFromCtor(inst.constructor) });
        }
      }
    } catch { /* ignore */ }
  }

  return results;
}

/**
 * Walk the full injector chain and collect every registered provider.
 * Works in both dev and production mode since it reads the injector metadata,
 * not live instances (no lazy instantiation side-effects).
 */
export function collectAppProviders(injector: any): AppProviderEntry[] {
  const seen = new Set<string>();
  const entries: AppProviderEntry[] = [];

  // Ensure we start with an R3Injector (unwrap NodeInjector if needed)
  let current: any = unwrapToR3Injector(injector);
  while (current) {
    // Support both R3Injector (Angular 21: .records, older: ._records) and wrapper
    const records: Map<any, any> | undefined =
      getInjectorMap(current) ??
      getInjectorMap(current.injector) ??
      getInjectorMap(current._injector) ??
      undefined;

    if (records) {
      for (const [token] of records) {
        try {
          let name: string | null = null;
          let kind: AppProviderEntry['kind'] = 'class';

          if (typeof token === 'function') {
            name = token.name || null;
            kind = 'class';
          } else if (token != null && typeof token === 'object' && typeof token._desc === 'string') {
            name = token._desc;
            const isMulti = token.options?.multi === true || token.multi === true;
            kind = isMulti ? 'multi' : 'token';
          }

          if (!name || name.length < 2) continue;
          if (PROVIDER_SKIP_PREFIXES.some(p => name!.startsWith(p))) continue;
          if (seen.has(name)) continue;
          seen.add(name);

          entries.push({ name, kind, category: categorizeProvider(name) });
        } catch { /* ignore */ }
      }
    }
    current = current._parent ?? current.parent ??
              current._injector?.parent ?? current.injector?.parent ?? null;
  }

  // Sort: app-defined first (user code), then feature groups, then Angular core
  const ORDER: Record<string, number> = {
    app: 0, router: 1, http: 2, forms: 3, animations: 4,
    security: 5, i18n: 6, core: 7, other: 8,
  };
  entries.sort((a, b) => {
    const od = (ORDER[a.category] ?? 8) - (ORDER[b.category] ?? 8);
    return od !== 0 ? od : a.name.localeCompare(b.name);
  });

  return entries;
}

/** Collect InjectionToken instances from the injector's record map. */
export function collectInjectionTokens(injector: any): TokenRegistryEntry[] {
  const records = getInjectorRecords(injector);
  if (!records) return [];

  const tokens: TokenRegistryEntry[] = [];
  const seen = new Set<string>();

  for (const [token] of records) {
    try {
      // InjectionToken objects have _desc (description) and ngMetadataName
      const isToken =
        token != null &&
        typeof token === 'object' &&
        typeof token._desc === 'string';

      if (!isToken) continue;

      const name: string = token._desc;
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const multi = token.options?.multi === true || token.multi === true;
      tokens.push({ name, multi, filePath: null });
    } catch { /* ignore */ }
  }

  return tokens;
}

/** Scan service instances from the injector for signal/observable state patterns. */
export function scanInjectorServices(
  injector: any,
  instancesSeen: Set<string>,
  signalMap: Map<string, SignalStateEntry>,
  obsMap: Map<string, ObservableStateEntry>,
): void {
  const records = getInjectorRecords(injector);
  if (!records) return;

  for (const [token] of records) {
    try {
      if (typeof token !== 'function') continue;
      const name: string = token.name ?? '';
      if (!name || instancesSeen.has(name)) continue;

      const inst = injector.get(token, null, { optional: true } as any);
      if (!inst || typeof inst !== 'object') continue;

      scanInstanceState(inst, name, 'service', instancesSeen, signalMap, obsMap);
    } catch { /* ignore */ }
  }
}

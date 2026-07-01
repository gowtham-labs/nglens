/**
 * Page Script Orchestrator — runs in the page's MAIN world.
 *
 * Responsibilities:
 * 1. Listen for scan/detection requests from the content script via CustomEvents
 * 2. Detect Angular presence, version, and runtime mode
 * 3. Instantiate and run analyzers via the registry
 * 4. Enforce performance budget (CPU < 3%, memory < 50MB)
 * 5. Respect DOM traversal cap (1000 elements per pass)
 * 6. Dispatch results back to the content script via CustomEvents
 */

import type { AnalyzerResult, AnalyzerType, RuntimeMode } from '../types/analyzer';
import type { DetectionResult, PageMessage, ScanRequestPayload } from '../types/messages';
import type { PerformanceScore, PerformanceSubScore } from '../types/scoring';
import type { OverlayConfig } from '../types/overlay';
import { MAX_ELEMENTS_PER_SCAN } from '../utils/constants';
import { findAngularComponents } from '../utils/dom-utils';
import { createBudgetMonitor, type BudgetMonitor } from '../utils/performance-budget';
import { cleanupAllObservers } from '../utils/sampling';
import { runAnalyzers, getRegisteredCount } from '../analyzers';
import {
  injectOverlayStyles,
  showOverlay,
  hideOverlay,
  clearAllOverlays
} from './overlay-renderer';

// Side-effect imports: auto-register analyzers
import '../analyzers/performance-scorer';
import '../analyzers/dom-inspector';
import '../analyzers/production-analyzer';
import '../analyzers/enterprise-optimizer';
import '../analyzers/best-practices-detector';
import '../analyzers/subscription-leak-detector';
import '../analyzers/signals-analyzer';

// --- Event Constants ---
// These mirror the constants in message-bridge.ts but are defined locally
// since the page-script cannot import from the content script module.
const CONTENT_TO_PAGE_EVENT = '__ng_perf_to_page';
const PAGE_TO_CONTENT_EVENT = '__ng_perf_to_content';

// --- Budget Monitor (shared across scans) ---
let budgetMonitor: BudgetMonitor = createBudgetMonitor();

// --- Angular Detection ---

/**
 * Detects Angular presence on the current page.
 *
 * Detection logic:
 * - If `window.ng` exists → development mode
 * - If no `window.ng` but `[ng-version]` or `_nghost-*` attributes exist → production mode
 * - Otherwise → not Angular
 *
 * Also reads the Angular version from the `[ng-version]` attribute
 * and counts components using `findAngularComponents()` (capped at MAX_ELEMENTS_PER_SCAN).
 */
function detectAngular(): DetectionResult {
  const ng = (globalThis as unknown as { ng?: unknown }).ng;
  const ngVersionElement = document.querySelector('[ng-version]');
  const version = ngVersionElement?.getAttribute('ng-version') ?? null;

  // Check for Angular host attributes (production markers)
  const hasNgHostAttr = hasAngularHostAttributes();

  let isAngular = false;
  let mode: RuntimeMode | null = null;

  if (ng) {
    // Development mode: window.ng is available
    isAngular = true;
    mode = 'development';
  } else if (ngVersionElement || hasNgHostAttr) {
    // Production mode: Angular DOM markers present but no window.ng
    isAngular = true;
    mode = 'production';
  }

  // Count components (respects MAX_ELEMENTS_PER_SCAN cap)
  let componentCount = 0;
  if (isAngular) {
    const components = findAngularComponents(document);
    componentCount = components.length;
  }

  return {
    isAngular,
    version,
    mode,
    componentCount,
  };
}

/**
 * Checks if any element in the DOM has Angular host attributes (_nghost-*).
 * Scans up to MAX_ELEMENTS_PER_SCAN elements.
 */
function hasAngularHostAttributes(): boolean {
  const allElements = document.querySelectorAll('*');
  const limit = Math.min(allElements.length, MAX_ELEMENTS_PER_SCAN);

  for (let i = 0; i < limit; i++) {
    const el = allElements[i];
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('_nghost-')) {
        return true;
      }
    }
  }
  return false;
}

// --- Scan Orchestration ---

/**
 * Handles a SCAN_REQUEST message from the content script.
 *
 * Flow:
 * 1. Start performance budget tracking
 * 2. Run Angular detection
 * 3. Run requested analyzers via the orchestrator
 * 4. Check budget after scan
 * 5. Cleanup observers
 * 6. Dispatch results back to content script
 */
async function handleScanRequest(
  payload: ScanRequestPayload,
  eventId: string
): Promise<void> {
  // Start budget tracking
  budgetMonitor.reset();
  budgetMonitor.startTracking();

  try {
    // Step 1: Detect Angular
    const detection = detectAngular();

    // If no Angular detected, return early with empty results
    if (!detection.isAngular) {
      budgetMonitor.stopTracking();
      dispatchResult(eventId, 'SCAN_RESULTS', {
        detection,
        score: createEmptyScore(detection.mode),
        results: [],
        actionItems: [],
      });
      return;
    }

    // Step 2: Run analyzers (if any are registered)
    let results: AnalyzerResult[] = [];
    if (getRegisteredCount() > 0) {
      const analyzerTypes: AnalyzerType[] = payload.analyzers.length > 0
        ? payload.analyzers
        : []; // Empty array means runAnalyzers will run all registered

      results = await runAnalyzers(analyzerTypes, {
        mode: detection.mode ?? 'production',
        maxElements: payload.config?.maxElements ?? MAX_ELEMENTS_PER_SCAN,
        timeout: payload.config?.timeout,
      });
    }

    // Step 3: Check budget after scan
    budgetMonitor.stopTracking();
    const budgetStatus = budgetMonitor.checkBudget();

    // Step 4: Cleanup all MutationObservers
    cleanupAllObservers();

    // Step 5: Build and dispatch results
    const score = extractScoreFromResults(results, detection.mode);

    dispatchResult(eventId, 'SCAN_RESULTS', {
      detection,
      score,
      results,
      actionItems: [], // Action prioritizer is a separate service (task 5.1)
      metadata: {
        budgetStatus: {
          withinBudget: budgetStatus.withinBudget,
          cpuPercent: budgetStatus.cpuPercent,
          violations: budgetStatus.violations,
        },
      },
    });
  } catch (error: unknown) {
    // On error, stop tracking and report
    budgetMonitor.stopTracking();
    cleanupAllObservers();

    const message = error instanceof Error ? error.message : 'Unknown scan error';
    dispatchResult(eventId, 'ERROR', { message });
  }
}

/**
 * Handles a DETECTION_STATUS request — runs detection only and returns the result.
 */
function handleDetectionStatus(eventId: string): void {
  const detection = detectAngular();
  dispatchResult(eventId, 'DETECTION_STATUS', detection);
}

// --- Result Dispatch ---

/**
 * Dispatches a result back to the content script via CustomEvent.
 */
function dispatchResult<T>(eventId: string, type: string, payload: T): void {
  const message: PageMessage<T> = {
    eventId,
    type: type as PageMessage['type'],
    payload,
  };

  globalThis.dispatchEvent(
    new CustomEvent(PAGE_TO_CONTENT_EVENT, { detail: message })
  );
}

// --- Score Helpers ---

/**
 * Extracts the performance score from analyzer results.
 * If the performance-scorer analyzer ran, uses its result.
 * Otherwise returns an empty/default score.
 */
function extractScoreFromResults(
  results: AnalyzerResult[],
  mode: RuntimeMode | null
): PerformanceScore {
  const scorerResult = results.find((r) => r.analyzer === 'performance-scorer');

  if (scorerResult?.metadata?.score) {
    return scorerResult.metadata.score as PerformanceScore;
  }

  return createEmptyScore(mode);
}

/**
 * Creates an empty performance score (all zeros).
 */
function createEmptyScore(mode: RuntimeMode | null): PerformanceScore {
  const emptySubScore = (name: string, weight: number): PerformanceSubScore => ({
    name,
    score: 0,
    weight,
    details: 'No data available',
  });

  return {
    overall: 0,
    subScores: {
      changeDetection: emptySubScore('Change Detection', 0.4),
      componentTreeDepth: emptySubScore('Component Tree Depth', 0.2),
      templateComplexity: emptySubScore('Template Complexity', 0.2),
      detectedBottlenecks: emptySubScore('Detected Bottlenecks', 0.2),
    },
    timestamp: Date.now(),
    mode: mode ?? 'production',
  };
}

// --- Event Listener ---

/**
 * Main event listener for messages from the content script.
 * Listens on the CONTENT_TO_PAGE_EVENT channel.
 */
function handleContentMessage(event: Event): void {
  const customEvent = event as CustomEvent<PageMessage>;
  const message = customEvent.detail;

  if (!message?.type || !message?.eventId) {
    return;
  }

  switch (message.type) {
    case 'SCAN_REQUEST':
      handleScanRequest(
        message.payload as ScanRequestPayload,
        message.eventId
      );
      break;

    case 'DETECTION_STATUS':
      handleDetectionStatus(message.eventId);
      break;

    case 'OVERLAY_SHOW': {
      const config = message.payload as OverlayConfig;
      const overlayId = showOverlay(config);
      if (overlayId) {
        dispatchResult(message.eventId, 'SUCCESS', { overlayId });
      } else {
        dispatchResult(message.eventId, 'ERROR', {
          message: `Element not found: ${config.elementSelector}`
        });
      }
      break;
    }

    case 'OVERLAY_HIDE': {
      const { overlayId } = message.payload as { overlayId: string };
      hideOverlay(overlayId);
      dispatchResult(message.eventId, 'SUCCESS', {});
      break;
    }

    case 'OVERLAY_CLEAR_ALL': {
      clearAllOverlays();
      dispatchResult(message.eventId, 'SUCCESS', {});
      break;
    }

    default:
      // Unknown message type — ignore
      break;
  }
}

// --- Orchestrator Import ---
import { initOrchestrator } from '../instrumentation/orchestrator';

// --- Window Extensions (DevTools panel integration) ---

/**
 * Exposes Angular constructor lookup on `globalThis` for the DevTools panel.
 *
 * The DevTools panel calls (via chrome.devtools.inspectedWindow.eval):
 *   inspect(window.ngLensInspection.findConstructorByName("ClassName"))
 *
 * Chrome's built-in `inspect(fn)` DevTools Command Line API receives the actual
 * constructor function and navigates Sources to its definition — this works for
 * user code AND external packages (e.g. @angular/material) because V8 tracks
 * every function's source position. Source maps enable navigation to original TS.
 *
 * Pattern mirrors Angular DevTools' chrome-window-extensions.ts.
 */
/**
 * Walks ALL DOM elements and collects every Angular constructor into `map`.
 *
 * Three strategies — mirrors Angular DevTools' RTreeStrategy + LTreeStrategy:
 *
 *   A. window.ng.getComponent()   — component instance on host elements (dev mode)
 *   B. window.ng.getDirectives()  — directive instances including attribute-selector
 *      components (e.g. MatButton on <button mat-button>) (dev mode)
 *   C. el.__ngContext__ (LView)   — Angular DevTools LTreeStrategy; TView.type is
 *      the component constructor. Works in BOTH dev and production modes.
 */
function seedConstructorMapFromDom(map: Map<string, Function>): void {
  const g = globalThis as Record<string, unknown>;
  const ng = g['ng'] as {
    getComponent?: (el: Element) => { constructor: Function } | null;
    getDirectives?: (el: Element) => Array<{ constructor: Function }> | null;
  } | undefined;

  const elements = document.querySelectorAll('*');
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];

    // Strategy A + B: window.ng debug API (Angular dev mode)
    if (ng) {
      try {
        const comp = ng.getComponent?.(el);
        if (comp?.constructor?.name) map.set(comp.constructor.name, comp.constructor);
      } catch { /* not a component host */ }

      try {
        const dirs = ng.getDirectives?.(el);
        if (Array.isArray(dirs)) {
          for (const d of dirs) {
            if (d?.constructor?.name) map.set(d.constructor.name, d.constructor);
          }
        }
      } catch { /* not a directive host */ }
    }

    // Strategy C: __ngContext__ LView — Angular DevTools LTreeStrategy
    // lView[1] = TView; TView.type = the component constructor for this LView.
    // This works even when window.ng is unavailable (production mode).
    try {
      const ctx = (el as unknown as Record<string, unknown>)['__ngContext__'];
      if (Array.isArray(ctx)) {
        const tView = ctx[1] as Record<string, unknown> | undefined;
        const type = tView?.['type'] as Function | undefined;
        if (typeof type === 'function' && type.name) {
          map.set(type.name, type);
        }
      }
    } catch { /* ignore */ }
  }
}

function initializeLensWindowExtensions(): void {
  // constructor.name → constructor Function.
  // Seeded in two ways:
  //   • seedConstructorMapFromDom() — immediate DOM walk on init + on every scan
  //   • registerConstructors(seen) — full Ivy metadata walk from collectAppStructure()
  //     covers ALL registered classes including ones NOT currently in the DOM
  //     (lazy routes, library classes not yet instantiated, etc.)
  const constructorsByName = new Map<string, Function>();
  // Guard so seedConstructorMapFromIvyTree runs at most once per page-load
  // (it's an O(n) metadata walk — cheap, but no need to repeat it).
  let _ivyTreeSeeded = false;
  // Populated by the Angular profiler hook: component name → { url, isExternal }.
  // url = the actual runtime HTTP URL captured from the call stack during
  // change-detection (e.g. 'http://localhost:4200/@angular/material/fesm2022/button.mjs').
  // Populated passively as components render — no manual scan needed.
  const sourceUrls = new Map<string, { url: string; isExternal: boolean }>();

  // Seed immediately from whatever is already in the DOM at extension load time.
  // Angular may not have bootstrapped yet; if so, map stays empty until the first
  // scan or until findConstructorByName() is called (which re-seeds on demand).
  seedConstructorMapFromDom(constructorsByName);

  // Hook into Angular's change-detection profiler — auto-captures constructors
  // AND their runtime source URLs as components render.
  // Wraps any existing profiler (Angular DevTools, etc.) rather than replacing it.
  hookAngularProfilerSafely(constructorsByName, sourceUrls);

  (globalThis as Record<string, unknown>)['ngLensInspection'] = {
    constructorsByName,

    /**
     * Called by app-structure-collector after each SCAN_APP_STRUCTURE to replace
     * the cache with every constructor that processConstructor() visited.
     * This is the comprehensive path — it covers all classes from ɵcmp.dependencies
     * recursively, including external-package classes never rendered to the DOM.
     * A DOM re-seed runs afterwards to capture any live instances not in the Ivy tree.
     */
    registerConstructors: (ctors: Set<Function>): void => {
      constructorsByName.clear();
      for (const ctor of ctors) {
        if (typeof ctor === 'function' && ctor.name) {
          constructorsByName.set(ctor.name, ctor);
        }
      }
      // Supplement with live DOM instances (covers standalone components and newly
      // bootstrapped classes that post-date the static metadata walk).
      seedConstructorMapFromDom(constructorsByName);
    },

    /**
     * Returns the constructor for the Angular class whose name equals `className`.
     *
     * Mirrors Angular DevTools' chrome-window-extensions.ts `findConstructorByPosition`
     * and `findConstructorByNameForRouter` patterns — all lookup logic lives here in
     * the page-script so the DevTools panel eval stays minimal:
     *   `inspect(window.ngLensInspection.findConstructorByName("ClassName"))`
     *
     * Lookup order:
     *   1. Pre-populated cache  (O(1) — populated by registerConstructors after scan)
     *   2. Fresh DOM seed        (walks live DOM via ng.getComponent / ng.getDirectives
     *                            / __ngContext__ — same as Angular DevTools RTreeStrategy
     *                            + LTreeStrategy)
     *   3. Router config walk   (mirrors viewSourceFromRouter — finds guards, resolvers,
     *                            and route components for classes not yet in the DOM,
     *                            e.g. lazy-loaded routes or Angular-CDK/Material guards)
     *   4. Returns undefined only if truly not found anywhere
     */
    /**
     * Returns the captured runtime source URL for `className`, or null if the
     * Angular profiler hook hasn't seen that class render yet.
     * url is the actual HTTP URL from the call stack at change-detection time —
     * e.g. 'http://localhost:4200/@angular/material/fesm2022/button.mjs' for an
     * external package, or 'http://localhost:4200/src/app/hero.component.ts' for
     * a local Vite-served file.
     */
    getSourceEntry: (className: string): { url: string; isExternal: boolean } | null => {
      return sourceUrls.get(className) ?? null;
    },

    findConstructorByName: (className: string): Function | undefined => {
      // 1. Cache hit
      const cached = constructorsByName.get(className);
      if (cached) return cached;

      // 2. Re-seed from live DOM (same strategies as Angular DevTools' buildDirectiveForest)
      seedConstructorMapFromDom(constructorsByName);
      const domHit = constructorsByName.get(className);
      if (domHit) return domHit;

      // 3. Router config walk (mirrors Angular DevTools' viewSourceFromRouter /
      //    getRouterCallableConstructRef) — catches guards, resolvers, and route
      //    components whose classes are not currently rendered in the DOM.
      seedConstructorMapFromRouterConfig(constructorsByName);
      const routerHit = constructorsByName.get(className);
      if (routerHit) return routerHit;

      // 4. Lazy Ivy dependency-tree walk — same metadata traversal as app-structure-
      //    collector's SCAN_APP_STRUCTURE, but triggered on-demand so the user never
      //    needs to manually run a scan.
      //    Finds every ɵcmp.dependencies()-reachable class: Angular Material, CDK,
      //    CoreUI, PrimeNG, and any other library imported anywhere in the app.
      //    Runs exactly ONCE per page-load (result is cached in constructorsByName).
      if (!_ivyTreeSeeded) {
        _ivyTreeSeeded = true;
        seedConstructorMapFromIvyTree(constructorsByName);
      }
      return constructorsByName.get(className);
    },
  };
}

/**
 * Extracts the most relevant HTTP source URL from the current call stack.
 * Filters out Angular internals (zone.js, @angular/core, compiler) to find
 * the component's own origin file.
 *
 * For Vite-built apps this gives the exact TypeScript URL ('...component.ts').
 * For webpack bundles it gives the chunk URL ('...main.js').
 * For external npm packages it gives the fesm/mjs URL.
 */
function extractSourceUrlFromStack(): { url: string; isExternal: boolean } | null {
  try {
    const stack = new Error().stack ?? '';
    for (const line of stack.split('\n')) {
      const m = line.match(/https?:\/\/[^\s\)]+/);
      if (!m) continue;
      // Strip trailing :line:col to get a clean file URL
      const url = m[0].replace(/:\d+(?::\d+)?$/, '');
      if (
        url.includes('zone.js') ||
        url.includes('@angular/core') ||
        url.includes('compiler.mjs') ||
        url.includes('page-script')
      ) continue;
      const isExternal =
        url.includes('node_modules') ||
        url.includes('/fesm') ||
        url.includes('vendor.js');
      return { url, isExternal };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Installs a lightweight shim on `__ANGULAR_DEVTOOLS_GLOBAL_HOOK__.setProfiler`
 * so that every Angular change-detection cycle automatically:
 *   1. Caches the component constructor in `constructorsByName`
 *   2. Records its runtime JS/TS source URL in `sourceUrls`
 *
 * COMPOSING strategy: the shim wraps any existing/future profiler install
 * (Angular DevTools, custom profilers) so all receive their callbacks.
 * Mirrors the article's `__ANGULAR_DEVTOOLS_GLOBAL_HOOK__.setProfiler` pattern.
 */
function hookAngularProfilerSafely(
  constructorsByName: Map<string, Function>,
  sourceUrls: Map<string, { url: string; isExternal: boolean }>,
): void {
  const g = globalThis as Record<string, unknown>;
  const hook = g['__ANGULAR_DEVTOOLS_GLOBAL_HOOK__'] as {
    setProfiler?: (profiler: {
      onChangeDetectionStart?: (component: unknown, directive: unknown) => void;
      onChangeDetectionEnd?: (component: unknown, directive: unknown) => void;
    } | null) => void;
  } | undefined;

  if (!hook?.setProfiler) return;

  function capture(component: unknown): void {
    const comp = component as { constructor?: Function } | null;
    if (!comp?.constructor?.name) return;
    const name = comp.constructor.name;
    // Always update constructor reference (may have changed after hot-reload)
    constructorsByName.set(name, comp.constructor);
    // Capture source URL once per class — stack trace is only meaningful during
    // the first execution when the call frames are fresh.
    if (!sourceUrls.has(name)) {
      const entry = extractSourceUrlFromStack();
      if (entry) sourceUrls.set(name, entry);
    }
  }

  // Monkey-patch setProfiler so we compose with ANY future profiler install
  // (Angular DevTools calling setProfiler after us still keeps our hook active).
  const originalSetProfiler = hook.setProfiler.bind(hook);
  hook.setProfiler = (userProfiler) => {
    const composed: typeof userProfiler = userProfiler
      ? {
          ...userProfiler,
          onChangeDetectionStart(component: unknown, directive: unknown): void {
            capture(component);
            userProfiler.onChangeDetectionStart?.(component, directive);
          },
        }
      : { onChangeDetectionStart: (c: unknown) => capture(c) };
    originalSetProfiler(composed);
  };

  // Install our initial profiler to start capturing immediately
  hook.setProfiler({ onChangeDetectionStart: (c) => capture(c) });
}

/**
 * Lazily seeds `map` by walking the entire Ivy component dependency tree from the
 * root Angular component.  Finds every class reachable via `ɵcmp.dependencies()` —
 * the same set that `app-structure-collector.ts` visits during SCAN_APP_STRUCTURE —
 * but triggered on-demand so no manual scan is required.
 *
 * Covers: external package components/directives/pipes (@angular/material, CDK,
 * @coreui/angular, primeng, etc.) that may not be in the current DOM but ARE imported.
 */
function seedConstructorMapFromIvyTree(map: Map<string, Function>): void {
  const g = globalThis as Record<string, unknown>;
  const ng = g['ng'] as { getComponent?: (el: Element) => { constructor: Function } | null } | undefined;
  const rootEl = document.querySelector('[ng-version]');
  if (!rootEl) return;

  let rootCtor: (Function & Record<string, unknown>) | undefined;

  // Dev mode: ng.getComponent on the root element
  if (ng?.getComponent) {
    try {
      const inst = ng.getComponent(rootEl as Element);
      if (inst?.constructor) rootCtor = inst.constructor as Function & Record<string, unknown>;
    } catch { /* ignore */ }
  }

  // All modes: read TView.type from LView.__ngContext__ (same as Strategy C)
  if (!rootCtor) {
    try {
      const ctx = (rootEl as unknown as Record<string, unknown>)['__ngContext__'];
      if (Array.isArray(ctx)) {
        const type = (ctx[1] as Record<string, unknown>)?.['type'] as Function | undefined;
        if (typeof type === 'function') rootCtor = type as Function & Record<string, unknown>;
      }
    } catch { /* ignore */ }
  }

  if (!rootCtor) return;

  const walked = new Set<Function>();
  walkIvyDeps(rootCtor, walked, map);
}

/**
 * Recursively walks an Angular constructor's Ivy definition metadata
 * (`ɵcmp`, `ɵdir`, `ɵpipe`, `ɵmod`) and adds every named constructor
 * reachable via `dependencies()` / `declarations` / `imports` to `map`.
 */
function walkIvyDeps(
  ctor: Function & Record<string, unknown>,
  walked: Set<Function>,
  map: Map<string, Function>,
): void {
  if (!ctor || walked.has(ctor)) return;
  walked.add(ctor);
  if (ctor.name) map.set(ctor.name as string, ctor);

  for (const key of ['ɵcmp', 'ɵdir', 'ɵpipe', 'ɵmod'] as const) {
    const def = ctor[key] as Record<string, unknown> | undefined;
    if (!def) continue;
    try {
      // Standalone components/directives: dependencies factory or array
      let deps: unknown[] = [];
      if (typeof def['dependencies'] === 'function') {
        deps = (def['dependencies'] as () => unknown[])() ?? [];
      } else if (Array.isArray(def['dependencies'])) {
        deps = def['dependencies'] as unknown[];
      }
      for (const dep of deps) {
        if (typeof dep === 'function') walkIvyDeps(dep as Function & Record<string, unknown>, walked, map);
      }
      // NgModule declarations / imports arrays
      for (const arrKey of ['declarations', 'imports'] as const) {
        const arr = def[arrKey];
        if (Array.isArray(arr)) {
          for (const item of arr as unknown[]) {
            if (typeof item === 'function') walkIvyDeps(item as Function & Record<string, unknown>, walked, map);
          }
        }
      }
    } catch { /* ignore lazy-dep resolution errors */ }
  }
}

/**
 * Walks the Angular Router's route configuration and seeds `map` with every
 * callable construct (components, guards, resolvers) found in the tree.
 *
 * Mirrors Angular DevTools' `viewSourceFromRouter` + `getRouterCallableConstructRef`.
 * Uses duck-typing to find the Router instance without importing `@angular/router`.
 */
function seedConstructorMapFromRouterConfig(map: Map<string, Function>): void {
  const ng = (globalThis as Record<string, unknown>)['ng'] as
    { getInjector?: (el: Element) => unknown } | undefined;
  if (!ng?.getInjector) return;

  const rootEl = document.querySelector('[ng-version]');
  if (!rootEl) return;

  try {
    const injector = ng.getInjector(rootEl) as Record<string, unknown> | null;
    if (!injector) return;

    // Find the Router instance via the injector's internal record map.
    // The Router is identifiable by duck-typing: it has `config` (array) and `navigate` (fn).
    const records = (injector['_lView'] as Record<string, unknown>[] | undefined)
      ?? (injector as Record<string, unknown>);
    let router: Record<string, unknown> | null = null;

    // Try injector.get with a string token as a heuristic (not guaranteed, but works for
    // DI implementations that support string keys). Fall through gracefully if it throws.
    try {
      const r = (injector as Record<string, (token: unknown) => unknown>)['get']?.('Router');
      if (r && Array.isArray((r as Record<string, unknown>)['config']) &&
          typeof (r as Record<string, unknown>)['navigate'] === 'function') {
        router = r as Record<string, unknown>;
      }
    } catch { /* not available via string token */ }

    // Alternative: scan the injector's provider records by duck-typing.
    if (!router) {
      const providerRecords =
        (injector as Record<string, unknown>)['_records'] ??
        (injector as Record<string, unknown>)['records'];
      if (providerRecords instanceof Map) {
        for (const [, rec] of providerRecords as Map<unknown, Record<string, unknown>>) {
          const val = rec?.['value'];
          if (val &&
              Array.isArray((val as Record<string, unknown>)['config']) &&
              typeof (val as Record<string, unknown>)['navigate'] === 'function') {
            router = val as Record<string, unknown>;
            break;
          }
        }
      }
    }

    if (!router) return;

    walkRouteArray(router['config'] as unknown[], map);
  } catch { /* ignore — router may not be available */ }
}

/**
 * Recursively walks an Angular route array and adds every callable construct to `map`.
 * Handles: component, canActivate, canActivateChild, canDeactivate, canMatch, resolve,
 * children, and (statically loaded) loadedConfig.
 */
function walkRouteArray(routes: unknown[], map: Map<string, Function>): void {
  for (const route of routes) {
    if (!route || typeof route !== 'object') continue;
    const r = route as Record<string, unknown>;

    // Component
    if (typeof r['component'] === 'function' && (r['component'] as Function).name) {
      map.set((r['component'] as Function).name, r['component'] as Function);
    }

    // Guards: canActivate, canActivateChild, canDeactivate, canMatch
    for (const prop of ['canActivate', 'canActivateChild', 'canDeactivate', 'canMatch']) {
      const guards = r[prop];
      if (Array.isArray(guards)) {
        for (const g of guards) {
          if (typeof g === 'function' && (g as Function).name) {
            map.set((g as Function).name, g as Function);
          }
        }
      }
    }

    // Resolvers: resolve is { [key]: fn | class }
    if (r['resolve'] && typeof r['resolve'] === 'object') {
      for (const key of Object.keys(r['resolve'] as object)) {
        const fn = (r['resolve'] as Record<string, unknown>)[key];
        if (typeof fn === 'function' && (fn as Function).name) {
          map.set((fn as Function).name, fn as Function);
        }
      }
    }

    // Recurse into children
    if (Array.isArray(r['children'])) walkRouteArray(r['children'] as unknown[], map);
    // Recurse into already-loaded lazy config
    if (Array.isArray((r['_loadedRoutes'] as unknown[]))) {
      walkRouteArray(r['_loadedRoutes'] as unknown[], map);
    }
  }
}

// --- Initialization ---

function initialize(): void {
  // console.log('[ngLens page-script] Initializing...');

  // Inject overlay styles on page load
  injectOverlayStyles();

  // Listen for messages from content script
  globalThis.addEventListener(CONTENT_TO_PAGE_EVENT, handleContentMessage);

  // Initialize the instrumentation orchestrator (V2 command handling)
  try {
    initOrchestrator();
    // console.log('[ngLens page-script] Orchestrator initialized');
  } catch (err) {
    // console.error('[ngLens page-script] Orchestrator init failed:', err);
  }

  // Expose Angular constructor lookup for the DevTools panel
  // (enables inspect(constructor) navigation to Sources for all packages)
  initializeLensWindowExtensions();

  // Signal to the content script that the page-script is ready to receive commands
  // console.log('[ngLens page-script] Ready');
  globalThis.dispatchEvent(new CustomEvent('nglens-ready'));
}

// Start immediately
initialize();

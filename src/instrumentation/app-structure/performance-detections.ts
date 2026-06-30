/**
 * Performance Detections — Angular performance anti-patterns.
 * Runs in the page's MAIN world as part of the app-structure collection.
 *
 * Original 18 detections (#1–#18):
 *  #1  Impure pipes (pure: false) — re-execute on every CD cycle
 *  #2  @HostListener on high-frequency events (scroll, resize, mousemove) without debounce
 *  #3  Large *ngFor / @for lists without CDK virtual scrolling
 *  #4  Heavy ngDoCheck / ngAfterViewChecked / ngAfterContentChecked implementations
 *  #5  Duplicate service instances across injector hierarchy levels
 *  #6  Eagerly loaded routes that could use loadComponent / loadChildren
 *  #7  ChangeDetectorRef.detectChanges() / markForCheck() called inside lifecycle hooks
 *  #8  OnPush child component nested under a Default-strategy parent (CD benefit lost)
 *  #9  OnPush component with object-shaped @Input() — mutation-in-place risk
 *  #10 Large component subtree that could benefit from @defer (Angular 17+)
 *  #11 Zoneless change detection migration readiness assessment
 *  #12 ExpressionChangedAfterItHasBeenCheckedError — intercepted at runtime via console hook
 *  #13 Reactive forms and template-driven (NgModel) forms mixed in the same component
 *  #14 @ViewChildren / @ContentChildren QueryList properties detected on component instances
 *  #15 High-frequency Zone.js event listeners (scroll / resize / wheel) — combined with #2
 *  #16 Standalone component importing full NgModules instead of individual components
 *  #17 Angular animation triggers using layout-causing CSS properties (width, height, …)
 *  #18 APP_INITIALIZER registration count and async-initializer detection
 *
 * New detections (N1–N22):
 *  N1  Template method/function calls re-executing on every CD cycle
 *  N2  *ngFor / @for without a custom trackBy function
 *  N5  Observable .subscribe() in lifecycle hooks without managed cleanup
 *  N8  Component tree nesting depth exceeding threshold
 *  N11 Router with lazy routes but no preloading strategy configured
 *  N14 Direct DOM manipulation via ElementRef.nativeElement in lifecycle hooks
 *  N22 Service using providedIn: 'any' — creates a new instance per lazy module
 */

import type {
  ComponentRegistryEntry,
  DirectiveRegistryEntry,
  PipeRegistryEntry,
  RouteRegistryEntry,
  ServiceRegistryEntry,
  SignalStateEntry,
  PerformanceDetections,
  ImpurePipeEntry,
  HostListenerIssue,
  LargeListDetection,
  HeavyLifecycleHookEntry,
  DuplicateServiceEntry,
  EagerLoadedRouteEntry,
  CdRefAbuseEntry,
  CdStrategyMismatchEntry,
  OnPushInputMutationRisk,
  DeferOpportunityEntry,
  ZonelessReadinessEntry,
  ExpressionChangedErrorEntry,
  FormsMixingEntry,
  QueryListOveruseEntry,
  ImportBloatEntry,
  AnimationIssueEntry,
  AppInitializerInfoEntry,
  TemplateFunctionCallEntry,
  NgForWithoutTrackByEntry,
  SubscriptionLeakEntry,
  DeepNestingEntry,
  PreloadingStrategyInfo,
  DirectDomManipulationEntry,
  ProvidedInAnyEntry,
} from '../../types/app-structure';
import { MAX_SCAN_ELEMENTS } from './constants';
import { getInjectorMap, getInjectorRecords } from './injector';

// ─── Constants ────────────────────────────────────────────────────────────────

/** DOM event names that fire at very high frequency inside Angular zone */
const HIGH_FREQ_EVENTS: readonly string[] = [
  'scroll', 'mousemove', 'pointermove', 'resize',
  'wheel', 'touchmove', 'touchstart', 'mouseover',
];

/** CSS properties that cause browser layout (not compositor-only like transform/opacity) */
const LAYOUT_CSS_PROPS = new Set([
  'width', 'height', 'top', 'left', 'right', 'bottom',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-width', 'min-width', 'max-width', 'min-height', 'max-height',
]);

/** Minimum function body length (chars) to consider a CD-cycle hook "non-trivial" */
const NONTRIVIAL_HOOK_THRESHOLD = 100;

/** Minimum DOM subtree node count to flag as a @defer opportunity */
const DEFER_NODE_THRESHOLD = 150;

/** Minimum list item count to flag for virtual scroll recommendation */
const LARGE_LIST_THRESHOLD = 100;

/** Angular lifecycle hooks that execute on every single CD cycle */
const CD_CYCLE_HOOKS = ['ngDoCheck', 'ngAfterViewChecked', 'ngAfterContentChecked'] as const;

/** Angular lifecycle hooks where calling detectChanges / markForCheck is risky */
const LIFECYCLE_HOOKS_CD_RISK = [
  'ngOnInit', 'ngOnChanges', 'ngAfterViewInit', 'ngAfterContentInit',
  'ngDoCheck', 'ngAfterViewChecked', 'ngAfterContentChecked',
] as const;

/** Patterns that suggest debounce / throttle is in place */
const DEBOUNCE_PATTERNS = ['debounce', 'throttle', 'Subject', 'fromEvent', 'auditTime', 'debounceTime'];

/** Angular-internal service names — excluded from duplicate-service reporting */
const ANGULAR_INTERNAL_SERVICES = new Set([
  'NgZone', 'ApplicationRef', 'Compiler', 'PlatformRef', 'ErrorHandler',
  'TestabilityRegistry', 'Testability', 'IterableDiffers', 'KeyValueDiffers',
  'Sanitizer', 'ChangeDetectionScheduler', 'InternalErrorHandler',
  'DomRendererFactory2', 'EventManager', 'AnimationDriver',
]);

// ─── Constants for new detections ────────────────────────────────────────────

/** Minimum ancestor Angular-context element count to flag as deeply nested */
const DEEP_NESTING_THRESHOLD = 15;

/** Angular lifecycle / utility methods to ignore when detecting template function calls */
const TEMPLATE_METHOD_EXCLUSIONS = new Set([
  '$any', '$implicit', 'ngOnInit', 'ngOnChanges', 'ngOnDestroy',
  'ngAfterViewInit', 'ngAfterViewChecked', 'ngAfterContentInit',
  'ngAfterContentChecked', 'ngDoCheck', 'writeValue', 'registerOnChange',
  'registerOnTouched', 'setDisabledState', 'validate', 'transform', 'trackBy',
]);

/** Lifecycle hooks where subscribe() without cleanup indicates a leak */
const INIT_HOOKS = [
  'constructor', 'ngOnInit', 'ngOnChanges', 'ngAfterViewInit',
  'ngAfterContentInit', 'ngDoCheck',
] as const;

/** Patterns that indicate cleanup / lifecycle management is already handled */
const SUBSCRIPTION_CLEANUP_PATTERNS = [
  'takeUntil', 'takeUntilDestroyed', 'unsubscribe',
  'Subscription', 'destroy$', 'sub$', 'subscription',
  'DestroyRef', 'destroyRef',
];

/** Lifecycle hooks where direct DOM access via ElementRef is problematic */
const DOM_MANIPULATION_HOOKS = [
  'ngOnInit', 'ngAfterViewInit', 'ngAfterViewChecked', 'ngDoCheck',
  'ngOnChanges', 'ngAfterContentInit', 'ngAfterContentChecked',
] as const;

/** DOM access patterns to detect in lifecycle hook source */
const DOM_MANIPULATION_PATTERNS: readonly [pattern: string, label: string][] = [
  ['nativeElement.style', 'nativeElement.style'],
  ['nativeElement.className', 'nativeElement.className'],
  ['nativeElement.querySelector', 'nativeElement.querySelector'],
  ['nativeElement.querySelectorAll', 'nativeElement.querySelectorAll'],
  ['nativeElement.innerHTML', 'nativeElement.innerHTML'],
  ['nativeElement.textContent', 'nativeElement.textContent'],
  ['nativeElement.setAttribute', 'nativeElement.setAttribute'],
  ['nativeElement.appendChild', 'nativeElement.appendChild'],
  ['nativeElement.removeChild', 'nativeElement.removeChild'],
  ['document.querySelector', 'document.querySelector'],
  ['document.getElementById', 'document.getElementById'],
  ['document.createElement', 'document.createElement'],
];

// ─── Module-level ExpressionChanged interception state ───────────────────────
const exprChangedState: {
  count: number;
  components: string[];
  hooked: boolean;
} = { count: 0, components: [], hooked: false };

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Runs all performance detections (original #1–#18 plus new N1–N22) and returns
 * the results as a single `PerformanceDetections` object suitable for inclusion
 * in `AppStructureData`.
 *
 * Safe to call repeatedly — all detectors are side-effect-free except for
 * the one-time `console.error` hook for ExpressionChanged errors (#12).
 */
export function collectPerformanceDetections(
  ng: any,
  components: ComponentRegistryEntry[],
  directives: DirectiveRegistryEntry[],
  pipes: PipeRegistryEntry[],
  services: ServiceRegistryEntry[],
  injector: any,
  routes: RouteRegistryEntry[],
  signalStateMap: Map<string, SignalStateEntry>,
): PerformanceDetections {
  // One-time ExpressionChanged interceptor (idempotent, #12)
  initExpressionChangedInterceptor();

  // Build a className → constructor map via a single bounded DOM walk
  const ctorMap = buildConstructorMap(ng);

  return {
    impurePipes:              detectImpurePipes(pipes),                                        // #1
    hostListenerIssues:       detectHostListenerIssues(components, directives, ctorMap),       // #2+#15
    largeListDetections:      detectLargeListsWithoutVirtualScroll(ng, components),            // #3
    heavyLifecycleHooks:      detectHeavyLifecycleHooks(components, ctorMap),                  // #4
    duplicateServices:        detectDuplicateServices(injector),                               // #5
    eagerLoadedRoutes:        detectEagerLoadedRoutes(routes),                                 // #6
    cdRefAbuse:               detectCdRefAbuse(components, ctorMap),                           // #7
    cdStrategyMismatches:     detectCdStrategyMismatches(ng, components),                      // #8
    onPushInputMutationRisks: detectOnPushInputMutationRisks(components),                      // #9
    deferOpportunities:       detectDeferOpportunities(ng, components),                        // #10
    zonelessReadiness:        computeZonelessReadiness(injector, components, signalStateMap),  // #11
    expressionChangedErrors:  readExpressionChangedState(),                                    // #12
    formsMixing:              detectFormsMixing(components, ctorMap),                          // #13
    queryListOveruse:         detectQueryListOveruse(ng, components),                          // #14
    importBloat:              detectImportBloat(components, ctorMap),                          // #16
    animationIssues:          detectAnimationIssues(components, ctorMap),                      // #17
    appInitializerInfo:       collectAppInitializerInfo(injector),                             // #18
    // ── New detections ──
    templateFunctionCalls:    detectTemplateFunctionCalls(components, ctorMap),                // N1
    ngForWithoutTrackBy:      detectNgForWithoutTrackBy(ng, components, ctorMap),              // N2
    subscriptionLeaks:        detectSubscriptionLeaks(components, ctorMap),                    // N5
    deepNesting:              detectDeepNesting(ng, components),                               // N8
    preloadingStrategy:       detectPreloadingStrategy(injector, routes),                      // N11
    directDomManipulation:    detectDirectDomManipulation(components, ctorMap),                // N14
    providedInAny:            detectProvidedInAny(services, ctorMap),                          // N22
  };
}

// ─── Constructor map builder ──────────────────────────────────────────────────

/**
 * Builds a Map<className, constructor> by walking up to MAX_SCAN_ELEMENTS DOM
 * nodes and extracting Angular component and directive constructors via dev-mode
 * APIs and the __ngContext__ LView fallback.
 */
function buildConstructorMap(ng: any): Map<string, Function> {
  const ctorMap = new Map<string, Function>();
  if (!ng) return ctorMap;
  try {
    const els = document.querySelectorAll('*');
    const limit = Math.min(els.length, MAX_SCAN_ELEMENTS);
    for (let i = 0; i < limit; i++) {
      const el = els[i];
      try {
        if (ng.getComponent) {
          const inst = ng.getComponent(el);
          if (inst?.constructor?.name) ctorMap.set(inst.constructor.name, inst.constructor);
        }
        if (ng.getDirectives) {
          const dirs: any[] = ng.getDirectives(el) ?? [];
          for (const d of dirs) {
            if (d?.constructor?.name) ctorMap.set(d.constructor.name, d.constructor);
          }
        }
        // LView fallback (works without dev mode)
        const ctx = (el as any).__ngContext__;
        if (Array.isArray(ctx)) {
          const tType = ctx[1]?.type;
          if (typeof tType === 'function' && tType.name) ctorMap.set(tType.name, tType);
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return ctorMap;
}

// ─── #1: Impure Pipes ─────────────────────────────────────────────────────────

function detectImpurePipes(pipes: PipeRegistryEntry[]): ImpurePipeEntry[] {
  return pipes
    .filter(p => !p.pure && !p.filePath?.includes('node_modules'))
    .map(p => ({ name: p.name, className: p.className, filePath: p.filePath }));
}

// ─── #2 + #15: @HostListener / host binding on high-frequency events ──────────

function detectHostListenerIssues(
  components: ComponentRegistryEntry[],
  directives: DirectiveRegistryEntry[],
  ctorMap: Map<string, Function>,
): HostListenerIssue[] {
  const issues: HostListenerIssue[] = [];

  function check(className: string, filePath: string | null, entityType: 'component' | 'directive'): void {
    if (filePath?.includes('node_modules')) return;
    const ctor = ctorMap.get(className);
    if (!ctor) return;
    const def = (ctor as any).ɵcmp ?? (ctor as any).ɵdir;
    if (!def?.hostBindings) return;

    // The compiled hostBindings function source contains ɵɵlistener("eventName", …)
    const src: string = def.hostBindings.toString();
    const detectedEvents: string[] = [];
    for (const evt of HIGH_FREQ_EVENTS) {
      if (
        src.includes(`"${evt}"`) || src.includes(`'${evt}'`) ||
        src.includes(`"window:${evt}"`) || src.includes(`'window:${evt}'`) ||
        src.includes(`"document:${evt}"`) || src.includes(`'document:${evt}'`)
      ) {
        detectedEvents.push(evt);
      }
    }
    if (detectedEvents.length === 0) return;

    // Heuristic: does any prototype method mention debounce / throttle?
    let hasDebounce = false;
    try {
      const proto = (ctor as any).prototype;
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key === 'constructor') continue;
        const fnSrc: string = proto[key]?.toString() ?? '';
        if (DEBOUNCE_PATTERNS.some(p => fnSrc.includes(p))) { hasDebounce = true; break; }
      }
    } catch { /* ignore */ }

    issues.push({ className, filePath, entityType, events: detectedEvents, hasDebounce });
  }

  for (const c of components) check(c.className, c.filePath, 'component');
  for (const d of directives) check(d.className, d.filePath, 'directive');
  return issues;
}

// ─── #3: Large *ngFor / @for without virtual scroll ──────────────────────────

function detectLargeListsWithoutVirtualScroll(
  ng: any,
  components: ComponentRegistryEntry[],
): LargeListDetection[] {
  const results: LargeListDetection[] = [];
  if (!ng?.getDirectives && !ng?.getComponent) return results;

  const hasVirtualScrollGlobal = !!document.querySelector('cdk-virtual-scroll-viewport');
  const seenKeys = new Set<string>();
  const userComponentNames = new Set(
    components.filter(c => !c.filePath?.includes('node_modules')).map(c => c.className),
  );

  try {
    const els = document.querySelectorAll('*');
    const limit = Math.min(els.length, MAX_SCAN_ELEMENTS);
    for (let i = 0; i < limit; i++) {
      const el = els[i];
      try {
        // ── *ngFor (Angular 14-16): NgForOf directive instance ────────────────
        if (ng.getDirectives) {
          const dirs: any[] = ng.getDirectives(el) ?? [];
          for (const d of dirs) {
            const dName: string = d?.constructor?.name ?? '';
            if (dName !== 'NgForOf' && dName !== 'NgFor') continue;

            const collection: any = d._ngForOf ?? d.ngForOf ?? null;
            const count = Array.isArray(collection) ? collection.length
              : (collection instanceof Set || collection instanceof Map) ? collection.size
              : 0;
            if (count < LARGE_LIST_THRESHOLD) continue;

            const owning = ng.getOwningComponent ? ng.getOwningComponent(el) : null;
            const componentName: string = owning?.constructor?.name ?? 'Unknown';
            const selector: string = owning?.constructor?.ɵcmp?.selectors?.[0]?.[0] ?? '';
            const key = `ngFor:${componentName}:${selector}`;
            if (seenKeys.has(key) || !userComponentNames.has(componentName)) continue;
            seenKeys.add(key);
            results.push({ componentName, selector, estimatedItemCount: count, hasVirtualScroll: hasVirtualScrollGlobal });
          }
        }

        // ── @for (Angular 17+): heuristic — many Angular-context siblings ─────
        if (ng.getComponent) {
          const inst = ng.getComponent(el);
          if (!inst) continue;
          const componentName: string = inst.constructor?.name ?? '';
          if (!userComponentNames.has(componentName)) continue;

          const key = `atFor:${componentName}`;
          if (seenKeys.has(key)) continue;

          // Count how many direct children share the same __ngContext__ TView type
          const parent = el.parentElement;
          if (!parent) continue;
          let sameTypeCount = 0;
          const refType = Array.isArray((el as any).__ngContext__)
            ? (el as any).__ngContext__?.[1]?.type
            : null;
          if (!refType) continue;
          for (const sibling of parent.children) {
            const sibCtx = (sibling as any).__ngContext__;
            if (Array.isArray(sibCtx) && sibCtx[1]?.type === refType) sameTypeCount++;
          }
          if (sameTypeCount < LARGE_LIST_THRESHOLD) continue;

          seenKeys.add(key);
          const selector: string = inst.constructor?.ɵcmp?.selectors?.[0]?.[0] ?? '';
          results.push({ componentName, selector, estimatedItemCount: sameTypeCount, hasVirtualScroll: hasVirtualScrollGlobal });
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return results;
}

// ─── #4: Heavy lifecycle hooks that run on every CD cycle ────────────────────

function detectHeavyLifecycleHooks(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): HeavyLifecycleHookEntry[] {
  const results: HeavyLifecycleHookEntry[] = [];
  for (const comp of components) {
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const proto = (ctor as any)?.prototype;
    if (!proto) continue;

    const hooks: Array<{ name: string; bodyLength: number }> = [];
    for (const hook of CD_CYCLE_HOOKS) {
      try {
        const fn = proto[hook];
        if (typeof fn !== 'function') continue;
        const bodyLength = fn.toString().length;
        if (bodyLength > NONTRIVIAL_HOOK_THRESHOLD) hooks.push({ name: hook, bodyLength });
      } catch { /* ignore */ }
    }
    if (hooks.length > 0) results.push({ className: comp.className, filePath: comp.filePath, hooks });
  }
  return results;
}

// ─── #5: Duplicate service instances across injector levels ──────────────────

function detectDuplicateServices(injector: any): DuplicateServiceEntry[] {
  if (!injector) return [];
  const nameCount = new Map<string, number>();
  const seenAtLevel = new Set<string>();
  let current: any = injector;
  let depth = 0;

  while (current && depth < 12) {
    depth++;
    const records =
      getInjectorMap(current) ??
      getInjectorMap(current.injector) ??
      getInjectorMap(current._injector);

    if (records) {
      for (const [token] of records) {
        const name: string = token?.name ?? '';
        if (!name || name.length < 2) continue;
        if (name.startsWith('ɵ') || name.startsWith('Ɵ') || name.startsWith('__')) continue;
        const levelKey = `${depth}:${name}`;
        if (seenAtLevel.has(levelKey)) continue;
        seenAtLevel.add(levelKey);
        nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
      }
    }
    current = current._parent ?? current.parent ??
              current._injector?._parent ?? current.injector?._parent ?? null;
  }

  return Array.from(nameCount.entries())
    .filter(([name, count]) => count > 1 && !ANGULAR_INTERNAL_SERVICES.has(name))
    .map(([name, count]) => ({ className: name, injectorLevels: count, filePath: null }))
    .slice(0, 20);
}

// ─── #6: Eagerly loaded routes that could be lazy-loaded ─────────────────────

function detectEagerLoadedRoutes(routes: RouteRegistryEntry[]): EagerLoadedRouteEntry[] {
  const results: EagerLoadedRouteEntry[] = [];

  function walk(list: RouteRegistryEntry[]): void {
    for (const route of list) {
      if (
        route.component &&
        !route.isLazy &&
        route.component !== '(lazy component)' &&
        route.component !== '(lazy module)' &&
        route.path !== '**' &&
        route.path !== '' &&
        !route.redirectTo
      ) {
        const childCount = flatCount(route.children);
        if (childCount >= 3) {
          results.push({
            path: route.path,
            absolutePath: route.absolutePath,
            component: route.component,
            childRouteCount: childCount,
          });
        }
      }
      walk(route.children);
    }
  }

  walk(routes);
  return results;
}

function flatCount(routes: RouteRegistryEntry[]): number {
  return routes.reduce((s, r) => s + 1 + flatCount(r.children), 0);
}

// ─── #7: ChangeDetectorRef.detectChanges() / markForCheck() abuse ─────────────

function detectCdRefAbuse(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): CdRefAbuseEntry[] {
  const results: CdRefAbuseEntry[] = [];
  for (const comp of components) {
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const proto = (ctor as any)?.prototype;
    if (!proto) continue;

    const dcHooks: string[] = [];
    const mfcHooks: string[] = [];
    for (const hook of LIFECYCLE_HOOKS_CD_RISK) {
      try {
        const fn = proto[hook];
        if (typeof fn !== 'function') continue;
        const src = fn.toString();
        if (src.includes('detectChanges')) dcHooks.push(hook);
        if (src.includes('markForCheck')) mfcHooks.push(hook);
      } catch { /* ignore */ }
    }
    if (dcHooks.length > 0) {
      results.push({ className: comp.className, filePath: comp.filePath, method: 'detectChanges', inHooks: dcHooks });
    }
    if (mfcHooks.length > 0) {
      results.push({ className: comp.className, filePath: comp.filePath, method: 'markForCheck', inHooks: mfcHooks });
    }
  }
  return results;
}

// ─── #8: CD strategy mismatch — OnPush child under Default parent ─────────────

function detectCdStrategyMismatches(
  ng: any,
  components: ComponentRegistryEntry[],
): CdStrategyMismatchEntry[] {
  if (!ng?.getComponent || !ng?.getOwningComponent) return [];
  const results: CdStrategyMismatchEntry[] = [];
  const seenPairs = new Set<string>();
  const userCompNames = new Set(
    components.filter(c => !c.filePath?.includes('node_modules')).map(c => c.className),
  );

  try {
    const els = document.querySelectorAll('*');
    const limit = Math.min(els.length, MAX_SCAN_ELEMENTS);
    for (let i = 0; i < limit; i++) {
      const el = els[i];
      try {
        const child = ng.getComponent(el);
        if (!child) continue;
        const childName: string = child.constructor?.name ?? '';
        if (!userCompNames.has(childName)) continue;

        const childCmp = child.constructor?.ɵcmp;
        const childIsOnPush = childCmp?.onPush === true || childCmp?.changeDetection === 1;
        if (!childIsOnPush) continue;

        const parent = ng.getOwningComponent(el);
        if (!parent) continue;
        const parentName: string = parent.constructor?.name ?? '';
        if (!userCompNames.has(parentName)) continue;
        if (parentName === childName) continue;

        const parentCmp = parent.constructor?.ɵcmp;
        const parentIsDefault = !parentCmp?.onPush && parentCmp?.changeDetection !== 1;
        if (!parentIsDefault) continue;

        const pairKey = `${childName}→${parentName}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        results.push({
          childClassName: childName,
          childSelector: childCmp?.selectors?.[0]?.[0] ?? '',
          parentClassName: parentName,
          parentSelector: parentCmp?.selectors?.[0]?.[0] ?? '',
        });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return results;
}

// ─── #9: OnPush components with object-typed inputs (mutation risk) ───────────

function detectOnPushInputMutationRisks(
  components: ComponentRegistryEntry[],
): OnPushInputMutationRisk[] {
  const OBJECT_HINTS = [
    'data', 'config', 'options', 'settings', 'items', 'list', 'model',
    'form', 'params', 'filters', 'columns', 'rows', 'values', 'meta',
    'info', 'payload', 'state', 'props', 'schema', 'record', 'entry',
  ];
  const results: OnPushInputMutationRisk[] = [];
  for (const comp of components) {
    if (comp.changeDetection !== 'OnPush') continue;
    if (comp.filePath?.includes('node_modules')) continue;
    if (comp.inputs.length === 0) continue;

    // Exclude signal inputs — they are always safe
    const signalSet = new Set(comp.signalInputs);
    const regularInputs = comp.inputs.filter(i => !signalSet.has(i));
    if (regularInputs.length === 0) continue;

    const objectInputs = regularInputs.filter(name =>
      OBJECT_HINTS.some(hint => name.toLowerCase().includes(hint)),
    );
    if (objectInputs.length > 0) {
      results.push({ className: comp.className, filePath: comp.filePath, selector: comp.selector, objectInputs });
    }
  }
  return results;
}

// ─── #10: @defer opportunities — large subtrees not yet deferred ──────────────

function detectDeferOpportunities(
  ng: any,
  components: ComponentRegistryEntry[],
): DeferOpportunityEntry[] {
  if (!ng?.getComponent) return [];
  const results: DeferOpportunityEntry[] = [];
  const seenNames = new Set<string>();
  const appHasDefer = checkAppUsesDefer();
  const userCompNames = new Set(
    components.filter(c => !c.filePath?.includes('node_modules')).map(c => c.className),
  );

  try {
    const els = document.querySelectorAll('*');
    const limit = Math.min(els.length, MAX_SCAN_ELEMENTS);
    for (let i = 0; i < limit; i++) {
      const el = els[i];
      try {
        const inst = ng.getComponent(el);
        if (!inst) continue;
        const name: string = inst.constructor?.name ?? '';
        if (!name || seenNames.has(name) || !userCompNames.has(name)) continue;

        const nodeCount = el.querySelectorAll('*').length;
        if (nodeCount < DEFER_NODE_THRESHOLD) continue;
        seenNames.add(name);

        const entry = components.find(c => c.className === name);
        const selector: string = inst.constructor?.ɵcmp?.selectors?.[0]?.[0] ?? '';
        const reason = appHasDefer
          ? `Large subtree (${nodeCount} nodes) — consider wrapping in @defer`
          : `Large subtree (${nodeCount} nodes) — @defer (Angular 17+) not yet used in this app`;

        results.push({ className: name, selector, filePath: entry?.filePath ?? null, subtreeNodeCount: nodeCount, reason });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return results;
}

function checkAppUsesDefer(): boolean {
  try {
    // Angular @defer produces DOM comment nodes whose text contains "Defer block"
    // or has data-attributes / component markers. Simple comment scan is reliable.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    let node = walker.nextNode();
    while (node) {
      const txt = node.textContent ?? '';
      if (txt.toLowerCase().includes('defer')) return true;
      node = walker.nextNode();
    }
  } catch { /* ignore */ }
  return false;
}

// ─── #11: Zoneless migration readiness ───────────────────────────────────────

function computeZonelessReadiness(
  _injector: any,
  components: ComponentRegistryEntry[],
  signalStateMap: Map<string, SignalStateEntry>,
): ZonelessReadinessEntry {
  const isZoneless = typeof (globalThis as any).Zone === 'undefined';

  const userComponents = components.filter(c => !c.filePath?.includes('node_modules'));
  const totalComponents = userComponents.length;
  const signalComponents = userComponents.filter(c =>
    c.signalInputs.length > 0 || signalStateMap.has(c.className),
  ).length;

  const signalCoverage = totalComponents > 0
    ? Math.round((signalComponents / totalComponents) * 100)
    : 0;

  let migrationReadiness: ZonelessReadinessEntry['migrationReadiness'];
  if (isZoneless) {
    migrationReadiness = 'ready';
  } else if (signalCoverage >= 50) {
    migrationReadiness = 'partial';
  } else {
    migrationReadiness = 'not-ready';
  }

  return { isZoneless, signalCoverage, totalComponents, signalComponents, migrationReadiness };
}

// ─── #12: ExpressionChangedAfterItHasBeenCheckedError ────────────────────────

function initExpressionChangedInterceptor(): void {
  if (exprChangedState.hooked) return;
  exprChangedState.hooked = true;
  try {
    const orig = console.error;
    console.error = function (...args: any[]) {
      try {
        const msg: string =
          typeof args[0] === 'string' ? args[0]
          : args[0] instanceof Error ? args[0].message
          : '';
        if (msg.includes('ExpressionChangedAfterItHasBeenChecked')) {
          exprChangedState.count++;
          // Angular error message contains "in Component: MyComp" or similar
          const m = msg.match(/[Cc]omponent[:\s]+([A-Za-z0-9_$]+)/);
          if (m?.[1] && !exprChangedState.components.includes(m[1])) {
            exprChangedState.components.push(m[1]);
          }
        }
      } catch { /* ignore */ }
      return orig.apply(console, args);
    };

    // Also catch thrown Error objects via the global error event
    window.addEventListener('error', (ev: ErrorEvent) => {
      const msg = ev.message ?? '';
      if (msg.includes('ExpressionChangedAfterItHasBeenChecked')) exprChangedState.count++;
    }, { capture: true, passive: true });
  } catch { /* ignore */ }
}

function readExpressionChangedState(): ExpressionChangedErrorEntry {
  return {
    count: exprChangedState.count,
    components: [...exprChangedState.components],
    intercepting: exprChangedState.hooked,
  };
}

// ─── #13: Reactive + template-driven forms mixed in one component ─────────────

function detectFormsMixing(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): FormsMixingEntry[] {
  const results: FormsMixingEntry[] = [];
  for (const comp of components) {
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const cmp = (ctor as any)?.ɵcmp;
    if (!cmp) continue;

    const imports = resolveImportsFromDef(cmp);
    const importNames = imports.map((i: any) => typeof i === 'function' ? (i.name ?? '') : '');

    const usesReactiveForms = importNames.some(n =>
      n === 'ReactiveFormsModule' || n === 'FormGroup' || n === 'FormControl' ||
      n === 'FormBuilder' || n === 'ReactiveFormBuilder',
    );
    const usesTemplateForms = importNames.some(n =>
      n === 'FormsModule' || n === 'NgModel' || n === 'NgForm' || n === 'NgModelGroup',
    );

    if (usesReactiveForms && usesTemplateForms) {
      results.push({
        className: comp.className,
        filePath: comp.filePath,
        selector: comp.selector,
        usesReactiveForms,
        usesTemplateForms,
      });
    }
  }
  return results;
}

// ─── #14: QueryList properties (@ViewChildren / @ContentChildren) ─────────────

function detectQueryListOveruse(
  ng: any,
  components: ComponentRegistryEntry[],
): QueryListOveruseEntry[] {
  if (!ng?.getComponent) return [];
  const results: QueryListOveruseEntry[] = [];
  const seenNames = new Set<string>();
  const userCompNames = new Set(
    components.filter(c => !c.filePath?.includes('node_modules')).map(c => c.className),
  );

  try {
    const els = document.querySelectorAll('*');
    const limit = Math.min(els.length, MAX_SCAN_ELEMENTS);
    for (let i = 0; i < limit; i++) {
      const el = els[i];
      try {
        const inst = ng.getComponent(el);
        if (!inst) continue;
        const name: string = inst.constructor?.name ?? '';
        if (!name || seenNames.has(name) || !userCompNames.has(name)) continue;

        const queryListProps: string[] = [];
        const ownKeys = Object.getOwnPropertyNames(inst).slice(0, 200);
        for (const key of ownKeys) {
          try {
            const val = inst[key];
            // QueryList duck-type: has .forEach(), .toArray(), and .changes observable
            if (
              val != null &&
              typeof val === 'object' &&
              typeof val.forEach === 'function' &&
              typeof val.toArray === 'function' &&
              val.changes != null &&
              typeof val.changes.subscribe === 'function'
            ) {
              queryListProps.push(key);
            }
          } catch { /* ignore */ }
        }

        if (queryListProps.length > 0) {
          seenNames.add(name);
          const entry = components.find(c => c.className === name);
          results.push({ className: name, filePath: entry?.filePath ?? null, queryListProperties: queryListProps });
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return results;
}

// ─── #16: Standalone component importing full NgModules (import bloat) ────────

function detectImportBloat(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): ImportBloatEntry[] {
  const results: ImportBloatEntry[] = [];
  for (const comp of components) {
    if (!comp.standalone) continue;
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const cmp = (ctor as any)?.ɵcmp;
    if (!cmp) continue;

    const imports = resolveImportsFromDef(cmp);
    const moduleImports: string[] = [];
    for (const imp of imports) {
      if (!imp || typeof imp !== 'function') continue;
      const impName: string = (imp as any).name ?? '';
      // ɵmod present → it's an NgModule, not a standalone component
      if ((imp as any).ɵmod && /Module$/.test(impName)) {
        // A few modules are intentionally imported at the app level — skip them
        if (impName === 'BrowserModule' || impName === 'BrowserAnimationsModule' ||
            impName === 'NoopAnimationsModule' || impName === 'RouterModule') continue;
        moduleImports.push(impName);
      }
    }
    if (moduleImports.length > 0) {
      results.push({ className: comp.className, filePath: comp.filePath, selector: comp.selector, moduleImports });
    }
  }
  return results;
}

// ─── #17: Animations animating layout-triggering CSS properties ───────────────

function detectAnimationIssues(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): AnimationIssueEntry[] {
  const results: AnimationIssueEntry[] = [];
  for (const comp of components) {
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const cmp = (ctor as any)?.ɵcmp;
    if (!cmp) continue;

    const foundProps = new Set<string>();
    const triggerNames: string[] = [];

    try {
      // Angular Ivy stores animation triggers in ɵcmp.data (TConstants array)
      // as AnimationTriggerMetadata objects with type === AnimationMetadataType.Trigger (12)
      const data: any[] = Array.isArray(cmp.data) ? cmp.data : [];
      for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        // Trigger: has a string name + definitions array
        if (typeof item.name === 'string' && Array.isArray(item.definitions)) {
          triggerNames.push(item.name);
          walkAnimationDefs(item.definitions, foundProps);
        }
      }

      // Also check ɵcmp.animations or ɵcmp.animationTriggers (some versions)
      const extra = cmp.animations ?? cmp.animationTriggers;
      if (Array.isArray(extra)) {
        for (const trigger of extra) {
          if (!trigger || typeof trigger !== 'object') continue;
          if (typeof trigger.name === 'string') triggerNames.push(trigger.name);
          if (Array.isArray(trigger.definitions)) walkAnimationDefs(trigger.definitions, foundProps);
        }
      }
    } catch { /* ignore */ }

    if (foundProps.size > 0) {
      results.push({
        className: comp.className,
        filePath: comp.filePath,
        selector: comp.selector,
        layoutTriggeringProps: Array.from(foundProps),
        triggerNames: [...new Set(triggerNames)],
      });
    }
  }
  return results;
}

function walkAnimationDefs(defs: any[], found: Set<string>): void {
  if (!Array.isArray(defs)) return;
  for (const def of defs) {
    if (!def || typeof def !== 'object') continue;
    if (def.styles) scanStyles(def.styles, found);
    if (Array.isArray(def.animation)) {
      for (const step of def.animation) {
        if (!step) continue;
        if (step.styles) scanStyles(step.styles, found);
        if (Array.isArray(step.steps)) walkAnimationDefs(step.steps, found);
        if (Array.isArray(step.animation)) walkAnimationDefs(step.animation, found);
      }
    }
    if (Array.isArray(def.steps)) walkAnimationDefs(def.steps, found);
    if (def.definitions) walkAnimationDefs(def.definitions, found);
  }
}

function scanStyles(styles: any, found: Set<string>): void {
  if (!styles) return;
  const obj = Array.isArray(styles) ? styles[0] : styles;
  if (!obj || typeof obj !== 'object') return;
  for (const prop of Object.keys(obj)) {
    // Normalize camelCase to kebab-case for comparison
    const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (LAYOUT_CSS_PROPS.has(kebab) || LAYOUT_CSS_PROPS.has(prop)) found.add(kebab);
  }
}

// ─── #18: APP_INITIALIZER info ────────────────────────────────────────────────

function collectAppInitializerInfo(injector: any): AppInitializerInfoEntry {
  const empty: AppInitializerInfoEntry = { count: 0, names: [], hasAsyncInitializers: false };
  if (!injector) return empty;
  try {
    const records = getInjectorRecords(injector);
    if (!records) return empty;
    for (const [token] of records) {
      const desc: string = token?._desc ?? token?.description ?? '';
      if (desc !== 'Application Initializer' && desc !== 'APP_INITIALIZER') continue;

      const arr: any[] = injector.get(token, [], { optional: true } as any);
      if (!Array.isArray(arr) || arr.length === 0) return empty;

      const names = arr.map((fn: any) =>
        typeof fn === 'function' ? (fn.name || 'anonymous') : 'anonymous',
      );
      const hasAsync = arr.some((fn: any) => {
        if (typeof fn !== 'function') return false;
        const src = fn.toString();
        return src.includes('Promise') || src.includes('Observable') ||
               /^async\s/.test(src) || src.includes('async function');
      });
      return { count: arr.length, names, hasAsyncInitializers: hasAsync };
    }
  } catch { /* ignore */ }
  return empty;
}

// ─── Shared helper ────────────────────────────────────────────────────────────

/**
 * Resolves a component's import / dependency list from ɵcmp metadata.
 * Handles both function-form (Angular 17+ lazy) and array-form.
 */
function resolveImportsFromDef(cmp: any): any[] {
  let result: any[] = [];
  try {
    const add = (src: any) => {
      if (typeof src === 'function') {
        const resolved = src();
        if (Array.isArray(resolved)) result = result.concat(resolved);
      } else if (Array.isArray(src)) {
        result = result.concat(src);
      }
    };
    add(cmp.imports);
    add(cmp.dependencies);
  } catch { /* ignore */ }
  return result;
}

// ─── N1: Template method calls re-executing on every CD cycle ────────────────

/**
 * Scans the compiled template function source for `ctx.method(` patterns.
 * Angular compiles templates to functions where `ctx` is the component instance.
 * Any method called in a binding expression re-executes on every CD cycle.
 *
 * Excludes: Angular lifecycle hooks, known Angular API methods, and event
 * handler calls detected inside ɵɵlistener callback bodies.
 */
function detectTemplateFunctionCalls(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): TemplateFunctionCallEntry[] {
  const results: TemplateFunctionCallEntry[] = [];
  for (const comp of components) {
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    if (!ctor) continue;
    const def = (ctor as any).ɵcmp;
    if (!def?.template) continue;

    let templateSrc: string;
    try { templateSrc = def.template.toString(); } catch { continue; }

    // Build a set of method names that appear exclusively in ɵɵlistener callbacks
    // (event handlers) — these are fine because they only run on events, not on CD.
    const listenerOnlyMethods = new Set<string>();
    const listenerRegex = /ɵɵlistener\([^,]+,\s*function[^{]*\{[^}]*ctx\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    let lm: RegExpExecArray | null;
    while ((lm = listenerRegex.exec(templateSrc)) !== null) listenerOnlyMethods.add(lm[1]);

    const proto = (ctor as any).prototype;
    const calledMethods: string[] = [];
    const seen = new Set<string>();

    const callRegex = /\bctx\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = callRegex.exec(templateSrc)) !== null) {
      const name = match[1];
      if (seen.has(name) || TEMPLATE_METHOD_EXCLUSIONS.has(name)) continue;
      if (listenerOnlyMethods.has(name)) continue; // event handler — skip
      seen.add(name);
      try {
        if (proto && typeof proto[name] === 'function') calledMethods.push(name);
      } catch { /* ignore */ }
    }

    if (calledMethods.length > 0) {
      results.push({
        className: comp.className,
        selector: comp.selector,
        filePath: comp.filePath,
        calledMethods,
      });
    }
  }
  return results;
}

// ─── N2: *ngFor / @for without trackBy ───────────────────────────────────────

/**
 * Detects *ngFor usages that lack a custom trackBy function.
 * Strategy:
 *  1. Inspect live NgForOf directive instances for the default identity trackBy.
 *  2. Fall back to template source scan: `ngForOf` binding present but no
 *     `ngForTrackBy` in the same template function.
 */
function detectNgForWithoutTrackBy(
  ng: any,
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): NgForWithoutTrackByEntry[] {
  const results: NgForWithoutTrackByEntry[] = [];
  const seen = new Set<string>();

  // Pass 1 — live NgForOf instances (Angular 14–16 *ngFor)
  if (ng?.getDirectives) {
    const userCompNames = new Set(
      components.filter(c => !c.filePath?.includes('node_modules')).map(c => c.className),
    );
    try {
      const els = document.querySelectorAll('*');
      const limit = Math.min(els.length, MAX_SCAN_ELEMENTS);
      for (let i = 0; i < limit; i++) {
        const el = els[i];
        try {
          const dirs: any[] = ng.getDirectives(el) ?? [];
          for (const d of dirs) {
            const dName: string = d?.constructor?.name ?? '';
            if (dName !== 'NgForOf' && dName !== 'NgFor') continue;

            // Check if user set a real trackBy (non-trivial function)
            const trackBy = d.ngForTrackBy ?? d._trackByFn ?? null;
            if (trackBy) {
              const src = trackBy.toString().replace(/\s+/g, '');
              // Default identity: very short, returns item only
              const isDefaultIdentity = src.length < 60 ||
                src.includes('returnitem') || src.includes('return i') ||
                /\(i,a\)=>a/.test(src) || /\(index,item\)=>item/.test(src);
              if (!isDefaultIdentity) continue; // real custom trackBy — skip
            }

            const owning = ng.getOwningComponent ? ng.getOwningComponent(el) : null;
            const componentName: string = owning?.constructor?.name ?? 'Unknown';
            if (!userCompNames.has(componentName) || seen.has(componentName)) continue;
            seen.add(componentName);
            const selector: string = owning?.constructor?.ɵcmp?.selectors?.[0]?.[0] ?? '';
            const filePath: string | null = owning?.constructor?.ɵcmp?.filePath ?? null;
            results.push({ className: componentName, selector, filePath });
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  // Pass 2 — template source scan (covers @for blocks and components not yet in DOM)
  for (const comp of components) {
    if (seen.has(comp.className)) continue;
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const def = (ctor as any)?.ɵcmp;
    if (!def?.template) continue;
    try {
      const src = def.template.toString();
      const hasNgForOf = src.includes('ngForOf') || src.includes('"ngForOf"') || src.includes("'ngForOf'");
      if (hasNgForOf && !src.includes('ngForTrackBy') && !src.includes('trackBy')) {
        seen.add(comp.className);
        results.push({ className: comp.className, selector: comp.selector, filePath: comp.filePath });
      }
    } catch { /* ignore */ }
  }

  return results.slice(0, 30);
}

// ─── N5: Observable subscription leaks ───────────────────────────────────────

/**
 * Scans component prototype lifecycle hooks for `.subscribe(` calls that have
 * no visible cleanup pattern (takeUntil, takeUntilDestroyed, Subscription, …).
 * When a class-wide search also finds no cleanup, the component is flagged.
 */
function detectSubscriptionLeaks(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): SubscriptionLeakEntry[] {
  const results: SubscriptionLeakEntry[] = [];
  for (const comp of components) {
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const proto = (ctor as any)?.prototype;
    if (!proto) continue;

    const leakyHooks: string[] = [];
    for (const hook of INIT_HOOKS) {
      try {
        const fn = proto[hook];
        if (typeof fn !== 'function') continue;
        const src = fn.toString();
        if (!src.includes('.subscribe(')) continue;
        // Does the same method have cleanup?
        const methodHasCleanup = SUBSCRIPTION_CLEANUP_PATTERNS.some(p => src.includes(p));
        if (methodHasCleanup) continue;
        leakyHooks.push(hook);
      } catch { /* ignore */ }
    }

    if (leakyHooks.length === 0) continue;

    // Final check: is there any cleanup pattern anywhere on the class?
    let classHasCleanup = false;
    try {
      for (const key of Object.getOwnPropertyNames(proto)) {
        const ms: string = proto[key]?.toString?.() ?? '';
        if (SUBSCRIPTION_CLEANUP_PATTERNS.some(p => ms.includes(p))) {
          classHasCleanup = true;
          break;
        }
      }
    } catch { /* ignore */ }
    if (classHasCleanup) continue;

    const hasDestroyHook = typeof proto.ngOnDestroy === 'function';
    results.push({ className: comp.className, filePath: comp.filePath, inHooks: leakyHooks, hasDestroyHook });
  }
  return results;
}

// ─── N8: Component tree deep nesting ─────────────────────────────────────────

/**
 * Counts the number of ancestor elements that carry Angular context
 * (`__ngContext__`) for each leaf component element. Flags components
 * whose ancestor Angular-element depth exceeds DEEP_NESTING_THRESHOLD.
 */
function detectDeepNesting(
  ng: any,
  components: ComponentRegistryEntry[],
): DeepNestingEntry[] {
  if (!ng?.getComponent) return [];
  const results: DeepNestingEntry[] = [];
  const seen = new Set<string>();
  const userCompNames = new Set(
    components.filter(c => !c.filePath?.includes('node_modules')).map(c => c.className),
  );

  try {
    const els = document.querySelectorAll('*');
    const limit = Math.min(els.length, MAX_SCAN_ELEMENTS);
    for (let i = 0; i < limit; i++) {
      const el = els[i];
      try {
        const inst = ng.getComponent(el);
        if (!inst) continue;
        const name: string = inst.constructor?.name ?? '';
        if (!name || seen.has(name) || !userCompNames.has(name)) continue;

        // Count ancestor elements that participate in Angular's rendering tree
        let depth = 0;
        let ancestor: Element | null = el.parentElement;
        while (ancestor) {
          try {
            if ((ancestor as any).__ngContext__ != null) depth++;
          } catch { /* ignore */ }
          ancestor = ancestor.parentElement;
        }

        if (depth > DEEP_NESTING_THRESHOLD) {
          seen.add(name);
          const selector: string = inst.constructor?.ɵcmp?.selectors?.[0]?.[0] ?? '';
          results.push({ leafClassName: name, leafSelector: selector, depth });
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return results.sort((a, b) => b.depth - a.depth).slice(0, 10);
}

// ─── N11: Missing router preloading strategy ──────────────────────────────────

/**
 * Checks whether the router has at least one lazy route AND a preloading
 * strategy is configured. Inspects the injector records map and the Router
 * instance for strategy information.
 */
function detectPreloadingStrategy(
  injector: any,
  routes: RouteRegistryEntry[],
): PreloadingStrategyInfo {
  const hasLazy = hasLazyRoutes(routes);
  const empty: PreloadingStrategyInfo = { hasLazyRoutes: hasLazy, hasPreloadingStrategy: false, strategyName: null };
  if (!injector || !hasLazy) return empty;

  try {
    // Scan injector records for any PreloadingStrategy token
    const records = getInjectorRecords(injector);
    if (records) {
      for (const [token] of records) {
        const name: string = token?.name ?? token?.description ?? '';
        if (name.includes('PreloadingStrategy') || name.includes('Preload')) {
          return { hasLazyRoutes: hasLazy, hasPreloadingStrategy: true, strategyName: name };
        }
        // PreloadAllModules / NoPreloading are class names, not descriptions
        if (name === 'PreloadAllModules' || name === 'NoPreloading') {
          return { hasLazyRoutes: hasLazy, hasPreloadingStrategy: true, strategyName: name };
        }
      }
    }

    // Walk up the injector chain
    let cur: any = (injector as any)._parent ?? (injector as any).parent ?? null;
    for (let depth = 0; cur && depth < 5; depth++) {
      const map = getInjectorMap(cur);
      if (map) {
        for (const [k] of map) {
          const n: string = k?.name ?? k?.description ?? '';
          if (n.includes('Preload') || n === 'PreloadAllModules' || n === 'NoPreloading') {
            return { hasLazyRoutes: hasLazy, hasPreloadingStrategy: true, strategyName: n };
          }
        }
      }
      cur = cur._parent ?? cur.parent ?? null;
    }
  } catch { /* ignore */ }

  return empty;
}

function hasLazyRoutes(routes: RouteRegistryEntry[]): boolean {
  for (const r of routes) {
    if (r.isLazy) return true;
    if (hasLazyRoutes(r.children)) return true;
  }
  return false;
}

// ─── N14: Direct DOM manipulation via ElementRef in lifecycle hooks ───────────

/**
 * Scans component prototype lifecycle hooks for direct DOM manipulation via
 * ElementRef.nativeElement or document APIs. Angular's Renderer2 / signals
 * are the recommended alternatives.
 */
function detectDirectDomManipulation(
  components: ComponentRegistryEntry[],
  ctorMap: Map<string, Function>,
): DirectDomManipulationEntry[] {
  const results: DirectDomManipulationEntry[] = [];
  for (const comp of components) {
    if (comp.filePath?.includes('node_modules')) continue;
    const ctor = ctorMap.get(comp.className);
    const proto = (ctor as any)?.prototype;
    if (!proto) continue;

    const foundPatterns = new Set<string>();
    const foundHooks: string[] = [];

    for (const hook of DOM_MANIPULATION_HOOKS) {
      try {
        const fn = proto[hook];
        if (typeof fn !== 'function') continue;
        const src = fn.toString();
        let hookMatches = false;
        for (const [pattern, label] of DOM_MANIPULATION_PATTERNS) {
          if (src.includes(pattern)) {
            foundPatterns.add(label);
            hookMatches = true;
          }
        }
        if (hookMatches) foundHooks.push(hook);
      } catch { /* ignore */ }
    }

    if (foundPatterns.size > 0) {
      results.push({
        className: comp.className,
        filePath: comp.filePath,
        patterns: Array.from(foundPatterns),
        inHooks: foundHooks,
      });
    }
  }
  return results;
}

// ─── N22: Services using providedIn: 'any' ────────────────────────────────────

/**
 * Detects services where `ɵprov.providedIn` is set to the string `'any'`.
 * `providedIn: 'any'` creates a separate instance for every lazy-loaded module
 * that injects the service, which is rarely the intended behavior.
 */
function detectProvidedInAny(
  services: ServiceRegistryEntry[],
  ctorMap: Map<string, Function>,
): ProvidedInAnyEntry[] {
  const results: ProvidedInAnyEntry[] = [];
  for (const svc of services) {
    if (svc.filePath?.includes('node_modules')) continue;
    // Check the live ɵprov metadata first (most accurate)
    const ctor = ctorMap.get(svc.className);
    if (ctor) {
      try {
        const prov = (ctor as any).ɵprov;
        if (prov?.providedIn === 'any') {
          results.push({ className: svc.className, filePath: svc.filePath });
          continue;
        }
      } catch { /* ignore */ }
    }
    // Fallback: use the value already stored in the registry entry
    if (svc.providedIn === 'any') {
      results.push({ className: svc.className, filePath: svc.filePath });
    }
  }
  return results;
}

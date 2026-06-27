/**
 * App Structure Collector — runs in the page's MAIN world.
 *
 * Collects a full registry of Angular app entities by combining:
 *  • Constructor-level Ivy metadata  (ɵcmp, ɵdir, ɵpipe, ɵmod, ɵprov)
 *  • DOM walk via ng.getComponent() (dev) + __ngContext__ LView (all modes)
 *  • Live-instance scanning for Signal state and Observable state
 *  • Injector introspection for NgRx, HTTP interceptors, and InjectionTokens
 *  • Route-config traversal for guards and resolvers
 */

import type {
  ActiveRouteEntry,
  AppStructureData,
  ApplicationInfo,
  AppProviderCategory,
  AppProviderEntry,
  BootstrapConfig,
  BootstrapConfigFeature,
  ConfigFeatureType,
  ComponentRegistryEntry,
  DirectiveRegistryEntry,
  EnvironmentEntry,
  GuardRegistryEntry,
  GuardType,
  InterceptorRegistryEntry,
  LibraryEntry,
  ModuleRegistryEntry,
  NgrxEntry,
  NgrxStoreType,
  ObservableStateEntry,
  PipeRegistryEntry,
  PlainClassEntry,
  ResolverRegistryEntry,
  RouteRegistryEntry,
  RouterInfo,
  RoutingStrategy,
  ServiceRegistryEntry,
  ServiceRole,
  ServiceWorkerInfo,
  SignalStateEntry,
  TokenRegistryEntry,
} from '../types/app-structure';

const MAX_SCAN_ELEMENTS = 3000;
const MAX_INSTANCE_PROPS = 200;
const SKIP_PROP_PREFIXES = ['_', 'ɵ', 'ng', '__'];

// ─── Library source detection ─────────────────────────────────────────────────
// Maps well-known class/module names → their npm package.
// Used as fallback when debugInfo.filePath is unavailable (pre-compiled libraries).
const LIBRARY_NAME_PATTERNS: Array<[RegExp, string]> = [
  // Angular built-ins
  [/^(CommonModule|NgIf|NgFor|NgForOf|NgClass|NgStyle|NgSwitch|NgSwitchCase|NgSwitchDefault|AsyncPipe|DatePipe|JsonPipe|SlicePipe|LowerCasePipe|UpperCasePipe|TitleCasePipe|CurrencyPipe|DecimalPipe|PercentPipe|KeyValuePipe|I18nPluralPipe|I18nSelectPipe)$/, '@angular/common'],
  [/^(BrowserModule|BrowserAnimationsModule|NoopAnimationsModule|BrowserTransferStateModule)$/, '@angular/platform-browser'],
  [/^(RouterModule|RouterLink|RouterOutlet|RouterLinkActive|ActivatedRoute|Router|RouterLinkWithHref)$/, '@angular/router'],
  [/^(HttpClientModule|HttpClient|HttpClientXsrfModule|HttpClientJsonpModule|HTTP_INTERCEPTORS)$/, '@angular/common/http'],
  [/^(FormsModule|ReactiveFormsModule|FormBuilder|FormGroup|FormControl|FormArray|NgModel|NgForm)$/, '@angular/forms'],
  [/^ServiceWorkerModule$/, '@angular/service-worker'],
  // Angular Material / CDK
  [/^Mat[A-Z]|^MatCommonModule$/, '@angular/material'],
  [/^Cdk[A-Z]|^OverlayModule$|^A11yModule$|^ScrollingModule$|^DragDropModule$|^PortalModule$/, '@angular/cdk'],
  // NgRx
  [/^(StoreModule|EffectsModule|StoreDevtools|StoreFeatureModule|ActionReducerMap)/, '@ngrx/store'],
  [/^ComponentStore$/, '@ngrx/component-store'],
  [/^SignalStore$/, '@ngrx/signals'],
  // i18n
  [/^(TranslateModule|TranslatePipe|TranslateDirective|TranslateService)$/, '@ngx-translate/core'],
  // Scrollbar
  [/^NgScrollbar(Module)?$/, 'ngx-scrollbar'],
  // Bootstrap-based
  [/^NgbModule$|^Ngb[A-Z]/, '@ng-bootstrap/ng-bootstrap'],
  // Ionic
  [/^IonicModule$|^Ion[A-Z]/, '@ionic/angular'],
  // NG-ZORRO
  [/^Nz[A-Z]/, 'ng-zorro-antd'],
  // Nebular
  [/^Nb[A-Z]/, '@nebular/theme'],
  // Taiga UI
  [/^Tui[A-Z]/, '@taiga-ui/core'],
  // Clarity
  [/^Clr[A-Z]|^ClarityModule$/, '@clr/angular'],
  // ngneat
  [/^UntilDestroy$|^HotToast|^Dialog[A-Z]/, '@ngneat/until-destroy'],
  // Firebase
  [/^AngularFire|^AngularFirestore|^AngularFireAuth|^AngularFireDatabase/, '@angular/fire'],
  // AG Grid
  [/^AgGridModule$|^AgGridAngular$|^AgGrid[A-Z]/, 'ag-grid-angular'],
  // CoreUI Angular — unique identifiers for this package
  [/^(SidebarToggleDirective|SidebarTogglerDirective|ShadowOnScrollDirective|SidebarBrandComponent|SidebarBrandModule|SidebarModule|SidebarHeaderModule|SidebarFooterModule|SidebarNavModule|HeaderModule|FooterModule|NavbarModule|ContainerComponent|ContainerModule|GridModule|ButtonModule|BadgeModule|CardModule|ModalModule|AlertModule|CollapseModule|DropdownModule|ToastModule|SpinnerModule|ProgressModule|BreadcrumbModule|AvatarModule|NavModule|TabsModule|TooltipModule|PaginationModule|FormModule|CarouselModule|AccordionModule|TableModule|ListGroupModule|ImgModule|PlaceholderModule|PopoverModule|WidgetModule|CalloutModule|CloseButtonModule|ButtonGroupModule)$/, '@coreui/angular'],
  // CoreUI Icons
  [/^(IconModule|IconDirective|IconSetService|IconComponent)$/, '@coreui/icons-angular'],
  // PrimeNG — module names that are unique enough
  [/^(DataTable|TieredMenu|MenuItem|Dropdown|MultiSelect|AutoComplete|Calendar|FileUpload|ColorPicker|TreeTable|TreeNode|Tree|DataView|OrderList|PickList|Galleria|DeferredLoader|Growl|LightBox|OverlayPanel|Panel|TabView|TabPanel|Accordion|Toolbar|Breadcrumb|Paginator|DataScroller|Carousel|Fieldset|Grid|BlockUI|CaptureGroup|ProgressBar|ProgressSpinner|ScrollPanel|Skeleton|VirtualScroller|Timeline|Avatar|AvatarGroup|Tag|Badge|Chip|Divider|Splitter|SplitterPanel|Card|Inplace|ScrollTop|Ripple|StyleClass|FocusTrap|Animate|AutoFocus|DeferModule|ImageModule|TableModule|DynamicDialogModule|Tooltip|Toast|ConfirmDialog|ConfirmPopup|ContextMenu|Dialog|Sidebar|Menu|MenuModule|MenubarModule|MegaMenu|TieredMenuModule|PanelMenuModule|SlideMenuModule|ButtonModule|SplitButtonModule|RadioButton|Checkbox|InputSwitch|InputText|InputNumber|InputMask|InputTextarea|Password|Knob|ListBox|SelectButton|ToggleButton|Rating|Slider|Chips|ColorPicker|TreeSelect|CascadeSelect|DropdownModule|MultiSelectModule|SpeedDial|DockModule|MeterGroup)Module$/, 'primeng'],
];

/**
 * Per-scan map: class name → source package (or file path segment).
 * Reset at the start of each collectAppStructure() call.
 * Populated by walkModuleDeclarations when library modules are detected.
 */
const _classNameToSource = new Map<string, string>();

/**
 * Match a class name against known library patterns. Returns the npm package
 * name if matched, or null for unknown/local classes.
 */
function matchKnownLibrary(name: string): string | null {
  if (!name) return null;
  for (const [pattern, pkg] of LIBRARY_NAME_PATTERNS) {
    if (pattern.test(name)) return pkg;
  }
  return null;
}

/**
 * Extract npm package name from a node_modules file path.
 * e.g. "/node_modules/@coreui/angular/src/..." → "@coreui/angular"
 *      "/node_modules/ngx-scrollbar/..."       → "ngx-scrollbar"
 */
function extractPackageFromPath(filePath: string): string | null {
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
 * Tries, in order:
 *   1. ɵmod.id (Angular module federation id)
 *   2. debugInfo.filePath → extract from node_modules segment
 *   3. Class name pattern matching
 */
function detectModuleSource(moduleCtor: any, mod: any): string | null {
  try {
    // 1. Angular module federation id (ngModule decorator id field)
    const modId = mod?.id ?? moduleCtor?.ɵmod?.id;
    if (typeof modId === 'string' && modId) return modId;

    // 2. debugInfo.filePath on the module's Ivy defs
    const filePath = tryGetFilePathFromCtor(moduleCtor);
    if (filePath) {
      const pkg = extractPackageFromPath(filePath);
      if (pkg) return pkg;
    }

    // 3. Class name pattern match
    return matchKnownLibrary(moduleCtor?.name ?? '');
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function collectAppStructure(): AppStructureData {
  const ng = (globalThis as any).ng;

  // Reset per-scan library source map
  _classNameToSource.clear();

  // ── Phase 1: constructor metadata + live instances ────────────────────────
  const seen = new Set<Function>();
  const instancesSeen = new Set<string>();
  const components: ComponentRegistryEntry[] = [];
  const directives: DirectiveRegistryEntry[] = [];
  const pipes: PipeRegistryEntry[] = [];
  const services: ServiceRegistryEntry[] = [];
  const modules: ModuleRegistryEntry[] = [];
  const signalStateMap = new Map<string, SignalStateEntry>();
  const observableStateMap = new Map<string, ObservableStateEntry>();

  const elements = document.querySelectorAll('*');
  const limit = Math.min(elements.length, MAX_SCAN_ELEMENTS);

  for (let i = 0; i < limit; i++) {
    const el = elements[i];

    // Dev mode: ng.getComponent()
    if (ng?.getComponent) {
      try {
        const inst = ng.getComponent(el);
        if (inst) {
          processConstructor(inst.constructor, seen, components, directives, pipes, services, modules);
          scanInstanceState(inst, inst.constructor?.name ?? '', 'component', instancesSeen, signalStateMap, observableStateMap);
        }
      } catch { /* ignore */ }
    }

    // All modes: __ngContext__ LView
    tryLViewScan(el, seen, instancesSeen, components, directives, pipes, services, modules, signalStateMap, observableStateMap);
  }

  // ── Phase 2: injector access ──────────────────────────────────────────────
  const rootEl = document.querySelector('[ng-version]');
  const injector = ng?.getInjector && rootEl ? tryGetInjector(ng, rootEl) : null;

  const router = injector ? findRouter(injector) : null;
  const ngrxEntries = injector ? detectNgrx(injector, signalStateMap, observableStateMap) : [];
  const tokens = injector ? collectInjectionTokens(injector) : [];
  const interceptors = injector ? collectInterceptors(injector) : [];
  const appProviders = injector ? collectAppProviders(injector) : [];

  // Also scan services found in injector for state patterns
  if (injector) {
    scanInjectorServices(injector, instancesSeen, signalStateMap, observableStateMap);
  }

  // ── Phase 3: route analysis ───────────────────────────────────────────────
  const routeConfig: any[] = router?.config ?? router?.routes ?? [];
  const routes = parseRouteConfig(routeConfig, '');
  const { guards, resolvers } = extractGuardsAndResolvers(routeConfig);
  const activeRoutes = router ? collectActiveRoutes(router) : [];

  // Routing strategy and summary info
  const routerInfo = buildRouterInfo(injector, routes, routeConfig);

  // ── Phase 4: service role enrichment ─────────────────────────────────────
  enrichServiceRoles(services, guards, interceptors, resolvers);

  // ── Phase 5: infrastructure & app info ────────────────────────────────────
  const knownClassNames = new Set<string>(
    [...components, ...directives, ...pipes, ...services, ...modules].map(e => e.className)
  );

  const application = detectApplicationInfo(ng, rootEl);
  const serviceWorker = detectServiceWorker();
  const libraries = detectLibraries(modules, components, services);
  const environments = detectEnvironments();
  const plainClasses = injector ? detectPlainClasses(injector, knownClassNames) : [];
  const bootstrapConfig = detectBootstrapConfig(injector, ng, rootEl, services, tokens);

  // ── Post-processing: fill in package names for library entities ────────────
  // Entities extracted before their declaring module was walked have filePath=null.
  // _classNameToSource was populated during walkModuleDeclarations; use it now.
  const allFilePathEntities: Array<{ className: string; filePath: string | null }> = [
    ...components, ...directives, ...pipes, ...services, ...modules,
    ...guards, ...interceptors, ...resolvers,
  ];
  for (const entity of allFilePathEntities) {
    if (entity.filePath === null) {
      entity.filePath = _classNameToSource.get(entity.className) ?? null;
    }
  }

  return {
    application,
    bootstrapConfig,
    components,
    directives,
    pipes,
    services,
    guards,
    interceptors,
    resolvers,
    modules,
    routes,
    activeRoutes,
    stateManagement: {
      signalState: Array.from(signalStateMap.values()),
      observableState: Array.from(observableStateMap.values()),
      ngrx: ngrxEntries,
    },
    tokens,
    appProviders,
    libraries,
    plainClasses,
    environments,
    serviceWorker,
    routerInfo,
    changeDetectionSummary: {
      onPush: components.filter(c => c.changeDetection === 'OnPush').length,
      default: components.filter(c => c.changeDetection === 'Default').length,
      total: components.length,
    },
    collectedAt: Date.now(),
    angularVersion: document.querySelector('[ng-version]')?.getAttribute('ng-version') ?? null,
  };
}

// ─── Constructor / Metadata Processing ───────────────────────────────────────

function processConstructor(
  ctor: any,
  seen: Set<Function>,
  components: ComponentRegistryEntry[],
  directives: DirectiveRegistryEntry[],
  pipes: PipeRegistryEntry[],
  services: ServiceRegistryEntry[],
  modules: ModuleRegistryEntry[],
): void {
  if (!ctor || typeof ctor !== 'function' || seen.has(ctor)) return;
  seen.add(ctor);

  const cmp = ctor.ɵcmp;
  const dir = ctor.ɵdir;
  const pipe = ctor.ɵpipe;
  const mod = ctor.ɵmod;
  const prov = ctor.ɵprov;

  if (cmp) {
    components.push(extractComponent(ctor, cmp));
    walkDependencies(cmp, seen, components, directives, pipes, services, modules);
  } else if (dir) {
    directives.push(extractDirective(ctor, dir));
    walkDependencies(dir, seen, components, directives, pipes, services, modules);
  }

  if (pipe) pipes.push(extractPipe(ctor, pipe));
  if (mod) {
    modules.push(extractModule(ctor, mod));
    walkModuleDeclarations(ctor, mod, seen, components, directives, pipes, services, modules);
  }
  if (prov && !cmp && !dir && !pipe && !mod) {
    services.push(extractService(ctor, prov));
  }
}

function walkDependencies(
  def: any,
  seen: Set<Function>,
  components: ComponentRegistryEntry[],
  directives: DirectiveRegistryEntry[],
  pipes: PipeRegistryEntry[],
  services: ServiceRegistryEntry[],
  modules: ModuleRegistryEntry[],
): void {
  try {
    let deps: any[] = [];
    if (typeof def.dependencies === 'function') {
      deps = def.dependencies() ?? [];
    } else if (Array.isArray(def.dependencies)) {
      deps = def.dependencies;
    } else if (typeof def.directives === 'function') {
      deps = def.directives() ?? [];
    }
    for (const dep of deps) {
      if (typeof dep === 'function') {
        processConstructor(dep, seen, components, directives, pipes, services, modules);
      }
    }
  } catch { /* ignore */ }
}

function walkModuleDeclarations(
  moduleCtor: any,
  mod: any,
  seen: Set<Function>,
  components: ComponentRegistryEntry[],
  directives: DirectiveRegistryEntry[],
  pipes: PipeRegistryEntry[],
  services: ServiceRegistryEntry[],
  modules: ModuleRegistryEntry[],
): void {
  // Detect which package this module belongs to and tag its members
  const source = detectModuleSource(moduleCtor, mod);
  if (source) {
    // Tag the module itself
    const modName = moduleCtor?.name ?? '';
    if (modName && !_classNameToSource.has(modName)) _classNameToSource.set(modName, source);
  }

  try {
    for (const list of [mod.declarations, mod.imports, mod.exports]) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (typeof item === 'function') {
          // Tag the declaration/import/export with the source
          if (source) {
            const n = item.name ?? '';
            if (n && !_classNameToSource.has(n)) _classNameToSource.set(n, source);
          }
          processConstructor(item, seen, components, directives, pipes, services, modules);
        }
      }
    }
  } catch { /* ignore */ }
}

// ─── LView / Production Mode Scan ────────────────────────────────────────────

function tryLViewScan(
  el: Element,
  seen: Set<Function>,
  instancesSeen: Set<string>,
  components: ComponentRegistryEntry[],
  directives: DirectiveRegistryEntry[],
  pipes: PipeRegistryEntry[],
  services: ServiceRegistryEntry[],
  modules: ModuleRegistryEntry[],
  signalStateMap: Map<string, SignalStateEntry>,
  observableStateMap: Map<string, ObservableStateEntry>,
): void {
  try {
    const ngCtx = (el as any).__ngContext__;
    if (!ngCtx) return;

    let inst: any = null;
    let ctor: any = null;

    if (Array.isArray(ngCtx)) {
      const tView = ngCtx[1];
      if (tView?.type && typeof tView.type === 'function') {
        ctor = tView.type;
        // CONTEXT in LView is at index 8
        inst = ngCtx[8] ?? null;
      }
    } else if (ngCtx && typeof ngCtx === 'object') {
      ctor = ngCtx.constructor;
      inst = ngCtx;
    }

    if (ctor) {
      processConstructor(ctor, seen, components, directives, pipes, services, modules);
    }
    if (inst) {
      scanInstanceState(inst, ctor?.name ?? '', 'component', instancesSeen, signalStateMap, observableStateMap);
    }
  } catch { /* ignore */ }
}

// ─── Instance State Scanning ──────────────────────────────────────────────────

/**
 * Scans a live object instance for Angular signal properties and RxJS subjects.
 */
function scanInstanceState(
  inst: any,
  className: string,
  entityType: 'component' | 'service',
  seen: Set<string>,
  signalMap: Map<string, SignalStateEntry>,
  obsMap: Map<string, ObservableStateEntry>,
): void {
  if (!inst || !className || seen.has(className)) return;
  seen.add(className);

  const writableSignals: string[] = [];
  const computedSignals: string[] = [];
  const effects: string[] = [];
  const subjects: string[] = [];
  const observables: string[] = [];

  const ownKeys = safeGetKeys(inst);

  for (const key of ownKeys) {
    if (shouldSkipProp(key)) continue;
    try {
      const value = inst[key];
      if (value == null) continue;

      if (isAngularSignal(value)) {
        if (isWritableSignal(value)) {
          writableSignals.push(key);
        } else {
          computedSignals.push(key);
        }
      } else if (isAngularEffect(value)) {
        effects.push(key);
      } else if (isRxjsSubject(value)) {
        subjects.push(key);
      } else if (isRxjsObservable(value)) {
        observables.push(key);
      }
    } catch { /* ignore */ }
  }

  if (writableSignals.length + computedSignals.length + effects.length > 0) {
    signalMap.set(className, { className, entityType, writableSignals, computedSignals, effects });
  }
  if (subjects.length + observables.length > 0) {
    obsMap.set(className, { className, entityType, subjects, observables });
  }
}

function safeGetKeys(inst: any): string[] {
  try {
    const own = Object.getOwnPropertyNames(inst).slice(0, MAX_INSTANCE_PROPS);
    const proto = inst.constructor?.prototype
      ? Object.getOwnPropertyNames(inst.constructor.prototype).slice(0, MAX_INSTANCE_PROPS)
      : [];
    return [...new Set([...own, ...proto])];
  } catch {
    return [];
  }
}

function shouldSkipProp(key: string): boolean {
  return SKIP_PROP_PREFIXES.some(p => key.startsWith(p)) || key === 'constructor';
}

/** Angular signals are functions with a SIGNAL brand symbol on them. */
function isAngularSignal(value: any): boolean {
  if (typeof value !== 'function') return false;
  try {
    const syms = Object.getOwnPropertySymbols(value);
    if (syms.some(s => String(s).toLowerCase().includes('signal'))) return true;
    // Fallback: callable with .set() + .update() OR callable with no args returning a value
    return (typeof value.set === 'function' && typeof value.update === 'function') ||
           (typeof value.set === 'function');
  } catch {
    return false;
  }
}

/** Writable signal: has .set() method */
function isWritableSignal(value: any): boolean {
  return typeof value?.set === 'function';
}

/** Angular effect() ref: object with destroy() and internal reactive-node symbols */
function isAngularEffect(value: any): boolean {
  if (!value || typeof value !== 'object' || typeof value === 'function') return false;
  if (typeof value.destroy !== 'function') return false;
  // Avoid false-positives (RxJS subscriptions also have unsubscribe/destroy)
  if (typeof value.next === 'function' || typeof value.subscribe === 'function') return false;
  try {
    const ctorName: string = value.constructor?.name ?? '';
    if (ctorName.toLowerCase().includes('effect')) return true;
    const syms = Object.getOwnPropertySymbols(value);
    return syms.some(s => {
      const str = String(s).toLowerCase();
      return str.includes('effect') || str.includes('reactivenode') || str.includes('node');
    });
  } catch {
    return false;
  }
}

/** Duck-type RxJS Subject / BehaviorSubject / ReplaySubject */
function isRxjsSubject(value: any): boolean {
  return value != null &&
    typeof value === 'object' &&
    typeof value.next === 'function' &&
    typeof value.subscribe === 'function' &&
    typeof value.asObservable === 'function';
}

/** Duck-type RxJS Observable (pipe + subscribe) */
function isRxjsObservable(value: any): boolean {
  return value != null &&
    typeof value === 'object' &&
    typeof value.pipe === 'function' &&
    typeof value.subscribe === 'function' &&
    !isRxjsSubject(value);
}

// ─── Injector Introspection ───────────────────────────────────────────────────

/**
 * Get the injector records Map from any Angular injector object.
 * Handles both Angular <21 (_records) and Angular 21+ (records) naming,
 * plus wrapper objects (.injector / ._injector).
 */
function getInjectorMap(obj: any): Map<any, any> | null {
  if (!obj || typeof obj !== 'object') return null;
  // Angular 21+: R3Injector uses public `records` field
  if (obj.records instanceof Map) return obj.records;
  // Angular <21: R3Injector used private convention `_records`
  if (obj._records instanceof Map) return obj._records;
  return null;
}

function tryGetInjector(ng: any, el: Element): any {
  try {
    const inj = ng.getInjector(el);
    if (!inj) return null;

    // Fast path: already an R3Injector (has records/._records directly)
    if (getInjectorMap(inj)) return inj;

    // Angular 17+ standalone: ng.getInjector() returns a NodeInjector (facade over
    // _tNode/_lView). The real R3Injector lives at lView[INJECTOR=9]. Extract it so
    // that all records-based introspection works.
    const lView = inj._lView;
    if (Array.isArray(lView)) {
      const envInj = lView[9]; // INJECTOR constant (stable since Angular 14–21)
      if (envInj) {
        // R3Injector directly (Angular 21: .records, older: ._records)
        if (getInjectorMap(envInj)) return envInj;
        // R3EnvironmentInjector wraps an R3Injector in a `.injector` field
        const inner = envInj.injector ?? envInj._injector;
        if (inner && getInjectorMap(inner)) return inner;
        // At minimum return something with a working .get() method
        if (typeof envInj.get === 'function') return envInj;
      }
      // Also try ENVIRONMENT slot (index 10) as a fallback
      const envSlot = lView[10];
      if (envSlot && getInjectorMap(envSlot)) return envSlot;
    }

    // Angular 21 fallback: read LView from __ngContext__ directly (bypasses NodeInjector)
    const ctxLView = (el as any).__ngContext__;
    const directLView = Array.isArray(ctxLView) ? ctxLView : null;
    if (directLView) {
      for (const idx of [9, 10]) {
        const candidate = directLView[idx];
        if (!candidate || typeof candidate !== 'object') continue;
        if (getInjectorMap(candidate)) return candidate;
        const inner = candidate.injector ?? candidate._injector;
        if (inner && getInjectorMap(inner)) return inner;
      }
    }

    return inj;
  } catch { return null; }
}

function getInjectorRecords(injector: any): Map<any, any> | null {
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
function detectNgrx(
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
function collectInterceptors(injector: any): InterceptorRegistryEntry[] {
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

/** Collect InjectionToken instances from the injector's record map. */
// ─── App Config / Environment Provider Instrumentation ───────────────────────

/** Maps provider name patterns to their Angular feature category. */
const PROVIDER_CATEGORY_PATTERNS: Array<[RegExp, AppProviderCategory]> = [
  [/^(Router|ActivatedRoute|RouterPreloader|RouteReuseStrategy|TitleStrategy|DefaultTitleStrategy|UrlSerializer|PreloadingStrategy|RouterConfigLoader|NavigationTransitions|RouterScroller|RouterLink|RouterOutlet|RouterLinkActive|RouterLinkWithHref|ChildrenOutletContexts|OutletContext)$/, 'router'],
  [/^(HttpClient|HttpHandler|HttpBackend|HttpXhrBackend|XhrFactory|HttpStateTransitionManager|HttpTransferCacheOptions|HttpTransferStateInterceptor|HTTP_INTERCEPTORS)$/, 'http'],
  [/^(FormBuilder|ReactiveFormBuilder|FormGroup|FormControl|FormArray|NgForm|NgModel|NgModelGroup|FormGroupDirective|FormControlDirective|FormArrayName|FormsModule|ReactiveFormsModule)$/, 'forms'],
  [/^(AnimationBuilder|AnimationDriver|AnimationEngine|BrowserAnimationBuilder|InjectableAnimationEngine|TransitionAnimationEngine|AnimationRendererFactory)$/, 'animations'],
  [/^(DomSanitizer|CSP_NONCE|SafeValue)$/, 'security'],
  [/^(LOCALE_ID|NgLocaleLocalization|NgLocalization|MissingTranslationStrategy|NgPluralCase)$/, 'i18n'],
  [/^(ApplicationRef|ApplicationInitStatus|NgZone|ErrorHandler|Compiler|PlatformRef|TestabilityRegistry|Testability|Title|Meta|Location|PlatformLocation|BrowserPlatformLocation|PathLocationStrategy|HashLocationStrategy|APP_BASE_HREF|ViewportScroller|RendererFactory2|DomRendererFactory2|EventManager|SharedStylesHost|TransferState|IS_PLATFORM_BROWSER|APP_ID|APP_INITIALIZER|APP_BOOTSTRAP_LISTENER|PLATFORM_ID|PLATFORM_INITIALIZER|ENVIRONMENT_INITIALIZER)$/, 'core'],
];

/** Provider names that are Angular implementation details — not shown to the user. */
const PROVIDER_SKIP_PREFIXES = ['ɵ', 'Ɵ', '__ng'];

function categorizeProvider(name: string): AppProviderCategory {
  for (const [pattern, cat] of PROVIDER_CATEGORY_PATTERNS) {
    if (pattern.test(name)) return cat;
  }
  return 'app';
}

/**
 * Walk the full injector chain and collect every registered provider.
 * Works in both dev and production mode since it reads the injector metadata,
 * not live instances (no lazy instantiation side-effects).
 */
function collectAppProviders(injector: any): AppProviderEntry[] {
  const seen = new Set<string>();
  const entries: AppProviderEntry[] = [];

  let current: any = injector;
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
  const ORDER: Record<AppProviderCategory, number> = {
    app: 0, router: 1, http: 2, forms: 3, animations: 4,
    security: 5, i18n: 6, core: 7, other: 8,
  };
  entries.sort((a, b) => {
    const od = ORDER[a.category] - ORDER[b.category];
    return od !== 0 ? od : a.name.localeCompare(b.name);
  });

  return entries;
}

function collectInjectionTokens(injector: any): TokenRegistryEntry[] {
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
function scanInjectorServices(
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

// ─── Route Analysis ───────────────────────────────────────────────────────────

function findRouter(injector: any): any {
  // Strategy 1: Walk the full injector parent chain looking for a 'Router' class token.
  // Angular 21: R3Injector.records (public); older Angular: R3Injector._records.
  let current: any = injector;
  while (current) {
    const records: Map<any, any> | undefined =
      getInjectorMap(current) ??
      getInjectorMap(current.injector) ??
      getInjectorMap(current._injector) ??
      undefined;

    if (records) {
      for (const [token] of records) {
        if (typeof token === 'function' && token.name === 'Router') {
          try {
            // Prefer calling .get() on the object that owns the records.
            const owner = getInjectorMap(current) ? current :
                          (getInjectorMap(current.injector) ? current.injector : current._injector ?? current);
            const inst = (owner.get ?? injector.get).call(
              owner,
              token,
              null,
              { optional: true } as any,
            );
            if (inst && typeof inst.navigate === 'function') return inst;
          } catch { /* ignore */ }
        }
      }
    }
    current = current._parent ?? current.parent ??
              current._injector?.parent ?? current.injector?.parent ?? null;
  }

  // Strategy 2: Duck-type scan of the records that ARE visible from this injector.
  const records = getInjectorRecords(injector);
  if (records) {
    for (const [token] of records) {
      try {
        const inst = injector.get(token, null, { optional: true } as any);
        if (
          inst &&
          (Array.isArray(inst.config) || Array.isArray(inst.routes)) &&
          typeof inst.navigate === 'function' &&
          typeof inst.navigateByUrl === 'function'
        ) return inst;
      } catch { /* ignore */ }
    }
  }

  // Strategy 3: Scan router-outlet element. In Angular 17+ standalone apps the
  // RouterOutlet directive may not have a public `router` property (Angular 21
  // uses private class fields), so we duck-type scan all own properties of each
  // directive instance looking for an object that looks like a Router.
  try {
    const ng = (globalThis as any).ng;
    const outlet = document.querySelector('router-outlet');
    if (outlet && ng) {
      // Dev mode: ng.getDirectives gives directive instances on the element
      const directives: any[] = ng.getDirectives?.(outlet) ?? [];
      for (const d of directives) {
        // Quick check: older Angular exposed d.router directly
        if (d?.router && typeof d.router.navigate === 'function') return d.router;

        // Angular 21+: scan all enumerable own props for a Router-shaped object
        if (d && typeof d === 'object') {
          for (const key of Object.getOwnPropertyNames(d)) {
            try {
              const val = (d as any)[key];
              if (
                val != null && typeof val === 'object' &&
                typeof val.navigate === 'function' &&
                typeof val.navigateByUrl === 'function' &&
                (Array.isArray(val.config) || Array.isArray(val.routes))
              ) return val;
            } catch { /* ignore */ }
          }
        }
      }

      // Fallback: extract from the outlet element's __ngContext__ LView.
      // LView[9] = INJECTOR (Angular 14-21 stable constant; NOT slot 8 which is CONTEXT)
      const ctx = (outlet as any).__ngContext__;
      if (ctx) {
        const lView = Array.isArray(ctx) ? ctx : null;
        if (lView) {
          for (const idx of [9, 10]) {
            const envInj = lView[idx];
            if (!envInj) continue;
            // Resolve to whichever object holds the records Map
            const r3 = getInjectorMap(envInj) ? envInj :
                       (getInjectorMap(envInj.injector) ? envInj.injector :
                       (getInjectorMap(envInj._injector) ? envInj._injector : null));
            if (!r3) continue;
            const rMap = getInjectorMap(r3);
            if (!rMap) continue;
            for (const [token] of rMap) {
              if (typeof token === 'function' && token.name === 'Router') {
                try {
                  const inst = r3.get(token, null, { optional: true } as any);
                  if (inst && typeof inst.navigate === 'function') return inst;
                } catch { /* ignore */ }
              }
            }
          }
        }
      }
    }
  } catch { /* ignore */ }

  // Strategy 4: RouterLink directives have a public `router` property (Angular 21 confirmed).
  // CoreUI and most Angular apps use routerLink extensively, making this very reliable.
  try {
    const ng4 = (globalThis as any).ng;
    const linkElements = document.querySelectorAll('[routerLink],[data-routerlink],[ng-reflect-router-link]');
    for (const linkEl of linkElements) {
      const dirs: any[] = ng4?.getDirectives?.(linkEl) ?? [];
      for (const d of dirs) {
        // RouterLink stores Router as public `this.router = router` (Angular 21 confirmed)
        if (d?.router && typeof d.router.navigate === 'function' &&
            (Array.isArray(d.router.config) || Array.isArray(d.router.routes))) {
          return d.router;
        }
        // Generic duck-type scan of all own properties
        if (d && typeof d === 'object') {
          for (const key of Object.getOwnPropertyNames(d)) {
            try {
              const val = (d as any)[key];
              if (val != null && typeof val === 'object' &&
                  typeof val.navigate === 'function' &&
                  typeof val.navigateByUrl === 'function' &&
                  (Array.isArray(val.config) || Array.isArray(val.routes))) return val;
            } catch { /* ignore */ }
          }
        }
      }
    }
  } catch { /* ignore */ }

  return null;
}

function parseRouteConfig(config: any[], parentPath = ''): RouteRegistryEntry[] {
  if (!Array.isArray(config)) return [];
  return config.slice(0, 500).map(route => {
    const isLazy = !!(route.loadComponent || route.loadChildren);
    const pathSegment: string = route.path ?? '';

    // Build the absolute path for this route
    const absolutePath = pathSegment === '**'
      ? `${parentPath}/**`
      : `${parentPath}/${pathSegment}`.replace(/\/+/g, '/') || '/';

    // For already-loaded lazy modules, Angular stores loaded routes in _loadedRoutes
    const lazyChildren: any[] = route._loadedRoutes ?? route._loadedConfig?.routes ?? [];
    const rawChildren: any[] = Array.isArray(route.children) ? route.children : lazyChildren;
    const loadedChildren = lazyChildren.length > 0;

    // Resolve the component name. For lazy routes that have already been loaded,
    // Angular stores the actual component in _loadedComponent (loadComponent) or
    // we can resolve via rawChildren (loadChildren resolves to a routes array).
    const component: string | null =
      route.component?.name
      ?? route._loadedComponent?.name          // Angular 17+: loaded lazy component
      ?? (route.loadComponent ? '(lazy component)' : null)
      ?? (route.loadChildren ? '(lazy module)' : null);

    // Route title: from route.title (Angular 14+) or legacy route.data.title
    const title: string | null =
      (typeof route.title === 'string' ? route.title : null)
      ?? (typeof route.data?.title === 'string' ? route.data.title : null);

    return {
      path: pathSegment,
      absolutePath,
      component,
      redirectTo: route.redirectTo ?? null,
      guards: extractGuardNames(route),
      resolvers: extractResolverNames(route),
      children: parseRouteConfig(rawChildren, absolutePath),
      isLazy,
      title,
      loadedChildren,
    };
  });
}

/**
 * Collect the currently active route tree from router.routerState.snapshot.
 * Returns one entry per rendered outlet showing the absolute path and component.
 */
function collectActiveRoutes(router: any): ActiveRouteEntry[] {
  const result: ActiveRouteEntry[] = [];

  function traverse(snapshot: any, pathSoFar: string): void {
    if (!snapshot) return;
    try {
      const segments: string[] = Array.isArray(snapshot.url)
        ? snapshot.url.map((s: any) => s.path ?? '').filter(Boolean)
        : [];
      const currentPath = segments.length
        ? `${pathSoFar}/${segments.join('/')}`.replace(/\/+/g, '/')
        : pathSoFar || '/';

      const componentName: string | null = snapshot.component?.name ?? null;
      const outlet: string = snapshot.outlet ?? 'primary';

      // Skip internal Angular components (prefixed with ɵ) and null entries
      if (componentName && !componentName.startsWith('ɵ') && !componentName.startsWith('Ɵ')) {
        result.push({ absolutePath: currentPath, component: componentName, outlet });
      }

      for (const child of snapshot.children ?? []) {
        traverse(child, currentPath);
      }
    } catch { /* ignore */ }
  }

  try {
    const rootSnapshot = router.routerState?.snapshot?.root;
    if (rootSnapshot) traverse(rootSnapshot, '');
  } catch { /* ignore */ }

  return result;
}

function countFlatRoutes(routes: RouteRegistryEntry[]): number {
  return routes.reduce((sum, r) => sum + 1 + countFlatRoutes(r.children), 0);
}

function hasAnyLazyRoutes(routes: RouteRegistryEntry[]): boolean {
  return routes.some(r => r.isLazy || hasAnyLazyRoutes(r.children));
}

function detectRoutingStrategy(injector: any | null): RoutingStrategy {
  // Walk the injector chain looking for known Angular LocationStrategy class names.
  let current: any = injector;
  while (current) {
    const records: Map<any, any> | undefined =
      getInjectorMap(current) ??
      getInjectorMap(current.injector) ??
      getInjectorMap(current._injector) ??
      undefined;
    if (records) {
      for (const [token] of records) {
        if (typeof token === 'function') {
          if (token.name === 'HashLocationStrategy') return 'hash';
          if (token.name === 'PathLocationStrategy') return 'path';
        }
      }
    }
    current = current._parent ?? current.parent ?? null;
  }

  // Fallback: inspect the current URL — hash routing produces /#/path URLs
  try {
    const hash = globalThis.location?.hash ?? '';
    if (hash.startsWith('#/')) return 'hash';
    // If the URL has no hash but the page is an SPA, assume path strategy
    if (globalThis.history?.pushState) return 'path';
  } catch { /* ignore */ }

  return 'unknown';
}

function buildRouterInfo(
  injector: any | null,
  routes: RouteRegistryEntry[],
  rawConfig: any[],
): RouterInfo | null {
  if (!rawConfig.length && !routes.length) return null;

  const strategy = detectRoutingStrategy(injector);
  const baseHref = document.querySelector('base')?.getAttribute('href') ?? null;
  const totalRoutes = countFlatRoutes(routes);
  const hasLazyRoutes = hasAnyLazyRoutes(routes);

  return { strategy, baseHref, totalRoutes, hasLazyRoutes };
}

function extractGuardNames(route: any): string[] {
  const names: string[] = [];
  for (const key of ['canActivate', 'canDeactivate', 'canMatch', 'canLoad', 'canActivateChild']) {
    const list: any[] = route[key] ?? [];
    for (const g of list) {
      const name = typeof g === 'function' ? g.name : null;
      if (name && name !== 'anonymous') names.push(name);
    }
  }
  return [...new Set(names)];
}

function extractResolverNames(route: any): string[] {
  const names: string[] = [];
  if (!route.resolve) return names;

  const resolveMap = route.resolve;
  for (const key of Object.keys(resolveMap)) {
    const r = resolveMap[key];
    const name = typeof r === 'function' ? r.name : null;
    if (name && name !== 'anonymous') names.push(name);
  }
  return [...new Set(names)];
}

function extractGuardsAndResolvers(config: any[]): {
  guards: GuardRegistryEntry[];
  resolvers: ResolverRegistryEntry[];
} {
  const guardMap = new Map<string, GuardRegistryEntry>();
  const resolverMap = new Map<string, ResolverRegistryEntry>();

  function walkRoutes(routes: any[], pathPrefix: string): void {
    if (!Array.isArray(routes)) return;
    for (const route of routes) {
      const fullPath = `${pathPrefix}/${route.path ?? ''}`.replace(/\/+/g, '/');

      // Guards
      const guardKeys: Array<{ key: string; type: GuardType }> = [
        { key: 'canActivate', type: 'CanActivate' },
        { key: 'canDeactivate', type: 'CanDeactivate' },
        { key: 'canMatch', type: 'CanMatch' },
        { key: 'canLoad', type: 'CanLoad' },
        { key: 'canActivateChild', type: 'CanActivate' },
      ];

      for (const { key, type } of guardKeys) {
        const list: any[] = route[key] ?? [];
        for (const g of list) {
          if (typeof g !== 'function') continue;
          const name: string = g.name ?? 'anonymous';
          if (!name || name === 'anonymous') continue;

          if (!guardMap.has(name)) {
            const functional = !g.prototype || Object.keys(g.prototype).length <= 1;
            const filePath = tryGetFilePathFromCtor(g);
            guardMap.set(name, { className: name, filePath, guardTypes: [], functional, routes: [] });
          }
          const entry = guardMap.get(name)!;
          if (!entry.guardTypes.includes(type)) entry.guardTypes.push(type);
          if (!entry.routes.includes(fullPath)) entry.routes.push(fullPath);
        }
      }

      // Resolvers
      if (route.resolve) {
        for (const resolverFn of Object.values(route.resolve)) {
          if (typeof resolverFn !== 'function') continue;
          const name: string = (resolverFn as any).name ?? '';
          if (!name || name === 'anonymous') continue;

          if (!resolverMap.has(name)) {
            const functional = !(resolverFn as any).prototype?.resolve;
            const filePath = tryGetFilePathFromCtor(resolverFn as any);
            resolverMap.set(name, { className: name, filePath, functional, routes: [] });
          }
          const entry = resolverMap.get(name)!;
          if (!entry.routes.includes(fullPath)) entry.routes.push(fullPath);
        }
      }

      if (route.children) walkRoutes(route.children, fullPath);
    }
  }

  walkRoutes(config, '');
  return {
    guards: Array.from(guardMap.values()),
    resolvers: Array.from(resolverMap.values()),
  };
}

// ─── Service Role Enrichment ──────────────────────────────────────────────────

function enrichServiceRoles(
  services: ServiceRegistryEntry[],
  guards: GuardRegistryEntry[],
  interceptors: InterceptorRegistryEntry[],
  resolvers: ResolverRegistryEntry[],
): void {
  const guardNames = new Set(guards.map(g => g.className));
  const interceptorNames = new Set(interceptors.map(i => i.className));
  const resolverNames = new Set(resolvers.map(r => r.className));

  for (const svc of services) {
    const roles: ServiceRole[] = ['service'];
    if (guardNames.has(svc.className)) roles.push('guard');
    if (interceptorNames.has(svc.className)) roles.push('interceptor');
    if (resolverNames.has(svc.className)) roles.push('resolver');
    svc.roles = roles;
  }
}

// ─── Data Extraction from Ivy Metadata ───────────────────────────────────────

/**
 * Detect signal-based inputs (input(), input.required()) and model() inputs from
 * ɵcmp.inputConfig. Angular 17+ stores InputFlags per property; SignalBased = 1.
 * model() also registers a corresponding `${propName}Change` output.
 */
function extractSignalInputsFromMetadata(
  cmp: any,
): { signalInputs: string[]; modelInputs: string[] } {
  const signalInputs: string[] = [];
  const modelInputs: string[] = [];
  try {
    const inputConfig = cmp.inputConfig;
    if (!inputConfig || typeof inputConfig !== 'object') return { signalInputs, modelInputs };
    // model() auto-registers a `${propName}Change` output
    const outputKeys = new Set<string>(Object.keys(cmp.outputs ?? {}));
    for (const [propName, flags] of Object.entries(inputConfig as Record<string, unknown>)) {
      // InputFlags.SignalBased = 1 in Angular 17+
      if (typeof flags === 'number' && (flags & 1) !== 0) {
        if (outputKeys.has(propName + 'Change')) {
          modelInputs.push(propName);
        } else {
          signalInputs.push(propName);
        }
      }
    }
  } catch { /* ignore */ }
  return { signalInputs, modelInputs };
}

function extractComponent(ctor: any, cmp: any): ComponentRegistryEntry {
  const { signalInputs, modelInputs } = extractSignalInputsFromMetadata(cmp);
  return {
    selector: extractSelector(cmp.selectors ?? cmp.selector),
    className: ctor.name ?? 'Unknown',
    filePath: tryGetFilePath(cmp)
      ?? extractPackageFromPath(tryGetFilePathFromCtor(ctor) ?? '')
      ?? matchKnownLibrary(ctor.name ?? ''),
    changeDetection: (cmp.onPush === true || cmp.changeDetection === 1) ? 'OnPush' : 'Default',
    inputs: Object.keys(cmp.inputs ?? {}),
    outputs: Object.keys(cmp.outputs ?? {}),
    standalone: cmp.standalone ?? false,
    signalInputs,
    modelInputs,
  };
}

function extractDirective(ctor: any, dir: any): DirectiveRegistryEntry {
  return {
    selector: extractSelector(dir.selectors ?? dir.selector),
    className: ctor.name ?? 'Unknown',
    filePath: tryGetFilePath(dir)
      ?? extractPackageFromPath(tryGetFilePathFromCtor(ctor) ?? '')
      ?? matchKnownLibrary(ctor.name ?? ''),
    inputs: Object.keys(dir.inputs ?? {}),
    outputs: Object.keys(dir.outputs ?? {}),
    standalone: dir.standalone ?? false,
  };
}

function extractPipe(ctor: any, pipe: any): PipeRegistryEntry {
  return {
    name: pipe.name ?? ctor.name ?? 'Unknown',
    className: ctor.name ?? 'Unknown',
    filePath: tryGetFilePath(pipe)
      ?? extractPackageFromPath(tryGetFilePathFromCtor(ctor) ?? '')
      ?? matchKnownLibrary(ctor.name ?? ''),
    pure: pipe.pure !== false,
    standalone: pipe.standalone ?? false,
  };
}

function extractService(ctor: any, prov: any): ServiceRegistryEntry {
  const pi = prov.providedIn;
  const scope = typeof pi === 'string' ? pi
    : (pi === null || pi === undefined) ? 'none'
    : typeof pi === 'function' ? (pi.name ?? 'module')
    : 'module';

  const rawPath = tryGetFilePath(prov) ?? tryGetFilePathFromCtor(ctor);
  const filePath = rawPath
    ? (extractPackageFromPath(rawPath) ?? rawPath)
    : (matchKnownLibrary(ctor.name ?? '') ?? null);

  return {
    className: ctor.name ?? 'Unknown',
    filePath,
    providedIn: scope,
    roles: ['service'],
  };
}

function extractModule(ctor: any, mod: any): ModuleRegistryEntry {
  const injDef = ctor.ɵinj;
  const providers: string[] = [];

  if (injDef?.providers && Array.isArray(injDef.providers)) {
    for (const p of injDef.providers) {
      const name = resolveProviderName(p);
      if (name) providers.push(name);
    }
  }

  const rawPath = tryGetFilePath(mod) ?? tryGetFilePath(injDef) ?? tryGetFilePathFromCtor(ctor);
  const filePath = rawPath
    ? (extractPackageFromPath(rawPath) ?? rawPath)
    : (matchKnownLibrary(ctor.name ?? '') ?? null);

  return {
    className: ctor.name ?? 'Unknown',
    filePath,
    declarations: resolveFnOrArray(mod.declarations).map(getCtorName).filter(Boolean),
    imports: resolveFnOrArray(mod.imports).map(getCtorName).filter(Boolean),
    exports: resolveFnOrArray(mod.exports).map(getCtorName).filter(Boolean),
    providers,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSelector(selectorDef: any): string {
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

function tryGetFilePath(def: any): string | null {
  try {
    if (typeof def?.debugInfo?.filePath === 'string') return def.debugInfo.filePath;
    if (typeof def?.templateUrl === 'string') return def.templateUrl;
  } catch { /* ignore */ }
  return null;
}

/**
 * Try every Angular Ivy metadata symbol on a constructor to find a file path.
 * Angular stores ClassDebugInfo (incl. filePath) on component/directive/pipe defs
 * in dev mode. Services rarely carry it, but it's worth checking ɵprov too.
 */
function tryGetFilePathFromCtor(ctor: any): string | null {
  if (!ctor || typeof ctor !== 'function') return null;
  return tryGetFilePath(ctor.ɵcmp)
    ?? tryGetFilePath(ctor.ɵdir)
    ?? tryGetFilePath(ctor.ɵpipe)
    ?? tryGetFilePath(ctor.ɵmod)
    ?? tryGetFilePath(ctor.ɵprov)
    ?? null;
}

function resolveFnOrArray(value: any): any[] {
  if (!value) return [];
  if (typeof value === 'function') {
    try { return value() ?? []; } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

function getCtorName(value: any): string {
  if (!value) return '';
  if (typeof value === 'function') return value.name ?? '';
  if (Array.isArray(value) && typeof value[0] === 'function') return value[0].name ?? '';
  return '';
}

function resolveProviderName(provider: any): string {
  if (!provider) return '';
  if (typeof provider === 'function') return provider.name ?? '';
  if (provider.provide) {
    if (typeof provider.provide === 'function') return provider.provide.name ?? '';
    if (typeof provider.provide === 'string') return provider.provide;
  }
  return '';
}

// ─── Phase 5 Helpers: Infrastructure ─────────────────────────────────────────

function detectApplicationInfo(ng: any, rootEl: Element | null): ApplicationInfo {
  let rootSelector: string | null = null;
  let rootComponent: string | null = null;

  if (rootEl) {
    rootSelector = rootEl.tagName.toLowerCase();
    if (ng?.getComponent) {
      try {
        const comp = ng.getComponent(rootEl);
        rootComponent = comp?.constructor?.name ?? null;
      } catch { /* ignore */ }
    }
  }

  let mode: ApplicationInfo['mode'] = 'unknown';
  try {
    const win = globalThis as any;
    if (win.ngDevMode !== undefined) {
      mode = win.ngDevMode ? 'development' : 'production';
    } else if (win.__ANGULAR_DEVMODE__ !== undefined) {
      mode = win.__ANGULAR_DEVMODE__ ? 'development' : 'production';
    }
  } catch { /* ignore */ }

  return { rootSelector, rootComponent, platform: 'browser', mode };
}

function detectServiceWorker(): ServiceWorkerInfo | null {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const sw = (navigator as any).serviceWorker;
    const ctrl = sw?.controller;
    return {
      registered: !!ctrl,
      scriptUrl: ctrl?.scriptURL ?? null,
      scope: null,
      state: ctrl?.state ?? null,
      hasNgsw: !!(ctrl?.scriptURL?.includes('ngsw-worker')),
      hasAppShell: !!(ctrl?.scriptURL?.includes('ngsw-worker')) && !!document.querySelector('app-shell'),
    };
  } catch {
    return { registered: false, scriptUrl: null, scope: null, state: null, hasNgsw: false, hasAppShell: false };
  }
}

/**
 * Detect what was registered via bootstrapApplication() / ApplicationConfig.
 * Covers: ng generate config, APP_INITIALIZER, provideRouter, provideHttpClient, etc.
 */
function detectBootstrapConfig(
  injector: any,
  ng: any,
  rootEl: Element | null,
  services: Array<{ className: string }>,
  tokens: Array<{ name: string; multi: boolean }>,
): BootstrapConfig {
  // ── Bootstrap type ────────────────────────────────────────────────────────
  let bootstrapType: BootstrapConfig['bootstrapType'] = 'unknown';
  try {
    if (ng?.getComponent && rootEl) {
      const comp = ng.getComponent(rootEl);
      const cmp = comp?.constructor?.ɵcmp;
      if (cmp) {
        bootstrapType = cmp.standalone === true ? 'standalone' : 'module-based';
      }
    }
  } catch { /* ignore */ }

  // ── APP_ID ────────────────────────────────────────────────────────────────
  let appId: string | null = null;
  if (injector) {
    try {
      const records = getInjectorRecords(injector);
      if (records) {
        for (const [token] of records) {
          const desc: string = token?._desc ?? token?.description ?? '';
          if (desc === 'AppId' || desc === 'app_id' || desc === 'APP_ID') {
            const val = injector.get(token, null, { optional: true } as any);
            if (typeof val === 'string') { appId = val; break; }
          }
        }
      }
    } catch { /* ignore */ }
  }

  const features: BootstrapConfigFeature[] = [];
  const serviceNames = new Set(services.map(s => s.className));

  // ── Features from known service class names ───────────────────────────────
  if (serviceNames.has('Router')) {
    features.push({ name: 'provideRouter / RouterModule', featureType: 'router' });
  }
  if (serviceNames.has('HttpClient') || serviceNames.has('HttpHandler') || serviceNames.has('HttpXhrBackend')) {
    features.push({ name: 'provideHttpClient / HttpClientModule', featureType: 'http' });
  }
  if (serviceNames.has('FormBuilder') || serviceNames.has('FormGroupDirective') ||
      tokens.some(t => t.name.includes('FormsModule') || t.name.includes('ReactiveFormsModule'))) {
    features.push({ name: 'FormsModule / ReactiveFormsModule', featureType: 'forms' });
  }
  if (serviceNames.has('AnimationDriver') || serviceNames.has('AnimationBuilder') ||
      serviceNames.has('BrowserAnimationBuilder')) {
    features.push({ name: 'provideAnimations / BrowserAnimationsModule', featureType: 'animations' });
  }
  if (serviceNames.has('TransferState') || serviceNames.has('HttpTransferCacheOptions')) {
    features.push({ name: 'provideClientHydration', featureType: 'hydration' });
  }
  if (serviceNames.has('SwPush') || serviceNames.has('SwUpdate') || serviceNames.has('SwRegistrationOptions')) {
    features.push({ name: 'provideServiceWorker', featureType: 'service-worker' });
  }

  // ── APP_INITIALIZER & ENVIRONMENT_INITIALIZER from injector ──────────────
  if (injector) {
    try {
      const records = getInjectorRecords(injector);
      if (records) {
        for (const [token] of records) {
          const desc: string = token?._desc ?? token?.description ?? '';
          if (desc === 'Application Initializer' || desc === 'APP_INITIALIZER') {
            const arr = injector.get(token, [], { optional: true } as any);
            const count = Array.isArray(arr) ? arr.length : 0;
            if (count > 0) features.push({ name: 'APP_INITIALIZER', featureType: 'initializer', count });
          } else if (desc === 'ENVIRONMENT_INITIALIZER') {
            const arr = injector.get(token, [], { optional: true } as any);
            const count = Array.isArray(arr) ? arr.length : 0;
            if (count > 0) features.push({ name: 'ENVIRONMENT_INITIALIZER', featureType: 'initializer', count });
          } else if (desc === 'OnSelf' || desc === 'ChangeDetectionScheduler' ||
                     desc.includes('ZonelessChangeDetectionScheduler')) {
            features.push({ name: 'provideExperimentalZonelessChangeDetection', featureType: 'change-detection' });
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ── Zone mode ─────────────────────────────────────────────────────────────
  let zone: BootstrapConfig['zone'] = 'unknown';
  try {
    if (typeof (window as any).Zone !== 'undefined') {
      zone = 'zone.js';
    } else if (features.some(f => f.featureType === 'change-detection')) {
      zone = 'zoneless';
    } else {
      zone = 'zoneless'; // No Zone global and no zoneless scheduler → likely zone-less build
    }
  } catch { /* ignore */ }

  // ── Custom ErrorHandler ───────────────────────────────────────────────────
  let errorHandlerCustom = false;
  if (injector) {
    try {
      const records = getInjectorRecords(injector);
      if (records) {
        for (const [token] of records) {
          const name: string = token?.name ?? '';
          const desc: string = token?._desc ?? token?.description ?? '';
          if (name === 'ErrorHandler' || desc === 'ErrorHandler') {
            const val = injector.get(token, null, { optional: true } as any);
            // Angular's built-in handler is named exactly 'ErrorHandler'; a custom one has a different class name
            if (val && val.constructor?.name !== 'ErrorHandler') {
              errorHandlerCustom = true;
            }
            break;
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ── Debug info availability ───────────────────────────────────────────────
  const debugInfoEnabled = !!(ng?.getComponent || ng?.getDirectives);

  return { bootstrapType, appId, features, zone, errorHandlerCustom, debugInfoEnabled };
}

function detectLibraries(
  modules: ModuleRegistryEntry[],
  components: ComponentRegistryEntry[],
  services: ServiceRegistryEntry[],
): LibraryEntry[] {
  const KNOWN: Array<{ p: RegExp; name: string; pkg: string }> = [
    { p: /Mat[A-Z]|BrowserAnimationsModule/, name: 'Angular Material', pkg: '@angular/material' },
    { p: /StoreModule|EffectsModule|StoreDevtools/, name: 'NgRx', pkg: '@ngrx/store' },
    { p: /ComponentStore/, name: 'NgRx Component Store', pkg: '@ngrx/component-store' },
    { p: /SignalStore/, name: 'NgRx Signal Store', pkg: '@ngrx/signals' },
    { p: /TranslateModule|TranslateService/, name: 'ngx-translate', pkg: '@ngx-translate/core' },
    { p: /RouterModule|^Router$/, name: 'Angular Router', pkg: '@angular/router' },
    { p: /HttpClient(?:Module)?$/, name: 'Angular HttpClient', pkg: '@angular/common/http' },
    { p: /ReactiveFormsModule|FormBuilder/, name: 'Angular Forms', pkg: '@angular/forms' },
    { p: /BrowserModule/, name: 'Angular Platform Browser', pkg: '@angular/platform-browser' },
    { p: /ServiceWorkerModule|SwModule/, name: 'Angular Service Worker', pkg: '@angular/service-worker' },
    { p: /CdkDrag|CdkTable|CdkTree|OverlayModule/, name: 'Angular CDK', pkg: '@angular/cdk' },
    { p: /PrimeNg|p-table|p-button/, name: 'PrimeNG', pkg: 'primeng' },
    { p: /NgbModule|NgbModal/, name: 'ng-bootstrap', pkg: '@ng-bootstrap/ng-bootstrap' },
    { p: /IonicModule/, name: 'Ionic', pkg: '@ionic/angular' },
    { p: /NzModule|NzTable/, name: 'NG-ZORRO', pkg: 'ng-zorro-antd' },
    { p: /UntilDestroy/, name: 'ngneat/until-destroy', pkg: '@ngneat/until-destroy' },
  ];

  const allNames = [
    ...modules.map(m => m.className),
    ...modules.flatMap(m => [...m.imports, ...m.declarations, ...m.providers]),
    ...components.map(c => c.className),
    ...services.map(s => s.className),
  ];

  const detected = new Set<string>();
  const results: LibraryEntry[] = [];
  for (const lib of KNOWN) {
    if (!detected.has(lib.pkg) && allNames.some(n => lib.p.test(n))) {
      detected.add(lib.pkg);
      results.push({ name: lib.name, packageName: lib.pkg });
    }
  }
  return results;
}

function detectEnvironments(): EnvironmentEntry[] {
  const win = globalThis as any;
  const entries: EnvironmentEntry[] = [];
  const candidates = ['environment', '__env', 'ENV', 'APP_ENV', 'appConfig', 'APP_CONFIG'];
  for (const k of candidates) {
    try {
      const val = win[k];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [pk, pv] of Object.entries(val)) {
          try {
            entries.push({ key: `${k}.${pk}`, value: JSON.stringify(pv).slice(0, 120) });
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  return entries;
}

function detectPlainClasses(
  injector: any,
  knownNames: Set<string>,
): PlainClassEntry[] {
  const result: PlainClassEntry[] = [];
  try {
    const records: Map<any, any> =
      getInjectorMap(injector) ?? new Map();

    records.forEach((record: any, token: any) => {
      if (typeof token !== 'function') return;
      if (token.ɵcmp || token.ɵdir || token.ɵpipe || token.ɵmod || token.ɵprov) return;
      const name = token.name ?? '';
      if (!name || name === 'Object' || name.startsWith('ɵ') || knownNames.has(name)) return;
      result.push({ className: name, filePath: tryGetFilePathFromCtor(token), source: 'injector' });
      knownNames.add(name);
    });

    // Scan useClass entries
    records.forEach((record: any) => {
      try {
        const factory = record?.value ?? record?.factory;
        if (factory?.useClass && typeof factory.useClass === 'function') {
          const name = factory.useClass.name ?? '';
          if (name && !knownNames.has(name)) {
            result.push({ className: name, filePath: tryGetFilePathFromCtor(factory.useClass), source: 'use-class' });
            knownNames.add(name);
          }
        }
      } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
  return result;
}


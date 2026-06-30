// src/types/app-structure.ts

// ─── Core Angular Entities ────────────────────────────────────────────────────

export interface ComponentRegistryEntry {
  selector: string;
  className: string;
  filePath: string | null;
  changeDetection: 'OnPush' | 'Default';
  inputs: string[];
  outputs: string[];
  standalone: boolean;
  /** Signal-based inputs declared with input() or input.required() (Angular 17+) */
  signalInputs: string[];
  /** Two-way signal bindings declared with model() (Angular 17.1+) */
  modelInputs: string[];
}

export interface DirectiveRegistryEntry {
  selector: string;
  className: string;
  filePath: string | null;
  inputs: string[];
  outputs: string[];
  standalone: boolean;
}

export interface PipeRegistryEntry {
  name: string;
  className: string;
  filePath: string | null;
  pure: boolean;
  standalone: boolean;
}

export type ServiceRole = 'service' | 'guard' | 'interceptor' | 'resolver';

export interface ServiceRegistryEntry {
  className: string;
  filePath: string | null;
  providedIn: string;
  roles: ServiceRole[];
}

export interface ModuleRegistryEntry {
  className: string;
  filePath: string | null;
  declarations: string[];
  imports: string[];
  exports: string[];
  providers: string[];
}

// ─── Routing ─────────────────────────────────────────────────────────────────

export type RoutingStrategy = 'hash' | 'path' | 'unknown';

export interface RouterInfo {
  /** HTML5 History API (PathLocationStrategy) or hash-based (HashLocationStrategy) */
  strategy: RoutingStrategy;
  /** The <base href> value */
  baseHref: string | null;
  /** Total flat route count (all levels) */
  totalRoutes: number;
  /** Whether any route uses loadComponent / loadChildren */
  hasLazyRoutes: boolean;
}

export interface RouteRegistryEntry {
  path: string;
  /** Full path from root, e.g. "/dashboard" or "/theme/colors" */
  absolutePath: string;
  component: string | null;
  redirectTo: string | null;
  guards: string[];
  resolvers: string[];
  children: RouteRegistryEntry[];
  isLazy: boolean;
  /** Route title from route.title or route.data.title */
  title: string | null;
  /** True when lazy children (loadChildren) have already been fetched */
  loadedChildren: boolean;
}

/** One entry in the currently active route tree (from router.routerState.snapshot) */
export interface ActiveRouteEntry {
  absolutePath: string;
  component: string;
  outlet: string;
}

export type GuardType = 'CanActivate' | 'CanDeactivate' | 'CanMatch' | 'CanLoad';

export interface GuardRegistryEntry {
  className: string;
  filePath: string | null;
  guardTypes: GuardType[];
  functional: boolean;
  routes: string[];
}

export interface InterceptorRegistryEntry {
  className: string;
  filePath: string | null;
  functional: boolean;
  order: number;
}

export interface ResolverRegistryEntry {
  className: string;
  filePath: string | null;
  functional: boolean;
  routes: string[];
}

// ─── State Management ─────────────────────────────────────────────────────────

export interface SignalStateEntry {
  className: string;
  entityType: 'component' | 'service';
  writableSignals: string[];
  computedSignals: string[];
  /** Angular effect() refs stored as instance properties */
  effects: string[];
}

export interface ObservableStateEntry {
  className: string;
  entityType: 'component' | 'service';
  subjects: string[];
  observables: string[];
}

export type NgrxStoreType = 'store' | 'component-store' | 'signal-store' | 'actions' | 'effects';

export interface NgrxEntry {
  className: string;
  filePath: string | null;
  storeType: NgrxStoreType;
  features: string[];
}

export interface StateManagementData {
  signalState: SignalStateEntry[];
  observableState: ObservableStateEntry[];
  ngrx: NgrxEntry[];
}

// ─── Injection Tokens ─────────────────────────────────────────────────────────

export interface TokenRegistryEntry {
  name: string;
  multi: boolean;
  filePath: string | null;
}

// ─── Application & Infrastructure ─────────────────────────────────────────────

export interface ApplicationInfo {
  rootSelector: string | null;
  rootComponent: string | null;
  platform: 'browser' | 'server' | 'web-worker' | 'unknown';
  /** 'development' when ngDevMode is truthy, 'production' otherwise, 'unknown' if not detectable */
  mode: 'development' | 'production' | 'unknown';
}

export interface ServiceWorkerInfo {
  registered: boolean;
  scriptUrl: string | null;
  scope: string | null;
  state: string | null;
  hasNgsw: boolean;
  hasAppShell: boolean;
}

export interface LibraryEntry {
  name: string;
  packageName: string;
}

/** Plain TypeScript class found in Angular's DI context without Angular-specific metadata */
export interface PlainClassEntry {
  className: string;
  filePath: string | null;
  source: 'provider' | 'use-class' | 'injector';
}

export interface EnvironmentEntry {
  key: string;
  /** JSON-truncated value preview */
  value: string;
}

// ─── Bootstrap / App Config (ng generate config / ApplicationConfig) ───────────

export type ConfigFeatureType =
  | 'router' | 'http' | 'forms' | 'animations'
  | 'hydration' | 'initializer' | 'service-worker'
  | 'change-detection' | 'custom';

/** One detected feature registered via bootstrapApplication() / ApplicationConfig */
export interface BootstrapConfigFeature {
  name: string;
  featureType: ConfigFeatureType;
  /** For multi-providers (e.g. APP_INITIALIZER), how many hooks are registered */
  count?: number;
}

/**
 * Represents Angular's ApplicationConfig / app.config.ts.
 * Generated by `ng generate config`.
 */
export interface BootstrapConfig {
  /** Whether the app uses the standalone API (bootstrapApplication) or NgModule (bootstrapModule) */
  bootstrapType: 'standalone' | 'module-based' | 'unknown';
  /** Value of the APP_ID token, if detectable */
  appId: string | null;
  /** Detected functional providers / features registered at bootstrap */
  features: BootstrapConfigFeature[];
  /** Zone.js presence: 'zone.js' if Zone global is loaded, 'zoneless' if absent */
  zone: 'zone.js' | 'zoneless' | 'unknown';
  /** Whether a custom ErrorHandler is registered (overrides Angular's default NgZoneChangeDetectionScheduler) */
  errorHandlerCustom: boolean;
  /** Whether Angular debug APIs (ng.getComponent, debugInfo, etc.) are available — true in development builds */
  debugInfoEnabled: boolean;
}

// ─── App Config / Environment Providers ─────────────────────────────────────

export type AppProviderCategory =
  | 'app' | 'router' | 'http' | 'forms' | 'animations'
  | 'security' | 'i18n' | 'core' | 'other';

export interface AppProviderEntry {
  name: string;
  /** 'class' = class constructor, 'token' = InjectionToken, 'multi' = multi-provider token */
  kind: 'class' | 'token' | 'multi';
  /** Detected Angular feature / domain category */
  category: AppProviderCategory;
}

// ─── Performance Detections (18 anti-patterns) ────────────────────────────────

/** #1 — Pipe with pure: false; re-executes on every change detection cycle */
export interface ImpurePipeEntry {
  name: string;
  className: string;
  filePath: string | null;
}

/**
 * #2 + #15 — @HostListener (or host binding) on a high-frequency DOM event
 * (scroll, mousemove, resize, wheel …) without debounce/throttle.
 * Covers both @HostListener decorators and programmatic Zone.js task sources.
 */
export interface HostListenerIssue {
  className: string;
  filePath: string | null;
  entityType: 'component' | 'directive';
  /** Detected high-frequency events e.g. ['scroll', 'resize'] */
  events: string[];
  /** Heuristic: method body contains debounce / throttle / Subject / auditTime */
  hasDebounce: boolean;
}

/** #3 — *ngFor / @for rendering a large collection without CDK virtual scrolling */
export interface LargeListDetection {
  componentName: string;
  selector: string;
  estimatedItemCount: number;
  /** True when a <cdk-virtual-scroll-viewport> exists anywhere on the page */
  hasVirtualScroll: boolean;
}

/** #4 — ngDoCheck / ngAfterViewChecked / ngAfterContentChecked with non-trivial body */
export interface HeavyLifecycleHookEntry {
  className: string;
  filePath: string | null;
  hooks: Array<{ name: string; bodyLength: number }>;
}

/** #5 — Same service class provided at two or more injector levels (accidental duplication) */
export interface DuplicateServiceEntry {
  className: string;
  /** Number of injector levels the token appears at */
  injectorLevels: number;
  filePath: string | null;
}

/** #6 — Route with a real component assigned (not lazy) that could be lazy-loaded */
export interface EagerLoadedRouteEntry {
  path: string;
  absolutePath: string;
  component: string;
  /** Total flat descendant route count */
  childRouteCount: number;
}

/** #7 — ChangeDetectorRef.detectChanges() or markForCheck() called inside lifecycle hooks */
export interface CdRefAbuseEntry {
  className: string;
  filePath: string | null;
  method: 'detectChanges' | 'markForCheck';
  /** Lifecycle hook names where the call was detected */
  inHooks: string[];
}

/** #8 — OnPush child component whose direct parent uses Default CD strategy */
export interface CdStrategyMismatchEntry {
  childClassName: string;
  childSelector: string;
  parentClassName: string;
  parentSelector: string;
}

/** #9 — OnPush component with non-primitive @Input() that may be mutated in place */
export interface OnPushInputMutationRisk {
  className: string;
  filePath: string | null;
  selector: string;
  /** Traditional (non-signal) inputs whose names suggest an object or array */
  objectInputs: string[];
}

/** #10 — Large component subtree that could benefit from @defer (Angular 17+) */
export interface DeferOpportunityEntry {
  className: string;
  selector: string;
  filePath: string | null;
  subtreeNodeCount: number;
  reason: string;
}

/** #11 — Zoneless change detection migration readiness */
export interface ZonelessReadinessEntry {
  isZoneless: boolean;
  /** Percentage (0–100) of user components that already use Signals */
  signalCoverage: number;
  totalComponents: number;
  signalComponents: number;
  migrationReadiness: 'ready' | 'partial' | 'not-ready';
}

/** #12 — ExpressionChangedAfterItHasBeenCheckedError captured at runtime */
export interface ExpressionChangedErrorEntry {
  count: number;
  /** Component names extracted from Angular error messages */
  components: string[];
  /** Whether the console.error interceptor is currently active */
  intercepting: boolean;
}

/** #13 — Component that mixes ReactiveFormsModule and template-driven NgModel in one view */
export interface FormsMixingEntry {
  className: string;
  filePath: string | null;
  selector: string;
  usesReactiveForms: boolean;
  usesTemplateForms: boolean;
}

/** #14 — Component with @ViewChildren / @ContentChildren QueryList properties */
export interface QueryListOveruseEntry {
  className: string;
  filePath: string | null;
  queryListProperties: string[];
}

/** #16 — Standalone component importing full NgModules instead of individual components */
export interface ImportBloatEntry {
  className: string;
  filePath: string | null;
  selector: string;
  /** NgModule class names imported (should be individual standalone components instead) */
  moduleImports: string[];
}

/** #17 — Angular animation trigger animating layout-causing CSS properties */
export interface AnimationIssueEntry {
  className: string;
  filePath: string | null;
  selector: string;
  /** e.g. ['width', 'height', 'margin'] */
  layoutTriggeringProps: string[];
  triggerNames: string[];
}

/** #18 — APP_INITIALIZER registration summary */
export interface AppInitializerInfoEntry {
  count: number;
  /** Function names extracted from registered initializers */
  names: string[];
  /** True when any initializer returns a Promise or Observable */
  hasAsyncInitializers: boolean;
}

/** Aggregate of all 18 performance detection results */
export interface PerformanceDetections {
  impurePipes: ImpurePipeEntry[];                           // #1
  hostListenerIssues: HostListenerIssue[];                  // #2 + #15 (combined)
  largeListDetections: LargeListDetection[];                // #3
  heavyLifecycleHooks: HeavyLifecycleHookEntry[];           // #4
  duplicateServices: DuplicateServiceEntry[];               // #5
  eagerLoadedRoutes: EagerLoadedRouteEntry[];               // #6
  cdRefAbuse: CdRefAbuseEntry[];                           // #7
  cdStrategyMismatches: CdStrategyMismatchEntry[];          // #8
  onPushInputMutationRisks: OnPushInputMutationRisk[];      // #9
  deferOpportunities: DeferOpportunityEntry[];              // #10
  zonelessReadiness: ZonelessReadinessEntry;                // #11
  expressionChangedErrors: ExpressionChangedErrorEntry;     // #12
  formsMixing: FormsMixingEntry[];                          // #13
  queryListOveruse: QueryListOveruseEntry[];                // #14
  importBloat: ImportBloatEntry[];                          // #16
  animationIssues: AnimationIssueEntry[];                   // #17
  appInitializerInfo: AppInitializerInfoEntry;              // #18
}

// ─── Root Data Object ─────────────────────────────────────────────────────────

export interface AppStructureData {
  application: ApplicationInfo;
  bootstrapConfig: BootstrapConfig;
  components: ComponentRegistryEntry[];
  directives: DirectiveRegistryEntry[];
  pipes: PipeRegistryEntry[];
  services: ServiceRegistryEntry[];
  guards: GuardRegistryEntry[];
  interceptors: InterceptorRegistryEntry[];
  resolvers: ResolverRegistryEntry[];
  modules: ModuleRegistryEntry[];
  routes: RouteRegistryEntry[];
  /** Live snapshot of which components are rendered for each active route */
  activeRoutes: ActiveRouteEntry[];
  stateManagement: StateManagementData;
  tokens: TokenRegistryEntry[];
  /** All providers registered in the root environment injector (from app.config.ts) */
  appProviders: AppProviderEntry[];
  libraries: LibraryEntry[];
  plainClasses: PlainClassEntry[];
  environments: EnvironmentEntry[];
  serviceWorker: ServiceWorkerInfo | null;
  routerInfo: RouterInfo | null;
  /** Quick breakdown of change detection strategies across all components */
  changeDetectionSummary: { onPush: number; default: number; total: number };
  /** All 18 performance anti-pattern detections */
  performanceDetections: PerformanceDetections;
  collectedAt: number;
  angularVersion: string | null;
}

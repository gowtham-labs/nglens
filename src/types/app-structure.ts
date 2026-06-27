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
  component: string | null;
  redirectTo: string | null;
  guards: string[];
  resolvers: string[];
  children: RouteRegistryEntry[];
  isLazy: boolean;
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
  collectedAt: number;
  angularVersion: string | null;
}

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
  AppStructureData,
  ComponentRegistryEntry,
  DirectiveRegistryEntry,
  ModuleRegistryEntry,
  ObservableStateEntry,
  PipeRegistryEntry,
  ServiceRegistryEntry,
  SignalStateEntry,
} from '../../types/app-structure';
import { MAX_SCAN_ELEMENTS } from './constants';
import { _classNameToSource } from './utils';
import { processConstructor, tryLViewScan, enrichServiceRoles } from './ivy-metadata';
import { scanInstanceState } from './state-scanner';
import {
  tryGetInjector,
  detectNgrx,
  collectInjectionTokens,
  collectInterceptors,
  collectAppProviders,
  scanInjectorServices,
} from './injector';
import {
  findRouter,
  parseRouteConfig,
  extractGuardsAndResolvers,
  collectActiveRoutes,
  buildRouterInfo,
} from './router-collector';
import {
  detectApplicationInfo,
  detectServiceWorker,
  detectLibraries,
  detectEnvironments,
  detectPlainClasses,
  detectBootstrapConfig,
} from './infrastructure';
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
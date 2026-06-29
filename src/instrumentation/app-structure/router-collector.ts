import type {
  ActiveRouteEntry,
  GuardRegistryEntry,
  GuardType,
  ResolverRegistryEntry,
  RouteRegistryEntry,
  RouterInfo,
  RoutingStrategy,
} from '../../types/app-structure';
import { tryGetFilePathFromCtor } from './utils';
import { getInjectorMap, getInjectorRecords } from './injector';

// ─── Route Analysis ───────────────────────────────────────────────────────────

export function findRouter(injector: any): any {
  // Strategy 0: ng.ɵgetRouterInstance — published by provideRouter() in dev mode (Angular 16+).
  // This is the official Angular DevTools API: calls nodeInjector.get(Router) which walks
  // the full injector tree (node + environment) and resolves the Router reliably.
  try {
    const ng0 = (globalThis as any).ng;
    if (typeof ng0?.ɵgetRouterInstance === 'function') {
      const rootEl0 = document.querySelector('[ng-version]');
      if (rootEl0 && typeof ng0.getInjector === 'function') {
        const nodeInj0 = ng0.getInjector(rootEl0);
        const router0 = ng0.ɵgetRouterInstance(nodeInj0);
        if (router0 && typeof router0.navigate === 'function') return router0;
      }
    }
  } catch { /* ignore */ }

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

export function parseRouteConfig(config: any[], parentPath = ''): RouteRegistryEntry[] {
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
export function collectActiveRoutes(router: any): ActiveRouteEntry[] {
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

export function buildRouterInfo(
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

export function extractGuardsAndResolvers(config: any[]): {
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

// ─── Private helpers ──────────────────────────────────────────────────────────

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

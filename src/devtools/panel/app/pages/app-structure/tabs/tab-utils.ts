import type { BootstrapConfigFeature, RouteRegistryEntry } from '../../../../../../types/app-structure';
import type { FlatRoute } from '../app-structure.types';

export function isExternalPkg(path: string | null): boolean {
  if (!path) return false;
  if (path.includes('node_modules/')) return true;
  return !path.startsWith('/') && !path.startsWith('./') &&
         !path.includes('.ts') && !path.includes('.js') && !path.includes('.mjs');
}

export function shortPath(path: string | null): string {
  if (!path) return '—';
  const nmIdx = path.indexOf('node_modules/');
  if (nmIdx !== -1) {
    const after = path.slice(nmIdx + 13);
    const parts = after.split('/');
    return parts[0].startsWith('@') && parts.length >= 2
      ? `${parts[0]}/${parts[1]}`
      : parts[0];
  }
  if (path.startsWith('@') || !path.includes('/')) return path;
  return path.split('/').slice(-2).join('/');
}

export function configFeatureClass(f: BootstrapConfigFeature): string {
  const map: Record<string, string> = {
    router:             'tag-cfg-router',
    http:               'tag-cfg-http',
    forms:              'tag-cfg-forms',
    animations:         'tag-cfg-anim',
    initializer:        'tag-cfg-init',
    'service-worker':   'tag-cfg-sw',
    hydration:          'tag-cfg-hydra',
    'change-detection': 'tag-cfg-cd',
    custom:             'tag-cfg-custom',
  };
  return `badge ${map[f.featureType] ?? 'tag-cfg-custom'}`;
}

export function filterRoutes(routes: RouteRegistryEntry[], q: string): RouteRegistryEntry[] {
  return routes.filter(r =>
    r.path.includes(q) ||
    (r.component ?? '').toLowerCase().includes(q) ||
    r.guards.some(g => g.toLowerCase().includes(q)) ||
    filterRoutes(r.children, q).length > 0
  );
}

export function flattenRoutes(
  routes: RouteRegistryEntry[],
  depth: number,
  prefix: string,
  activePaths: Set<string> = new Set(),
): FlatRoute[] {
  const result: FlatRoute[] = [];
  for (const r of routes) {
    const absPath = r.absolutePath
      ?? (r.path === '**' ? `${prefix}/**` : `${prefix}/${r.path}`.replace(/\/+/g, '/') || '/');
    result.push({
      key: absPath,
      path: r.path,
      absolutePath: absPath,
      component: r.component,
      redirectTo: r.redirectTo,
      guards: r.guards,
      resolvers: r.resolvers,
      depth,
      isLazy: r.isLazy,
      title: r.title ?? null,
      loadedChildren: r.loadedChildren ?? false,
      isActive: activePaths.has(absPath),
    });
    result.push(...flattenRoutes(r.children, depth + 1, absPath, activePaths));
  }
  return result;
}

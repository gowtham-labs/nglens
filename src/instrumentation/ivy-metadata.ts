import type {
  ComponentRegistryEntry,
  DirectiveRegistryEntry,
  GuardRegistryEntry,
  InterceptorRegistryEntry,
  ModuleRegistryEntry,
  ObservableStateEntry,
  PipeRegistryEntry,
  ResolverRegistryEntry,
  ServiceRegistryEntry,
  ServiceRole,
  SignalStateEntry,
} from '../types/app-structure';
import {
  _classNameToSource,
  detectModuleSource,
  extractPackageFromPath,
  extractSelector,
  getCtorName,
  matchKnownLibrary,
  resolveFnOrArray,
  resolveProviderName,
  tryGetFilePath,
  tryGetFilePathFromCtor,
} from './utils';
import { scanInstanceState } from './state-scanner';

// ─── Constructor / Metadata Processing ───────────────────────────────────────

export function processConstructor(
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

export function tryLViewScan(
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

// ─── Service Role Enrichment ──────────────────────────────────────────────────

export function enrichServiceRoles(
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

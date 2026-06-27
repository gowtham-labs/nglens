import type {
  ApplicationInfo,
  BootstrapConfig,
  BootstrapConfigFeature,
  ComponentRegistryEntry,
  EnvironmentEntry,
  LibraryEntry,
  ModuleRegistryEntry,
  PlainClassEntry,
  ServiceRegistryEntry,
  ServiceWorkerInfo,
  TokenRegistryEntry,
} from '../types/app-structure';
import { tryGetFilePathFromCtor } from './utils';
import { getInjectorMap, getInjectorRecords } from './injector';

// ─── Phase 5 Helpers: Infrastructure ─────────────────────────────────────────

export function detectApplicationInfo(ng: any, rootEl: Element | null): ApplicationInfo {
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

export function detectServiceWorker(): ServiceWorkerInfo | null {
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
export function detectBootstrapConfig(
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

export function detectLibraries(
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

export function detectEnvironments(): EnvironmentEntry[] {
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

export function detectPlainClasses(
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

import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import { CommandService } from '../../services/command.service';
import type {
  AppProviderEntry,
  BootstrapConfig,
  BootstrapConfigFeature,
  ComponentRegistryEntry,
  DirectiveRegistryEntry,
  EnvironmentEntry,
  GuardRegistryEntry,
  InterceptorRegistryEntry,
  LibraryEntry,
  ModuleRegistryEntry,
  NgrxEntry,
  ObservableStateEntry,
  PipeRegistryEntry,
  PlainClassEntry,
  ResolverRegistryEntry,
  RouteRegistryEntry,
  RouterInfo,
  ServiceRegistryEntry,
  SignalStateEntry,
  TokenRegistryEntry,
} from '../../../../../types/app-structure';

type RegistryTab =
  | 'app' | 'components' | 'directives' | 'pipes'
  | 'services' | 'modules' | 'routes'
  | 'state' | 'guards' | 'classes' | 'tokens' | 'app-config';

interface FlatRoute {
  key: string;
  path: string;
  component: string | null;
  redirectTo: string | null;
  guards: string[];
  resolvers: string[];
  depth: number;
  isLazy: boolean;
}

@Component({
  selector: 'app-app-structure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, DecimalPipe],
  styles: [`
    .badge { @apply inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium; }
    .tag-onpush    { @apply badge bg-green-900/50 text-green-300 border border-green-700/50; }
    .tag-default   { @apply badge bg-gray-700 text-gray-300 border border-gray-600; }
    .tag-standalone{ @apply badge bg-blue-900/50 text-blue-300 border border-blue-700/50; }
    .tag-module    { @apply badge bg-purple-900/50 text-purple-300 border border-purple-700/50; }
    .tag-pure      { @apply badge bg-teal-900/50 text-teal-300 border border-teal-700/50; }
    .tag-impure    { @apply badge bg-orange-900/50 text-orange-300 border border-orange-700/50; }
    .tag-guard     { @apply badge bg-amber-900/50 text-amber-300 border border-amber-700/50; }
    .tag-iceptor   { @apply badge bg-pink-900/50 text-pink-300 border border-pink-700/50; }
    .tag-resolver  { @apply badge bg-sky-900/50 text-sky-300 border border-sky-700/50; }
    .tag-dev       { @apply badge bg-yellow-900/50 text-yellow-300 border border-yellow-700/50; }
    .tag-prod      { @apply badge bg-green-900/50 text-green-300 border border-green-700/50; }
    .tag-sw-on     { @apply badge bg-emerald-900/50 text-emerald-300 border border-emerald-700/50; }
    .tag-lazy    { @apply badge bg-violet-900/50 text-violet-300 border border-violet-700/50; }
    .pkg-badge   { @apply badge bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 font-mono; }
    .src-path    { @apply text-gray-500 text-[10px] font-mono truncate; }
    .tag-cfg-router   { @apply badge bg-blue-900/50 text-blue-300 border border-blue-700/50; }
    .tag-cfg-http     { @apply badge bg-cyan-900/50 text-cyan-300 border border-cyan-700/50; }
    .tag-cfg-forms    { @apply badge bg-lime-900/50 text-lime-300 border border-lime-700/50; }
    .tag-cfg-anim     { @apply badge bg-fuchsia-900/50 text-fuchsia-300 border border-fuchsia-700/50; }
    .tag-cfg-init     { @apply badge bg-amber-900/50 text-amber-300 border border-amber-700/50; }
    .tag-cfg-sw       { @apply badge bg-emerald-900/50 text-emerald-300 border border-emerald-700/50; }
    .tag-cfg-hydra    { @apply badge bg-sky-900/50 text-sky-300 border border-sky-700/50; }
    .tag-cfg-cd       { @apply badge bg-rose-900/50 text-rose-300 border border-rose-700/50; }
    .tag-cfg-custom   { @apply badge bg-gray-700 text-gray-300 border border-gray-600; }
    .row { @apply flex items-start gap-2 px-3 py-2 border-b border-gray-800 hover:bg-gray-800/50 text-xs; }
    .cell-primary { @apply font-mono text-gray-100 min-w-0; }
    .cell-dim  { @apply text-gray-500 text-[10px]; }
    .chips { @apply flex flex-wrap gap-1; }
    .chip  { @apply px-1 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300 font-mono; }
    .chip-signal   { @apply px-1 py-0.5 bg-indigo-900/50 rounded text-[10px] text-indigo-300 font-mono border border-indigo-700/30; }
    .chip-computed { @apply px-1 py-0.5 bg-violet-900/50 rounded text-[10px] text-violet-300 font-mono border border-violet-700/30; }
    .chip-subject  { @apply px-1 py-0.5 bg-red-900/50 rounded text-[10px] text-red-300 font-mono border border-red-700/30; }
    .chip-obs      { @apply px-1 py-0.5 bg-orange-900/50 rounded text-[10px] text-orange-300 font-mono border border-orange-700/30; }
    .route-path  { @apply font-mono text-blue-300; }
    .col-hdr { @apply text-[10px] text-gray-500 uppercase tracking-wide flex-shrink-0; }
    .section-title { @apply text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 py-1.5 bg-gray-800/60 border-b border-gray-700; }
    .info-card { @apply px-3 py-2.5 border-b border-gray-800; }
    .info-label { @apply text-[10px] text-gray-500 uppercase tracking-wide; }
    .info-value { @apply text-xs text-gray-200 font-mono mt-0.5; }
    .note-box { @apply flex items-start gap-2 mx-3 my-2 px-3 py-2.5 bg-gray-800/60 border border-gray-700 rounded text-xs text-gray-400; }
  `],
  template: `
    <div class="h-full flex flex-col overflow-hidden">

      <!-- ── Header ── -->
      <div class="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
        <div class="flex-1">
          <h2 class="text-sm font-semibold text-gray-100">App Map</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            Components · Directives · Pipes · Services · Guards · State · Classes · Tokens · App Config · Routes
          </p>
        </div>
        @if (data()) {
          <span class="text-[10px] text-gray-500">
            {{ formatTime(data()!.collectedAt) }}
            @if (data()!.angularVersion) { · v{{ data()!.angularVersion }} }
          </span>
        }
        <button
          (click)="scan()"
          [disabled]="scanning()"
          class="px-3 py-1.5 text-xs rounded border transition-colors"
          [ngClass]="scanning()
            ? 'border-gray-600 text-gray-500 cursor-not-allowed'
            : 'border-indigo-500 text-indigo-400 hover:bg-indigo-500/10'">
          {{ scanning() ? 'Scanning…' : data() ? 'Re-scan' : 'Scan App' }}
        </button>
      </div>

      <!-- ── Empty / Loading ── -->
      @if (!data() && !scanning()) {
        <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div class="text-4xl opacity-30">🔭</div>
          <div>
            <p class="text-sm font-medium text-gray-300">No registry data yet</p>
            <p class="text-xs text-gray-500 mt-1">
              Click <strong class="text-gray-300">Scan App</strong> to collect the full Angular registry from the inspected page.
            </p>
          </div>
        </div>
      } @else if (scanning()) {
        <div class="flex-1 flex items-center justify-center gap-2 text-gray-400 text-sm">
          <span class="animate-spin">⟳</span> Collecting Angular registry…
        </div>
      } @else {

        <!-- ── Tab bar ── -->
        <div class="flex-shrink-0 flex gap-0 border-b border-gray-800 bg-gray-900/50 overflow-x-auto">
          @for (tab of tabs; track tab.id) {
            <button
              class="flex items-center gap-1.5 px-3 py-2 whitespace-nowrap text-xs border-b-2 -mb-px transition-colors"
              [ngClass]="activeTab() === tab.id
                ? 'border-indigo-500 text-white bg-gray-800/30'
                : 'border-transparent text-gray-400 hover:text-gray-200'"
              (click)="activeTab.set(tab.id)">
              <span>{{ tab.icon }}</span>
              {{ tab.label }}
              @if (tab.count() > 0) {
                <span class="px-1 py-0.5 rounded-full text-[10px]"
                  [ngClass]="activeTab() === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'">
                  {{ tab.count() }}
                </span>
              }
            </button>
          }
        </div>

        <!-- ── Search ── -->
        <div class="flex-shrink-0 px-3 py-2 border-b border-gray-800">
          <input type="search" placeholder="Filter…"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
        </div>

        <!-- ── Tab content ── -->
        <div class="flex-1 overflow-auto">

          <!-- ╔══ APP INFO ══╗ -->
          @if (activeTab() === 'app') {
            <div>

              <!-- ── At-a-glance summary strip ── -->
              <div class="px-3 py-3 bg-gray-800/60 border-b border-gray-700">
                <!-- Row 1: Angular version + bootstrap type + zone + build mode -->
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  @if (data()!.angularVersion) {
                    <span class="badge bg-red-900/50 text-red-300 border border-red-700/50 font-mono">Angular v{{ data()!.angularVersion }}</span>
                  }
                  @if (data()!.bootstrapConfig.bootstrapType === 'standalone') {
                    <span class="tag-standalone">Standalone</span>
                  } @else if (data()!.bootstrapConfig.bootstrapType === 'module-based') {
                    <span class="tag-module">NgModule</span>
                  }
                  @if (data()!.bootstrapConfig.zone === 'zone.js') {
                    <span class="badge bg-amber-900/50 text-amber-300 border border-amber-700/50">zone.js</span>
                  } @else if (data()!.bootstrapConfig.zone === 'zoneless') {
                    <span class="badge bg-violet-900/50 text-violet-300 border border-violet-700/50">zoneless</span>
                  }
                  @if (data()!.application.mode === 'development') { <span class="tag-dev">dev</span> }
                  @else if (data()!.application.mode === 'production') { <span class="tag-prod">prod</span> }
                  @if (data()!.bootstrapConfig.debugInfoEnabled) {
                    <span class="badge bg-gray-700 text-gray-400 border border-gray-600">debug info ✓</span>
                  }
                  @if (data()!.bootstrapConfig.errorHandlerCustom) {
                    <span class="badge bg-pink-900/50 text-pink-300 border border-pink-700/50">custom ErrorHandler</span>
                  }
                </div>
              </div>

              <!-- Routing block -->
              <div class="section-title">Routing</div>
              @if (data()!.routerInfo) {
                <div class="grid grid-cols-2 gap-0">
                  <div class="info-card">
                    <div class="info-label">Strategy</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      @if (data()!.routerInfo!.strategy === 'path') {
                        <span class="tag-prod">HTML5 History</span>
                        <span class="cell-dim">(PathLocationStrategy)</span>
                      } @else if (data()!.routerInfo!.strategy === 'hash') {
                        <span class="tag-impure">Hash-based</span>
                        <span class="cell-dim">(HashLocationStrategy)</span>
                      } @else {
                        <span class="cell-dim">unknown</span>
                      }
                    </div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Base Href</div>
                    <div class="info-value">{{ data()!.routerInfo!.baseHref ?? '—' }}</div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Total Routes</div>
                    <div class="info-value">{{ data()!.routerInfo!.totalRoutes }}</div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">Lazy Routes</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      @if (data()!.routerInfo!.hasLazyRoutes) {
                        <span class="tag-lazy">yes — lazy loading active</span>
                      } @else {
                        <span class="cell-dim">none detected</span>
                      }
                    </div>
                  </div>
                </div>
              } @else {
                <div class="note-box">
                  <span>ℹ</span><span>No Angular Router detected on this page.</span>
                </div>
              }

              <!-- Config block (ng generate config / ApplicationConfig) -->
              <div class="section-title flex items-center justify-between">
                <span>Config  <span class="normal-case font-normal ml-1 text-gray-500">— ApplicationConfig / app.config.ts</span></span>
                @if (data()!.bootstrapConfig.features.length) {
                  <span class="badge bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 mr-1">
                    {{ data()!.bootstrapConfig.features.length }} provider{{ data()!.bootstrapConfig.features.length !== 1 ? 's' : '' }}
                  </span>
                }
              </div>
              <div class="grid grid-cols-2 gap-0">
                <div class="info-card">
                  <div class="info-label">Bootstrap Type</div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    @if (data()!.bootstrapConfig.bootstrapType === 'standalone') {
                      <span class="tag-standalone">Standalone API</span>
                      <span class="cell-dim">bootstrapApplication()</span>
                    } @else if (data()!.bootstrapConfig.bootstrapType === 'module-based') {
                      <span class="tag-module">NgModule-based</span>
                      <span class="cell-dim">bootstrapModule()</span>
                    } @else {
                      <span class="cell-dim">unknown</span>
                    }
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">Zone Mode</div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    @if (data()!.bootstrapConfig.zone === 'zone.js') {
                      <span class="badge bg-amber-900/50 text-amber-300 border border-amber-700/50">zone.js</span>
                    } @else if (data()!.bootstrapConfig.zone === 'zoneless') {
                      <span class="badge bg-violet-900/50 text-violet-300 border border-violet-700/50">zoneless</span>
                    } @else {
                      <span class="cell-dim">unknown</span>
                    }
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">Debug Info</div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    @if (data()!.bootstrapConfig.debugInfoEnabled) {
                      <span class="tag-dev">enabled</span>
                      <span class="cell-dim">ng.getComponent available</span>
                    } @else {
                      <span class="tag-prod">disabled</span>
                      <span class="cell-dim">production build</span>
                    }
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">Error Handler</div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    @if (data()!.bootstrapConfig.errorHandlerCustom) {
                      <span class="badge bg-pink-900/50 text-pink-300 border border-pink-700/50">custom</span>
                    } @else {
                      <span class="badge bg-gray-700 text-gray-400 border border-gray-600">default</span>
                    }
                  </div>
                </div>
                @if (data()!.bootstrapConfig.appId) {
                  <div class="info-card col-span-2">
                    <div class="info-label">APP_ID</div>
                    <div class="info-value font-mono">{{ data()!.bootstrapConfig.appId }}</div>
                  </div>
                }
              </div>
              <!-- Providers / Features grid -->
              @if (data()!.bootstrapConfig.features.length) {
                <div class="px-3 py-2.5 border-b border-gray-800">
                  <div class="info-label mb-2">Detected Providers</div>
                  <div class="grid grid-cols-2 gap-1.5">
                    @for (f of data()!.bootstrapConfig.features; track f.name) {
                      <div class="flex items-center justify-between px-2.5 py-1.5 bg-gray-800 rounded border border-gray-700/60">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span [class]="configFeatureClass(f)" class="flex-shrink-0">{{ f.featureType }}</span>
                          <span class="text-[11px] text-gray-200 font-mono truncate">{{ f.name }}</span>
                        </div>
                        @if (f.count != null && f.count > 0) {
                          <span class="badge bg-gray-700 text-gray-400 border border-gray-600 ml-1 flex-shrink-0">×{{ f.count }}</span>
                        }
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="note-box">
                  <span>ℹ</span>
                  <span>No bootstrap providers detected. Ensure the app is fully initialised before scanning.</span>
                </div>
              }

              <!-- Application block -->
              <div class="section-title">Application</div>
              <div class="grid grid-cols-2 gap-0">
                @if (data()!.application.rootSelector) {
                  <div class="info-card">
                    <div class="info-label">Root Selector</div>
                    <div class="info-value">&lt;{{ data()!.application.rootSelector }}&gt;</div>
                  </div>
                }
                @if (data()!.application.rootComponent) {
                  <div class="info-card">
                    <div class="info-label">Root Component</div>
                    <div class="info-value">{{ data()!.application.rootComponent }}</div>
                  </div>
                }
                <div class="info-card">
                  <div class="info-label">Angular Version</div>
                  <div class="info-value">{{ data()!.angularVersion ?? 'unknown' }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Platform</div>
                  <div class="info-value">{{ data()!.application.platform }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Build Mode</div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    @if (data()!.application.mode === 'development') { <span class="tag-dev">development</span> }
                    @else if (data()!.application.mode === 'production') { <span class="tag-prod">production</span> }
                    @else { <span class="cell-dim">unknown</span> }
                  </div>
                </div>
              </div>

              <!-- Service Worker & App Shell block -->
              <div class="section-title">Service Worker &amp; App Shell</div>
              @if (data()!.serviceWorker !== null) {
                <div class="grid grid-cols-2 gap-0">
                  <div class="info-card">
                    <div class="info-label">Status</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      @if (data()!.serviceWorker!.registered) {
                        <span class="tag-sw-on">registered</span>
                      } @else {
                        <span class="tag-sw-off">not registered</span>
                      }
                    </div>
                  </div>
                  @if (data()!.serviceWorker!.state) {
                    <div class="info-card">
                      <div class="info-label">SW State</div>
                      <div class="info-value">{{ data()!.serviceWorker!.state }}</div>
                    </div>
                  }
                  @if (data()!.serviceWorker!.scriptUrl) {
                    <div class="info-card col-span-2">
                      <div class="info-label">Script URL</div>
                      <div class="info-value truncate" [title]="data()!.serviceWorker!.scriptUrl!">
                        {{ data()!.serviceWorker!.scriptUrl }}
                      </div>
                    </div>
                  }
                  <div class="info-card">
                    <div class="info-label">@angular/service-worker (ngsw)</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      @if (data()!.serviceWorker!.hasNgsw) {
                        <span class="tag-sw-on">detected</span>
                      } @else {
                        <span class="tag-sw-off">not detected</span>
                      }
                    </div>
                  </div>
                  <div class="info-card">
                    <div class="info-label">App Shell</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      @if (data()!.serviceWorker!.hasAppShell) {
                        <span class="tag-sw-on">detected</span>
                      } @else {
                        <span class="tag-sw-off">not detected</span>
                      }
                    </div>
                  </div>
                </div>
              } @else {
                <div class="note-box">
                  <span>ℹ</span>
                  <span>Service Worker API not available in this context.</span>
                </div>
              }

              <!-- Libraries block -->
              <div class="section-title">Detected Libraries</div>
              @if (data()!.libraries.length) {
                <div class="p-3 flex flex-wrap gap-2">
                  @for (lib of data()!.libraries; track lib.packageName) {
                    <div class="flex flex-col px-2.5 py-1.5 bg-gray-800 rounded border border-gray-700">
                      <span class="text-xs text-gray-100 font-medium">{{ lib.name }}</span>
                      <span class="text-[10px] text-gray-500 font-mono mt-0.5">{{ lib.packageName }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="py-4 text-center text-xs text-gray-500">
                  No well-known Angular libraries detected in the module registry.
                </div>
              }

              <!-- Environments block -->
              <div class="section-title">Environment Configuration</div>
              @if (filteredEnvironments().length) {
                @for (e of filteredEnvironments(); track e.key) {
                  <div class="row">
                    <span class="w-48 font-mono text-teal-300 flex-shrink-0 truncate" [title]="e.key">{{ e.key }}</span>
                    <span class="flex-1 cell-dim font-mono truncate" [title]="e.value">{{ e.value }}</span>
                  </div>
                }
              } @else {
                <div class="py-4 text-center text-xs text-gray-500">
                  No environment config detected.
                  <span class="block text-gray-600 mt-0.5">
                    Expose your environment as <code class="font-mono">window.environment</code> or <code class="font-mono">window.__env</code> to see it here.
                  </span>
                </div>
              }

              <!-- Web Worker note -->
              <div class="section-title">Web Workers</div>
              <div class="note-box">
                <span>ℹ</span>
                <span>
                  Web Workers run in an isolated thread and are not introspectable from the DevTools panel.
                  Use the browser's <strong class="text-gray-300">Application → Service Workers</strong> panel to inspect workers.
                </span>
              </div>

            </div>
          }

          <!-- ╔══ COMPONENTS ══╗ -->
          @if (activeTab() === 'components') {
            <div>
              <!-- CD summary bar -->
              @if (data()!.changeDetectionSummary.total > 0) {
                <div class="px-3 py-2.5 bg-gray-800/40 border-b border-gray-700">
                  <!-- counts row -->
                  <div class="flex items-center gap-3 text-[10px] mb-2">
                    <span class="text-gray-500 uppercase tracking-wide font-semibold">Change Detection</span>
                    <span class="tag-onpush">OnPush &nbsp;{{ data()!.changeDetectionSummary.onPush }}</span>
                    <span class="tag-default">Default &nbsp;{{ data()!.changeDetectionSummary.default }}</span>
                    <span class="text-gray-500 ml-auto">{{ data()!.changeDetectionSummary.total }} components</span>
                  </div>
                  <!-- stacked progress bar -->
                  <div class="flex h-1.5 rounded-full overflow-hidden bg-gray-700 gap-px">
                    <div class="bg-green-500 rounded-l-full transition-all"
                         [style.width.%]="data()!.changeDetectionSummary.onPush / data()!.changeDetectionSummary.total * 100"
                         [title]="'OnPush: ' + data()!.changeDetectionSummary.onPush + ' (' + (data()!.changeDetectionSummary.onPush / data()!.changeDetectionSummary.total * 100 | number:'1.0-0') + '%)'">
                    </div>
                    <div class="bg-gray-500 rounded-r-full flex-1"
                         [title]="'Default: ' + data()!.changeDetectionSummary.default + ' (' + (data()!.changeDetectionSummary.default / data()!.changeDetectionSummary.total * 100 | number:'1.0-0') + '%)'">
                    </div>
                  </div>
                  <!-- legend -->
                  <div class="flex gap-4 mt-1.5 text-[10px] text-gray-500">
                    <span><span class="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1"></span>OnPush {{ (data()!.changeDetectionSummary.onPush / data()!.changeDetectionSummary.total * 100 | number:'1.0-0') }}%</span>
                    <span><span class="inline-block w-2 h-2 rounded-sm bg-gray-500 mr-1"></span>Default {{ (data()!.changeDetectionSummary.default / data()!.changeDetectionSummary.total * 100 | number:'1.0-0') }}%</span>
                  </div>
                  <!-- signal stats row -->
                  @if (signalMap().size > 0 || signalInputComponentCount() > 0) {
                    <div class="flex items-center gap-3 mt-2 pt-2 border-t border-gray-700/60 text-[10px]">
                      <span class="text-gray-500 uppercase tracking-wide font-semibold">Signals</span>
                      @if (signalMap().size > 0) {
                        <span class="chip-signal">⚡ {{ signalMap().size }} component{{ signalMap().size !== 1 ? 's' : '' }} use signals</span>
                      }
                      @if (signalInputComponentCount() > 0) {
                        <span class="badge bg-teal-900/50 text-teal-300 border border-teal-700/50" title="Signal inputs via input() or input.required()">↩ {{ signalInputTotalCount() }} input{{ signalInputTotalCount() !== 1 ? 's' : '' }}</span>
                      }
                      @if (modelInputTotalCount() > 0) {
                        <span class="badge bg-sky-900/50 text-sky-300 border border-sky-700/50" title="Two-way signal bindings via model()">⇄ {{ modelInputTotalCount() }} model{{ modelInputTotalCount() !== 1 ? 's' : '' }}</span>
                      }
                      @if (signalStatsEffectCount() > 0) {
                        <span class="badge bg-rose-900/50 text-rose-300 border border-rose-700/50">{{ signalStatsEffectCount() }} effect{{ signalStatsEffectCount() !== 1 ? 's' : '' }}</span>
                      }
                      <span class="text-gray-600 ml-auto">{{ signalStatsWritableTotal() }}w · {{ signalStatsComputedTotal() }}c total</span>
                    </div>
                  }
                </div>
              }
              <div class="sticky top-0 z-10 flex gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                <span class="col-hdr w-40">Selector</span>
                <span class="col-hdr w-48">Class</span>
                <span class="col-hdr w-20">Strategy</span>
                <span class="col-hdr w-24">Signals</span>
                <span class="col-hdr flex-1">Inputs / Outputs</span>
                <span class="col-hdr w-32">File / Package</span>
              </div>
              @for (c of filteredComponents(); track c.className) {
                <div class="row">
                  <span class="w-40 cell-primary truncate" [title]="c.selector">{{ c.selector || '—' }}</span>
                  <span class="w-48 flex items-center gap-1 min-w-0">
                    <span class="cell-primary truncate" [title]="c.className">{{ c.className }}</span>
                    @if (c.standalone) { <span class="tag-standalone" title="Standalone">SA</span> }
                  </span>
                  <span class="w-20 flex-shrink-0">
                    @if (c.changeDetection === 'OnPush') { <span class="tag-onpush">OnPush</span> }
                    @else { <span class="tag-default">Default</span> }
                  </span>
                  <span class="w-24 flex-shrink-0">
                    @if (signalMap().get(c.className); as sig) {
                      <div class="chips">
                        @if (sig.writableSignals.length) {
                          <span class="chip-signal" [title]="sig.writableSignals.join(', ')">⚡{{ sig.writableSignals.length }}</span>
                        }
                        @if (sig.computedSignals.length) {
                          <span class="chip-computed" [title]="sig.computedSignals.join(', ')">⊕{{ sig.computedSignals.length }}</span>
                        }
                        @if (sig.effects.length) {
                          <span class="badge bg-rose-900/50 text-rose-300 border border-rose-700/50" [title]="sig.effects.join(', ')">⬡{{ sig.effects.length }}</span>
                        }
                      </div>
                    }
                    @if (c.signalInputs.length || c.modelInputs.length) {
                      <div class="chips mt-0.5">
                        @if (c.signalInputs.length) {
                          <span class="badge bg-teal-900/50 text-teal-300 border border-teal-700/50" [title]="'input(): ' + c.signalInputs.join(', ')">↩{{ c.signalInputs.length }}</span>
                        }
                        @if (c.modelInputs.length) {
                          <span class="badge bg-sky-900/50 text-sky-300 border border-sky-700/50" [title]="'model(): ' + c.modelInputs.join(', ')">⇄{{ c.modelInputs.length }}</span>
                        }
                      </div>
                    }
                    @if (!signalMap().get(c.className) && !c.signalInputs.length && !c.modelInputs.length) {
                      <span class="cell-dim">—</span>
                    }
                  </span>
                  <span class="flex-1 min-w-0">
                    @if (c.inputs.length || c.outputs.length) {
                      <div class="chips">
                        @for (inp of c.inputs.slice(0, 5); track inp) { <span class="chip text-green-400">@{{ inp }}</span> }
                        @for (out of c.outputs.slice(0, 4); track out) { <span class="chip text-amber-400">{{ out }}</span> }
                        @if (c.inputs.length + c.outputs.length > 9) {
                          <span class="cell-dim">+{{ c.inputs.length + c.outputs.length - 9 }}</span>
                        }
                      </div>
                    } @else { <span class="cell-dim">—</span> }
                  </span>
                  <span class="w-32 flex-shrink-0 min-w-0" [title]="c.filePath ?? ''" [ngClass]="isExternalPkg(c.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(c.filePath) }}</span>
                </div>
              }
              @if (!filteredComponents().length) { <div class="py-8 text-center text-xs text-gray-500">No results</div> }
            </div>
          }

          <!-- ╔══ DIRECTIVES ══╗ -->
          @if (activeTab() === 'directives') {
            <div>
              <div class="sticky top-0 z-10 flex gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                <span class="col-hdr w-48">Selector</span>
                <span class="col-hdr w-48">Class</span>
                <span class="col-hdr flex-1">Inputs / Outputs</span>
                <span class="col-hdr w-32">File / Package</span>
              </div>
              @for (d of filteredDirectives(); track d.className) {
                <div class="row">
                  <span class="w-48 cell-primary truncate">{{ d.selector || '—' }}</span>
                  <span class="w-48 flex items-center gap-1">
                    <span class="cell-primary truncate">{{ d.className }}</span>
                    @if (d.standalone) { <span class="tag-standalone" title="Standalone">SA</span> }
                  </span>
                  <span class="flex-1 min-w-0">
                    @if (d.inputs.length || d.outputs.length) {
                      <div class="chips">
                        @for (inp of d.inputs.slice(0, 5); track inp) { <span class="chip text-green-400">@{{ inp }}</span> }
                        @for (out of d.outputs.slice(0, 4); track out) { <span class="chip text-amber-400">{{ out }}</span> }
                      </div>
                    } @else { <span class="cell-dim">—</span> }
                  </span>
                  <span class="w-32 flex-shrink-0 min-w-0" [title]="d.filePath ?? ''" [ngClass]="isExternalPkg(d.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(d.filePath) }}</span>
                </div>
              }
              @if (!filteredDirectives().length) { <div class="py-8 text-center text-xs text-gray-500">No results</div> }
            </div>
          }

          <!-- ╔══ PIPES ══╗ -->
          @if (activeTab() === 'pipes') {
            <div>
              <div class="sticky top-0 z-10 flex gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                <span class="col-hdr w-40">Pipe name</span>
                <span class="col-hdr w-48">Class</span>
                <span class="col-hdr w-20">Purity</span>
                <span class="col-hdr flex-1">File / Package</span>
              </div>
              @for (p of filteredPipes(); track p.className) {
                <div class="row">
                  <span class="w-40 font-mono text-yellow-300">{{ p.name }}</span>
                  <span class="w-48 flex items-center gap-1">
                    <span class="cell-primary truncate">{{ p.className }}</span>
                    @if (p.standalone) { <span class="tag-standalone" title="Standalone">SA</span> }
                  </span>
                  <span class="w-20 flex-shrink-0">
                    @if (p.pure) { <span class="tag-pure">pure</span> }
                    @else { <span class="tag-impure">impure</span> }
                  </span>
                  <span class="flex-1 min-w-0" [title]="p.filePath ?? ''" [ngClass]="isExternalPkg(p.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(p.filePath) }}</span>
                </div>
              }
              @if (!filteredPipes().length) { <div class="py-8 text-center text-xs text-gray-500">No results</div> }
            </div>
          }

          <!-- ╔══ SERVICES ══╗ -->
          @if (activeTab() === 'services') {
            <div>
              <div class="sticky top-0 z-10 flex gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                <span class="col-hdr w-52">Class</span>
                <span class="col-hdr w-24">Scope</span>
                <span class="col-hdr w-36">Roles</span>
                <span class="col-hdr flex-1">File / Package</span>
              </div>
              @for (s of filteredServices(); track s.className) {
                <div class="row">
                  <span class="w-52 cell-primary truncate">{{ s.className }}</span>
                  <span class="w-24 flex-shrink-0">
                    <span class="badge"
                      [ngClass]="s.providedIn === 'root'     ? 'bg-green-900/50 text-green-300 border border-green-700/50'
                               : s.providedIn === 'platform'  ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                               : s.providedIn === 'none'      ? 'bg-gray-700 text-gray-400 border border-gray-600'
                               : 'bg-purple-900/50 text-purple-300 border border-purple-700/50'">
                      {{ s.providedIn }}
                    </span>
                  </span>
                  <span class="w-36 flex-shrink-0">
                    <div class="chips">
                      @if (s.roles.includes('guard'))       { <span class="tag-guard">guard</span> }
                      @if (s.roles.includes('interceptor')) { <span class="tag-iceptor">interceptor</span> }
                      @if (s.roles.includes('resolver'))    { <span class="tag-resolver">resolver</span> }
                    </div>
                  </span>
                  <span class="flex-1 min-w-0" [title]="s.filePath ?? ''" [ngClass]="isExternalPkg(s.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(s.filePath) }}</span>
                </div>
              }
              @if (!filteredServices().length) { <div class="py-8 text-center text-xs text-gray-500">No results</div> }
            </div>
          }

          <!-- ╔══ MODULES ══╗ -->
          @if (activeTab() === 'modules') {
            @for (m of filteredModules(); track m.className) {
              <div class="px-3 py-2 border-b border-gray-800">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="tag-module">NgModule</span>
                  <span class="text-xs font-mono font-medium text-gray-100">{{ m.className }}</span>
                  @if (m.filePath) {
                    <span class="max-w-xs min-w-0" [title]="m.filePath" [ngClass]="isExternalPkg(m.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(m.filePath) }}</span>
                  }
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                  @for (group of [
                    { label: 'Declarations', items: m.declarations },
                    { label: 'Imports',      items: m.imports },
                    { label: 'Exports',      items: m.exports },
                    { label: 'Providers',    items: m.providers }
                  ]; track group.label) {
                    <div>
                      <span class="text-gray-500 uppercase tracking-wide">{{ group.label }}</span>
                      <div class="chips mt-0.5">
                        @for (item of group.items.slice(0, 8); track item) { <span class="chip">{{ item }}</span> }
                        @if (group.items.length > 8) { <span class="cell-dim">+{{ group.items.length - 8 }}</span> }
                        @if (!group.items.length) { <span class="cell-dim">—</span> }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
            @if (!filteredModules().length) { <div class="py-8 text-center text-xs text-gray-500">No results</div> }
          }

          <!-- ╔══ ROUTES ══╗ -->
          @if (activeTab() === 'routes') {
            <div class="p-2">
              <!-- Routing strategy header -->
              @if (data()!.routerInfo) {
                <div class="flex items-center gap-3 mb-2 px-1 py-1.5 bg-gray-800/40 rounded text-[10px]">
                  <span class="text-gray-500">Strategy:</span>
                  @if (data()!.routerInfo!.strategy === 'path') {
                    <span class="tag-prod">HTML5 History</span>
                  } @else if (data()!.routerInfo!.strategy === 'hash') {
                    <span class="tag-impure">Hash-based</span>
                  } @else {
                    <span class="cell-dim">unknown</span>
                  }
                  <span class="text-gray-500 ml-2">Base href:</span>
                  <code class="font-mono text-gray-300">{{ data()!.routerInfo!.baseHref ?? '/' }}</code>
                  <span class="text-gray-500 ml-2">Total:</span>
                  <span class="text-gray-300">{{ data()!.routerInfo!.totalRoutes }}</span>
                  @if (data()!.routerInfo!.hasLazyRoutes) {
                    <span class="tag-lazy ml-1">lazy</span>
                  }
                </div>
              }
              @if (!filteredFlatRoutes().length) {
                <div class="py-8 text-center text-xs text-gray-500">No routes found</div>
              } @else {
                @for (r of filteredFlatRoutes(); track r.key) {
                  <div class="flex items-start gap-2 py-1.5 border-b border-gray-800/50 text-xs"
                       [style.paddingLeft.px]="r.depth * 16 + 8">
                    @if (r.depth > 0) { <span class="text-gray-600 select-none flex-shrink-0">└</span> }
                    <span class="route-path flex-shrink-0">{{ r.depth === 0 ? '/' : '' }}{{ r.path || '(root)' }}</span>
                    @if (r.redirectTo !== null) {
                      <span class="text-amber-400 text-[10px] flex-shrink-0">→ {{ r.redirectTo }}</span>
                    }
                    <span class="flex-1 min-w-0">
                      <div class="chips">
                        @if (r.isLazy) { <span class="tag-lazy">lazy</span> }
                        @for (g of r.guards; track g)   { <span class="tag-guard">{{ g }}</span> }
                        @for (res of r.resolvers; track res) { <span class="tag-resolver">{{ res }}</span> }
                      </div>
                    </span>
                    @if (r.component) { <span class="chip flex-shrink-0">{{ r.component }}</span> }
                  </div>
                }
              }
            </div>
          }

          <!-- ╔══ STATE MANAGEMENT ══╗ -->
          @if (activeTab() === 'state') {
            <div>
              @if (filteredNgrx().length) {
                <div class="section-title">NgRx</div>
                @for (n of filteredNgrx(); track n.className) {
                  <div class="row">
                    <span class="w-44 cell-primary truncate">{{ n.className }}</span>
                    <span class="w-32 flex-shrink-0">
                      <span class="badge"
                        [ngClass]="n.storeType === 'store'           ? 'bg-red-900/50 text-red-300 border border-red-700/50'
                                 : n.storeType === 'component-store'  ? 'bg-orange-900/50 text-orange-300 border border-orange-700/50'
                                 : n.storeType === 'signal-store'     ? 'bg-violet-900/50 text-violet-300 border border-violet-700/50'
                                 : n.storeType === 'actions'          ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
                                 : 'bg-gray-700 text-gray-300 border border-gray-600'">
                        {{ n.storeType }}
                      </span>
                    </span>
                    <span class="w-28 flex-shrink-0 min-w-0" [title]="n.filePath ?? ''" [ngClass]="isExternalPkg(n.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(n.filePath) }}</span>
                    <span class="flex-1 min-w-0">
                      @if (n.features.length) {
                        <div class="chips">
                          @for (f of n.features.slice(0, 8); track f) { <span class="chip">{{ f }}</span> }
                          @if (n.features.length > 8) { <span class="cell-dim">+{{ n.features.length - 8 }}</span> }
                        </div>
                      } @else { <span class="cell-dim">no features detected</span> }
                    </span>
                  </div>
                }
              }

              @if (filteredSignalState().length) {
                <div class="section-title">Signal State</div>
                @for (s of filteredSignalState(); track s.className) {
                  <div class="row flex-col gap-1.5">
                    <div class="flex items-center gap-2">
                      <span class="cell-primary">{{ s.className }}</span>
                      <span class="badge bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">{{ s.entityType }}</span>
                      @if (s.effects.length) {
                        <span class="badge bg-rose-900/50 text-rose-300 border border-rose-700/50">{{ s.effects.length }} effect{{ s.effects.length !== 1 ? 's' : '' }}</span>
                      }
                    </div>
                    <div class="chips">
                      @for (p of s.writableSignals.slice(0, 12); track p) { <span class="chip-signal">⚡{{ p }}</span> }
                      @for (p of s.computedSignals.slice(0, 6); track p) { <span class="chip-computed">⊕{{ p }}()</span> }
                      @for (p of s.effects.slice(0, 4); track p) { <span class="badge bg-rose-900/40 text-rose-300 border border-rose-700/40">⬡{{ p }}</span> }
                      @if (s.writableSignals.length + s.computedSignals.length + s.effects.length > 22) {
                        <span class="cell-dim">+{{ s.writableSignals.length + s.computedSignals.length + s.effects.length - 22 }}</span>
                      }
                    </div>
                    <div class="text-[10px] text-gray-500">
                      {{ s.writableSignals.length }} writable · {{ s.computedSignals.length }} computed
                      @if (s.effects.length) { · {{ s.effects.length }} effect{{ s.effects.length !== 1 ? 's' : '' }} }
                    </div>
                  </div>
                }
              }

              @if (filteredObservableState().length) {
                <div class="section-title">Observable / Subject State</div>
                @for (o of filteredObservableState(); track o.className) {
                  <div class="row flex-col gap-1.5">
                    <div class="flex items-center gap-2">
                      <span class="cell-primary">{{ o.className }}</span>
                      <span class="badge bg-orange-900/50 text-orange-300 border border-orange-700/50">{{ o.entityType }}</span>
                    </div>
                    <div class="chips">
                      @for (s of o.subjects.slice(0, 12); track s)    { <span class="chip-subject">{{ s }}$</span> }
                      @for (obs of o.observables.slice(0, 6); track obs) { <span class="chip-obs">{{ obs }}</span> }
                    </div>
                    <div class="text-[10px] text-gray-500">
                      {{ o.subjects.length }} subjects · {{ o.observables.length }} observables
                    </div>
                  </div>
                }
              }

              @if (!filteredNgrx().length && !filteredSignalState().length && !filteredObservableState().length) {
                <div class="py-8 text-center text-xs text-gray-500">
                  No state management patterns detected.<br>
                  <span class="text-gray-600">Make sure tracking is active and components are rendered.</span>
                </div>
              }
            </div>
          }

          <!-- ╔══ GUARDS & INTERCEPTORS ══╗ -->
          @if (activeTab() === 'guards') {
            <div>
              @if (filteredGuards().length) {
                <div class="section-title">Guards</div>
                <div class="sticky top-8 z-10 flex gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                  <span class="col-hdr w-44">Class</span>
                  <span class="col-hdr w-32">Type</span>
                  <span class="col-hdr w-32">File / Package</span>
                  <span class="col-hdr flex-1">Routes</span>
                </div>
                @for (g of filteredGuards(); track g.className) {
                  <div class="row">
                    <span class="w-44 cell-primary truncate">{{ g.className }}</span>
                    <span class="w-32 flex-shrink-0">
                      <div class="chips">
                        @for (t of g.guardTypes; track t) { <span class="tag-guard">{{ t }}</span> }
                        @if (g.functional) { <span class="badge bg-gray-700 text-gray-300 border border-gray-600">fn</span> }
                      </div>
                    </span>
                    <span class="w-32 flex-shrink-0 min-w-0" [title]="g.filePath ?? ''" [ngClass]="isExternalPkg(g.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(g.filePath) }}</span>
                    <span class="flex-1 min-w-0">
                      <div class="chips">
                        @for (r of g.routes.slice(0, 6); track r) { <span class="chip route-path text-blue-300">{{ r }}</span> }
                        @if (g.routes.length > 6) { <span class="cell-dim">+{{ g.routes.length - 6 }}</span> }
                        @if (!g.routes.length) { <span class="cell-dim">—</span> }
                      </div>
                    </span>
                  </div>
                }
              }

              @if (filteredInterceptors().length) {
                <div class="section-title">HTTP Interceptors</div>
                @for (i of filteredInterceptors(); track i.className) {
                  <div class="row">
                    <span class="w-8 flex-shrink-0 text-gray-500 font-mono text-[10px]">#{{ i.order + 1 }}</span>
                    <span class="w-52 cell-primary truncate">{{ i.className }}</span>
                    @if (i.functional) { <span class="badge bg-gray-700 text-gray-300 border border-gray-600">fn</span> }
                    <span class="tag-iceptor">interceptor</span>
                    <span class="flex-1 min-w-0" [title]="i.filePath ?? ''" [ngClass]="isExternalPkg(i.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(i.filePath) }}</span>
                  </div>
                }
              }

              @if (filteredResolvers().length) {
                <div class="section-title">Resolvers</div>
                @for (r of filteredResolvers(); track r.className) {
                  <div class="row">
                    <span class="w-44 cell-primary truncate">{{ r.className }}</span>
                    <span class="w-24 flex-shrink-0">
                      @if (r.functional) { <span class="badge bg-gray-700 text-gray-300 border border-gray-600 mr-1">fn</span> }
                      <span class="tag-resolver">resolver</span>
                    </span>
                    <span class="w-32 flex-shrink-0 min-w-0" [title]="r.filePath ?? ''" [ngClass]="isExternalPkg(r.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(r.filePath) }}</span>
                    <span class="flex-1 min-w-0">
                      <div class="chips">
                        @for (path of r.routes.slice(0, 6); track path) { <span class="chip route-path text-blue-300">{{ path }}</span> }
                        @if (r.routes.length > 6) { <span class="cell-dim">+{{ r.routes.length - 6 }}</span> }
                      </div>
                    </span>
                  </div>
                }
              }

              @if (!filteredGuards().length && !filteredInterceptors().length && !filteredResolvers().length) {
                <div class="py-8 text-center text-xs text-gray-500">No guards, interceptors or resolvers detected</div>
              }
            </div>
          }

          <!-- ╔══ CLASSES ══╗ -->
          @if (activeTab() === 'classes') {
            <div>

              <!-- Plain classes (DI-visible) -->
              <div class="section-title">Plain Classes  <span class="normal-case font-normal ml-1 text-gray-500">— non-decorated, DI-registered</span></div>
              @if (filteredPlainClasses().length) {
                <div class="sticky top-8 z-10 flex gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                  <span class="col-hdr w-48">Class name</span>
                  <span class="col-hdr w-24">Found via</span>
                  <span class="col-hdr flex-1">File / Package</span>
                </div>
                @for (c of filteredPlainClasses(); track c.className) {
                  <div class="row">
                    <span class="w-48 cell-primary truncate">{{ c.className }}</span>
                    <span class="w-24 flex-shrink-0">
                      <span class="badge"
                        [ngClass]="c.source === 'use-class' ? 'bg-amber-900/50 text-amber-300 border border-amber-700/50'
                                 : 'bg-gray-700 text-gray-400 border border-gray-600'">
                        {{ c.source }}
                      </span>
                    </span>
                    <span class="flex-1 min-w-0" [title]="c.filePath ?? ''" [ngClass]="isExternalPkg(c.filePath) ? 'pkg-badge' : 'src-path'">{{ shortPath(c.filePath) }}</span>
                  </div>
                }
              } @else {
                <div class="py-4 text-center text-xs text-gray-500">
                  No plain classes detected in the injector.
                </div>
              }

              <!-- Compile-time-only notice (enum / interface / web-worker) -->
              <div class="section-title mt-2">Compile-time Only Entities</div>
              <div class="p-3 space-y-2">
                @for (note of compiletimeNotes; track note.name) {
                  <div class="flex items-start gap-3 px-3 py-2.5 bg-gray-800/60 border border-gray-700 rounded text-xs">
                    <span class="text-gray-500 font-mono w-24 flex-shrink-0">{{ note.name }}</span>
                    <span class="text-gray-400">{{ note.reason }}</span>
                  </div>
                }
              </div>

            </div>
          }

          <!-- ╔══ TOKENS ══╗ -->
          @if (activeTab() === 'tokens') {
            <div>
              <div class="note-box">
                <span>ℹ</span>
                <span>
                  InjectionTokens serve as Angular's runtime <strong class="text-gray-300">config</strong> mechanism.
                  Use <code class="font-mono text-[10px]">new InjectionToken('MY_CONFIG')</code> to expose app configuration here.
                </span>
              </div>
              <div class="sticky top-0 z-10 flex gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                <span class="col-hdr flex-1">Token name</span>
                <span class="col-hdr w-16">Multi</span>
              </div>
              @for (t of filteredTokens(); track t.name) {
                <div class="row">
                  <span class="flex-1 font-mono text-violet-300 truncate" [title]="t.name">{{ t.name }}</span>
                  <span class="w-16 flex-shrink-0">
                    @if (t.multi) { <span class="badge bg-teal-900/50 text-teal-300 border border-teal-700/50">multi</span> }
                  </span>
                </div>
              }
              @if (!filteredTokens().length) {
                <div class="py-8 text-center text-xs text-gray-500">No injection tokens detected</div>
              }
            </div>
          }

          <!-- ╔══ APP CONFIG ══╗ -->
          @if (activeTab() === 'app-config') {
            <div>
              @if (data()!.appProviders.length > 0) {
                <div class="px-3 py-2 border-b border-gray-700 bg-gray-800/40 flex items-center gap-2 text-[10px] text-gray-500">
                  <span>{{ data()!.appProviders.length }} providers from the root environment injector</span>
                  <span class="ml-auto">{{ groupedAppProviders().length }} categories</span>
                </div>
              }
              @for (group of groupedAppProviders(); track group.label) {
                <div class="section-title flex items-center justify-between">
                  <span>{{ group.label }}</span>
                  <span class="text-gray-600 font-normal normal-case tracking-normal">{{ group.providers.length }}</span>
                </div>
                @for (p of group.providers; track p.name) {
                  <div class="row">
                    <span class="flex-1 cell-primary font-mono truncate" [title]="p.name">{{ p.name }}</span>
                    <span class="flex-shrink-0">
                      @if (p.kind === 'class') {
                        <span class="badge bg-violet-900/40 text-violet-300 border border-violet-700/40">class</span>
                      } @else if (p.kind === 'multi') {
                        <span class="badge bg-amber-900/40 text-amber-300 border border-amber-700/40">multi</span>
                      } @else {
                        <span class="badge bg-gray-700 text-gray-400 border border-gray-600">token</span>
                      }
                    </span>
                  </div>
                }
              }
              @if (!groupedAppProviders().length) {
                <div class="py-8 text-center text-xs text-gray-500">No providers detected</div>
              }
            </div>
          }

        </div>
      }
    </div>
  `,
})
export class AppStructureComponent implements OnInit {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);

  readonly data = this.state.appStructure;
  readonly scanning = signal(false);
  readonly activeTab = signal<RegistryTab>('app');
  readonly searchQuery = signal('');

  readonly compiletimeNotes = [
    { name: 'interface',   reason: 'TypeScript interfaces are erased at compile time and produce no runtime artifact. They cannot be introspected.' },
    { name: 'enum',        reason: 'TypeScript enums compile to plain JS objects. They are indistinguishable from other objects at runtime without source-map analysis.' },
    { name: 'web-worker',  reason: 'Web Workers run in an isolated thread context and are not accessible from the DevTools panel. Inspect them via Chrome DevTools → Sources → Workers.' },
  ] as const;

  // ── State counts ─────────────────────────────────────────────────────────

  private readonly stateCount = computed(() => {
    const sm = this.data()?.stateManagement;
    if (!sm) return 0;
    return sm.signalState.length + sm.observableState.length + sm.ngrx.length;
  });

  private readonly guardsCount = computed(() => {
    const d = this.data();
    return (d?.guards.length ?? 0) + (d?.interceptors.length ?? 0) + (d?.resolvers.length ?? 0);
  });

  private readonly classesCount = computed(() => this.data()?.plainClasses.length ?? 0);

  readonly tabs: Array<{ id: RegistryTab; label: string; icon: string; count: () => number }> = [
    { id: 'app',         label: 'App Info',     icon: '🏠', count: computed(() => 0) },
    { id: 'components',  label: 'Components',   icon: '◈',  count: computed(() => this.data()?.components.length  ?? 0) },
    { id: 'directives',  label: 'Directives',   icon: '◇',  count: computed(() => this.data()?.directives.length  ?? 0) },
    { id: 'pipes',       label: 'Pipes',         icon: '|>', count: computed(() => this.data()?.pipes.length       ?? 0) },
    { id: 'services',    label: 'Services',      icon: '⬡',  count: computed(() => this.data()?.services.length    ?? 0) },
    { id: 'modules',     label: 'Modules',       icon: '⬢',  count: computed(() => this.data()?.modules.length     ?? 0) },
    { id: 'routes',      label: 'Routes',        icon: '↗',  count: computed(() => this.countRoutes(this.data()?.routes ?? [])) },
    { id: 'state',       label: 'State',         icon: '⚡', count: this.stateCount },
    { id: 'guards',      label: 'Guards & I/O',  icon: '🛡', count: this.guardsCount },
    { id: 'classes',     label: 'Classes',       icon: '📦', count: this.classesCount },
    { id: 'tokens',      label: 'Tokens',        icon: '🔑', count: computed(() => this.data()?.tokens.length     ?? 0) },
    { id: 'app-config',  label: 'App Config',    icon: '⚙️',  count: computed(() => this.data()?.appProviders.length ?? 0) },
  ];

  // ── Filtered computed ─────────────────────────────────────────────────────

  readonly filteredComponents = computed<ComponentRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.components ?? [];
    return q ? items.filter(c => c.className.toLowerCase().includes(q) || c.selector.toLowerCase().includes(q)) : items;
  });

  readonly filteredDirectives = computed<DirectiveRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.directives ?? [];
    return q ? items.filter(d => d.className.toLowerCase().includes(q) || d.selector.toLowerCase().includes(q)) : items;
  });

  readonly filteredPipes = computed<PipeRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.pipes ?? [];
    return q ? items.filter(p => p.name.toLowerCase().includes(q) || p.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredServices = computed<ServiceRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.services ?? [];
    return q ? items.filter(s => s.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredModules = computed<ModuleRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.modules ?? [];
    return q ? items.filter(m => m.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredFlatRoutes = computed<FlatRoute[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.routes ?? [];
    const filtered = q ? this.filterRoutes(items, q) : items;
    return this.flattenRoutes(filtered, 0, '');
  });

  readonly filteredNgrx = computed<NgrxEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.stateManagement.ngrx ?? [];
    return q ? items.filter(n => n.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredSignalState = computed<SignalStateEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.stateManagement.signalState ?? [];
    return q ? items.filter(s => s.className.toLowerCase().includes(q)) : items;
  });

  /** Fast className → SignalStateEntry lookup used by the Components tab */
  readonly signalMap = computed(() => {
    const map = new Map<string, SignalStateEntry>();
    for (const entry of this.data()?.stateManagement.signalState ?? []) {
      map.set(entry.className, entry);
    }
    return map;
  });

  readonly signalStatsEffectCount = computed(() =>
    [...this.signalMap().values()].reduce((s, e) => s + e.effects.length, 0)
  );
  readonly signalStatsWritableTotal = computed(() =>
    [...this.signalMap().values()].reduce((s, e) => s + e.writableSignals.length, 0)
  );
  readonly signalStatsComputedTotal = computed(() =>
    [...this.signalMap().values()].reduce((s, e) => s + e.computedSignals.length, 0)
  );

  /** Total number of signal inputs (input() / input.required()) across all components */
  readonly signalInputTotalCount = computed(() =>
    (this.data()?.components ?? []).reduce((s, c) => s + c.signalInputs.length, 0)
  );
  /** Total number of model() inputs across all components */
  readonly modelInputTotalCount = computed(() =>
    (this.data()?.components ?? []).reduce((s, c) => s + c.modelInputs.length, 0)
  );
  /** Number of components that have at least one signal input or model input */
  readonly signalInputComponentCount = computed(() =>
    (this.data()?.components ?? []).filter(
      c => c.signalInputs.length + c.modelInputs.length > 0
    ).length
  );

  readonly filteredObservableState = computed<ObservableStateEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.stateManagement.observableState ?? [];
    return q ? items.filter(o => o.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredGuards = computed<GuardRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.guards ?? [];
    return q ? items.filter(g => g.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredInterceptors = computed<InterceptorRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.interceptors ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredResolvers = computed<ResolverRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.resolvers ?? [];
    return q ? items.filter(r => r.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredPlainClasses = computed<PlainClassEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.plainClasses ?? [];
    return q ? items.filter(c => c.className.toLowerCase().includes(q)) : items;
  });

  readonly filteredTokens = computed<TokenRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.tokens ?? [];
    return q ? items.filter(t => t.name.toLowerCase().includes(q)) : items;
  });

  private static readonly PROVIDER_CATEGORY_LABELS: Record<string, string> = {
    app: 'App-Defined', router: 'Routing', http: 'HTTP Client',
    forms: 'Forms', animations: 'Animations', security: 'Security',
    i18n: 'Internationalization', core: 'Angular Core', other: 'Other',
  };

  readonly groupedAppProviders = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const items = (this.data()?.appProviders ?? []).filter(
      p => !q || p.name.toLowerCase().includes(q)
    );
    const groups = new Map<string, AppProviderEntry[]>();
    for (const p of items) {
      const label = AppStructureComponent.PROVIDER_CATEGORY_LABELS[p.category] ?? p.category;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(p);
    }
    return [...groups.entries()].map(([label, providers]) => ({ label, providers }));
  });

  readonly filteredEnvironments = computed<EnvironmentEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.environments ?? [];
    return q ? items.filter(e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)) : items;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.data()) this.scan();
  }

  scan(): void {
    // Reset previous data so the polling interval doesn't exit immediately
    this.data.set(null);
    this.scanning.set(true);
    this.cmd.scanAppStructure();

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      this.scanning.set(false);
    }, 15_000);

    const stop = setInterval(() => {
      if (this.data()) {
        this.scanning.set(false);
        clearInterval(stop);
        clearTimeout(timeout);
      } else if (timedOut) {
        clearInterval(stop);
      }
    }, 100);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatTime(ts: number): string { return new Date(ts).toLocaleTimeString(); }

  configFeatureClass(f: BootstrapConfigFeature): string {
    const base = 'badge';
    const map: Record<string, string> = {
      router:            'tag-cfg-router',
      http:              'tag-cfg-http',
      forms:             'tag-cfg-forms',
      animations:        'tag-cfg-anim',
      initializer:       'tag-cfg-init',
      'service-worker':  'tag-cfg-sw',
      hydration:         'tag-cfg-hydra',
      'change-detection':'tag-cfg-cd',
      custom:            'tag-cfg-custom',
    };
    return `${base} ${map[f.featureType] ?? 'tag-cfg-custom'}`;
  }

  isExternalPkg(path: string | null): boolean {
    if (!path) return false;
    if (path.includes('node_modules/')) return true;
    // Bare package name (from LIBRARY_NAME_PATTERNS): no file extension, not an absolute/relative path
    return !path.startsWith('/') && !path.startsWith('./') &&
           !path.includes('.ts') && !path.includes('.js') && !path.includes('.mjs');
  }

  shortPath(path: string | null): string {
    if (!path) return '—';
    // node_modules path → extract package name (dev mode with source maps)
    const nmIdx = path.indexOf('node_modules/');
    if (nmIdx !== -1) {
      const after = path.slice(nmIdx + 13); // skip 'node_modules/'
      const parts = after.split('/');
      return parts[0].startsWith('@') && parts.length >= 2
        ? `${parts[0]}/${parts[1]}`
        : parts[0];
    }
    // Already a package name (e.g. "@coreui/angular", "ngx-scrollbar") — no extra path segments
    if (path.startsWith('@') || !path.includes('/')) return path;
    // Local source file → last 2 path segments
    return path.split('/').slice(-2).join('/');
  }

  private countRoutes(routes: RouteRegistryEntry[]): number {
    return routes.reduce((sum, r) => sum + 1 + this.countRoutes(r.children), 0);
  }

  private filterRoutes(routes: RouteRegistryEntry[], q: string): RouteRegistryEntry[] {
    return routes.filter(r =>
      r.path.includes(q) ||
      (r.component ?? '').toLowerCase().includes(q) ||
      r.guards.some(g => g.toLowerCase().includes(q)) ||
      this.filterRoutes(r.children, q).length > 0
    );
  }

  private flattenRoutes(routes: RouteRegistryEntry[], depth: number, prefix: string): FlatRoute[] {
    const result: FlatRoute[] = [];
    for (const r of routes) {
      const key = `${prefix}/${r.path}`;
      result.push({ key, path: r.path, component: r.component, redirectTo: r.redirectTo, guards: r.guards, resolvers: r.resolvers, depth, isLazy: r.isLazy });
      result.push(...this.flattenRoutes(r.children, depth + 1, key));
    }
    return result;
  }
}

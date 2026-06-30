import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PanelState } from '../../state/panel.state';
import { CommandService } from '../../services/command.service';
import type { RouteRegistryEntry } from '../../../../../types/app-structure';
import type { RegistryTab } from './app-structure.types';
import { AppInfoTabComponent } from './tabs/app-info-tab.component';
import { ComponentsTabComponent } from './tabs/components-tab.component';
import { DirectivesTabComponent } from './tabs/directives-tab.component';
import { PipesTabComponent } from './tabs/pipes-tab.component';
import { ServicesTabComponent } from './tabs/services-tab.component';
import { ModulesTabComponent } from './tabs/modules-tab.component';
import { RoutesTabComponent } from './tabs/routes-tab.component';
import { GuardsTabComponent } from './tabs/guards-tab.component';
import { InterceptorsTabComponent } from './tabs/interceptors-tab.component';
import { ResolversTabComponent } from './tabs/resolvers-tab.component';
import { ClassesTabComponent } from './tabs/classes-tab.component';
import { TokensTabComponent } from './tabs/tokens-tab.component';
import { AppConfigTabComponent } from './tabs/app-config-tab.component';

@Component({
  selector: 'app-app-structure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppInfoTabComponent,
    ComponentsTabComponent,
    DirectivesTabComponent,
    PipesTabComponent,
    ServicesTabComponent,
    ModulesTabComponent,
    RoutesTabComponent,
    GuardsTabComponent,
    InterceptorsTabComponent,
    ResolversTabComponent,
    ClassesTabComponent,
    TokensTabComponent,
    AppConfigTabComponent,
  ],
  templateUrl: './app-structure.component.html',
  styleUrl: './app-structure.component.css',
})
export class AppStructureComponent implements OnInit {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);

  readonly data = this.state.appStructure;
  readonly scanning = signal(false);
  readonly activeTab = signal<RegistryTab>('app');
  readonly searchQuery = signal('');

  readonly tabs: Array<{ id: RegistryTab; label: string; icon: string; count: () => number }> = [
    { id: 'app',          label: 'App Info',     icon: '🏠', count: computed(() => 0) },
    { id: 'components',   label: 'Components',   icon: '◈',  count: computed(() => this.data()?.components.length    ?? 0) },
    { id: 'directives',   label: 'Directives',   icon: '◇',  count: computed(() => this.data()?.directives.length    ?? 0) },
    { id: 'pipes',        label: 'Pipes',         icon: '|>', count: computed(() => this.data()?.pipes.length         ?? 0) },
    { id: 'services',     label: 'Services',      icon: '⬡',  count: computed(() => this.data()?.services.length     ?? 0) },
    { id: 'modules',      label: 'Modules',       icon: '⬢',  count: computed(() => this.data()?.modules.length      ?? 0) },
    { id: 'routes',       label: 'Routes',        icon: '↗',  count: computed(() => this.countRoutes(this.data()?.routes ?? [])) },
    { id: 'guards',       label: 'Guards',        icon: '🛡', count: computed(() => this.data()?.guards.length        ?? 0) },
    { id: 'interceptors', label: 'Interceptors',  icon: '⟳', count: computed(() => this.data()?.interceptors.length  ?? 0) },
    { id: 'resolvers',    label: 'Resolvers',     icon: '↺', count: computed(() => this.data()?.resolvers.length     ?? 0) },
    { id: 'classes',      label: 'Classes',       icon: '📦', count: computed(() => this.data()?.plainClasses.length  ?? 0) },
    { id: 'tokens',       label: 'Tokens',        icon: '🔑', count: computed(() => this.data()?.tokens.length        ?? 0) },
    { id: 'app-config',   label: 'App Config',    icon: '⚙️',  count: computed(() => this.data()?.appProviders.length  ?? 0) },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (!this.data()) this.scan();
  }

  scan(): void {    // Reset previous data so the polling interval doesn't exit immediately
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

  private countRoutes(routes: RouteRegistryEntry[]): number {
    return routes.reduce((sum, r) => sum + 1 + this.countRoutes(r.children), 0);
  }
}

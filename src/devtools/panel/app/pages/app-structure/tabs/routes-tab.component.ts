import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { RouteRegistryEntry, EagerLoadedRouteEntry, PreloadingStrategyInfo } from '../../../../../../types/app-structure';
import type { FlatRoute } from '../app-structure.types';
import { filterRoutes, flattenRoutes } from './tab-utils';

@Component({
  selector: 'app-routes-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './routes-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class RoutesTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly eagerRoutes = computed<EagerLoadedRouteEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.performanceDetections?.eagerLoadedRoutes ?? [];
    return q
      ? items.filter(i =>
          i.absolutePath.toLowerCase().includes(q) ||
          i.component.toLowerCase().includes(q),
        )
      : items;
  });

  /** N11 — Preloading strategy info (null when no data yet) */
  readonly preloadingStrategy = computed<PreloadingStrategyInfo | null>(
    () => this.data()?.performanceDetections?.preloadingStrategy ?? null,
  );

  readonly filteredFlatRoutes = computed<FlatRoute[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.routes ?? [];
    const filtered = q ? filterRoutes(items, q) : items;
    const activePaths = new Set(
      (this.data()?.activeRoutes ?? []).map(r => r.absolutePath)
    );
    return flattenRoutes(filtered, 0, '', activePaths);
  });

  /** Opens the route component's source in the DevTools Sources panel. */
  openComponent(name: string | null): void {
    if (name) this.cmd.openInSources(name);
  }

  /** Opens a route guard class source in the DevTools Sources panel. */
  openGuard(name: string): void {
    this.cmd.openClassFileInSources(name, null, 'guard');
  }

  /** Opens a route resolver class source in the DevTools Sources panel. */
  openResolver(name: string): void {
    this.cmd.openClassFileInSources(name, null, 'resolver');
  }
}

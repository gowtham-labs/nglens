import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import type { RouteRegistryEntry } from '../../../../../../types/app-structure';
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
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredFlatRoutes = computed<FlatRoute[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.routes ?? [];
    const filtered = q ? filterRoutes(items, q) : items;
    const activePaths = new Set(
      (this.data()?.activeRoutes ?? []).map(r => r.absolutePath)
    );
    return flattenRoutes(filtered, 0, '', activePaths);
  });
}

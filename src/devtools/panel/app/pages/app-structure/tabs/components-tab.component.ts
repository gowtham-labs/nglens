import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import type { ComponentRegistryEntry, SignalStateEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, shortPath } from './tab-utils';

@Component({
  selector: 'app-components-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './components-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class ComponentsTabComponent {
  private readonly state = inject(PanelState);
  readonly searchQuery = input('');

  readonly data = this.state.appStructure;

  readonly filteredComponents = computed<ComponentRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.components ?? [];
    return q ? items.filter(c => c.className.toLowerCase().includes(q) || c.selector.toLowerCase().includes(q)) : items;
  });

  readonly signalMap = computed(() => {
    const map = new Map<string, SignalStateEntry>();
    for (const entry of this.data()?.stateManagement.signalState ?? []) {
      map.set(entry.className, entry);
    }
    return map;
  });

  readonly filteredModelComponents = computed<ComponentRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = (this.data()?.components ?? []).filter(c => c.modelInputs.length > 0);
    return q ? items.filter(c =>
      c.className.toLowerCase().includes(q) ||
      c.modelInputs.some(m => m.toLowerCase().includes(q))
    ) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly shortPath = shortPath;
}

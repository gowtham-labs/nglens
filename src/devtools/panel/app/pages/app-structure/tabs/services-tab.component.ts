import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import type { ServiceRegistryEntry, DuplicateServiceEntry, ProvidedInAnyEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, shortPath } from './tab-utils';

@Component({
  selector: 'app-services-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './services-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class ServicesTabComponent {
  private readonly state = inject(PanelState);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredServices = computed<ServiceRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.services ?? [];
    return q ? items.filter(s => s.className.toLowerCase().includes(q)) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly shortPath = shortPath;

  readonly duplicateServices = computed<DuplicateServiceEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.performanceDetections?.duplicateServices ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  readonly appInitInfo = computed(() => this.data()?.performanceDetections?.appInitializerInfo ?? null);

  /** N22 — Services using providedIn: 'any' */
  readonly providedInAny = computed<ProvidedInAnyEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.performanceDetections?.providedInAny ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });
}

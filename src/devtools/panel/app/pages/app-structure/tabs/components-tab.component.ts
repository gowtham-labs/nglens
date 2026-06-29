import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import type { ComponentRegistryEntry, SignalStateEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, shortPath } from './tab-utils';

@Component({
  selector: 'app-components-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, DecimalPipe],
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

  readonly signalStatsEffectCount = computed(() =>
    [...this.signalMap().values()].reduce((s, e) => s + e.effects.length, 0)
  );
  readonly signalStatsWritableTotal = computed(() =>
    [...this.signalMap().values()].reduce((s, e) => s + e.writableSignals.length, 0)
  );
  readonly signalStatsComputedTotal = computed(() =>
    [...this.signalMap().values()].reduce((s, e) => s + e.computedSignals.length, 0)
  );
  readonly signalInputTotalCount = computed(() =>
    (this.data()?.components ?? []).reduce((s, c) => s + c.signalInputs.length, 0)
  );
  readonly modelInputTotalCount = computed(() =>
    (this.data()?.components ?? []).reduce((s, c) => s + c.modelInputs.length, 0)
  );
  readonly signalInputComponentCount = computed(() =>
    (this.data()?.components ?? []).filter(
      c => c.signalInputs.length + c.modelInputs.length > 0
    ).length
  );

  readonly isExternalPkg = isExternalPkg;
  readonly shortPath = shortPath;
}

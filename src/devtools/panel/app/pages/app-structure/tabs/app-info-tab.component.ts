import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import type { EnvironmentEntry } from '../../../../../../types/app-structure';
import type { BootstrapConfigFeature } from '../../../../../../types/app-structure';
import { configFeatureClass } from './tab-utils';

@Component({
  selector: 'app-app-info-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-info-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class AppInfoTabComponent {
  private readonly state = inject(PanelState);
  readonly searchQuery = input('');

  readonly data = this.state.appStructure;

  readonly filteredEnvironments = computed<EnvironmentEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.environments ?? [];
    return q ? items.filter(e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)) : items;
  });

  readonly configFeatureClass = configFeatureClass;
}

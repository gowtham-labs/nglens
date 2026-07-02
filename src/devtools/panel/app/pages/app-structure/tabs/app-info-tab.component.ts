import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import type { EnvironmentEntry, BootstrapConfigFeature } from '../../../../../../types/app-structure';
import { configFeatureClass } from './tab-utils';

@Component({
  selector: 'app-app-info-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
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

  readonly zoneless = computed(() => this.data()?.performanceDetections?.zonelessReadiness ?? null);
  readonly exprChanged = computed(() => this.data()?.performanceDetections?.expressionChangedErrors ?? null);

  readinessColor(readiness: string): string {
    if (readiness === 'ready') return 'text-green-300';
    if (readiness === 'partial') return 'text-yellow-300';
    return 'text-red-300';
  }
}

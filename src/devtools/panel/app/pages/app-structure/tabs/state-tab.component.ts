import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import type { NgrxEntry, SignalStateEntry, ObservableStateEntry } from '../../../../../../types/app-structure';

@Component({
  selector: 'app-state-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './state-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class StateTabComponent {
  private readonly state = inject(PanelState);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

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

  readonly filteredObservableState = computed<ObservableStateEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.stateManagement.observableState ?? [];
    return q ? items.filter(o => o.className.toLowerCase().includes(q)) : items;
  });
}

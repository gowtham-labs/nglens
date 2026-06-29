import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import type { TokenRegistryEntry } from '../../../../../../types/app-structure';

@Component({
  selector: 'app-tokens-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tokens-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class TokensTabComponent {
  private readonly state = inject(PanelState);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredTokens = computed<TokenRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.tokens ?? [];
    return q ? items.filter(t => t.name.toLowerCase().includes(q)) : items;
  });
}

import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { TokenRegistryEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, isPackageOnly, shortPath } from './tab-utils';

@Component({
  selector: 'app-tokens-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './tokens-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class TokensTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredTokens = computed<TokenRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.tokens ?? [];
    return q ? items.filter(t => t.name.toLowerCase().includes(q)) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly isPackageOnly = isPackageOnly;
  readonly shortPath = shortPath;

  openFile(className: string, filePath: string | null): void {
    // If it's a known constructor token class we try Strategy 0 (inspect),
    // otherwise fallback to scanning files for variable declaration of that InjectionToken
    this.cmd.openClassFileInSources(className, filePath, 'token');
  }

  openProperty(filePath: string | null, propName: string, className: string): void {
    this.cmd.openPropertyInSources(filePath, propName, className);
  }
}

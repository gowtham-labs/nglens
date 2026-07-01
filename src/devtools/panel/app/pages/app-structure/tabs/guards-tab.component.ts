import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { GuardRegistryEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, isPackageOnly, shortPath } from './tab-utils';

@Component({
  selector: 'app-guards-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './guards-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class GuardsTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredGuards = computed<GuardRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.guards ?? [];
    return q ? items.filter(g => g.className.toLowerCase().includes(q)) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly isPackageOnly = isPackageOnly;
  readonly shortPath = shortPath;

  openFile(className: string, filePath: string | null): void {
    this.cmd.openClassFileInSources(className, filePath || null, 'guard');
  }

  openProperty(filePath: string | null, propName: string, className: string): void {
    this.cmd.openPropertyInSources(filePath, propName, className);
  }
}

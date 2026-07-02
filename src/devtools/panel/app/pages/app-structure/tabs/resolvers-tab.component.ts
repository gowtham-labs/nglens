import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { ResolverRegistryEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, isPackageOnly, shortPath } from './tab-utils';

@Component({
  selector: 'app-resolvers-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resolvers-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class ResolversTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredResolvers = computed<ResolverRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.resolvers ?? [];
    return q ? items.filter(r => r.className.toLowerCase().includes(q)) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly isPackageOnly = isPackageOnly;
  readonly shortPath = shortPath;

  openInSources(resolver: ResolverRegistryEntry): void {
    this.cmd.openClassFileInSources(resolver.className, resolver.filePath, 'resolver');
  }

  openProperty(filePath: string | null, propName: string, className: string): void {
    this.cmd.openPropertyInSources(filePath, propName, className);
  }
}

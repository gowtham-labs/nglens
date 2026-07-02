import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { PipeRegistryEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, shortPath } from './tab-utils';

@Component({
  selector: 'app-pipes-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './pipes-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class PipesTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredPipes = computed<PipeRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.pipes ?? [];
    return q ? items.filter(p => p.name.toLowerCase().includes(q) || p.className.toLowerCase().includes(q)) : items;
  });

  /** Subset of filteredPipes that are impure — shown in the performance issues section */
  readonly impurePipeIssues = computed(() => this.filteredPipes().filter(p => !p.pure));

  readonly isExternalPkg = isExternalPkg;
  readonly shortPath = shortPath;

  openFile(className: string, filePath: string | null): void {
    this.cmd.openClassFileInSources(className, filePath, 'pipe');
  }
}

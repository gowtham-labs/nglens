import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { DirectiveRegistryEntry, HostListenerIssue } from '../../../../../../types/app-structure';
import { isExternalPkg, isPackageOnly, shortPath } from './tab-utils';

@Component({
  selector: 'app-directives-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './directives-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class DirectivesTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredDirectives = computed<DirectiveRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.directives ?? [];
    return q ? items.filter(d => d.className.toLowerCase().includes(q) || d.selector.toLowerCase().includes(q)) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly isPackageOnly = isPackageOnly;
  readonly shortPath = shortPath;

  openFile(className: string, filePath: string | null): void {
    this.cmd.openClassFileInSources(className, filePath, 'directive');
  }

  openProperty(filePath: string | null, propName: string, className: string): void {
    this.cmd.openPropertyInSources(filePath, propName, className);
  }

  getTransitiveDependencies(className: string): string[] {
    const allDirs = this.data()?.directives ?? [];
    const allComps = this.data()?.components ?? [];
    const dirMap = new Map<string, typeof allDirs[0] | typeof allComps[0]>();
    for (const d of allDirs) dirMap.set(d.className, d);
    for (const c of allComps) dirMap.set(c.className, c);

    const visited = new Set<string>();
    const queue = [...(dirMap.get(className)?.dependencies ?? [])];

    for (const d of queue) {
      if (!visited.has(d)) {
        visited.add(d);
        const childObj = dirMap.get(d);
        if (childObj?.dependencies) {
          for (const cd of childObj.dependencies) {
            if (!visited.has(cd)) queue.push(cd);
          }
        }
      }
    }

    return Array.from(visited);
  }

  openInSources(className: string): void {
    this.cmd.openInSources(className);
  }

  /** High-frequency &#64;HostListener issues for components AND directives */
  readonly hostListeners = computed<HostListenerIssue[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.performanceDetections?.hostListenerIssues ?? [];
    return q
      ? items.filter(i =>
          i.className.toLowerCase().includes(q) ||
          i.events.some(e => e.includes(q)),
        )
      : items;
  });
}

import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import type { DirectiveRegistryEntry, HostListenerIssue } from '../../../../../../types/app-structure';
import { isExternalPkg, shortPath } from './tab-utils';

@Component({
  selector: 'app-directives-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './directives-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class DirectivesTabComponent {
  private readonly state = inject(PanelState);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly filteredDirectives = computed<DirectiveRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.directives ?? [];
    return q ? items.filter(d => d.className.toLowerCase().includes(q) || d.selector.toLowerCase().includes(q)) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly shortPath = shortPath;

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

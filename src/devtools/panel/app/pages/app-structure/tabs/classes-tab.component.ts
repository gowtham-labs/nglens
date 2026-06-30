import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { PlainClassEntry } from '../../../../../../types/app-structure';
import { isExternalPkg, shortPath } from './tab-utils';

@Component({
  selector: 'app-classes-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './classes-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class ClassesTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  readonly compiletimeNotes = [
    { name: 'interface',  reason: 'TypeScript interfaces are erased at compile time and produce no runtime artifact. They cannot be introspected.' },
    { name: 'enum',       reason: 'TypeScript enums compile to plain JS objects. They are indistinguishable from other objects at runtime without source-map analysis.' },
    { name: 'web-worker', reason: 'Web Workers run in an isolated thread context and are not accessible from the DevTools panel. Inspect them via Chrome DevTools → Sources → Workers.' },
  ] as const;

  readonly filteredPlainClasses = computed<PlainClassEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.plainClasses ?? [];
    return q ? items.filter(c => c.className.toLowerCase().includes(q)) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly shortPath = shortPath;

  openFile(className: string, filePath: string | null): void {
    this.cmd.openClassFileInSources(className, filePath, 'class');
  }
}

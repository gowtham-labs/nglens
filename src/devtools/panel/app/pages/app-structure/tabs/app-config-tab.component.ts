import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type { AppProviderEntry } from '../../../../../../types/app-structure';

@Component({
  selector: 'app-app-config-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-config-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class AppConfigTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');
  readonly data = this.state.appStructure;

  private static readonly PROVIDER_CATEGORY_LABELS: Record<string, string> = {
    app: 'App-Defined', router: 'Routing', http: 'HTTP Client',
    forms: 'Forms', animations: 'Animations', security: 'Security',
    i18n: 'Internationalization', core: 'Angular Core', other: 'Other',
  };

  readonly groupedAppProviders = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const items = (this.data()?.appProviders ?? []).filter(
      p => !q || p.name.toLowerCase().includes(q)
    );
    const groups = new Map<string, AppProviderEntry[]>();
    for (const p of items) {
      const label = AppConfigTabComponent.PROVIDER_CATEGORY_LABELS[p.category] ?? p.category;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(p);
    }
    return [...groups.entries()].map(([label, providers]) => ({ label, providers }));
  });

  openInSources(providerName: string, kind: 'class' | 'token' | 'multi'): void {
    // If it's a class or token, we have a providerName which is the class/token constructor name.
    // We can open it in Sources.
    const suffix = kind === 'class' ? 'service' : 'token';
    this.cmd.openClassFileInSources(providerName, null, suffix);
  }

  openProperty(filePath: string | null, propName: string, className: string): void {
    this.cmd.openPropertyInSources(filePath, propName, className);
  }
}

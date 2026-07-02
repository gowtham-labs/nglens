import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { PanelState } from '../../../state/panel.state';
import { CommandService } from '../../../services/command.service';
import type {
  ComponentRegistryEntry, SignalStateEntry,
  CdStrategyMismatchEntry, CdRefAbuseEntry, HeavyLifecycleHookEntry, OnPushInputMutationRisk,
  LargeListDetection, ImportBloatEntry, DeferOpportunityEntry, AnimationIssueEntry,
  FormsMixingEntry, QueryListOveruseEntry,
  TemplateFunctionCallEntry, NgForWithoutTrackByEntry, SubscriptionLeakEntry,
  DeepNestingEntry, DirectDomManipulationEntry,
} from '../../../../../../types/app-structure';
import { isExternalPkg, isPackageOnly, shortPath } from './tab-utils';

@Component({
  selector: 'app-components-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './components-tab.component.html',
  styleUrl: '../app-structure.component.css',
})
export class ComponentsTabComponent {
  private readonly state = inject(PanelState);
  private readonly cmd = inject(CommandService);
  readonly searchQuery = input('');

  readonly data = this.state.appStructure;

  readonly filteredComponents = computed<ComponentRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.data()?.components ?? [];
    return q ? items.filter(c => c.className.toLowerCase().includes(q) || c.selector.toLowerCase().includes(q)) : items;
  });

  readonly signalMap = computed(() => {
    const map = new Map<string, SignalStateEntry>();
    for (const entry of this.data()?.stateManagement.signalState ?? []) {
      map.set(entry.className, entry);
    }
    return map;
  });

  readonly filteredModelComponents = computed<ComponentRegistryEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = (this.data()?.components ?? []).filter(c => c.modelInputs.length > 0);
    return q ? items.filter(c =>
      c.className.toLowerCase().includes(q) ||
      c.modelInputs.some(m => m.toLowerCase().includes(q))
    ) : items;
  });

  readonly isExternalPkg = isExternalPkg;
  readonly isPackageOnly = isPackageOnly;
  readonly shortPath = shortPath;

  /** Shared accessor for performance detections */
  private readonly pd = computed(() => this.data()?.performanceDetections ?? null);

  // ── Change Detection ─────────────────────────────────────────────────────
  readonly cdMismatches = computed<CdStrategyMismatchEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.cdStrategyMismatches ?? [];
    return q ? items.filter(i =>
      i.childClassName.toLowerCase().includes(q) || i.parentClassName.toLowerCase().includes(q),
    ) : items;
  });

  readonly cdRefAbuse = computed<CdRefAbuseEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.cdRefAbuse ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  readonly heavyHooks = computed<HeavyLifecycleHookEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.heavyLifecycleHooks ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  readonly onPushRisks = computed<OnPushInputMutationRisk[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.onPushInputMutationRisks ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q) || i.selector.toLowerCase().includes(q)) : items;
  });

  // ── Templates & Rendering ────────────────────────────────────────────────
  readonly largeLists = computed<LargeListDetection[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.largeListDetections ?? [];
    return q ? items.filter(i => i.componentName.toLowerCase().includes(q) || i.selector.toLowerCase().includes(q)) : items;
  });

  readonly importBloat = computed<ImportBloatEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.importBloat ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q) || i.moduleImports.some(m => m.toLowerCase().includes(q))) : items;
  });

  readonly deferOpps = computed<DeferOpportunityEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.deferOpportunities ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q) || i.selector.toLowerCase().includes(q)) : items;
  });

  // ── Animations ───────────────────────────────────────────────────────────
  readonly animationIssues = computed<AnimationIssueEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.animationIssues ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q) || i.selector.toLowerCase().includes(q)) : items;
  });

  // ── Forms & Queries ───────────────────────────────────────────────────────
  readonly formsMixing = computed<FormsMixingEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.formsMixing ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  readonly queryListOveruse = computed<QueryListOveruseEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.queryListOveruse ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  // ── New Detections (N1, N2, N5, N8, N14) ─────────────────────────────────
  readonly templateFunctionCalls = computed<TemplateFunctionCallEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.templateFunctionCalls ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q) || i.selector.toLowerCase().includes(q)) : items;
  });

  readonly ngForWithoutTrackBy = computed<NgForWithoutTrackByEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.ngForWithoutTrackBy ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q) || i.selector.toLowerCase().includes(q)) : items;
  });

  readonly subscriptionLeaks = computed<SubscriptionLeakEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.subscriptionLeaks ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  readonly deepNesting = computed<DeepNestingEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.deepNesting ?? [];
    return q ? items.filter(i => i.leafClassName.toLowerCase().includes(q) || i.leafSelector.toLowerCase().includes(q)) : items;
  });

  readonly directDomManipulation = computed<DirectDomManipulationEntry[]>(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.pd()?.directDomManipulation ?? [];
    return q ? items.filter(i => i.className.toLowerCase().includes(q)) : items;
  });

  /** Opens the component source file in the DevTools Sources panel. */
  openFile(filePath: string | null, className: string): void {
    this.cmd.openClassFileInSources(className, filePath, 'component');
  }

  /**
   * Opens the source file at the line where `propName` is first declared.
   * Falls back to the file top when the property cannot be located.
   */
  openProperty(filePath: string | null, propName: string, className: string): void {
    this.cmd.openPropertyInSources(filePath, propName, className);
  }

  /** Formats signal property names for a tooltip, labelling underscore-prefixed ones as private. */
  signalTooltip(names: string[]): string {
    const pub  = names.filter(n => !n.startsWith('_'));
    const priv = names.filter(n =>  n.startsWith('_'));
    const parts: string[] = [];
    if (pub.length)  parts.push(pub.join(', '));
    if (priv.length) parts.push('private: ' + priv.join(', '));
    return parts.join(' | ');
  }

  privateCount(names: string[]): number {
    return names.filter(n => n.startsWith('_')).length;
  }

  /**
   * Resolves the full transitive dependent components/directives hierarchy for a given component.
   * Walks component dependencies recursively to build a complete dependency graph.
   */
  getTransitiveDependencies(className: string): string[] {
    const allComps = this.data()?.components ?? [];
    const compMap = new Map<string, typeof allComps[0]>();
    for (const c of allComps) {
      compMap.set(c.className, c);
    }

    const visited = new Set<string>();
    const queue = [...(compMap.get(className)?.dependencies ?? [])];

    for (const d of queue) {
      if (!visited.has(d)) {
        visited.add(d);
        const childObj = compMap.get(d);
        if (childObj?.dependencies) {
          for (const cd of childObj.dependencies) {
            if (!visited.has(cd)) queue.push(cd);
          }
        }
      }
    }

    return Array.from(visited);
  }

  /**
   * Opens the source code of any class or component in the Sources panel.
   */
  openInSources(className: string): void {
    this.cmd.openInSources(className);
  }
}
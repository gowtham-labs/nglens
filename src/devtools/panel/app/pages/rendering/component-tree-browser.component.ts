import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PanelState } from '../../state/panel.state';
import type { ComponentStats } from '../../../../../types/panel';
import { displayName } from '../../utils/display-name';

interface TreeNode {
  componentName: string;
  stats: ComponentStats | null;
  children: TreeNode[];
  isExpanded: boolean;
  depth: number;
  renderCount: number;
  averageDuration: number;
}

@Component({
  selector: 'app-component-tree-browser',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Component Hierarchy</h3>
          <p class="text-xs text-gray-400 mt-1">Interactive tree of all tracked components and their relationships</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="expandAll()"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Expand All
          </button>
          <button
            (click)="collapseAll()"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      <!-- Search -->
      <input
        type="text"
        [(ngModel)]="searchText"
        placeholder="Filter components..."
        class="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />

      <!-- Tree View -->
      <div class="max-h-96 overflow-auto bg-gray-900/30 rounded p-2 space-y-0.5 font-mono text-xs">
        @if (filteredTree().length === 0) {
          <div class="text-sm text-gray-500 p-8 text-center">
            <div class="text-gray-600 mb-1">🌳</div>
            No components tracked yet. Start tracking and interact with the page.
          </div>
        } @else {
          @for (node of filteredTree(); track node.componentName) {
            <app-component-tree-node
              [node]="node"
              [searchText]="searchText"
              (toggleExpand)="toggleNode($event)"
            ></app-component-tree-node>
          }
        }
      </div>

      <!-- Stats Summary -->
      <div class="grid grid-cols-4 gap-3 text-xs pt-4 border-t border-gray-700">
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Total Components</div>
          <div class="text-lg font-semibold text-gray-100">{{ treeStats().totalComponents }}</div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Max Depth</div>
          <div class="text-lg font-semibold text-gray-100">{{ treeStats().maxDepth }}</div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Total Renders</div>
          <div class="text-lg font-semibold text-gray-100">{{ treeStats().totalRenders }}</div>
        </div>
        <div class="p-2 rounded bg-gray-700/40">
          <div class="text-gray-400 mb-1">Avg Duration</div>
          <div class="text-lg font-semibold text-gray-100">{{ treeStats().avgDuration.toFixed(2) }}<span class="text-xs">ms</span></div>
        </div>
      </div>
    </div>
  `,
})
export class ComponentTreeBrowserComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;

  readonly searchText = signal('');
  private treeNodes = new Map<string, TreeNode>();

  readonly componentTree = computed(() => {
    const stats = this.state.componentStats();
    this.treeNodes.clear();

    // Create nodes
    for (const stat of stats) {
      if (!this.treeNodes.has(stat.componentName)) {
        this.treeNodes.set(stat.componentName, {
          componentName: stat.componentName,
          stats: stat,
          children: [],
          isExpanded: false,
          depth: 0,
          renderCount: stat.renderCount,
          averageDuration: stat.averageDuration,
        });
      }
    }

    // For now, return root nodes (in a real scenario, we'd build parent-child relationships)
    return Array.from(this.treeNodes.values()).sort((a, b) => b.renderCount - a.renderCount);
  });

  readonly filteredTree = computed(() => {
    const tree = this.componentTree();
    const search = this.searchText().toLowerCase();

    if (!search) return tree;

    const filtered: TreeNode[] = [];
    for (const node of tree) {
      if (this.matchesSearch(node, search)) {
        filtered.push(node);
      }
    }
    return filtered;
  });

  readonly treeStats = computed(() => {
    const stats = this.state.componentStats();
    if (stats.length === 0) {
      return {
        totalComponents: 0,
        maxDepth: 0,
        totalRenders: 0,
        avgDuration: 0,
      };
    }

    const totalRenders = stats.reduce((sum, s) => sum + s.renderCount, 0);
    const avgDuration = stats.reduce((sum, s) => sum + s.averageDuration, 0) / stats.length;

    return {
      totalComponents: stats.length,
      maxDepth: 1, // Would be calculated from actual tree depth
      totalRenders,
      avgDuration,
    };
  });

  private matchesSearch(node: TreeNode, search: string): boolean {
    if (node.componentName.toLowerCase().includes(search)) {
      return true;
    }
    for (const child of node.children) {
      if (this.matchesSearch(child, search)) {
        return true;
      }
    }
    return false;
  }

  toggleNode(componentName: string): void {
    const node = this.treeNodes.get(componentName);
    if (node) {
      node.isExpanded = !node.isExpanded;
    }
  }

  expandAll(): void {
    for (const node of this.treeNodes.values()) {
      node.isExpanded = true;
    }
  }

  collapseAll(): void {
    for (const node of this.treeNodes.values()) {
      node.isExpanded = false;
    }
  }
}

/**
 * Tree node component for rendering individual nodes
 */
@Component({
  selector: 'app-component-tree-node',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [style.margin-left.px]="node.depth * 16" class="select-none">
      <div
        class="flex items-center gap-2 p-2 rounded hover:bg-gray-700/40 transition-colors cursor-pointer group"
        (click)="onToggle()"
      >
        <!-- Expand/Collapse Icon -->
        @if (node.children.length > 0) {
          <span class="w-4 text-center text-gray-500 text-xs">{{ node.isExpanded ? '▼' : '▶' }}</span>
        } @else {
          <span class="w-4"></span>
        }

        <!-- Component Icon -->
        <span class="text-xs text-blue-400">◯</span>

        <!-- Component Name -->
        <span class="font-medium text-gray-200 group-hover:text-gray-100 truncate flex-1">
          {{ displayName(node.componentName) }}
        </span>

        <!-- Render Stats Badge -->
        <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 whitespace-nowrap">
          {{ node.renderCount }} renders
        </span>

        <!-- Duration Badge -->
        <span
          class="text-[10px] px-2 py-0.5 rounded whitespace-nowrap"
          [ngClass]="getDurationClass(node.averageDuration)"
        >
          {{ node.averageDuration.toFixed(2) }}ms
        </span>
      </div>

      <!-- Children -->
      @if (node.isExpanded && node.children.length > 0) {
        <div>
          @for (child of node.children; track child.componentName) {
            <app-component-tree-node
              [node]="child"
              [searchText]="searchText"
              (toggleExpand)="onToggle()"
            ></app-component-tree-node>
          }
        </div>
      }
    </div>
  `,
})
export class ComponentTreeNodeComponent {
  node!: TreeNode;
  searchText = '';
  readonly displayName = displayName;

  toggleExpand = signal(false);

  onToggle(): void {
    this.node.isExpanded = !this.node.isExpanded;
    this.toggleExpand.set(!this.toggleExpand());
  }

  getDurationClass(duration: number): string {
    if (duration > 10) return 'bg-red-500/20 border border-red-500/40 text-red-300';
    if (duration > 5) return 'bg-orange-500/20 border border-orange-500/40 text-orange-300';
    if (duration > 2) return 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-300';
    return 'bg-green-500/20 border border-green-500/40 text-green-300';
  }
}

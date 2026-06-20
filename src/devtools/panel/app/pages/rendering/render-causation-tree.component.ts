import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelState } from '../../state/panel.state';
import type { RenderEvent, RenderCause } from '../../../../../types/render-events';
import { displayName } from '../../utils/display-name';

interface CausationNode {
  componentName: string;
  renders: number;
  totalDuration: number;
  averageDuration: number;
  primaryCause: RenderCause['type'] | 'unknown';
  isRoot: boolean;
  children: CausationNode[];
  parent: CausationNode | null;
  depth: number;
}

interface CausationChain {
  sequence: string[]; // Component names in order
  frequency: number;
  totalDuration: number;
  pattern: string; // Human readable pattern
}

@Component({
  selector: 'app-render-causation-tree',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border border-gray-700 rounded-lg p-4 bg-gray-800/40 backdrop-blur-sm space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-100">Render Causation Chains</h3>
          <p class="text-xs text-gray-400 mt-1">How renders cascade from one component to another</p>
        </div>
        <div class="flex gap-2">
          <button
            (click)="viewMode.set('chains')"
            [ngClass]="viewMode() === 'chains' ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            Chains
          </button>
          <button
            (click)="viewMode.set('tree')"
            [ngClass]="viewMode() === 'tree' ? 'bg-blue-600' : 'bg-gray-700'"
            class="px-3 py-1 rounded text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
          >
            Tree
          </button>
        </div>
      </div>

      <!-- Chains View -->
      @if (viewMode() === 'chains') {
        <div class="space-y-2 max-h-96 overflow-auto bg-gray-900/30 rounded p-2">
          @if (causationChains().length === 0) {
            <div class="text-sm text-gray-500 p-8 text-center">
              <div class="text-gray-600 mb-1">🔗</div>
              No render causation patterns detected yet. Continue tracking.
            </div>
          } @else {
            @for (chain of causationChains().slice(0, 20); track chain.sequence.join('-'); let i = $index) {
              <div class="p-3 rounded bg-gray-700/40 hover:bg-gray-700/60 transition-colors border border-gray-600/30 group cursor-pointer">
                <div class="flex items-center justify-between mb-2">
                  <div class="text-xs font-semibold text-gray-200">Pattern {{ i + 1 }}</div>
                  <span class="text-[10px] px-2 py-1 rounded bg-gray-600 text-gray-300">{{ chain.frequency }}x</span>
                </div>

                <!-- Causation Flow -->
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                  @for (component of chain.sequence; track component; let last = $last) {
                    <div class="flex items-center gap-2">
                      <div class="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/40 text-xs text-blue-300 font-medium truncate max-w-[180px]">
                        {{ displayName(component) }}
                      </div>
                      @if (!last) {
                        <div class="text-gray-500">→</div>
                      }
                    </div>
                  }
                </div>

                <!-- Stats -->
                <div class="grid grid-cols-3 gap-2 text-xs">
                  <div class="p-1.5 rounded bg-gray-800/50">
                    <div class="text-gray-500">Total Duration</div>
                    <div class="text-sm font-semibold text-gray-200">{{ chain.totalDuration.toFixed(1) }}ms</div>
                  </div>
                  <div class="p-1.5 rounded bg-gray-800/50">
                    <div class="text-gray-500">Per Chain</div>
                    <div class="text-sm font-semibold text-gray-200">{{ (chain.totalDuration / chain.frequency).toFixed(1) }}ms</div>
                  </div>
                  <div class="p-1.5 rounded bg-gray-800/50">
                    <div class="text-gray-500">Depth</div>
                    <div class="text-sm font-semibold text-gray-200">{{ chain.sequence.length }} steps</div>
                  </div>
                </div>

                <!-- Warning if deep cascade -->
                @if (chain.sequence.length > 3) {
                  <div class="mt-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                    ⚠️ Deep cascade detected. Consider optimizing parent change detection.
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <!-- Tree View -->
      @if (viewMode() === 'tree') {
        <div class="space-y-2 max-h-96 overflow-auto bg-gray-900/30 rounded p-2">
          @if (treeRoots().length === 0) {
            <div class="text-sm text-gray-500 p-8 text-center">
              <div class="text-gray-600 mb-1">🌳</div>
              No component hierarchy detected yet.
            </div>
          } @else {
            @for (root of treeRoots(); track root.componentName) {
              <div class="border border-gray-600/30 rounded overflow-hidden bg-gray-700/20">
                <app-causation-tree-node
                  [node]="root"
                  [depth]="0"
                ></app-causation-tree-node>
              </div>
            }
          }
        </div>
      }

      <!-- Summary Stats -->
      @if (chainStats(); as stats) {
        <div class="grid grid-cols-4 gap-3 text-xs pt-4 border-t border-gray-700">
          <div class="p-2 rounded bg-gray-700/40">
            <div class="text-gray-400 mb-1">Total Chains</div>
            <div class="text-lg font-semibold text-gray-100">{{ stats.totalChains }}</div>
          </div>
          <div class="p-2 rounded bg-gray-700/40">
            <div class="text-gray-400 mb-1">Avg Depth</div>
            <div class="text-lg font-semibold text-gray-100">{{ stats.avgDepth.toFixed(1) }}</div>
          </div>
          <div class="p-2 rounded bg-gray-700/40">
            <div class="text-gray-400 mb-1">Max Depth</div>
            <div class="text-lg font-semibold text-gray-100">{{ stats.maxDepth }}</div>
          </div>
          <div class="p-2 rounded bg-gray-700/40">
            <div class="text-gray-400 mb-1">Avg Duration</div>
            <div class="text-lg font-semibold text-gray-100">{{ stats.avgDuration.toFixed(2) }}<span class="text-xs">ms</span></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class RenderCausationTreeComponent {
  readonly state = inject(PanelState);
  readonly displayName = displayName;

  readonly viewMode = signal<'chains' | 'tree'>('chains');

  readonly causationChains = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) return [];

    // Group events by time windows (200ms buckets)
    const buckets = new Map<number, RenderEvent[]>();
    const bucketSize = 200;

    for (const event of events) {
      const bucketKey = Math.floor(event.timestamp / bucketSize);
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(event);
    }

    // Extract chains from each bucket
    const chains = new Map<string, CausationChain>();

    for (const bucket of buckets.values()) {
      // Sort by timestamp to get sequence
      const sorted = bucket.sort((a, b) => a.timestamp - b.timestamp);

      // Create chains from parent-caused renders
      let chain: string[] = [];
      let chainDuration = 0;

      for (const event of sorted) {
        const isParentCaused = event.causes.some(c => c.type === 'parent');

        if (isParentCaused && chain.length > 0) {
          chain.push(event.componentName);
          chainDuration += event.duration;
        } else if (!isParentCaused && chain.length > 0) {
          // End of chain
          if (chain.length > 1) {
            const key = chain.join('→');
            if (chains.has(key)) {
              const existing = chains.get(key)!;
              existing.frequency++;
              existing.totalDuration += chainDuration;
            } else {
              chains.set(key, {
                sequence: [...chain],
                frequency: 1,
                totalDuration: chainDuration,
                pattern: chain.map(c => displayName(c)).join(' → '),
              });
            }
          }
          chain = [];
          chainDuration = 0;
        } else if (!isParentCaused) {
          chain = [event.componentName];
          chainDuration = event.duration;
        }
      }

      // Handle trailing chain
      if (chain.length > 1) {
        const key = chain.join('→');
        if (chains.has(key)) {
          const existing = chains.get(key)!;
          existing.frequency++;
          existing.totalDuration += chainDuration;
        } else {
          chains.set(key, {
            sequence: [...chain],
            frequency: 1,
            totalDuration: chainDuration,
            pattern: chain.map(c => displayName(c)).join(' → '),
          });
        }
      }
    }

    // Sort by frequency
    return Array.from(chains.values()).sort((a, b) => b.frequency - a.frequency);
  });

  readonly treeRoots = computed(() => {
    const events = this.state.renderEvents();
    if (events.length === 0) return [];

    // Build tree structure by finding parent causes
    const nodes = new Map<string, CausationNode>();

    for (const event of events) {
      if (!nodes.has(event.componentName)) {
        nodes.set(event.componentName, {
          componentName: event.componentName,
          renders: 0,
          totalDuration: 0,
          averageDuration: 0,
          primaryCause: 'unknown',
          isRoot: true,
          children: [],
          parent: null,
          depth: 0,
        });
      }

      const node = nodes.get(event.componentName)!;
      node.renders++;
      node.totalDuration += event.duration;
      node.primaryCause = event.causes[0]?.type || 'unknown';
    }

    // Update averages
    for (const node of nodes.values()) {
      node.averageDuration = node.totalDuration / node.renders;
    }

    // Build parent-child relationships
    for (const event of events) {
      const node = nodes.get(event.componentName)!;
      for (const cause of event.causes) {
        if (cause.type === 'parent' && cause.source) {
          const parentNode = nodes.get(cause.source);
          if (parentNode && parentNode !== node) {
            node.isRoot = false;
            node.parent = parentNode;
            if (!parentNode.children.includes(node)) {
              parentNode.children.push(node);
            }
            break;
          }
        }
      }
    }

    // Return roots only
    return Array.from(nodes.values()).filter(n => n.isRoot);
  });

  readonly chainStats = computed(() => {
    const chains = this.causationChains();
    if (chains.length === 0) {
      return {
        totalChains: 0,
        avgDepth: 0,
        maxDepth: 0,
        avgDuration: 0,
      };
    }

    const depths = chains.map(c => c.sequence.length);
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
    const maxDepth = Math.max(...depths);
    const avgDuration = chains.reduce((sum, c) => sum + c.totalDuration, 0) / chains.length;

    return {
      totalChains: chains.length,
      avgDepth,
      maxDepth,
      avgDuration,
    };
  });
}

/**
 * Recursive component for rendering tree nodes
 */
@Component({
  selector: 'app-causation-tree-node',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [style.padding-left.px]="depth * 16">
      <div
        class="p-2 border-b border-gray-600/20 hover:bg-gray-600/20 transition-colors cursor-pointer"
        [ngClass]="{ 'bg-blue-500/10': depth === 0, 'bg-purple-500/5': depth > 0 }"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-gray-200 truncate">
              {{ node.componentName | slice: 0:30 }}
            </div>
            <div class="text-[10px] text-gray-500 mt-0.5 space-x-2">
              <span>{{ node.renders }} renders</span>
              <span>{{ node.totalDuration.toFixed(1) }}ms</span>
              <span>{{ node.averageDuration.toFixed(2) }}ms avg</span>
            </div>
          </div>
          <span
            class="text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
            [ngClass]="getCauseColor(node.primaryCause)"
          >
            {{ node.primaryCause }}
          </span>
        </div>
      </div>

      @if (node.children.length > 0) {
        <div>
          @for (child of node.children; track child.componentName) {
            <app-causation-tree-node [node]="child" [depth]="depth + 1"></app-causation-tree-node>
          }
        </div>
      }
    </div>
  `,
})
export class CausationTreeNodeComponent {
  node!: CausationNode;
  depth = 0;

  getCauseColor(cause: RenderCause['type'] | 'unknown'): string {
    switch (cause) {
      case 'parent':
        return 'bg-purple-600/80 text-purple-100';
      case 'input':
        return 'bg-blue-600/80 text-blue-100';
      case 'zone':
        return 'bg-red-600/80 text-red-100';
      case 'signal':
        return 'bg-green-600/80 text-green-100';
      case 'manual-cd':
        return 'bg-amber-600/80 text-amber-100';
      default:
        return 'bg-gray-600 text-gray-200';
    }
  }
}

/**
 * Production Analyzer — DOM-based heuristics for Angular performance analysis
 * when `window.ng` is unavailable (production builds).
 *
 * Infers component boundaries from Angular-specific DOM attributes,
 * estimates tree depth, detects excessive DOM complexity, and measures
 * DOM mutation frequency to identify components with excessive re-renders.
 */

import { BaseAnalyzer } from './base-analyzer';
import { registerAnalyzer } from './index';
import type {
  AnalyzerConfig,
  AnalyzerResult,
  AnalyzerType,
  AnalysisIssue,
} from '../types/analyzer';
import {
  findAngularComponents,
  countSubtreeNodes,
  calculateComponentDepth,
  getComponentName,
  hasAngularAttribute,
} from '../utils/dom-utils';
import {
  DOM_NODE_LIMIT_CRITICAL,
  MAX_TREE_DEPTH,
  MUTATION_RATE_THRESHOLD,
  MUTATION_OBSERVATION_WINDOW_S,
} from '../utils/constants';
import { createBatchedMutationObserver } from '../utils/sampling';
import { registerObserver } from '../utils/performance-budget';
import { now } from '../utils/timing';

/**
 * Tracks mutation counts per component region during the observation window.
 */
interface MutationRegion {
  componentName: string;
  elementSelector: string;
  mutationCount: number;
}

export class ProductionAnalyzer extends BaseAnalyzer {
  readonly type: AnalyzerType = 'production-analyzer';
  readonly requiresDevMode: boolean = false;

  protected async execute(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const startTime = now();
    const issues: AnalysisIssue[] = [];

    // Check if any Angular attributes exist in the DOM
    const hasAngularApp = this.detectAngularPresence();

    if (!hasAngularApp) {
      // Requirement 3.6: report no Angular application detected
      issues.push({
        id: 'prod-no-angular-detected',
        analyzer: this.type,
        component: 'document',
        severity: 'info',
        category: 'dom-complexity',
        title: 'No Angular application detected',
        description:
          'No Angular-specific attributes (_ngcontent-*, _nghost-*, ng-reflect-*, ng-version) were found on any DOM element and window.ng is unavailable.',
        recommendation:
          'Ensure this page contains an Angular application, or run in development mode for full analysis.',
        metadata: { reason: 'no-angular-attributes' },
      });

      return {
        analyzer: this.type,
        timestamp: Date.now(),
        duration: now() - startTime,
        issues,
        metadata: { angularDetected: false },
      };
    }

    // Find all Angular component host elements
    const components = findAngularComponents(document);

    // Requirement 3.1: Infer component boundaries
    const componentEntries = components.map((el) => ({
      element: el,
      name: getComponentName(el),
      selector: this.buildSelector(el),
    }));

    // Requirement 3.2: Estimate component tree depth (max 512)
    const treeDepth = calculateComponentDepth(document.documentElement, MAX_TREE_DEPTH);

    // Requirement 3.3: Detect excessive DOM node counts (>1500 per component subtree)
    for (const entry of componentEntries) {
      const nodeCount = countSubtreeNodes(entry.element);
      if (nodeCount > DOM_NODE_LIMIT_CRITICAL) {
        issues.push({
          id: `prod-excessive-dom-${entry.name}-${issues.length}`,
          analyzer: this.type,
          component: entry.name,
          severity: 'high',
          category: 'dom-complexity',
          title: `Excessive DOM nodes in ${entry.name}`,
          description: `Component subtree contains ${nodeCount} DOM nodes, exceeding the ${DOM_NODE_LIMIT_CRITICAL} node threshold. Large subtrees cause slow rendering and increased memory usage.`,
          recommendation:
            'Consider breaking this component into smaller sub-components, using virtual scrolling for lists, or lazy-loading content that is not immediately visible.',
          metadata: { nodeCount, threshold: DOM_NODE_LIMIT_CRITICAL },
          elementSelector: entry.selector,
        });
      }
    }

    // Requirement 3.4: Measure DOM mutation frequency via MutationObserver
    const mutationIssues = await this.observeMutationFrequency(componentEntries);
    issues.push(...mutationIssues);

    const duration = now() - startTime;

    return {
      analyzer: this.type,
      timestamp: Date.now(),
      duration,
      issues,
      metadata: {
        angularDetected: true,
        componentCount: componentEntries.length,
        treeDepth,
        mode: 'production',
      },
    };
  }

  /**
   * Checks whether any Angular-specific attributes exist in the DOM.
   */
  private detectAngularPresence(): boolean {
    // Quick check: look for ng-version attribute
    if (document.querySelector('[ng-version]')) {
      return true;
    }

    // Check a sample of elements for Angular attributes
    const allElements = document.querySelectorAll('*');
    const limit = Math.min(allElements.length, 1000);
    for (let i = 0; i < limit; i++) {
      if (hasAngularAttribute(allElements[i])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Observes DOM mutations for the configured observation window and identifies
   * components with excessive mutation rates (>10 mutations/sec over 3s).
   */
  private observeMutationFrequency(
    componentEntries: Array<{ element: Element; name: string; selector: string }>
  ): Promise<AnalysisIssue[]> {
    return new Promise((resolve) => {
      const issues: AnalysisIssue[] = [];
      const regions: Map<Element, MutationRegion> = new Map();

      // Initialize mutation tracking per component
      for (const entry of componentEntries) {
        regions.set(entry.element, {
          componentName: entry.name,
          elementSelector: entry.selector,
          mutationCount: 0,
        });
      }

      const observationWindowMs = MUTATION_OBSERVATION_WINDOW_S * 1000;

      // Create the batched mutation observer
      const handle = createBatchedMutationObserver((mutations: MutationRecord[]) => {
        // Attribute mutations to the nearest component region
        for (const mutation of mutations) {
          const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
          if (!target) continue;
          const ownerComponent = this.findOwnerComponent(target, regions);
          if (ownerComponent) {
            ownerComponent.mutationCount++;
          }
        }
      });

      // Register the underlying observer for auto-disconnect via performance budget
      registerObserver(handle.observer);

      // Start observing the document body
      handle.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      // After the observation window, disconnect and analyze results
      setTimeout(() => {
        // Disconnect within 100ms deadline
        const disconnectStart = now();
        handle.disconnect();
        const disconnectDuration = now() - disconnectStart;

        // Analyze mutation rates
        for (const region of regions.values()) {
          const mutationsPerSecond =
            region.mutationCount / MUTATION_OBSERVATION_WINDOW_S;

          if (mutationsPerSecond > MUTATION_RATE_THRESHOLD) {
            issues.push({
              id: `prod-excessive-mutations-${region.componentName}-${issues.length}`,
              analyzer: this.type,
              component: region.componentName,
              severity: 'medium',
              category: 'render-performance',
              title: `Excessive DOM mutations in ${region.componentName}`,
              description: `Component region experienced ${mutationsPerSecond.toFixed(1)} mutations/sec over ${MUTATION_OBSERVATION_WINDOW_S}s (threshold: ${MUTATION_RATE_THRESHOLD}/sec). This indicates excessive re-rendering.`,
              recommendation:
                'Consider using OnPush change detection, reducing template bindings, or debouncing rapid state updates.',
              metadata: {
                mutationsPerSecond,
                totalMutations: region.mutationCount,
                observationWindowSeconds: MUTATION_OBSERVATION_WINDOW_S,
                threshold: MUTATION_RATE_THRESHOLD,
                disconnectDurationMs: disconnectDuration,
              },
              elementSelector: region.elementSelector,
            });
          }
        }

        resolve(issues);
      }, observationWindowMs);
    });
  }

  /**
   * Finds the component region that owns a given DOM element by walking up
   * the tree to find the nearest tracked component host.
   */
  private findOwnerComponent(
    element: Element,
    regions: Map<Element, MutationRegion>
  ): MutationRegion | null {
    let current: Element | null = element;
    while (current) {
      const region = regions.get(current);
      if (region) {
        return region;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Builds a CSS selector for an element for overlay targeting.
   */
  private buildSelector(element: Element): string {
    const tagName = element.tagName.toLowerCase();

    // Try to use a unique Angular host attribute
    for (const attr of element.attributes) {
      if (attr.name.startsWith('_nghost-')) {
        return `${tagName}[${attr.name}]`;
      }
    }

    // Fall back to tag name with nth-of-type if needed
    if (element.id) {
      return `#${element.id}`;
    }

    return tagName;
  }

  dispose(): void {
    super.dispose();
  }
}

// Auto-register the production analyzer
registerAnalyzer(new ProductionAnalyzer());

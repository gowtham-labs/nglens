/**
 * Enterprise Optimizer Analyzer (V1 Scope)
 *
 * Provides optimization recommendations for large-scale Angular applications.
 * V1 implements two checks:
 * 1. Detect *ngFor/@for without trackBy/track expression
 * 2. Detect components using Default change detection that could use OnPush
 *
 * Requires development mode (window.ng) for full analysis.
 * In production mode, returns an issue listing which checks were skipped.
 *
 * Requirements: 7.6, 7.7
 */

import type {
  AnalyzerConfig,
  AnalyzerResult,
  AnalyzerType,
  AnalysisIssue,
} from '../types/analyzer';
import { BaseAnalyzer } from './base-analyzer';
import { registerAnalyzer } from './index';
import { findAngularComponents, getComponentName } from '../utils/dom-utils';

export class EnterpriseOptimizer extends BaseAnalyzer {
  readonly type: AnalyzerType = 'enterprise-optimizer';
  readonly requiresDevMode = true;

  protected async execute(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const startTime = performance.now();
    const issues: AnalysisIssue[] = [];

    // Handle production mode gracefully (Requirement 7.7)
    if (config.mode === 'production' || !(window as any).ng) {
      const duration = performance.now() - startTime;
      const skippedChecks = [
        'trackBy/track expression detection for *ngFor/@for directives',
        'OnPush change detection strategy recommendation',
      ];

      issues.push({
        id: 'enterprise-optimizer-production-skip',
        analyzer: this.type,
        component: 'Application',
        severity: 'info',
        category: 'change-detection',
        title: 'Enterprise analysis requires development mode',
        description: `Enterprise optimization checks were skipped because Angular debug APIs are unavailable in production mode. Skipped checks: ${skippedChecks.join('; ')}.`,
        recommendation:
          'Run the application in development mode (ng serve) to enable full enterprise optimization analysis.',
        metadata: {
          skippedChecks,
          reason: 'production-mode',
        },
      });

      return {
        analyzer: this.type,
        timestamp: Date.now(),
        duration,
        issues,
        metadata: {
          mode: 'production',
          skippedChecks,
        },
      };
    }

    // Find all Angular components in the DOM
    const components = findAngularComponents();

    // Run V1 checks on each component
    for (const element of components) {
      try {
        const component = (window as any).ng.getComponent(element);
        if (!component) continue;

        const componentName = getComponentName(element);
        const cmp = component.constructor?.ɵcmp;
        if (!cmp) continue;

        // Check 1: Detect *ngFor/@for without trackBy/track (Requirement 7.6)
        this.checkTrackBy(element, component, cmp, componentName, issues);

        // Check 2: Detect Default change detection (recommend OnPush)
        this.checkOnPush(element, cmp, componentName, issues);
      } catch {
        // Skip components that can't be inspected
      }
    }

    const duration = performance.now() - startTime;

    return {
      analyzer: this.type,
      timestamp: Date.now(),
      duration,
      issues,
      metadata: {
        componentsAnalyzed: components.length,
        trackByIssues: issues.filter((i) => i.id.startsWith('missing-track')).length,
        onPushIssues: issues.filter((i) => i.id.startsWith('default-cd')).length,
      },
    };
  }

  /**
   * Detects *ngFor/@for directives without trackBy/track expression.
   *
   * Heuristic approach: inspects the component's template metadata (ɵcmp)
   * for ngForOf directive usage without a corresponding ngForTrackBy binding.
   * Also checks the component's view for embedded views that use ngForOf.
   */
  private checkTrackBy(
    element: Element,
    component: any,
    cmp: any,
    componentName: string,
    issues: AnalysisIssue[]
  ): void {
    // Strategy 1: Check template for ngFor directives via the component's view
    // Look for child elements with ngFor-related attributes in the rendered template
    const ngForElements = element.querySelectorAll(
      '[ng-reflect-ngforof], [ng-reflect-ng-for-of]'
    );

    this.checkNgForReflectAttributes(ngForElements, componentName, issues);

    // Strategy 2: Check the component's template definition for directives
    // This catches cases where ng-reflect attributes are not present
    if (ngForElements.length === 0 && cmp.directiveDefs) {
      this.checkDirectiveDefs(element, cmp, componentName, issues);
    }
  }

  /**
   * Checks ng-reflect attributes on ngFor elements for missing trackBy.
   */
  private checkNgForReflectAttributes(
    ngForElements: NodeListOf<Element>,
    componentName: string,
    issues: AnalysisIssue[]
  ): void {
    for (let i = 0; i < ngForElements.length; i++) {
      const ngForEl = ngForElements[i];
      const hasTrackBy =
        ngForEl.hasAttribute('ng-reflect-ngfortrackby') ||
        ngForEl.hasAttribute('ng-reflect-ng-for-track-by');

      if (!hasTrackBy) {
        const selector = this.buildSelector(ngForEl);
        issues.push(this.buildTrackByIssue(componentName, `${componentName}-${i}`, selector));
      }
    }
  }

  /**
   * Checks component directive definitions for ngFor usage without trackBy.
   */
  private checkDirectiveDefs(
    element: Element,
    cmp: any,
    componentName: string,
    issues: AnalysisIssue[]
  ): void {
    try {
      const directiveDefs =
        typeof cmp.directiveDefs === 'function'
          ? cmp.directiveDefs()
          : cmp.directiveDefs;

      if (!Array.isArray(directiveDefs)) return;

      const hasNgForDirective = directiveDefs.some(
        (def: any) =>
          def?.type?.name === 'NgForOf' ||
          def?.type?.ɵdir?.selectors?.some(
            (s: any) => Array.isArray(s) && s.includes('ngForOf')
          )
      );

      if (hasNgForDirective && !this.hasTrackByInView(element)) {
        const templateLocation = element.tagName.toLowerCase();
        issues.push(
          this.buildTrackByIssue(componentName, `${componentName}-template`, templateLocation)
        );
      }
    } catch {
      // Skip if directive defs can't be inspected
    }
  }

  /**
   * Builds a standard trackBy issue object.
   */
  private buildTrackByIssue(
    componentName: string,
    idSuffix: string,
    templateLocation: string
  ): AnalysisIssue {
    return {
      id: `missing-trackby-${idSuffix}`,
      analyzer: this.type,
      component: componentName,
      severity: 'medium',
      category: 'change-detection',
      title: `*ngFor without trackBy in ${componentName}`,
      description:
        'Using *ngFor or @for without a trackBy function or track expression causes Angular to re-render the entire list on every change detection cycle, which degrades performance for large lists.',
      recommendation:
        'Add a trackBy function that returns a unique identifier for each item. Example: trackBy: trackById where trackById = (index, item) => item.id',
      metadata: {
        directiveType: 'ngFor',
        templateLocation,
      },
      elementSelector: templateLocation,
    };
  }

  /**
   * Checks if the component's view has trackBy bindings set.
   */
  private hasTrackByInView(element: Element): boolean {
    // Check for ng-reflect-ngfortrackby in the component's subtree
    const trackByElements = element.querySelectorAll(
      '[ng-reflect-ngfortrackby], [ng-reflect-ng-for-track-by]'
    );
    return trackByElements.length > 0;
  }

  /**
   * Detects components using Default change detection that could use OnPush.
   * Components with OnPush already set (changeDetection === 1 or onPush === true)
   * are not flagged.
   */
  private checkOnPush(
    element: Element,
    cmp: any,
    componentName: string,
    issues: AnalysisIssue[]
  ): void {
    // Check if the component already uses OnPush
    const isOnPush = cmp.onPush === true || cmp.changeDetection === 1;

    if (!isOnPush) {
      const selector = element.tagName.toLowerCase();
      issues.push({
        id: `default-cd-${componentName}`,
        analyzer: this.type,
        component: componentName,
        severity: 'low',
        category: 'change-detection',
        title: `${componentName} uses Default change detection`,
        description:
          'This component uses the Default change detection strategy, which checks the component on every change detection cycle regardless of whether its inputs changed. Switching to OnPush can significantly reduce unnecessary checks.',
        recommendation:
          'Add changeDetection: ChangeDetectionStrategy.OnPush to the @Component decorator. Ensure the component uses immutable data patterns or observables with the async pipe.',
        metadata: {
          currentStrategy: 'Default',
          recommendedStrategy: 'OnPush',
        },
        elementSelector: selector,
      });
    }
  }

  /**
   * Builds a CSS selector string for an element for overlay targeting.
   */
  private buildSelector(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className
      ? `.${element.className.split(/\s+/).filter(Boolean).join('.')}`
      : '';
    return `${tag}${id}${classes}`;
  }
}

// Auto-register the analyzer
registerAnalyzer(new EnterpriseOptimizer());

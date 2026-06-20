// src/instrumentation/trackby-detector.ts

import type { TrackByIssue } from '../types/recommendation-events';

/**
 * TrackByDetector identifies ngFor directives operating on large collections
 * without a trackBy function. Missing trackBy causes Angular to recreate DOM
 * elements on every change detection cycle instead of reusing them.
 *
 * Implementation approach:
 * 1. Use getAllAngularRootElements() to get root elements
 * 2. Walk the DOM tree looking for elements with __ngContext__
 * 3. For each component view, check for embedded views (ngFor creates embedded views)
 * 4. Access the NgForOf directive instance and check _trackByFn and the iterable length
 */
export class TrackByDetector {
  private collectionThreshold = 100;
  private issueIdCounter = 0;

  /**
   * Sets the collection size threshold above which a missing trackBy
   * triggers a warning. Default is 100.
   */
  setThreshold(threshold: number): void {
    this.collectionThreshold = threshold;
  }

  /**
   * Scans the Angular component tree for NgForOf directives that operate
   * on collections exceeding the configured threshold without a trackBy function.
   *
   * Returns an array of TrackByIssue objects describing each detected issue.
   */
  analyze(): TrackByIssue[] {
    const issues: TrackByIssue[] = [];

    try {
      const rootElements = this.getRootElements();
      for (const rootEl of rootElements) {
        this.walkDomTree(rootEl, issues);
      }
    } catch {
      // If Angular internals are inaccessible, return empty results
    }

    return issues;
  }

  /**
   * Gets all Angular root elements on the page using the global
   * getAllAngularRootElements() function exposed by Angular in dev mode.
   */
  private getRootElements(): Element[] {
    const getAllRootElements = (globalThis as any).getAllAngularRootElements;
    if (typeof getAllRootElements === 'function') {
      return getAllRootElements() ?? [];
    }
    // Fallback: look for elements with ng-version attribute
    return Array.from(document.querySelectorAll('[ng-version]'));
  }

  /**
   * Recursively walks the DOM tree starting from the given element,
   * inspecting each node for Angular context and NgForOf directives.
   */
  private walkDomTree(element: Element, issues: TrackByIssue[]): void {
    this.inspectElement(element, issues);

    const children = element.children;
    for (let i = 0; i < children.length; i++) {
      this.walkDomTree(children[i], issues);
    }
  }

  /**
   * Inspects a single DOM element for Angular context containing
   * NgForOf directive instances without trackBy on large collections.
   */
  private inspectElement(element: Element, issues: TrackByIssue[]): void {
    const ngContext = (element as any).__ngContext__;
    if (ngContext == null) return;

    // Angular stores LView or component context in __ngContext__
    // Angular 17+: LView is an array stored directly
    // Angular 15-16: __ngContext__ is often a number (index into parent LView)
    let lView: any[] | null = null;

    if (Array.isArray(ngContext)) {
      lView = ngContext;
    } else if (typeof ngContext === 'number') {
      // Angular 15-16: numeric index — try to resolve LView from parent or debug APIs
      lView = this.getLViewFromNumericContext(element, ngContext);
    } else {
      lView = this.getLViewFromContext(element);
    }

    if (!lView) return;
    this.inspectLView(lView, element, issues);
  }

  /**
   * Resolves an LView when __ngContext__ is a numeric index (Angular 15-16).
   * The number is an index into the component's LView. We need to find the
   * parent component's LView to use it.
   */
  private getLViewFromNumericContext(element: Element, _index: number): any[] | null {
    try {
      // Strategy 1: Use ng.getContext to get the embedded view context
      const ng = (globalThis as any).ng;
      if (ng?.getContext) {
        const ctx = ng.getContext(element);
        // getContext returns the LView's context object (the component instance or the embedded context)
        // We need the actual LView array — walk up the DOM to find it
        if (ctx) {
          return this.findLViewFromAncestors(element);
        }
      }

      // Strategy 2: Walk up the DOM tree to find an ancestor with an array __ngContext__
      return this.findLViewFromAncestors(element);
    } catch {
      return null;
    }
  }

  /**
   * Walks up the DOM tree to find an ancestor element with an LView (array __ngContext__).
   */
  private findLViewFromAncestors(element: Element): any[] | null {
    let current: Element | null = element.parentElement;
    let depth = 0;
    const maxDepth = 20;

    while (current && depth < maxDepth) {
      const ctx = (current as any).__ngContext__;
      if (Array.isArray(ctx)) {
        return ctx;
      }
      current = current.parentElement;
      depth++;
    }
    return null;
  }

  /**
   * Attempts to retrieve the LView from an element's Angular debug context.
   * Fallback for when __ngContext__ is neither an array nor a number.
   */
  private getLViewFromContext(element: Element): any[] | null {
    try {
      const ng = (globalThis as any).ng;

      // Try ng.getContext (available in Angular 15-16 dev mode)
      if (ng?.getContext) {
        const ctx = ng.getContext(element);
        if (ctx) {
          // If getContext returns something, try to find the LView from ancestors
          return this.findLViewFromAncestors(element);
        }
      }

      // Try ng.getComponent — if element hosts a component, its LView might be accessible
      if (ng?.getComponent) {
        const component = ng.getComponent(element as HTMLElement);
        if (component) {
          // The component's host element may have LView on a child or itself after re-check
          const recheckCtx = (element as any).__ngContext__;
          if (Array.isArray(recheckCtx)) {
            return recheckCtx;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Inspects an Angular LView for embedded views created by NgForOf.
   * Checks each NgForOf directive for missing trackBy on large collections.
   */
  private inspectLView(lView: any[], element: Element, issues: TrackByIssue[]): void {
    // Walk through the LView looking for directive instances
    // NgForOf directives are stored in the LView data array
    for (let i = 0; i < lView.length; i++) {
      const item = lView[i];
      if (this.isNgForOfDirective(item)) {
        this.checkNgForOf(item, element, issues);
      }
      // Also check for ViewContainerRef which hosts embedded views
      if (this.isViewContainerRef(item)) {
        this.inspectViewContainer(item, element, issues);
      }
    }
  }

  /**
   * Determines if an object is an NgForOf directive instance by checking
   * for characteristic properties.
   */
  private isNgForOfDirective(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    // NgForOf has _ngForOf (the iterable) and _trackByFn properties
    return '_ngForOf' in obj || (
      'ngForOf' in obj && '_differ' in obj
    );
  }

  /**
   * Determines if an object is a ViewContainerRef that may host NgFor embedded views.
   */
  private isViewContainerRef(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    return '_lContainer' in obj || (
      '_hostLView' in obj && '_hostTNode' in obj
    );
  }

  /**
   * Inspects a ViewContainerRef for NgForOf directives in its embedded views.
   */
  private inspectViewContainer(viewContainer: any, element: Element, issues: TrackByIssue[]): void {
    try {
      const lContainer = viewContainer._lContainer ?? viewContainer;
      if (!Array.isArray(lContainer)) return;

      // LContainer stores embedded views starting at a header offset
      for (let i = 0; i < lContainer.length; i++) {
        const embeddedView = lContainer[i];
        if (Array.isArray(embeddedView)) {
          // Check embedded view for NgForOf context
          for (let j = 0; j < embeddedView.length; j++) {
            const item = embeddedView[j];
            if (this.isNgForOfDirective(item)) {
              this.checkNgForOf(item, element, issues);
            }
          }
        }
      }
    } catch {
      // Skip if container inspection fails
    }
  }

  /**
   * Checks an NgForOf directive instance for missing trackBy on a large collection.
   * Emits a TrackByIssue if the collection exceeds the threshold and no trackBy is set.
   */
  private checkNgForOf(ngForOf: any, element: Element, issues: TrackByIssue[]): void {
    // Check if trackBy function is provided
    const trackByFn = ngForOf._trackByFn ?? ngForOf.ngForTrackBy ?? null;
    if (trackByFn) return; // trackBy is set, no issue

    // Get the collection (iterable)
    const collection = ngForOf._ngForOf ?? ngForOf.ngForOf ?? null;
    if (!collection) return;

    // Determine collection size
    const collectionSize = this.getCollectionSize(collection);
    if (collectionSize <= this.collectionThreshold) return;

    // Determine component name from the element context
    const componentName = this.getComponentName(element);
    const collectionProperty = this.getCollectionPropertyName(ngForOf);

    issues.push({
      id: `trackby-${++this.issueIdCounter}-${Date.now()}`,
      componentName,
      collectionProperty,
      collectionSize,
      severity: 'WARNING',
      recommendation: `Add a trackBy function to the *ngFor directive on "${collectionProperty}" ` +
        `(${collectionSize} items). Without trackBy, Angular recreates all DOM elements when ` +
        `the collection changes. Example: trackBy: (index, item) => item.id`,
    });
  }

  /**
   * Gets the size of a collection, supporting arrays and iterables.
   */
  private getCollectionSize(collection: any): number {
    if (Array.isArray(collection)) {
      return collection.length;
    }
    if (collection && typeof collection.length === 'number') {
      return collection.length;
    }
    if (collection && typeof collection.size === 'number') {
      return collection.size;
    }
    // For generic iterables, count elements
    if (collection && typeof collection[Symbol.iterator] === 'function') {
      let count = 0;
      for (const _ of collection) {
        count++;
        // Safety limit to avoid infinite iterables
        if (count > this.collectionThreshold) return count;
      }
      return count;
    }
    return 0;
  }

  /**
   * Extracts the component name from an element's Angular context.
   */
  private getComponentName(element: Element): string {
    try {
      // Try Angular's debug API
      const getComponent = (globalThis as any).ng?.getComponent;
      if (getComponent) {
        const component = getComponent(element);
        if (component) {
          return component.constructor?.name ?? 'UnknownComponent';
        }
      }

      // Walk up to find the nearest component host element
      let current: Element | null = element;
      while (current) {
        const ngComp = (globalThis as any).ng?.getComponent?.(current);
        if (ngComp) {
          return ngComp.constructor?.name ?? 'UnknownComponent';
        }
        current = current.parentElement;
      }
    } catch {
      // Fall through to default
    }
    return 'UnknownComponent';
  }

  /**
   * Attempts to determine the property name of the collection bound to ngFor.
   */
  private getCollectionPropertyName(ngForOf: any): string {
    // Try to extract from the directive's internal state
    try {
      const iterable = ngForOf._ngForOf ?? ngForOf.ngForOf;
      if (iterable && iterable.constructor?.name && iterable.constructor.name !== 'Array') {
        return iterable.constructor.name;
      }
    } catch {
      // Fall through
    }
    return 'collection';
  }
}

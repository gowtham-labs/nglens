/**
 * DOM traversal helpers for the Angular Performance Inspector.
 * These utilities run in the page script context (main world) with full DOM access.
 * All traversals are capped at MAX_ELEMENTS_PER_SCAN to respect the performance budget.
 */

import {
  MAX_ELEMENTS_PER_SCAN,
  ANGULAR_HOST_ATTR_PREFIX,
  ANGULAR_CONTENT_ATTR_PREFIX,
  ANGULAR_REFLECT_ATTR_PREFIX,
  ANGULAR_VERSION_ATTR,
} from './constants';

/**
 * Checks whether an element has any Angular-specific attribute.
 * Detects: _nghost-*, _ngcontent-*, ng-reflect-*, ng-version
 */
export function hasAngularAttribute(element: Element): boolean {
  for (const attr of element.attributes) {
    const name = attr.name;
    if (
      name.startsWith(ANGULAR_HOST_ATTR_PREFIX) ||
      name.startsWith(ANGULAR_CONTENT_ATTR_PREFIX) ||
      name.startsWith(ANGULAR_REFLECT_ATTR_PREFIX) ||
      name === ANGULAR_VERSION_ATTR
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether an element is an Angular component host element.
 * A host element has an `_nghost-*` attribute.
 */
export function isAngularHostElement(element: Element): boolean {
  for (const attr of element.attributes) {
    if (attr.name.startsWith(ANGULAR_HOST_ATTR_PREFIX)) {
      return true;
    }
  }
  return false;
}

/**
 * Finds Angular component host elements in the document.
 * Respects the MAX_ELEMENTS_PER_SCAN cap — returns at most that many elements.
 */
export function findAngularComponents(root: Element | Document = document): Element[] {
  const components: Element[] = [];
  const allElements = root.querySelectorAll('*');
  const limit = Math.min(allElements.length, MAX_ELEMENTS_PER_SCAN);

  for (let i = 0; i < limit; i++) {
    if (isAngularHostElement(allElements[i])) {
      components.push(allElements[i]);
    }
  }

  return components;
}

/**
 * Counts the number of DOM nodes in a component's subtree.
 * The subtree is bounded by the next Angular host element boundary —
 * child host elements and their descendants are excluded from the count.
 *
 * Respects MAX_ELEMENTS_PER_SCAN as an upper bound on traversal.
 */
export function countSubtreeNodes(element: Element): number {
  let count = 0;
  let visited = 0;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node: Node) {
        // Skip child Angular host elements and their subtrees
        if (node !== element && isAngularHostElement(node as Element)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  // Count the root element itself
  count++;
  visited++;

  while (walker.nextNode() && visited < MAX_ELEMENTS_PER_SCAN) {
    count++;
    visited++;
  }

  return count;
}

/**
 * Traverses elements in the DOM up to the scan cap.
 * Calls the provided callback for each element, stopping at MAX_ELEMENTS_PER_SCAN.
 * Returns the number of elements processed.
 */
export function traverseElements(
  root: Element | Document,
  callback: (element: Element, index: number) => void
): number {
  const allElements = root.querySelectorAll('*');
  const limit = Math.min(allElements.length, MAX_ELEMENTS_PER_SCAN);

  for (let i = 0; i < limit; i++) {
    callback(allElements[i], i);
  }

  return limit;
}

/**
 * Derives a component name from an Angular host element.
 * Uses the element's tag name, converting to PascalCase if it's a custom element.
 */
export function getComponentName(element: Element): string {
  const tagName = element.tagName.toLowerCase();

  // Custom elements (contain a hyphen) — convert to PascalCase
  if (tagName.includes('-')) {
    return tagName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  // Standard HTML elements — return as-is (uppercase)
  return tagName;
}

/**
 * Finds the nearest Angular host ancestor of an element.
 * Useful for attributing issues to the closest component boundary.
 */
export function findNearestAngularHost(element: Element): Element | null {
  let current = element.parentElement;
  while (current) {
    if (isAngularHostElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Calculates the nesting depth of Angular host elements from a root.
 * Returns the maximum depth found, capped at maxDepth.
 */
export function calculateComponentDepth(
  root: Element,
  maxDepth: number = 512
): number {
  let maxFound = 0;

  function walk(element: Element, depth: number): void {
    if (depth > maxDepth) return;
    if (depth > maxFound) {
      maxFound = depth;
    }

    for (const child of element.children) {
      if (isAngularHostElement(child)) {
        walk(child, depth + 1);
      } else {
        walk(child, depth);
      }
    }
  }

  walk(root, 0);
  return maxFound;
}

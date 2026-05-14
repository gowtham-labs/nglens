/**
 * Safe JSON serialization utilities for the Angular Performance Inspector.
 * Handles circular references, DOM nodes, functions, and long strings
 * without throwing exceptions.
 */

import { MAX_STRING_LENGTH, TRUNCATION_INDICATOR } from './constants';

/** Placeholder for circular references in serialized output */
export const CIRCULAR_REFERENCE_MARKER = '[Circular Reference]';

/** Placeholder for DOM node values in serialized output */
export const DOM_NODE_MARKER = '[DOM Node]';

/** Placeholder for function values in serialized output */
export const FUNCTION_MARKER = '[Function]';

/**
 * Checks if a value is a DOM node.
 */
function isDOMNode(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).nodeType === 'number' &&
    typeof (value as any).nodeName === 'string'
  );
}

/**
 * Truncates a string if it exceeds MAX_STRING_LENGTH.
 * Appends a truncation indicator to signal the value was cut.
 */
export function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return value.slice(0, MAX_STRING_LENGTH) + TRUNCATION_INDICATOR;
}

/**
 * Safely serializes a value to JSON, handling:
 * - Circular references (replaced with CIRCULAR_REFERENCE_MARKER)
 * - DOM nodes (replaced with DOM_NODE_MARKER)
 * - Functions (replaced with FUNCTION_MARKER)
 * - Long strings (truncated at MAX_STRING_LENGTH with indicator)
 *
 * Never throws — returns a fallback string on unexpected errors.
 */
export function safeSerialize(value: unknown): string {
  const seen = new WeakSet();

  try {
    const result = JSON.stringify(value, (_key, val) => {
      // Handle functions
      if (typeof val === 'function') {
        return FUNCTION_MARKER;
      }

      // Handle DOM nodes
      if (isDOMNode(val)) {
        return DOM_NODE_MARKER;
      }

      // Handle objects (circular reference detection)
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return CIRCULAR_REFERENCE_MARKER;
        }
        seen.add(val);
      }

      // Handle long strings
      if (typeof val === 'string') {
        return truncateString(val);
      }

      return val;
    });

    return result ?? 'undefined';
  } catch {
    return '"[Serialization Error]"';
  }
}

/**
 * Safely serializes a value and parses it back into a plain object.
 * Useful for creating a clean, serializable copy of complex state.
 *
 * Returns the parsed object, or null if serialization fails.
 */
export function safeClone<T = unknown>(value: unknown): T | null {
  try {
    const json = safeSerialize(value);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Checks whether a value contains circular references.
 */
export function hasCircularReference(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const seen = new WeakSet();

  function check(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    if (seen.has(obj)) {
      return true;
    }
    seen.add(obj);

    const entries = Object.values(obj as Record<string, unknown>);
    for (const entry of entries) {
      if (check(entry)) {
        return true;
      }
    }
    return false;
  }

  return check(value);
}

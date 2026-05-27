// src/instrumentation/onpush-engine.ts

import type { OnPushScore, OnPushFactor } from '../types/recommendation-events';

/**
 * Metadata describing a component's runtime characteristics
 * used to evaluate OnPush change detection suitability.
 */
export interface ComponentMetadata {
  name: string;
  strategy: 'Default' | 'OnPush';
  inputCount: number;
  hasLocalStateMutation: boolean;
  hasImmutableInputs: boolean;
  eventHandlerCount: number;
  hasDomManipulation: boolean;
  renderCount: number;
}

/**
 * OnPush_Engine evaluates components for OnPush change detection
 * strategy suitability using a 5-factor weighted scoring system.
 *
 * Scoring factors:
 * - Input-driven data flow (weight: 0.3)
 * - Minimal local state mutation (weight: 0.25)
 * - Immutable input objects (weight: 0.2)
 * - Low event handler frequency (weight: 0.15)
 * - No direct DOM manipulation (weight: 0.1)
 *
 * Score range: 0-100
 * Recommendation threshold: >= 70
 */
export class OnPushEngine {
  /**
   * Evaluates a single component for OnPush suitability.
   * Only recommends OnPush for components currently using Default strategy.
   */
  evaluate(component: ComponentMetadata): OnPushScore {
    // Components already using OnPush get a perfect score with no factor breakdown
    if (component.strategy === 'OnPush') {
      return {
        component: component.name,
        score: 100,
        currentStrategy: 'OnPush',
        factors: [],
        recommendation: 'Already using OnPush',
      };
    }

    const factors: OnPushFactor[] = [
      {
        name: 'Input-driven data flow',
        weight: 0.3,
        met: component.inputCount > 0,
        description: component.inputCount > 0
          ? `Component receives ${component.inputCount} input(s), indicating data flows from parent`
          : 'Component has no inputs — data may come from services or internal state',
      },
      {
        name: 'Minimal local state mutation',
        weight: 0.25,
        met: !component.hasLocalStateMutation,
        description: component.hasLocalStateMutation
          ? 'Component mutates local state, which may bypass OnPush detection'
          : 'Component does not mutate local state directly',
      },
      {
        name: 'Immutable input objects',
        weight: 0.2,
        met: component.hasImmutableInputs,
        description: component.hasImmutableInputs
          ? 'Input objects are treated as immutable (new references on change)'
          : 'Input objects may be mutated in place, which OnPush would not detect',
      },
      {
        name: 'Low event handler frequency',
        weight: 0.15,
        met: component.eventHandlerCount <= 3,
        description: component.eventHandlerCount <= 3
          ? `Component has ${component.eventHandlerCount} event handler(s), within acceptable range`
          : `Component has ${component.eventHandlerCount} event handlers, high frequency may trigger excessive markForCheck calls`,
      },
      {
        name: 'No direct DOM manipulation',
        weight: 0.1,
        met: !component.hasDomManipulation,
        description: component.hasDomManipulation
          ? 'Component uses direct DOM manipulation, which bypasses Angular change detection'
          : 'Component does not manipulate the DOM directly',
      },
    ];

    const score = Math.round(
      factors.reduce((sum, f) => sum + (f.met ? f.weight * 100 : 0), 0)
    );

    const recommendation =
      score >= 70
        ? 'Recommended: ChangeDetectionStrategy.OnPush'
        : 'Not recommended for OnPush at this time';

    return {
      component: component.name,
      score,
      currentStrategy: 'Default',
      factors,
      recommendation,
    };
  }

  /**
   * Analyzes all components in the Angular application tree.
   * Walks the component tree, gathers metadata, and evaluates each.
   */
  analyzeAll(components: ComponentMetadata[]): OnPushScore[] {
    return components.map((component) => this.evaluate(component));
  }
}

/**
 * Analyzer registry and orchestrator for the Angular Performance Inspector.
 *
 * Responsibilities:
 * - Maintains a registry of Analyzer instances
 * - Accepts an array of Analyzer instances or AnalyzerType names
 * - Runs them in parallel (Promise.allSettled)
 * - Enforces per-analyzer timeout (5s)
 * - Collects all AnalyzerResult objects (including partial results from failed analyzers)
 * - Respects runtime mode (skips analyzers that requiresDevMode when in production)
 * - Returns combined results array
 */

import type {
  Analyzer,
  AnalyzerConfig,
  AnalyzerResult,
  AnalyzerType,
  RuntimeMode,
} from '../types/analyzer';
import type { BudgetMonitor } from '../utils/performance-budget';
import { ANALYZER_TIMEOUT_MS } from '../utils/constants';
import { withTimeout } from '../utils/timing';
import { BaseAnalyzer } from './base-analyzer';

export { BaseAnalyzer } from './base-analyzer';
export type { AnalyzerError } from './base-analyzer';

// --- Analyzer Registry ---

/** Global registry of analyzer instances, keyed by type */
const analyzerRegistry = new Map<AnalyzerType, Analyzer>();

/**
 * Registers an analyzer instance in the global registry.
 */
export function registerAnalyzer(analyzer: Analyzer): void {
  analyzerRegistry.set(analyzer.type, analyzer);
}

/**
 * Unregisters an analyzer from the global registry.
 */
export function unregisterAnalyzer(type: AnalyzerType): void {
  const analyzer = analyzerRegistry.get(type);
  if (analyzer) {
    analyzer.dispose();
    analyzerRegistry.delete(type);
  }
}

/**
 * Returns the number of registered analyzers.
 */
export function getRegisteredCount(): number {
  return analyzerRegistry.size;
}

/**
 * Returns a registered analyzer by type, or undefined if not found.
 */
export function getAnalyzer(type: AnalyzerType): Analyzer | undefined {
  return analyzerRegistry.get(type);
}

/**
 * Clears all registered analyzers, disposing each one.
 */
export function clearRegistry(): void {
  for (const analyzer of analyzerRegistry.values()) {
    analyzer.dispose();
  }
  analyzerRegistry.clear();
}

// --- Orchestrator Options ---

/**
 * Options for running the orchestrator with explicit analyzer instances.
 */
export interface OrchestratorOptions {
  /** Which analyzers to run (by type). If omitted, all provided analyzers run. */
  selectedAnalyzers?: AnalyzerType[];
  /** Runtime mode — analyzers requiring dev mode are skipped in production */
  mode: RuntimeMode;
  /** Per-analyzer timeout in ms (default: 5000) */
  timeout?: number;
  /** Maximum DOM elements per scan pass */
  maxElements?: number;
  /** Optional budget monitor for performance tracking */
  budgetMonitor?: BudgetMonitor;
}

/**
 * Result from the orchestrator including all analyzer results and metadata.
 */
export interface OrchestratorResult {
  results: AnalyzerResult[];
  /** Analyzers that were skipped (e.g., require dev mode in production) */
  skipped: AnalyzerType[];
  /** Total orchestration duration in ms */
  duration: number;
}

// --- Registry-based API (primary, used by page-script) ---

/**
 * Runs registered analyzers by type name.
 *
 * Looks up analyzer instances from the registry, filters by runtime mode,
 * and runs them in parallel with timeout enforcement.
 *
 * If analyzerTypes is empty, runs ALL registered analyzers.
 *
 * @param analyzerTypes - Array of analyzer type names to run (empty = all)
 * @param config - Analyzer configuration (mode, timeout, maxElements)
 * @returns Array of AnalyzerResult objects
 */
export async function runAnalyzers(
  analyzerTypes: AnalyzerType[],
  config: AnalyzerConfig
): Promise<AnalyzerResult[]> {
  const timeout = config.timeout ?? ANALYZER_TIMEOUT_MS;

  // Resolve analyzer instances from the registry
  let analyzers: Analyzer[];
  if (analyzerTypes.length === 0) {
    // Run all registered analyzers
    analyzers = Array.from(analyzerRegistry.values());
  } else {
    analyzers = [];
    for (const type of analyzerTypes) {
      const analyzer = analyzerRegistry.get(type);
      if (analyzer) {
        analyzers.push(analyzer);
      }
    }
  }

  // Filter by runtime mode
  const eligible = analyzers.filter((analyzer) => {
    if (analyzer.requiresDevMode && config.mode === 'production') {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return [];
  }

  // Run all eligible analyzers in parallel with individual timeouts
  const settled = await Promise.allSettled(
    eligible.map((analyzer) => runSingleAnalyzer(analyzer, config, timeout))
  );

  // Collect results
  return settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }

    const analyzer = eligible[index];
    const errorMessage =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);

    return {
      analyzer: analyzer.type,
      timestamp: Date.now(),
      duration: timeout,
      issues: [],
      metadata: {
        error: {
          analyzer: analyzer.type,
          code: errorMessage.includes('timed out')
            ? 'TIMEOUT'
            : 'EXECUTION_ERROR',
          message: errorMessage,
          recoverable: true,
        },
      },
    };
  });
}

// --- Instance-based Orchestrator API ---

/**
 * Runs a set of analyzer instances in parallel, collecting results.
 *
 * - Skips analyzers that require dev mode when running in production
 * - Enforces per-analyzer timeout (default 5s)
 * - Uses Promise.allSettled so one failure doesn't block others
 * - Injects budget monitor into BaseAnalyzer instances
 *
 * @param analyzers - Array of Analyzer instances to run
 * @param options - Orchestration configuration
 * @returns Combined results from all analyzers including skipped info
 */
export async function runAnalyzerInstances(
  analyzers: Analyzer[],
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const startTime = performance.now();
  const timeout = options.timeout ?? ANALYZER_TIMEOUT_MS;
  const skipped: AnalyzerType[] = [];

  // Filter analyzers based on selection and runtime mode
  const eligibleAnalyzers = analyzers.filter((analyzer) => {
    // Filter by selected analyzers if specified
    if (
      options.selectedAnalyzers &&
      !options.selectedAnalyzers.includes(analyzer.type)
    ) {
      return false;
    }

    // Skip analyzers that require dev mode when in production
    if (analyzer.requiresDevMode && options.mode === 'production') {
      skipped.push(analyzer.type);
      return false;
    }

    return true;
  });

  // Inject budget monitor into BaseAnalyzer instances
  if (options.budgetMonitor) {
    for (const analyzer of eligibleAnalyzers) {
      if (analyzer instanceof BaseAnalyzer) {
        analyzer.setBudgetMonitor(options.budgetMonitor);
      }
    }
  }

  // Build the analyzer config
  const config: AnalyzerConfig = {
    mode: options.mode,
    timeout,
    maxElements: options.maxElements,
  };

  // Run all eligible analyzers in parallel with individual timeouts
  const settled = await Promise.allSettled(
    eligibleAnalyzers.map((analyzer) =>
      runSingleAnalyzer(analyzer, config, timeout)
    )
  );

  // Collect results — fulfilled get their result, rejected get a fallback
  const results: AnalyzerResult[] = settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }

    // Rejected — create a fallback result with error metadata
    const analyzer = eligibleAnalyzers[index];
    const errorMessage =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);

    return {
      analyzer: analyzer.type,
      timestamp: Date.now(),
      duration: timeout,
      issues: [],
      metadata: {
        error: {
          analyzer: analyzer.type,
          code: errorMessage.includes('timed out')
            ? 'TIMEOUT'
            : 'EXECUTION_ERROR',
          message: errorMessage,
          recoverable: true,
        },
      },
    };
  });

  const duration = performance.now() - startTime;

  return { results, skipped, duration };
}

// --- Internal Helpers ---

/**
 * Runs a single analyzer with timeout enforcement.
 * If the analyzer is a BaseAnalyzer, it already handles timeout internally,
 * but we add an outer timeout as a safety net.
 */
async function runSingleAnalyzer(
  analyzer: Analyzer,
  config: AnalyzerConfig,
  timeout: number
): Promise<AnalyzerResult> {
  // BaseAnalyzer handles its own timeout internally via withTimeout in analyze()
  if (analyzer instanceof BaseAnalyzer) {
    return analyzer.analyze(config);
  }

  // For raw Analyzer interface implementations, enforce timeout externally
  return withTimeout(
    analyzer.analyze(config),
    timeout,
    `Analyzer[${analyzer.type}]`
  );
}

/**
 * Abstract base class for all analyzers in the Angular Performance Inspector.
 *
 * Provides:
 * - Timeout wrapping around the analyze() method
 * - Error catching and wrapping into a standard AnalyzerError format
 * - Performance budget check before/after run
 * - Dispose pattern for subclass cleanup
 */

import type {
  Analyzer,
  AnalyzerConfig,
  AnalyzerResult,
  AnalyzerType,
} from '../types/analyzer';
import type { BudgetMonitor } from '../utils/performance-budget';
import { ANALYZER_TIMEOUT_MS } from '../utils/constants';
import { withTimeout, now } from '../utils/timing';

/**
 * Standard error envelope returned when an analyzer fails.
 * Errors are non-fatal: the analyzer returns empty issues + error metadata.
 */
export interface AnalyzerError {
  analyzer: AnalyzerType;
  code: string;
  message: string;
  recoverable: boolean;
  fallbackResult?: Partial<AnalyzerResult>;
}

/**
 * Abstract base class that all analyzers extend.
 *
 * Subclasses implement `execute(config)` with their analysis logic.
 * The base class handles timeout enforcement, error wrapping, and
 * performance budget checks.
 */
export abstract class BaseAnalyzer implements Analyzer {
  abstract readonly type: AnalyzerType;
  abstract readonly requiresDevMode: boolean;

  /** Optional budget monitor injected for performance tracking */
  protected budgetMonitor: BudgetMonitor | null = null;

  /**
   * Set the budget monitor for performance tracking.
   * Called by the orchestrator before running the analyzer.
   */
  setBudgetMonitor(monitor: BudgetMonitor): void {
    this.budgetMonitor = monitor;
  }

  /**
   * Public analyze method implementing the Analyzer interface.
   * Wraps the subclass `execute()` with timeout, error handling,
   * and performance budget checks.
   */
  async analyze(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const startTime = now();
    const timeout = config.timeout ?? ANALYZER_TIMEOUT_MS;

    // Check performance budget before running
    this.budgetMonitor?.checkBudget();

    try {
      const result = await withTimeout(
        this.execute(config),
        timeout,
        `Analyzer[${this.type}]`
      );

      // Check performance budget after running
      this.budgetMonitor?.checkBudget();

      return result;
    } catch (error: unknown) {
      const duration = now() - startTime;
      const analyzerError = this.wrapError(error);

      // Return a non-fatal result with empty issues and error metadata
      return {
        analyzer: this.type,
        timestamp: Date.now(),
        duration,
        issues: [],
        metadata: {
          error: analyzerError,
        },
      };
    }
  }

  /**
   * Subclasses implement their analysis logic here.
   * This method is called within the timeout and error wrapper.
   */
  protected abstract execute(config: AnalyzerConfig): Promise<AnalyzerResult>;

  /**
   * Dispose method for cleanup. Subclasses can override to release resources.
   */
  dispose(): void {
    this.budgetMonitor = null;
  }

  /**
   * Wraps an unknown error into the standard AnalyzerError format.
   */
  private wrapError(error: unknown): AnalyzerError {
    const message =
      error instanceof Error ? error.message : String(error);

    const isTimeout = message.includes('timed out');

    return {
      analyzer: this.type,
      code: isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR',
      message,
      recoverable: true,
    };
  }
}

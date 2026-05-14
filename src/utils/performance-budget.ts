/**
 * Extension self-performance budget enforcement.
 *
 * Tracks CPU usage, memory footprint, and MutationObserver lifecycle
 * to ensure the extension does not degrade the inspected application.
 *
 * Runs in the page script context (main world) with access to
 * performance.memory (Chrome-specific).
 */

import type { BudgetViolation, PerformanceBudget, SamplingConfig } from '../types/performance-budget';
import { CPU_BUDGET_PERCENT, MEMORY_BUDGET_BYTES, OBSERVER_DISCONNECT_MS } from './constants';
import { now } from './timing';

/** Default performance budget thresholds */
const DEFAULT_BUDGET: PerformanceBudget = {
  maxCpuPercent: CPU_BUDGET_PERCENT,
  maxMemoryMB: MEMORY_BUDGET_BYTES / (1024 * 1024),
  observerDisconnectMs: OBSERVER_DISCONNECT_MS,
  scanTimeoutMs: 15000,
  perAnalyzerTimeoutMs: 5000,
};

/** Default sampling configuration */
const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  maxElementsPerPass: 1000,
  mutationBatchWindowMs: 100,
  minFpsThreshold: 50,
  idleCallbackTimeout: 50,
};

/**
 * Configurable sample rate for profilers.
 * Default: 60Hz max, aligned with requestAnimationFrame.
 */
const DEFAULT_SAMPLE_RATE_HZ = 60;

export interface BudgetStatus {
  withinBudget: boolean;
  cpuPercent: number;
  memoryBytes: number;
  memoryAvailable: boolean;
  violations: BudgetViolation[];
}

export interface BudgetMonitor {
  /** Start tracking CPU/memory for a scan */
  startTracking(): void;
  /** Stop tracking and finalize measurements */
  stopTracking(): void;
  /** Check current budget status (within/exceeded) */
  checkBudget(): BudgetStatus;
  /** Register a MutationObserver for auto-disconnect */
  registerObserver(observer: MutationObserver): void;
  /** Disconnect all registered observers (called after scan) */
  disconnectAllObservers(): void;
  /** Get all violations detected during the scan */
  getBudgetViolations(): BudgetViolation[];
  /** Get the configured sample rate in Hz */
  getSampleRateHz(): number;
  /** Set a custom sample rate (capped at 60Hz) */
  setSampleRateHz(hz: number): void;
  /** Reset the monitor for a new scan */
  reset(): void;
}

/**
 * Creates a budget monitor instance that tracks CPU/memory during a scan.
 *
 * @param budget - Optional custom budget thresholds
 * @param samplingConfig - Optional custom sampling configuration
 */
export function createBudgetMonitor(
  budget: Partial<PerformanceBudget> = {},
  samplingConfig: Partial<SamplingConfig> = {}
): BudgetMonitor {
  const config: PerformanceBudget = { ...DEFAULT_BUDGET, ...budget };
  const _samplingConfig: SamplingConfig = { ...DEFAULT_SAMPLING_CONFIG, ...samplingConfig };

  let violations: BudgetViolation[] = [];
  let registeredObservers: MutationObserver[] = [];
  let trackingStartTime = 0;
  let extensionTimeAccumulated = 0;
  let lastCheckpointTime = 0;
  let isTracking = false;
  let sampleRateHz = DEFAULT_SAMPLE_RATE_HZ;
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Get current memory usage from Chrome-specific performance.memory API.
   * Returns -1 if not available.
   */
  function getMemoryUsage(): number {
    const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (perfMemory && typeof perfMemory.usedJSHeapSize === 'number') {
      return perfMemory.usedJSHeapSize;
    }
    return -1;
  }

  /**
   * Calculate CPU percentage used by extension code.
   * Compares time spent in extension code vs total elapsed wall-clock time.
   */
  function calculateCpuPercent(): number {
    if (!isTracking || trackingStartTime === 0) {
      return 0;
    }
    const totalElapsed = now() - trackingStartTime;
    if (totalElapsed <= 0) {
      return 0;
    }
    return (extensionTimeAccumulated / totalElapsed) * 100;
  }

  /**
   * Check memory against budget and record violation if exceeded.
   */
  function checkMemoryBudget(): { memoryBytes: number; memoryAvailable: boolean } {
    const memoryBytes = getMemoryUsage();
    const memoryAvailable = memoryBytes >= 0;

    if (memoryAvailable && memoryBytes > MEMORY_BUDGET_BYTES) {
      const violation: BudgetViolation = {
        metric: 'memory',
        limit: MEMORY_BUDGET_BYTES,
        actual: memoryBytes,
        timestamp: Date.now(),
      };
      violations.push(violation);
      console.warn(
        `[ngLens] Memory budget exceeded: ${(memoryBytes / (1024 * 1024)).toFixed(1)}MB / ${config.maxMemoryMB}MB limit`
      );
    }

    return { memoryBytes: memoryAvailable ? memoryBytes : 0, memoryAvailable };
  }

  /**
   * Check CPU against budget and record violation if exceeded.
   */
  function checkCpuBudget(): number {
    const cpuPercent = calculateCpuPercent();

    if (cpuPercent > config.maxCpuPercent) {
      const violation: BudgetViolation = {
        metric: 'cpu',
        limit: config.maxCpuPercent,
        actual: cpuPercent,
        timestamp: Date.now(),
      };
      violations.push(violation);
      console.warn(
        `[ngLens] CPU budget exceeded: ${cpuPercent.toFixed(1)}% / ${config.maxCpuPercent}% limit`
      );
    }

    return cpuPercent;
  }

  const monitor: BudgetMonitor = {
    startTracking() {
      isTracking = true;
      trackingStartTime = now();
      lastCheckpointTime = trackingStartTime;
      extensionTimeAccumulated = 0;
      violations = [];
    },

    stopTracking() {
      if (isTracking) {
        // Accumulate final time slice
        const currentTime = now();
        extensionTimeAccumulated += currentTime - lastCheckpointTime;
        isTracking = false;
      }
    },

    checkBudget(): BudgetStatus {
      // Update accumulated time
      if (isTracking) {
        const currentTime = now();
        extensionTimeAccumulated += currentTime - lastCheckpointTime;
        lastCheckpointTime = currentTime;
      }

      const cpuPercent = checkCpuBudget();
      const { memoryBytes, memoryAvailable } = checkMemoryBudget();

      return {
        withinBudget: cpuPercent <= config.maxCpuPercent && (
          !memoryAvailable || memoryBytes <= MEMORY_BUDGET_BYTES
        ),
        cpuPercent,
        memoryBytes,
        memoryAvailable,
        violations: [...violations],
      };
    },

    registerObserver(observer: MutationObserver) {
      registeredObservers.push(observer);
    },

    disconnectAllObservers() {
      const disconnectStart = now();

      for (const observer of registeredObservers) {
        try {
          observer.disconnect();
        } catch {
          // Observer may already be disconnected — ignore
        }
      }

      const disconnectDuration = now() - disconnectStart;
      registeredObservers = [];

      // Clear any pending disconnect timer
      if (disconnectTimer !== null) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }

      // Check if disconnect took too long
      if (disconnectDuration > config.observerDisconnectMs) {
        const violation: BudgetViolation = {
          metric: 'observer-disconnect',
          limit: config.observerDisconnectMs,
          actual: disconnectDuration,
          timestamp: Date.now(),
        };
        violations.push(violation);
        console.warn(
          `[ngLens] Observer disconnect exceeded budget: ${disconnectDuration.toFixed(1)}ms / ${config.observerDisconnectMs}ms limit`
        );
      }
    },

    getBudgetViolations(): BudgetViolation[] {
      return [...violations];
    },

    getSampleRateHz(): number {
      return sampleRateHz;
    },

    setSampleRateHz(hz: number) {
      // Cap at 60Hz (aligned with rAF) and floor at 1Hz
      sampleRateHz = Math.max(1, Math.min(hz, DEFAULT_SAMPLE_RATE_HZ));
    },

    reset() {
      violations = [];
      registeredObservers = [];
      trackingStartTime = 0;
      extensionTimeAccumulated = 0;
      lastCheckpointTime = 0;
      isTracking = false;
      if (disconnectTimer !== null) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
    },
  };

  return monitor;
}

/**
 * Convenience function: creates a monitor, checks budget, and returns status.
 * Useful for one-shot budget checks without maintaining a long-lived monitor.
 */
export function checkBudget(budget?: Partial<PerformanceBudget>): BudgetStatus {
  const monitor = createBudgetMonitor(budget);
  monitor.startTracking();
  const status = monitor.checkBudget();
  monitor.stopTracking();
  return status;
}

/**
 * Register a MutationObserver on a shared default monitor for auto-disconnect.
 * This is a convenience for modules that don't manage their own monitor instance.
 */
let sharedMonitor: BudgetMonitor | null = null;

function getSharedMonitor(): BudgetMonitor {
  if (!sharedMonitor) {
    sharedMonitor = createBudgetMonitor();
  }
  return sharedMonitor;
}

export function registerObserver(observer: MutationObserver): void {
  getSharedMonitor().registerObserver(observer);
}

export function disconnectAllObservers(): void {
  getSharedMonitor().disconnectAllObservers();
}

export function getBudgetViolations(): BudgetViolation[] {
  return getSharedMonitor().getBudgetViolations();
}

/**
 * Schedule auto-disconnect of all registered observers after scan completion.
 * Ensures observers are disconnected within OBSERVER_DISCONNECT_MS.
 */
export function scheduleObserverDisconnect(monitor?: BudgetMonitor): void {
  const target = monitor ?? getSharedMonitor();
  setTimeout(() => {
    target.disconnectAllObservers();
  }, 0); // Disconnect ASAP, well within the 100ms budget
}

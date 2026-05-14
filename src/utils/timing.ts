/**
 * Performance measurement utilities for the Angular Performance Inspector.
 * Provides wrappers around the Performance API for mark/measure operations,
 * duration calculation, and idle callback scheduling.
 */

/** Prefix for all performance marks/measures created by this extension */
const PERF_PREFIX = '__ng_perf_';

/**
 * Creates a performance mark with the extension prefix.
 * Returns the mark name for use with endMeasure.
 */
export function startMark(label: string): string {
  const markName = `${PERF_PREFIX}${label}_start`;
  performance.mark(markName);
  return markName;
}

/**
 * Creates an end mark and measures the duration between start and end.
 * Returns the duration in milliseconds, or -1 if measurement fails.
 */
export function endMeasure(label: string): number {
  const startName = `${PERF_PREFIX}${label}_start`;
  const endName = `${PERF_PREFIX}${label}_end`;
  const measureName = `${PERF_PREFIX}${label}`;

  try {
    performance.mark(endName);
    const measure = performance.measure(measureName, startName, endName);
    const duration = measure.duration;

    // Clean up marks and measures
    performance.clearMarks(startName);
    performance.clearMarks(endName);
    performance.clearMeasures(measureName);

    return duration;
  } catch {
    // If start mark doesn't exist or measurement fails
    return -1;
  }
}

/**
 * Measures the execution time of a synchronous function.
 * Returns a tuple of [result, durationMs].
 */
export function measureSync<T>(label: string, fn: () => T): [T, number] {
  startMark(label);
  const result = fn();
  const duration = endMeasure(label);
  return [result, duration];
}

/**
 * Measures the execution time of an async function.
 * Returns a tuple of [result, durationMs].
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<[T, number]> {
  startMark(label);
  const result = await fn();
  const duration = endMeasure(label);
  return [result, duration];
}

/**
 * Calculates the duration between two timestamps in milliseconds.
 */
export function calculateDuration(startTime: number, endTime: number): number {
  return Math.max(0, endTime - startTime);
}

/**
 * Gets the current high-resolution timestamp.
 */
export function now(): number {
  return performance.now();
}

/**
 * Schedules a callback to run during browser idle time.
 * Falls back to setTimeout if requestIdleCallback is not available.
 *
 * @param callback - Function to execute during idle time
 * @param timeout - Maximum wait time in ms before forcing execution (default: 100ms)
 * @returns A handle that can be used to cancel the scheduled callback
 */
export function scheduleIdle(
  callback: () => void,
  timeout: number = 100
): number {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(
      () => callback(),
      { timeout }
    );
  }
  // Fallback for environments without requestIdleCallback
  return globalThis.setTimeout(callback, 0);
}

/**
 * Cancels a previously scheduled idle callback.
 */
export function cancelIdle(handle: number): void {
  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

/**
 * Defers execution to the next microtask.
 * Useful for yielding to the browser between heavy operations.
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Creates a timeout promise that rejects after the specified duration.
 * Useful for implementing per-analyzer timeouts.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string = 'operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

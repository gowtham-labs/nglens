/**
 * Sampling and throttling utilities for the Angular Performance Inspector.
 *
 * Provides:
 * - Batched MutationObserver that collects mutations in 100ms windows
 *   and processes them during idle callbacks
 * - Throttled DOM traversal that respects the 1000-element cap
 *   and pauses when page FPS drops below 50
 * - FPS monitoring via requestAnimationFrame
 * - Observer cleanup within 100ms deadline
 */

import { SamplingConfig } from '../types/performance-budget';
import { MAX_ELEMENTS_PER_SCAN, OBSERVER_DISCONNECT_MS } from './constants';
import { scheduleIdle, cancelIdle, now } from './timing';

// --- Default Sampling Configuration ---

const DEFAULT_SAMPLING_CONFIG: SamplingConfig = {
  maxElementsPerPass: MAX_ELEMENTS_PER_SCAN,
  mutationBatchWindowMs: 100,
  minFpsThreshold: 50,
  idleCallbackTimeout: 50,
};

// --- Observer Tracking ---

/** All active MutationObservers tracked for cleanup */
const trackedObservers: Set<MutationObserver> = new Set();

// --- FPS Throttle ---

/**
 * Monitors page FPS via requestAnimationFrame and provides a `shouldPause()`
 * method that returns true when the frame gap exceeds the threshold
 * (indicating FPS has dropped below the configured minimum).
 */
export class FpsThrottle {
  private lastFrameTime: number = 0;
  private currentFps: number = 60;
  private rafId: number | null = null;
  private running: boolean = false;
  private readonly minFps: number;
  /** Frame gap in ms that corresponds to the minimum FPS threshold */
  private readonly maxFrameGapMs: number;

  constructor(minFpsThreshold: number = DEFAULT_SAMPLING_CONFIG.minFpsThreshold) {
    this.minFps = minFpsThreshold;
    // 50 FPS → max 20ms between frames
    this.maxFrameGapMs = 1000 / this.minFps;
  }

  /**
   * Start monitoring FPS. Call this before beginning analysis.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = now();
    this.tick();
  }

  /**
   * Stop monitoring FPS and release the rAF handle.
   */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Returns true if analysis should pause because page FPS
   * has dropped below the configured threshold.
   */
  shouldPause(): boolean {
    if (!this.running) return false;
    return this.currentFps < this.minFps;
  }

  /**
   * Returns the current estimated FPS.
   */
  getCurrentFps(): number {
    return this.currentFps;
  }

  private tick(): void {
    if (!this.running) return;

    this.rafId = requestAnimationFrame((timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const frameGap = timestamp - this.lastFrameTime;
        if (frameGap > 0) {
          // Exponential moving average for smoother FPS reading
          const instantFps = 1000 / frameGap;
          this.currentFps = this.currentFps * 0.7 + instantFps * 0.3;
        }
      }
      this.lastFrameTime = timestamp;
      this.tick();
    });
  }
}

// --- Batched MutationObserver ---

export interface BatchedMutationObserverHandle {
  /** The underlying MutationObserver instance */
  observer: MutationObserver;
  /** Start observing a target element */
  observe(target: Node, options?: MutationObserverInit): void;
  /** Disconnect the observer and cancel pending batches */
  disconnect(): void;
}

/**
 * Creates a MutationObserver that batches mutations in configurable time windows
 * (default 100ms) and processes the accumulated batch during an idle callback.
 *
 * This prevents the extension from reacting to every individual mutation,
 * reducing overhead on the inspected page.
 *
 * @param callback - Function to process the batched mutations
 * @param config - Optional sampling configuration overrides
 */
export function createBatchedMutationObserver(
  callback: (mutations: MutationRecord[]) => void,
  config?: Partial<SamplingConfig>
): BatchedMutationObserverHandle {
  const cfg = { ...DEFAULT_SAMPLING_CONFIG, ...config };
  let batchBuffer: MutationRecord[] = [];
  let batchTimer: ReturnType<typeof setTimeout> | null = null;
  let idleHandle: number | null = null;

  function flushBatch(): void {
    batchTimer = null;
    const mutations = batchBuffer;
    batchBuffer = [];

    if (mutations.length === 0) return;

    // Process the batch in an idle callback to avoid blocking the main thread
    idleHandle = scheduleIdle(() => {
      idleHandle = null;
      callback(mutations);
    }, cfg.idleCallbackTimeout);
  }

  const observer = new MutationObserver((mutations: MutationRecord[]) => {
    // Accumulate mutations into the batch buffer
    batchBuffer.push(...mutations);

    // Start the batch window timer if not already running
    batchTimer ??= setTimeout(flushBatch, cfg.mutationBatchWindowMs);
  });

  // Track for cleanup
  trackedObservers.add(observer);

  const handle: BatchedMutationObserverHandle = {
    observer,

    observe(target: Node, options?: MutationObserverInit): void {
      observer.observe(target, options ?? {
        childList: true,
        subtree: true,
        attributes: true,
      });
    },

    disconnect(): void {
      observer.disconnect();
      trackedObservers.delete(observer);

      // Cancel any pending batch processing
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      if (idleHandle !== null) {
        cancelIdle(idleHandle);
        idleHandle = null;
      }
      batchBuffer = [];
    },
  };

  return handle;
}

// --- Throttled DOM Traversal ---

export interface ThrottledTraversalResult<T> {
  /** The result from the traversal callback */
  result: T;
  /** Number of elements actually visited */
  elementsVisited: number;
  /** Whether the traversal was capped before completion */
  wasCapped: boolean;
  /** Whether the traversal was paused due to low FPS */
  wasPausedByFps: boolean;
}

/**
 * Creates a throttled DOM traversal function that:
 * - Caps the number of elements visited per pass (default 1000)
 * - Pauses if page FPS drops below the configured threshold
 *
 * The callback receives an iterator-like interface that yields elements
 * one at a time, respecting the cap and FPS constraints.
 *
 * @param callback - Function that performs the traversal logic.
 *   Receives a `visitElement` function that should be called for each element.
 *   Returns the accumulated result.
 * @param config - Optional sampling configuration overrides
 */
export function createThrottledTraversal<T>(
  callback: (
    root: Element,
    visitElement: (element: Element) => boolean // returns false if cap reached
  ) => T,
  config?: Partial<SamplingConfig>
): (root: Element, fpsThrottle?: FpsThrottle) => ThrottledTraversalResult<T> {
  const cfg = { ...DEFAULT_SAMPLING_CONFIG, ...config };

  return (root: Element, fpsThrottle?: FpsThrottle): ThrottledTraversalResult<T> => {
    let elementsVisited = 0;
    let wasCapped = false;
    let wasPausedByFps = false;

    const visitElement = (element: Element): boolean => {
      // Check FPS throttle
      if (fpsThrottle?.shouldPause()) {
        wasPausedByFps = true;
        return false;
      }

      // Check element cap
      if (elementsVisited >= cfg.maxElementsPerPass) {
        wasCapped = true;
        return false;
      }

      elementsVisited++;
      return true;
    };

    const result = callback(root, visitElement);

    return {
      result,
      elementsVisited,
      wasCapped,
      wasPausedByFps,
    };
  };
}

// --- Observer Cleanup ---

/**
 * Disconnects all tracked MutationObservers within the configured deadline
 * (default 100ms). This should be called at the end of every scan or
 * profiling session to ensure no observers remain active.
 *
 * @returns The number of observers that were disconnected
 */
export function cleanupAllObservers(): number {
  const deadline = now() + OBSERVER_DISCONNECT_MS;
  let disconnectedCount = 0;

  for (const observer of trackedObservers) {
    // Check if we're still within the deadline
    if (now() > deadline) {
      // If we've exceeded the deadline, schedule remaining cleanup
      // This shouldn't happen with typical observer counts, but is a safety net
      scheduleIdle(() => {
        for (const remaining of trackedObservers) {
          remaining.disconnect();
        }
        trackedObservers.clear();
      }, OBSERVER_DISCONNECT_MS);
      break;
    }

    observer.disconnect();
    disconnectedCount++;
  }

  trackedObservers.clear();
  return disconnectedCount;
}

/**
 * Returns the number of currently tracked (active) observers.
 * Useful for testing and monitoring.
 */
export function getTrackedObserverCount(): number {
  return trackedObservers.size;
}

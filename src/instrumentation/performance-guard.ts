/**
 * Performance Guard — monitors instrumentation overhead and activates degraded mode.
 *
 * Runs in the page's MAIN world alongside the Render_Tracker and other instrumentation.
 * Periodically samples the ratio of time spent in instrumentation code vs total elapsed time.
 * If overhead exceeds 3%, activates degraded mode:
 *   - Disables per-component timing
 *   - Increases batch interval to 500ms
 *   - Stops parent-CD tracking
 *   - Emits DEGRADED_MODE message to panel via CustomEvent
 */

export class PerformanceGuard {
  private static instance: PerformanceGuard | null = null;

  private readonly OVERHEAD_THRESHOLD = 0.03; // 3%
  private readonly CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

  private totalInstrumentationTime = 0;
  private lastCheckTime = 0;
  private degraded = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): PerformanceGuard {
    if (!PerformanceGuard.instance) {
      PerformanceGuard.instance = new PerformanceGuard();
    }
    return PerformanceGuard.instance;
  }

  /**
   * Starts periodic overhead monitoring.
   * Resets counters and begins checking every 5 seconds.
   */
  start(): void {
    this.lastCheckTime = performance.now();
    this.totalInstrumentationTime = 0;
    this.degraded = false;

    this.checkInterval = globalThis.setInterval(
      () => this.checkOverhead(),
      this.CHECK_INTERVAL_MS
    );
  }

  /**
   * Stops overhead monitoring and clears the check interval.
   */
  stop(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Records time spent in instrumentation code.
   * Called by instrumentation hooks (Render_Tracker, Leak_Detector, etc.)
   * to accumulate their execution time for overhead calculation.
   *
   * @param duration - Time in milliseconds spent in instrumentation code
   */
  recordInstrumentationTime(duration: number): void {
    this.totalInstrumentationTime += duration;
  }

  /**
   * Returns whether the guard is currently in degraded mode.
   */
  isDegraded(): boolean {
    return this.degraded;
  }

  /**
   * Checks the current overhead ratio and activates degraded mode if threshold is exceeded.
   * Can be called periodically by external code or is called automatically via the internal interval.
   */
  checkOverhead(): void {
    const now = performance.now();
    const elapsed = now - this.lastCheckTime;

    // Avoid division by zero on very short intervals
    if (elapsed <= 0) return;

    const overhead = this.totalInstrumentationTime / elapsed;

    if (overhead > this.OVERHEAD_THRESHOLD && !this.degraded) {
      this.degraded = true;
      this.emitDegradedMode();
    }

    // Reset counters for the next measurement interval
    this.totalInstrumentationTime = 0;
    this.lastCheckTime = now;
  }

  /**
   * Emits a DEGRADED_MODE CustomEvent to notify the content script (and ultimately the panel)
   * that instrumentation overhead has exceeded the threshold.
   *
   * The content script listens for 'nglens-event' CustomEvents and forwards them
   * to the background worker via chrome.runtime.sendMessage.
   */
  private emitDegradedMode(): void {
    const message = {
      eventId: `degraded-${Date.now()}`,
      type: 'DEGRADED_MODE',
      payload: { degraded: true },
    };
    globalThis.dispatchEvent(
      new CustomEvent('__ng_perf_to_content', { detail: message })
    );
  }
}

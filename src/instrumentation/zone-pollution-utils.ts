import type { TaskRecord, PollutionSourceMetrics, ZonePollutionSeverity } from '../types/zone-pollution-events';

/**
 * Removes records older than windowMs from current time.
 * Returns a new array with only records within the window.
 */
export function evictExpiredRecords(records: TaskRecord[], now: number, windowMs: number): TaskRecord[] {
  const cutoff = now - windowMs;
  return records.filter(record => record.timestamp >= cutoff);
}

/**
 * Computes CD cycles per minute from a count and window duration.
 * Formula: (cdCount / windowMs) * 60000
 */
export function computeCdPerMinute(cdCount: number, windowMs: number): number {
  if (windowMs <= 0) return 0;
  return (cdCount / windowMs) * 60000;
}

/**
 * Classifies severity based on CD cycles per minute.
 * low: < 30, medium: 30-100, high: 100-300, critical: > 300
 */
export function classifySeverity(cdPerMinute: number): ZonePollutionSeverity {
  if (cdPerMinute < 30) return 'low';
  if (cdPerMinute < 100) return 'medium';
  if (cdPerMinute < 300) return 'high';
  return 'critical';
}

/**
 * Sorts sources descending by cdCyclesPerMinute.
 */
export function rankSources(sources: PollutionSourceMetrics[]): PollutionSourceMetrics[] {
  return [...sources].sort((a, b) => b.cdCyclesPerMinute - a.cdCyclesPerMinute);
}

/**
 * Extracts library name from a stack trace string.
 * Looks for node_modules/{libraryName}/ pattern.
 * Returns undefined if no library found.
 */
export function extractLibraryFromStack(stack: string): string | undefined {
  const match = stack.match(/node_modules\/([^/]+)\//);
  return match ? match[1] : undefined;
}

/**
 * Returns a fix suggestion string based on source type and optional library name.
 */
export function getFixSuggestion(sourceType: string, library?: string): string {
  if (library) {
    return `Initialize ${library} outside Angular zone using NgZone.runOutsideAngular()`;
  }

  switch (sourceType) {
    case 'setTimeout':
    case 'setInterval':
      return 'Wrap in NgZone.runOutsideAngular()';
    case 'addEventListener':
      return 'Register listener outside Angular zone';
    case 'fetch':
    case 'XMLHttpRequest':
      return 'Use Angular HttpClient with async pipe or OnPush';
    case 'WebSocket':
      return 'Handle messages outside Angular zone, manually trigger CD for UI updates';
    case 'requestAnimationFrame':
      return 'Run animation loop outside Angular zone';
    default:
      return 'Wrap in NgZone.runOutsideAngular()';
  }
}

/**
 * Returns true if cdTime - taskCompletionTime is in [0, thresholdMs].
 * This means the CD happened after the task completed, within the threshold.
 */
export function shouldAttributeCd(taskCompletionTime: number, cdTime: number, thresholdMs: number): boolean {
  const diff = cdTime - taskCompletionTime;
  return diff >= 0 && diff <= thresholdMs;
}

/**
 * Returns true if timestamp is within startupDurationMs of pageLoadTime.
 */
export function isInStartupPeriod(timestamp: number, pageLoadTime: number, startupDurationMs: number): boolean {
  const elapsed = timestamp - pageLoadTime;
  return elapsed >= 0 && elapsed < startupDurationMs;
}

/**
 * Inserts an item into a circular buffer. If buffer is at maxSize, removes the oldest (first) entry.
 * Returns the new buffer array.
 */
export function circularBufferInsert<T>(buffer: T[], item: T, maxSize: number): T[] {
  if (buffer.length >= maxSize) {
    return [...buffer.slice(1), item];
  }
  return [...buffer, item];
}

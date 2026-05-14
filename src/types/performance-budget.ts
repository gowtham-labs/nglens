// src/types/performance-budget.ts

export interface PerformanceBudget {
  maxCpuPercent: number; // Max CPU usage as percentage of page CPU (default: 3)
  maxMemoryMB: number; // Max memory footprint in MB (default: 50)
  observerDisconnectMs: number; // Max time to disconnect MutationObservers after scan (default: 100)
  scanTimeoutMs: number; // Max total scan duration in ms (default: 15000)
  perAnalyzerTimeoutMs: number; // Max per-analyzer timeout in ms (default: 5000)
}

export interface BudgetViolation {
  metric: 'cpu' | 'memory' | 'observer-disconnect' | 'scan-timeout' | 'analyzer-timeout';
  limit: number;
  actual: number;
  timestamp: number;
  analyzerName?: string; // Which analyzer caused the violation, if applicable
}

export interface SamplingConfig {
  maxElementsPerPass: number; // DOM traversal cap (default: 1000)
  mutationBatchWindowMs: number; // MutationObserver batching window (default: 100)
  minFpsThreshold: number; // Pause analysis if page FPS drops below this (default: 50)
  idleCallbackTimeout: number; // requestIdleCallback timeout in ms (default: 50)
}

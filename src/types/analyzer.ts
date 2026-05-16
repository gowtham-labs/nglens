// src/types/analyzer.ts

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RuntimeMode = 'development' | 'production';

export interface AnalyzerConfig {
  maxElements?: number; // DOM traversal limit (default: 1000)
  timeout?: number; // Per-analyzer timeout in ms (default: 5000)
  mode: RuntimeMode;
}

export interface AnalysisIssue {
  id: string; // Unique issue identifier
  analyzer: AnalyzerType; // Source analyzer
  component: string; // Affected component name
  severity: Severity;
  category: IssueCategory;
  title: string; // Short description
  description: string; // Detailed explanation
  recommendation: string; // Fix suggestion
  metadata?: Record<string, unknown>; // Analyzer-specific data
  elementSelector?: string; // CSS selector for overlay targeting
}

export type AnalyzerType =
  | 'performance-scorer'
  | 'production-analyzer'
  | 'dom-inspector'
  | 'signals-analyzer'
  | 'rxjs-leak-detector'
  | 'enterprise-optimizer'
  | 'best-practices-detector';

export type IssueCategory =
  | 'change-detection'
  | 'dom-complexity'
  | 'memory-leaks'
  | 'bundle-size'
  | 'signals-migration'
  | 'zone-triggers'
  | 'network-correlation'
  | 'render-performance'
  | 'state-management'
  | 'best-practices';

export interface AnalyzerResult {
  analyzer: AnalyzerType;
  timestamp: number;
  duration: number; // Time taken to run analysis in ms
  issues: AnalysisIssue[];
  metadata?: Record<string, unknown>;
}

export interface Analyzer {
  readonly type: AnalyzerType;
  readonly requiresDevMode: boolean;
  analyze(config: AnalyzerConfig): Promise<AnalyzerResult>;
  dispose(): void;
}

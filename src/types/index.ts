// src/types/index.ts — barrel file re-exporting all shared types

export type {
  Severity,
  RuntimeMode,
  AnalyzerConfig,
  AnalysisIssue,
  AnalyzerType,
  IssueCategory,
  AnalyzerResult,
  Analyzer,
} from './analyzer';

export type {
  PerformanceSubScore,
  PerformanceScore,
} from './scoring';

export type {
  MessageType,
  ExtensionMessage,
  PageMessage,
  ScanRequestPayload,
  ScanResultsPayload,
  DetectionResult,
} from './messages';

export type {
  ImpactLevel,
  ActionItem,
  ActionListState,
} from './actions';

export type {
  ReportData,
  ExportFormat,
} from './report';

export type { HelpEntry } from './help';

export type { OverlayConfig } from './overlay';

export type {
  PerformanceBudget,
  BudgetViolation,
  SamplingConfig,
} from './performance-budget';

export type {
  AnalyticsEvent,
  MeasurementProtocolPayload,
  ConsentStatus,
  ConsentState,
  AnalyticsConsentPayload,
  AnalyticsTrackEventPayload,
} from './analytics';

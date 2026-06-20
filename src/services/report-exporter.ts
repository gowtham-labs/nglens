/**
 * Report Exporter service for the Angular Performance Inspector.
 *
 * Provides JSON, Markdown, and clipboard export of scan results.
 * All export is local — no network requests are made.
 * Data is sanitized to remove DOM refs, functions, and circular structures.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
 */

import type { ReportData } from '../types/report';
import type { AnalysisIssue, AnalyzerResult, Severity } from '../types/analyzer';
import type { ActionItem } from '../types/actions';
import type { PerformanceScore } from '../types/scoring';
import { sanitizeForExport } from '../utils/privacy';
import { safeSerialize } from '../utils/serializer';

function hasIssues(data: ReportData | null | undefined): data is ReportData {
  return Boolean(data?.issues && data.issues.length > 0);
}

function getExportTimestamp(data: ReportData): string {
  return formatTimestampForFilename(new Date(data.timestamp));
}

function severityOrderIndex(severity: Severity): number {
  switch (severity) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    case 'info':
      return 4;
    default:
      return 5;
  }
}

function getJsonContent(data: ReportData): string {
  const sanitized = sanitizeForExport(data);
  if (sanitized === null) {
    return safeSerialize(data);
  }

  try {
    return JSON.stringify(sanitized, null, 2);
  } catch {
    return safeSerialize(data);
  }
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function buildIssueRow(issue: AnalysisIssue): string {
  const component = escapeMarkdownCell(issue.component);
  const severity = severityLabel(issue.severity);
  const title = escapeMarkdownCell(issue.title);
  const recommendation = escapeMarkdownCell(issue.recommendation);
  return `| ${component} | ${severity} | ${title} | ${recommendation} |`;
}

function recommendationLine(issue: AnalysisIssue, index: number): string {
  return [`  ${index + 1}. [${severityLabel(issue.severity)}] ${issue.title}`, `     ${issue.recommendation}`].join('\n');
}

/**
 * Formats a Date as YYYYMMDD-HHmmss for use in filenames.
 */
function formatTimestampForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Triggers a browser file download using a Blob URL.
 * No network requests — purely local.
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 100);
}

/**
 * Returns a severity label suitable for display.
 */
function severityLabel(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

/**
 * Counts issues by severity level.
 */
function countBySeverity(issues: AnalysisIssue[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}

/**
 * Determines impact level from severity.
 */
function getImpactLevel(severity: Severity): 'high' | 'medium' | 'low' {
  if (severity === 'critical' || severity === 'high') {
    return 'high';
  }
  if (severity === 'medium') {
    return 'medium';
  }
  return 'low';
}

/**
 * Determines estimated gain description from severity.
 */
function getEstimatedGain(severity: Severity): string {
  if (severity === 'critical') {
    return 'Large improvement expected';
  }
  if (severity === 'high') {
    return 'Moderate improvement expected';
  }
  return 'Minor improvement expected';
}

/**
 * Builds a ReportData object from scan results.
 * This is a helper to construct the report payload before export.
 */
export function buildReportData(
  scanResults: AnalyzerResult[],
  pageUrl: string,
  angularVersion: string | null,
  componentCount: number
): ReportData {
  const issues: AnalysisIssue[] = scanResults.flatMap((r) => r.issues);

  // Build a default score if no scorer result is available
  const scorerResult = scanResults.find((r) => r.analyzer === 'performance-scorer');
  const score: PerformanceScore = (scorerResult?.metadata?.score as PerformanceScore) ?? {
    overall: 0,
    subScores: {
      changeDetection: { name: 'Change Detection', score: 0, weight: 0.4, details: 'No data' },
      componentTreeDepth: { name: 'Component Tree Depth', score: 0, weight: 0.2, details: 'No data' },
      templateComplexity: { name: 'Template Complexity', score: 0, weight: 0.2, details: 'No data' },
      detectedBottlenecks: { name: 'Detected Bottlenecks', score: 0, weight: 0.2, details: 'No data' },
    },
    timestamp: Date.now(),
    mode: 'development',
  };

  // Build action items from issues (simple ranking by severity)
  const sortedIssues = [...issues].sort(
    (a, b) => severityOrderIndex(a.severity) - severityOrderIndex(b.severity)
  );

  const actionItems: ActionItem[] = sortedIssues.map((issue, index) => ({
    id: issue.id,
    rank: index + 1,
    issue,
    impactLevel: getImpactLevel(issue.severity),
    estimatedGain: getEstimatedGain(issue.severity),
    resolved: false,
  }));

  return {
    timestamp: new Date().toISOString(),
    angularVersion,
    pageUrl,
    componentCount,
    score,
    issues,
    actionItems,
  };
}

/**
 * Exports scan results as a downloadable JSON file.
 * File naming: angular-perf-report-YYYYMMDD-HHmmss.json
 *
 * Data is sanitized to remove DOM refs, functions, and circular structures.
 * No network requests are made.
 */
export function exportAsJSON(data: ReportData): void {
  if (!hasIssues(data)) {
    return;
  }

  const jsonContent = getJsonContent(data);
  const filename = `angular-perf-report-${getExportTimestamp(data)}.json`;

  triggerDownload(jsonContent, filename, 'application/json');
}

/**
 * Exports scan results as a downloadable Markdown file.
 * File naming: angular-perf-report-YYYYMMDD-HHmmss.md
 *
 * Format:
 * ## Summary — score, issue counts
 * ## Issues — table with component, severity, title, recommendation
 *
 * No network requests are made.
 */
export function exportAsMarkdown(data: ReportData): void {
  if (!hasIssues(data)) {
    return;
  }

  const counts = countBySeverity(data.issues);
  const issueRows = data.issues.map(buildIssueRow);

  const lines = [
    '# Angular Performance Inspector Report',
    '',
    '## Metadata',
    '',
    `- **Timestamp:** ${data.timestamp}`,
    `- **Angular Version:** ${data.angularVersion ?? 'Unknown'}`,
    `- **Page URL:** ${data.pageUrl}`,
    `- **Components Analyzed:** ${data.componentCount}`,
    '',
    '## Summary',
    '',
    `- **Overall Score:** ${data.score.overall}/100`,
    `- **Critical Issues:** ${counts.critical}`,
    `- **High Issues:** ${counts.high}`,
    `- **Medium Issues:** ${counts.medium}`,
    `- **Low Issues:** ${counts.low}`,
    `- **Info:** ${counts.info}`,
    `- **Total Issues:** ${data.issues.length}`,
    '',
    '## Issues',
    '',
    '| Component | Severity | Title | Recommendation |',
    '|-----------|----------|-------|----------------|',
    ...issueRows,
    '',
  ];

  const markdownContent = lines.join('\n');
  const filename = `angular-perf-report-${getExportTimestamp(data)}.md`;

  triggerDownload(markdownContent, filename, 'text/markdown');
}

/**
 * Copies a plain-text summary to the clipboard.
 * Includes: score, issue counts by severity, top 5 recommendations.
 *
 * Returns true on success, false on failure.
 * No network requests are made.
 */
export async function copyToClipboard(data: ReportData): Promise<boolean> {
  if (!hasIssues(data)) {
    return false;
  }

  const counts = countBySeverity(data.issues);
  const topIssues = data.issues.slice(0, 5);
  const recommendationLines = topIssues.map(recommendationLine);

  const lines = [
    'Angular Performance Inspector Report',
    '=====================================',
    '',
    `Timestamp: ${data.timestamp}`,
    `Angular Version: ${data.angularVersion ?? 'Unknown'}`,
    `Page URL: ${data.pageUrl}`,
    `Components Analyzed: ${data.componentCount}`,
    '',
    `Overall Score: ${data.score.overall}/100`,
    '',
    'Issue Counts:',
    `  Critical: ${counts.critical}`,
    `  High: ${counts.high}`,
    `  Medium: ${counts.medium}`,
    `  Low: ${counts.low}`,
    `  Info: ${counts.info}`,
    `  Total: ${data.issues.length}`,
    '',
    'Top Recommendations:',
    ...recommendationLines,
  ];

  const text = lines.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: use execCommand for environments where clipboard API is unavailable
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      textarea.remove();
      return success;
    } catch {
      return false;
    }
  }
}

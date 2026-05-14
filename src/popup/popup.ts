/**
 * Popup UI — Quick-glance dashboard for the Angular Performance Inspector.
 *
 * Communicates with the background worker via chrome.runtime.sendMessage.
 * The background worker routes messages to the content script → page script.
 */

import type { ExtensionMessage, ScanResultsPayload } from '../types/messages';
import type { AnalysisIssue } from '../types/analyzer';

const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement;
const resultsContainer = document.getElementById('results') as HTMLDivElement;
const statusContainer = document.getElementById('status') as HTMLDivElement;

scanBtn.addEventListener('click', async () => {
  statusContainer.innerHTML = '🔍 Scanning Angular application...';
  resultsContainer.innerHTML = '';
  scanBtn.disabled = true;

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      statusContainer.innerHTML = '⚠️ No active tab found.';
      scanBtn.disabled = false;
      return;
    }

    // Send SCAN_REQUEST through the background worker
    const scanMessage: ExtensionMessage = {
      type: 'SCAN_REQUEST',
      payload: { analyzers: [], config: {} },
      tabId: tab.id,
      timestamp: Date.now(),
    };

    const response = await chrome.runtime.sendMessage(scanMessage);

    if (!response || !response.success) {
      statusContainer.innerHTML = `⚠️ ${response?.error || 'Unable to connect to page. Try refreshing the tab.'}`;
      scanBtn.disabled = false;
      return;
    }

    // The scan was initiated — now wait for results via state polling
    // Give the scan time to complete (page-script runs analyzers async)
    statusContainer.innerHTML = '⏳ Analyzing... (this may take a few seconds)';

    // Poll for results after a short delay
    setTimeout(async () => {
      const stateMessage: ExtensionMessage = {
        type: 'STATE_REQUEST' as any,
        payload: {},
        tabId: tab.id,
        timestamp: Date.now(),
      };

      const stateResponse = await chrome.runtime.sendMessage(stateMessage);

      if (stateResponse?.success && stateResponse.state?.lastScanResults) {
        renderScanResults(stateResponse.state.lastScanResults);
      } else {
        statusContainer.innerHTML = '✅ Scan initiated. Results will appear after analysis completes.';
      }
      scanBtn.disabled = false;
    }, 4000); // Wait 4s for production analyzer's 3s mutation observation window

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    statusContainer.innerHTML = `⚠️ ${message}`;
    scanBtn.disabled = false;
  }
});

function renderScanResults(results: ScanResultsPayload) {
  const { detection, score, results: analyzerResults } = results;

  // Show detection info
  let header = '';
  if (detection.isAngular) {
    const version = detection.version ? `v${detection.version}` : '';
    const mode = detection.mode === 'development' ? '🟢 Dev' : '🟡 Prod';
    header = `<div class="detection">Angular ${version} ${mode} | ${detection.componentCount} components</div>`;
  } else {
    statusContainer.innerHTML = '❌ No Angular application detected on this page.';
    return;
  }

  // Show performance score
  const scoreColor = score.overall >= 80 ? '#4caf50' : score.overall >= 50 ? '#ff9800' : '#f44336';
  header += `<div class="score" style="color: ${scoreColor}; font-size: 2em; font-weight: bold;">${score.overall}/100</div>`;

  // Collect all issues from all analyzers
  const allIssues: AnalysisIssue[] = [];
  for (const result of analyzerResults) {
    allIssues.push(...result.issues);
  }

  statusContainer.innerHTML = header + `<div>Issues Found: ${allIssues.length}</div>`;

  // Render issues
  if (allIssues.length === 0) {
    resultsContainer.innerHTML = '<div class="success">✅ No performance issues detected. Your app looks good!</div>';
    return;
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  allIssues.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

  resultsContainer.innerHTML = '';
  for (const issue of allIssues) {
    const card = document.createElement('div');
    card.className = `issue-card severity-${issue.severity}`;

    const severityIcon = getSeverityIcon(issue.severity);

    card.innerHTML = `
      <div class="issue-header">
        <span class="severity-badge">${severityIcon} ${issue.severity}</span>
        <strong>${issue.component}</strong>
      </div>
      <div class="issue-title">${issue.title}</div>
      <div class="issue-desc">${issue.description}</div>
      <div class="issue-rec">💡 ${issue.recommendation}</div>
    `;

    resultsContainer.appendChild(card);
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🔵';
    case 'info': return 'ℹ️';
    default: return '⚪';
  }
}

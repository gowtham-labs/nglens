/**
 * ngLens - Angular Performance Analyzer
 * Copyright (c) 2026 ngLens Contributors
 * Licensed under GPL v3
 *
 * https://github.com/nglens/nglens
 *
 * Popup UI — Professional Chrome DevTools-style dashboard
 *
 * Features:
 * - Dark theme with tabs
 * - Lighthouse-style circular score gauge
 * - Expandable issue cards
 * - Filtering by severity/category
 * - Overlay controls
 */

import type { ExtensionMessage, ScanResultsPayload } from '../types/messages';
import type { AnalysisIssue } from '../types/analyzer';
import type { OverlayConfig } from '../types/overlay';
import type { PerformanceScore } from '../types/scoring';

// --- Security: HTML escaping to prevent XSS from analyzer-derived data ---

/**
 * Escapes HTML special characters to prevent XSS when inserting
 * analyzer-derived strings (component names, issue titles) into innerHTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// DOM elements
const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement;
const statusArea = document.getElementById('status') as HTMLDivElement;
const scorePanel = document.getElementById('scorePanel') as HTMLDivElement;
const issuesPanel = document.getElementById('issuesPanel') as HTMLDivElement;
const resultsContainer = document.getElementById('results') as HTMLDivElement;
const componentCount = document.getElementById('componentCount') as HTMLSpanElement;
const issueCountEl = document.getElementById('issueCount') as HTMLSpanElement;
const severityFilter = document.getElementById('severityFilter') as HTMLSelectElement;
const categoryFilter = document.getElementById('categoryFilter') as HTMLSelectElement;

// State
const activeOverlays = new Set<string>();
let currentTabId: number | undefined;
let currentTab = 'issues';
let allIssues: AnalysisIssue[] = [];
let scanResults: ScanResultsPayload | null = null;

// Initialize
setupTabNavigation();
setupFilters();

// Scan button handler
scanBtn.addEventListener('click', async () => {
  showStatus('⏳ Scanning Angular application...', 'loading');
  resultsContainer.innerHTML = '';
  scanBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showStatus('⚠ No active tab found', 'error');
      scanBtn.disabled = false;
      return;
    }

    currentTabId = tab.id;

    const scanMessage: ExtensionMessage = {
      type: 'SCAN_REQUEST',
      payload: { analyzers: [], config: {} },
      tabId: tab.id,
      timestamp: Date.now(),
    };

    const response = await chrome.runtime.sendMessage(scanMessage);

    if (!response || !response.success) {
      showStatus(response?.error || '⚠ Unable to connect to page', 'error');
      scanBtn.disabled = false;
      return;
    }

    showStatus('⏳ Analyzing components...', 'loading');

    setTimeout(async () => {
      const stateMessage: ExtensionMessage = {
        type: 'STATE_REQUEST' as any,
        payload: {},
        tabId: tab.id,
        timestamp: Date.now(),
      };

      const stateResponse = await chrome.runtime.sendMessage(stateMessage);

      if (stateResponse?.success && stateResponse.state?.lastScanResults) {
        scanResults = stateResponse.state.lastScanResults;
        if (scanResults) {
          renderScanResults(scanResults);
        }
      } else {
        showStatus('✓ Scan initiated. Results will appear shortly.', 'success');
      }
      scanBtn.disabled = false;
    }, 4000);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showStatus(`⚠ ${message}`, 'error');
    scanBtn.disabled = false;
  }
});

// --- UI Rendering Functions ---

function renderScanResults(results: ScanResultsPayload) {
  const { detection, score, results: analyzerResults } = results;

  // Show detection info
  if (!detection.isAngular) {
    showStatus('✕ No Angular application detected', 'error');
    return;
  }

  // Update footer stats
  const mode = detection.mode === 'development' ? 'Dev' : 'Prod';
  const version = detection.version ? `v${detection.version}` : '';
  componentCount.textContent = `${detection.componentCount} components`;

  // Collect issues
  allIssues = [];
  for (const result of analyzerResults) {
    allIssues.push(...result.issues);
  }

  issueCountEl.textContent = `${allIssues.length} issues`;

  // Show detection badge
  showDetectionInfo(detection.mode, version, detection.componentCount);

  // Render based on current tab
  if (currentTab === 'performance') {
    renderScoreGauge(score);
  } else {
    renderIssues(allIssues);
  }

  // Show filter controls if there are issues
  const filterControls = document.querySelector('.filter-controls') as HTMLElement;
  if (allIssues.length > 0) {
    filterControls.style.display = 'flex';
  }

  // Clear status
  statusArea.innerHTML = '';
  statusArea.className = 'status-area';
}

function showDetectionInfo(mode: string | null, version: string, count: number) {
  const badge = mode === 'development' ?
    '<span class="detection-badge dev">DEV</span>' :
    '<span class="detection-badge prod">PROD</span>';

  statusArea.innerHTML = `
    <div class="detection-info">
      ${badge}
      <span>Angular ${version}</span>
      <span style="margin-left: auto;">${count} components analyzed</span>
    </div>
  `;
  statusArea.className = 'status-area';
}

function renderScoreGauge(score: PerformanceScore) {
  scorePanel.style.display = 'block';
  issuesPanel.style.display = 'none';

  // Update circular gauge
  const svg = scorePanel.querySelector('.score-gauge') as SVGElement;
  const progressCircle = svg.querySelector('.gauge-progress') as SVGCircleElement;
  const scoreText = svg.querySelector('.gauge-score') as SVGTextElement;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = score.overall / 100;
  const offset = circumference * (1 - scorePercent);

  progressCircle.style.strokeDasharray = `${circumference}`;
  progressCircle.style.strokeDashoffset = `${offset}`;

  // Color based on score
  if (score.overall >= 80) {
    progressCircle.classList.add('score-good');
  } else if (score.overall >= 50) {
    progressCircle.classList.add('score-average');
  } else {
    progressCircle.classList.add('score-poor');
  }

  // Animate score count-up
  animateValue(scoreText, 0, score.overall, 1000);

  // Render sub-scores
  renderSubScores(score);
}

function renderSubScores(score: PerformanceScore) {
  const container = scorePanel.querySelector('.subscores-container') as HTMLElement;
  container.innerHTML = '';

  const subScores = [
    { name: 'Change Detection', value: score.subScores.changeDetection.score },
    { name: 'Tree Depth', value: score.subScores.componentTreeDepth.score },
    { name: 'Template', value: score.subScores.templateComplexity.score },
    { name: 'Bottlenecks', value: score.subScores.detectedBottlenecks.score },
  ];

  for (const sub of subScores) {
    const scoreClass = sub.value >= 80 ? 'score-good' :
                      sub.value >= 50 ? 'score-average' : 'score-poor';

    const item = document.createElement('div');
    item.className = 'subscore-item fade-in';
    item.innerHTML = `
      <div class="subscore-name">${sub.name}</div>
      <div class="subscore-value ${scoreClass}">${sub.value}</div>
    `;
    container.appendChild(item);
  }
}

function renderIssues(issues: AnalysisIssue[]) {
  scorePanel.style.display = 'none';
  issuesPanel.style.display = 'block';

  if (issues.length === 0) {
    resultsContainer.innerHTML = `
      <div class="message-box success">
        ✓ No performance issues detected. Your app looks great!
      </div>
    `;
    return;
  }

  // Add overlay controls
  const overlayableIssues = issues.filter(issue => issue.elementSelector);
  if (overlayableIssues.length > 0) {
    showOverlayControls(overlayableIssues);
  }

  // Sort by severity
  const severityOrder: Record<string, number> = {
    critical: 0, high: 1, medium: 2, low: 3, info: 4
  };
  issues.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

  resultsContainer.innerHTML = '';
  for (const issue of issues) {
    const card = createIssueCard(issue);
    resultsContainer.appendChild(card);
  }
}

function createIssueCard(issue: AnalysisIssue): HTMLElement {
  const card = document.createElement('div');
  card.className = `issue-card severity-${issue.severity} fade-in`;
  card.setAttribute('data-issue-id', issue.id);

  card.innerHTML = `
    <div class="issue-header">
      <div class="issue-header-left">
        <span class="severity-indicator ${escapeHtml(issue.severity)}"></span>
        <span class="issue-component">${escapeHtml(issue.component)}</span>
        <span class="issue-title-text">${escapeHtml(issue.title)}</span>
      </div>
      <span class="expand-icon">▸</span>
    </div>
    <div class="issue-details">
      <div class="issue-content">
        <div class="issue-description">${escapeHtml(issue.description)}</div>
        <div class="issue-recommendation">
          <span class="recommendation-label">Recommendation</span>
          <span class="recommendation-text">${escapeHtml(issue.recommendation)}</span>
        </div>
        ${issue.elementSelector ? `
          <div class="issue-actions">
            <button class="overlay-btn" data-issue-id="${escapeHtml(issue.id)}">
              <span class="overlay-icon">◉</span>
              <span>Show on Page</span>
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Add expand/collapse handler
  const header = card.querySelector('.issue-header') as HTMLElement;
  header.addEventListener('click', () => toggleIssueDetails(card));

  // Add overlay button handler
  if (issue.elementSelector) {
    const overlayBtn = card.querySelector('.overlay-btn') as HTMLButtonElement;
    overlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleOverlay(issue, overlayBtn);
    });
  }

  return card;
}

function toggleIssueDetails(card: HTMLElement) {
  card.classList.toggle('expanded');
}

function showOverlayControls(issues: AnalysisIssue[]) {
  const existing = document.querySelector('.overlay-controls');
  if (existing) existing.remove();

  const controls = document.createElement('div');
  controls.className = 'overlay-controls';
  controls.innerHTML = `
    <button class="overlay-control-btn" id="showAllBtn">
      ◉ Show All Issues
    </button>
    <button class="overlay-control-btn" id="clearAllBtn">
      ✕ Clear Overlays
    </button>
  `;

  issuesPanel.insertBefore(controls, resultsContainer);

  document.getElementById('showAllBtn')!.addEventListener('click', () => showAllOverlays(issues));
  document.getElementById('clearAllBtn')!.addEventListener('click', clearAllOverlays);
}

// --- Tab Navigation ---

function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      currentTab = tab.getAttribute('data-tab')!;

      if (scanResults) {
        if (currentTab === 'performance') {
          renderScoreGauge(scanResults.score);
        } else {
          renderIssues(allIssues);
        }
      }
    });
  });
}

// --- Filters ---

function setupFilters() {
  severityFilter.addEventListener('change', applyFilters);
  categoryFilter.addEventListener('change', applyFilters);
}

function applyFilters() {
  const severityValue = severityFilter.value;
  const categoryValue = categoryFilter.value;

  let filtered = [...allIssues];

  if (severityValue) {
    filtered = filtered.filter(issue => issue.severity === severityValue);
  }

  if (categoryValue) {
    filtered = filtered.filter(issue => issue.category === categoryValue);
  }

  renderIssues(filtered);
}

// --- Overlay Functions ---

function issueToOverlayConfig(issue: AnalysisIssue): OverlayConfig {
  return {
    elementSelector: issue.elementSelector!,
    severity: issue.severity,
    componentName: issue.component,
    issueType: issue.category,
    autoFadeTimeout: 5000,
    zIndex: 2147483647,
  };
}

async function sendOverlayMessage(
  type: 'OVERLAY_SHOW' | 'OVERLAY_HIDE' | 'OVERLAY_CLEAR_ALL',
  payload: unknown = {}
): Promise<void> {
  if (!currentTabId) return;

  const message: ExtensionMessage = {
    type,
    payload,
    tabId: currentTabId,
    timestamp: Date.now(),
  };

  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error(`Failed to send ${type}:`, error);
  }
}

async function toggleOverlay(issue: AnalysisIssue, button: HTMLButtonElement): Promise<void> {
  if (activeOverlays.has(issue.id)) {
    await sendOverlayMessage('OVERLAY_HIDE', { overlayId: issue.id });
    activeOverlays.delete(issue.id);
    button.classList.remove('active');
    button.innerHTML = '<span class="overlay-icon">◉</span><span>Show on Page</span>';
  } else {
    const config = issueToOverlayConfig(issue);
    await sendOverlayMessage('OVERLAY_SHOW', config);
    activeOverlays.add(issue.id);
    button.classList.add('active');
    button.innerHTML = '<span class="overlay-icon">✓</span><span>Shown</span>';

    setTimeout(() => {
      activeOverlays.delete(issue.id);
      button.classList.remove('active');
      button.innerHTML = '<span class="overlay-icon">◉</span><span>Show on Page</span>';
    }, config.autoFadeTimeout);
  }
}

async function showAllOverlays(issues: AnalysisIssue[]): Promise<void> {
  for (const issue of issues) {
    if (issue.elementSelector && !activeOverlays.has(issue.id)) {
      const config = issueToOverlayConfig(issue);
      await sendOverlayMessage('OVERLAY_SHOW', config);
      activeOverlays.add(issue.id);

      setTimeout(() => {
        activeOverlays.delete(issue.id);
      }, config.autoFadeTimeout);
    }
  }
}

async function clearAllOverlays(): Promise<void> {
  await sendOverlayMessage('OVERLAY_CLEAR_ALL');
  activeOverlays.clear();

  // Update all overlay buttons
  document.querySelectorAll('.overlay-btn').forEach(btn => {
    btn.classList.remove('active');
    (btn as HTMLButtonElement).innerHTML = '<span class="overlay-icon">◉</span><span>Show on Page</span>';
  });
}

// --- Utility Functions ---

function showStatus(message: string, type: 'loading' | 'success' | 'error') {
  statusArea.innerHTML = message;
  statusArea.className = `status-area ${type}`;
}

function animateValue(element: SVGTextElement, start: number, end: number, duration: number) {
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = Math.round(current).toString();
  }, 16);
}

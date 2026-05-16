# Implementation Plan: Angular Performance Inspector — V1 "Useful & Stable"

## Overview

V1 answers the core user question: **"Why is my Angular app slow? What should I fix first?"**

This release delivers: Angular detection, performance scoring, DOM analysis, OnPush/trackBy detection, prioritized action items, element overlay, popup UI with learning mode, export reports, contextual help, and before/after improvement tracking.

**Constraints enforced throughout:**
- Extension CPU usage < 3% of page CPU during analysis
- Extension memory < 50MB
- All MutationObservers auto-disconnected within 100ms of scan completion
- No data leaves the browser (no analytics, no external API calls)
- DOM traversal capped at 1000 elements per scan pass

## Tasks

- [x] 1. Foundation: Types, Utilities, Communication, Build Config, and Cross-Cutting Constraints
  - [x] 1.1 Create shared type definitions
    - Create `src/types/analyzer.ts` with `Severity`, `RuntimeMode`, `AnalyzerConfig`, `AnalysisIssue`, `AnalyzerType`, `IssueCategory`, `AnalyzerResult`, and `Analyzer` interface
    - Create `src/types/scoring.ts` with `PerformanceSubScore` and `PerformanceScore` interfaces
    - Create `src/types/messages.ts` with `MessageType`, `ExtensionMessage`, `PageMessage`, `ScanRequestPayload`, `ScanResultsPayload`, and `DetectionResult` interfaces
    - Create `src/types/actions.ts` with `ImpactLevel`, `ActionItem`, and `ActionListState` interfaces
    - Create `src/types/report.ts` with `ReportData` and `ExportFormat` types
    - Create `src/types/help.ts` with `HelpEntry` interface
    - Create `src/types/overlay.ts` with `OverlayConfig` interface
    - Create `src/types/performance-budget.ts` with `PerformanceBudget`, `BudgetViolation`, and `SamplingConfig` interfaces
    - _Requirements: 2.1, 2.2, 16.1, 18.4, 17.1_

  - [x] 1.2 Create utility modules
    - Create `src/utils/constants.ts` with shared thresholds (DOM node limits: 1500/800, timing budgets: 16ms, scan caps: 1000 elements, severity weights, category multipliers, performance budget limits: 3% CPU / 50MB memory)
    - Create `src/utils/dom-utils.ts` with DOM traversal helpers (finding Angular components, counting subtree nodes, detecting Angular attributes, max 1000 elements per scan pass)
    - Create `src/utils/serializer.ts` with safe JSON serialization (circular reference detection via WeakSet, string truncation at 500 chars, DOM/function exclusion)
    - Create `src/utils/timing.ts` with performance measurement utilities (mark/measure wrappers, duration calculation, idle callback scheduling)
    - _Requirements: 3.3, 4.2, 18.6_

  - [x] 1.3 Implement the communication architecture
    - Rewrite `src/content/content.ts` as the message bridge supporting V1 `MessageType` protocol (SCAN_REQUEST, SCAN_RESULTS, OVERLAY_SHOW, OVERLAY_HIDE, DETECTION_STATUS, ERROR)
    - Create `src/content/message-bridge.ts` with CustomEvent dispatch/listen helpers and chrome.runtime relay logic
    - Rewrite `src/background/background.ts` as the message router handling tab lifecycle, session storage persistence, and message forwarding between content script and popup
    - Create `src/background/tab-manager.ts` with per-tab state management using `chrome.storage.session` (store/retrieve `TabSessionState`)
    - Create `src/background/message-router.ts` with routing logic for scan requests and state queries
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 1.4 Update build configuration and manifest
    - Update `vite.config.ts` to produce separate bundles: page-script.js, content.js, background.js, popup
    - Update `manifest.json` to add `storage` permission, update `web_accessible_resources` for page-script.js
    - Add privacy statement to manifest description: "All analysis is local. No data leaves the browser."
    - _Requirements: 14.1_

  - [x] 1.5 Implement extension self-performance budget enforcement
    - Create `src/utils/performance-budget.ts` with CPU usage tracking (must stay below 3% of page CPU during analysis)
    - Implement memory footprint monitoring (must stay below 50MB)
    - Implement auto-disconnect for MutationObservers within 100ms of scan completion
    - Add performance self-check that warns if extension overhead exceeds budget
    - _Cross-cutting constraint: Extension Self-Performance Budget_

  - [x] 1.6 Implement sampling and throttling strategy
    - Create `src/utils/sampling.ts` with MutationObserver batching (100ms windows, process in idle callbacks)
    - Implement DOM traversal cap (max 1000 elements per scan pass)
    - Implement auto-throttle: pause analysis if page FPS drops below 50
    - Implement observer cleanup: all observers disconnected within 100ms of scan/profile end
    - _Cross-cutting constraint: Sampling & Throttling Strategy_

  - [x] 1.7 Implement privacy and security constraints
    - Create `src/utils/privacy.ts` with validation that no external network requests are made
    - Ensure no analytics, telemetry, or external API calls in any module
    - Ensure all help content is bundled locally (no fetch calls for content)
    - Only allowed network: opening documentation links in new tabs via `chrome.tabs.create`
    - _Cross-cutting constraint: Privacy & Security Model_

  - [ ]* 1.8 Write property tests for serialization safety (Property 13)
    - **Property 13: State Serialization Safety**
    - Test that for any component state value, the serializer produces valid JSON, truncates strings > 500 chars, and replaces circular references with "[Circular Reference]" without throwing
    - **Validates: Requirements 8.4, 8.5**

  - [ ]* 1.9 Write unit tests for utility modules
    - Test `dom-utils.ts` Angular attribute detection, subtree counting, 1000-element cap
    - Test `serializer.ts` with nested objects, circular refs, long strings, functions, DOM nodes
    - Test `constants.ts` threshold values
    - Test `performance-budget.ts` CPU/memory limit enforcement
    - Test `sampling.ts` batching and throttle behavior
    - _Requirements: 3.3, 4.2, 18.6_

- [x] 2. Checkpoint - Foundation complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Core Analyzers: Detection, Scoring, DOM Inspector, Basic Enterprise Checks
  - [x] 3.1 Implement the base analyzer class and registry
    - Create `src/analyzers/base-analyzer.ts` with abstract base class implementing the `Analyzer` interface (timeout handling, error wrapping, dispose pattern, performance budget check before/after run)
    - Create `src/analyzers/index.ts` as the analyzer registry and orchestrator (runs selected analyzers in parallel, collects results, enforces per-analyzer timeout of 5s, respects sampling config)
    - _Requirements: 14.2_

  - [x] 3.2 Implement Angular detection and page-script orchestrator
    - Rewrite `src/content/page-script.ts` as the orchestrator that listens for scan requests, instantiates analyzers, and dispatches results
    - Implement detection logic: check `window.ng` presence, read `[ng-version]` attribute, determine runtime mode, count components
    - Integrate performance budget: check extension overhead before/after scan
    - Integrate sampling: respect DOM traversal cap (1000 elements per pass)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 3.3 Implement the Performance Scorer analyzer
    - Create `src/analyzers/performance-scorer.ts` implementing weighted score computation (CD strategy 40%, tree depth 20%, template complexity 20%, bottlenecks 20%)
    - Compute each sub-score from 0-100 based on metrics gathered from component traversal
    - Return `PerformanceScore` with overall score clamped to [0, 100]
    - Handle production mode: return score 0 with degradation notice when `window.ng` unavailable
    - _Requirements: 2.1, 2.2, 2.6, 2.7_

  - [ ]* 3.4 Write property tests for detection and scoring (Properties 1, 2, 3)
    - **Property 1: Angular Detection Correctness** — for any page state, detection correctly reports mode
    - **Property 2: Performance Score Computation and Range** — weighted sum always in [0, 100]
    - **Property 3: Score Color Mapping** — correct color for any score
    - **Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.2, 2.4**

  - [x] 3.5 Implement the Production Analyzer
    - Create `src/analyzers/production-analyzer.ts` implementing DOM-based heuristics when `window.ng` is unavailable
    - Infer component boundaries from `_ngcontent-*`, `_nghost-*`, `ng-reflect-*` attributes
    - Estimate component tree depth (max 512 levels)
    - Detect excessive DOM node counts (>1500 per component subtree)
    - Measure DOM mutation frequency via MutationObserver (>10 mutations/sec over 3s = excessive)
    - Disconnect MutationObserver within 100ms after scan completes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.6 Write property tests for production analyzer (Properties 4, 5, 6)
    - **Property 4: Production Component Boundary Inference** — elements with `_nghost-*` identified as boundaries
    - **Property 5: Component Tree Depth Calculation** — depth never exceeds 512
    - **Property 6: DOM Complexity Threshold Detection** — flagged iff node count exceeds threshold
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.2**

  - [x] 3.7 Implement the DOM Inspector analyzer
    - Create `src/analyzers/dom-inspector.ts` implementing layout thrashing detection (3+ alternating read/write ops)
    - Detect excessive DOM complexity (>800 nodes per component subtree)
    - Track forced reflow events (layout-triggering property access after style mutation)
    - Detect render bottlenecks (>50 DOM mutations per CD cycle)
    - Measure rendering phase duration via Performance API (flag >16ms)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 3.8 Write property tests for DOM Inspector (Properties 7, 8, 9)
    - **Property 7: Layout Thrashing Detection** — detected iff 3+ alternating read-write ops
    - **Property 8: Mutation-Based Bottleneck Detection** — flagged iff mutations > 50
    - **Property 9: Render Duration Threshold** — flagged iff duration > 16ms
    - **Validates: Requirements 4.1, 4.4, 4.5**

  - [x] 3.9 Implement basic Enterprise Optimizer checks (trackBy + OnPush)
    - Create `src/analyzers/enterprise-optimizer.ts` with V1 scope:
      - Detect `*ngFor`/`@for` without `trackBy`/`track` expression
      - Detect components using Default change detection that could use OnPush
    - Report component name and template location for each finding
    - Handle production mode gracefully (list skipped checks)
    - _Requirements: 7.6, 7.7_

  - [x] 3.10 Implement basic Best Practices Detector
    - Create `src/analyzers/best-practices-detector.ts` with V1 scope:
      - Detect functions called directly in templates
      - Detect missing trackBy in *ngFor
    - Categorize by learning topic: Change Detection, Template Best Practices
    - Provide "Why this is a problem" + "Better approach" with code examples
    - Store rules and content locally in extension bundle
    - _Requirements: 37.1, 37.2, 37.3, 37.6_

- [x] 4. Checkpoint - Core analyzers complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Services: Action Prioritizer, Report Exporter, Help Content, Fix Difficulty, Improvement Tracker
  - [ ] 5.1 Implement the Action Prioritizer service
    - Create `src/services/action-prioritizer.ts` implementing impact scoring algorithm
    - Compute impact score: severity weight × category multiplier + frequency bonus
    - Sort descending by impact score, map to impact levels (≥100=high, ≥50=medium, <50=low)
    - Cap at 50 displayed items
    - Detect resolved issues by comparing current vs previous scan results (by issue id)
    - _Requirements: 16.1, 16.2, 16.6, 16.7, 16.8_

  - [ ]* 5.2 Write property tests for Action Prioritizer (Properties 20, 21, 22, 23)
    - **Property 20: Action List Impact Sorting** — items sorted by impact descending
    - **Property 21: Action List Filtering** — filtered output contains only matching items
    - **Property 22: Action List Display Cap** — at most 50 items displayed
    - **Property 23: Resolved Issue Detection** — resolved iff present in previous but absent in current
    - **Validates: Requirements 16.1, 16.4, 16.5, 16.6, 16.8**

  - [ ] 5.3 Implement the Report Exporter service
    - Create `src/services/report-exporter.ts` with JSON, Markdown, and clipboard export
    - JSON export: sanitized data as downloadable file (`angular-perf-report-{timestamp}.json`)
    - Markdown export: summary + detailed issues as downloadable file
    - Clipboard: plain-text summary with score, issue counts, top 5 recommendations
    - Include metadata: ISO 8601 timestamp, Angular version, page URL, component count
    - Sanitize: remove DOM refs, functions, circular structures (no network requests)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ]* 5.4 Write property tests for Report Exporter (Properties 24, 25)
    - **Property 24: Report Data Sanitization** — output contains only serializable primitives, arrays, plain objects
    - **Property 25: Report Metadata Completeness** — all exports include timestamp, version, URL, component count
    - **Validates: Requirements 18.4, 18.6**

  - [ ] 5.5 Implement the Contextual Help service
    - Create `src/services/help-content.ts` as the help data access layer
    - Create `src/data/help-entries.json` with static help content for V1 categories (change-detection, dom-complexity, render-performance)
    - Provide "Why it matters", "How to fix", code examples, angular.dev URLs
    - All content bundled locally — zero network requests
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [ ]* 5.6 Write property test for Help Content (Property 26)
    - **Property 26: Help Content Completeness** — every V1 issue category has at least one help entry
    - **Validates: Requirements 20.4**

  - [ ] 5.7 Implement the Fix Difficulty Assessor
    - Create `src/services/fix-difficulty-assessor.ts` assigning difficulty and expected gain
    - Difficulty: Easy (single-line), Moderate (2-5 lines), Hard (architectural)
    - Expected gain: Large (10+ points), Medium (5-10 points), Small (1-5 points)
    - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5_

  - [x] 5.8 Implement the Improvement Tracker service
    - Create `src/services/improvement-tracker.ts` comparing current vs previous scan
    - Show improvements/regressions per metric with % change
    - Positive reinforcement when score improves by 5+ points
    - Mark resolved issues as "Fixed"
    - Handle first-scan case
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6_

- [ ] 6. Checkpoint - Services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Popup UI Dashboard
  - [ ] 7.1 Implement the Popup UI dashboard structure
    - Rewrite `src/popup/popup.ts` with tabbed navigation: Overview, Recommendations
    - Default to Overview tab on open
    - Preserve tab content and scroll position when switching
    - Support dark/light mode based on OS preference
    - Display inactive state when no Angular app detected
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.6_

  - [ ] 7.2 Implement the Overview tab
    - Create `src/ui/popup/components/score-display.ts` with color indicator and tooltip sub-scores
    - Display Angular version and runtime mode
    - Show "Changes Since Last Scan" from Improvement Tracker
    - Display Learning Mode toggle
    - _Requirements: 2.3, 2.4, 2.5, 36.5, 33.1_

  - [ ] 7.3 Implement the Recommendations tab
    - Create `src/ui/popup/components/action-list.ts` with prioritized items
    - "Show me" button for overlay trigger
    - Severity, category, and difficulty filters
    - "Quick Wins" view (Easy + Large/Medium gain)
    - Difficulty/gain badges, resolved checkmarks
    - Max 50 items with "show more"
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 35.3, 35.4, 35.5_

  - [ ] 7.4 Implement Learning Mode UI
    - Beginner/Advanced toggle persisted in `chrome.storage.local`
    - Beginner: plain-language titles, "What is this?", "Why it's bad", "Copy-paste fix"
    - Beginner: "Severity + Difficulty" badge per issue
    - Advanced: full metrics and raw data
    - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6_

  - [ ] 7.5 Implement contextual help display
    - Inline "Why it matters" and "How to fix" per issue
    - "Learn More" expansion with code examples and angular.dev links
    - Documentation links open in new tab
    - _Requirements: 20.1, 20.2, 20.3, 20.5_

  - [ ] 7.6 Implement export controls
    - Export buttons: JSON, Markdown, Copy to Clipboard
    - Confirmation messages on success
    - _Requirements: 18.1, 18.2, 18.3_

- [ ] 8. Checkpoint - UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Element Overlay and End-to-End Integration
  - [ ] 9.1 Implement the Element Overlay
    - Create `src/content/overlay.ts` with severity-colored overlay (red/orange/blue)
    - Tooltip with component name and issue type
    - Dismiss on click outside or Escape (100ms), auto-fade after 5s
    - Scroll into view, handle removed elements, z-index 2147483647
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

  - [ ]* 9.2 Write property test for Overlay (Property 27)
    - **Property 27: Overlay Severity Color Mapping** — correct color per severity
    - **Validates: Requirements 17.2**

  - [ ] 9.3 Wire scan pipeline end-to-end
    - Connect popup "Scan" → background → content → page-script → analyzers → results → UI
    - Run V1 analyzers: detection, scorer, production, DOM inspector, enterprise-basic, best-practices
    - Verify performance budget not exceeded during full scan
    - _Requirements: 14.1, 14.2, 15.2_

  - [ ] 9.4 Wire overlay and help triggers
    - Connect "show me" clicks to Element Overlay via content script messaging
    - Connect help content to issue cards
    - _Requirements: 16.3, 17.1, 20.1_

  - [ ] 9.5 Wire export and improvement tracking
    - Connect export buttons to Report Exporter
    - Connect improvement display to Improvement Tracker
    - _Requirements: 18.1, 18.2, 18.3, 36.1_

- [ ] 10. Final V1 Checkpoint - V1 is shippable
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: extension CPU < 3% during scan, memory < 50MB, all observers disconnected after scan
  - Verify: no external network requests made during any operation
  - V1 is complete and ready to ship to Chrome Web Store.

## Notes

- Tasks marked with `*` are optional property-based tests (recommended but can be deferred)
- V1 covers Requirements: 1, 2, 3, 4, 7.6, 7.7, 14, 15, 16, 17, 18, 20, 33, 35, 36, 37.1-37.3, 37.6
- V2 and V3 tasks are in separate files: `tasks-v2.md` and `tasks-v3.md`
- All analyzers use the same base class and registry — V2/V3 analyzers plug in without modifying V1 code
- Extension self-performance budget is enforced from day one

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "1.6", "1.7"] },
    { "id": 2, "tasks": ["1.8", "1.9"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.5", "3.7", "3.9", "3.10"] },
    { "id": 5, "tasks": ["3.4", "3.6", "3.8"] },
    { "id": 6, "tasks": ["5.1", "5.3", "5.5", "5.7", "5.8"] },
    { "id": 7, "tasks": ["5.2", "5.4", "5.6"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3", "9.4", "9.5"] },
    { "id": 12, "tasks": ["9.7"] }
  ]
}
```

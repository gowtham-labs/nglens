# Requirements Document

## Introduction

This document specifies the requirements for implementing the six remaining analyzers in the ngLens Chrome extension. These analyzers extend the existing architecture (BaseAnalyzer, registry, orchestrator) to cover Zone.js overhead profiling, change detection profiling, bundle size analysis, lazy loading mistake detection, slow initial load detection, and state management anti-pattern detection. Each analyzer runs in the page context via the page-script, respects the performance budget (CPU < 3%, memory < 50MB, max 1000 elements per scan), and produces AnalysisIssue results compatible with the existing pipeline.

## Glossary

- **Zone_Profiler**: The analyzer that detects excessive Zone.js async operation triggers causing unnecessary change detection cycles
- **CD_Profiler**: The analyzer that profiles change detection cycle frequency and duration, identifying components checked too often
- **Bundle_Analyzer**: The analyzer that detects large third-party libraries, duplicate dependencies, and unused imports by inspecting loaded scripts
- **Lazy_Loading_Detector**: The analyzer that identifies eagerly loaded modules that should be lazy-loaded and large initial bundles
- **Initial_Load_Detector**: The analyzer that measures and flags slow initial load patterns including blocking scripts and excessive API calls
- **State_Analyzer**: The analyzer that detects anti-patterns in state management such as derived state storage and excessive subscriptions
- **Orchestrator**: The existing system that runs analyzers in parallel via Promise.allSettled with per-analyzer timeout enforcement
- **Performance_Budget**: The constraint system limiting CPU to 3%, memory to 50MB, and DOM traversal to 1000 elements per scan
- **AnalyzerType**: The TypeScript union type identifying each analyzer, used as a registry key
- **RuntimeMode**: Either 'development' (window.ng available) or 'production' (heuristic-based detection only)
- **Change_Detection_Cycle**: A single pass of Angular's change detection mechanism checking component bindings for changes
- **Zone_Patch**: A monkey-patch applied by Zone.js to async APIs (setTimeout, setInterval, XHR, addEventListener) to trigger change detection

## Requirements

### Requirement 1: Zone.js Overhead Profiler

**User Story:** As a developer, I want to identify which async operations trigger the most unnecessary change detection cycles, so that I can reduce Zone.js overhead and improve application responsiveness.

#### Acceptance Criteria

1. WHEN a scan is initiated in development mode, THE Zone_Profiler SHALL intercept Zone.js-patched async operations (setTimeout, setInterval, XMLHttpRequest, addEventListener) and count change detection triggers per operation type
2. WHEN the Zone_Profiler detects an async operation type triggering more than 10 change detection cycles within a 3-second observation window, THE Zone_Profiler SHALL report an issue with severity proportional to the trigger count
3. WHILE profiling Zone.js triggers, THE Zone_Profiler SHALL categorize triggers by source type (timer, XHR, DOM event, microtask) and report the top offenders
4. IF the Zone_Profiler cannot access Zone.js internals (Zone not present or production mode without Zone), THEN THE Zone_Profiler SHALL return an empty result with metadata indicating the skip reason
5. THE Zone_Profiler SHALL complete execution within the 5-second per-analyzer timeout enforced by the Orchestrator
6. WHEN reporting issues, THE Zone_Profiler SHALL include a recommendation for each issue suggesting runOutsideAngular, NgZone configuration, or zoneless alternatives

### Requirement 2: Change Detection Profiler

**User Story:** As a developer, I want to measure change detection cycle frequency and duration per component, so that I can identify components causing performance bottlenecks through excessive re-renders.

#### Acceptance Criteria

1. WHEN a scan is initiated in development mode, THE CD_Profiler SHALL measure the frequency and average duration of change detection cycles over a 2-second observation window
2. WHEN a component is checked more than 20 times within the observation window, THE CD_Profiler SHALL flag the component with severity based on check frequency (critical above 50, high above 30, medium above 20)
3. WHILE profiling change detection, THE CD_Profiler SHALL identify components using the Default change detection strategy that could benefit from OnPush
4. IF the Angular debug API (window.ng) is unavailable, THEN THE CD_Profiler SHALL return an empty result with metadata indicating development mode is required
5. THE CD_Profiler SHALL report the total number of change detection cycles, average cycle duration in milliseconds, and the top 10 most-checked components
6. WHEN reporting issues, THE CD_Profiler SHALL include recommendations for OnPush strategy, trackBy usage, or signal-based reactivity

### Requirement 3: Bundle Size Analyzer

**User Story:** As a developer, I want to detect large third-party libraries and duplicate dependencies loaded on the page, so that I can reduce bundle size and improve load performance.

#### Acceptance Criteria

1. WHEN a scan is initiated, THE Bundle_Analyzer SHALL enumerate all script elements loaded on the page and estimate their sizes using resource timing entries or content-length headers
2. WHEN a loaded script exceeds 100KB (estimated transfer size), THE Bundle_Analyzer SHALL report it as a large dependency with the estimated size in the issue metadata
3. WHEN the Bundle_Analyzer detects multiple versions of the same library loaded on the page, THE Bundle_Analyzer SHALL report a duplicate dependency issue with critical severity
4. THE Bundle_Analyzer SHALL operate in both development and production RuntimeMode without requiring window.ng access
5. WHEN reporting large dependency issues, THE Bundle_Analyzer SHALL include recommendations for tree-shaking, lazy loading, or lighter alternatives
6. IF Resource Timing API data is unavailable for a script, THEN THE Bundle_Analyzer SHALL skip size estimation for that script and note the limitation in metadata

### Requirement 4: Lazy Loading Mistakes Detector

**User Story:** As a developer, I want to detect modules that are eagerly loaded but should be lazy-loaded, so that I can reduce the initial bundle size and improve time-to-interactive.

#### Acceptance Criteria

1. WHEN a scan is initiated, THE Lazy_Loading_Detector SHALL analyze the initial script payload to identify route modules loaded upfront instead of on-demand
2. WHEN the total initial JavaScript payload exceeds 500KB (transfer size), THE Lazy_Loading_Detector SHALL report a large initial bundle issue with high severity
3. WHEN the Lazy_Loading_Detector identifies Angular route configurations loaded eagerly (detected via script content patterns or module markers), THE Lazy_Loading_Detector SHALL flag each eagerly loaded route module
4. THE Lazy_Loading_Detector SHALL operate in both development and production RuntimeMode
5. WHEN reporting issues, THE Lazy_Loading_Detector SHALL include recommendations for loadChildren syntax, dynamic imports, and preloading strategies
6. IF the page uses a single monolithic bundle with no code splitting evidence, THEN THE Lazy_Loading_Detector SHALL report a critical issue recommending route-based code splitting

### Requirement 5: Slow Initial Load Detector

**User Story:** As a developer, I want to identify patterns causing slow initial page loads, so that I can optimize time-to-first-contentful-paint and time-to-interactive.

#### Acceptance Criteria

1. WHEN a scan is initiated, THE Initial_Load_Detector SHALL measure initial load metrics using Navigation Timing API and Resource Timing API data
2. WHEN the main bundle transfer size exceeds 300KB, THE Initial_Load_Detector SHALL report a large main bundle issue
3. WHEN the Initial_Load_Detector identifies render-blocking scripts (scripts without async or defer attributes loaded in the document head), THE Initial_Load_Detector SHALL report each blocking script as an issue
4. WHEN more than 5 API calls are initiated before the DOMContentLoaded event, THE Initial_Load_Detector SHALL report excessive initial API calls with medium severity
5. THE Initial_Load_Detector SHALL operate in both development and production RuntimeMode without requiring window.ng access
6. WHEN reporting issues, THE Initial_Load_Detector SHALL include recommendations for preload hints, script deferral, critical CSS inlining, or API call batching
7. IF Navigation Timing data indicates time-to-interactive exceeds 5 seconds, THEN THE Initial_Load_Detector SHALL report a critical slow load issue with the measured timing

### Requirement 6: State Management Anti-Pattern Detector

**User Story:** As a developer, I want to detect anti-patterns in my state management implementation, so that I can improve application performance and maintainability.

#### Acceptance Criteria

1. WHEN a scan is initiated in development mode, THE State_Analyzer SHALL inspect component instances for state management patterns (NgRx store subscriptions, BehaviorSubject usage, service-based state)
2. WHEN a component has more than 5 active store subscriptions, THE State_Analyzer SHALL report excessive subscriptions with high severity
3. WHEN the State_Analyzer detects computed or derived values stored in state (properties that duplicate or transform other state properties), THE State_Analyzer SHALL report a derived state anti-pattern
4. WHEN a state object serialized size exceeds 100KB, THE State_Analyzer SHALL report a large state object issue with recommendations for normalization
5. IF the Angular debug API (window.ng) is unavailable, THEN THE State_Analyzer SHALL return an empty result with metadata indicating development mode is required
6. WHEN reporting issues, THE State_Analyzer SHALL include recommendations for selectors, memoization, computed signals, or state normalization

### Requirement 7: AnalyzerType Extension

**User Story:** As a developer, I want the type system to support the new analyzer types, so that the registry and orchestrator can manage all analyzers uniformly.

#### Acceptance Criteria

1. THE AnalyzerType union SHALL include 'lazy-loading-detector' and 'initial-load-detector' as valid values
2. THE IssueCategory union SHALL include 'lazy-loading' and 'initial-load' as valid values for categorizing issues from the new analyzers
3. WHEN a new analyzer is registered via registerAnalyzer, THE Orchestrator SHALL include the new analyzer in scan runs without modification to orchestration logic

### Requirement 8: Performance Budget Compliance

**User Story:** As a developer, I want all new analyzers to respect the extension performance budget, so that the analysis does not degrade the inspected application.

#### Acceptance Criteria

1. THE Zone_Profiler, CD_Profiler, Bundle_Analyzer, Lazy_Loading_Detector, Initial_Load_Detector, and State_Analyzer SHALL each complete execution within 5000 milliseconds
2. WHILE any analyzer is executing, THE Performance_Budget monitor SHALL track CPU usage and memory consumption, terminating the analyzer if CPU exceeds 3% or memory exceeds 50MB
3. THE Zone_Profiler and CD_Profiler SHALL use observation windows no longer than 3 seconds to stay within the per-analyzer timeout
4. WHEN an analyzer exceeds the performance budget, THE Orchestrator SHALL return a partial result with error metadata indicating the budget violation

### Requirement 9: Analyzer Registration and Auto-Import

**User Story:** As a developer, I want new analyzers to self-register on import, so that adding an analyzer requires only a side-effect import in the page-script entry point.

#### Acceptance Criteria

1. WHEN a new analyzer module is imported, THE analyzer SHALL call registerAnalyzer with its instance at module evaluation time
2. THE page-script entry point SHALL include side-effect imports for all six new analyzer modules
3. WHEN the page-script initializes, THE Orchestrator SHALL have access to all registered analyzers including the six new analyzers via the registry

# Requirements Document

## Introduction

The Angular Performance Inspector is a Chrome Extension (Manifest V3) that provides comprehensive runtime performance analysis for Angular applications. It extends the existing basic Angular detection and change detection strategy checking into a full-featured performance tool covering real-time scoring, production heuristics, DOM/render bottleneck detection, Signals migration suggestions, RxJS leak detection, enterprise optimization recommendations, state viewers, profilers, and performance analyzers. The extension uses a content script + page-script architecture to access Angular internals and DOM APIs from the page context.

## Glossary

- **Extension**: The Angular Performance Inspector Chrome Extension
- **Page_Script**: The JavaScript module injected into the page's main world context that can access `window.ng`, Angular internals, and page-level APIs
- **Content_Script**: The Chrome extension content script running in an isolated world that bridges communication between the Page_Script and the Extension popup/background
- **Background_Worker**: The Chrome extension service worker that manages extension lifecycle and cross-tab state
- **Popup_UI**: The extension popup interface that displays analysis results and controls to the user
- **Performance_Scorer**: The module responsible for computing a real-time performance score for the inspected Angular application
- **Production_Analyzer**: The module that performs performance heuristics on production builds where `window.ng` is unavailable
- **DOM_Inspector**: The module that detects DOM rendering bottlenecks, excessive re-renders, and layout thrashing
- **Signals_Advisor**: The module that identifies opportunities to migrate from RxJS/zone-based patterns to Angular Signals
- **RxJS_Leak_Detector**: The module that identifies unsubscribed observables and potential memory leaks from RxJS subscriptions
- **Enterprise_Optimizer**: The module that provides optimization recommendations for large-scale Angular applications
- **State_Viewer**: The module that inspects and visualizes component state, service state, and store state
- **Change_Detection_Profiler**: The module that profiles Angular change detection cycles
- **Zone_Profiler**: The module that profiles Zone.js event triggers and their performance impact
- **Component_Profiler**: The module that measures individual component render times
- **Bundle_Analyzer**: The module that estimates bundle impact from loaded scripts
- **Network_Correlator**: The module that correlates network waterfall data with Angular rendering performance
- **Action_List**: The module that generates a prioritized list of actionable performance fixes ranked by estimated impact
- **Element_Overlay**: The module that highlights DOM elements on the page corresponding to flagged components with a colored overlay showing issue details
- **Report_Exporter**: The module that exports scan results in multiple formats (JSON, Markdown, clipboard) for sharing with team members
- **DevTools_Panel**: A Chrome DevTools panel (alongside Elements, Network, Console) that provides the full dashboard experience without the constraints of the popup window
- **CD_Efficiency_Scorer**: The module that calculates the ratio of useful renders (those causing DOM updates) to total change detection executions per component
- **Stability_Scorer**: The module that computes a stability score per component based on rerender frequency, mutation frequency, input churn, and DOM thrashing
- **Interaction_Latency_Tracker**: The module that measures end-to-end latency from user interaction (click, keypress) through Angular processing to final DOM render completion
- **FPS_Monitor**: The module that tracks frame rate and dropped frames during user interactions using requestAnimationFrame
- **Route_TTI_Tracker**: The module that measures Time-to-Interactive per route including route activation, lazy chunk loading, and render completion
- **Memory_Trend_Monitor**: The module that tracks JavaScript heap memory growth over time to detect memory accumulation patterns
- **Interaction_Heatmap**: The module that generates a visual overlay showing rerender frequency and interaction intensity across page regions
- **Signals_Adoption_Scorer**: The module that calculates the percentage of Signal-based patterns vs traditional RxJS/imperative patterns in the application
- **Template_Complexity_Scorer**: The module that computes a complexity score per component template based on structural directives, pipes, method calls, bindings, and nested conditions
- **Perceived_Performance_Scorer**: The module that computes a user-experience-level performance score based on interaction latency, frame drops, and layout stability
- **Baseline_Regression_Detector**: The module that stores performance baselines and detects regressions by comparing current scan results against stored baselines
- **Architecture_Smell_Detector**: The module that identifies Angular architectural anti-patterns such as oversized smart components, prop drilling, service overcoupling, and zone-heavy architecture
- **Learning_Mode**: A UI mode toggle that switches the extension between "Beginner" (simplified explanations, fix examples, learning links) and "Advanced" (raw metrics, profiler data, timelines) presentation styles
- **Render_Reason_Tracker**: The module that identifies and explains why a specific component re-rendered (input change, parent rerender, observable emission, timer trigger)
- **Fix_Difficulty_Assessor**: The module that estimates the difficulty level (easy, moderate, hard) of implementing a recommended fix based on the scope of code changes required
- **Improvement_Tracker**: The module that compares scan results before and after a fix to show the measurable impact of the optimization

## Requirements

### Requirement 1: Angular Application Detection

**User Story:** As an Angular developer, I want the extension to detect whether the current page is an Angular application, so that I can confirm the tool is applicable before running analysis.

#### Acceptance Criteria

1. WHEN a page with a `[ng-version]` or `[_nghost]` attribute is loaded, THE Extension SHALL display the detection result in the popup within 2 seconds of page load completion
2. WHEN `window.ng` is available on the page, THE Page_Script SHALL report the Angular version string from the `[ng-version]` attribute value and the runtime mode as either "development" or "production" to the Content_Script via CustomEvent
3. WHEN `window.ng` is unavailable but a `[ng-version]` or `[_nghost]` attribute is present in the DOM, THE Page_Script SHALL report the runtime mode as "production" to the Content_Script via CustomEvent
4. IF no `[ng-version]` and no `[_nghost]` attributes are detected in the DOM and `window.ng` is unavailable, THEN THE Extension SHALL display a message in the popup indicating that no Angular application was found
5. IF the Page_Script does not respond to a scan request within 3 seconds, THEN THE Extension SHALL display a timeout message in the popup indicating the scan could not be completed

### Requirement 2: Real-Time Performance Scoring

**User Story:** As an Angular developer, I want a real-time performance score for my Angular application, so that I can quickly assess overall application health.

#### Acceptance Criteria

1. WHEN a scan is initiated on a detected Angular application, THE Performance_Scorer SHALL compute a numeric score between 0 and 100, where 100 represents no detected issues and 0 represents maximum degradation across all measured factors
2. THE Performance_Scorer SHALL compute the score as a weighted sum of four sub-scores each ranging from 0 to 100: change detection strategy usage (40%), component tree depth (20%), template complexity (20%), and detected bottlenecks (20%)
3. WHEN the performance score changes by more than 5 points between consecutive scans within the same browser tab session, THE Popup_UI SHALL update the displayed score within 1 second of the new score being computed
4. THE Popup_UI SHALL display the performance score with a color indicator: green for scores 80-100, yellow for scores 50-79, and red for scores 0-49
5. WHEN the user hovers over the score, THE Popup_UI SHALL display a tooltip showing the four contributing factor names and their individual sub-scores (each 0-100) within 200 milliseconds
6. IF the Angular application is detected but the development API (window.ng) is unavailable, THEN THE Performance_Scorer SHALL display a score of 0 and indicate that full inspection requires development mode
7. IF no Angular components are found during a scan, THEN THE Performance_Scorer SHALL report a score of 0 and indicate that no components were available for analysis

### Requirement 3: Production Performance Heuristics

**User Story:** As an Angular developer, I want performance analysis that works on production builds, so that I can diagnose issues in deployed applications without requiring development mode.

#### Acceptance Criteria

1. WHILE `window.ng` is unavailable, THE Production_Analyzer SHALL use DOM structure analysis to infer component boundaries from Angular-specific attributes (`_ngcontent-*`, `_nghost-*`, `ng-reflect-*`) and report each inferred component boundary as a named entry (derived from the host element tag name) in the analysis results
2. WHILE `window.ng` is unavailable, THE Production_Analyzer SHALL estimate component tree depth by analyzing nested Angular host elements up to a maximum traversal depth of 512 levels
3. WHEN analyzing a production build, THE Production_Analyzer SHALL detect excessive DOM node counts (more than 1500 nodes in a single component subtree, where a component subtree is defined as all descendant DOM nodes up to the next inferred Angular host element boundary) as a performance concern
4. WHEN analyzing a production build, THE Production_Analyzer SHALL measure DOM mutation frequency using MutationObserver to identify components with excessive re-renders (more than 10 mutations per second sustained over 3 seconds) and SHALL disconnect the MutationObserver within 100 milliseconds after the analysis scan completes
5. IF the Production_Analyzer cannot determine a metric due to production obfuscation (absence of `_ngcontent-*`, `_nghost-*`, or `ng-reflect-*` attributes on any DOM element), THEN THE Production_Analyzer SHALL report the metric as "unavailable in production mode" with a suggestion to run in development mode
6. IF no Angular-specific attributes (`_ngcontent-*`, `_nghost-*`, `ng-reflect-*`, `ng-version`) are found on any DOM element and `window.ng` is unavailable, THEN THE Production_Analyzer SHALL report that no Angular application was detected within 5 seconds of initiating the scan

### Requirement 4: DOM and Render Bottleneck Detection

**User Story:** As an Angular developer, I want to detect DOM rendering bottlenecks, so that I can identify and fix components causing layout thrashing or excessive re-renders.

#### Acceptance Criteria

1. WHEN monitoring is active, THE DOM_Inspector SHALL detect layout thrashing by identifying 3 or more alternating DOM read and DOM write operations within the same synchronous execution frame, and report each detected sequence with the count of read-write alternations and the affected component name
2. WHEN a component subtree exceeds 800 DOM nodes, THE DOM_Inspector SHALL flag the component as having excessive DOM complexity, reporting the component name and the measured node count
3. WHEN monitoring is active, THE DOM_Inspector SHALL track forced reflow events by detecting access to layout-triggering properties (`offsetHeight`, `offsetWidth`, `getBoundingClientRect`, `clientHeight`, `scrollTop`) that occur after a DOM style mutation within the same synchronous execution frame, and report the triggering property name and the affected component name
4. WHEN a single change detection cycle causes more than 50 DOM mutations, THE DOM_Inspector SHALL report the cycle as a render bottleneck with the affected component names and the total mutation count
5. WHILE monitoring is active, THE DOM_Inspector SHALL measure time spent in rendering by using the Performance API (`performance.mark` and `performance.measure`) to track paint and layout durations, and SHALL flag any rendering phase that exceeds 16 milliseconds as a render bottleneck
6. IF the DOM_Inspector cannot attribute a detected bottleneck to a specific component, THEN THE DOM_Inspector SHALL report the bottleneck with the nearest identifiable parent component name or the host element tag name

### Requirement 5: Signals Migration Suggestions

**User Story:** As an Angular developer, I want to identify opportunities to migrate from RxJS/zone-based patterns to Angular Signals, so that I can modernize my application and improve performance.

#### Acceptance Criteria

1. WHEN `window.ng` is available, THE Signals_Advisor SHALL identify components using `BehaviorSubject` or `ReplaySubject` that are subscribed to only within the declaring component and suggest replacement with `signal()`
2. WHEN `window.ng` is available, THE Signals_Advisor SHALL identify `async` pipe usages in templates that could be replaced with Signal-based reactivity
3. WHEN a component uses `@Input()` decorators that do not have custom setter logic or `ngOnChanges` handlers dependent on them, THE Signals_Advisor SHALL suggest migration to `input()` signal-based inputs
4. WHEN a component uses `@Output()` with `EventEmitter` that emits values without additional RxJS operator chaining, THE Signals_Advisor SHALL suggest migration to `output()` function
5. THE Signals_Advisor SHALL categorize each suggestion by migration effort: low (direct 1-to-1 API replacement with no surrounding code changes), medium (requires modifying up to 3 dependent statements in the same component), or high (requires changes across multiple components or services)
6. WHEN displaying migration suggestions, THE Popup_UI SHALL show a before/after code snippet of no more than 10 lines each demonstrating the suggested Signal-based alternative for each identified pattern
7. IF `window.ng` is not available when performing signals analysis, THEN THE Signals_Advisor SHALL skip signals migration scanning and not display any suggestions for this category
8. THE Signals_Advisor SHALL display a maximum of 20 migration suggestions per scan, ordered by migration effort from low to high

### Requirement 6: RxJS Subscription Leak Detection

**User Story:** As an Angular developer, I want to detect RxJS subscription leaks, so that I can prevent memory leaks in my application.

#### Acceptance Criteria

1. WHEN `window.ng` is available, THE RxJS_Leak_Detector SHALL inspect each component instance's properties for objects that have a `closed` property equal to `false` (indicating an active RxJS Subscription) and that lack a corresponding cleanup pattern in the component
2. THE RxJS_Leak_Detector SHALL recognize the following as valid cleanup patterns: a call to `.unsubscribe()` in `ngOnDestroy`, a `takeUntil` operator chained before `.subscribe()`, a `takeUntilDestroyed` operator, or usage of the `async` pipe instead of manual subscription
3. WHEN a component is destroyed via the `ngOnDestroy` lifecycle hook, THE RxJS_Leak_Detector SHALL flag any subscription property on that component instance whose `closed` property remains `false` as a potential leak
4. WHEN a potential leak is detected, THE RxJS_Leak_Detector SHALL report an issue object containing the component class name, the property name holding the subscription, a severity of "high", and a recommendation string indicating one of: using `takeUntilDestroyed` with `DestroyRef`, adding `.unsubscribe()` in `ngOnDestroy`, or replacing with the `async` pipe
5. IF the RxJS_Leak_Detector scans all component instances and finds no subscription properties with `closed` equal to `false` that lack cleanup patterns, THEN THE RxJS_Leak_Detector SHALL report zero leak issues for the scan
6. IF `window.ng` is available but component constructor names are single characters or minified (fewer than 3 characters), THEN THE RxJS_Leak_Detector SHALL report that leak detection requires development mode for accurate component identification
7. THE RxJS_Leak_Detector SHALL scan a maximum of 1000 DOM elements per detection run and report at most 50 leak issues per scan

### Requirement 7: Enterprise Angular Optimization Recommendations

**User Story:** As an enterprise Angular team lead, I want optimization recommendations for large-scale applications, so that I can improve application performance at scale.

#### Acceptance Criteria

1. WHEN the component tree contains more than 200 components, THE Enterprise_Optimizer SHALL analyze the tree for lazy loading opportunities by identifying subtrees of 10 or more components that are loaded eagerly under a single route and recommend converting them to lazy-loaded feature modules
2. WHEN the Enterprise_Optimizer detects route configurations that load modules eagerly, THE Enterprise_Optimizer SHALL recommend `loadChildren` or `loadComponent` lazy loading patterns and display the specific route path and module name in the recommendation output
3. WHEN analyzing loaded scripts, THE Bundle_Analyzer SHALL estimate the total JavaScript bundle size by summing the transfer sizes of all script resources reported by the Performance API and flag bundles exceeding 500KB (initial load) as a performance concern
4. WHEN the Enterprise_Optimizer detects a module imported in more than 3 feature modules, THE Enterprise_Optimizer SHALL recommend extraction of that module into a shared lazy-loaded chunk and identify the module by name in the recommendation output
5. WHEN the application uses NgRx, NGXS, or Akita state management, THE Enterprise_Optimizer SHALL check for selectors that lack memoization metadata and recommend memoized selectors, reporting the selector name and parent store
6. WHEN the Enterprise_Optimizer detects components using `*ngFor` or `@for` directives without a `trackBy` function or `track` expression, THE Enterprise_Optimizer SHALL recommend adding a tracking expression and identify the component name and template location in the recommendation output
7. IF the Enterprise_Optimizer cannot access Angular debug APIs due to production mode or missing debug symbols, THEN THE Enterprise_Optimizer SHALL display a notification indicating that enterprise analysis requires development mode and list which checks were skipped

### Requirement 8: Component State Viewer

**User Story:** As an Angular developer, I want to inspect component and service state at runtime, so that I can debug state-related issues without adding console.log statements.

#### Acceptance Criteria

1. IF `window.ng` is available, WHEN the user selects a component in the Popup_UI, THEN THE State_Viewer SHALL display all enumerable own-properties and their current values for that component instance, excluding properties prefixed with an underscore
2. WHILE a component is selected in the State_Viewer, THE State_Viewer SHALL poll the component instance for property changes every 1000 milliseconds and highlight any changed property with a visual indicator for 2 seconds
3. IF `window.ng` is available and a global NgRx store is detected via `window.ng.getInjector` resolving a Store instance, THEN THE State_Viewer SHALL display the current store state tree with expandable/collapsible nodes up to a maximum depth of 5 levels
4. THE State_Viewer SHALL serialize component state values to JSON for display, truncating string representations longer than 500 characters with an expand option to reveal the full value
5. IF a component property contains a circular reference, THEN THE State_Viewer SHALL display "[Circular Reference]" instead of attempting full serialization
6. IF `window.ng` is not available when the user selects a component, THEN THE State_Viewer SHALL display a message indicating that Angular development mode is required for state inspection
7. IF the selected component instance is destroyed or no longer present in the DOM, THEN THE State_Viewer SHALL clear the displayed state and display a message indicating the component is no longer available

### Requirement 9: Change Detection Profiler

**User Story:** As an Angular developer, I want to profile change detection cycles, so that I can identify which components are checked most frequently and optimize accordingly.

#### Acceptance Criteria

1. WHEN the user activates profiling in the Popup_UI, THE Change_Detection_Profiler SHALL begin recording change detection cycles, and WHEN the user deactivates profiling or 5000 cycles have been recorded, THE Change_Detection_Profiler SHALL stop recording and retain the collected data for display
2. WHEN profiling is active, THE Change_Detection_Profiler SHALL record each change detection cycle with a timestamp, duration in milliseconds, and the number of components checked
3. WHEN profiling is active, THE Change_Detection_Profiler SHALL identify the root trigger of each change detection cycle (user event, timer, HTTP response, or programmatic)
4. WHEN the user views profiling results, THE Change_Detection_Profiler SHALL display a timeline visualization of change detection cycles showing cycle duration on the vertical axis and time elapsed on the horizontal axis over the profiling period
5. WHEN a single change detection cycle exceeds 16 milliseconds, THE Change_Detection_Profiler SHALL visually distinguish the cycle in the timeline and label it as exceeding the frame budget
6. WHEN the user views profiling results, THE Change_Detection_Profiler SHALL rank the top 20 components by total time spent in change detection across all recorded cycles
7. IF `window.ng` is unavailable when the user attempts to start profiling, THEN THE Change_Detection_Profiler SHALL display a message indicating that change detection profiling requires development mode and not begin recording

### Requirement 10: Zone.js Event Profiler

**User Story:** As an Angular developer, I want to profile Zone.js events, so that I can identify which async operations trigger unnecessary change detection.

#### Acceptance Criteria

1. WHEN profiling is active, THE Zone_Profiler SHALL intercept and record all Zone.js task invocations categorized by type: macroTask, microTask, and eventTask, capturing for each task the source, type, timestamp, and whether it triggered change detection
2. WHEN profiling is active, THE Zone_Profiler SHALL record the source of each zone task (setTimeout, setInterval, addEventListener, Promise, HTTP request)
3. WHEN profiling is active and a zone task triggers change detection without resulting in any DOM updates, THE Zone_Profiler SHALL flag that task as an unnecessary trigger in the profiling results
4. WHEN a `setInterval` or `setTimeout` triggers change detection more than 5 times per second, THE Zone_Profiler SHALL recommend moving the operation outside NgZone using `NgZone.runOutsideAngular()`
5. WHEN the profiling period ends, THE Zone_Profiler SHALL display a summary showing each source type, its total invocation count, the number of unnecessary change detection triggers, and the average invocations per second over the profiling period
6. IF profiling has been active for more than 300 seconds, THEN THE Zone_Profiler SHALL automatically stop profiling and display the accumulated results

### Requirement 11: Component Render Time Profiler

**User Story:** As an Angular developer, I want to measure individual component render times, so that I can identify slow-rendering components.

#### Acceptance Criteria

1. WHILE profiling is active, THE Component_Profiler SHALL measure the time each component spends in its template rendering phase per change detection cycle with millisecond precision
2. WHEN displaying profiling results, THE Component_Profiler SHALL rank components by average render time computed across all recorded change detection cycles and display the top 10 slowest components
3. WHEN a component render time exceeds 8 milliseconds in a single change detection cycle, THE Component_Profiler SHALL flag the component as a render bottleneck
4. WHILE profiling is active, THE Component_Profiler SHALL track the render count per component and flag any component that renders more than 50 times within a 10-second window as rendering excessively
5. WHEN displaying profiling results, THE Popup_UI SHALL show a flame chart visualization of component render times within each change detection cycle
6. IF no components are detected during the profiling period, THEN THE Component_Profiler SHALL display a message indicating that no Angular components were found for profiling

### Requirement 12: Bundle Impact Analysis

**User Story:** As an Angular developer, I want to understand the bundle size impact of loaded modules, so that I can prioritize optimization efforts.

#### Acceptance Criteria

1. THE Bundle_Analyzer SHALL enumerate all JavaScript resources loaded by the page using the Performance Resource Timing API, filtering to entries whose `initiatorType` is "script"
2. THE Bundle_Analyzer SHALL calculate the compressed (transfer) size and decompressed size of each JavaScript resource using the `transferSize` and `decodedBodySize` properties from the Resource Timing API
3. IF a JavaScript resource reports a `transferSize` of 0 due to cross-origin restrictions, THEN THE Bundle_Analyzer SHALL display the resource with an "unavailable" size indicator and exclude it from size-based calculations
4. WHEN a single JavaScript resource exceeds 250KB (decompressed), THE Bundle_Analyzer SHALL flag the resource as oversized with a visual warning indicator
5. THE Bundle_Analyzer SHALL group JavaScript resources by module origin using the following filename pattern matching: resources containing "vendor" or "node_modules" as vendor, resources containing "polyfill" as polyfills, resources containing "main" as main, and all other resources as lazy chunks
6. THE Popup_UI SHALL display a bar chart visualization of bundle sizes grouped by category, showing the category name, total size in KB for that category, and the count of resources in each category
7. IF no JavaScript resources are detected on the page, THEN THE Popup_UI SHALL display a message indicating that no JavaScript bundles were found

### Requirement 13: Network Waterfall Correlation

**User Story:** As an Angular developer, I want to correlate network requests with Angular rendering performance, so that I can identify how API latency affects user experience.

#### Acceptance Criteria

1. THE Network_Correlator SHALL capture all XHR and Fetch requests initiated by the Angular application using the Performance Resource Timing API and PerformanceObserver, recording for each request the URL, HTTP method, start time, response end time, and response status code
2. WHEN an HTTP response is received and a change detection cycle begins within 200 milliseconds of that response, THE Network_Correlator SHALL link the network request to the resulting render cycle, recording the response end timestamp, the change detection start timestamp, and the DOM update completion timestamp
3. IF a captured network request does not trigger a change detection cycle within 200 milliseconds of response receipt, THEN THE Network_Correlator SHALL record the request as uncorrelated
4. THE Network_Correlator SHALL calculate the time in milliseconds between HTTP response receipt (Performance Resource Timing responseEnd) and the completion of the resulting DOM update (final MutationObserver callback after change detection settles within a 50-millisecond idle window)
5. WHEN the time between HTTP response and DOM update completion exceeds 100 milliseconds, THE Network_Correlator SHALL flag the correlation as a slow render response with a visual indicator distinguishing it from normal-speed correlations in the waterfall timeline
6. THE Popup_UI SHALL display a waterfall timeline showing up to 50 most recent network requests aligned with their correlated change detection cycles and DOM updates, with each entry displaying the request URL, total request duration, and response-to-render time

### Requirement 14: Extension Communication Architecture

**User Story:** As an Angular developer, I want the extension to reliably communicate between its components, so that analysis data flows correctly from the page context to the UI.

#### Acceptance Criteria

1. THE Content_Script SHALL relay messages between the Page_Script and the Background_Worker using CustomEvent dispatching for page-to-content communication and `chrome.runtime.sendMessage` for content-to-background communication
2. WHEN the Page_Script sends analysis results, THE Content_Script SHALL forward the results to the Popup_UI within 500 milliseconds of receiving the CustomEvent
3. IF the Page_Script fails to respond within 5 seconds of a scan request, THEN THE Content_Script SHALL report a timeout error to the Popup_UI with a message indicating the scan timed out and suggesting the user refresh the page
4. IF the Content_Script fails to inject the Page_Script into the page context, THEN THE Extension SHALL display an error in the Popup_UI indicating that page access is restricted and analysis is unavailable
5. THE Background_Worker SHALL persist the last analysis results per tab using session-scoped storage, and WHEN the user reopens the Popup_UI on the same tab without navigating away, THE Background_Worker SHALL restore the stored analysis results within 200 milliseconds
6. WHEN the user navigates to a new URL within the same tab, THE Extension SHALL clear the stored analysis results for that tab and automatically re-inject the Page_Script to detect the Angular application upon page load completion

### Requirement 15: Popup UI Dashboard

**User Story:** As an Angular developer, I want a clear and organized dashboard in the extension popup, so that I can navigate between different analysis tools efficiently.

#### Acceptance Criteria

1. THE Popup_UI SHALL organize analysis tools into four tabbed sections labeled "Overview", "Profilers", "State", and "Recommendations", with the "Overview" tab selected by default when the popup is opened
2. WHILE an active session is established (the inspected tab contains a detected Angular application and the extension popup is open), THE Popup_UI SHALL display the overall performance score as a numeric value from 0 to 100 and the detected Angular major and minor version on the Overview tab
3. WHEN the user switches between tabs, THE Popup_UI SHALL preserve the content and scroll position of each previously visited tab for the duration the popup remains open, so that results are not lost
4. WHEN analysis data is received from the Content_Script, THE Popup_UI SHALL render up to 200 analysis result items within 200 milliseconds
5. THE Popup_UI SHALL support a dark mode and a light mode, defaulting to the operating system's reported color scheme preference at the time the popup is opened
6. IF the inspected tab does not contain a detected Angular application, THEN THE Popup_UI SHALL display an inactive state indicating that no Angular application was found on the current page

### Requirement 16: Prioritized Action Items

**User Story:** As an Angular developer, I want a prioritized to-do list of performance fixes ranked by impact, so that I can address the most impactful issues first without manually triaging raw analysis data.

#### Acceptance Criteria

1. WHEN a scan completes, THE Action_List SHALL generate a ranked list of actionable fixes ordered by estimated performance impact from highest to lowest
2. THE Action_List SHALL include for each action item: the issue description, the affected component name, the estimated performance gain category (high, medium, or low), and a severity level (critical, warning, or info)
3. WHEN the user clicks a "show me" button on an action item, THE Extension SHALL navigate the user to the source of the issue by highlighting the relevant component in the analysis results and scrolling the Popup_UI to the corresponding detail section
4. WHEN the user applies a severity filter, THE Action_List SHALL display only action items matching the selected severity levels within 100 milliseconds of filter selection
5. WHEN the user applies a category filter (change detection, DOM complexity, memory leaks, bundle size, signals migration), THE Action_List SHALL display only action items belonging to the selected categories
6. THE Action_List SHALL display a maximum of 50 action items per scan, with items beyond the limit accessible via a "show more" control
7. IF a scan completes with no detected issues, THEN THE Action_List SHALL display a success message indicating that no performance issues were found and the application is performing well
8. WHEN the user completes a fix and re-runs a scan, THE Action_List SHALL indicate which previously reported issues are now resolved by comparing the current scan results against the prior scan results stored in session-scoped storage

### Requirement 17: Element Highlighting Overlay

**User Story:** As an Angular developer, I want to see flagged components highlighted directly on the page, so that I can visually identify which DOM elements correspond to performance issues without manually searching the page.

#### Acceptance Criteria

1. WHEN the user clicks on a flagged component in the analysis results, THE Element_Overlay SHALL display a colored overlay on the corresponding DOM element in the inspected page within 200 milliseconds of the click
2. THE Element_Overlay SHALL display the overlay with a semi-transparent background color indicating severity: red for critical issues, orange for warnings, and blue for informational issues
3. THE Element_Overlay SHALL display a tooltip label on the overlay containing the component name and the issue type description in a text box positioned above the highlighted element
4. WHEN the user clicks anywhere outside the highlighted element or presses the Escape key, THE Element_Overlay SHALL remove the overlay from the page within 100 milliseconds
5. IF the overlay has been visible for more than 5 seconds without user interaction, THEN THE Element_Overlay SHALL automatically fade out and remove the overlay over a 500-millisecond transition
6. IF the target DOM element is not visible in the viewport, THEN THE Element_Overlay SHALL scroll the page to bring the element into view before displaying the overlay
7. IF the target DOM element has been removed from the DOM since the scan was performed, THEN THE Element_Overlay SHALL display a notification in the Popup_UI indicating that the element is no longer present on the page
8. THE Element_Overlay SHALL not interfere with the page layout by using fixed or absolute positioning with a z-index of 2147483647 to ensure the overlay appears above all page content

### Requirement 18: Export and Share Reports

**User Story:** As an Angular developer, I want to export scan results in multiple formats, so that I can share performance findings with my team via pull requests, Slack, or issue trackers.

#### Acceptance Criteria

1. WHEN the user selects "Export as JSON", THE Report_Exporter SHALL generate a JSON file containing the performance score, all detected issues with their severity and component names, and all recommendations, and trigger a browser download of the file named `angular-perf-report-{timestamp}.json`
2. WHEN the user selects "Export as Markdown", THE Report_Exporter SHALL generate a Markdown-formatted report containing a summary section with the performance score and issue counts by severity, a detailed issues section with component names and recommendations, and trigger a browser download of the file named `angular-perf-report-{timestamp}.md`
3. WHEN the user selects "Copy Summary to Clipboard", THE Report_Exporter SHALL copy a plain-text summary to the system clipboard containing the performance score, the total number of issues grouped by severity, and the top 5 highest-impact recommendations, and display a confirmation message in the Popup_UI within 500 milliseconds
4. THE Report_Exporter SHALL include in all export formats: the scan timestamp in ISO 8601 format, the Angular version detected, the page URL, and the total number of components analyzed
5. IF no scan results are available when the user attempts to export, THEN THE Report_Exporter SHALL display a message indicating that a scan must be completed before exporting results
6. THE Report_Exporter SHALL sanitize the exported data by excluding any raw DOM references, function objects, or circular structures, ensuring the output contains only serializable primitive values, arrays, and plain objects

### Requirement 19: DevTools Panel Integration

**User Story:** As an Angular developer, I want a persistent Chrome DevTools panel for the performance inspector, so that I can use the full analysis dashboard without the popup closing when I interact with the page.

#### Acceptance Criteria

1. THE Extension SHALL register a Chrome DevTools panel titled "Angular Perf" that appears as a tab alongside the Elements, Console, and Network panels when Chrome DevTools is open
2. WHEN the DevTools_Panel is opened, THE DevTools_Panel SHALL display the full dashboard interface including all four tabbed sections (Overview, Profilers, State, and Recommendations) with the same functionality available in the Popup_UI
3. WHILE the DevTools_Panel is open, THE DevTools_Panel SHALL remain visible and retain its state regardless of user interactions with the inspected page, including page clicks, scrolling, and navigation within a single-page application
4. WHEN the user navigates to a new page in the inspected tab while the DevTools_Panel is open, THE DevTools_Panel SHALL clear the previous results and automatically initiate Angular detection on the new page within 2 seconds of navigation completion
5. WHEN the user clicks "Open in DevTools" in the Popup_UI, THE Extension SHALL open Chrome DevTools with the Angular Perf panel selected, or display a message indicating that DevTools must be opened manually if programmatic opening is not supported
6. THE Popup_UI SHALL continue to function as a quick-glance summary displaying the performance score, issue count by severity, and a link to open the DevTools_Panel for full analysis
7. WHILE both the Popup_UI and DevTools_Panel are open simultaneously, THE Extension SHALL synchronize scan results between them so that a scan initiated from either interface updates both within 500 milliseconds
8. IF Chrome DevTools is not open when the user clicks "Open in DevTools", THEN THE Popup_UI SHALL display an instructional message explaining how to open Chrome DevTools (F12 or Ctrl+Shift+I) and locate the Angular Perf panel

### Requirement 20: Contextual Help and Documentation Links

**User Story:** As an Angular developer, I want inline contextual help for each detected issue, so that I can understand why an issue matters and how to fix it without prior performance optimization knowledge.

#### Acceptance Criteria

1. THE Extension SHALL display for each detected issue a "Why it matters" section containing a plain-language explanation of the performance impact in 1 to 3 sentences, written at a level understandable by a developer with 6 months of Angular experience
2. THE Extension SHALL display for each detected issue a "How to fix" section containing step-by-step remediation instructions with a maximum of 5 steps per issue
3. WHEN the user expands a "Learn More" section on an issue, THE Extension SHALL display a detailed explanation including a code example of the fix (maximum 15 lines), the expected performance improvement category (latency reduction, memory reduction, or render efficiency), and a hyperlink to the relevant official Angular documentation page on angular.dev
4. THE Extension SHALL provide contextual help content for each issue category: change detection strategy, DOM complexity, RxJS subscription leaks, bundle size, signals migration, zone.js triggers, and network correlation
5. WHEN a documentation link is clicked, THE Extension SHALL open the linked Angular documentation page in a new browser tab
6. IF the Extension cannot determine the Angular version for version-specific documentation links, THEN THE Extension SHALL link to the latest stable Angular documentation and display a note indicating that the linked documentation corresponds to the latest Angular version
7. THE Extension SHALL store all contextual help content locally within the extension bundle, requiring no network requests to display help text and code examples

### Requirement 21: Change Detection Efficiency Score

**User Story:** As an Angular developer, I want to see the efficiency ratio of change detection per component (useful renders vs wasted renders), so that I can instantly identify components that execute CD cycles without producing DOM updates.

#### Acceptance Criteria

1. WHILE profiling is active, THE CD_Efficiency_Scorer SHALL track for each component the total number of change detection executions and the number of executions that resulted in at least one DOM mutation
2. THE CD_Efficiency_Scorer SHALL compute an efficiency percentage per component as (executions with DOM updates / total executions) × 100, rounded to one decimal place
3. WHEN a component's CD efficiency is below 20%, THE CD_Efficiency_Scorer SHALL flag the component as having excessive wasted renders with severity "high"
4. THE Popup_UI SHALL display the CD efficiency for each profiled component showing: component name, total CD executions, actual DOM updates, and efficiency percentage
5. WHEN displaying profiling results, THE CD_Efficiency_Scorer SHALL rank components by wasted render count (total executions minus useful executions) in descending order

### Requirement 22: Component Stability Score

**User Story:** As an Angular developer, I want a stability score per component that combines rerender frequency, mutation frequency, input churn, and DOM thrashing into a single metric, so that I can identify unstable components that degrade user experience.

#### Acceptance Criteria

1. WHILE monitoring is active, THE Stability_Scorer SHALL compute a stability score from 0 to 100 for each component based on four factors: rerender frequency (weight 30%), DOM mutation frequency (weight 30%), input property change frequency (weight 20%), and layout thrashing incidents (weight 20%)
2. WHEN a component's stability score falls below 50, THE Stability_Scorer SHALL flag the component as unstable with the contributing factors listed in order of impact
3. THE Stability_Scorer SHALL measure rerender frequency as the number of template re-evaluations per second averaged over the monitoring period
4. THE Stability_Scorer SHALL measure input churn as the number of @Input property changes per second that trigger re-renders
5. THE Popup_UI SHALL display stability scores with a visual indicator: green for 80-100, yellow for 50-79, red for 0-49

### Requirement 23: User Interaction Latency

**User Story:** As an Angular developer, I want to measure end-to-end latency from user interaction to render completion, so that I can understand how the app feels to users rather than just internal CD metrics.

#### Acceptance Criteria

1. WHILE monitoring is active, THE Interaction_Latency_Tracker SHALL capture each user interaction (click, keypress, input) and measure the total time from the event timestamp to the completion of the resulting DOM update
2. THE Interaction_Latency_Tracker SHALL break down each interaction latency into phases: event handling time, Angular change detection time, and DOM render time
3. WHEN an interaction's total latency exceeds 100 milliseconds, THE Interaction_Latency_Tracker SHALL flag it as perceptibly slow
4. WHEN an interaction's total latency exceeds 300 milliseconds, THE Interaction_Latency_Tracker SHALL flag it as critically slow with severity "high"
5. THE Popup_UI SHALL display a list of captured interactions showing: interaction type, target element, total latency, and phase breakdown
6. THE Interaction_Latency_Tracker SHALL calculate average interaction latency across all captured interactions during the monitoring period

### Requirement 24: Frame Drop and FPS Monitor

**User Story:** As an Angular developer, I want to monitor frame rate and dropped frames during interactions, so that I can identify when the app causes visual jank.

#### Acceptance Criteria

1. WHILE monitoring is active, THE FPS_Monitor SHALL measure the current frame rate using requestAnimationFrame and report the average FPS over 1-second intervals
2. THE FPS_Monitor SHALL detect dropped frames by identifying gaps between consecutive requestAnimationFrame callbacks that exceed 20 milliseconds (indicating a missed 60fps frame)
3. WHEN the FPS drops below 30 during a user interaction, THE FPS_Monitor SHALL flag the interaction as causing significant jank with severity "high"
4. WHEN the FPS drops below 50 during a user interaction, THE FPS_Monitor SHALL flag the interaction as causing minor jank with severity "medium"
5. THE Popup_UI SHALL display a real-time FPS graph showing frame rate over time with dropped frames highlighted in red
6. THE FPS_Monitor SHALL correlate frame drops with concurrent change detection cycles to identify which CD cycles cause visual jank

### Requirement 25: Route-Level Time-to-Interactive

**User Story:** As an Angular developer, I want to measure Time-to-Interactive per route, so that I can identify which routes are slow and what contributes to their load time.

#### Acceptance Criteria

1. WHEN a route navigation occurs, THE Route_TTI_Tracker SHALL measure the total time from navigation start to the route becoming interactive (all components rendered and no pending async operations blocking interaction)
2. THE Route_TTI_Tracker SHALL break down route TTI into phases: route resolution time, lazy chunk load time (if applicable), component initialization time, and initial render time
3. WHEN a route's TTI exceeds 3 seconds, THE Route_TTI_Tracker SHALL flag the route as slow with severity "high"
4. WHEN a route's TTI exceeds 1.5 seconds, THE Route_TTI_Tracker SHALL flag the route as moderately slow with severity "medium"
5. THE Popup_UI SHALL display a route performance table showing: route path, TTI duration, phase breakdown, and the largest contributing factor
6. THE Route_TTI_Tracker SHALL detect lazy-loaded chunks by monitoring script resource loads that occur during route navigation and attribute their load time to the route

### Requirement 26: Baseline and Regression Detection

**User Story:** As an Angular team lead, I want to store performance baselines and detect regressions across development sessions, so that I can catch performance degradation before it reaches production.

#### Acceptance Criteria

1. WHEN the user clicks "Save Baseline", THE Baseline_Regression_Detector SHALL store the current scan results (performance score, all sub-scores, issue counts by category, route TTIs, and interaction latencies) in chrome.storage.local keyed by page URL and a user-provided label
2. WHEN a scan completes and a baseline exists for the current page URL, THE Baseline_Regression_Detector SHALL compare the current results against the baseline and flag any metric that has degraded by more than 10% as a regression
3. THE Popup_UI SHALL display regression indicators next to any metric that has degraded compared to the baseline, showing the baseline value, current value, and percentage change
4. WHEN the overall performance score drops by more than 15 points compared to the baseline, THE Baseline_Regression_Detector SHALL display a prominent regression warning with severity "critical"
5. THE Baseline_Regression_Detector SHALL support storing up to 10 baselines per page URL, each identified by a user-provided label and timestamp
6. WHEN the user selects "Export Baseline", THE Baseline_Regression_Detector SHALL export the baseline data as a JSON file that can be shared with team members and imported on other machines

### Requirement 27: Memory Growth Trend

**User Story:** As an Angular developer, I want to track memory growth over time, so that I can detect memory accumulation patterns in long-lived applications like dashboards.

#### Acceptance Criteria

1. WHILE monitoring is active, THE Memory_Trend_Monitor SHALL sample the JavaScript heap size using performance.memory (where available) every 5 seconds and record the usedJSHeapSize value
2. WHEN the heap size grows by more than 50% from the initial measurement over a 60-second window without a corresponding decrease, THE Memory_Trend_Monitor SHALL flag a potential memory leak with severity "high"
3. THE Popup_UI SHALL display a line chart showing heap memory usage over time with the initial baseline marked
4. THE Memory_Trend_Monitor SHALL correlate memory growth periods with component creation/destruction events to identify components that may be retaining references
5. IF performance.memory is not available (non-Chromium browsers), THEN THE Memory_Trend_Monitor SHALL display a message indicating that memory monitoring requires a Chromium-based browser

### Requirement 28: Interaction Heatmap

**User Story:** As an Angular developer, I want a visual heatmap overlay showing which page regions rerender most frequently, so that I can visually identify hot zones that need optimization.

#### Acceptance Criteria

1. WHILE monitoring is active, THE Interaction_Heatmap SHALL track DOM mutation frequency per component region using MutationObserver
2. WHEN the user activates the heatmap view, THE Interaction_Heatmap SHALL overlay a color-coded visualization on the page where red indicates high rerender frequency (more than 10 mutations/sec), yellow indicates moderate (3-10 mutations/sec), and green indicates stable (fewer than 3 mutations/sec)
3. THE Interaction_Heatmap SHALL update the overlay colors every 2 seconds to reflect current activity
4. WHEN the user deactivates the heatmap view, THE Interaction_Heatmap SHALL remove all overlay elements from the page within 100 milliseconds
5. THE Interaction_Heatmap SHALL not interfere with page interactivity by using pointer-events: none on all overlay elements

### Requirement 29: Signals Adoption Score

**User Story:** As an Angular developer, I want to see what percentage of my application uses Angular Signals vs traditional patterns, so that I can track migration progress and prioritize modernization efforts.

#### Acceptance Criteria

1. WHEN `window.ng` is available, THE Signals_Adoption_Scorer SHALL calculate the signals adoption percentage as (components using signal-based patterns / total components analyzed) × 100
2. THE Signals_Adoption_Scorer SHALL classify a component as "signal-based" if it uses signal() inputs, computed() properties, or effect() instead of traditional @Input/@Output/BehaviorSubject patterns
3. THE Signals_Adoption_Scorer SHALL classify a component as "traditional" if it uses @Input() decorators, @Output() with EventEmitter, or BehaviorSubject/ReplaySubject for local state
4. THE Popup_UI SHALL display the adoption score as a percentage with a progress bar and a breakdown showing signal-based component count vs traditional component count
5. IF `window.ng` is not available, THEN THE Signals_Adoption_Scorer SHALL display a message indicating that signals adoption analysis requires development mode

### Requirement 30: Template Complexity Score

**User Story:** As an Angular developer, I want a complexity score per component template that goes beyond simple binding counts, so that I can identify templates that are too complex and should be refactored.

#### Acceptance Criteria

1. WHEN `window.ng` is available, THE Template_Complexity_Scorer SHALL compute a complexity score from 0 to 100 for each component template based on: structural directive count (weight 25%), pipe usage count (weight 20%), method call bindings (weight 25%), total property bindings (weight 15%), and nested conditional depth (weight 15%)
2. WHEN a component's template complexity score exceeds 70, THE Template_Complexity_Scorer SHALL flag the component as having high template complexity with a recommendation to split into smaller components
3. THE Template_Complexity_Scorer SHALL specifically flag method calls in templates as a performance concern since they execute on every change detection cycle
4. THE Popup_UI SHALL display template complexity scores with a breakdown of contributing factors for each flagged component
5. IF `window.ng` is not available, THEN THE Template_Complexity_Scorer SHALL display a message indicating that template analysis requires development mode

### Requirement 31: Perceived Performance Score

**User Story:** As an Angular developer, I want a user-experience-level performance score that tells me how the app FEELS to users, so that I can bridge the gap between engineering metrics and actual user experience.

#### Acceptance Criteria

1. THE Perceived_Performance_Scorer SHALL compute a perceived performance score from 0 to 100 based on three user-facing factors: average interaction latency (weight 40%), frame drop frequency (weight 35%), and layout stability measured via Cumulative Layout Shift (weight 25%)
2. THE Perceived_Performance_Scorer SHALL map interaction latency to a sub-score where: under 50ms = 100, 50-100ms = 80, 100-200ms = 60, 200-300ms = 40, over 300ms = 20
3. THE Perceived_Performance_Scorer SHALL map frame drop frequency to a sub-score where: 0 drops/sec = 100, 1-2 drops/sec = 75, 3-5 drops/sec = 50, over 5 drops/sec = 25
4. THE Popup_UI SHALL display the perceived performance score prominently on the Overview tab alongside the technical performance score, with a label distinguishing "How it feels" from "How it performs"
5. WHEN the perceived performance score differs from the technical score by more than 20 points, THE Popup_UI SHALL highlight the discrepancy and explain which user-facing factor is causing the gap

### Requirement 32: Angular Architecture Smell Detection

**User Story:** As an Angular architect, I want to detect architectural anti-patterns in the application, so that I can identify structural issues that cause systemic performance problems beyond individual component optimization.

#### Acceptance Criteria

1. WHEN `window.ng` is available, THE Architecture_Smell_Detector SHALL identify "God Components" — components with more than 20 public properties or more than 10 injected dependencies — and recommend decomposition
2. THE Architecture_Smell_Detector SHALL detect prop drilling by identifying components that pass more than 3 @Input properties unchanged to child components and recommend using a shared service or state management
3. THE Architecture_Smell_Detector SHALL detect zone-heavy architecture by identifying components that trigger more than 5 change detection cycles per second from timer-based or interval-based operations and recommend NgZone.runOutsideAngular()
4. THE Architecture_Smell_Detector SHALL detect excessive global state by identifying applications where more than 70% of components inject the same service and recommend modular state boundaries
5. THE Popup_UI SHALL display architecture smells in a dedicated section with severity, affected components, and refactoring recommendations
6. IF `window.ng` is not available, THEN THE Architecture_Smell_Detector SHALL display a message indicating that architecture analysis requires development mode

### Requirement 33: Learning Mode (Beginner vs Advanced)

**User Story:** As a junior Angular developer, I want a beginner-friendly mode that explains issues in simple terms with copy-paste fix examples, so that I can learn Angular performance optimization while fixing real problems in my app.

#### Acceptance Criteria

1. THE Popup_UI SHALL provide a "Learning Mode" toggle that switches between "Beginner" and "Advanced" presentation modes, defaulting to "Beginner" on first install
2. WHILE Learning_Mode is set to "Beginner", THE Extension SHALL display each detected issue with: a plain-language title (no jargon), a "What is this?" explanation in 1-2 sentences, a "Why it's bad" explanation relating to user-visible impact, and a "Copy-paste fix" code snippet that can be directly applied
3. WHILE Learning_Mode is set to "Beginner", THE Extension SHALL hide raw profiler timelines, zone task tables, and numeric cycle counts, instead showing simplified summaries (e.g., "This component rerenders too often") rather than raw metrics (e.g., "142 CD executions with 5.6% efficiency")
4. WHILE Learning_Mode is set to "Advanced", THE Extension SHALL display the full profiler data, raw metrics, timelines, flame charts, and technical details without simplification
5. THE Extension SHALL remember the user's mode preference in chrome.storage.local and restore it on subsequent sessions
6. WHILE Learning_Mode is set to "Beginner", THE Extension SHALL display a "Severity + Difficulty" badge on each issue showing both how critical the issue is (high/medium/low) and how easy it is to fix (easy/moderate/hard), so junior developers can prioritize quick wins

### Requirement 34: "Why Did This Render?" Explanation

**User Story:** As a junior Angular developer, I want to understand exactly why a component re-rendered, so that I can learn Angular's rendering model and prevent unnecessary renders.

#### Acceptance Criteria

1. WHEN `window.ng` is available and the user selects a component, THE Render_Reason_Tracker SHALL display the reason(s) for the component's most recent re-render, categorized as: @Input property changed, parent component re-rendered, observable/subscription emitted a new value, timer/interval triggered change detection, user event triggered change detection, or programmatic markForCheck/detectChanges call
2. WHILE profiling is active, THE Render_Reason_Tracker SHALL record the render reason for each component on every change detection cycle and display a history of the last 20 render reasons for the selected component
3. WHEN a component re-renders due to a parent re-render without any of its own inputs changing, THE Render_Reason_Tracker SHALL flag this as a "cascading render" and recommend OnPush change detection strategy
4. WHEN a component re-renders more than 5 times in 1 second, THE Render_Reason_Tracker SHALL display a warning with the breakdown of render triggers and suggest specific fixes based on the dominant trigger type
5. THE Render_Reason_Tracker SHALL display render reasons in plain language (e.g., "This component re-rendered because its parent `DashboardComponent` re-rendered, even though none of its inputs changed") rather than technical identifiers
6. IF `window.ng` is not available, THEN THE Render_Reason_Tracker SHALL display a message indicating that render reason tracking requires development mode

### Requirement 35: Fix Difficulty and Expected Gain Assessment

**User Story:** As a junior Angular developer, I want to know how hard each fix is and what improvement to expect, so that I can start with easy high-impact fixes and build confidence before tackling harder optimizations.

#### Acceptance Criteria

1. THE Fix_Difficulty_Assessor SHALL assign a difficulty level to each recommended fix: "Easy" (single-line change or decorator addition, no architectural impact), "Moderate" (requires modifying 2-5 lines or understanding a new concept), or "Hard" (requires architectural refactoring or changes across multiple files)
2. THE Fix_Difficulty_Assessor SHALL assign an expected gain category to each fix: "Large" (likely to improve performance score by 10+ points or reduce render time by 50%+), "Medium" (likely to improve score by 5-10 points or reduce render time by 20-50%), or "Small" (likely to improve score by 1-5 points or reduce render time by under 20%)
3. THE Popup_UI SHALL display difficulty and expected gain as visual badges alongside each action item, using color coding: green for Easy, yellow for Moderate, red for Hard
4. WHEN the user filters action items, THE Action_List SHALL support filtering by difficulty level in addition to severity and category, allowing users to show only "Easy" fixes
5. THE Popup_UI SHALL provide a "Quick Wins" view that automatically filters to show only issues with difficulty "Easy" and expected gain "Large" or "Medium", sorted by expected gain descending

### Requirement 36: Before/After Improvement Tracking

**User Story:** As a junior Angular developer, I want to see the measurable impact of my fix after rescanning, so that I can confirm my optimization worked and build understanding of what each fix achieves.

#### Acceptance Criteria

1. WHEN a rescan completes on the same page URL within the same browser session, THE Improvement_Tracker SHALL compare the current results against the previous scan and display a summary of improvements and regressions
2. THE Improvement_Tracker SHALL display for each improved metric: the metric name, the previous value, the current value, and the percentage improvement (e.g., "Performance Score: 62 → 81 (+30.6%)")
3. WHEN the overall performance score improves by 5 or more points after a rescan, THE Popup_UI SHALL display a positive reinforcement message (e.g., "Nice work! Your optimizations improved the score by 19 points")
4. WHEN a previously flagged issue is no longer detected in the rescan, THE Improvement_Tracker SHALL mark it as "Fixed" with a checkmark and display which metric improved as a result
5. THE Popup_UI SHALL display a "Changes Since Last Scan" section at the top of the results showing: number of issues fixed, number of new issues introduced, and net score change
6. IF no previous scan exists for comparison, THEN THE Improvement_Tracker SHALL display a message indicating that improvement tracking will be available after the next rescan

### Requirement 37: Angular Best Practices and Anti-Pattern Education

**User Story:** As a junior Angular developer, I want the extension to actively teach me Angular best practices by detecting common anti-patterns in my code and explaining the correct approach, so that I can develop good habits from the start.

#### Acceptance Criteria

1. THE Extension SHALL detect and flag the following common junior developer anti-patterns: functions called directly in templates, nested subscribe() calls inside subscribe() callbacks, manual DOM manipulation via ElementRef.nativeElement in components, large components with more than 300 lines of template, and HTTP calls made directly in components instead of services
2. WHEN an anti-pattern is detected, THE Extension SHALL display: the anti-pattern name, a "Why this is a problem" explanation in 1-2 sentences, a "Better approach" section with a code example showing the correct pattern, and a link to the relevant Angular style guide or documentation page
3. THE Extension SHALL categorize anti-patterns by learning topic: "Change Detection", "Component Design", "State Management", "Template Best Practices", and "Service Architecture"
4. WHEN the user has fixed all detected anti-patterns in a category and rescans, THE Extension SHALL display a completion badge for that category (e.g., "✓ Template Best Practices: All clear!")
5. THE Extension SHALL provide a "Learning Progress" section showing which best practice categories have been addressed and which still have outstanding issues, creating a gamified learning path
6. THE Extension SHALL store anti-pattern detection rules and educational content locally within the extension bundle, requiring no network requests

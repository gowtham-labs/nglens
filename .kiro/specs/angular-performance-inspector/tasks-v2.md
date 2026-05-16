# Implementation Plan: Angular Performance Inspector — V2 "Profiler"

## Overview

V2 adds deep runtime profiling for mid-level developers. It answers: **"What exactly is happening at runtime, and where is time being spent?"**

**Prerequisites:** V1 must be complete and stable. V2 builds on V1's foundation (types, communication, base analyzer, registry, UI shell) without modifying any V1 code.

**New capabilities:**
- Change Detection Profiler (timeline, trigger identification, component ranking)
- Zone.js Event Profiler (unnecessary CD trigger detection)
- Component Render Time Profiler (flame chart, render bottlenecks)
- CD Efficiency Scorer (useful vs wasted renders — signature metric)
- FPS Monitor (frame drops, jank detection)
- Interaction Latency Tracker (click-to-render measurement)
- Route-Level TTI (per-route performance)
- Memory Growth Trend (heap monitoring)
- Network Waterfall Correlation (request-to-render timing)
- DevTools Panel (persistent full dashboard)
- Render Reason Tracker ("Why did this render?")

## Tasks

- [ ] 1. Extend Types for V2
  - [ ] 1.1 Add profiling type definitions
    - Create `src/types/profiling.ts` with `ChangeDetectionCycle`, `CDTrigger`, `ZoneTask`, `ComponentRenderEntry`, and `ProfilingSession` interfaces
    - Create `src/types/bundle.ts` with `BundleCategory`, `BundleEntry`, and `BundleAnalysis` interfaces
    - Create `src/types/network.ts` with `NetworkRequest` and `NetworkCorrelation` interfaces
    - Create `src/types/state.ts` with `ComponentState`, `StateProperty`, and `StoreState` interfaces
    - Extend `src/types/messages.ts` to add START_PROFILING, STOP_PROFILING, PROFILE_DATA, PROFILE_COMPLETE, STATE_REQUEST, STATE_RESPONSE message types
    - _Requirements: 9.2, 10.1, 11.1, 12.1, 13.1, 8.1_

- [ ] 2. Checkpoint - Types extended
  - Ensure all V1 tests still pass after type additions.

- [ ] 3. Profilers: CD Profiler, Zone Profiler, Component Profiler, CD Efficiency Scorer
  - [ ] 3.1 Implement the Change Detection Profiler
    - Create `src/analyzers/change-detection-profiler.ts` implementing CD cycle recording
    - Record timestamp, duration, components checked per cycle
    - Identify root trigger (user event, timer, HTTP response, programmatic)
    - Cap at 5000 cycles then auto-stop
    - Flag cycles exceeding 16ms frame budget
    - Rank top 20 components by total CD time
    - Respect performance budget (sampling at 60Hz max)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 3.2 Write property test for CD Profiler (Property 14)
    - **Property 14: Profiling Cycle Cap** — recorded cycles never exceed 5000
    - **Validates: Requirements 9.1**

  - [ ] 3.3 Implement the Zone.js Profiler
    - Create `src/analyzers/zone-profiler.ts` implementing Zone.js task interception
    - Record all zone task invocations (macroTask, microTask, eventTask) with source
    - Flag tasks that trigger CD without DOM updates as unnecessary
    - Recommend `NgZone.runOutsideAngular()` for high-frequency timers (>5 CD triggers/sec)
    - Display summary: source type, count, unnecessary triggers, avg/sec
    - Auto-stop after 300 seconds
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 3.4 Implement the Component Profiler
    - Create `src/analyzers/component-profiler.ts` implementing render time measurement
    - Measure per-component template rendering time with ms precision
    - Rank by average render time, display top 10 slowest
    - Flag components exceeding 8ms render time
    - Flag components rendering >50 times in 10-second window
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ] 3.5 Implement the CD Efficiency Scorer
    - Create `src/analyzers/cd-efficiency-scorer.ts`
    - Track total CD executions vs executions with DOM mutations per component
    - Compute efficiency: (useful / total) × 100, rounded to 1 decimal
    - Flag components below 20% efficiency (severity high)
    - Rank by wasted render count descending
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [ ] 4. Checkpoint - Profilers complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Performance Metrics: FPS, Interaction Latency, Route TTI, Memory, Network
  - [ ] 5.1 Implement the FPS Monitor
    - Create `src/analyzers/fps-monitor.ts` using requestAnimationFrame
    - Report average FPS over 1-second intervals
    - Detect dropped frames (gaps >20ms between rAF callbacks)
    - Flag FPS <30 as significant jank (high), <50 as minor jank (medium)
    - Correlate frame drops with concurrent CD cycles
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

  - [ ] 5.2 Implement the Interaction Latency Tracker
    - Create `src/analyzers/interaction-latency-tracker.ts` capturing click, keypress, input
    - Measure total time from event to DOM update completion
    - Break down: event handling, CD time, DOM render time
    - Flag >100ms as perceptibly slow, >300ms as critically slow
    - Calculate average latency across monitoring period
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [ ] 5.3 Implement the Route TTI Tracker
    - Create `src/analyzers/route-tti-tracker.ts` measuring Time-to-Interactive per route
    - Break down: route resolution, lazy chunk load, component init, initial render
    - Flag TTI >3s as slow (high), >1.5s as moderate (medium)
    - Detect lazy-loaded chunks via script resource monitoring
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6_

  - [ ] 5.4 Implement the Memory Trend Monitor
    - Create `src/analyzers/memory-trend-monitor.ts` sampling `performance.memory` every 5s
    - Flag >50% growth over 60s without decrease (severity high)
    - Correlate memory growth with component creation/destruction
    - Handle unavailability of `performance.memory`
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_

  - [ ] 5.5 Implement the Network Correlator
    - Create `src/analyzers/network-correlator.ts` via Performance Resource Timing API
    - Record URL, method, start time, response end, status
    - Link requests to CD cycles if CD starts within 200ms of response
    - Calculate response-to-render time
    - Flag >100ms response-to-render as slow
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 5.6 Write property tests for Network Correlator (Properties 18, 19)
    - **Property 18: Network-Render Correlation Timing** — linked iff ≤ 200ms
    - **Property 19: Slow Render Response Detection** — flagged iff > 100ms
    - **Validates: Requirements 13.2, 13.5**

- [ ] 6. Checkpoint - Performance metrics complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Render Reason Tracker and State Viewer
  - [ ] 7.1 Implement the Render Reason Tracker
    - Create `src/analyzers/render-reason-tracker.ts`
    - Categorize: @Input changed, parent re-rendered, observable emitted, timer, user event, programmatic
    - Record last 20 render reasons per component
    - Flag cascading renders → recommend OnPush
    - Flag >5 renders/sec with trigger breakdown
    - Display in plain language
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6_

  - [ ] 7.2 Implement the State Viewer
    - Create `src/analyzers/state-viewer.ts`
    - Display enumerable own-properties (excluding underscore-prefixed)
    - Poll for changes every 1000ms with change highlighting
    - Detect NgRx store, display state tree (max depth 5)
    - Use safe serializer, handle circular refs and destroyed components
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 8. Checkpoint - Analyzers complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. V2 UI: DevTools Panel, Profiler Tabs, Visualizations
  - [ ] 9.1 Implement the DevTools Panel
    - Update `vite.config.ts` to add DevTools entry points
    - Update `manifest.json` to add `devtools_page`
    - Create `devtools.html` and `src/ui/devtools/devtools.ts` registering "Angular Perf" panel
    - Create `src/ui/devtools/panel.html` and `panel.ts` sharing UI components with popup
    - Maintain state across page interactions, auto-detect on navigation
    - Synchronize results between popup and panel within 500ms
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_

  - [ ] 9.2 Add Profilers tab to popup and DevTools panel
    - Create `src/ui/popup/components/timeline-chart.ts` for CD cycle timeline
    - Create `src/ui/popup/components/flame-chart.ts` for component render flame chart
    - Display CD efficiency per component
    - Display FPS graph with dropped frames
    - Display interaction latency list with phase breakdown
    - Display route TTI table
    - Display memory trend line chart
    - _Requirements: 9.4, 11.5, 21.4, 24.5, 23.5, 25.5, 27.3_

  - [ ] 9.3 Add State tab to popup and DevTools panel
    - Create `src/ui/popup/components/state-tree.ts`
    - Show component properties with change highlighting
    - Show NgRx store state tree
    - Display render reason history for selected component
    - _Requirements: 8.1, 8.2, 8.3, 34.1, 34.2_

  - [ ] 9.4 Add network and bundle visualizations
    - Create `src/ui/popup/components/bundle-chart.ts` (bar chart by category)
    - Create `src/ui/popup/components/waterfall.ts` (network waterfall, up to 50 requests)
    - _Requirements: 12.6, 13.6_

  - [ ] 9.5 Wire profiling start/stop controls
    - Connect profiler UI controls to start/stop commands through message pipeline
    - Handle long-lived sessions with streaming data chunks
    - Display real-time data as it arrives
    - _Requirements: 9.1, 10.1, 11.1_

  - [ ] 9.6 Extend communication for profiling
    - Add START_PROFILING, STOP_PROFILING, PROFILE_DATA message handling to content script and background worker
    - Use chrome.runtime.connect (port) for long-lived profiling connections
    - _Requirements: 14.1_

- [ ] 10. Final V2 Checkpoint - V2 is shippable
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: profiling respects performance budget, auto-stops at limits
  - Verify: DevTools panel syncs with popup correctly
  - V2 is complete and ready to ship.

## Notes

- V2 does NOT modify any V1 files except to extend types and add new tabs to the UI shell
- All new analyzers register into the existing registry from V1
- Profiling uses long-lived connections (chrome.runtime.connect) vs V1's request/response pattern
- Performance budget enforcement from V1 applies to all V2 profilers
- V2 covers Requirements: 8, 9, 10, 11, 12, 13, 19, 21, 23, 24, 25, 27, 34

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["3.1", "3.3", "3.4", "3.5"] },
    { "id": 2, "tasks": ["3.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 4, "tasks": ["5.6"] },
    { "id": 5, "tasks": ["7.1", "7.2"] },
    { "id": 6, "tasks": ["9.1", "9.6"] },
    { "id": 7, "tasks": ["9.2", "9.3", "9.4", "9.5"] }
  ]
}
```

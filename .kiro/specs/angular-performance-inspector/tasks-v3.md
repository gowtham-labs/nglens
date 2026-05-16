# Implementation Plan: Angular Performance Inspector — V3 "Architect Platform"

## Overview

V3 transforms the extension into a team-level observability platform. It answers: **"How is our Angular architecture evolving, and where are systemic issues?"**

**Prerequisites:** V1 and V2 must be complete. V3 builds on the full analyzer registry, profiling infrastructure, and DevTools panel without modifying V1/V2 code.

**New capabilities:**
- Signals Migration Advisor (full analysis with before/after code snippets)
- Signals Adoption Score (migration progress tracking)
- RxJS Subscription Leak Detection
- Full Enterprise Optimizer (lazy loading, shared modules, memoized selectors)
- Architecture Smell Detection (God components, prop drilling, zone-heavy patterns)
- Component Stability Score
- Perceived Performance Score ("How it feels" vs "How it performs")
- Template Complexity Score
- Baseline and Regression Detection (team feature)
- Interaction Heatmap (visual overlay)
- Bundle Analyzer (full categorization and visualization)
- Full Best Practices Education (gamified learning path)

## Tasks

- [ ] 1. Signals and RxJS Analyzers
  - [ ] 1.1 Implement the Signals Advisor (full)
    - Create `src/analyzers/signals-advisor.ts` implementing full detection
    - Detect BehaviorSubject/ReplaySubject patterns replaceable with `signal()`
    - Detect `async` pipe usages replaceable with Signal-based reactivity
    - Detect `@Input()` without custom setters → suggest `input()` signal inputs
    - Detect `@Output()` with EventEmitter → suggest `output()` function
    - Categorize by effort: low, medium, high
    - Generate before/after code snippets (max 10 lines each)
    - Cap at 20 suggestions, ordered by effort
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 1.2 Write property test for Signals Advisor (Property 10)
    - **Property 10: Signals Suggestion Ordering and Cap** — ordered by effort, max 20
    - **Validates: Requirements 5.8**

  - [ ] 1.3 Implement the RxJS Leak Detector
    - Create `src/analyzers/rxjs-leak-detector.ts`
    - Inspect component properties for active subscriptions (`closed === false`)
    - Recognize valid cleanup patterns: unsubscribe, takeUntil, takeUntilDestroyed, async pipe
    - Flag subscriptions without cleanup (severity high)
    - Handle minified names (< 3 chars → report dev mode requirement)
    - Enforce limits: max 1000 elements, max 50 issues
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 1.4 Write property tests for RxJS Leak Detector (Properties 11, 12)
    - **Property 11: Cleanup Pattern Recognition** — valid patterns never flagged
    - **Property 12: Scan Limits Invariant** — max 1000 elements, max 50 issues
    - **Validates: Requirements 6.2, 6.7**

  - [ ] 1.5 Implement the Signals Adoption Scorer
    - Create `src/analyzers/signals-adoption-scorer.ts`
    - Classify components as "signal-based" vs "traditional"
    - Calculate adoption percentage: (signal-based / total) × 100
    - Display progress bar with breakdown
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5_

- [ ] 2. Checkpoint - Signals and RxJS complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Enterprise and Architecture Analyzers
  - [ ] 3.1 Extend Enterprise Optimizer (full scope)
    - Extend `src/analyzers/enterprise-optimizer.ts` to add:
      - Detect lazy loading opportunities (subtrees of 10+ eagerly loaded components)
      - Recommend `loadChildren`/`loadComponent` for eager route modules
      - Detect shared modules imported in >3 feature modules
      - Check for memoization in NgRx/NGXS/Akita selectors
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 3.2 Implement the Architecture Smell Detector
    - Create `src/analyzers/architecture-smell-detector.ts`
    - Detect "God Components" (>20 public properties or >10 injected dependencies)
    - Detect prop drilling (>3 @Input properties passed unchanged to children)
    - Detect zone-heavy architecture (>5 CD cycles/sec from timers)
    - Detect excessive global state (>70% components inject same service)
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6_

  - [ ] 3.3 Implement the Bundle Analyzer (full)
    - Create `src/analyzers/bundle-analyzer.ts` using Performance Resource Timing API
    - Enumerate script resources, calculate transfer/decoded sizes
    - Handle cross-origin restrictions (transferSize 0 → "unavailable")
    - Flag oversized resources (>250KB decompressed)
    - Categorize: vendor, polyfills, main, lazy-chunk
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ]* 3.4 Write property tests for Bundle Analyzer (Properties 15, 16, 17)
    - **Property 15: Bundle Resource Categorization** — correct category by filename
    - **Property 16: Bundle Size Threshold** — flagged iff > 250KB
    - **Property 17: Cross-Origin Exclusion** — transferSize 0 excluded
    - **Validates: Requirements 12.3, 12.4, 12.5**

  - [ ] 3.5 Extend Best Practices Detector (full scope)
    - Extend `src/analyzers/best-practices-detector.ts` to add:
      - Detect nested subscribe() calls
      - Detect manual DOM manipulation via ElementRef.nativeElement
      - Detect large templates (>300 lines)
      - Detect HTTP calls in components instead of services
    - Add categories: State Management, Component Design, Service Architecture
    - Track completion badges per category
    - Implement "Learning Progress" section
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5, 37.6_

- [ ] 4. Checkpoint - Enterprise analyzers complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Scoring Modules: Stability, Perceived Performance, Template Complexity
  - [ ] 5.1 Implement the Component Stability Scorer
    - Create `src/analyzers/stability-scorer.ts` computing score 0-100
    - Weight: rerender frequency 30%, DOM mutation frequency 30%, input churn 20%, layout thrashing 20%
    - Flag below 50 as unstable with contributing factors
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [ ] 5.2 Implement the Perceived Performance Scorer
    - Create `src/analyzers/perceived-performance-scorer.ts` computing UX score 0-100
    - Weight: interaction latency 40%, frame drops 35%, CLS 25%
    - Map latency/drops to sub-scores per defined thresholds
    - Highlight discrepancy when perceived differs from technical by >20 points
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5_

  - [ ] 5.3 Implement the Template Complexity Scorer
    - Create `src/analyzers/template-complexity-scorer.ts` computing complexity 0-100
    - Weight: structural directives 25%, pipes 20%, method calls 25%, bindings 15%, nested conditionals 15%
    - Flag >70 as high complexity
    - Flag method calls in templates specifically
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_

- [ ] 6. Checkpoint - Scoring modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Team Features: Baseline, Regression, Heatmap
  - [ ] 7.1 Implement the Baseline and Regression Detector
    - Create `src/services/baseline-regression-detector.ts` using `chrome.storage.local`
    - Store baselines keyed by URL + user label (score, sub-scores, issue counts, route TTIs)
    - Compare current vs baseline, flag >10% degradation as regression
    - Flag >15 point score drop as critical
    - Support up to 10 baselines per URL
    - Export/import baseline as JSON (shareable with team)
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

  - [ ] 7.2 Implement the Interaction Heatmap
    - Create `src/content/heatmap.ts` tracking DOM mutation frequency per component region
    - Overlay: red (>10 mutations/sec), yellow (3-10/sec), green (<3/sec)
    - Update colors every 2 seconds
    - Remove within 100ms on deactivation
    - Use `pointer-events: none` for non-interference
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5_

- [ ] 8. Checkpoint - Team features complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. V3 UI Extensions
  - [ ] 9.1 Add Signals and Architecture sections to Recommendations tab
    - Display signals migration suggestions with before/after code snippets
    - Display architecture smells in dedicated section
    - Display signals adoption score with progress bar
    - _Requirements: 5.6, 29.4, 32.5_

  - [ ] 9.2 Add Baseline controls to Overview tab
    - "Save Baseline" button with label input
    - Regression indicators next to degraded metrics
    - "Export Baseline" button for team sharing
    - _Requirements: 26.1, 26.3, 26.6_

  - [ ] 9.3 Add Perceived Performance display to Overview tab
    - Show "How it feels" score alongside "How it performs" score
    - Highlight discrepancy with explanation
    - _Requirements: 31.4, 31.5_

  - [ ] 9.4 Add Heatmap toggle to DevTools panel
    - Connect heatmap activation/deactivation to content script
    - _Requirements: 28.2_

  - [ ] 9.5 Add Stability and Template Complexity to Profilers tab
    - Display stability scores with color indicators
    - Display template complexity with factor breakdown
    - _Requirements: 22.5, 30.4_

  - [ ] 9.6 Extend Help Content for V3 categories
    - Add help entries for: memory-leaks, bundle-size, signals-migration, zone-triggers, network-correlation, architecture-smells
    - _Requirements: 20.4_

  - [ ] 9.7 Extend Learning Mode for V3 features
    - Add beginner explanations for all new V3 issue types
    - Add completion badges for new best practice categories
    - _Requirements: 33.2, 37.4, 37.5_

- [ ] 10. Final V3 Checkpoint - V3 is shippable
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: all V1 and V2 tests still pass
  - Verify: baseline export/import works across machines
  - Verify: heatmap doesn't interfere with page interactivity
  - V3 is complete — the Angular Performance Inspector is now a full architect platform.

## Notes

- V3 does NOT modify V1/V2 analyzer files — it extends the enterprise-optimizer and best-practices-detector, and creates new analyzer files
- All new analyzers register into the existing registry
- Baseline data uses `chrome.storage.local` (persistent across sessions) vs V1's `chrome.storage.session` (per-session)
- V3 covers Requirements: 5, 6, 7.1-7.5, 12, 22, 26, 28, 29, 30, 31, 32, 37.4, 37.5
- The heatmap runs in the content script (like the overlay) — no page-script changes needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.5"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.5"] },
    { "id": 3, "tasks": ["3.4"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["7.1", "7.2"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] }
  ]
}
```

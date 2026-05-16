# Tasks: Stabilize Subscription Leak Detector

## Task 1: Fix signals-analyzer.ts build errors [done:false]
- [x] Change type literal from `'signals-analyzer'` to `'signals-advisor'`
- [ ] Remove import of non-existent `AnalyzerContext`, use `AnalyzerConfig` instead
- [ ] Make SignalsAnalyzer implement full Analyzer interface (add `requiresDevMode: boolean` and `dispose(): void` method)
- [ ] Fix analyze() method signature to accept `AnalyzerConfig` instead of `AnalyzerContext`
- [ ] Verify the file compiles without errors via `npx tsc --noEmit`

## Task 2: Fix popup.ts null safety error [done:false]
- [ ] Add null guard before calling `renderScanResults(scanResults)` at line ~90
- [ ] Verify the file compiles without errors

## Task 3: Stabilize subscription-leak-detector.ts [done:false, depends_on:[1,2]]
- [ ] Replace `Date.now()` in issue IDs with deterministic hash (8 hex chars from componentName + leakType + properties). Add a simple `hashCode` helper function.
- [ ] Add known-patterns allowlist to reduce false positives: SubSink (property with `.add()` and `.unsubscribe()`), ngx-auto-unsubscribe (check constructor decorators), base class with destroy$ Subject
- [ ] Add runtime guard at top of execute() that checks `(globalThis as any).ng?.getComponent` availability. If unavailable, return empty AnalyzerResult with metadata `{ skipped: true, reason: 'ng.getComponent not available' }`
- [ ] Cap total issues at `MAX_LEAK_ISSUES` constant (import from constants.ts). Stop adding issues once limit reached.
- [ ] Verify the file compiles without errors

## Task 4: Set up Vitest and write unit tests [done:false, depends_on:[3]]
- [ ] Install vitest as dev dependency (`npm install -D vitest`)
- [ ] Add `"test": "vitest run"` script to package.json
- [ ] Create vitest.config.ts with proper TypeScript support
- [ ] Create `src/analyzers/__tests__/subscription-leak-detector.test.ts` with tests covering: component with subscriptions and no cleanup (issues reported), component with takeUntilDestroyed (no issues), component with destroy$ Subject pattern (no issues), component with SubSink (no issues via allowlist), component with timers and clearInterval in ngOnDestroy (no issues), component with addEventListener and removeEventListener (no issues), component with timers but no cleanup (timer leak reported), empty component (no issues), ng.getComponent unavailable (graceful skip with metadata)
- [ ] Run tests and ensure all pass

## Task 5: Final verification [done:false, depends_on:[4]]
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npx vitest run` — all tests pass
- [ ] Run `npx vite build` — build succeeds

# Requirements: Stabilize Subscription Leak Detector

## Requirement 1: Build Compilation
The project must compile with zero TypeScript errors (`tsc --noEmit` passes).

### Acceptance Criteria
- signals-analyzer.ts uses correct AnalyzerType ('signals-advisor'), correct interface, and has requiresDevMode/dispose
- popup.ts handles null scanResults safely
- All files compile without errors

## Requirement 2: Deterministic Issue IDs
Issue IDs must be stable across scans for the same component/issue combination.

### Acceptance Criteria
- IDs use a short hash (8 hex chars) derived from component name + leak type + property names
- Same component with same issues produces same ID on repeated scans
- Different components produce different IDs

## Requirement 3: False Positive Reduction
Known safe cleanup patterns must not trigger leak warnings.

### Acceptance Criteria
- SubSink pattern recognized as valid cleanup
- ngx-auto-unsubscribe decorator pattern recognized
- Base class with destroy$ Subject recognized
- Allowlist is conservative (3-4 patterns only)

## Requirement 4: Runtime Safety
The analyzer must gracefully handle missing Angular debug APIs.

### Acceptance Criteria
- If ng.getComponent is unavailable, returns empty issues with metadata explaining skip
- Total issues capped at MAX_LEAK_ISSUES (50)
- No crashes on unexpected component shapes

## Requirement 5: Test Coverage
Unit tests validate all detection logic paths.

### Acceptance Criteria
- Vitest installed and configured
- Tests cover: leak detection, cleanup recognition, allowlist, timer leaks, event listener leaks, edge cases
- All tests pass

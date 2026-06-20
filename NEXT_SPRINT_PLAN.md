# ngLens Next Sprint Plan

## Sprint Theme

Validate and polish the new daily-performance cockpit.

The previous sprint made ngLens more useful inside the DevTools panel:

- Overview now shows health, hotspots, quick wins, and snapshot messaging.
- Recommendations now works as a ranked Action Center with evidence, confidence, difficulty, expected gain, and snippets.
- Render details now explain why a component rendered.
- Memory now uses trustworthy "possible risk" wording.
- Message forwarding is safer and supports zone-pollution evidence.

The next sprint should prove this flow against real Angular apps and fix the friction that appears in practice.

## Goal

Make the current ngLens DevTools experience feel dependable in a real daily workflow:

```text
Load extension
Open Angular app
Start tracking
Use the app normally
Trust the dashboard and first recommended fix
```

This is not a redesign sprint. It is a validation, polish, and release-readiness sprint.

## Primary Demo Flow

By the end of the sprint, this should work without explanation:

1. Load `dist/` as an unpacked Chrome extension.
2. Open a real Angular app.
3. Open DevTools -> ngLens.
4. Start tracking.
5. Interact with the page.
6. Overview shows current hotspots and quick wins.
7. Recommendations ranks the best next fix.
8. Clicking an item opens believable evidence and likely fix guidance.
9. Route changes and clears do not leave stale recommendations behind.

## Scope

### 1. Real Angular App Validation

Purpose:

```text
Does the new cockpit work outside our own assumptions?
```

Validate against at least 3 app shapes:

- Small Angular app with simple routing.
- Data-heavy list/table app.
- App with timers, async work, or Zone.js-heavy behavior.

Check:

- DevTools panel connects consistently.
- Start/Stop tracking works.
- Render events appear after interactions.
- Overview does not look empty when data exists.
- Recommendations are ranked and believable.
- Zone pollution evidence reaches Recommendations when present.
- Route clear behavior does not mix old and new route data.

Expected result:

We should know whether the current implementation is demo-ready or which exact UI/data gaps remain.

### 2. Cockpit Polish From Demo Findings

Purpose:

```text
Remove friction from the first-use flow.
```

Only fix issues observed during validation, such as:

- Empty states that do not explain the next action.
- Click paths that select a component but do not reveal useful detail.
- Recommendation labels that feel vague or too confident.
- Metrics that are hard to scan.
- Text overflow or cramped cards.
- Stale route data after navigation.

Expected result:

The first 5 minutes with ngLens should feel coherent and useful.

### 3. Evidence Quality Pass

Purpose:

```text
Make every recommendation feel earned.
```

Improve only the evidence we already have:

- TrackBy: collection size and collection property.
- OnPush: score and matched suitability factors.
- Render hotspots: render count, render rate, average duration, main cause.
- Zone pollution: source, task count, cycles per minute.
- Memory risks: cleanup source, lifecycle timing, confidence.

Avoid adding new analyzers unless a validation blocker proves one is necessary.

Expected result:

Users can tell why ngLens ranked an action first.

### 4. Minimal Release-Readiness Cleanup

Purpose:

```text
Avoid obvious trust or packaging issues before sharing.
```

Do:

- Confirm README, PRIVACY, manifest, and UI copy agree about analytics.
- Confirm old popup path is either intentionally supported or clearly not part of the DevTools demo.
- Run dependency audit and capture the result.
- Confirm `dist/` loads cleanly as unpacked extension.

Do not:

- Spend the whole sprint rewriting docs.
- Start Chrome Web Store submission work unless the demo flow is already solid.

## Acceptance Criteria

The sprint is done when:

- Manual validation has been completed on at least 3 Angular app shapes.
- Every observed demo blocker is either fixed or documented.
- Overview and Recommendations remain useful after route changes.
- Memory copy avoids certainty where detection is heuristic.
- All checks pass:
  - `npm test`
  - `npx tsc --noEmit -p src/devtools/panel/tsconfig.app.json`
  - `npm run build:panel`
  - `npm run build:extension`
- A short demo note exists with what worked, what failed, and what to fix next.

## Non-Goals

- Do not add a fifth tab.
- Do not redesign the DevTools panel.
- Do not add many new analyzers.
- Do not rebuild popup UI unless we decide popup is part of the release.
- Do not start broad publishing work before validation.

## Priority Order

If time gets tight:

1. Manual validation on real Angular apps.
2. Fix demo blockers in Overview and Recommendations.
3. Improve evidence wording and click-through details.
4. Minimal trust/docs alignment.
5. Dependency audit and release notes.

## Suggested Work Log Template

Use this after each validation app:

```text
App:
Angular version:
Scenario tested:
Data captured:
What looked useful:
What looked confusing:
Bug or blocker:
Fix needed:
```

## Later Follow-Up

After this validation sprint:

- Decide whether popup remains part of the product or becomes legacy.
- Finalize analytics/privacy behavior.
- Harden page-to-extension messaging further if validation exposes gaps.
- Validate against more production Angular apps.
- Prepare Chrome Web Store assets and final publishing docs.

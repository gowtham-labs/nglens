# ngLens Tomorrow Execution Plan

Date to execute: Sunday, June 21, 2026

Branch to start from: `feature/validation-polish-sprint`

## Goal

Turn the current cockpit work into a release-confident build.

By the end of this session, we should know:

- Whether the DevTools panel works in real Chrome on real Angular apps.
- Which, if any, Overview or Recommendations issues must be fixed before release.
- How serious the dependency audit remediation is.
- Whether the popup remains an intentional part of the product.

## Why This Matters

The previous work made ngLens more useful: it now explains hotspots, ranks fixes, and gives evidence instead of only showing raw runtime data.

Tomorrow's work is about trust:

- Prove the feature works outside tests.
- Remove any demo-breaking friction.
- Handle the audit blocker carefully.
- Avoid shipping with unclear popup/privacy behavior.

## Execution Order

### 1. Start With Fresh State

Commands:

```bash
git checkout feature/validation-polish-sprint
git pull
npm test
npx tsc --noEmit -p src/devtools/panel/tsconfig.app.json
npm run build:panel
npm run build:extension
```

Expected result:

- All checks pass before manual validation begins.
- `dist/` is fresh and ready to load as an unpacked Chrome extension.

### 2. Manual Chrome Validation

Load `dist/` in Chrome:

```text
chrome://extensions
Enable Developer mode
Load unpacked
Select ngLens/dist
```

Validate the main demo flow:

```text
Open Angular app
Open DevTools -> ngLens
Start tracking
Interact with app
Check Overview
Check Recommendations
Open details/evidence
Navigate route if app supports routing
Stop tracking
Clear data
```

### App Shape A: Small Routed App

Purpose:

- Confirm panel connection, route handling, clear behavior, and simple render evidence.

Record in `VALIDATION_REPORT.md`:

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

Pass criteria:

- Panel connects.
- Start/Stop tracking works.
- Route changes do not leave stale recommendations.
- Overview is not empty after real interactions.

### App Shape B: Data-Heavy List/Table App

Purpose:

- Validate render hotspots, TrackBy evidence, ranking, and expected-gain wording.

Pass criteria:

- Hot components are easy to identify.
- Recommendations are ranked in a believable order.
- Evidence explains collection size/property when TrackBy issues exist.
- Detail click-through helps decide the next fix.

### App Shape C: Async or Zone-Heavy App

Purpose:

- Validate async render causes, zone-pollution events, timers, and memory cleanup risk wording.

Pass criteria:

- Async/zone activity appears when present.
- Recommendations do not overclaim certainty.
- Memory findings say possible cleanup risk, not guaranteed leak.
- Detail evidence includes source, count, or timing when available.

### 3. Fix Only Demo Blockers

Fix immediately if validation finds:

- Panel cannot connect.
- Start/Stop tracking fails.
- Overview stays empty even when events exist.
- Recommendations are stale after route changes.
- A card/detail click goes nowhere useful.
- Text overflows or hides important evidence.
- Memory wording sounds too certain.

Do not add new analyzers tomorrow unless a validation blocker proves one is required.

### 4. Dependency Audit Remediation

Start a separate branch from the validation branch:

```bash
git checkout -b chore/dependency-audit-remediation
npm audit --audit-level=high
```

First attempt non-breaking remediation:

```bash
npm audit fix
npm test
npx tsc --noEmit -p src/devtools/panel/tsconfig.app.json
npm run build:panel
npm run build:extension
npm audit --audit-level=high
```

Rules:

- Do not run `npm audit fix --force` as the first move.
- Do not mix major Angular/CLI upgrades into the validation branch.
- If Angular 22 or Vite 8 is required, document it as a dedicated upgrade step.
- Commit only if tests/builds still pass.

Expected output:

- Either vulnerabilities are reduced safely, or we have a clear dependency-upgrade plan with exact packages and risk.

### 5. Popup Decision

Answer this product question:

```text
Is popup part of the supported release experience, or is ngLens primarily DevTools-only?
```

Recommended decision for now:

- Keep popup supported only for analytics consent/settings.
- Keep DevTools panel as the primary user experience.
- Add a small note in release docs if needed.

If popup feels confusing during validation:

- Do not redesign it tomorrow.
- Document the confusion.
- Create a follow-up task to move consent/settings into the DevTools panel.

### 6. Final Verification

Run before finishing:

```bash
npm test
npx tsc --noEmit -p src/devtools/panel/tsconfig.app.json
npm run build:panel
npm run build:extension
git diff --check
```

Also rerun:

```bash
npm audit --audit-level=high
```

Expected result:

- Feature checks pass.
- Audit status is either improved or documented as a separate upgrade blocker.
- `VALIDATION_REPORT.md` contains real manual results.

## Definition Of Done

Tomorrow is successful when:

- `VALIDATION_REPORT.md` has results for all 3 app shapes.
- Every demo blocker found during validation is fixed or clearly documented.
- Automated checks pass after fixes.
- Dependency audit has either safe fixes applied or a clear upgrade branch/plan.
- Popup role is explicitly decided.
- Branch is committed and pushed.

## Do Not Do Tomorrow

- Do not add a new tab.
- Do not redesign the panel.
- Do not add broad new analyzers.
- Do not force major dependency upgrades without isolating them.
- Do not start Chrome Web Store submission until Chrome validation and audit status are understood.

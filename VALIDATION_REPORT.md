# ngLens Validation Report

Branch: `feature/validation-polish-sprint`
Date: June 20, 2026

## Purpose

Validate the daily-performance cockpit from `NEXT_SPRINT_PLAN.md` and record what is ready, what needs manual browser confirmation, and what should be fixed before broader sharing.

## Demo Flow Under Test

```text
Load dist as unpacked extension
Open Angular app
Open DevTools -> ngLens
Start tracking
Interact with the app
Use Overview and Recommendations to choose a fix
Open render or memory detail evidence
```

## Validation Matrix

Manual browser validation was not completed in this terminal-only pass. The extension build is ready in `dist/`, but the following checks still need to be run in Chrome with the unpacked extension loaded.

### App 1: Small Angular App With Routing

Status: Pending Chrome validation

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

### App 2: Data-Heavy List/Table App

Status: Pending Chrome validation

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

### App 3: Async/Zone-Heavy App

Status: Pending Chrome validation

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

## Automated Checks

Completed on June 20, 2026.

| Check | Result | Notes |
| --- | --- | --- |
| `npm test` | Passed | 12 test files, 89 tests passed. |
| `npx tsc --noEmit -p src/devtools/panel/tsconfig.app.json` | Passed | No TypeScript diagnostics. |
| `npm run build:panel` | Passed | Sandbox run aborted with exit 134; rerun outside sandbox completed and wrote `dist/panel`. |
| `npm run build:extension` | Passed | Vite transformed 38 modules and rebuilt `dist/content.js`, `dist/background.js`, `dist/page-script.js`, and `dist/devtools.js`. |
| `npm audit --audit-level=high` | Failed release gate | 28 vulnerabilities reported: 1 low, 12 moderate, 14 high, 1 critical. |

Audit highlights:

- Angular packages are below the patched ranges for multiple high/moderate advisories.
- Toolchain advisories include `@babel/core`, `esbuild`/`vite`, `http-proxy-middleware`, `js-yaml`, `launch-editor`, `piscina`, `serialize-javascript`, `tar`, and `uuid`.
- Some fixes are available via `npm audit fix`; several suggested fixes require breaking upgrades to Angular/CLI 22, Vite 8, or related tooling.
- Do not run `npm audit fix --force` in this branch without a dedicated dependency-upgrade pass and full regression testing.

## Release-Readiness Review

Completed for docs, manifest, version metadata, and automated build output.

What changed:

- `manifest.json` now describes memory findings as cleanup risks instead of guaranteed leaks.
- README-adjacent publishing/security docs now say analysis data stays local and anonymous analytics are opt-in, instead of claiming the extension never contacts external services.
- `PRIVACY.md` now reflects the DevTools panel, June 20, 2026 update date, and opt-in analytics compliance.
- `src/utils/privacy.ts` now allows only the declared Google Analytics endpoint for opt-in analytics and treats other network calls as unexpected.
- `package.json`, `package-lock.json`, and `manifest.json` are aligned on version `1.0.2`.

Still open:

- Real Chrome validation on three Angular app shapes.
- Dependency vulnerability remediation.
- Popup product decision: the DevTools panel is the main demo surface, but analytics consent/settings still live in the popup UI.
- Final manual check that `dist/` loads cleanly as an unpacked extension after the browser validation pass.

## Findings

1. The automated product surface is healthy after the cockpit sprint: tests, panel typecheck, panel build, and extension build all pass.
2. Release/trust copy was inconsistent with the actual opt-in analytics implementation; this branch fixes the obvious manifest, privacy, publishing, security, and source-level mismatches.
3. The dependency audit is a real release blocker. It should be handled as a focused dependency-upgrade branch, not mixed into cockpit validation.
4. Manual browser validation remains the main confidence gap. Without loading `dist/` in Chrome against real Angular apps, we cannot honestly mark the sprint acceptance criteria complete.
5. The popup is still part of the product because it owns analytics consent/settings. If the DevTools panel is the primary experience, the popup should either remain intentionally supported or the consent flow should move into the DevTools surface.

## Recommended Next Fixes

1. Run the Chrome validation matrix above against three real Angular app shapes and paste results into this report.
2. Fix any observed Overview/Recommendations blockers from that manual pass before adding more analyzers.
3. Create a separate dependency-upgrade branch for the audit findings; start with non-breaking `npm audit fix`, then assess Angular/CLI major-version upgrades separately.
4. Decide whether popup remains a supported release surface or becomes legacy; do not leave consent/settings in an accidental UI path.
5. After dependency remediation and Chrome validation, rerun the full automated gate and package the extension ZIP.

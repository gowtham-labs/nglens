import { Injectable, inject } from '@angular/core';
import { DevtoolsPortService } from './devtools-port.service';
import { componentNameToSelector } from '../utils/display-name';
import type { PortMessage } from '../../../../types/port-messages';

@Injectable({ providedIn: 'root' })
export class CommandService {
  private readonly portService = inject(DevtoolsPortService);

  startTracking(): void {
    this.send({ type: 'START_TRACKING', payload: null, timestamp: Date.now() });
  }

  stopTracking(): void {
    this.send({ type: 'STOP_TRACKING', payload: null, timestamp: Date.now() });
  }

  selectComponent(name: string): void {
    this.send({ type: 'SELECT_COMPONENT', payload: { name }, timestamp: Date.now() });
  }

  clearData(): void {
    this.send({ type: 'CLEAR_DATA', payload: null, timestamp: Date.now() });
  }

  scanAppStructure(): void {
    this.send({ type: 'SCAN_APP_STRUCTURE', payload: null, timestamp: Date.now() });
  }

  /**
   * Opens the source file of an Angular class in the DevTools Sources panel
   * using Chrome's built-in `inspect(constructor)` Command Line API.
   *
   * The eval expression is SELF-CONTAINED — it does not require `ngLensInspection`
   * to be pre-initialized. It runs three strategies in priority order:
   *
   *   1. Cache from Ivy metadata scan  — O(1); covers ALL registered classes
   *      including external packages (e.g. @angular/material) that are never in DOM.
   *   2. window.ng.getComponent() + getDirectives()  — live dev-mode scan; covers
   *      attribute-selector components (MatButton on <button mat-button>), pipes,
   *      and any class not yet in the cache.
   *   3. el.__ngContext__ (LView)  — Angular DevTools LTreeStrategy; TView.type is
   *      the component constructor. Works even without window.ng (production mode).
   *
   * On success: Chrome DevTools Sources navigates to the constructor definition.
   * Works for user code AND external packages through V8 source-map resolution.
   * On failure (class not found): calls `onNotFound()` for URL-based fallback.
   *
   * Pattern mirrors Angular DevTools chrome-application-operations.ts:
   *   `inspect(inspectedApplication.findConstructorByPosition(pos, idx))`
   * All lookup logic lives in window.ngLensInspection (the page-side backend)
   * so this eval stays minimal — exactly 1 logical step.
   */
  private tryOpenViaConstructorInspect(className: string, onNotFound: () => void): void {
    // JSON.stringify gives a properly-escaped JS string literal safe against injection.
    const safeClassName = JSON.stringify(className);

    // Minimal eval — implements the two-path strategy from the Blueprint article:
    //   • Local code  → inspect(ctor) with source maps navigates to TypeScript
    //   • External pkg → openResource(runtimeUrl) opens the .mjs/.ts file directly,
    //                    inspect(ctor) runs as automatic backup
    //
    // Step 1 (in eval): find constructor, call inspect(ctor), return metadata JSON.
    // Step 2 (in callback): if external package URL captured → also openResource(url).
    //
    // The runtime URL in `entry.url` comes from extractSourceUrlFromStack() called
    // inside hookAngularProfilerSafely's onChangeDetectionStart — the call stack
    // at that moment shows the actual HTTP URL of the file executing the component.
    const expression = `
(function() {
  var ns = window.ngLensInspection;
  if (!ns) return false;
  var ctor = ns.findConstructorByName(${safeClassName});
  if (typeof ctor !== 'function') return false;
  if (typeof inspect !== 'function') return false;
  var fp = null;
  try {
    var d = ctor.ɵcmp || ctor.ɵdir || ctor.ɵpipe || ctor.ɵmod || ctor.ɵprov;
    fp = (d && d.debugInfo && typeof d.debugInfo.filePath === 'string')
      ? d.debugInfo.filePath : null;
  } catch(e) {}
  var entry = ns.getSourceEntry ? ns.getSourceEntry(${safeClassName}) : null;
  inspect(ctor);
  return JSON.stringify({ fp: fp, url: entry ? entry.url : null, isExternal: !!(entry && entry.isExternal) });
})()
    `.trim();

    chrome.devtools.inspectedWindow.eval(
      expression,
      (rawResult, exceptionInfo) => {
        const result = rawResult as unknown;
        if (exceptionInfo?.isException || exceptionInfo?.isError || !result) {
          // Constructor not found, or inspect() itself threw — fall back to URL approach.
          onNotFound();
          return;
        }
        // inspect(ctor) was already called — Chrome is navigating via source maps.
        // Parse the returned metadata to decide whether to ALSO call openResource.
        if (typeof result === 'string') {
          try {
            const info = JSON.parse(result) as { fp?: string | null; url?: string | null; isExternal?: boolean };
            if (info.url && info.isExternal) {
              // External package (.mjs, node_modules): also open the captured runtime
              // URL directly — more reliable than source-map resolution for libraries
              // that ship without TypeScript source maps.
              chrome.devtools.panels.openResource(info.url, 0, () => { /* opened */ });
            } else if (info.fp) {
              // Local code with debugInfo.filePath: secondary openResource attempt
              // for webpack-based builds where the .ts file is a separate resource.
              this.tryOpenByRuntimeFilePath(info.fp);
            }
          } catch { /* ignore JSON parse errors */ }
        }
      }
    );
  }

  /**
   * Secondary source-navigation path: uses the runtime debugInfo.filePath returned
   * from the eval to search Chrome's resource list for a matching URL.
   *
   * This is supplementary — inspect(constructor) was already called.  For webpack
   * builds this opens the TypeScript source precisely; for Vite builds where the
   * TypeScript file is embedded in sourcesContent rather than served as a separate
   * resource, it is a no-op (inspect() already handled navigation).
   */
  private tryOpenByRuntimeFilePath(runtimeFilePath: string): void {
    const norm = runtimeFilePath.replace(/\\/g, '/');
    const segments = norm.split('/').filter(s => s.length > 0 && s !== '.' && s !== '..');

    chrome.devtools.inspectedWindow.getResources(resources => {
      // Progressive suffix match: 3 segments → 2 → 1.
      // e.g. '@angular/material/button/button.ts' → try 'button/button.ts', then 'button.ts'
      // The build-machine path 'darwin_arm64/…/button/button.ts' → try 'button/button.ts' → found.
      for (let n = Math.min(segments.length, 3); n >= 1; n--) {
        const suffix = segments.slice(-n).join('/');
        const match = resources.find(r => r.url.replace(/\\/g, '/').endsWith(suffix));
        if (match) {
          chrome.devtools.panels.openResource(match.url, 0, () => { /* opened */ });
          return;
        }
      }
      // No match — inspect() already navigated; this is a no-op.
    });
  }

  /**
   * Opens the source file of the given Angular component in the DevTools Sources panel.
   *
   * Strategy 0 (preferred): `inspect(constructor)` via `window.ngLensInspection` —
   * works for all packages including `@angular/*`, requires Angular dev-mode.
   * Strategy 1 (fallback): `chrome.devtools.panels.openResource()` by file URL —
   * matches by kebab-case file name derived from the component class name.
   */
  openInSources(componentName: string): void {
    this.tryOpenViaConstructorInspect(componentName, () => {
      this.openInSourcesFallback(componentName);
    });
  }

  private openInSourcesFallback(componentName: string): void {
    const fileName = this.toComponentFileName(componentName);

    chrome.devtools.inspectedWindow.getResources((resources) => {
      // Prefer TypeScript source files (available when source maps are active)
      const tsMatch = resources.find(r => r.url.includes(fileName) && r.url.endsWith('.ts'));
      const jsMatch = resources.find(r => r.url.includes(fileName) && r.url.endsWith('.js'));
      const match = tsMatch ?? jsMatch;

      if (match) {
        chrome.devtools.panels.openResource(match.url, 0, () => { /* opened */ });
        return;
      }

      // Loose fallback: match just the kebab-case part (covers non-standard naming)
      const kebab = fileName.replace('.component', '');
      const loose = resources.find(r =>
        r.url.includes(kebab) &&
        (r.url.endsWith('.ts') || r.url.endsWith('.js'))
      );

      if (loose) {
        chrome.devtools.panels.openResource(loose.url, 0, () => { /* opened */ });
        return;
      }

      console.warn('[ngLens] Source file not found for:', componentName);
    });
  }

  /**
   * Opens the source file of a given Angular class (interceptor, resolver, guard, etc.)
   * in the DevTools Sources panel.
   *
   * Strategy 0 (preferred): `inspect(constructor)` via `window.ngLensInspection` —
   * works for user code AND external packages, requires Angular dev-mode.
   * Strategy 1: match resources by the stored `filePath` base name / 2-segment suffix.
   * Strategy 2: derive file name from class name + suffix convention.
   *
   * @param className  The Angular class name (e.g. `AuthInterceptor`, `UserDataResolver`).
   * @param filePath   The file path stored in the registry (may be null or an npm package name).
   * @param suffix     Conventional file suffix without dot (e.g. `'interceptor'`, `'resolver'`, `'guard'`).
   */
  openClassFileInSources(className: string, filePath: string | null, suffix: string): void {
    this.tryOpenViaConstructorInspect(className, () => {
      this.openClassFileInSourcesFallback(className, filePath, suffix);
    });
  }

  private openClassFileInSourcesFallback(className: string, filePath: string | null, suffix: string): void {
    chrome.devtools.inspectedWindow.getResources((resources) => {
      // Strategy 1: base-name match against any stored filePath that carries a file extension.
      // This works for every path format Chrome DevTools may have as a webpack:// or HTTP resource:
      //   • local absolute  →  /abs/project/src/app/foo.component.ts
      //   • node_modules    →  /abs/project/node_modules/@lib/src/foo.component.ts
      //   • package-relative (the common case for pre-compiled libraries such as Angular
      //     Material or CoreUI whose debugInfo.filePath starts with '@'):
      //                        @angular/material/button/button.component.ts
      //   • plain relative  →  @angular/cdk/table/table.component.ts
      if (filePath) {
        const segments = filePath.replace(/\\/g, '/').split('/');
        const fileName = segments.pop() ?? '';
        if (fileName && (fileName.endsWith('.ts') || fileName.endsWith('.js') || fileName.endsWith('.mjs'))) {
          // Try 2-segment suffix first (e.g. 'button/button.component.ts') to reduce
          // false positives when multiple packages share the same base filename.
          if (segments.length > 0) {
            const twoSegPath = segments[segments.length - 1] + '/' + fileName;
            const byLongPath = resources.find(r => r.url.endsWith(twoSegPath));
            if (byLongPath) {
              chrome.devtools.panels.openResource(byLongPath.url, 0, () => { /* opened */ });
              return;
            }
          }
          // Fallback: single file name match
          const byPath = resources.find(r => r.url.endsWith(fileName));
          if (byPath) {
            chrome.devtools.panels.openResource(byPath.url, 0, () => { /* opened */ });
            return;
          }
        }
      }

      // Strategy 2: derive file name from class name + suffix convention
      // e.g. MyAuthInterceptor → strip "Interceptor" → my-auth → MyAuth / my-auth.interceptor
      // Or functional guard: authGuard (keeps name raw if it's already lowercase camelCase or matches suffix patterns)
      const suffixCapitalized = suffix.charAt(0).toUpperCase() + suffix.slice(1);
      const cleaned = className
        .replace(/^_+/, '')
        .replace(new RegExp(`${suffixCapitalized}$`, 'i'), ''); // Case-insensitive suffix strip
      const kebab = cleaned.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      const fileBase = `${kebab}.${suffix}`;

      // Loose matching list to tolerate functional naming, e.g., 'authGuard' matching 'auth.guard.ts' or 'auth-guard.ts'
      const looseFileBases = [
        fileBase,
        `${kebab}-${suffix}`,
        `${kebab}_${suffix}`,
        kebab,
        cleaned.toLowerCase(),
        className.toLowerCase()
      ];

      let match: chrome.devtools.inspectedWindow.Resource | undefined;
      for (const base of looseFileBases) {
        match = resources.find(r => r.url.toLowerCase().includes(base) && (r.url.endsWith('.ts') || r.url.endsWith('.js') || r.url.endsWith('.mjs')));
        if (match) break;
      }

      if (match) {
        chrome.devtools.panels.openResource(match.url, 0, () => { /* opened */ });
        return;
      }

      // Strategy 3: bare package name — search resources for any file URL that contains
      // BOTH the package name AND the class's kebab-case base name.
      // Handles e.g. filePath = '@angular/material', className = 'MatButton':
      //   • kebabBase = 'mat-button'
      //   • matches 'webpack:///./node_modules/@angular/material/button/mat-button.component.ts'
      //   • also matches 'http://localhost:4200/node_modules/@angular/material/fesm2022/button.mjs'
      //     when kebabBase appears inside it (may not always match; best-effort).
      if (filePath && !filePath.includes('/') && !filePath.includes('.')) {
        // pure bare name like 'rxjs', 'lodash'
        const pkgMatch = resources.find(r =>
          r.url.includes(filePath) && r.url.includes(kebab) &&
          (r.url.endsWith('.ts') || r.url.endsWith('.js') || r.url.endsWith('.mjs'))
        );
        if (pkgMatch) {
          chrome.devtools.panels.openResource(pkgMatch.url, 0, () => { /* opened */ });
          return;
        }
      } else if (filePath && (filePath.startsWith('@') || !filePath.includes('.'))) {
        // scoped or unscoped package path without file extension: '@angular/material', '@coreui/angular'
        const pkgSegments = filePath.split('/').slice(0, filePath.startsWith('@') ? 2 : 1);
        const pkgName = pkgSegments.join('/'); // e.g. '@angular/material'
        const pkgMatch = resources.find(r => {
          const url = r.url.replace(/\\/g, '/');
          return url.includes(pkgName.replace('@', '')) &&
            (url.endsWith('.ts') || url.endsWith('.js') || url.endsWith('.mjs'));
        });
        if (pkgMatch) {
          chrome.devtools.panels.openResource(pkgMatch.url, 0, () => { /* opened */ });
          return;
        }
      }

      console.warn(`[ngLens] Source file not found for ${suffix}: ${className}`);
    });
  }

  /**
   * Opens the inspected window's source file at the exact line where `propName`
   * is first declared.
   *
   * Strategy:
   * 1. Resolve the resource URL from the stored `filePath` (preferred) or by
   *    deriving the file name from `className` (fallback).
   * 2. Call `Resource.getContent()` to retrieve the file source text.
   * 3. Scan lines for the first occurrence of `propName` as a whole word.
   * 4. Open the resource at that line via `chrome.devtools.panels.openResource()`.
   *
   * @param filePath  Stored registry file path (null or npm package name → skip direct match).
   * @param propName  Property / method name to locate (must be a valid JS identifier).
   * @param className Component class name used for file-name derivation fallback.
   */
  openPropertyInSources(filePath: string | null, propName: string, className: string): void {
    const candidateFiles: string[] = [];

    // Priority 1: base file name from any stored path (local OR node_modules absolute)
    if (filePath) {
      const base = filePath.split('/').pop();
      if (base && (base.endsWith('.ts') || base.endsWith('.js') || base.endsWith('.mjs'))) {
        candidateFiles.push(base);
      }
    }
    // Priority 2: derive file name from class name (e.g. HeroListComponent → hero-list.component)
    candidateFiles.push(this.toComponentFileName(className));

    chrome.devtools.inspectedWindow.getResources((resources) => {
      let resource: chrome.devtools.inspectedWindow.Resource | undefined;

      for (const candidate of candidateFiles) {
        const hasExt = candidate.endsWith('.ts') || candidate.endsWith('.js') || candidate.endsWith('.mjs');
        if (hasExt) {
          // Exact tail match — avoids accidentally matching spec or other files
          resource = resources.find(r => r.url.endsWith(candidate));
        } else {
          // No extension: append explicit extension so we don't hit *.spec.ts files
          // (e.g. 'app.component' matches 'app.component.ts' but NOT 'app.component.spec.ts')
          resource = resources.find(r => r.url.endsWith(candidate + '.ts'))
            ?? resources.find(r => r.url.endsWith(candidate + '.js'))
            ?? resources.find(r => r.url.endsWith(candidate + '.mjs'));
        }
        if (resource) break;
      }

      if (!resource) {
        console.warn('[ngLens] Source not found for property:', propName, 'in', className);
        return;
      }

      // Capture for use in async callback; escape $ which is valid in identifiers
      const captured = resource;
      const escaped = propName.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`);

      captured.getContent((content) => {
        if (!content) {
          chrome.devtools.panels.openResource(captured.url, 0, () => { /* opened */ });
          return;
        }
        const lines = content.split('\n');
        let targetLine = 0;
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            targetLine = i;
            break;
          }
        }
        chrome.devtools.panels.openResource(captured.url, targetLine, () => { /* opened */ });
      });
    });
  }

  private toComponentFileName(className: string): string {
    const cleaned = className.replace(/^_+/, '').replace(/Component$/, '');
    const kebab = cleaned.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    return `${kebab}.component`;
  }

  /** Returns true when the path is a local source file (not an npm package name). */
  private isLocalSourcePath(path: string): boolean {
    if (!path) return false;
    if (path.startsWith('@') || path.includes('node_modules/')) return false;
    return path.includes('.ts') || path.includes('.js') || path.includes('.mjs');
  }

  /**
   * Selects the first DOM element for the given Angular component in the DevTools Elements panel.
   *
   * Strategy:
   * 1. Walk all DOM elements and use `ng.getComponent()` to match by constructor name.
   *    This works in Angular dev-mode apps where `window.ng` is exposed.
   * 2. Fall back to a tag-name CSS selector derived from the class name convention.
   *
   * `inspect(element)` is part of the Command Line API available inside
   * `chrome.devtools.inspectedWindow.eval` and causes the Elements panel to
   * navigate to that node.
   */
  inspectInElementsPanel(componentName: string): void {
    // Derive a best-effort CSS selector as a fallback (app-[kebab-case])
    const fallbackSelector = componentNameToSelector(componentName);

    // All dynamic values are JSON-stringified to prevent injection through
    // component names that may contain special characters.
    const expression = `
(function() {
  var targetName = ${JSON.stringify(componentName)};
  var ng = window.ng;

  // Primary: use Angular's ng.getComponent() to match by constructor name.
  // This reliably finds the actual host element regardless of selector prefix.
  if (ng && typeof ng.getComponent === 'function') {
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      try {
        var comp = ng.getComponent(all[i]);
        if (comp && comp.constructor && comp.constructor.name === targetName) {
          inspect(all[i]);
          return;
        }
      } catch (e) {}
    }
  }

  // Fallback: CSS tag-name selector derived from class-name convention (app-[kebab]).
  var el = document.querySelector(${JSON.stringify(fallbackSelector)});
  if (el) { inspect(el); return; }

  console.warn('[ngLens] Could not find element for component:', targetName);
})()
    `.trim();

    chrome.devtools.inspectedWindow.eval(
      expression,
      (_result, exceptionInfo) => {
        if (exceptionInfo) {
          console.warn('[ngLens] inspect() failed:', exceptionInfo.description ?? exceptionInfo.value);
        }
      }
    );
  }

  private send(message: PortMessage): void {
    this.portService.send(message);
  }
}


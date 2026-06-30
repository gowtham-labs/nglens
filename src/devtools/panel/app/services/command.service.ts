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
   * Opens the source file of the given Angular component in the DevTools Sources panel.
   *
   * Uses `chrome.devtools.inspectedWindow.getResources()` to enumerate all resources
   * loaded in the inspected window and matches by the kebab-case file name derived
   * from the component class name (e.g. `HeroListComponent` → `hero-list.component`).
   *
   * TypeScript files (served by Vite/webpack dev-servers with source maps) are
   * preferred over compiled JavaScript. Once the URL is found, it is opened via
   * `chrome.devtools.panels.openResource()`.
   */
  openInSources(componentName: string): void {
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
   * Strategy:
   * 1. If a `filePath` is available and is a local source file (has a .ts/.js extension and is
   *    not an npm package), match resources by the file's base name.
   * 2. Fall back to deriving the file name from the class name and the provided `suffix`
   *    (e.g. `MyAuthInterceptor` + `'interceptor'` → `my-auth.interceptor.ts`).
   *
   * @param className  The Angular class name (e.g. `AuthInterceptor`, `UserDataResolver`).
   * @param filePath   The file path stored in the registry (may be null or an npm package name).
   * @param suffix     Conventional file suffix without dot (e.g. `'interceptor'`, `'resolver'`, `'guard'`).
   */
  openClassFileInSources(className: string, filePath: string | null, suffix: string): void {
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
      // e.g. MyAuthInterceptor → strip "Interceptor" → my-auth → my-auth.interceptor
      const suffixCapitalized = suffix.charAt(0).toUpperCase() + suffix.slice(1);
      const cleaned = className
        .replace(/^_+/, '')
        .replace(new RegExp(`${suffixCapitalized}$`), '');
      const kebab = cleaned.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      const fileBase = `${kebab}.${suffix}`;

      const tsMatch = resources.find(r => r.url.includes(fileBase) && r.url.endsWith('.ts'));
      const jsMatch = resources.find(r => r.url.includes(fileBase) && r.url.endsWith('.js'));
      const match = tsMatch ?? jsMatch;

      if (match) {
        chrome.devtools.panels.openResource(match.url, 0, () => { /* opened */ });
        return;
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


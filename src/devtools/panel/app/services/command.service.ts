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

  private toComponentFileName(className: string): string {
    const cleaned = className.replace(/^_+/, '').replace(/Component$/, '');
    const kebab = cleaned.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    return `${kebab}.component`;
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


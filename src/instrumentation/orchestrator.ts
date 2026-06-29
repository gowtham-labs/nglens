/**
 * Instrumentation Orchestrator — coordinates all page-script detectors.
 *
 * Listens for CustomEvents from the content script (forwarded panel commands)
 * and manages the lifecycle of all instrumentation modules:
 * - RenderTracker: records change detection cycles
 * - LeakDetector: tracks component lifecycle and detects leaks
 * - PerformanceGuard: monitors instrumentation overhead
 * - TrackByDetector: identifies missing trackBy in ngFor
 * - OnPushEngine: evaluates OnPush suitability
 * - SelectiveAnalyzer: gates deep analysis to selected component
 * - checkAngularVersion: verifies Angular 17+ support
 */

import { RenderTracker } from './render-tracker';
import { LeakDetector } from './leak-detector';
import { TrackByDetector } from './trackby-detector';
import { PerformanceGuard } from './performance-guard';
import { SelectiveAnalyzer } from './selective-analyzer';
import { TemplateExpressionTracker } from './template-expression-tracker';
import { FreezeDetector } from './freeze-detector';
import { ZonePollutionDetector } from './zone-pollution-detector';
import { checkAngularVersion } from './version-check';
import { collectAppStructure } from './app-structure/app-structure-collector';

/** Event name used by the content script to dispatch commands to the page script */
const CONTENT_TO_PAGE_EVENT = '__ng_perf_to_page';

/** Event name used to send results back to the content script */
const PAGE_TO_CONTENT_EVENT = '__ng_perf_to_content';

// Module-level instances
const renderTracker = RenderTracker.getInstance();
const leakDetector = new LeakDetector();
const trackByDetector = new TrackByDetector();
const performanceGuard = PerformanceGuard.getInstance();
const selectiveAnalyzer = new SelectiveAnalyzer();
const templateExpressionTracker = new TemplateExpressionTracker(null);
const freezeDetector = new FreezeDetector();
const zonePollutionDetector = ZonePollutionDetector.getInstance();

type InstrumentationStartCandidate = {
  component: string;
  score: number;
  currentStrategy: 'Default';
  factors: Array<{ name: string; weight: number; met: boolean; description: string }>;
  recommendation: string;
};

function safeInvoke(action: () => void): void {
  try {
    action();
  } catch {
    // Intentionally ignore instrumentation failures to avoid breaking page behavior.
  }
}

function forEachAngularComponent(
  limit: number,
  visitor: (component: any, index: number) => void
): void {
  const ng = (globalThis as any).ng;
  if (!ng?.getComponent) return;

  const elements = document.querySelectorAll('*');
  const effectiveLimit = Math.min(elements.length, limit);

  for (let i = 0; i < effectiveLimit; i++) {
    try {
      const component = ng.getComponent(elements[i]);
      if (!component) continue;
      visitor(component, i);
    } catch {
      continue;
    }
  }
}

function findAngularComponentByName(name: string): any | null {
  const ng = (globalThis as any).ng;
  if (!ng?.getComponent) return null;

  const elements = document.querySelectorAll('*');
  for (let i = 0; i < elements.length; i++) {
    try {
      const component = ng.getComponent(elements[i]);
      if (!component) continue;

      const componentName = component.constructor?.name ?? '';
      if (componentName === name) {
        return component;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function collectOnPushCandidates(limit: number): InstrumentationStartCandidate[] {
  const candidates: InstrumentationStartCandidate[] = [];

  forEachAngularComponent(limit, (component) => {
    const name = component.constructor?.name ?? 'Unknown';
    const cmp = component.constructor?.ɵcmp;
    if (!cmp) return;

    // Check if already using OnPush
    const isOnPush = cmp.onPush === true || cmp.changeDetection === 1;
    if (isOnPush) return;

    // Simple heuristic: count inputs
    const inputCount = cmp.inputs ? Object.keys(cmp.inputs).length : 0;

    candidates.push({
      component: name,
      score: inputCount > 0 ? 75 : 40,
      currentStrategy: 'Default',
      factors: [
        { name: 'Has inputs', weight: 0.3, met: inputCount > 0, description: `${inputCount} input(s)` },
        { name: 'Not using OnPush', weight: 0.25, met: true, description: 'Currently Default strategy' },
      ],
      recommendation: inputCount > 0
        ? 'Recommended: ChangeDetectionStrategy.OnPush'
        : 'Consider OnPush if data flows through inputs',
    });
  });

  return candidates;
}

/**
 * Handles START_TRACKING command from the panel.
 * Checks Angular version support, then starts all continuous detectors.
 */
function handleStartTracking(): void {
  // console.log('[ngLens] START_TRACKING received');
  const versionResult = checkAngularVersion();
  // console.log('[ngLens] Angular version check:', versionResult);
  if (!versionResult.supported) {
    // Emit an error back to the content script
    dispatchToContent('ERROR', {
      message: versionResult.version
        ? `Angular ${versionResult.version} is not supported. Requires Angular 17+.`
        : 'Angular not detected on this page.',
    });
    return;
  }

  safeInvoke(() => renderTracker.start());
  safeInvoke(() => leakDetector.start());
  safeInvoke(() => performanceGuard.start());
  safeInvoke(() => freezeDetector.start());
  safeInvoke(() => zonePollutionDetector.start());

  // Instrument components for template expression tracking
  safeInvoke(() => {
    forEachAngularComponent(200, (component, index) => {
      const name = component.constructor?.name ?? `Component_${index}`;
      templateExpressionTracker.instrumentComponent(component, name);
    });
  });

  // Run one-time analyzers
  try {
    const trackByIssues = trackByDetector.analyze();
    // console.log('[ngLens] TrackBy analysis:', trackByIssues.length, 'issues');
    if (trackByIssues.length > 0) {
      for (const issue of trackByIssues) {
        dispatchToContent('TRACKBY_ISSUE', issue);
      }
    }
  } catch (err) {
    // console.error('[ngLens] TrackBy analysis failed:', err);
  }

  // Run OnPush analysis using ng.getComponent (works on Angular 20)
  safeInvoke(() => {
    const analyzed = collectOnPushCandidates(500);
    for (const result of analyzed) {
      dispatchToContent('ONPUSH_RESULT', result);
    }
  });

  dispatchToContent('TRACKING_STARTED', {
    timestamp: performance.now(),
  });

  // console.log('[ngLens] Tracking started successfully');
}

/**
 * Handles STOP_TRACKING command from the panel.
 * Stops all continuous detectors.
 */
function handleStopTracking(): void {
  renderTracker.stop();
  leakDetector.stop();
  performanceGuard.stop();
  freezeDetector.stop();
  zonePollutionDetector.stop();
  templateExpressionTracker.setEnabled(false);
  dispatchToContent('TRACKING_STOPPED', {
    timestamp: performance.now(),
  });
}

/**
 * Handles SELECT_COMPONENT command from the panel.
 * Updates the SelectiveAnalyzer with the newly selected component.
 */
function handleSelectComponent(payload: { name: string } | null): void {
  const name = payload?.name ?? null;
  selectiveAnalyzer.setSelectedComponent(name);

  // Also instrument the selected component for template expression tracking
  if (name) {
    safeInvoke(() => {
      const component = findAngularComponentByName(name);
      if (component) {
        templateExpressionTracker.instrumentComponent(component, name);
      }
    });
  }
}

/**
 * Handles CLEAR_DATA command from the panel.
 * Resets all internal buffers without stopping tracking.
 */
function handleClearData(): void {
  renderTracker.clearBuffer();
  zonePollutionDetector.clear();
  // LeakDetector doesn't expose a buffer clear — it tracks live components
  // TrackByDetector and OnPushEngine are on-demand analyzers, no persistent buffer
}

/**
 * Dispatches a message to the content script via CustomEvent.
 */
function dispatchToContent<T>(type: string, payload: T): void {
  const message = {
    eventId: `orch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    payload,
  };

  globalThis.dispatchEvent(
    new CustomEvent(PAGE_TO_CONTENT_EVENT, { detail: message })
  );
}

/**
 * Handles incoming commands from the content script.
 * The content script dispatches these as CustomEvents on the CONTENT_TO_PAGE_EVENT channel.
 */
function handleCommand(event: Event): void {
  const customEvent = event as CustomEvent<{ type: string; payload?: unknown; eventId?: string }>;
  const message = customEvent.detail;
  if (!message?.type) return;

  // console.log('[ngLens orchestrator] Received command:', message.type);

  switch (message.type) {
    case 'START_TRACKING':
      handleStartTracking();
      break;
    case 'STOP_TRACKING':
      handleStopTracking();
      break;
    case 'SELECT_COMPONENT':
      handleSelectComponent(message.payload as { name: string } | null);
      break;
    case 'CLEAR_DATA':
      handleClearData();
      break;
    case 'SCAN_APP_STRUCTURE':
      handleScanAppStructure();
      break;
    default:
      // Not a command for the orchestrator — ignore
      break;
  }
}

/**
 * Handles SCAN_APP_STRUCTURE command from the panel.
 * Collects the full Angular app registry and dispatches results back.
 */
function handleScanAppStructure(): void {
  safeInvoke(() => {
    const data = collectAppStructure();
    dispatchToContent('APP_STRUCTURE_RESULT', data);
  });
}

/**
 * Initializes the orchestrator by setting up event listeners for
 * panel commands dispatched by the content script.
 */
export function initOrchestrator(): void {
  globalThis.addEventListener(CONTENT_TO_PAGE_EVENT, handleCommand);
}

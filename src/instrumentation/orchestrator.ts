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
import { OnPushEngine } from './onpush-engine';
import { PerformanceGuard } from './performance-guard';
import { SelectiveAnalyzer } from './selective-analyzer';
import { checkAngularVersion } from './version-check';

/** Event name used by the content script to dispatch commands to the page script */
const CONTENT_TO_PAGE_EVENT = '__ng_perf_to_page';

/** Event name used to send results back to the content script */
const PAGE_TO_CONTENT_EVENT = '__ng_perf_to_content';

// Module-level instances
const renderTracker = RenderTracker.getInstance();
const leakDetector = new LeakDetector();
const trackByDetector = new TrackByDetector();
const onPushEngine = new OnPushEngine();
const performanceGuard = PerformanceGuard.getInstance();
const selectiveAnalyzer = new SelectiveAnalyzer();

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

  try {
    renderTracker.start();
    // console.log('[ngLens] RenderTracker started');
  } catch (err) {
    // console.error('[ngLens] RenderTracker failed to start:', err);
  }

  try {
    leakDetector.start();
    // console.log('[ngLens] LeakDetector started');
  } catch (err) {
    // console.error('[ngLens] LeakDetector failed to start:', err);
  }

  try {
    performanceGuard.start();
    // console.log('[ngLens] PerformanceGuard started');
  } catch (err) {
    // console.error('[ngLens] PerformanceGuard failed to start:', err);
  }

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
  try {
    const ng = (globalThis as any).ng;
    if (ng?.getComponent) {
      const components = document.querySelectorAll('*');
      const limit = Math.min(components.length, 500);
      const analyzed: any[] = [];
      
      for (let i = 0; i < limit; i++) {
        try {
          const comp = ng.getComponent(components[i]);
          if (!comp) continue;
          const name = comp.constructor?.name ?? 'Unknown';
          const cmp = comp.constructor?.ɵcmp;
          if (!cmp) continue;
          
          // Check if already using OnPush
          const isOnPush = cmp.onPush === true || cmp.changeDetection === 1;
          if (isOnPush) continue;
          
          // Simple heuristic: count inputs
          const inputCount = cmp.inputs ? Object.keys(cmp.inputs).length : 0;
          
          analyzed.push({
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
        } catch { continue; }
      }
      
      // console.log('[ngLens] OnPush analysis:', analyzed.length, 'candidates');
      for (const result of analyzed) {
        dispatchToContent('ONPUSH_RESULT', result);
      }
    }
  } catch (err) {
    // console.error('[ngLens] OnPush analysis failed:', err);
  }

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
}

/**
 * Handles CLEAR_DATA command from the panel.
 * Resets all internal buffers without stopping tracking.
 */
function handleClearData(): void {
  renderTracker.clearBuffer();
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
    default:
      // Not a command for the orchestrator — ignore
      break;
  }
}

/**
 * Initializes the orchestrator by setting up event listeners for
 * panel commands dispatched by the content script.
 */
export function initOrchestrator(): void {
  globalThis.addEventListener(CONTENT_TO_PAGE_EVENT, handleCommand);
}

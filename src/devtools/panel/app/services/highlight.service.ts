import { Injectable, inject } from '@angular/core';
import { DevtoolsPortService } from './devtools-port.service';
import { componentNameToSelector, displayName } from '../utils/display-name';

/**
 * Manages overlay highlight lifecycle for click-to-highlight in the Issues Explorer.
 * Sends OVERLAY_SHOW/OVERLAY_HIDE messages via the port to the content script,
 * which relays them to the page-script overlay renderer.
 */
@Injectable({ providedIn: 'root' })
export class HighlightService {
  private activeOverlayId: string | null = null;
  private readonly portService = inject(DevtoolsPortService);

  /**
   * Highlights a component on the inspected page by sending an OVERLAY_SHOW message.
   * If a previous overlay is active, sends OVERLAY_HIDE first to clear it.
   */
  highlightComponent(componentName: string, issueType: string): void {
    // Hide previous overlay before showing a new one
    if (this.activeOverlayId) {
      this.portService.send({
        type: 'OVERLAY_HIDE',
        payload: { overlayId: this.activeOverlayId },
        timestamp: Date.now(),
      });
      this.activeOverlayId = null;
    }

    // Derive selector and display name from the raw component name
    const elementSelector = componentNameToSelector(componentName);
    const label = displayName(componentName);

    // Generate a local overlay ID for tracking
    const overlayId = `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.activeOverlayId = overlayId;

    // Send OVERLAY_SHOW to the content script via the port
    this.portService.send({
      type: 'OVERLAY_SHOW',
      payload: {
        elementSelector,
        componentName: label,
        issueType,
        severity: 'info',
        autoFadeTimeout: 0,
        zIndex: 2147483647,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Clears the currently active overlay highlight.
   */
  clearHighlight(): void {
    if (this.activeOverlayId) {
      this.portService.send({
        type: 'OVERLAY_HIDE',
        payload: { overlayId: this.activeOverlayId },
        timestamp: Date.now(),
      });
      this.activeOverlayId = null;
    }
  }
}

import { Injectable, Injector, inject } from '@angular/core';
import { PanelState } from '../state/panel.state';
import { DevtoolsPortService } from './devtools-port.service';
import type { PortMessage } from '../../../../types/port-messages';
import type { RenderEvent } from '../../../../types/render-events';
import type { LeakEvent } from '../../../../types/leak-events';
import type { TrackByIssue, OnPushScore } from '../../../../types/recommendation-events';
import type { ZonePollutionEvent } from '../../../../types/zone-pollution-events';

@Injectable({ providedIn: 'root' })
export class EventDispatcherService {
  private readonly state = inject(PanelState);
  private readonly injector = inject(Injector);

  private _portService: DevtoolsPortService | null = null;

  private get portService(): DevtoolsPortService | null {
    if (!this._portService) {
      try {
        this._portService = this.injector.get(DevtoolsPortService);
      } catch {
        return null;
      }
    }
    return this._portService;
  }

  dispatch(message: PortMessage): void {
    switch (message.type) {
      case 'EVENT_BATCH':
        this.handleEventBatch(message.payload as { events: RenderEvent[] });
        break;
      case 'LEAK_EVENT':
        this.handleLeakEvent(message.payload as LeakEvent);
        break;
      case 'TRACKBY_ISSUE':
        this.handleTrackByIssue(message.payload as TrackByIssue);
        break;
      case 'ONPUSH_RESULT':
        this.handleOnPushResult(message.payload as OnPushScore);
        break;
      case 'ZONE_POLLUTION_EVENT':
        this.handleZonePollutionEvent(message.payload as ZonePollutionEvent);
        break;
      case 'DEGRADED_MODE':
        this.state.degradedMode.set(true);
        break;
      case 'TRACKING_STARTED':
        this.state.trackingError.set(null);
        this.state.isTracking.set(true);
        break;
      case 'TRACKING_STOPPED':
        this.state.isTracking.set(false);
        break;
      case 'ERROR':
        this.handleError(message.payload as { message?: string; error?: string });
        break;
      case 'ROUTE_CHANGED':
        if (this.state.clearOnRouteChange()) {
          this.state.clearActivity();
        }
        break;
      case 'TAB_NAVIGATED':
        this.handleTabNavigated();
        break;
      case 'CONNECTION_ACK':
        this.state.connectionState.set('connected');
        break;
    }
  }

  private handleTabNavigated(): void {
    const shouldResumeTracking = this.state.isTracking();

    this.state.clearAll();
    // clearAll() resets connectionState to 'disconnected', restore it
    this.state.connectionState.set('connected');

    if (shouldResumeTracking) {
      this.state.isTracking.set(true);
      this.portService?.send({
        type: 'START_TRACKING',
        payload: null,
        timestamp: Date.now(),
      });
    }
  }

  private handleEventBatch(payload: { events: RenderEvent[] }): void {
    this.state.renderEvents.update(current => [...current, ...payload.events]);
  }

  private handleLeakEvent(payload: LeakEvent): void {
    this.state.leakEvents.update(current => [...current, payload]);
  }

  private handleTrackByIssue(payload: TrackByIssue): void {
    this.state.trackByIssues.update(current => [...current, payload]);
  }

  private handleOnPushResult(payload: OnPushScore): void {
    this.state.onPushRecommendations.update(current => [...current, payload]);
  }

  private handleError(payload: { message?: string; error?: string }): void {
    this.state.setTrackingError(
      payload.message ?? payload.error ?? 'ngLens could not start tracking this page.'
    );
  }

  private handleZonePollutionEvent(payload: ZonePollutionEvent): void {
    this.state.zonePollutionSources.set(payload.sources);
  }
}

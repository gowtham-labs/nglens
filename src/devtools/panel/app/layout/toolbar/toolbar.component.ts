import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PanelState } from '../../state/panel.state';
import { CommandService } from '../../services/command.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="h-12 flex items-center px-3 bg-gray-800 border-b border-gray-700 gap-2">
      <!-- Logo -->
      <span class="text-sm font-semibold text-gray-100 mr-4">ngLens</span>

      <!-- Navigation tabs -->
      <nav class="flex gap-1">
        <a routerLink="/overview"
           routerLinkActive="bg-gray-700 text-white"
           class="px-3 py-1.5 text-xs text-gray-400 rounded hover:text-gray-200 transition-colors">
          Overview
        </a>
        <a routerLink="/rendering"
           routerLinkActive="bg-gray-700 text-white"
           class="px-3 py-1.5 text-xs text-gray-400 rounded hover:text-gray-200 transition-colors">
          Render Inspector
        </a>
        <a routerLink="/memory"
           routerLinkActive="bg-gray-700 text-white"
           class="px-3 py-1.5 text-xs text-gray-400 rounded hover:text-gray-200 transition-colors">
          Memory
        </a>
        <a routerLink="/recommendations"
           routerLinkActive="bg-gray-700 text-white"
           class="px-3 py-1.5 text-xs text-gray-400 rounded hover:text-gray-200 transition-colors">
          Recommendations
        </a>
      </nav>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Action buttons -->
      <button
        (click)="toggleClearOnRoute()"
        class="px-2 py-1 text-xs rounded border transition-colors"
        [class]="clearOnRouteChange() ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-500'"
        title="Clear activity on route change">
        🔄 Route
      </button>
      <button
        (click)="toggleTracking()"
        class="px-2 py-1 text-xs rounded border transition-colors"
        [class]="isTracking() ? 'border-red-500 text-red-400 hover:bg-red-500/10' : 'border-green-500 text-green-400 hover:bg-green-500/10'">
        {{ isTracking() ? 'Stop' : 'Start' }}
      </button>
      <button
        (click)="clearData()"
        class="px-2 py-1 text-xs rounded border border-gray-600 text-gray-400 hover:bg-gray-700 transition-colors">
        Clear
      </button>

      <!-- Connection status indicator -->
      <span
        class="w-2 h-2 rounded-full"
        [class]="connectionDotClass()"
        [title]="connectionState()">
      </span>

      <!-- Degraded mode badge -->
      @if (degradedMode()) {
        <span class="text-xs text-amber-400 font-medium">Degraded</span>
      }
      @if (trackingError()) {
        <span class="text-xs text-red-400 font-medium truncate max-w-64" [title]="trackingError()!">
          {{ trackingError() }}
        </span>
      }
    </div>
  `,
})
export class ToolbarComponent {
  private readonly state = inject(PanelState);
  private readonly commandService = inject(CommandService);

  readonly isTracking = this.state.isTracking;
  readonly degradedMode = this.state.degradedMode;
  readonly connectionState = this.state.connectionState;
  readonly clearOnRouteChange = this.state.clearOnRouteChange;
  readonly trackingError = this.state.trackingError;

  readonly connectionDotClass = computed(() => {
    switch (this.state.connectionState()) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-red-500';
      case 'reconnecting':
        return 'bg-amber-500';
    }
  });

  toggleTracking(): void {
    const currentlyTracking = this.state.isTracking();
    if (currentlyTracking) {
      this.commandService.stopTracking();
      this.state.isTracking.set(false);
    } else {
      this.state.trackingError.set(null);
      this.commandService.startTracking();
      this.state.isTracking.set(true);
    }
  }

  toggleClearOnRoute(): void {
    this.state.clearOnRouteChange.update(v => !v);
  }

  clearData(): void {
    this.commandService.clearData();
    this.state.clearActivity();
  }
}

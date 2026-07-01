import { Component, OnDestroy, OnInit, inject, signal, effect } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { ToolbarComponent } from './layout/toolbar/toolbar.component';
import { WhyPanelComponent } from './layout/why-panel/why-panel.component';
import { DevtoolsPortService } from './services/devtools-port.service';
import { PanelState } from './state/panel.state';
import { displayName } from './utils/display-name';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div class="h-screen flex flex-col bg-gray-900 text-gray-100 font-sans">
      <!-- Toolbar: 48px -->
      <app-toolbar class="h-12 flex-shrink-0" />

      <!-- Main content area -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Routed page content: flexible -->
        <div class="flex-1 overflow-auto">
          <router-outlet />
        </div>

        <!-- Collapsible Why Panel — shown on Overview/Recommendations component selection, NOT on Render Inspector -->
        @if (selectedComponent() && !isRenderInspectorRoute()) {
          <div class="border-t border-gray-700">
            <div
              class="px-3 py-1.5 bg-gray-800 flex items-center gap-2 cursor-pointer hover:bg-gray-750 select-none"
              (click)="toggleWhyPanel()"
            >
              <span class="text-[10px] text-gray-400">{{ whyPanelExpanded() ? '▼' : '▶' }}</span>
              <span class="text-xs font-medium text-gray-300">Why Did This Render? — {{ getDisplayName(selectedComponent()!) }}</span>
            </div>
            @if (whyPanelExpanded()) {
              <app-why-panel class="block h-64 overflow-auto" />
            }
          </div>
        }
      </div>
    </div>
  `,
  imports: [RouterOutlet, ToolbarComponent, WhyPanelComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly portService = inject(DevtoolsPortService);
  private readonly state = inject(PanelState);
  private readonly router = inject(Router);

  readonly selectedComponent = this.state.selectedComponent;
  readonly whyPanelExpanded = signal(false);
  readonly getDisplayName = displayName;

  constructor() {
    effect(() => {
      this.whyPanelExpanded.set(Boolean(this.state.selectedComponent()));
    });
  }

  ngOnInit(): void {
    this.portService.connect();
  }

  ngOnDestroy(): void {}

  toggleWhyPanel(): void {
    this.whyPanelExpanded.update(v => !v);
  }

  isRenderInspectorRoute(): boolean {
    return this.router.url.includes('/rendering');
  }
}

import { Component, OnDestroy, OnInit, inject, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToolbarComponent } from './layout/toolbar/toolbar.component';
import { IssuesExplorerComponent } from './layout/issues-explorer/issues-explorer.component';
import { TimelinePanelComponent } from './layout/timeline-panel/timeline-panel.component';
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
      <div class="flex-1 flex overflow-hidden">
        <!-- Issues Explorer: 320px fixed -->
        <app-issues-explorer class="w-80 flex-shrink-0 border-r border-gray-700" />

        <!-- Right area: Page content + WhyPanel + Timeline stacked -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <!-- Routed page content: flexible -->
          <div class="flex-1 overflow-auto">
            <router-outlet />
          </div>

          <!-- Collapsible Why Panel section -->
          @if (selectedComponent()) {
            <div class="border-t border-gray-700">
              <!-- Header bar -->
              <div
                class="px-3 py-1.5 bg-gray-800 flex items-center gap-2 cursor-pointer hover:bg-gray-750 select-none"
                (click)="toggleWhyPanel()"
              >
                <span class="text-[10px] text-gray-400">{{ whyPanelExpanded() ? '▼' : '▶' }}</span>
                <span class="text-xs font-medium text-gray-300">Why Did This Render? — {{ getDisplayName(selectedComponent()!) }}</span>
              </div>
              <!-- Expanded content -->
              @if (whyPanelExpanded()) {
                <app-why-panel class="block h-64 overflow-auto" />
              }
            </div>
          }

          <!-- Resizable Activity Panel -->
          <div
            class="relative flex-shrink-0 border-t border-gray-700"
            [style.height.px]="activityPanelHeight()"
          >
            <div
              class="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-10 group touch-none"
              title="Drag to resize activity panel"
              (pointerdown)="startActivityResize($event)"
            >
              <div class="mx-auto mt-0.5 h-1 w-12 rounded bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <app-timeline-panel class="block h-full" />
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [RouterOutlet, ToolbarComponent, IssuesExplorerComponent, TimelinePanelComponent, WhyPanelComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly portService = inject(DevtoolsPortService);
  private readonly state = inject(PanelState);

  readonly selectedComponent = this.state.selectedComponent;
  readonly whyPanelExpanded = signal(false);
  readonly activityPanelHeight = signal(192);
  readonly getDisplayName = displayName;

  private readonly minActivityPanelHeight = 36;
  private readonly maxActivityPanelHeight = 420;
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private isResizingActivity = false;

  constructor() {
    // Open the explanation panel when a component is selected from Overview,
    // Recommendations, or Render Inspector.
    effect(() => {
      this.whyPanelExpanded.set(Boolean(this.state.selectedComponent()));
    });
  }

  ngOnInit(): void {
    this.portService.connect();
  }

  ngOnDestroy(): void {
    this.stopActivityResize();
  }

  toggleWhyPanel(): void {
    this.whyPanelExpanded.update(v => !v);
  }

  startActivityResize(event: PointerEvent): void {
    event.preventDefault();
    this.isResizingActivity = true;
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.activityPanelHeight();
    window.addEventListener('pointermove', this.resizeActivityPanel);
    window.addEventListener('pointerup', this.stopActivityResize, { once: true });
    window.addEventListener('pointercancel', this.stopActivityResize, { once: true });
  }

  private readonly resizeActivityPanel = (event: PointerEvent): void => {
    if (!this.isResizingActivity) return;
    const dragDelta = event.clientY - this.resizeStartY;
    const nextHeight = this.resizeStartHeight - dragDelta;
    this.activityPanelHeight.set(this.clampActivityPanelHeight(nextHeight));
  };

  private readonly stopActivityResize = (): void => {
    this.isResizingActivity = false;
    window.removeEventListener('pointermove', this.resizeActivityPanel);
    window.removeEventListener('pointerup', this.stopActivityResize);
    window.removeEventListener('pointercancel', this.stopActivityResize);
  };

  private clampActivityPanelHeight(height: number): number {
    return Math.min(
      this.maxActivityPanelHeight,
      Math.max(this.minActivityPanelHeight, Math.round(height))
    );
  }
}

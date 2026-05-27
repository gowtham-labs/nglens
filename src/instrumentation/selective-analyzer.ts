/**
 * Selective Analyzer — Deep Analysis Gating
 *
 * Controls which component receives full deep analysis (subscription
 * enumeration, signal graph inspection) versus lightweight tracking
 * (render event recording only).
 *
 * Only the component currently selected in the Panel_App receives
 * deep analysis. All other components get lightweight tracking to
 * keep instrumentation overhead under 3%.
 *
 * The Panel_App sends a SELECT_COMPONENT message to switch the
 * deep analysis target.
 */

/**
 * SelectiveAnalyzer gates expensive instrumentation operations.
 *
 * Usage:
 *   const analyzer = new SelectiveAnalyzer();
 *   analyzer.setSelectedComponent('AppHeader');
 *
 *   // In RenderTracker / LeakDetector hot paths:
 *   if (analyzer.shouldDeepAnalyze(componentName)) {
 *     // Full subscription enumeration, signal graph inspection
 *   } else {
 *     // Lightweight: render event recording only
 *   }
 */
export class SelectiveAnalyzer {
  private selectedComponent: string | null = null;

  /**
   * Sets the component that should receive deep analysis.
   * Pass null to disable deep analysis for all components.
   *
   * Called when the Panel_App sends a SELECT_COMPONENT message.
   */
  setSelectedComponent(name: string | null): void {
    this.selectedComponent = name;
  }

  /**
   * Returns the name of the currently selected component,
   * or null if no component is selected.
   */
  getSelectedComponent(): string | null {
    return this.selectedComponent;
  }

  /**
   * Returns true if the given component is the currently selected one.
   */
  isSelected(componentName: string): boolean {
    return this.selectedComponent === componentName;
  }

  /**
   * Returns true if the given component should receive deep analysis
   * (full subscription enumeration, signal graph inspection).
   *
   * Only the selected component gets deep analysis. All others
   * receive lightweight tracking (render event recording only).
   */
  shouldDeepAnalyze(componentName: string): boolean {
    return this.selectedComponent !== null && this.selectedComponent === componentName;
  }
}

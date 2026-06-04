import { Injectable } from '@angular/core';

/**
 * Service responsible for generating syntactically valid TypeScript/Angular code snippets
 * for each recommendation type. Snippets include inline comments explaining the fix.
 */
@Injectable({ providedIn: 'root' })
export class CodeSnippetService {
  /**
   * Generates an OnPush change detection strategy snippet.
   * Includes import statement, decorator property, and explanatory comment.
   *
   * @param componentName - The component name (uses 'YourComponent' if empty/null)
   * @returns Formatted TypeScript code snippet with 2-space indentation
   */
  generateOnPushSnippet(componentName: string): string {
    const name = componentName?.trim() || 'YourComponent';

    return [
      `// Add this to your @Component decorator`,
      `import { ChangeDetectionStrategy } from '@angular/core';`,
      ``,
      `@Component({`,
      `  selector: 'app-${this.toKebabCase(name)}',`,
      `  changeDetection: ChangeDetectionStrategy.OnPush`,
      `})`,
      `export class ${name} {}`,
    ].join('\n');
  }

  /**
   * Generates a trackBy function snippet for *ngFor optimization.
   * Includes the trackBy function, component class comment, and template usage example.
   *
   * @param collectionProperty - The name of the collection property used in *ngFor
   * @returns Formatted TypeScript code snippet
   */
  generateTrackBySnippet(collectionProperty: string): string {
    const property = collectionProperty?.trim() || 'items';

    return [
      `// Add this to your component class`,
      `trackBy = (index: number, item: any) => item.id;`,
      ``,
      `// In template: *ngFor="let item of ${property}; trackBy: trackBy"`,
    ].join('\n');
  }

  /**
   * Generates a subscription leak fix snippet.
   * Provides both modern (Angular 16+ takeUntilDestroyed) and legacy (takeUntil + Subject) patterns.
   *
   * @param leakType - The type of leak (e.g., 'subscription', 'interval')
   * @param source - The source observable causing the leak
   * @returns Formatted TypeScript code snippet with both patterns
   */
  generateLeakFixSnippet(leakType: string, source: string): string {
    const safeSource = source?.trim() || 'myObservable$';

    const modern = [
      `// === Modern Angular (16+) - Recommended ===`,
      `// Use takeUntilDestroyed() for automatic cleanup`,
      `import { takeUntilDestroyed } from '@angular/core/rxjs-interop';`,
      ``,
      `// In your component constructor or field initializer:`,
      `this.${safeSource}.pipe(takeUntilDestroyed()).subscribe();`,
    ].join('\n');

    const legacy = [
      `// === Legacy Angular (≤15) - takeUntil pattern ===`,
      `// Manually manage subscription lifecycle with a Subject`,
      `import { Subject } from 'rxjs';`,
      `import { takeUntil } from 'rxjs/operators';`,
      ``,
      `private destroy$ = new Subject<void>();`,
      ``,
      `ngOnInit() {`,
      `  this.${safeSource}.pipe(takeUntil(this.destroy$)).subscribe();`,
      `}`,
      ``,
      `ngOnDestroy() {`,
      `  this.destroy$.next();`,
      `  this.destroy$.complete();`,
      `}`,
    ].join('\n');

    return [
      `// Fix for ${leakType} leak from: ${safeSource}`,
      `// Choose the pattern that matches your Angular version`,
      ``,
      modern,
      ``,
      legacy,
    ].join('\n');
  }

  /**
   * Generates a zone pollution fix snippet using runOutsideAngular.
   * Shows how to inject NgZone and run code outside Angular's zone.
   *
   * @param source - The source causing zone pollution
   * @param fixSuggestion - Optional specific fix suggestion
   * @returns Formatted TypeScript code snippet
   */
  generateZonePollutionSnippet(source: string, fixSuggestion?: string): string {
    const safeSource = source?.trim() || 'unknownSource';
    const suggestion = fixSuggestion?.trim();

    const lines = [
      `// Fix zone pollution caused by: ${safeSource}`,
      `// Run this code outside Angular's zone to prevent unnecessary change detection`,
      `import { NgZone } from '@angular/core';`,
      ``,
      `constructor(private ngZone: NgZone) {}`,
      ``,
      `// Wrap the problematic code with runOutsideAngular:`,
      `this.ngZone.runOutsideAngular(() => {`,
      `  // ${suggestion || `Move ${safeSource} logic here`}`,
      `  // When you need to update the UI, use:`,
      `  // this.ngZone.run(() => { /* update UI state */ });`,
      `});`,
    ];

    return lines.join('\n');
  }

  /**
   * Converts a PascalCase or camelCase component name to kebab-case.
   */
  private toKebabCase(name: string): string {
    return name
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }
}

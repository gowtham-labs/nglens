import { describe, it, expect } from 'vitest';
import { CodeSnippetService } from './code-snippet.service';

describe('CodeSnippetService', () => {
  const service = new CodeSnippetService();

  describe('generateOnPushSnippet', () => {
    it('should include ChangeDetectionStrategy import', () => {
      const snippet = service.generateOnPushSnippet('MyComponent');
      expect(snippet).toContain("import { ChangeDetectionStrategy } from '@angular/core'");
    });

    it('should include OnPush in decorator', () => {
      const snippet = service.generateOnPushSnippet('MyComponent');
      expect(snippet).toContain('changeDetection: ChangeDetectionStrategy.OnPush');
    });

    it('should use the provided component name', () => {
      const snippet = service.generateOnPushSnippet('ProductCardComponent');
      expect(snippet).toContain('export class ProductCardComponent');
    });

    it('should convert component name to kebab-case for selector', () => {
      const snippet = service.generateOnPushSnippet('ProductCardComponent');
      expect(snippet).toContain("selector: 'app-product-card-component'");
    });

    it('should use placeholder when component name is empty', () => {
      const snippet = service.generateOnPushSnippet('');
      expect(snippet).toContain('export class YourComponent');
    });

    it('should use placeholder when component name is whitespace', () => {
      const snippet = service.generateOnPushSnippet('   ');
      expect(snippet).toContain('export class YourComponent');
    });

    it('should include explanatory comment', () => {
      const snippet = service.generateOnPushSnippet('Test');
      expect(snippet).toContain('// Add this to your @Component decorator');
    });

    it('should use 2-space indentation', () => {
      const snippet = service.generateOnPushSnippet('Test');
      expect(snippet).toContain('  changeDetection:');
      expect(snippet).toContain('  selector:');
    });
  });

  describe('generateTrackBySnippet', () => {
    it('should include trackBy function definition', () => {
      const snippet = service.generateTrackBySnippet('products');
      expect(snippet).toContain('trackBy = (index: number, item: any) => item.id;');
    });

    it('should include template usage example with collection name', () => {
      const snippet = service.generateTrackBySnippet('products');
      expect(snippet).toContain('*ngFor="let item of products; trackBy: trackBy"');
    });

    it('should use default collection name when empty', () => {
      const snippet = service.generateTrackBySnippet('');
      expect(snippet).toContain('*ngFor="let item of items; trackBy: trackBy"');
    });

    it('should include component class comment', () => {
      const snippet = service.generateTrackBySnippet('items');
      expect(snippet).toContain('// Add this to your component class');
    });
  });

  describe('generateLeakFixSnippet', () => {
    it('should include modern Angular pattern with takeUntilDestroyed', () => {
      const snippet = service.generateLeakFixSnippet('subscription', 'data$');
      expect(snippet).toContain('takeUntilDestroyed');
      expect(snippet).toContain("import { takeUntilDestroyed } from '@angular/core/rxjs-interop'");
    });

    it('should include legacy Angular pattern with takeUntil + Subject', () => {
      const snippet = service.generateLeakFixSnippet('subscription', 'data$');
      expect(snippet).toContain('takeUntil(this.destroy$)');
      expect(snippet).toContain('private destroy$ = new Subject<void>()');
      expect(snippet).toContain('this.destroy$.next()');
      expect(snippet).toContain('this.destroy$.complete()');
    });

    it('should include the source observable name', () => {
      const snippet = service.generateLeakFixSnippet('subscription', 'userService.getUsers');
      expect(snippet).toContain('this.userService.getUsers.pipe(takeUntilDestroyed())');
      expect(snippet).toContain('this.userService.getUsers.pipe(takeUntil(this.destroy$))');
    });

    it('should include leak type in header comment', () => {
      const snippet = service.generateLeakFixSnippet('timer', 'polling$');
      expect(snippet).toContain('Fix for timer leak from: polling$');
    });

    it('should use placeholder when source is empty', () => {
      const snippet = service.generateLeakFixSnippet('subscription', '');
      expect(snippet).toContain('myObservable$');
    });

    it('should include ngOnDestroy lifecycle hook in legacy pattern', () => {
      const snippet = service.generateLeakFixSnippet('subscription', 'obs$');
      expect(snippet).toContain('ngOnDestroy()');
    });
  });

  describe('generateZonePollutionSnippet', () => {
    it('should include NgZone import', () => {
      const snippet = service.generateZonePollutionSnippet('Chart.js');
      expect(snippet).toContain("import { NgZone } from '@angular/core'");
    });

    it('should include runOutsideAngular wrapper', () => {
      const snippet = service.generateZonePollutionSnippet('Chart.js');
      expect(snippet).toContain('this.ngZone.runOutsideAngular(() => {');
    });

    it('should include NgZone constructor injection', () => {
      const snippet = service.generateZonePollutionSnippet('Chart.js');
      expect(snippet).toContain('constructor(private ngZone: NgZone)');
    });

    it('should include source in comment', () => {
      const snippet = service.generateZonePollutionSnippet('Chart.js');
      expect(snippet).toContain('Fix zone pollution caused by: Chart.js');
    });

    it('should include fix suggestion when provided', () => {
      const snippet = service.generateZonePollutionSnippet('Chart.js', 'Initialize chart outside zone');
      expect(snippet).toContain('Initialize chart outside zone');
    });

    it('should use default suggestion when fixSuggestion is not provided', () => {
      const snippet = service.generateZonePollutionSnippet('socket.io');
      expect(snippet).toContain('Move socket.io logic here');
    });

    it('should use placeholder when source is empty', () => {
      const snippet = service.generateZonePollutionSnippet('');
      expect(snippet).toContain('unknownSource');
    });

    it('should include ngZone.run() comment for UI updates', () => {
      const snippet = service.generateZonePollutionSnippet('lib');
      expect(snippet).toContain('this.ngZone.run(() => { /* update UI state */ })');
    });
  });
});

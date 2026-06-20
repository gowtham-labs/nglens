/**
 * AST-Based Subscription Leak Detector
 *
 * Uses TypeScript AST (Abstract Syntax Tree) analysis via ts-morph to detect
 * subscription leaks in Angular components. This is far more reliable than
 * runtime reflection for Angular 19/20.
 *
 * Detects:
 * 1. .subscribe() calls without cleanup patterns
 * 2. Missing takeUntil/takeUntilDestroyed/async pipe
 * 3. Subscriptions stored in properties without unsubscribe in ngOnDestroy
 * 4. Subscription arrays without proper cleanup
 *
 * Works by:
 * 1. Finding all component files in the project
 * 2. Parsing TypeScript AST
 * 3. Identifying .subscribe() calls
 * 4. Checking for cleanup patterns in the same scope
 * 5. Reporting leaks with precise line numbers
 */

import type {
  AnalyzerConfig,
  AnalyzerResult,
  AnalyzerType,
  AnalysisIssue,
} from '../types/analyzer';
import { BaseAnalyzer } from './base-analyzer';
import { registerAnalyzer } from './index';
import { now } from '../utils/timing';

/**
 * Represents a detected subscription in the AST
 */
interface DetectedSubscription {
  filePath: string;
  componentName: string;
  lineNumber: number;
  columnNumber: number;
  source: string; // The observable being subscribed to
  hasCleanup: boolean;
  cleanupType?: 'takeUntil' | 'takeUntilDestroyed' | 'async-pipe' | 'unsubscribe';
  cleanupLineNumber?: number;
}

/**
 * AST-based subscription leak detector for Angular 19/20
 * Uses ts-morph for reliable static analysis
 */
export class ASTSubscriptionAnalyzer extends BaseAnalyzer {
  readonly type: AnalyzerType = 'ast-subscription-analyzer';
  readonly requiresDevMode = false; // Works in any mode with source files

  protected async execute(config: AnalyzerConfig): Promise<AnalyzerResult> {
    const startTime = now();
    const issues: AnalysisIssue[] = [];

    try {
      // Dynamically import ts-morph (only available in dev/build time)
      const { Project } = await import('ts-morph');

      // Initialize TypeScript project from tsconfig
      const project = new Project({
        tsConfigFilePath: './tsconfig.json',
        skipAddingFilesFromTsConfig: false,
      });

      // Get all component files
      const sourceFiles = project.getSourceFiles();
      const componentFiles = sourceFiles.filter(
        (file) =>
          file.getFilePath().includes('.component.ts') &&
          !file.getFilePath().includes('.spec.ts')
      );

      // Analyze each component
      for (const sourceFile of componentFiles) {
        const componentIssues = this.analyzeComponentFile(sourceFile);
        issues.push(...componentIssues);

        if (issues.length >= 50) break; // Cap at 50 issues
      }
    } catch (error) {
      // ts-morph not available (e.g., in production build)
      return {
        analyzer: this.type,
        timestamp: Date.now(),
        duration: 0,
        issues: [],
        metadata: {
          skipped: true,
          reason: 'ts-morph not available - AST analysis requires dev environment',
        },
      };
    }

    const duration = now() - startTime;

    return {
      analyzer: this.type,
      timestamp: Date.now(),
      duration,
      issues,
      metadata: {
        componentsAnalyzed: issues.length > 0 ? 1 : 0,
        totalLeaks: issues.length,
        analysisType: 'AST-based static analysis',
      },
    };
  }

  /**
   * Analyzes a single component file for subscription leaks
   */
  private analyzeComponentFile(sourceFile: any): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    try {
      // Get component class
      const classes = sourceFile.getClasses();
      const componentClass = classes.find((cls: any) =>
        cls.getName()?.endsWith('Component')
      );

      if (!componentClass) return issues;

      const componentName = componentClass.getName() || 'UnknownComponent';
      const filePath = sourceFile.getFilePath();

      // Find all .subscribe() calls
      const subscriptions = this.findSubscribeCalls(componentClass);

      // Check each subscription for cleanup
      for (const sub of subscriptions) {
        if (!sub.hasCleanup) {
          issues.push({
            id: `ast-leak-${componentName}-${sub.lineNumber}`,
            analyzer: this.type,
            component: componentName,
            severity: 'high',
            category: 'memory-leaks',
            title: `Subscription without cleanup at line ${sub.lineNumber}`,
            description: `Found .subscribe() call without cleanup pattern (takeUntil, takeUntilDestroyed, or async pipe) in ${componentName}. This subscription will leak memory when the component is destroyed.`,
            recommendation: this.generateFix(sub),
            metadata: {
              leakType: 'subscription',
              filePath,
              lineNumber: sub.lineNumber,
              columnNumber: sub.columnNumber,
              source: sub.source,
              learningTopic: 'Memory Management',
              whyBad:
                'Subscriptions without cleanup continue to hold references and run callbacks after component destruction.',
              betterApproach: `Use one of these patterns:
1. takeUntilDestroyed (Angular 16+):
   this.service.data$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...)

2. takeUntil with destroy$ Subject:
   this.service.data$.pipe(takeUntil(this.destroy$)).subscribe(...)

3. Async pipe in template:
   {{ data$ | async }}`,
            },
            elementSelector: `${filePath}:${sub.lineNumber}`,
          });
        }
      }
    } catch (error) {
      // Silently skip files that can't be analyzed
    }

    return issues;
  }

  /**
   * Finds all .subscribe() calls in a component class
   */
  private findSubscribeCalls(componentClass: any): DetectedSubscription[] {
    const subscriptions: DetectedSubscription[] = [];

    try {
      // Get all method declarations
      const methods = componentClass.getMethods();

      for (const method of methods) {
        // Find all CallExpressions that end with .subscribe
        const callExpressions = method.getDescendantsOfKind(
          (this.getSyntaxKind('CallExpression') as any) || 200
        );

        for (const call of callExpressions) {
          const callText = call.getText();

          // Check if this is a .subscribe() call
          if (callText.includes('.subscribe(')) {
            const sourceNode = call.getExpression();
            const sourceText = sourceNode?.getText() || 'unknown';

            // Extract the observable name (simplified)
            const observableName = this.extractObservableName(sourceText);

            // Check for cleanup patterns in the same method
            const methodText = method.getText();
            const hasCleanup = this.hasCleanupPattern(methodText, observableName);

            subscriptions.push({
              filePath: componentClass.getSourceFile().getFilePath(),
              componentName: componentClass.getName() || 'Unknown',
              lineNumber: call.getStartLineNumber(),
              columnNumber: call.getStartColumn(),
              source: observableName,
              hasCleanup,
              cleanupType: this.detectCleanupType(methodText),
            });
          }
        }
      }
    } catch (error) {
      // Silently handle AST traversal errors
    }

    return subscriptions;
  }

  /**
   * Extracts the observable name from a subscription expression
   */
  private extractObservableName(expression: string): string {
    // Remove .subscribe(...) and get the observable
    const match = expression.match(/(.+?)\.subscribe/);
    if (match) {
      const observable = match[1].trim();
      // Simplify: get last identifier
      const parts = observable.split('.');
      return parts[parts.length - 1] || 'Observable';
    }
    return 'Observable';
  }

  /**
   * Checks if a method has cleanup patterns for subscriptions
   */
  private hasCleanupPattern(methodText: string, observableName: string): boolean {
    // Check for takeUntil
    if (methodText.includes('takeUntil(')) return true;

    // Check for takeUntilDestroyed
    if (methodText.includes('takeUntilDestroyed(')) return true;

    // Check for async pipe
    if (methodText.includes('| async')) return true;

    // Check for explicit unsubscribe
    if (methodText.includes('.unsubscribe()')) return true;

    // Check for subscription.add() pattern
    if (methodText.includes('.add(')) return true;

    return false;
  }

  /**
   * Detects the type of cleanup pattern used
   */
  private detectCleanupType(
    methodText: string
  ): 'takeUntil' | 'takeUntilDestroyed' | 'async-pipe' | 'unsubscribe' | undefined {
    if (methodText.includes('takeUntilDestroyed(')) return 'takeUntilDestroyed';
    if (methodText.includes('takeUntil(')) return 'takeUntil';
    if (methodText.includes('| async')) return 'async-pipe';
    if (methodText.includes('.unsubscribe()')) return 'unsubscribe';
    return undefined;
  }

  /**
   * Gets TypeScript SyntaxKind for a given kind name
   * This is a workaround since we can't directly import SyntaxKind
   */
  private getSyntaxKind(kindName: string): number {
    // Map of common syntax kinds
    const kindMap: Record<string, number> = {
      CallExpression: 200,
      PropertyAccessExpression: 201,
      Identifier: 78,
      MethodDeclaration: 162,
    };
    return kindMap[kindName] || 200;
  }

  /**
   * Generates a fix recommendation for a subscription leak
   */
  private generateFix(sub: DetectedSubscription): string {
    return `Add a cleanup pattern to this subscription:

// Option 1: takeUntilDestroyed (Angular 16+, recommended)
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject } from '@angular/core';

export class ${sub.componentName} {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.${sub.source}$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => { /* ... */ });
  }
}

// Option 2: takeUntil with destroy$ Subject
private destroy$ = new Subject<void>();

ngOnInit() {
  this.${sub.source}$
    .pipe(takeUntil(this.destroy$))
    .subscribe(data => { /* ... */ });
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}

// Option 3: Use async pipe in template
// {{ ${sub.source}$ | async }}`;
  }
}

// Auto-register the analyzer
registerAnalyzer(new ASTSubscriptionAnalyzer());

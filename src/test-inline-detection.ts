/**
 * Manual test to verify inline subscription leak detection.
 * 
 * This script demonstrates that the enhanced SubscriptionLeakDetector
 * can now detect inline subscriptions like: interval(1000).subscribe()
 * 
 * Run this in the browser console to test:
 * 1. Open ngLens devtools
 * 2. Navigate to a page with the TestInlineLeakComponent
 * 3. Run this test script
 * 4. Check the Memory tab - it should report 3 inline subscription leaks
 */

// Simulate the component with inline subscriptions
const testComponent = {
  ngOnInit: function() {
    // These inline subscriptions are NOT stored as properties
    // They are created but never tracked by the old detector
    
    // Inline subscription 1
    (globalThis as any).rxjs?.interval?.(1000)?.subscribe?.((value: any) => {
      console.log('Interval 1:', value);
    });

    // Inline subscription 2
    (globalThis as any).rxjs?.timer?.(0, 500)?.subscribe?.((value: any) => {
      console.log('Timer:', value);
    });

    // Inline subscription 3
    (globalThis as any).rxjs?.interval?.(2000)?.subscribe?.((value: any) => {
      console.log('Interval 2:', value);
    });
  },
};

// Test the detector
async function testInlineDetection() {
  console.log('Testing inline subscription detection...');
  
  // Mock the Angular debug API
  const mockElement = document.createElement('div');
  (globalThis as any).ng = {
    getComponent: () => testComponent,
  };

  // Import and run the detector
  try {
    const { SubscriptionLeakDetector } = await import('./analyzers/subscription-leak-detector');
    const detector = new SubscriptionLeakDetector();
    
    const result = await detector.analyze({ mode: 'development' });
    
    console.log('Detection results:');
    console.log('Total issues:', result.issues.length);
    
    const subscriptionIssues = result.issues.filter(i => 
      i.title.includes('subscription') && i.title.includes('without cleanup')
    );
    
    console.log('Subscription leak issues:', subscriptionIssues.length);
    subscriptionIssues.forEach(issue => {
      console.log(`- ${issue.title}`);
      console.log(`  Severity: ${issue.severity}`);
      console.log(`  Properties: ${(issue.metadata?.properties as string[] | undefined)?.join(', ') ?? 'N/A'}`);
    });

    if (subscriptionIssues.length > 0) {
      console.log('✅ SUCCESS: Inline subscriptions detected!');
    } else {
      console.log('❌ FAILED: Inline subscriptions not detected');
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Export for use in browser console
(globalThis as any).testInlineDetection = testInlineDetection;

console.log('Test script loaded. Run: testInlineDetection()');

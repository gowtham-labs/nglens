# Subscription Leak Detector - Test Cases

## ✅ Now Properly Handled Edge Cases

### 1. **Subscriptions in Regular Methods (Not Just ng* Hooks)**

**Before:** ❌ MISSED
```typescript
export class UserComponent {
  loadData() {
    this.api.getData().subscribe(data => this.data = data); // MISSED!
  }
}
```

**After:** ✅ DETECTED
- Scans ALL methods (up to 50 per component)
- Flags subscription in `loadData()` method
- No longer limited to `ng*` lifecycle hooks

---

### 2. **False Positives from Comments/Strings**

**Before:** ❌ FALSE POSITIVE
```typescript
ngOnInit() {
  // Don't use .subscribe() here - use async pipe
  const msg = "Remember to .subscribe() in RxJS";
}
```

**After:** ✅ CORRECTLY IGNORED
- Line-by-line analysis skips comments (`//`, `*`)
- Reduces false positives from documentation

---

### 3. **Subscription Arrays/Collections**

**Before:** ❌ MISSED VALID CLEANUP
```typescript
export class DashboardComponent {
  private subs: Subscription[] = [];

  ngOnInit() {
    this.subs.push(this.api.getData().subscribe(...));
    this.subs.push(this.api.getUsers().subscribe(...));
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe()); // Valid cleanup!
  }
}
```

**After:** ✅ CORRECTLY RECOGNIZED AS SAFE
- Detects subscription arrays
- Checks for `.forEach`, `.map` cleanup in ngOnDestroy
- No false alarm

---

### 4. **More Robust Subscription Detection**

**Before:** ❌ FALSE POSITIVE
```typescript
// Custom object that's NOT an RxJS Subscription
const fake = {
  unsubscribe() { console.log('fake'); }
};
```

**After:** ✅ CORRECTLY IGNORED
- Checks for RxJS-specific properties: `unsubscribe`, `closed`, `add`
- Reduces false positives from custom cleanup patterns

---

### 5. **takeUntil with Non-Standard Names**

**Before:** ❌ MISSED
```typescript
export class MyComponent {
  private ngUnsubscribe$ = new Subject<void>();      // Not "destroy"
  private componentDestroyed$ = new Subject<void>(); // Not "destroy"
  private stop$ = new Subject<void>();                // Not "destroy"

  ngOnInit() {
    this.data$.pipe(takeUntil(this.stop$)).subscribe(...);
  }

  ngOnDestroy() {
    this.stop$.next();
    this.stop$.complete();
  }
}
```

**After:** ✅ CORRECTLY RECOGNIZED AS SAFE
- Detects Subjects by type (has `next`, `complete`, `error`)
- Looks for broader naming patterns: "destroy", "unsubscribe", "stop", "kill", "teardown"
- Verifies Subject is used in ngOnDestroy

---

### 6. **Angular 16+ takeUntilDestroyed**

**Before:** ❌ MISSED
```typescript
export class ModernComponent {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.data$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(...);
  }
}
```

**After:** ✅ CORRECTLY RECOGNIZED AS SAFE
- Checks for `destroyRef` property
- Scans methods for `takeUntilDestroyed` string
- No false leak alert

---

### 7. **Runtime Safety: toString() Failures**

**Before:** ❌ CRASH ON NATIVE FUNCTIONS
```typescript
// Native functions, proxies, bound functions might throw
[Function: native code]
```

**After:** ✅ GRACEFUL HANDLING
- Per-method try-catch blocks
- Per-property try-catch blocks
- Continues scanning on errors
- No crashes on edge case components

---

### 8. **Performance Limits**

**Before:** ❌ SCANS 1000+ METHODS (SLOW)
```typescript
// Component with huge prototype chain
class HugeComponent {
  method1() {}
  method2() {}
  // ... 500 more methods
}
```

**After:** ✅ BOUNDED SCANNING
- Max 50 methods per component
- Max 100 properties per component
- Skips method bodies > 10KB
- Respects performance budgets

---

### 9. **Better Timer Detection**

**Before:** ❌ FRAGILE STRING MATCHING
```typescript
ngOnInit() {
  // Comment about setInterval
  const code = "setInterval(fn, 1000)";
}
```

**After:** ✅ REGEX-BASED DETECTION
- Uses `\bsetInterval\s*\(` regex (word boundary)
- Skips comment lines
- More accurate matching

---

### 10. **Subscription.add() Composition Pattern**

**Before:** ❌ FALSE POSITIVE
```typescript
export class MyComponent {
  private subs = new Subscription();

  ngOnInit() {
    this.subs.add(this.api.getData().subscribe(...));
    this.subs.add(this.api.getUsers().subscribe(...));
  }

  ngOnDestroy() {
    this.subs.unsubscribe(); // Cleans up all!
  }
}
```

**After:** ✅ CORRECTLY RECOGNIZED AS SAFE
- Detects `Subscription` property with `add()` method
- Checks for `.unsubscribe()` in ngOnDestroy
- No false alarm

---

## 🧪 Test Scenarios

### Scenario 1: Clean Component (No Leaks)
```typescript
export class CleanComponent {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.data$.pipe(takeUntil(this.destroy$)).subscribe(...);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```
**Expected:** ✅ NO ISSUES DETECTED

---

### Scenario 2: Multiple Leak Types
```typescript
export class LeakyComponent {
  ngOnInit() {
    this.api.getData().subscribe(...);           // LEAK 1
    setInterval(() => this.poll(), 1000);        // LEAK 2
    window.addEventListener('resize', () => {}); // LEAK 3
  }
  // No ngOnDestroy!
}
```
**Expected:** ❌ 3 ISSUES DETECTED
- Subscription leak (severity: medium)
- Timer leak (severity: high)
- Event listener leak (severity: medium)

---

### Scenario 3: Async Pipe (Good Pattern)
```typescript
export class AsyncComponent {
  data$ = this.api.getData();
  // template: {{ data$ | async }}
}
```
**Expected:** ✅ NO ISSUES DETECTED
- No `.subscribe()` calls in component
- Observable property detected
- Async pipe handles cleanup

---

### Scenario 4: Mixed (Some Clean, Some Leaky)
```typescript
export class MixedComponent {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Clean
    this.clean$.pipe(takeUntil(this.destroy$)).subscribe(...);

    // Leak
    this.leaky$.subscribe(...);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```
**Expected:** ❌ 1 ISSUE DETECTED (net leak count)
- Detects the leaky subscription
- Recognizes the clean one with takeUntil

---

### Scenario 5: Subscription Array with Cleanup
```typescript
export class ArrayComponent {
  private subs: Subscription[] = [];

  ngOnInit() {
    this.subs.push(this.api.getData().subscribe(...));
    this.subs.push(this.api.getUsers().subscribe(...));
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }
}
```
**Expected:** ✅ NO ISSUES DETECTED
- Recognizes subscription array pattern
- Detects `.forEach(s => s.unsubscribe())` cleanup

---

### Scenario 6: Large Component (Performance Test)
```typescript
export class HugeComponent {
  method1() {}
  method2() {}
  // ... 200 methods total
  method200() {
    this.api.getData().subscribe(...); // Leak in method #200
  }
}
```
**Expected:** ✅ COMPLETES WITHOUT TIMEOUT
- Stops scanning at method 50
- May miss leak in method #200 (acceptable tradeoff)
- Respects performance budget

---

### Scenario 7: toString() Failure (Edge Case)
```typescript
export class ProxyComponent {
  // Proxied methods that throw on .toString()
  [Symbol.for('special')]() {}
}
```
**Expected:** ✅ NO CRASH
- Catches toString() errors
- Continues scanning other methods
- Returns partial results

---

## 📊 Summary of Improvements

| Edge Case | Before | After |
|-----------|--------|-------|
| Scans all methods (not just ng*) | ❌ | ✅ |
| Skips comments/strings | ❌ | ✅ |
| Detects subscription arrays | ❌ | ✅ |
| Robust Subscription type check | ❌ | ✅ |
| takeUntil with any Subject name | ❌ | ✅ |
| takeUntilDestroyed (Angular 16+) | ❌ | ✅ |
| Safe toString() handling | ❌ | ✅ |
| Performance limits | ❌ | ✅ |
| Better regex patterns | ❌ | ✅ |
| Subscription.add() pattern | ❌ | ✅ |

---

## 🚀 How to Test

1. **Create test components** in an Angular app with various leak patterns
2. **Load ngLens extension** in Chrome
3. **Navigate to the test app**
4. **Open ngLens popup** and run analysis
5. **Verify** that leaks are detected and clean patterns are not flagged

### Test App Setup
```bash
ng new nglens-test-app
cd nglens-test-app

# Create test components
ng g c clean-component
ng g c leaky-component
ng g c mixed-component
ng g c array-cleanup-component

# Implement test scenarios in each component
# Run app: ng serve
# Load ngLens and test
```

---

## 🐛 Known Remaining Limitations

1. **Subscriptions in class field initializers** - Hard to detect without AST parsing
   ```typescript
   private dataSub = this.api.getData().subscribe(...);
   ```

2. **Nested subscriptions** - Not flagged as critical anti-pattern yet
   ```typescript
   this.api.getUser().subscribe(user => {
     this.api.getOrders(user.id).subscribe(...); // Anti-pattern
   });
   ```

3. **Base class subscriptions** - Doesn't walk prototype chain to parent classes

4. **Template analysis** - Can't detect `| async` usage to reduce false positives further

5. **Method scanning limit** - Components with 100+ methods might have undetected leaks past method #50

These are **acceptable tradeoffs** for V1. They can be addressed in future iterations.

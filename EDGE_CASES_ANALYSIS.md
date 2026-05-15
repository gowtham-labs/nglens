# Subscription Leak Detector - Edge Cases Analysis

## 🔴 Critical Issues Found

### 1. **Only Scans Lifecycle Hooks (Line 374)**
```typescript
// CURRENT CODE - WRONG
if (methodName.startsWith('ng') || methodName === 'constructor') {
```

**Problem:** Misses subscriptions in regular methods like:
```typescript
loadData() { this.api.getData().subscribe(...) }  // MISSED!
fetchUsers() { this.users$.subscribe(...) }       // MISSED!
```

**Fix:** Scan ALL methods, not just lifecycle hooks.

---

### 2. **Regex False Positives (Line 380)**
```typescript
// CURRENT CODE - FRAGILE
const subscribeMatches = methodStr.match(/\.subscribe\s*\(/g);
```

**Problem:** Matches `.subscribe()` in:
- Comments: `// Don't use .subscribe() here`
- Strings: `const msg = "Use .subscribe() method"`
- Other objects: `myCustomObj.subscribe()`

**Fix:** More context-aware detection + check for RxJS imports.

---

### 3. **Weak Subscription Object Detection (Line 394)**
```typescript
// CURRENT CODE - TOO BROAD
if (value && typeof value.unsubscribe === 'function') {
```

**Problem:** Any object with `unsubscribe()` method matches, including:
```typescript
// Custom unsubscribe pattern (not RxJS)
const custom = { unsubscribe() { console.log('bye'); } };
```

**Fix:** Check for RxJS Subscription properties (closed, add, remove).

---

### 4. **Missing Async Pipe Detection**
**Problem:** Flags components using async pipe (which is GOOD, no leak):
```typescript
// template: {{ data$ | async }}  
// No .subscribe() in component, but might flag Observable properties
```

**Fix:** Check for `| async` in template or Observable properties without subscribe.

---

### 5. **Misses Subscription Arrays/Collections**
```typescript
// CURRENT CODE MISSES THIS
private subs: Subscription[] = [];

ngOnInit() {
  this.subs.push(this.api.getData().subscribe(...));
  this.subs.push(this.api.getUsers().subscribe(...));
}

ngOnDestroy() {
  this.subs.forEach(s => s.unsubscribe()); // Proper cleanup!
}
```

**Fix:** Detect array/collection cleanup patterns.

---

### 6. **takeUntil Pattern Detection Too Narrow**
```typescript
// CURRENT CODE ONLY LOOKS FOR "destroy" or "unsubscribe" in name
// Misses these valid patterns:
private ngUnsubscribe$ = new Subject();      // MISSED
private componentDestroyed$ = new Subject(); // MISSED  
private stop$ = new Subject();                // MISSED
```

**Fix:** Check for Subject type + usage in takeUntil.

---

### 7. **No Protection Against toString() Failures**
```typescript
// CURRENT CODE - CAN THROW
const methodStr = method.toString();
```

**Problem:** Native functions, proxies, or bound functions might fail:
```typescript
// Native code
[Function: native code]

// Minified/obfuscated
[Function]
```

**Fix:** Wrap in try-catch per method.

---

### 8. **Performance: No Limits on Method Scanning**
**Problem:** A component with 100 methods scans all of them, calling `.toString()` each time.

**Fix:** Limit methods scanned (e.g., max 50 methods per component).

---

### 9. **Doesn't Check ngOnDestroy for takeUntil Cleanup**
```typescript
// Valid cleanup but not detected:
ngOnDestroy() {
  this.destroy$.next();    // Triggers takeUntil cleanup
  this.destroy$.complete();
}
```

**Fix:** Check for `.next()` and `.complete()` calls in ngOnDestroy.

---

### 10. **Misses Subscriptions in Class Field Initializers**
```typescript
export class MyComponent {
  // Subscription created at class level - MISSED!
  private dataSub = this.api.getData().subscribe(d => this.data = d);
}
```

**Fix:** Check class field initializers (harder, requires AST parsing or pattern matching).

---

## 🟡 Medium Priority Issues

### 11. **No Check for Conditional Subscriptions**
```typescript
ngOnInit() {
  if (this.shouldLoad) {
    this.api.getData().subscribe(...); // Only sometimes leaks
  }
}
```

**Fix:** Flag all subscriptions regardless of conditionals.

---

### 12. **Doesn't Detect Nested Subscriptions (Anti-pattern)**
```typescript
// BAD: Subscribe inside subscribe (LEAK + anti-pattern)
this.api.getUser().subscribe(user => {
  this.api.getOrders(user.id).subscribe(orders => {
    this.orders = orders;
  });
});
```

**Fix:** Count nested subscribes, flag as critical anti-pattern.

---

### 13. **Base Class Subscriptions**
```typescript
export class BaseComponent {
  ngOnInit() {
    this.commonData$.subscribe(...); // In base class
  }
}

export class ChildComponent extends BaseComponent {
  // Inherits subscription leak from base!
}
```

**Fix:** Walk prototype chain to base classes.

---

### 14. **Subscriptions in Callbacks/Closures**
```typescript
setTimeout(() => {
  this.api.getData().subscribe(...); // MISSED (not in ng* method)
}, 1000);
```

**Fix:** Already fixed by scanning all methods, but need to detect arrow functions in method bodies.

---

### 15. **Angular 16+ takeUntilDestroyed Pattern**
```typescript
// Modern Angular pattern - VALID, no leak
private destroyRef = inject(DestroyRef);

ngOnInit() {
  this.data$.pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(...);
}
```

**Fix:** Check for `takeUntilDestroyed` string in method body.

---

## 🟢 Low Priority / Nice-to-Have

### 16. **Doesn't Suggest async Pipe as Best Option**
**Fix:** Rank recommendations: async pipe > takeUntilDestroyed > Subject pattern > manual unsubscribe.

### 17. **No Detection of .add() for Subscription Composition**
```typescript
// Valid pattern
private subs = new Subscription();
ngOnInit() {
  this.subs.add(this.api.getData().subscribe(...));
}
ngOnDestroy() {
  this.subs.unsubscribe(); // Cleans up all added subscriptions
}
```

**Fix:** Detect `.add()` pattern as valid cleanup.

### 18. **TypeScript Decorator Metadata**
Some decorators auto-handle cleanup - not detectable without decorator inspection.

---

## 🔧 Recommended Fixes Priority

**P0 (Critical - Fix Now):**
1. Scan ALL methods, not just ng*
2. Improve takeUntil detection (check ngOnDestroy for .next())
3. Detect subscription arrays/collections
4. Add try-catch per method for toString()

**P1 (High - Fix Soon):**
5. Better regex for .subscribe (avoid comments/strings)
6. Check for takeUntilDestroyed pattern
7. Detect .add() composition pattern
8. Set limits on method scanning

**P2 (Medium - Later):**
9. Detect nested subscriptions (anti-pattern)
10. Walk prototype chain for base classes
11. Improve Subscription object detection

**P3 (Low - Nice to have):**
12. Template analysis for async pipe
13. Class field initializer detection
14. Better fix ranking

# Contributing to ngLens

Thank you for your interest in contributing to ngLens! We welcome contributions from the community.

## Code of Conduct

Be respectful, inclusive, and professional. We're all here to build great tools for Angular developers.

## Getting Started

1. **Fork the repository**
   ```bash
   gh repo fork gowtham-labs/nglens
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ngLens.git
   cd ngLens
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Make your changes**
   - Follow our coding standards (see below)
   - Add tests if applicable
   - Update documentation

6. **Test your changes**
   ```bash
   npm run build
   # Load extension in Chrome and test manually
   ```

7. **Commit with signed commits**
   ```bash
   git config commit.gpgsign true
   git commit -S -m "feat: add new analyzer"
   ```

8. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub
   ```

## Coding Standards

### TypeScript Style

- Use TypeScript strict mode
- Prefer interfaces over types
- Use descriptive variable names
- Add JSDoc comments for public APIs

```typescript
/**
 * Analyzes component for performance issues
 * @param element - The DOM element to analyze
 * @returns Array of detected issues
 */
function analyzeComponent(element: Element): AnalysisIssue[] {
  // ...
}
```

### File Headers

All source files must include copyright header:

```typescript
/**
 * ngLens - Angular Performance Analyzer
 * Copyright (c) 2026 ngLens Contributors
 * Licensed under GPL v3
 * 
 * https://github.com/gowtham-labs/nglens
 */
```

### Security

**CRITICAL:** Never commit:
- API keys
- Passwords
- Private keys
- Tokens
- Credentials

Check before committing:
```bash
git diff --staged  # Review your changes
git secrets --scan  # If you have git-secrets installed
```

### Code Organization

```
src/
├── analyzers/     # Each analyzer is self-contained
├── types/         # Shared TypeScript interfaces
├── utils/         # Helper functions
├── content/       # Content scripts
├── background/    # Background worker
└── popup/         # UI components
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add signals analyzer
fix: resolve memory leak in DOM scanner
docs: update README with new features
refactor: simplify overlay renderer
test: add tests for subscription leak detector
chore: update dependencies
security: patch XSS vulnerability
```

## Pull Request Process

1. **Ensure PR is focused**
   - One feature/fix per PR
   - Keep changes minimal and relevant

2. **Update documentation**
   - README.md if adding features
   - JSDoc comments for new functions
   - CHANGELOG.md entry

3. **Add tests** (if applicable)
   - Unit tests for logic
   - Manual testing checklist in PR description

4. **Fill out PR template**
   - What: Describe your changes
   - Why: Explain the motivation
   - Testing: How you tested it

5. **Request review**
   - Tag maintainers
   - Be responsive to feedback

## Security Contributions

Found a security vulnerability? **DO NOT** create a public PR.

Instead:
1. Email: [security-email]
2. Include: Description, impact, steps to reproduce
3. Wait for acknowledgment before disclosure

See [SECURITY.md](./SECURITY.md) for details.

## Adding New Analyzers

1. **Create analyzer file**
   ```typescript
   // src/analyzers/my-analyzer.ts
   import { registerAnalyzer } from './index';
   
   class MyAnalyzer implements Analyzer {
     readonly type = 'my-analyzer';
     readonly name = 'My Analyzer';
     readonly description = 'Detects...';
     
     async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
       // Implementation
     }
   }
   
   registerAnalyzer(new MyAnalyzer());
   ```

2. **Register in page-script.ts**
   ```typescript
   import '../analyzers/my-analyzer';
   ```

3. **Add tests and documentation**

4. **Submit PR**

## Performance Guidelines

Keep ngLens performant:
- Max 3% CPU usage
- Max 50MB memory
- Scan completes in <5 seconds
- No blocking operations

Test performance:
```typescript
const start = performance.now();
// Your code
const duration = performance.now() - start;
console.log(`Took ${duration}ms`);
```

## Testing Checklist

Manual testing required for PRs:

- [ ] Extension builds successfully (`npm run build`)
- [ ] Works on Angular 16+ apps
- [ ] Works on Angular 12-15 apps (if applicable)
- [ ] Works in dev mode (window.ng available)
- [ ] Works in production mode (no window.ng)
- [ ] No console errors
- [ ] Overlays display correctly
- [ ] Performance score calculates properly
- [ ] All permissions minimal and justified

## Documentation

Update these files when relevant:
- `README.md` - User-facing features
- `CHANGELOG.md` - All changes
- JSDoc comments - API documentation
- `SECURITY.md` - Security considerations

## Dependency Management

- Run `npm audit` before adding dependencies
- Pin exact versions in package.json
- Justify why dependency is needed
- Prefer zero-dependency solutions

## License

By contributing, you agree:
- Your code is licensed under GPL v3
- You have rights to contribute the code
- You waive any patent claims

## Questions?

- GitHub Discussions: https://github.com/gowtham-labs/nglens/discussions
- Issues: https://github.com/gowtham-labs/nglens/issues
- Email: gowthamdevlabs@gmail.com

## Recognition

Contributors will be:
- Listed in CHANGELOG
- Credited in release notes
- Given Contributor badge
- Thanked profusely!

Thank you for making ngLens better! 🎉

# ngLens

**Find Angular performance problems and learn how to fix them.**

ngLens is a Chrome Extension that analyzes Angular applications at runtime, identifies performance issues, and teaches you how to fix them — whether you're a junior developer learning Angular or a senior architect optimizing at scale.

## Features (V1)

- **Angular Detection** — Automatically detects Angular apps in both development and production mode
- **Change Detection Analysis** — Flags Default change detection, missing `OnPush`, and `*ngFor` without `trackBy`
- **Unnecessary Re-render Detection** — Identifies excessive DOM mutation frequency, render bottlenecks, and template anti-patterns
- **Memory Leak Detection** — Finds leaked subscriptions, unmanaged timers, and DOM listeners
- **RxJS Subscription Leak Detector** — Detects subscriptions without cleanup and recommends `takeUntil`, `takeUntilDestroyed`, or `async` pipe usage
- **Bundle/Lazy-loading Guidance** — Highlights initial load risk areas and lazy loading/bundle size improvement opportunities
- **Zone.js Overhead Awareness** — Supports Zone-trigger and async-change-detection heuristics for Angular apps
- **Slow Initial Load Insights** — Uses DOM and component tree heuristics to surface slow startup patterns
- **Large Component Tree Detection** — Flags large tree depth and excessive DOM subtree size that hurt rendering performance
- **Signals Analyzer** ⚡ NEW — Detects Angular 16+ Signals issues like expensive computed signals, improper signal usage, and Signal/RxJS mixing
- **State Management & Best Practices** — Calls out poor state management patterns and common Angular anti-patterns
- **Performance Budget** — Self-monitors to stay under 3% CPU and 50MB memory
- **Production Heuristics** — Works without `window.ng` using DOM attribute analysis

## Privacy

All analysis is performed locally in your browser. No data leaves your machine. See [PRIVACY.md](./PRIVACY.md) for details.

## Security

ngLens takes security seriously:

- ✅ **MIT Licensed** - Permissive open-source license
- ✅ **Minimal Permissions** - Only activeTab, scripting, tabs, storage
- ✅ **Content Security Policy** - Strict CSP prevents code injection
- ✅ **No Network Access** - All code runs locally, zero external requests
- ✅ **Open Source** - Fully auditable code
- ✅ **Signed Extension** - Verified publisher on Chrome Web Store

Found a security issue? See [SECURITY.md](./SECURITY.md) for reporting.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Important:**
- This project uses the MIT License
- The "ngLens" name and logo are trademark protected (see [TRADEMARK.md](./TRADEMARK.md))
- Follow secure coding practices
- Sign your commits

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Output is in dist/ — load as unpacked extension in Chrome
```

## Load in Chrome

1. Run `npm run build`
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## Architecture

```
src/
├── types/          # Shared TypeScript interfaces
├── utils/          # DOM helpers, serialization, timing, sampling, privacy
├── analyzers/      # Modular analyzer plugins (self-registering)
├── background/     # Service worker (message routing, tab state)
├── content/        # Content script (message bridge, page-script injection)
└── popup/          # Extension popup UI
```

## Tech Stack

- TypeScript
- Vite (build)
- Chrome Extension Manifest V3
- Content Script + Page Script architecture (isolated world ↔ main world)

## Roadmap

- **V1** (current): Detection, scoring, DOM analysis, action items, overlay, learning mode
- **V2**: CD profiler, Zone.js profiler, FPS monitor, interaction latency, DevTools panel
- **V3**: Architecture smells, regression detection, Signals migration, memory monitoring

## License

MIT

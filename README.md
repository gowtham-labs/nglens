# ngLens

**Find Angular performance problems and learn how to fix them.**

ngLens is a Chrome Extension that analyzes Angular applications at runtime, identifies performance issues, and teaches you how to fix them — whether you're a junior developer learning Angular or a senior architect optimizing at scale.

## Features (V1)

- **Angular Detection** — Automatically detects Angular apps in both development and production mode
- **Performance Score** — Weighted 0-100 score based on change detection strategy, tree depth, template complexity, and bottlenecks
- **DOM Inspector** — Detects excessive DOM complexity, layout thrashing potential, and render bottlenecks
- **Production Heuristics** — Works without `window.ng` using DOM attribute analysis
- **OnPush Detection** — Identifies components using Default change detection
- **trackBy Detection** — Finds `*ngFor` directives missing `trackBy` functions
- **Best Practices** — Detects template function calls and common anti-patterns
- **Performance Budget** — Self-monitors to stay under 3% CPU and 50MB memory

## Privacy

All analysis is performed locally in your browser. No data leaves your machine. See [PRIVACY.md](./PRIVACY.md) for details.

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

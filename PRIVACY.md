# Privacy Policy — ngLens

## Summary

The ngLens Chrome Extension performs **all analysis locally** within your browser. No data ever leaves your machine.

## Privacy Guarantees

### No Data Exfiltration

- No data is transmitted to any external server
- No data leaves the browser under any circumstances
- All scan results remain in local session storage only

### No Analytics or Telemetry

- No usage analytics are collected
- No telemetry data is gathered or transmitted
- No crash reports are sent externally
- No user behavior tracking of any kind

### No External API Calls

- The extension makes zero HTTP requests to external services
- No fetch() or XMLHttpRequest calls to remote servers
- No WebSocket connections to external endpoints
- No beacon or sendBeacon calls

### No Source Code Collection

- The extension does not read, store, or transmit application source code
- Analysis is performed on runtime Angular structures, not source files
- No code snippets are extracted or uploaded

### No DOM Content Upload

- DOM analysis is performed entirely in the page context
- No DOM content, HTML, or page data is sent externally
- Element selectors used for overlays remain local

### Local Analysis Only

- All performance scoring runs in the page's main world context
- All DOM inspection happens locally via standard browser APIs
- All change detection profiling uses local Performance API measurements
- Results are stored in `chrome.storage.session` (ephemeral, per-session)

### Bundled Help Content

- All contextual help, documentation, and learning content is bundled with the extension
- No network requests are made to fetch help content
- Code examples and explanations are included in the extension package

### External Navigation (Only Permitted Network Activity)

The **only** external interaction is opening Angular documentation links in new browser tabs:

- Links to `https://angular.dev/*` documentation pages
- Links to `https://angular.io/*` (legacy documentation)
- These open in new tabs via `chrome.tabs.create` — the user initiates this action explicitly

No data is sent with these navigation requests. They simply open a documentation URL in a new tab.

## Permissions Justification

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access the current tab to detect Angular and perform analysis |
| `scripting` | Inject the page-script into the main world for Angular API access |
| `tabs` | Open documentation links in new browser tabs |
| `storage` | Store scan results within the session (local only, not synced) |

## Data Storage

- **`chrome.storage.session`**: Stores scan results per tab. This data is ephemeral — it is cleared when the browser session ends. It is never synced to any cloud service.
- **`chrome.storage.local`**: Stores user preferences (e.g., learning mode toggle). Never synced externally.

## Export Feature

When users export reports (JSON, Markdown, or clipboard), the data is:

1. Sanitized to remove any DOM references, functions, or circular structures
2. Delivered directly to the user's clipboard or as a local file download
3. Never transmitted to any server

## Contact

For privacy questions or concerns, please open an issue on the project repository.

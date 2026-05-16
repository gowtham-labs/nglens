# Privacy Policy

**Last Updated:** May 15, 2026

## Our Commitment

ngLens is built with privacy as a core principle. All analysis happens locally in your browser. **No data ever leaves your machine.**

## What We Collect

**Nothing.** Literally nothing.

- ❌ No analytics tracking
- ❌ No user identification
- ❌ No usage statistics
- ❌ No error reporting to external servers
- ❌ No cookies
- ❌ No network requests

## How It Works

1. **Local Analysis Only:**
   - All code analysis runs in your browser
   - Data is processed locally on your machine
   - Results are displayed in the extension popup
   - Nothing is transmitted to external servers

2. **Storage:**
   - Uses Chrome's local storage API only
   - Stores only scan results temporarily in your browser
   - Data never syncs to cloud
   - Clear browser data to remove all traces

3. **Permissions Explained:**
   ```json
   {
     "activeTab": "Access current tab to analyze Angular app",
     "scripting": "Inject analysis scripts into the page",
     "tabs": "Get tab information (URL, title)",
     "storage": "Store scan results locally"
   }
   ```

4. **No Network Access:**
   - Extension makes ZERO outbound network requests
   - Cannot send data to any server
   - Cannot communicate with external services
   - All code is bundled within the extension
   - `host_permissions` is required solely for injecting the analysis script into the page context via `chrome.scripting` API

## Third-Party Services

**None.** We don't use:
- ❌ Analytics (Google Analytics, Mixpanel, etc.)
- ❌ Error tracking (Sentry, Rollbar, etc.)
- ❌ CDNs for loading resources
- ❌ External APIs

## Open Source Verification

You can verify our privacy claims:

1. **Review the source code:**
   - GitHub: https://github.com/nglens/nglens
   - All code is public and auditable

2. **Check the manifest:**
   - No external host_permissions (except for content script injection)
   - Minimal permissions (activeTab, scripting, storage)

3. **Inspect network traffic:**
   - Open Chrome DevTools → Network tab
   - Use the extension
   - Zero network requests

## Your Data Rights

Since we don't collect any data, there's nothing to:
- Request access to
- Request deletion of
- Request modification of
- Export

All scan results are stored locally in your browser and are under your control.

## Updates to This Policy

If we ever change our privacy practices (we won't), we will:
1. Update this document
2. Increment the version number
3. Notify users via extension update notes
4. Require re-acceptance if collecting any data

## Chrome Web Store Privacy Disclosure

As required by Chrome Web Store:

**Data Collection:** None  
**Data Usage:** None  
**Data Sharing:** None  
**Data Storage:** Local only (Chrome storage API)

## Contact

For privacy questions or concerns:
- GitHub Issues: https://github.com/nglens/nglens/issues
- Email: gowthamdevlabs@gmail.com

## Compliance

ngLens complies with:
- ✅ GDPR (EU General Data Protection Regulation)
- ✅ CCPA (California Consumer Privacy Act)
- ✅ Chrome Web Store Developer Program Policies
- ✅ No data collection = No compliance issues

## Transparency

**You can verify everything:**
1. Source code is fully open (GPL v3)
2. No obfuscation or minification of logic
3. All dependencies are listed in package.json
4. Build process is reproducible (check vite.config.ts)

**We're proud to say: Your data stays yours. Always.**

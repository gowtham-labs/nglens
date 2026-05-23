# Privacy Policy

**Last Updated:** June 2025

## Our Commitment

ngLens is built with privacy as a core principle. All analysis happens locally in your browser. **No data ever leaves your machine.**

## What We Collect

### Anonymous Usage Analytics (Opt-In Only)

Starting with version 1.0.1, ngLens collects anonymous usage analytics **only after you grant explicit consent** via an opt-in prompt shown on first use. The extension functions fully regardless of your consent choice — declining analytics does not limit any functionality.

**Data points sent (when opted in):**
- Event name (e.g., "extension_installed", "analysis_run")
- Extension version number
- A randomly-generated Client ID (UUID) that is not linked to any user account or personal information

**What is NOT collected:**
- ❌ No personally identifiable information (PII)
- ❌ No page URLs or domain names
- ❌ No analysis results or code content
- ❌ No cookies
- ❌ No browsing history

### Opting Out

You can opt out of analytics at any time through the settings toggle in the extension popup. Opting out immediately stops all data transmission — no further events will be sent.

### Analytics Data Recipient

Analytics data is sent to **Google Analytics** (Google LLC) via the GA4 Measurement Protocol. For information on how Google processes this data, refer to [Google's Privacy Policy](https://policies.google.com/privacy) and [Google Analytics Data Retention](https://support.google.com/analytics/answer/7667196).

### If You Decline Analytics

If you select "No thanks" when prompted, or opt out later via settings:
- No analytics data is collected or transmitted
- No network requests are made to Google Analytics
- The extension operates identically to the opted-in experience

## How It Works

1. **Local Analysis Only:**
   - All code analysis runs in your browser
   - Data is processed locally on your machine
   - Results are displayed in the extension popup
   - Analysis results are never transmitted to external servers

2. **Storage:**
   - Uses Chrome's local storage API only
   - Stores scan results temporarily in your browser
   - Stores your analytics consent preference
   - Stores a randomly-generated Client ID (if analytics opted in)
   - Data never syncs to cloud
   - Clear browser data to remove all traces

3. **Permissions Explained:**
   ```json
   {
     "activeTab": "Access current tab to analyze Angular app",
     "storage": "Store scan results and consent preference locally",
     "host_permissions (google-analytics.com)": "Send anonymous usage events when opted in"
   }
   ```

4. **Network Access:**
   - The only outbound network request is to Google Analytics (when opted in)
   - No analysis data, page URLs, or personal information is transmitted
   - If analytics is declined, the extension makes zero network requests

## Third-Party Services

**Google Analytics (opt-in only):**
- Used to measure installation counts and active usage
- Only receives: event name, extension version, and a random Client ID
- Data is sent via the GA4 Measurement Protocol
- Only active when you have explicitly opted in

**Not used:**
- ❌ Error tracking (Sentry, Rollbar, etc.)
- ❌ CDNs for loading resources
- ❌ External APIs for analysis

## Open Source Verification

You can verify our privacy claims:

1. **Review the source code:**
   - GitHub: https://github.com/gowtham-labs/nglens
   - All code is public and auditable

2. **Check the manifest:**
   - `host_permissions` limited to `https://www.google-analytics.com/*` (for opt-in analytics only)
   - Minimal permissions: `activeTab`, `storage`

3. **Inspect network traffic:**
   - Open Chrome DevTools → Network tab
   - Use the extension
   - If opted in: only requests to `google-analytics.com/mp/collect`
   - If opted out: zero network requests

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

**Data Collection:** Anonymous usage events (event name, extension version, random Client ID) — opt-in only  
**Data Usage:** Measure installation counts and active usage to improve the extension  
**Data Sharing:** Sent to Google Analytics (Google LLC) only  
**Data Storage:** Consent preference and Client ID stored locally (Chrome storage API)

## Contact

For privacy questions or concerns:
- GitHub Issues: https://github.com/gowtham-labs/nglens/issues
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

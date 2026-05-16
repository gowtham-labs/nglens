# Publishing ngLens to Chrome Web Store

## 📝 **Step-by-Step Guide**

### **Step 1: Prepare Your Extension**

#### **1.1 Build the Extension**

```bash
cd ngLens

# Install dependencies (if not done)
npm install

# Build the extension
npm run build

# Output will be in dist/ folder
```

#### **1.2 Update Placeholders**

Replace all placeholders in your files:

```bash
# Find all placeholders
grep -r "\[your-username\]" .
grep -r "\[your-email\]" .
grep -r "\[your-security-email\]" .

# Replace with your actual information:
# [your-username] → your-github-username
# gowthamdevlabs@gmail.com → your@email.com
# gowthamdevlabs@gmail.com → security@yourdomain.com
```

**Files to update:**
- LICENSE
- PRIVACY.md
- SECURITY.md
- TRADEMARK.md
- CONTRIBUTING.md
- README.md
- CHANGELOG.md
- manifest.json

#### **1.3 Create Icons** (See icons/README.md)

You need:
- icons/icon16.png (16×16)
- icons/icon48.png (48×48)
- icons/icon128.png (128×128)

#### **1.4 Test the Extension**

```bash
# 1. Open Chrome
# 2. Go to chrome://extensions
# 3. Enable "Developer mode" (top-right toggle)
# 4. Click "Load unpacked"
# 5. Select the dist/ folder
# 6. Test all features:
```

**Testing Checklist:**
- [ ] Extension loads without errors
- [ ] Popup opens correctly
- [ ] Scan works on Angular app
- [ ] Performance score displays
- [ ] Overlays appear on page
- [ ] Signals analyzer detects issues
- [ ] No console errors
- [ ] No network requests (check DevTools → Network)

#### **1.5 Create ZIP Package**

```bash
cd ngLens

# Create a ZIP of the dist folder
cd dist
zip -r ../ngLens-v1.1.0.zip .
cd ..

# Verify ZIP contents
unzip -l ngLens-v1.1.0.zip

# Should contain:
# - manifest.json
# - popup.html
# - icons/
# - background.js
# - content.js
# - page-script.js
# - etc.
```

---

### **Step 2: Create Chrome Web Store Developer Account**

#### **2.1 Sign Up**

1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay **$5 one-time registration fee**
4. Agree to Developer Agreement
5. Complete your developer profile

#### **2.2 Verify Your Email**

- Use the email you want for support
- This will be visible to users
- Recommended: Create a dedicated email (e.g., nglens@yourdomain.com)

---

### **Step 3: Upload Your Extension**

#### **3.1 Create New Item**

1. Click **"New Item"** button
2. Click **"Choose file"** and select `ngLens-v1.1.0.zip`
3. Click **"Upload"**
4. Wait for upload to complete

#### **3.2 Fill Out Store Listing**

**Language:** English (United States)

**Product details:**

**Extension Name:**
```
ngLens
```

**Summary (132 characters max):**
```
Find Angular performance problems and learn how to fix them. Analyzes Signals, detects leaks, shows visual overlays. 100% local.
```

**Description (detailed):**
```markdown
# ngLens - Angular Performance Analyzer

Find Angular performance problems and learn how to fix them — whether you're a junior developer learning Angular or a senior architect optimizing at scale.

## Features

⚡ **Signals Analyzer (FIRST TOOL!)**
- Detects expensive computed signals
- Identifies O(n²) nested operations
- Flags Signal/RxJS mixing without interop
- Works on Angular 16+

👁️ **Visual Overlays**
- See issues directly on your page
- Color-coded by severity
- Click to see fix recommendations
- Works in production mode

📊 **Performance Score**
- Lighthouse-style 0-100 rating
- Change detection analysis
- DOM complexity checks
- Best practices detection

🔍 **Advanced Detection**
- Subscription leak detection (10+ patterns)
- Missing trackBy in *ngFor
- Template anti-patterns
- Excessive DOM nodes
- Layout thrashing potential

📚 **Educational**
- Explains WHY each issue matters
- Provides HOW to fix with code examples
- Links to official Angular docs
- Helps juniors learn best practices

🔒 **Privacy First**
- 100% local analysis
- Zero data collection
- No network requests
- Fully open source (GPL v3)

## Perfect For

✓ Finding performance bottlenecks quickly
✓ Learning Angular best practices
✓ Code reviews (performance checks)
✓ Production debugging (works without window.ng)
✓ Team training (show real examples)

## Signals Performance Analysis

ngLens is the FIRST and ONLY tool that analyzes Angular Signals performance:
- Expensive computed() operations
- Nested array operations (map inside map)
- Large collections without equality checks
- Signal/RxJS mixing patterns
- Over-granular signal splitting

## Privacy & Security

- ✅ GPL v3 licensed, fully open source
- ✅ Zero data collection documented
- ✅ No analytics, no tracking
- ✅ Strict Content Security Policy
- ✅ Minimal permissions (only what's needed)
- ✅ All code runs locally in your browser

Verify yourself: https://github.com/nglens/nglens

## Support

- GitHub: https://github.com/nglens/nglens
- Issues: https://github.com/nglens/nglens/issues
- Email: gowthamdevlabs@gmail.com

Open source, free forever, built for the Angular community.
```

**Category:**
```
Developer Tools
```

**Language:**
```
English
```

---

#### **3.3 Privacy Practices**

**Does this extension collect user data?**
```
☐ No, this extension does not collect any user data
```

**Single Purpose:**
```
Analyze Angular application performance and provide optimization recommendations
```

**Permission Justification:**

**activeTab:**
```
Required to access the current tab's DOM to analyze Angular application structure and performance
```

**scripting:**
```
Required to inject performance analysis scripts into Angular applications to detect issues
```

**tabs:**
```
Required to get tab metadata (URL, title) to provide context for performance analysis
```

**storage:**
```
Required to store scan results locally in the browser for comparison and history
```

**host_permissions (<all_urls>):**
```
Required to inject content scripts into any page where Angular apps may be running
```

---

#### **3.4 Graphic Assets**

**Icon (128×128):**
- Upload: `icons/icon128.png`

**Small Tile (440×280):**
- Create a promotional image
- Design: ngLens logo + tagline
- Example text: "Find Angular Performance Problems"

**Marquee Tile (1400×560):**
- Large promotional banner
- Use for featured placements
- Include: Logo, key features, screenshots

**Screenshots (1280×800 or 640×400):**

Upload 5 screenshots showing:
1. **Extension popup with performance score**
   - Show dark theme UI
   - Circular gauge visible
   - Score: 85/100

2. **Visual overlay on page**
   - Show colored border around component
   - Label visible with issue type
   - Real Angular app in background

3. **Issue details expanded**
   - Show full issue card
   - Recommendation visible
   - Code example if possible

4. **Performance tab with gauge**
   - Circular Lighthouse-style gauge
   - Sub-scores visible
   - Professional dark theme

5. **Issues list with filtering**
   - Multiple issue cards
   - Filters visible
   - Severity indicators

**Screenshot Tips:**
```bash
# Take screenshots at 1280×800 resolution
# Use Chrome DevTools Device Mode
# Set viewport: 1280 × 800
# Capture key features in action
```

---

#### **3.5 Additional Fields**

**Official URL:**
```
https://github.com/nglens/nglens
```

**Homepage URL:**
```
https://github.com/nglens/nglens
```

**Support Email:**
```
gowthamdevlabs@gmail.com
```

**Privacy Policy:**
```
https://raw.githubusercontent.com/nglens/nglens/main/PRIVACY.md
```

(Or host on your website/GitHub Pages)

---

### **Step 4: Verify Distribution**

**Visibility:**
```
☑ Public
```

**Regions:**
```
☑ All regions (recommended)
```

**Pricing:**
```
☐ Free
```

---

### **Step 5: Submit for Review**

1. Click **"Submit for Review"**
2. Review all information
3. Confirm submission
4. Wait for review (typically 1-3 business days)

**Review Process:**
- Automated checks (malware, policy violations)
- Manual review by Google team
- Testing on sample sites
- Privacy policy verification

---

### **Step 6: After Approval**

#### **6.1 Publish**

Once approved:
1. You'll receive email notification
2. Click **"Publish"** in the dashboard
3. Extension goes live within minutes
4. Get your extension URL

**Your URL will be:**
```
https://chrome.google.com/webstore/detail/nglens/[UNIQUE-ID]
```

#### **6.2 Update Your Docs**

Add Chrome Web Store links to:
- README.md
- PRIVACY.md
- All documentation
- LinkedIn post
- Social media

---

## 🚨 **Common Rejection Reasons & How to Avoid**

### **1. Permissions Issues**

**❌ Rejected:**
```
"Extension requests unnecessary permissions"
```

**✅ Fix:**
- Already done: Minimal permissions in manifest.json
- Justification provided for each permission
- No network permissions

### **2. Privacy Policy Missing**

**❌ Rejected:**
```
"Privacy policy URL is invalid"
```

**✅ Fix:**
- Host PRIVACY.md on GitHub
- Use raw.githubusercontent.com URL
- Or create GitHub Pages site

### **3. Misleading Description**

**❌ Rejected:**
```
"Claims not supported by functionality"
```

**✅ Fix:**
- All claims in description are backed by code
- No exaggerated promises
- Clear feature list

### **4. Icon Quality**

**❌ Rejected:**
```
"Icons are low quality or pixelated"
```

**✅ Fix:**
- Use high-quality PNG icons
- Ensure 16×16 is readable
- Match Chrome's design guidelines

### **5. Single Purpose**

**❌ Rejected:**
```
"Extension does not follow single purpose policy"
```

**✅ Fix:**
- Already compliant: Single purpose = Angular performance analysis
- All features support this purpose

---

## 📊 **Post-Publication Checklist**

### **Immediate Actions**

```bash
# 1. Update README with Chrome Web Store badge
# Add to README.md:
```

```markdown
## Install

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID.svg)](https://chrome.google.com/webstore/detail/nglens/YOUR_EXTENSION_ID)
[![Users](https://img.shields.io/chrome-web-store/users/YOUR_EXTENSION_ID.svg)](https://chrome.google.com/webstore/detail/nglens/YOUR_EXTENSION_ID)
[![Rating](https://img.shields.io/chrome-web-store/rating/YOUR_EXTENSION_ID.svg)](https://chrome.google.com/webstore/detail/nglens/YOUR_EXTENSION_ID)

[Install from Chrome Web Store](https://chrome.google.com/webstore/detail/nglens/YOUR_EXTENSION_ID)
```

### **Marketing**

1. **Post on LinkedIn** (use templates provided earlier)
2. **Tweet launch announcement**
3. **Post on Reddit:**
   - r/angular
   - r/webdev
   - r/javascript
4. **Submit to:**
   - Hacker News (Show HN: ngLens)
   - Dev.to
   - Angular Weekly newsletter
   - JavaScript Weekly newsletter
5. **Create demo video:**
   - Upload to YouTube
   - Show key features
   - Link from Chrome Web Store

### **Monitor**

1. **Chrome Web Store Reviews:**
   - Respond to all reviews
   - Fix bugs reported
   - Thank positive reviewers

2. **GitHub Issues:**
   - Triage bug reports
   - Respond within 24 hours
   - Link to Chrome Web Store in responses

3. **Analytics:**
   - Check user count weekly
   - Monitor review ratings
   - Track feature requests

---

## 🔄 **Publishing Updates**

When you release v1.2.0:

```bash
# 1. Update version in manifest.json
"version": "1.2.0"

# 2. Update CHANGELOG.md

# 3. Build
npm run build

# 4. Create ZIP
cd dist
zip -r ../ngLens-v1.2.0.zip .
cd ..

# 5. Upload to Chrome Web Store
# - Go to Developer Dashboard
# - Click on ngLens
# - Click "Package" tab
# - Click "Upload Updated Package"
# - Select ngLens-v1.2.0.zip
# - Add release notes
# - Submit for review

# 6. Tag release on GitHub
git tag v1.2.0
git push origin v1.2.0
```

**Update goes live:**
- Review: 1-3 days
- Auto-update to users: Within 24 hours after approval

---

## 📋 **Quick Reference**

```bash
# Build for production
npm run build

# Create package
cd dist && zip -r ../ngLens-v1.1.0.zip . && cd ..

# Test locally
# chrome://extensions → Load unpacked → select dist/

# Developer Dashboard
# https://chrome.google.com/webstore/devconsole

# Analytics
# Shows in Developer Dashboard after publication
```

---

## ✅ **Final Pre-Publish Checklist**

- [ ] Extension builds without errors
- [ ] All placeholders replaced with real info
- [ ] Icons created (16px, 48px, 128px)
- [ ] Privacy policy accessible via URL
- [ ] All features tested manually
- [ ] No console errors
- [ ] No network requests (verified)
- [ ] README updated with features
- [ ] CHANGELOG current
- [ ] Screenshots taken (5 images)
- [ ] Store listing description written
- [ ] Permission justifications ready
- [ ] Developer account created ($5 paid)
- [ ] ZIP package created
- [ ] Ready to upload!

---

**🎉 You're Ready to Publish!**

Follow the steps above, and ngLens will be live on Chrome Web Store within a week. Good luck with the launch! 🚀

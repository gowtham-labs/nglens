# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in ngLens, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email:
- **Email:** gowthamdevlabs@gmail.com
- **Subject:** [SECURITY] ngLens Vulnerability Report

### What to Include

Please include:
1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** (what could an attacker do?)
4. **Suggested fix** (if you have one)
5. **Your contact information** (for follow-up)

### Response Timeline

- **24 hours:** Acknowledgment of your report
- **7 days:** Initial assessment and severity classification
- **30 days:** Fix developed and tested (for high/critical issues)
- **Release:** Coordinated disclosure after fix is published

### Severity Levels

**Critical:** Remote code execution, data theft, privilege escalation
- Fix: Immediate (within 7 days)
- Disclosure: After fix deployed

**High:** XSS, CSRF, injection attacks
- Fix: Within 14 days
- Disclosure: After fix deployed

**Medium:** Information disclosure, DoS
- Fix: Within 30 days
- Disclosure: After fix deployed

**Low:** Minor issues with limited impact
- Fix: Next release cycle
- Disclosure: Can be public

## Security Features

### 1. Content Security Policy (CSP)

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'"
  }
}
```

- No external scripts allowed
- No eval() or Function() constructor
- No inline scripts (except styles for UI)

### 2. Minimal Permissions

```json
{
  "permissions": [
    "activeTab",   // Only current tab
    "scripting",   // Inject analyzers
    "storage"      // Local storage only
  ],
  "host_permissions": [
    "https://www.google-analytics.com/*" // Opt-in anonymous usage analytics only
  ]
}
```

**Network access:**
- Analysis data, page URLs, and source code are not transmitted
- Google Analytics is contacted only after explicit opt-in
- No remote scripts or analysis APIs are loaded

### 3. Input Validation

All user inputs and DOM data are sanitized:
- Component names validated
- Selectors escaped
- No direct innerHTML with user data
- Template literals use safe interpolation

### 4. Dependency Security

- Automated dependency audits (npm audit)
- Dependabot enabled
- No unnecessary dependencies
- All deps pinned to specific versions

### 5. Code Signing

- Extensions published to Chrome Web Store are signed
- Verified publisher badge
- Unique extension ID prevents impersonation

## Security Best Practices

### For Users

1. **Only install from official sources:**
   - Chrome Web Store: [official link]
   - Verify publisher name matches

2. **Check permissions before installing:**
   - Should only request: activeTab, scripting, tabs, storage
   - Should NOT request: all sites, network access

3. **Keep extension updated:**
   - Enable auto-updates in Chrome
   - Check for updates regularly

4. **Report suspicious behavior:**
   - Email: [security-email]
   - Include screenshots/logs

### For Contributors

1. **Never commit secrets:**
   - API keys
   - Passwords
   - Private keys
   - Tokens

2. **Review dependencies:**
   - Check for known vulnerabilities
   - Verify package maintainers
   - Use `npm audit` before PR

3. **Follow secure coding practices:**
   - Validate all inputs
   - Escape outputs
   - Use TypeScript strict mode
   - No eval() or Function()

4. **Sign your commits:**
   ```bash
   git config --global commit.gpgsign true
   ```

## Known Issues

None currently. Check GitHub Security Advisories for updates.

## Security Audits

- Last audit: [Date]
- Next audit: [Date]
- Auditor: [Name/Organization]

## Disclosure Policy

We follow **coordinated disclosure:**

1. Researcher reports vulnerability privately
2. We acknowledge within 24 hours
3. We develop and test fix
4. We publish fix to Chrome Web Store
5. We publish security advisory
6. Researcher gets credit (if desired)

## Bug Bounty

Currently, we don't have a paid bug bounty program (open source project).

However, we offer:
- 🏆 Recognition in CHANGELOG
- 🏆 Credit in security advisory
- 🏆 Contributor badge
- 🏆 Our eternal gratitude

## Security Hall of Fame

Thank you to these security researchers:
- [Names of researchers who reported issues]

## License and Brand Note

This project uses the **MIT License**:
- Permissive use, modification, distribution, and sublicensing
- Copyright and license notices must be retained
- Source is public and auditable

Trademark "ngLens" prevents name and logo impersonation.

## Contact

- **Security Email:** gowthamdevlabs@gmail.com
- **GitHub Security:** https://github.com/gowtham-labs/nglens/security/advisories
- **General Issues:** https://github.com/gowtham-labs/nglens/issues

## Resources

- [OWASP Extension Security Guide](https://owasp.org/www-community/vulnerabilities/)
- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)
- [MIT License](https://opensource.org/license/mit/)

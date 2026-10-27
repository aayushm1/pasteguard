# Chrome Web Store submission kit

Copy-paste these into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time $5 registration fee).

**Package to upload:** `dist/pasteguard-webstore.zip` (manifest at the zip root; rebuild it with `cd extension && zip -r ../dist/pasteguard-webstore.zip . -x '*.DS_Store'`). Step-by-step: [LAUNCH-GUIDE.md](LAUNCH-GUIDE.md).

---

## Store listing

**Name:** PasteGuard: mask sensitive data before AI sees it

**Summary (132 chars max):**
Masks names, emails, card details, ID numbers, addresses and API keys before you paste them into AI chat tools. 100% local.

**Category:** Privacy & Security (alternative: Productivity)

> ⚠️ Don't list product or brand names (AI tools, API providers) in the description. A bare list was rejected as **keyword spam** (violation "Yellow Argon"). One natural mention in a sentence is fine.

**Description:**

Paste into AI. Keep the secrets.

PasteGuard masks sensitive data the moment you paste it into an AI chat assistant such as ChatGPT, then shows you the real values when the AI replies.

HOW IT WORKS
• You paste as usual. PasteGuard checks the text before the chat box receives it.
• Sensitive details become placeholders like [EMAIL_1] or [CLIENT_1], so the AI never sees the originals.
• When the reply mentions a placeholder, PasteGuard shows the real value on your screen only.

WHAT IT PROTECTS
• People's names, company names, street addresses and project codenames, recognised from context
• Email addresses, phone numbers and IP addresses
• Payment details: card numbers, CVV, expiry dates and bank account identifiers
• Government ID numbers and dates of birth
• Passwords, access tokens, private keys and API keys
• Any words you add to your own "always mask" list

PRIVATE BY DESIGN
• Everything runs locally in your browser. Nothing you paste is sent to any server.
• The placeholder map is kept in memory and cleared when you close the browser.
• It needs one permission (storage) and only runs on supported AI chat sites.
• The code is open source on GitHub.

**Website:** https://aayushm1.github.io/pasteguard/
**Support:** https://github.com/aayushm1/pasteguard/issues

---

## Privacy practices tab

**Single purpose:**
Detect and mask sensitive information (emails, phone numbers, financial identifiers, API keys and user-defined terms) in text the user pastes into AI chat websites, and restore the original values in the page display for the user.

**Permission justification: `storage`:**
Saves the user's settings and custom terms (local storage), and keeps the placeholder-to-value map in session storage (in memory, cleared when the browser closes) so real values can be shown in AI replies.

**Host permission justification (content scripts on AI chat sites):**
The extension must intercept paste events in the chat input of these specific AI sites to mask sensitive data before it is submitted, and update the displayed reply to show the user's original values. It runs on no other sites.

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check **none** of the data-collection boxes. PasteGuard processes text locally and does not collect or transmit user data.
Certify: does not sell data; does not use or transfer data for unrelated purposes; does not use data for creditworthiness or lending.

**Privacy policy URL:** https://github.com/aayushm1/pasteguard/blob/main/PRIVACY.md

---

## Assets checklist

- [x] Icon 128×128: `extension/icons/icon128.png`
- [x] Screenshots, 1280×800: `store-assets/screenshot-1.png`, `-2.png`, `-3.png`
- [x] Small promo tile, 440×280: `store-assets/promo-tile-440x280.png`

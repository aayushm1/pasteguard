# Chrome Web Store submission kit

Copy-paste these into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time $5 registration fee).

**Package to upload:** `pasteguard-extension.zip` from the [latest release](https://github.com/aayushm1/pasteguard/releases/latest).

---

## Store listing

**Name:** PasteGuard: mask sensitive data before AI sees it

**Summary (132 chars max):**
Masks emails, phones, card numbers, API keys and client names when you paste into ChatGPT, Claude or Gemini. 100% local.

**Category:** Productivity (alternative: Privacy & Security)

**Description:**

Paste into AI. Keep the secrets.

PasteGuard masks sensitive data the moment you paste into ChatGPT, Claude, Gemini and other AI chat tools, then shows you the real values in the AI's reply.

HOW IT WORKS
• You paste as usual. PasteGuard checks the text before the chat box receives it.
• Emails, phone numbers, card numbers, API keys and your own client names become placeholders like [EMAIL_1] and [CLIENT_1].
• When the AI replies using those placeholders, PasteGuard shows the real values on your screen only.

WHAT IT CATCHES
• Emails and phone numbers
• Card numbers (Luhn-checked), IBANs, Aadhaar, PAN, US SSNs
• API keys (OpenAI, Anthropic, AWS, GitHub, Slack, Google, Stripe), JWTs, private keys
• IP addresses
• Your own "always mask" terms: client names, people, project code names

PRIVATE BY DESIGN
• No servers: nothing you paste is ever sent anywhere
• The placeholder map lives in memory and is wiped when you close the browser
• One permission (storage), and it only runs on AI chat sites
• Open source: https://github.com/aayushm1/pasteguard

WORKS ON
ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, DeepSeek, Mistral Le Chat, Poe.

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
- [ ] Screenshots, 1280×800 (at least 1): toast on ChatGPT, restored reply, popup
- [ ] Small promo tile, 440×280 (optional)

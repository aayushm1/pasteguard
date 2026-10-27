<div align="center">

<img src="assets/logo.svg" width="72" alt="PasteGuard logo">

# PasteGuard

### Paste into AI. Keep the secrets.

A free Chrome extension that masks emails, phone numbers, card numbers, API keys and client names **the moment you paste** into ChatGPT, Claude or Gemini. Then it shows you the real values in the AI's reply. Everything runs locally.

[**🌐 Website + live demo**](https://aayushm1.github.io/pasteguard/) · [**⬇ Download v0.1.0**](https://github.com/aayushm1/pasteguard/releases/latest/download/pasteguard-extension.zip) · [Privacy policy](PRIVACY.md)

![Version](https://img.shields.io/badge/version-0.1.0-14B8A6)
![Manifest](https://img.shields.io/badge/Chrome-Manifest%20V3-0B1220)
![Privacy](https://img.shields.io/badge/data%20sent%20anywhere-none-12A150)
![License](https://img.shields.io/badge/license-MIT-7C8DA8)

</div>

---

## Why

People paste client emails, support tickets, spreadsheets and code into AI chat tools every day. Those pastes are full of names, emails, phone numbers, card numbers and API keys that shouldn't leave the company. Blocking AI tools doesn't work, and enterprise security tools are priced for large companies.

PasteGuard is a seatbelt: it's invisible until it's needed, and it doesn't change how you work.

## How it works

```
You paste:     Priya Shah (priya@northwind.com) says card 4111 1111 1111 1111 was charged twice
AI receives:   [PERSON_1] ([EMAIL_1]) says card [CARD_1] was charged twice
AI replies:    Hi [PERSON_1], we've refunded the duplicate charge on [CARD_1]…
You see:       Hi Priya Shah, we've refunded the duplicate charge on 4111 1111 1111 1111…
```

1. **Catch.** It reads the clipboard text in the paste event, before the chat box gets it.
2. **Mask.** Sensitive values become stable placeholders. The same value always gets the same placeholder, so the AI's answer stays coherent.
3. **Restore.** When the reply mentions a placeholder, the real value is swapped back **on your screen only** and highlighted. The text box you type in is never touched.

## What it detects

| Detector | Example | Validation |
|---|---|---|
| Email | `name@company.com` | Pattern |
| Phone | `+91 98765 43210`, `(415) 555-0132` | 10–15 digits, ignores dates and amounts |
| Card number | `4111 1111 1111 1111` | **Luhn checksum** |
| IBAN | `DE89 3704 0044 0532 0130 00` | **Mod-97 checksum** |
| Aadhaar | `2341 2341 2346` | **Verhoeff checksum** |
| PAN (India) | `ABCPE1234F` | Format |
| US SSN | `123-45-6789` | Excludes invalid ranges |
| API keys | OpenAI, Anthropic, AWS, GitHub, Slack, Google, Stripe, GitLab | Known prefixes |
| Auth tokens | JWTs (`eyJ…`) | Structure |
| Private keys | `-----BEGIN … PRIVATE KEY-----` | Block |
| IP address | `192.168.1.20` | Octet ranges |
| **Your own terms** | `Acme Corp => CLIENT` | Exact, case-insensitive, whole word |

Checksums keep false alarms low: an order number that happens to be 16 digits isn't flagged as a card.

**Works on:** ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, DeepSeek, Mistral Le Chat, Poe.

## Install

**Chrome Web Store:** coming soon.

**Manual install (Chrome, Edge, Brave, Arc):**
1. Download [`pasteguard-extension.zip`](https://github.com/aayushm1/pasteguard/releases/latest/download/pasteguard-extension.zip) and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and select the unzipped `pasteguard` folder.
4. Pin the 🛡️ icon, then paste something sensitive into ChatGPT.

## Privacy

- **No servers.** There's no backend. The extension makes no network requests.
- **Memory-only vault.** The placeholder → value map lives in `chrome.storage.session`, which is wiped when the browser closes.
- **One permission:** `storage`. It runs only on the AI chat sites listed above.
- **No analytics.** Usage stats (counts only, never values) stay on your device and are shown only in the popup.

Full policy: [PRIVACY.md](PRIVACY.md)

## Project structure

```
extension/
  manifest.json    Manifest V3; storage permission only
  detectors.js     Detection engine: regex + checksum validators, mask/restore
  content.js       Paste interception, toast, restore-in-replies (CSS Highlight API)
  background.js    Defaults, session-vault access, toolbar badge
  popup.html/.js   Stats, session vault, custom terms, detector toggles
index.html         Website + live playground (uses the same detectors.js)
dev/               Test harnesses for the content script and popup
STORE-LISTING.md   Chrome Web Store submission copy
```

## Product notes

| | |
|---|---|
| **Target user** | Knowledge workers who use AI daily with client data: consultants, support, recruiters, finance, lawyers |
| **North-star metric** | Sensitive values masked per weekly active user |
| **Guardrails** | False-positive rate (masks the user overrides with "Allow next paste"), uninstall rate |
| **Business model** | Free for individuals → Pro ($5/mo: typed text, file uploads, any site) → Team ($6/user/mo: shared rules, admin dashboard, audit log) |

### Roadmap
- [ ] Chrome Web Store listing
- [ ] Mask typed text before send, not just pastes
- [ ] Scan file uploads (PDF, DOCX, CSV) before they reach the AI
- [ ] Per-site enable/disable
- [ ] Team tier: shared term lists, managed deployment, admin dashboard

## Limitations

- Names aren't detected automatically. Add the ones that matter to **Always mask**.
- v0.1 masks pastes, not typed text or file uploads.
- It's a safety net, not a guarantee. Don't rely on it as your only control for regulated data.

## Development

No build step. Edit the files and click reload on `chrome://extensions`.

- `dev/harness.html` runs `content.js` against a fake chat page with a `chrome.*` shim
- `dev/popup-harness.html` renders the popup with sample data

Serve the repo root with any static server (for example `npx serve .`) and open those pages.

---

MIT licensed · Built by [Aayush Mehan](https://aayushm1.github.io/)

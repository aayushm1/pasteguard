<div align="center">

<img src="assets/logo.svg" width="72" alt="PasteGuard logo">

# PasteGuard

### Paste into AI. Keep the secrets.

A free Chrome extension that masks emails, phone numbers, card numbers, API keys and client names **the moment you paste** into ChatGPT, Claude or Gemini. Then it shows you the real values in the AI's reply. Everything runs locally.

[**🌐 Website + live demo**](https://aayushm1.github.io/pasteguard/) · [**⬇ Download v0.2.0**](https://github.com/aayushm1/pasteguard/releases/latest/download/pasteguard-extension.zip) · [Privacy policy](PRIVACY.md)

![Version](https://img.shields.io/badge/version-0.2.0-14B8A6)
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

25 detectors in three layers. Everything runs locally; no AI model is involved.

**1. Patterns with checksums**

| Detector | Example | Validation |
|---|---|---|
| Card number | `4111 1111 1111 1111` | **Luhn checksum** |
| IBAN | `DE89 3704 0044 0532 0130 00` | **Mod-97 checksum** |
| Aadhaar | `2341 2341 2346` | **Verhoeff checksum** |
| PAN, GSTIN, IFSC, UPI ID | `ABCPE1234F`, `27ABCDE1234F1Z5`, `HDFC0001234`, `name@okicici` | Format |
| US SSN | `123-45-6789` | Excludes invalid ranges |
| Email, phone, IP address | `+91 98765 43210`, `10.24.8.112` | Digit counts, octet ranges; ignores dates, amounts, versions |
| API keys | OpenAI, Anthropic, Stripe, AWS, GitHub, GitLab, Slack, Google, Hugging Face, Groq, xAI, SendGrid, Shopify… | Known prefixes |
| JWTs, private keys, crypto wallets | `eyJ…`, `-----BEGIN PRIVATE KEY-----`, `0x71C7…` | Structure |
| Unknown secrets | `Q7mZp3Xc9LkT2vBn8RwY4hJd6FsGa1Ue` | **Entropy check**; skips hashes, UUIDs and variable names |

**2. Context: the words around a value**

| Detector | Catches |
|---|---|
| Passwords / secrets | `password: …`, `DB_PASSWORD=…`, `postgres://user:PASS@host`, `?token=…` |
| Card CVV / expiry | `CVV 123`, `expiry 12/29` |
| PIN / OTP | `OTP is 482913` |
| Date of birth | `DOB: 14/08/1991` |
| ID numbers | `client ID HLX-00482`, `study ID ONC-2026-0117`, `IRB approval number IRB-77421`, `account number …`, `passport …` |
| Names | `Dr. Ananya Rao`, `finance officer Rohan Deshmukh`, `Name: Rahul Verma`, `Hi Priya`, common first + last names |
| Addresses | `21 Research Park Road, Cambridge, MA 02139`, `Flat 4B, 12 MG Road, Bengaluru 560001` |
| Organisations | `Helix Biosciences Inc.`, `… Labs`, `… Technologies` |
| Project codenames | `Project Aurora`, `Operation …` |

**3. Inference and propagation**

- `priya.shah@northwind.com` → also masks **Priya Shah** and **Northwind** wherever they appear
- Once `Helix Biosciences Inc.` is found, a later bare **Helix** is masked too
- **Your own terms:** `Acme Corp => CLIENT` in the popup

Checksums and context keep false alarms low: order numbers, invoice numbers, dates, money, version numbers, commit hashes and UUIDs are left alone. See `dev/test-detectors.js`.

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

- Names are detected from context and common first names. Unusual names with no context clue can slip through, so add them to **Always mask**.
- v0.1 masks pastes, not typed text or file uploads.
- It's a safety net, not a guarantee. Don't rely on it as your only control for regulated data.

## Development

No build step. Edit the files and click reload on `chrome://extensions`.

- `node dev/test-detectors.js` runs the detection regression suite (`-v` prints the masked text)
- `dev/harness.html` runs `content.js` against a fake chat page with a `chrome.*` shim
- `dev/popup-harness.html` renders the popup with sample data

Serve the repo root with any static server (for example `npx serve .`) and open those pages.

---

MIT licensed · Built by [Aayush Mehan](https://aayushm1.github.io/)

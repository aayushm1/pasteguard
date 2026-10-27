# PasteGuard privacy policy

_Last updated: October 27, 2026_

PasteGuard is designed so that your data never leaves your device.

## What PasteGuard processes

When you paste text into a supported AI chat site, PasteGuard reads that text **inside your browser** to find sensitive values (such as email addresses, phone numbers, card numbers and API keys) and replace them with placeholders before the text reaches the website.

## What PasteGuard stores, and where

| Data | Where it's stored | How long |
|---|---|---|
| Placeholder → real value map (for example `[EMAIL_1]` → your value) | `chrome.storage.session`, in memory on your device | Until you close the browser, or click **Clear** in the popup |
| Your settings and "Always mask" terms | `chrome.storage.local`, on your device | Until you remove them or uninstall |
| Usage counts (for example "12 emails masked"); never the values themselves | `chrome.storage.local`, on your device | Until you uninstall |

## What PasteGuard does not do

- It does not send any data to any server. PasteGuard has no backend.
- It does not use analytics, tracking or advertising.
- It does not load remote code.
- It does not sell, share or transfer any user data to third parties.
- It does not read pages outside the supported AI chat sites listed in the extension manifest.

## Permissions

- `storage`: saves your settings and the in-memory placeholder map.
- Content scripts on supported AI chat sites (ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek, Mistral, Poe): intercept pastes and restore values in replies.

## Contact

Questions or concerns: open an issue at https://github.com/aayushm1/pasteguard/issues

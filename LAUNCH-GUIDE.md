# Launching PasteGuard

Two separate things get "hosted":

| What | Where it lives | Status |
|---|---|---|
| **Website** (landing page, demo, privacy policy) | GitHub Pages: https://aayushm1.github.io/pasteguard/ | ✅ Live. Updates automatically on every push. |
| **Extension** (what users install) | Chrome Web Store, which hosts and auto-updates it | ⏳ You submit it (below) |

You don't need a server. PasteGuard has no backend, by design.

---

## Part 1: Chrome Web Store (about 30 minutes of work, then review)

### Step 1: Create a developer account (one time)
1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with the Google account you want to publish from. A dedicated account (for example `pasteguard.dev@gmail.com`) keeps it separate from personal mail.
3. **2-Step Verification** must be on for that Google account.
4. Accept the developer agreement and pay the **one-time $5 fee**.
5. Verify your contact email when asked.

### Step 2: Account settings
- **Publisher name:** `Aayush Mehan` (shown on the store page).
- **Trader / non-trader** (an EU requirement): choose **Non-trader** while PasteGuard is free. Choosing *Trader* makes your address and phone number public. Switch when you launch paid plans.

### Step 3: Upload the package
1. Click **+ New item**.
2. Upload **`dist/pasteguard-webstore.zip`**.
   ⚠️ Use this file, not the GitHub release zip. The store needs `manifest.json` at the root of the zip, and the GitHub zip has a folder inside it.

### Step 4: Fill in the tabs (copy-paste from `STORE-LISTING.md`)

**Store listing**
| Field | Value |
|---|---|
| Description | From `STORE-LISTING.md` |
| Category | **Privacy & Security** (or Productivity) |
| Language | English |
| Store icon (128×128) | `extension/icons/icon128.png` |
| Screenshots (1280×800) | `store-assets/screenshot-1.png`, `-2.png`, `-3.png` |
| Small promo tile (440×280) | `store-assets/promo-tile-440x280.png` |
| Homepage URL | https://aayushm1.github.io/pasteguard/ |
| Support URL | https://github.com/aayushm1/pasteguard/issues |

**Privacy practices**: single purpose, permission justifications, "no remote code", and data disclosures (tick none). All of these are written out in `STORE-LISTING.md`.
Privacy policy URL: https://github.com/aayushm1/pasteguard/blob/main/PRIVACY.md

**Distribution**: Public · All regions · Free.

### Step 5: Submit for review
- Click **Submit for review**. Leave "Publish automatically after review" ticked.
- Review usually takes **a few days**. Extensions that run on specific websites can take longer, sometimes 1–3 weeks.
- You'll get an email when it's approved, with a link like `https://chromewebstore.google.com/detail/pasteguard/<id>`.

### Common rejection reasons (already handled)
| Reason | PasteGuard |
|---|---|
| Unclear single purpose | Stated in the privacy tab |
| More permissions than needed | Only `storage`, plus specific AI sites |
| Missing privacy policy | `PRIVACY.md` |
| Remote or obfuscated code | None; plain readable JS |
| Misleading claims or keyword stuffing | Description avoids "guarantees" and keyword lists |

If it's rejected, the email gives the exact policy. Fix, re-upload and resubmit.

---

## Part 2: After approval
1. Replace the "Add to Chrome" buttons on the website, the README install section and the portfolio card with the store link. (Send me the link and I'll do it.)
2. Announce it: LinkedIn post with the demo GIF, Product Hunt, r/ChatGPT, r/privacy, Hacker News "Show HN".
3. Watch the developer dashboard: installs, weekly users, uninstalls and ratings. Those are your real metrics.

## Shipping updates
1. Change the code and bump `"version"` in `extension/manifest.json` (for example `0.2.0` → `0.2.1`).
2. Rebuild the store zip from inside `extension/`: `zip -r ../dist/pasteguard-webstore.zip . -x '*.DS_Store'`
3. Dashboard → PasteGuard → **Package** → **Upload new package** → Submit. Users update automatically.

---

## Optional: your own domain (for example pasteguard.app)
1. Buy the domain (about $10–15 a year from Namecheap, Cloudflare or Google Domains' successor).
2. Repo **Settings → Pages → Custom domain**: enter it. GitHub adds a `CNAME` file.
3. At your domain provider, add DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` → `aayushm1.github.io`
4. Tick **Enforce HTTPS** once the certificate is issued (it can take up to a day).
5. Update the homepage URL in the store listing.

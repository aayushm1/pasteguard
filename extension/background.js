// PasteGuard service worker: defaults, session-vault access, toolbar badge.

const DEFAULTS = { enabled: true, disabled: [], customTerms: '', restore: true, stats: { total: 0, byType: {}, byDay: {} } };

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const missing = Object.fromEntries(Object.entries(DEFAULTS).filter(([k]) => cur[k] === undefined));
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
});

// The vault (placeholder -> real value) lives in session storage: in memory only,
// wiped when the browser closes. Content scripts need explicit access to it.
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'pg-badge' && sender.tab) {
    chrome.action.setBadgeBackgroundColor({ color: '#0F766E', tabId: sender.tab.id });
    chrome.action.setBadgeText({ text: msg.count ? String(msg.count) : '', tabId: sender.tab.id });
  }
});

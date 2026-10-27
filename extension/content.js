/*
 * PasteGuard content script.
 * 1. Intercepts paste into AI chat boxes and swaps sensitive values for placeholders.
 * 2. Restores real values in what the page displays (AI replies), without touching the input box.
 * Nothing leaves the browser. The placeholder vault lives in chrome.storage.session (memory only).
 */
(() => {
  'use strict';
  if (window.__pasteGuardLoaded) return;
  window.__pasteGuardLoaded = true;

  const P = globalThis.PasteGuard;
  let settings = { enabled: true, disabled: [], customTerms: '', restore: true };
  let customTerms = [];
  let vault = P.newVault();
  let allowNext = false;
  let reentrant = false;
  let tabCount = 0;

  // ---------- settings & vault ----------
  async function load() {
    const s = await chrome.storage.local.get(['enabled', 'disabled', 'customTerms', 'restore']);
    for (const k in s) if (s[k] !== undefined) settings[k] = s[k];
    customTerms = P.parseCustomTerms(settings.customTerms);
    try {
      const v = await chrome.storage.session.get('vault');
      if (v.vault) vault = v.vault;
    } catch (_) { /* session storage unavailable: keep in-page vault */ }
    scheduleRestore();
  }

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local') {
      for (const k in ch) if (k in settings) settings[k] = ch[k].newValue;
      if (ch.customTerms) customTerms = P.parseCustomTerms(settings.customTerms);
      if (ch.restore || ch.enabled) { clearHighlights(); scheduleRestore(); }
    }
    if (area === 'session' && ch.vault) {
      vault = ch.vault.newValue || P.newVault();
      scheduleRestore();
    }
  });

  // Serialize writes so back-to-back pastes don't overwrite each other's stats
  let writeQueue = Promise.resolve();
  function persist(items) {
    writeQueue = writeQueue.then(() => persistNow(items)).catch(() => {});
    return writeQueue;
  }
  async function persistNow(items) {
    try { await chrome.storage.session.set({ vault }); } catch (_) {}
    const { stats = { total: 0, byType: {}, byDay: {} } } = await chrome.storage.local.get('stats');
    const day = new Date().toISOString().slice(0, 10);
    stats.total += items.length;
    stats.byDay[day] = (stats.byDay[day] || 0) + items.length;
    for (const i of items) stats.byType[i.type] = (stats.byType[i.type] || 0) + 1;
    await chrome.storage.local.set({ stats });
    tabCount += items.length;
    chrome.runtime.sendMessage({ type: 'pg-badge', count: tabCount }).catch(() => {});
  }

  // ---------- paste interception ----------
  const EDITABLE = 'textarea, input[type="text"], input[type="search"], input:not([type]), [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

  function editableFrom(node) {
    const el = node instanceof Element ? node : node && node.parentElement;
    return el ? el.closest(EDITABLE) : null;
  }

  function insertMasked(target, text) {
    reentrant = true;
    try {
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        target.focus();
        if (!document.execCommand('insertText', false, text)) {
          target.setRangeText(text, target.selectionStart, target.selectionEnd, 'end');
          target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        }
        return;
      }
      // Rich editors (ProseMirror, Quill, Lexical) handle a synthetic paste best:
      // it keeps their own paragraph/line-break logic.
      const before = target.textContent;
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      if (target.textContent === before) document.execCommand('insertText', false, text);
    } finally {
      reentrant = false;
    }
  }

  function onPaste(e) {
    if (reentrant || !settings.enabled) return;
    const target = editableFrom(e.target);
    if (!target) return;
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!text) return;
    if (allowNext) { allowNext = false; return; }

    const res = P.mask(text, vault, { disabled: settings.disabled, customTerms });
    if (!res.items.length) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    insertMasked(target, res.text);
    persist(res.items);
    showToast(res.items);
  }
  document.addEventListener('paste', onPaste, true);

  // ---------- toast (shadow DOM so page CSS can't touch it) ----------
  let host, root, hideTimer;
  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'pasteguard-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;right:20px;bottom:20px;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      .t{font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;background:#0B1220;color:#E6EDF7;border:1px solid #1F2A3D;border-radius:14px;padding:14px 16px;width:330px;box-shadow:0 18px 50px rgba(0,0,0,.35);transform:translateY(16px);opacity:0;transition:all .28s cubic-bezier(.2,.8,.2,1)}
      .t.show{transform:none;opacity:1}
      .h{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px}
      .s{color:#8FA3BF;margin:2px 0 10px 26px}
      .l{max-height:140px;overflow:auto;margin:0 0 12px;padding:0;list-style:none}
      .l li{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid #1A2436;font-size:12px}
      .ph{font-family:ui-monospace,Menlo,monospace;color:#5EEAD4}
      .v{color:#8FA3BF;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
      .b{display:flex;gap:8px}
      button{font:600 12px/1 inherit;font-family:inherit;border-radius:8px;padding:8px 10px;cursor:pointer;border:1px solid #2A3850;background:transparent;color:#E6EDF7}
      button.p{background:#14B8A6;border-color:#14B8A6;color:#04201D}
      .x{margin-left:auto;border:0;padding:2px 6px;color:#8FA3BF;font-size:16px}
    </style><div class="t" role="status" aria-live="polite"></div>`;
    document.documentElement.appendChild(host);
    const t = root.querySelector('.t');
    t.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    t.addEventListener('mouseleave', () => { hideTimer = setTimeout(hideToast, 2500); });
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peek = v => (v.length <= 6 ? '•'.repeat(v.length) : v.slice(0, 2) + '•••' + v.slice(-3));

  function showToast(items) {
    ensureHost();
    const t = root.querySelector('.t');
    const uniq = [...new Map(items.map(i => [i.placeholder, i])).values()];
    t.innerHTML = `
      <div class="h"><span>🛡️</span>PasteGuard masked ${items.length} item${items.length > 1 ? 's' : ''}<button class="x" title="Dismiss">×</button></div>
      <div class="s">${esc(P.summarize(items))}. Real values never left your browser.</div>
      <ul class="l">${uniq.slice(0, 8).map(i => `<li><span class="ph">${esc(i.placeholder)}</span><span class="v" title="${esc(i.value)}">${esc(peek(i.value))}</span></li>`).join('')}</ul>
      <div class="b"><button class="p" data-a="ok">Got it</button><button data-a="allow">Allow next paste unmasked</button></div>`;
    t.querySelector('.x').onclick = hideToast;
    t.querySelector('[data-a="ok"]').onclick = hideToast;
    t.querySelector('[data-a="allow"]').onclick = () => {
      allowNext = true;
      t.querySelector('.s').textContent = 'Your next paste will go through unmasked. Paste again to continue.';
      t.querySelector('.l').remove();
      t.querySelector('[data-a="allow"]').remove();
      clearTimeout(hideTimer); hideTimer = setTimeout(hideToast, 6000);
    };
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideToast, 8000);
  }
  function hideToast() { if (root) root.querySelector('.t').classList.remove('show'); }

  // ---------- restore real values in displayed text ----------
  const restored = new Map(); // text node -> [{start,end,value}]
  const HL = (window.CSS && CSS.highlights && typeof Highlight !== 'undefined') ? new Highlight() : null;
  if (HL) {
    CSS.highlights.set('pasteguard', HL);
    const st = document.createElement('style');
    st.textContent = '::highlight(pasteguard){background-color:rgba(20,184,166,.22);text-decoration:underline dotted #0F766E;}';
    (document.head || document.documentElement).appendChild(st);
  }
  const SKIP = EDITABLE + ', script, style, noscript, #pasteguard-host';

  function restorePass() {
    if (!settings.enabled || !settings.restore || !document.body) return;
    if (Object.keys(vault.byPh || {}).length) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue || n.nodeValue.indexOf('[') < 0) return NodeFilter.FILTER_REJECT;
          const p = n.parentElement;
          return p && !p.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        const src = n.nodeValue;
        let out = '', last = 0;
        const ranges = [];
        P.PH_RE.lastIndex = 0;
        let m;
        while ((m = P.PH_RE.exec(src))) {
          const hit = vault.byPh[m[0]];
          if (!hit) continue;
          out += src.slice(last, m.index);
          ranges.push({ start: out.length, end: out.length + hit.value.length, value: hit.value });
          out += hit.value;
          last = m.index + m[0].length;
        }
        if (!ranges.length) continue;
        out += src.slice(last);
        n.nodeValue = out;
        restored.set(n, (restored.get(n) || []).concat(ranges));
      }
    }
    paintHighlights();
  }

  function paintHighlights() {
    if (!HL) return;
    HL.clear();
    for (const [n, ranges] of restored) {
      if (!n.isConnected) { restored.delete(n); continue; }
      const keep = ranges.filter(r => n.nodeValue.slice(r.start, r.end) === r.value);
      if (!keep.length) { restored.delete(n); continue; }
      restored.set(n, keep);
      for (const r of keep) {
        const range = new Range();
        range.setStart(n, r.start);
        range.setEnd(n, r.end);
        HL.add(range);
      }
    }
  }
  function clearHighlights() { if (HL) HL.clear(); }

  let restoreTimer;
  // Throttle (not debounce) so values appear while a reply is still streaming
  function scheduleRestore() {
    if (restoreTimer) return;
    restoreTimer = setTimeout(() => { restoreTimer = null; restorePass(); }, 250);
  }
  new MutationObserver(scheduleRestore).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  load();
})();

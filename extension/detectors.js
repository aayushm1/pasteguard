/*
 * PasteGuard detection engine.
 * Runs 100% locally. Shared by the extension content script and the web playground.
 * Exposes globalThis.PasteGuard = { DETECTORS, scan, mask, restore, newVault, summarize }.
 */
(function (g) {
  'use strict';

  // ---------- validators ----------
  const digits = s => s.replace(/\D/g, '');

  function luhn(num) {
    let sum = 0, dbl = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let d = +num[i];
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  // Verhoeff checksum (used by Aadhaar)
  const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
  const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
  function verhoeff(num) {
    let c = 0;
    const a = num.split('').reverse().map(Number);
    for (let i = 0; i < a.length; i++) c = VD[c][VP[i % 8][a[i]]];
    return c === 0;
  }

  function ibanValid(raw) {
    const s = raw.replace(/\s/g, '').toUpperCase();
    if (s.length < 15 || s.length > 34) return false;
    const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
    let rem = 0;
    for (const ch of r) rem = (rem * 10 + +ch) % 97;
    return rem === 1;
  }

  // ---------- detectors (order = priority when matches overlap) ----------
  const DETECTORS = [
    { type: 'PRIVATE_KEY', label: 'Private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
    { type: 'API_KEY', label: 'API key',
      re: /\b(?:sk-(?:proj-|ant-(?:api\d{2}-)?)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{20,}|glpat-[A-Za-z0-9_-]{20})\b/g },
    { type: 'JWT', label: 'Auth token (JWT)', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
    { type: 'EMAIL', label: 'Email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
    { type: 'IBAN', label: 'IBAN', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, validate: ibanValid },
    { type: 'CARD', label: 'Card number', re: /(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g,
      validate: m => { const d = digits(m); return d.length >= 13 && d.length <= 19 && luhn(d); } },
    { type: 'SSN', label: 'US SSN', re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
    { type: 'AADHAAR', label: 'Aadhaar', re: /(?<![\d])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![\d])/g, validate: m => verhoeff(digits(m)) },
    { type: 'PAN', label: 'PAN (India)', re: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g },
    { type: 'IP', label: 'IP address', re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
    { type: 'PHONE', label: 'Phone', re: /(?<![\w+])(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d{2,5}(?:[ .-]?\d{2,5}){1,3}(?![\w])/g,
      validate: m => { const d = digits(m); return d.length >= 10 && d.length <= 15 && !/^(\d)\1+$/.test(d); } },
  ];

  const TYPE_LABEL = Object.fromEntries(DETECTORS.map(d => [d.type, d.label]));

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleanLabel = l => (l || 'TERM').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'TERM';

  /** Parse "Acme Corp => CLIENT" lines into [{term,label}] */
  function parseCustomTerms(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [term, label] = l.split(/\s*(?:=>|->|:)\s*/);
      return { term: term.trim(), label: cleanLabel(label || 'TERM') };
    }).filter(t => t.term.length >= 2);
  }

  /**
   * Find sensitive values. Returns non-overlapping findings sorted by position.
   * opts: { disabled: ['PHONE', ...], customTerms: [{term,label}] }
   */
  function scan(text, opts = {}) {
    const disabled = new Set(opts.disabled || []);
    const found = [];
    // Custom terms first: they are explicit user intent
    for (const { term, label } of opts.customTerms || []) {
      const re = new RegExp('(?<![\\w])' + escRe(term) + '(?![\\w])', 'gi');
      let m; while ((m = re.exec(text))) found.push({ start: m.index, end: m.index + m[0].length, value: m[0], type: label, custom: true });
    }
    for (const d of DETECTORS) {
      if (disabled.has(d.type)) continue;
      d.re.lastIndex = 0;
      let m;
      while ((m = d.re.exec(text))) {
        const v = m[0].replace(/[ .-]+$/, '');
        if (d.validate && !d.validate(v)) continue;
        found.push({ start: m.index, end: m.index + v.length, value: v, type: d.type });
      }
    }
    // On overlap the longer match wins (an email beats a client name inside its domain);
    // ties go to the earlier-registered, higher-priority detector.
    found.forEach((f, i) => { f.rank = i; });
    found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.rank - b.rank);
    const taken = [];
    for (const f of found) {
      if (!taken.some(t => f.start < t.end && t.start < f.end)) taken.push(f);
    }
    return taken.sort((a, b) => a.start - b.start);
  }

  function newVault() { return { byValue: {}, byPh: {}, counters: {} }; }
  const norm = (type, v) => (type === 'EMAIL' ? v.toLowerCase() : type === 'CARD' || type === 'PHONE' || type === 'AADHAAR' ? v.replace(/\D/g, '') : v.toLowerCase());

  /** Replace findings with stable placeholders like [EMAIL_1]. Same value => same placeholder. */
  function mask(text, vault, opts = {}) {
    vault = vault || newVault();
    const findings = scan(text, opts);
    let out = '', last = 0;
    const items = [];
    for (const f of findings) {
      const key = f.type + '|' + norm(f.type, f.value);
      let ph = vault.byValue[key];
      if (!ph) {
        vault.counters[f.type] = (vault.counters[f.type] || 0) + 1;
        ph = `[${f.type}_${vault.counters[f.type]}]`;
        vault.byValue[key] = ph;
        vault.byPh[ph] = { value: f.value, type: f.type };
      }
      out += text.slice(last, f.start) + ph;
      last = f.end;
      items.push({ placeholder: ph, value: f.value, type: f.type });
    }
    out += text.slice(last);
    return { text: out, items, vault };
  }

  const PH_RE = /\[([A-Z][A-Z0-9_]*?)_(\d+)\]/g;

  /** Swap placeholders back to real values. */
  function restore(text, vault) {
    if (!vault) return text;
    return text.replace(PH_RE, m => (vault.byPh[m] ? vault.byPh[m].value : m));
  }

  /** "2 emails, 1 phone" */
  function summarize(items) {
    const c = {};
    for (const i of items) c[i.type] = (c[i.type] || 0) + 1;
    const lc = l => (/^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l);
    return Object.entries(c).map(([t, n]) => `${n} ${lc(TYPE_LABEL[t] || t.toLowerCase().replace(/_/g, ' '))}${n > 1 ? 's' : ''}`).join(', ');
  }

  g.PasteGuard = { DETECTORS, TYPE_LABEL, PH_RE, scan, mask, restore, newVault, summarize, parseCustomTerms };
})(typeof globalThis !== 'undefined' ? globalThis : this);

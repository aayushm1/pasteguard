/*
 * PasteGuard detection engine (v0.2).
 * Runs 100% locally. Shared by the extension content script and the web playground.
 *
 * Three layers:
 *   1. Pattern detectors with checksums   (cards, IBAN, Aadhaar, keys, emails…)
 *   2. Context detectors                  ("CVV 123", "client ID HLX-00482", "finance officer Rohan Deshmukh")
 *   3. Inference + propagation            (names/orgs derived from email addresses; every later
 *                                          mention of a detected name, org or project is masked too)
 *
 * Exposes globalThis.PasteGuard = { DETECTORS, TYPE_LABEL, PH_RE, scan, mask, restore, newVault, summarize, parseCustomTerms }.
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

  // Shannon entropy in bits per character
  function entropy(s) {
    const f = {};
    for (const ch of s) f[ch] = (f[ch] || 0) + 1;
    let e = 0;
    for (const k in f) { const p = f[k] / s.length; e -= p * Math.log2(p); }
    return e;
  }

  // A secret-looking value: has digits AND letters, or is long and symbol-heavy
  const secretish = v => !/[[\]]/.test(v) && ((/\d/.test(v) && /[A-Za-z]/.test(v)) || (v.length >= 8 && /[^A-Za-z0-9]/.test(v) && /[A-Za-z]/.test(v)));

  // Random-looking token with no known prefix
  function highEntropy(v) {
    if (v.length < 20 || v.length > 200) return false;
    if (/^[0-9a-f]+$/i.test(v)) return false;                                   // hex hashes / commit SHAs
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return false; // UUIDs
    if (/^[a-z]+(?:[_-][a-z]+)*[_-]?\d{0,4}$/i.test(v)) return false;           // snake_case / kebab-case identifiers
    const nd = (v.match(/\d/g) || []).length;
    const hasLower = /[a-z]/.test(v), hasUpper = /[A-Z]/.test(v);
    return nd >= 2 && hasLower && hasUpper && entropy(v) >= 3.6;
  }

  // ---------- names ----------
  // Common given names (ambiguous English words like Will, May, Mark, Grace, Joy are left out on purpose)
  const FIRST_NAMES = ('Aarav Aayush Abhishek Aditi Aditya Advait Aisha Akash Amit Ananya Anika Anil Anjali Ankit Anushka Arjun Arnav Arun Aryan Ashok Ayesha Ayush ' +
    'Deepak Deepika Divya Diya Farhan Gaurav Harsh Imran Isha Ishaan Jaya Karan Kartik Kavya Kiran Krishna Kunal Lakshmi Manish Mansi Meera Mohit Myra ' +
    'Nandini Naveen Neha Nikhil Nisha Payal Pooja Prakash Pranav Priya Rahul Rajesh Ramesh Ravi Rekha Ritika Riya Rohan Rohit Saanvi Sachin Sahil Sameer ' +
    'Sanjay Shreya Shruti Siddharth Simran Sneha Sonia Sunil Suresh Swati Tanvi Tanya Tarun Varun Vihaan Vijay Vikram Vivek Yash Zara Ananya Rakesh Pankaj ' +
    'Aaron Adam Ahmed Alexander Alice Ali Amanda Amelia Amy Andrew Angela Anna Anthony Ashley Barbara Benjamin Betty Brandon Brenda Brian Carlos Carol ' +
    'Catherine Charles Charlotte Chloe Christopher Claire Cynthia Daniel David Deborah Dennis Diana Donald Donna Edward Elena Elizabeth Ella Emily Emma ' +
    'Eric Ethan Evelyn Fatima Gary George Gregory Hannah Harper Helen Henry Hiroshi Isabella Jacob James Jason Jeffrey Jennifer Jessica John Jonathan ' +
    'Jose Joseph Joshua Juan Julia Justin Karen Katherine Kenji Kenneth Kevin Kimberly Kyle Larry Laura Lauren Liam Linda Lisa Logan Lucas Lucy Luis ' +
    'Maria Mary Mason Megan Melissa Mia Michael Michelle Miguel Mohammed Nancy Natalie Nathan Nicholas Nina Noah Olivia Omar Oliver Owen Patricia Patrick ' +
    'Paul Peter Rachel Rebecca Richard Robert Ronald Ryan Samuel Sandra Sarah Scott Sharon Sofia Sophia Stephanie Stephen Steven Susan Thomas Timothy ' +
    'Tyler Victoria Wei William Yuki Zachary Zoe').split(/\s+/);
  const FIRST_SET = new Set(FIRST_NAMES);
  const NAME_STOP = new Set(['Team', 'All', 'Everyone', 'There', 'Folks', 'Guys', 'Sir', 'Madam', 'Again', 'Both', 'Support', 'Friends', 'Colleagues']);
  const CAP_WORD = "[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?";
  const isProperName = v => new RegExp(`^${CAP_WORD}(?:\\s+${CAP_WORD}){1,3}$`).test(v);

  const ORG_SUFFIX = 'Inc|LLC|LLP|Ltd|Limited|Pvt\\.? Ltd|Corp|Corporation|GmbH|PLC|Labs|Technologies|Technology|Systems|Solutions|Biosciences|Bio|Genomics|' +
    'Therapeutics|Pharma|Pharmaceuticals|Health|Healthcare|Capital|Ventures|Partners|Holdings|Bank|Financial|Insurance|Hospital|Hospitals|Clinic|' +
    'University|Institute|Foundation|Consulting|Analytics|Networks|Software|Industries|Enterprises|Motors|Energy|Logistics|Media|Studios';
  const ORG_STOP = new Set(['The', 'Our', 'Your', 'Their', 'Global', 'National', 'International', 'American', 'Indian', 'United', 'General', 'First', 'New',
    'Digital', 'Advanced', 'Applied', 'Smart', 'Tech', 'Data', 'Cloud', 'Bio', 'Health', 'Capital', 'Royal', 'Central', 'North', 'South', 'East', 'West']);
  const FREE_MAIL = new Set(['gmail', 'googlemail', 'yahoo', 'outlook', 'hotmail', 'live', 'icloud', 'me', 'aol', 'proton', 'protonmail', 'zoho', 'yandex', 'gmx', 'mail', 'rediffmail', 'example']);
  const GENERIC_LOCAL = new Set(['info', 'admin', 'support', 'sales', 'hello', 'contact', 'team', 'billing', 'noreply', 'no-reply', 'hr', 'careers', 'accounts', 'finance', 'help', 'jobs', 'office', 'mail', 'security', 'privacy', 'legal', 'press', 'marketing', 'ops', 'dev', 'test']);

  // ---------- detectors (order = priority when two matches of equal length overlap) ----------
  // `group`: mask only that capture group (the value), not the context words around it.
  const DETECTORS = [
    // --- secrets ---
    { type: 'PRIVATE_KEY', label: 'Private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
    { type: 'API_KEY', label: 'API key',
      re: /\b(?:sk-(?:proj-|ant-(?:api\d{2}-)?|or-v1-)?[A-Za-z0-9_-]{20,}|(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_]{16,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}|glpat-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|ya29\.[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{40,}|hf_[A-Za-z0-9]{30,}|r8_[A-Za-z0-9]{30,}|npm_[A-Za-z0-9]{36}|pypi-[A-Za-z0-9_-]{50,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|shp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}|dop_v1_[a-f0-9]{64})/g },
    { type: 'JWT', label: 'Auth token (JWT)', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
    { type: 'SECRET', label: 'Secret', group: 1, validate: secretish,
      re: /(?<![A-Za-z])(?:api[_ -]?key|apikey|secret(?:[_ -]?key)?|client[_ -]?secret|access[_ -]?(?:key|token)|auth[_ -]?token|refresh[_ -]?token|session[_ -]?token|token|password|passwd|pwd|pass ?phrase|private[_ -]?key|bearer|credentials?)(?:[_-]?(?:id|key))?(?:\s+(?:is|was|of|for \w+ is))?\s*[:=]?\s*["'`]?([^\s"'`,;)=]{6,})/gi },
    { type: 'SECRET', label: 'Secret', group: 1, re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:([^\s@\/]{3,})@/gi },
    { type: 'SECRET', label: 'Secret', group: 1, re: /[?&](?:token|access_token|api_key|apikey|key|sig|signature|secret|password|auth|code)=([^&\s#"']{6,})/gi },
    { type: 'PIN', label: 'PIN / OTP', group: 1, re: /\b(?:PIN|OTP|one[- ]time (?:password|code)|passcode|verification code)\s*(?:is|:|-|=)?\s*(\d{4,8})\b/gi },

    // --- financial ---
    { type: 'EMAIL', label: 'Email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
    { type: 'UPI', label: 'UPI ID', re: /\b[\w.-]{2,}@(?:ok(?:icici|hdfcbank|sbi|axis)|ybl|ibl|axl|paytm|upi|apl|icici|hdfcbank|sbi|axisbank|kotak|yesbank|barodampay|freecharge|fbl)\b/g },
    { type: 'IBAN', label: 'IBAN', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, validate: ibanValid },
    { type: 'CARD', label: 'Card number', re: /(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g,
      validate: m => { const d = digits(m); return d.length >= 13 && d.length <= 19 && luhn(d); } },
    { type: 'CVV', label: 'Card CVV', group: 1, re: /\b(?:CVV2?|CVC2?|CID|CSC|card security code|security code)\s*(?:code|number|no\.?)?\s*(?:is|:|-|=)?\s*(\d{3,4})\b/gi },
    { type: 'EXPIRY', label: 'Card expiry', group: 1,
      re: /\b(?:exp(?:iry|iration|\.)?(?:\s*date)?|valid\s+(?:thru|through|till|until)|expires?(?:\s+on)?)\s*[:\-]?\s*((?:0[1-9]|1[0-2])\s*\/\s*(?:20)?\d{2})\b/gi },
    { type: 'IFSC', label: 'IFSC code', re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
    { type: 'WALLET', label: 'Crypto wallet', re: /\b(?:0x[a-fA-F0-9]{40}|bc1[a-z0-9]{25,62})\b/g },

    // --- government IDs ---
    { type: 'SSN', label: 'US SSN', re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
    { type: 'AADHAAR', label: 'Aadhaar', re: /(?<![\d])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![\d])/g, validate: m => verhoeff(digits(m)) },
    { type: 'PAN', label: 'PAN (India)', re: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g },
    { type: 'GSTIN', label: 'GSTIN', re: /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g },
    { type: 'DOB', label: 'Date of birth', group: 1,
      re: /\b(?:DOB|D\.O\.B\.?|date of birth|birth\s*date|born(?:\s+on)?)\s*[:\-]?\s*(\d{1,2}[\/.\- ](?:\d{1,2}|[A-Za-z]{3,9})[\/.\- ]\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/gi },
    { type: 'ID', label: 'ID number', group: 1,
      validate: v => /\d/.test(v) && v.length >= 4 && !/^(?:19|20)\d{2}$/.test(v) && !/[[\]]/.test(v),
      re: /\b(?:client|customer|account|acct|a\/c|user|member|patient|employee|emp|staff|policy|study|trial|case|license|licence|IRB(?:\s+approval)?|MRN|medical\s+record|tax|TIN|EIN|VAT|registration|passport|driver'?s?\s+licen[cs]e|national|voter|subscriber|contract|loan|claim|application|applicant|routing|sort\s+code|SWIFT|BIC|UAN|insurance|aws\s+account|tenant|PIN\s*code|pincode|zip\s*code)\s*(?:ID|number|no\.?|num|#|code)?\s*(?:is|was|:|-|=|#)?\s*([A-Z0-9][A-Z0-9\-\/]{3,})\b/gi },

    // --- people, places, organisations ---
    { type: 'PERSON', label: 'Name', re: new RegExp(`\\b(?:Mr|Mrs|Ms|Mx|Miss|Dr|Prof|Shri|Smt)\\.?\\s+${CAP_WORD}(?:\\s+${CAP_WORD}){0,2}`, 'g') },
    { type: 'PERSON', label: 'Name', re: new RegExp(`\\b(?:${FIRST_NAMES.join('|')})(?:\\s+[A-Z]\\.)?\\s+${CAP_WORD}(?:\\s+${CAP_WORD})?\\b`, 'g'),
      validate: v => !/\s(?:Inc|Ltd|LLC|Corp|Road|Street|Avenue|Labs|Technologies)$/.test(v) },
    { type: 'PERSON', label: 'Name', group: 1, validate: isProperName,
      re: /\b(?:officer|manager|director|lead|engineer|analyst|coordinator|investigator|consultant|founder|co-founder|president|CEO|CFO|CTO|COO|CMO|VP|head|chair|contact|colleague|patient|candidate|applicant|employee|intern|doctor|nurse|assistant|owner|partner|counsel|attorney|lawyer|accountant|recruiter|scientist|researcher|professor|student|representative|rep|spokesperson)\s+((?:[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?\s+){1,2}[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?)/g },
    { type: 'PERSON', label: 'Name', group: 1, validate: isProperName,
      re: /\b(?:name|full name|patient name|customer name|account holder|card ?holder|signed by|prepared by|approved by|attn|attention|contact person)\s*[:\-]\s*([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z'-]+){1,3})/gi },
    { type: 'PERSON', label: 'Name', group: 1, validate: v => !NAME_STOP.has(v),
      re: /(?:^|[\n.!?]\s*)(?:Hi|Hello|Dear|Hey|Thanks|Thank you|Regards|Cheers|Best),?\s+([A-Z][a-z]{2,})\b/g },
    { type: 'ADDRESS', label: 'Address',
      re: /\b(?:(?:Flat|Apt|Apartment|Unit|Suite|House|Plot)\s*(?:No\.?)?\s*[\w-]+,?\s+)?\d{1,5}[A-Z]?,?\s+(?:[A-Z][A-Za-z]*\.?\s+){1,4}(?:Road|Rd|Street|St|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl|Terrace|Parkway|Pkwy|Highway|Hwy|Square|Sq|Circle|Cir|Marg|Nagar|Colony|Sector|Layout|Cross|Main)\b\.?(?:,?\s*(?:Suite|Ste|Apt|Unit|Floor|Fl|#)\s*[\w-]+)?(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*){0,2}(?:,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?|\s*[-,]?\s*\d{6}\b)?/g },
    { type: 'ORG', label: 'Organisation', re: new RegExp(`\\b(?:[A-Z][A-Za-z0-9&'-]+\\s+){1,3}(?:${ORG_SUFFIX})\\b\\.?`, 'g'),
      validate: v => !ORG_STOP.has(v.split(/\s+/)[0]) || v.split(/\s+/).length > 2 },
    { type: 'PROJECT', label: 'Project name', re: /\b(?:Project|Operation|Codename|Code name)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
      validate: v => !/\s(?:Manager|Management|Lead|Office|Director|Plan|Team|Charter|Board|Owner|Scope|Status|Update)$/.test(v) },

    // --- network ---
    { type: 'IP', label: 'IP address', re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
    { type: 'PHONE', label: 'Phone', re: /(?<![\w+-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d{2,5}(?:[ .-]?\d{2,5}){1,3}(?![\w-])/g,
      validate: m => { const d = digits(m); return d.length >= 10 && d.length <= 15 && !/^(\d)\1+$/.test(d); } },

    // --- last resort: random-looking strings with no known prefix ---
    { type: 'SECRET', label: 'Secret', re: /(?<![\w\[\]\/.@-])[A-Za-z0-9][A-Za-z0-9_-]{19,199}(?![\w\/.@-])/g, validate: highEntropy },
  ];

  const TYPE_LABEL = {};
  for (const d of DETECTORS) if (!TYPE_LABEL[d.type]) TYPE_LABEL[d.type] = d.label;
  // One toggle per type in the popup
  const DETECTOR_TYPES = Object.keys(TYPE_LABEL).map(type => ({ type, label: TYPE_LABEL[type] }));

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleanLabel = l => (l || 'TERM').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'TERM';
  const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  /** Parse "Acme Corp => CLIENT" lines into [{term,label}] */
  function parseCustomTerms(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [term, label] = l.split(/\s*(?:=>|->|:)\s*/);
      return { term: term.trim(), label: cleanLabel(label || 'TERM') };
    }).filter(t => t.term.length >= 2);
  }

  function findTerms(text, terms, found, flags) {
    for (const { term, label } of terms) {
      const re = new RegExp('(?<![\\w])' + escRe(term) + '(?![\\w])', 'g' + (flags === undefined ? 'i' : flags));
      let m; while ((m = re.exec(text))) found.push({ start: m.index, end: m.index + m[0].length, value: m[0], type: label });
    }
  }

  /** Names and organisations implied by email addresses: priya.shah@northwind.com → "Priya Shah", "Northwind" */
  function inferFromEmails(text, disabled) {
    const out = [];
    const re = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)\.[A-Za-z]{2,}/g;
    let m;
    while ((m = re.exec(text))) {
      const local = m[1].toLowerCase(), labels = m[2].toLowerCase().split('.');
      const parts = local.split(/[._-]/);
      if (!disabled.has('PERSON') && parts.length === 2 && parts.every(p => /^[a-z]{2,}$/.test(p)) && !GENERIC_LOCAL.has(parts[0])) {
        out.push({ term: parts.map(titleCase).join(' '), label: 'PERSON' });
        if (FIRST_SET.has(titleCase(parts[0]))) out.push({ term: titleCase(parts[0]), label: 'PERSON' });
      }
      let base = labels[labels.length - 1];
      if (['co', 'com', 'org', 'net', 'ac', 'gov'].includes(base) && labels.length > 1) base = labels[labels.length - 2];
      if (!disabled.has('ORG') && /^[a-z]{4,}$/.test(base) && !FREE_MAIL.has(base)) out.push({ term: titleCase(base), label: 'ORG' });
    }
    return out;
  }

  /** Once something is detected as a name/org/project, mask its other mentions too */
  function propagate(found, disabled) {
    const terms = [];
    for (const f of found) {
      if (f.type === 'PERSON') {
        const v = f.value.replace(/^(?:Mr|Mrs|Ms|Mx|Miss|Dr|Prof|Shri|Smt)\.?\s+/, '');
        terms.push({ term: v, label: 'PERSON' });
        const first = v.split(/\s+/)[0];
        if (v.includes(' ') && FIRST_SET.has(first)) terms.push({ term: first, label: 'PERSON' });
      } else if (f.type === 'ORG') {
        terms.push({ term: f.value.replace(/\.$/, ''), label: 'ORG' });
        const words = f.value.split(/\s+/);
        if (words.length >= 2 && words[0].length >= 4 && !ORG_STOP.has(words[0])) terms.push({ term: words[0], label: 'ORG' });
      } else if (f.type === 'PROJECT') {
        terms.push({ term: f.value, label: 'PROJECT' });
      }
    }
    return terms.filter(t => !disabled.has(t.label));
  }

  /**
   * Find sensitive values. Returns non-overlapping findings sorted by position.
   * opts: { disabled: ['PHONE', ...], customTerms: [{term,label}] }
   */
  function scan(text, opts = {}) {
    const disabled = new Set(opts.disabled || []);
    const found = [];
    // 1. Custom terms first: explicit user intent wins ties
    findTerms(text, opts.customTerms || [], found);
    // 2. Pattern + context detectors
    for (const d of DETECTORS) {
      if (disabled.has(d.type)) continue;
      d.re.lastIndex = 0;
      let m;
      while ((m = d.re.exec(text))) {
        if (m[0].length === 0) { d.re.lastIndex++; continue; }
        let v, start;
        if (d.group) {
          v = m[d.group];
          if (!v) continue;
          start = m.index + m[0].lastIndexOf(v);
        } else {
          v = m[0]; start = m.index;
        }
        v = v.replace(/[ .,:;-]+$/, '');
        if (!v || (d.validate && !d.validate(v))) continue;
        found.push({ start, end: start + v.length, value: v, type: d.type });
      }
    }
    // 3. Inference from emails + propagation of detected names/orgs/projects
    findTerms(text, inferFromEmails(text, disabled), found);
    findTerms(text, propagate(found, disabled), found, ''); // case-sensitive: "Helix" yes, "helix" (the word) no

    // On overlap the longer match wins (an email beats a name inside it);
    // ties go to the earlier one found (custom terms, then detector order).
    found.forEach((f, i) => { f.rank = i; });
    found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.rank - b.rank);
    const taken = [];
    for (const f of found) {
      if (!taken.some(t => f.start < t.end && t.start < f.end)) taken.push(f);
    }
    return taken.sort((a, b) => a.start - b.start);
  }

  function newVault() { return { byValue: {}, byPh: {}, counters: {} }; }
  const norm = (type, v) => (type === 'CARD' || type === 'PHONE' || type === 'AADHAAR' ? v.replace(/\D/g, '') : v.toLowerCase().replace(/\s+/g, ' '));

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
    const lc = l => (/^[A-Z][a-z]/.test(l) && l !== 'Aadhaar' ? l[0].toLowerCase() + l.slice(1) : l);
    const plural = (l, n) => (n === 1 ? l : /s$/.test(l) ? l + 'es' : l + 's');
    return Object.entries(c).map(([t, n]) => `${n} ${plural(lc(TYPE_LABEL[t] || t.toLowerCase().replace(/_/g, ' ')), n)}`).join(', ');
  }

  g.PasteGuard = { DETECTORS, DETECTOR_TYPES, TYPE_LABEL, PH_RE, scan, mask, restore, newVault, summarize, parseCustomTerms };
})(typeof globalThis !== 'undefined' ? globalThis : this);

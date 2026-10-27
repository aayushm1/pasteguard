const P = globalThis.PasteGuard;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function render() {
  const s = await chrome.storage.local.get(['enabled', 'disabled', 'customTerms', 'restore', 'stats']);
  const enabled = s.enabled !== false;
  $('enabled').checked = enabled;
  $('status').textContent = enabled ? 'Protecting your pastes' : 'Paused: pastes are not masked';
  $('restore').checked = s.restore !== false;
  if (document.activeElement !== $('terms')) $('terms').value = s.customTerms || '';

  // stats
  const st = s.stats || { total: 0, byType: {}, byDay: {} };
  const since = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  $('week').textContent = Object.entries(st.byDay || {}).filter(([d]) => d >= since).reduce((a, [, n]) => a + n, 0);
  $('total').textContent = st.total || 0;
  const top = Object.entries(st.byType || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = top.length ? top[0][1] : 1;
  $('bars').innerHTML = top.length
    ? top.map(([t, n]) => `<div class="bar"><span>${esc(P.TYPE_LABEL[t] || t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' '))}</span><i style="width:${(n / max) * 100}%"></i><span>${n}</span></div>`).join('')
    : '<div class="empty" style="margin-top:8px">Paste something sensitive into ChatGPT, Claude or Gemini to see it work.</div>';

  // detectors
  const disabled = new Set(s.disabled || []);
  $('dets').innerHTML = P.DETECTORS.map(d => `<label><input type="checkbox" data-t="${d.type}" ${disabled.has(d.type) ? '' : 'checked'}>${esc(d.label)}</label>`).join('');
  $('dets').querySelectorAll('input').forEach(cb => cb.onchange = saveDetectors);

  // vault
  let vault = null;
  try { vault = (await chrome.storage.session.get('vault')).vault; } catch (_) {}
  const rows = vault ? Object.entries(vault.byPh) : [];
  $('vault').innerHTML = rows.length
    ? rows.map(([ph, { value }]) => `<div class="row"><span class="ph">${esc(ph)}</span><span class="val" title="${esc(value)}">${esc(value)}</span></div>`).join('')
    : '<div class="empty">Nothing masked yet in this session.</div>';
}

async function saveDetectors() {
  const disabled = [...$('dets').querySelectorAll('input')].filter(c => !c.checked).map(c => c.dataset.t);
  await chrome.storage.local.set({ disabled });
}

$('enabled').onchange = async e => { await chrome.storage.local.set({ enabled: e.target.checked }); render(); };
$('restore').onchange = e => chrome.storage.local.set({ restore: e.target.checked });
let t;
$('terms').oninput = () => {
  clearTimeout(t);
  t = setTimeout(async () => {
    await chrome.storage.local.set({ customTerms: $('terms').value });
    $('saved').classList.add('on'); setTimeout(() => $('saved').classList.remove('on'), 1200);
  }, 400);
};
$('clear').onclick = async () => { try { await chrome.storage.session.remove('vault'); } catch (_) {} render(); };

render();

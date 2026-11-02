// Photoreal Render: snapshot the live view → /api/render → full-screen before/after.
const $ = s => document.querySelector(s);
const RATIOS = [[1,1],[4,3],[3,4],[3,2],[2,3],[16,9],[9,16],[21,9]];
const DB = 'dreamhome-renders';
function idb() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('r', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function dbAll() { const d = await idb(); return new Promise(res => { const q = d.transaction('r').objectStore('r').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => b.id - a.id)); q.onerror = () => res([]); }); }
async function dbPut(v) { const d = await idb(); return new Promise(res => { const t = d.transaction('r', 'readwrite'); t.objectStore('r').put(v); t.oncomplete = res; }); }
async function dbDel(id) { const d = await idb(); return new Promise(res => { const t = d.transaction('r', 'readwrite'); t.objectStore('r').delete(id); t.oncomplete = res; }); }

const ui = document.createElement('div'); ui.className = 'rx'; ui.innerHTML = `
<div class="rx-load"><div class="rx-shot"><img id="rxSnap" alt=""><div class="rx-scan"></div></div>
  <div class="rx-cap"><small>Developing your photograph</small><h2 id="rxTitle"></h2><p id="rxStep">Composing the shot…</p><div class="rx-bar"><i id="rxBar"></i></div>
  <button class="pill quiet" id="rxCancel">Cancel</button></div></div>
<div class="rx-res"><div class="rx-stage" id="rxStage"><img id="rxBefore" alt="3D preview"><div class="rx-after" id="rxAfterWrap"><img id="rxAfter" alt="Photoreal render"></div>
  <div class="rx-handle" id="rxHandle"><span>⟷</span></div><b class="rx-tag l">3D preview</b><b class="rx-tag r">Photoreal</b></div>
  <div class="rx-tools"><div class="rx-meta"><b id="rxName"></b><small id="rxSub"></small></div>
  <button class="pill" id="rxFlip">Show 3D</button><button class="pill" id="rxDl">Download</button><button class="pill gold" id="rxSave">Save to gallery</button><button class="pill" id="rxGal">Gallery</button><button class="x" id="rxClose" aria-label="Close">✕</button></div></div>
<div class="rx-err"><div><h2>That render didn't develop</h2><p id="rxErr"></p><button class="pill gold" id="rxRetry">Try again</button> <button class="pill quiet" id="rxErrClose">Close</button></div></div>
<div class="rx-gal"><div class="phead"><h2>Photo gallery</h2><button class="x" id="rxGalClose" aria-label="Close">✕</button></div><div class="rx-grid" id="rxGrid"></div></div>`;
document.body.append(ui);

let cur = null, ctl = null, timer = null;
const mode = m => { ui.className = 'rx on ' + m; };
const close = () => { ctl?.abort(); clearInterval(timer); ui.className = 'rx'; };

function setSplit(p) { p = Math.max(0, Math.min(1, p)); $('#rxAfterWrap').style.clipPath = `inset(0 0 0 ${p * 100}%)`; $('#rxHandle').style.left = p * 100 + '%'; }
(() => { const s = $('#rxStage'); let drag = false; const mv = e => { if (!drag) return; const r = s.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width); };
  s.addEventListener('pointerdown', e => { drag = true; s.setPointerCapture(e.pointerId); mv(e); }); s.addEventListener('pointermove', mv); s.addEventListener('pointerup', () => drag = false); })();

function snapshot(api) {
  const src = api.capture(); const max = 1408, k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  const a = c.width / c.height; const [w, h] = RATIOS.reduce((b, r) => Math.abs(r[0] / r[1] - a) < Math.abs(b[0] / b[1] - a) ? r : b);
  return { data: c.toDataURL('image/jpeg', 0.9), aspect: `${w}:${h}` };
}
const steps = ['Composing the shot…', 'Matching the light…', 'Laying real materials…', 'Growing the landscape…', 'Final grade…'];
async function run(api) {
  const meta = api.meta(); const snap = snapshot(api);
  cur = { id: Date.now(), before: snap.data, meta, aspect: snap.aspect };
  $('#rxSnap').src = snap.data; $('#rxTitle').textContent = `${meta.style} · ${meta.land}`; mode('loading');
  let t = 0; $('#rxBar').style.width = '4%'; clearInterval(timer);
  timer = setInterval(() => { t++; $('#rxStep').textContent = steps[Math.min(steps.length - 1, Math.floor(t / 5))]; $('#rxBar').style.width = Math.min(94, 4 + 90 * (1 - Math.exp(-t / 14))) + '%'; }, 1000);
  ctl = new AbortController();
  try {
    const r = await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: snap.data, aspect: snap.aspect, meta }), signal: ctl.signal });
    const j = await r.json().catch(() => ({ error: 'Unexpected response from the renderer.' }));
    if (!r.ok || !j.image) throw new Error(j.error || 'Render failed.');
    cur.after = j.image; cur.model = j.model; show(cur);
  } catch (e) { if (e.name === 'AbortError') return; $('#rxErr').textContent = e.message; mode('error'); }
  finally { clearInterval(timer); }
}
function show(r) {
  cur = r; $('#rxBefore').src = r.before; $('#rxAfter').src = r.after; setSplit(0.5);
  $('#rxName').textContent = `${r.meta.style} ${r.meta.size} · ${r.meta.land}`; $('#rxSub').textContent = `${r.meta.time} · drag the slider to compare`;
  $('#rxSave').textContent = r.saved ? 'Saved ✓' : 'Save to gallery'; $('#rxFlip').textContent = 'Show 3D'; mode('result');
}
async function gallery() {
  const g = $('#rxGrid'), all = await dbAll(); g.innerHTML = all.length ? '' : '<p class="rx-empty">No photographs yet. Press Render on a view you love.</p>';
  for (const r of all) { const d = document.createElement('div'); d.className = 'rx-card'; d.innerHTML = `<img alt="" src="${r.after}"><span><b>${r.meta.style}</b><i>${r.meta.land}</i></span><button class="x" aria-label="Delete">✕</button>`;
    d.querySelector('img').onclick = () => show(r); d.querySelector('button').onclick = async () => { await dbDel(r.id); gallery(); }; g.append(d); }
  mode('gallery');
}
export function initRender(api) {
  const btn = document.createElement('button'); btn.className = 'pill gold'; btn.id = 'renderBtn'; btn.innerHTML = '✦ Render'; btn.title = 'Turn this exact view into a photoreal photograph';
  $('#saveBtn').before(btn); btn.onclick = () => run(api);
  const gb = document.createElement('button'); gb.className = 'pill'; gb.id = 'galBtn'; gb.textContent = 'Photos'; btn.before(gb); gb.onclick = gallery;
  $('#rxCancel').onclick = close; $('#rxClose').onclick = close; $('#rxErrClose').onclick = close; $('#rxGalClose').onclick = close;
  $('#rxRetry').onclick = () => run(api); $('#rxGal').onclick = gallery;
  $('#rxFlip').onclick = () => { const on = $('#rxAfterWrap').style.clipPath.includes('inset(0px 0px 0px 100%)') || $('#rxAfterWrap').style.clipPath.includes(' 100%)'); setSplit(on ? 0 : 1); $('#rxFlip').textContent = on ? 'Show 3D' : 'Show photo'; };
  $('#rxDl').onclick = () => { const a = document.createElement('a'); a.href = cur.after; a.download = `maison-reve-${cur.meta.land.replace(/\W+/g, '-').toLowerCase()}-${cur.id}.${cur.after.includes('png') ? 'png' : 'jpg'}`; a.click(); };
  $('#rxSave').onclick = async () => { if (!cur?.after || cur.saved) return; cur.saved = true; await dbPut(cur); $('#rxSave').textContent = 'Saved ✓'; };
  addEventListener('keydown', e => { if (e.key === 'Escape' && ui.classList.contains('on')) close(); });
  window.__dhRender = { run: () => run(api), cur: () => cur };
}

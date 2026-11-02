import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { LANDS, TIMES, CAT_ORDER, CAT_NAMES, heroView } from './lands.js';
import { buildHome, setNight, materials } from './home.js';

const DH = window.DH, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const THUMB = params.get('thumb');
const coarse = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
const qPref = params.get('q') || localStorage.getItem('dreamhome.q') || (coarse ? 'low' : 'hi');
const Q = { hi: qPref !== 'low' };

// ---------- renderer ----------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !Q.hi || true, powerPreference: 'high-performance', preserveDrawingBuffer: !!THUMB || true });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.hi ? 2 : 1.25));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = Q.hi ? THREE.PCFShadowMap : THREE.PCFShadowMap;
const world = new World(renderer, Q);
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 40000);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 18, maxDistance: 520, maxPolarAngle: Math.PI * 0.495, rotateSpeed: 0.55, zoomSpeed: 0.9, panSpeed: 0.6, screenSpacePanning: false });
let composer = null, bloom = null;
function makeComposer() {
  composer = null; if (!Q.hi) return;
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(world.scene, camera));
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); c.rgb=min(c.rgb,vec3(4.)); if(any(isnan(c.rgb))) c.rgb=vec3(0.); gl_FragColor=c; }' }));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), +(params.get('bloom') ?? 0.2), 0.45, 1.8); composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
makeComposer();
function tuneBloom() { if (!bloom) return; bloom.enabled = world.night > 0.5 && params.get('bloom') !== '0'; bloom.strength = 0.35; }
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  // keep the subject centred in the open space between the two glass panels
  const side = !THUMB && w > 860 ? (document.querySelector('.panel.left')?.offsetWidth || 0) - (document.querySelector('.panel.right')?.offsetWidth || 0) : 0;
  if (side) camera.setViewOffset(w, h, -side / 2, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix(); composer?.setSize(w, h); }
addEventListener('resize', resize);

// ---------- state ----------
const DEF = { setting: 'malibu', style: 'glass', layout: 'single', size: 'residence', x: null, z: null, rot: 0, time: null };
const st = { ...DEF };
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1)); const o = {};
  for (const k of ['setting', 'style', 'layout', 'size', 'time']) if (h.get(k)) o[k] = h.get(k);
  for (const k of ['x', 'z', 'rot']) if (h.get(k) != null && !isNaN(+h.get(k))) o[k] = +h.get(k);
  if (o.setting && !LANDS[o.setting]) delete o.setting; if (o.time && !TIMES[o.time]) delete o.time;
  return o;
}
function hashOf(s = st) { return `setting=${s.setting}&style=${s.style}&layout=${s.layout}&size=${s.size}&x=${(+s.x).toFixed(1)}&z=${(+s.z).toFixed(1)}&rot=${Math.round(s.rot)}&time=${s.time}`; }

// ---------- home ----------
let home = null, homeAnim = 0; const homePivot = new THREE.Group(); world.scene.add(homePivot);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96), new THREE.MeshBasicMaterial({ color: 0xc9a86a, transparent: true, opacity: 0, depthWrite: false, fog: false }));
ring.rotation.x = -Math.PI / 2; world.scene.add(ring);
function siteY(b, x, z, rot) {
  const [x0, x1, z0, z1] = b, c = Math.cos(rot), s = Math.sin(rot); let mx = -Infinity;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { const lx = x0 + (x1 - x0) * i / 6, lz = z0 + (z1 - z0) * j / 6; mx = Math.max(mx, world.height(x + lx * c + lz * s, z - lx * s + lz * c)); }
  return Math.max(mx, world.hasWater ? 1.2 : -50) + 0.15;
}
function rebuildHome(pop = true) {
  if (home) { homePivot.remove(home.group); home.group.traverse(o => { o.geometry?.dispose(); }); }
  home = buildHome(st); homePivot.add(home.group); placeHome(); if (pop) homeAnim = 0.0001; else home.group.scale.setScalar(1);
  setNight(world.night); updatePrice();
}
function placeHome() {
  if (!home) return; const r = THREE.MathUtils.degToRad(st.rot);
  homePivot.position.set(st.x, siteY(home.bounds, st.x, st.z, r), st.z); homePivot.rotation.y = r;
  world.clearAround(st.x, st.z, home.radius + 16); world.aimShadow(homePivot.position);
}

// ---------- land switching ----------
let busy = false;
function frameCamera(instant = true) {
  const L = LANDS[st.setting], v = heroView(L), target = new THREE.Vector3(st.x, homePivot.position.y + 4, st.z);
  const az = v.az + THREE.MathUtils.degToRad(st.rot) * 0 , pol = v.pol;
  const D = v.dist * (SCALEF[st.size] || 1) * (innerWidth < 860 && innerWidth < innerHeight ? 1.7 : 1); let pos = null, bestBad = 1e9;
  // pick the hero azimuth nearest the authored one whose sightline to the home clears the terrain
  for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2, 3.14]) for (const p of [pol, pol - 0.12, pol - 0.25]) {
    const c = new THREE.Vector3(Math.sin(p) * Math.sin(az + off), Math.cos(p), Math.sin(p) * Math.cos(az + off)).multiplyScalar(D).add(target);
    let bad = Math.max(0, world.height(c.x, c.z) + 3 - c.y) * 3;
    for (let i = 1; i < 14; i++) { const t = i / 14, x = target.x + (c.x - target.x) * t, z = target.z + (c.z - target.z) * t, y = target.y + (c.y - target.y) * t; bad += Math.max(0, world.height(x, z) + 1 - y); }
    bad += Math.abs(off) * 2 + (pol - p) * 10;
    if (bad < bestBad) { bestBad = bad; pos = c; }
  }
  if (instant) { controls.target.copy(target); camera.position.copy(pos); controls.update(); }
  return { target, pos };
}
const SCALEF = { retreat: 0.85, residence: 1, estate: 1.2, compound: 1.45 };
function defaultSite(L) {
  if (L.site) return { x: L.site[0], z: L.site[1] };
  world.prep(L);
  let best = null; // flattest dry spot near the hero point (height spread over the footprint)
  for (let r = 0; r <= 160; r += 8) for (let a = 0; a < 6.283; a += r ? 4 / r + 0.08 : 7) { const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (world.isWater(x, z)) continue; let lo = 1e9, hi = -1e9, wet = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const hx = x + i * 16, hz = z + j * 12, y = world.height(hx, hz); lo = Math.min(lo, y); hi = Math.max(hi, y); if (world.isWater(hx, hz)) wet++; }
    const sc = (hi - lo) * 3 + wet * 40 + r * 0.05; if (!best || sc < best.sc) best = { x, z, sc }; }
  return best || { x: 0, z: 0 };
}
function loadLand(id, keepSite = false, timeId) {
  const L = LANDS[id]; st.setting = id; st.time = timeId || L.time;
  if (!keepSite || st.x == null) { const s = defaultSite(L); st.x = s.x; st.z = s.z; st.rot = L.rot || 0; }
  (world.pad = { L, x: st.x, z: st.z }, world.build(L, st.time)); setNight(world.night); rebuildHome(false); frameCamera(true); syncUI();
}
async function teleport(id) {
  if (busy || id === st.setting) return; busy = true; const fade = $('#fade');
  $('#fadeTitle').textContent = LANDS[id].name; $('#fadeSub').textContent = 'Inspired by ' + LANDS[id].inspired;
  fade.classList.add('on'); await sleep(450);
  loadLand(id); intro = 1; await sleep(60); fade.classList.remove('on'); busy = false; toast(`Welcome to ${LANDS[id].name}`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let intro = 0; // small fly-in after teleport

// ---------- placing by click ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (moved > 6 || dt > 600) return; const p = pickGround(e); if (!p) return;
  if (world.isWater(p.x, p.z)) return toast('That spot is underwater — pick dry land.');
  if (world.slope(p.x, p.z) > 0.9) return toast('Too steep to build there.');
  if (Math.hypot(p.x, p.z) > 260) return toast('Stay a little closer to the heart of the site.');
  const dx = p.x - st.x, dz = p.z - st.z; st.x = p.x; st.z = p.z; placeHome(); homeAnim = 0.0001;
  controls.target.x += dx; controls.target.z += dz; camera.position.x += dx; camera.position.z += dz; controls.target.y = homePivot.position.y + 4;
  syncHash(); $('#hint')?.classList.add('gone');
});
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || e.buttons) return; const p = pickGround(e); if (p && home) { ring.position.set(p.x, world.height(p.x, p.z) + 0.3, p.z); ring.scale.setScalar(home.radius * 0.9); ring.material.opacity = world.isWater(p.x, p.z) || world.slope(p.x, p.z) > 0.9 ? 0.12 : 0.5; ring.material.color.set(world.isWater(p.x, p.z) ? 0xd06060 : 0xc9a86a); } else ring.material.opacity = 0; });
canvas.addEventListener('pointerleave', () => ring.material.opacity = 0);
function pickGround(e) {
  const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  // march the analytic height field — robust and independent of meshes
  const o = ray.ray.origin, d = ray.ray.direction; let t = 0, prev = o.y - world.height(o.x, o.z);
  for (let i = 0; i < 600 && t < 1500; i++) { const step = Math.max(0.5, t * 0.01); t += step; const x = o.x + d.x * t, z = o.z + d.z * t, y = o.y + d.y * t; const hh = Math.max(world.height(x, z), world.hasWater ? 0 : -1e9), f = y - hh;
    if (f < 0) { let a = t - step, b = t; for (let k = 0; k < 12; k++) { const m = (a + b) / 2, yy = o.y + d.y * m, xx = o.x + d.x * m, zz = o.z + d.z * m; if (yy - Math.max(world.height(xx, zz), world.hasWater ? 0 : -1e9) < 0) b = m; else a = m; } return { x: o.x + d.x * b, z: o.z + d.z * b }; } prev = f; }
  return null;
}

// ---------- UI ----------
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
let landCat = null;
function buildLandPanel() {
  const chips = $('#landCats'), list = $('#landList'); chips.innerHTML = ''; list.innerHTML = '';
  for (const c of CAT_ORDER) { const b = el('button', 'chip', CAT_NAMES[c]); b.dataset.cat = c; b.onclick = () => { const sec = $(`#sec-${c}`); sec?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; chips.append(b); }
  for (const c of CAT_ORDER) {
    const sec = el('section', 'landsec'); sec.id = 'sec-' + c; sec.append(el('h3', 'sec-title', CAT_NAMES[c]));
    for (const [id, L] of Object.entries(LANDS).filter(([, L]) => L.cat === c)) {
      const b = el('button', 'lcard', `<img loading="lazy" alt="" src="/3d/thumbs/land-${id}.webp"><span class="lmeta"><b>${L.name}</b><i>Inspired by ${L.inspired}</i></span>`); b.dataset.land = id; b.onclick = () => { teleport(id); closeSheet(); }; sec.append(b);
    }
    list.append(sec);
  }
  list.addEventListener('scroll', () => { let cur = CAT_ORDER[0]; for (const c of CAT_ORDER) { const s = $(`#sec-${c}`); if (s.offsetTop - list.offsetTop <= list.scrollTop + 30) cur = c; } $$('#landCats .chip').forEach(b => b.classList.toggle('on', b.dataset.cat === cur)); }, { passive: true });
}
function buildHomePanel() {
  const sg = $('#styleGrid'); sg.innerHTML = '';
  for (const s of DH.STYLES) { const b = el('button', 'scard', `<img loading="lazy" alt="" src="/3d/thumbs/style-${s.id}.webp"><b>${s.name}</b>`); b.dataset.style = s.id; b.title = s.line; b.onclick = () => { st.style = s.id; rebuildHome(); syncUI(); }; sg.append(b); }
  const lg = $('#layoutRow'); lg.innerHTML = '';
  for (const l of DH.LAYOUTS) { const b = el('button', 'seg', `<svg viewBox="0 0 64 48" aria-hidden="true"><path d="${l.icon}"/></svg><span>${l.name}</span>`); b.dataset.layout = l.id; b.onclick = () => { st.layout = l.id; rebuildHome(); syncUI(); }; lg.append(b); }
  const zg = $('#sizeRow'); zg.innerHTML = '';
  for (const z of DH.SIZES) { const b = el('button', 'seg', `<span>${z.name}</span><small>${z.sqft.toLocaleString()} sq ft</small>`); b.dataset.size = z.id; b.onclick = () => { st.size = z.id; rebuildHome(); syncUI(); }; zg.append(b); }
  const tg = $('#timeRow'); tg.innerHTML = '';
  for (const [id, T] of Object.entries(TIMES)) { const b = el('button', 'seg', `<span>${T.name}</span>`); b.dataset.time = id; b.onclick = () => { st.time = id; world.setTime(id); setNight(world.night); placeHome(); syncUI(); }; tg.append(b); }
  const rot = $('#rot'); rot.oninput = () => { st.rot = +rot.value; placeHome(); $('#rotVal').textContent = st.rot + '°'; syncHash(); };
  $('#rotL').onclick = () => spin(-15); $('#rotR').onclick = () => spin(15);
}
function spin(d) { st.rot = ((st.rot + d) % 360 + 360) % 360; placeHome(); syncUI(); }
function syncUI() {
  $$('.lcard').forEach(b => b.classList.toggle('on', b.dataset.land === st.setting));
  $$('[data-style]').forEach(b => b.classList.toggle('on', b.dataset.style === st.style));
  $$('[data-layout]').forEach(b => b.classList.toggle('on', b.dataset.layout === st.layout));
  $$('[data-size]').forEach(b => b.classList.toggle('on', b.dataset.size === st.size));
  $$('[data-time]').forEach(b => b.classList.toggle('on', b.dataset.time === st.time));
  $('#rot').value = st.rot; $('#rotVal').textContent = Math.round(st.rot) + '°';
  const L = LANDS[st.setting]; $('#placeName').textContent = L.name; $('#placeSub').textContent = 'Inspired by ' + L.inspired; $('#placeLine').textContent = L.line;
  $$('#landCats .chip').forEach(b => b.classList.toggle('on', b.dataset.cat === L.cat));
  updatePrice(); syncHash();
}
function updatePrice() {
  const S = DH.styleOf(st.style), Z = DH.SIZES.find(z => z.id === st.size), Lo = DH.LAYOUTS.find(l => l.id === st.layout);
  $('#sumTitle').textContent = `${S.name} · ${Lo.name}`; $('#sumMeta').textContent = `${Z.sqft.toLocaleString()} sq ft · ${Z.beds} bd · ${Z.baths} ba`;
  $('#sumPrice').textContent = fmt(DH.price(st));
}
const fmt = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : '$' + Math.round(n / 1e3) + 'K';
let hashT; function syncHash() { clearTimeout(hashT); hashT = setTimeout(() => history.replaceState(null, '', '#' + hashOf()), 150); }
let toastT; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

// ---------- save / share / compare ----------
const KEY = 'dreamhome.saved.v1';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
function snapshot(w = 480) { render(); const c = document.createElement('canvas'); const r = canvas.height / canvas.width; c.width = w; c.height = Math.round(w * r); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.78); }
function save() {
  const list = loadSaved(); const S = DH.styleOf(st.style);
  const item = { id: Date.now().toString(36), setting: st.setting, style: st.style, layout: st.layout, size: st.size, x: st.x, z: st.z, rot: st.rot, time: st.time, mode: '3d', thumb: snapshot(), name: `${S.name} at ${LANDS[st.setting].name}`, price: DH.price(st), savedAt: Date.now() };
  list.unshift(item); try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12))); } catch { item.thumb = null; localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6))); }
  renderSaved(); toast('Saved to your homes'); $('#savedCount').textContent = loadSaved().length;
}
async function share() {
  const url = location.origin + '/#' + hashOf();
  try { if (navigator.share && coarse) await navigator.share({ title: 'My dream home', url }); else { await navigator.clipboard.writeText(url); toast('Link copied — it opens this exact view'); } } catch { prompt('Copy this link', url); }
}
let cmp = new Set();
function renderSaved() {
  const list = loadSaved(), box = $('#savedList'); box.innerHTML = ''; $('#savedCount').textContent = list.length;
  if (!list.length) { box.append(el('p', 'empty', 'Nothing saved yet. Design a home and tap <b>Save</b>.')); }
  for (const it of list) {
    const S = DH.styleOf(it.style), Ln = LANDS[it.setting];
    const card = el('div', 'svcard' + (cmp.has(it.id) ? ' cmp' : ''), `<div class="svimg">${it.thumb ? `<img alt="" src="${it.thumb}">` : `<img alt="" src="/3d/thumbs/land-${it.setting}.webp">`}</div><div class="svbody"><b>${it.name || S.name}</b><small>${Ln ? Ln.name : it.setting} · ${DH.SIZES.find(z => z.id === it.size)?.name} · ${fmt(DH.price(it))}</small><div class="svact"><button data-open>Open</button><button data-cmp>${cmp.has(it.id) ? '✓ Comparing' : 'Compare'}</button><button data-del aria-label="Delete">✕</button></div></div>`);
    card.querySelector('[data-open]').onclick = () => openDesign(it);
    card.querySelector('[data-cmp]').onclick = () => { cmp.has(it.id) ? cmp.delete(it.id) : (cmp.size >= 3 ? toast('Compare up to three') : cmp.add(it.id)); renderSaved(); };
    card.querySelector('[data-del]').onclick = () => { localStorage.setItem(KEY, JSON.stringify(loadSaved().filter(x => x.id !== it.id))); cmp.delete(it.id); renderSaved(); };
    box.append(card);
  }
  $('#cmpBtn').disabled = cmp.size < 2; $('#cmpBtn').textContent = cmp.size < 2 ? 'Pick 2–3 to compare' : `Compare ${cmp.size}`;
}
function openDesign(it) {
  $('#savedDrawer').classList.remove('on');
  Object.assign(st, { style: it.style, layout: it.layout, size: it.size });
  if (it.setting !== st.setting || it.x == null) { st.x = it.x ?? null; st.z = it.z ?? null; st.rot = it.rot ?? 0; const keep = it.x != null; const L = LANDS[it.setting]; st.setting = it.setting; st.time = it.time || L.time; if (!keep) { const s = defaultSite(L); st.x = s.x; st.z = s.z; }
    (world.pad = { L, x: st.x, z: st.z }, world.build(L, st.time)); rebuildHome(false); frameCamera(true); }
  else { st.x = it.x; st.z = it.z; st.rot = it.rot || 0; if (it.time && it.time !== st.time) { st.time = it.time; world.setTime(it.time); } rebuildHome(); frameCamera(true); }
  setNight(world.night); syncUI();
}
function showCompare() {
  const items = loadSaved().filter(x => cmp.has(x.id)); const g = $('#cmpGrid'); g.innerHTML = '';
  g.style.setProperty('--n', items.length);
  for (const it of items) { const S = DH.styleOf(it.style), Z = DH.SIZES.find(z => z.id === it.size), Lo = DH.LAYOUTS.find(l => l.id === it.layout), Ln = LANDS[it.setting];
    g.append(el('div', 'cmpcol', `<img alt="" src="${it.thumb || `/3d/thumbs/land-${it.setting}.webp`}"><h4>${S.name}</h4><dl><dt>Landscape</dt><dd>${Ln?.name || it.setting}</dd><dt>Layout</dt><dd>${Lo.name}</dd><dt>Size</dt><dd>${Z.sqft.toLocaleString()} sq ft · ${Z.beds} bd</dd><dt>Light</dt><dd>${TIMES[it.time]?.name || '—'}</dd><dt>Estimate</dt><dd class="p">${fmt(DH.price(it))}</dd></dl>`)); }
  $('#cmpModal').classList.add('on');
}

// ---------- quality ----------
function setQuality(v) { localStorage.setItem('dreamhome.q', v); const u = new URL(location.href); u.searchParams.delete('q'); location.replace(u.pathname + u.search + location.hash); location.reload(); }

// ---------- sheet (mobile) ----------
function openSheet(tab) { document.body.dataset.sheet = tab; }
function closeSheet() { if (coarse || innerWidth < 860) delete document.body.dataset.sheet; }

// ---------- loop ----------
const clock = new THREE.Timer();
function render() { if (composer) composer.render(); else renderer.render(world.scene, camera); }
let frames = 0;
function loop() {
  clock.update(); const dt = Math.min(clock.getDelta(), 0.05);
  world.update(dt, camera);
  if (home && homeAnim > 0) { homeAnim = Math.min(1, homeAnim + dt * 2.6); const k = homeAnim, e = 1 - Math.pow(1 - k, 3), over = 1 + Math.sin(k * Math.PI) * 0.035; home.group.scale.set(e * over, Math.max(0.001, e * over), e * over); if (k >= 1) { homeAnim = 0; home.group.scale.setScalar(1); } }
  if (intro > 0) { intro = Math.max(0, intro - dt * 0.9); const d = controls.target.clone().sub(camera.position); camera.position.addScaledVector(d, -dt * intro * 0.5); }
  controls.update();
  const gy = world.height(camera.position.x, camera.position.z); const minY = Math.max(gy, world.hasWater ? 0 : -1e9) + 2.5; if (camera.position.y < minY) camera.position.y = minY;
  ring.rotation.z += dt * 0.3;
  render(); frames++;
  if (!paused) requestAnimationFrame(loop);
}
let paused = false;

// ---------- boot ----------
function boot() {
  resize();
  Object.assign(st, readHash());
  if (THUMB) return thumbMode();
  buildLandPanel(); buildHomePanel();
  const L = LANDS[st.setting]; const hadSite = st.x != null;
  st.time = st.time || L.time; if (!hadSite) { const s = defaultSite(L); st.x = s.x; st.z = s.z; st.rot = st.rot || L.rot || 0; }
  (world.pad = { L, x: st.x, z: st.z }, world.build(L, st.time)); setNight(world.night); rebuildHome(false); frameCamera(true); syncUI(); renderSaved();
  world.onTime = () => { setNight(world.night); tuneBloom(); }; tuneBloom();
  $('#saveBtn').onclick = save; $('#shareBtn').onclick = share;
  $('#savedBtn').onclick = () => { renderSaved(); $('#savedDrawer').classList.add('on'); };
  $('#savedClose').onclick = () => $('#savedDrawer').classList.remove('on');
  $('#cmpBtn').onclick = showCompare; $('#cmpClose').onclick = () => $('#cmpModal').classList.remove('on');
  $('#photoBtn').onclick = () => { location.href = '/photo.html#' + `setting=${st.setting}&style=${st.style}&layout=${st.layout}&size=${st.size}`; };
  $('#qBtn').textContent = Q.hi ? 'Quality: High' : 'Quality: Lite'; $('#qBtn').onclick = () => setQuality(Q.hi ? 'low' : 'hi');
  $$('[data-tab]').forEach(b => b.onclick = () => document.body.dataset.sheet === b.dataset.tab ? delete document.body.dataset.sheet : openSheet(b.dataset.tab));
  $$('[data-sheetclose]').forEach(b => b.onclick = () => delete document.body.dataset.sheet);
  addEventListener('keydown', e => { if (e.target.closest('input,textarea')) return; if (e.key === 'r' || e.key === 'R') spin(e.shiftKey ? -15 : 15); if (e.key === 'Escape') { $('#savedDrawer').classList.remove('on'); $('#cmpModal').classList.remove('on'); } });
  addEventListener('hashchange', () => { const h = readHash(); if (h.setting && h.setting !== st.setting) { Object.assign(st, h); loadLand(st.setting, h.x != null, h.time); } });
  document.body.classList.add('ready'); setTimeout(() => $('#hint')?.classList.add('gone'), 9000);
  loop();
  window.__dh = { pause: () => { paused = true; }, step: (n = 1) => { for (let i = 0; i < n; i++) loop(); }, st, world, camera, controls, frames: () => frames, teleport, rebuildHome, save, hashOf };
}

// Headless thumbnail renderer: ?thumb=land:malibu | style:glass
async function thumbMode() {
  document.body.classList.add('thumb');
  const [kind, id] = THUMB.split(':');
  if (kind === 'land') { const L = LANDS[id]; st.setting = id; st.time = L.time; const s = defaultSite(L); st.x = s.x; st.z = s.z; st.rot = L.rot || 0; (world.pad = { L, x: st.x, z: st.z }, world.build(L, st.time)); rebuildHome(false); frameCamera(true); const v = heroView(L); camera.position.sub(controls.target).multiplyScalar(1.6).add(controls.target); camera.position.y += 15; controls.update(); }
  else { const L = LANDS[params.get('land') || 'tahoe']; Object.assign(st, { setting: L.id, style: id, layout: 'single', size: 'residence' }); st.time = 'golden'; const s = defaultSite(L); st.x = s.x; st.z = s.z; (world.pad = { L, x: st.x, z: st.z }, world.build(L, st.time)); rebuildHome(false); frameCamera(true); camera.position.sub(controls.target).multiplyScalar(0.6).add(controls.target); controls.update(); }
  setNight(world.night);
  for (let i = 0; i < 4; i++) { world.update(0.016, camera); controls.update(); render(); await sleep(30); }
  window.__thumbReady = true;
}
boot();

// Parametric procedural architecture: six styles x four plans x four scales, rebuilt instantly.
import * as THREE from 'three';
import { vnoise, rng } from './noise.js';

// ---------- procedural textures (1 texture unit = `m` metres) ----------
function canvasTex(px, m, draw, color = true) {
  const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'); draw(g, px);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / m, 1 / m); t.anisotropy = 8; if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const speckle = (g, s, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${a * Math.random()})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
const TEX = {};
function textures() {
  if (TEX.ok) return TEX;
  TEX.stucco = canvasTex(256, 3, (g, s) => { g.fillStyle = '#efe4d0'; g.fillRect(0, 0, s, s); speckle(g, s, 9000, 0.06); });
  TEX.plaster = canvasTex(256, 3, (g, s) => { g.fillStyle = '#ece8e0'; g.fillRect(0, 0, s, s); speckle(g, s, 6000, 0.04); });
  TEX.cedar = canvasTex(256, 2.4, (g, s) => { g.fillStyle = '#2a2420'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += s / 16) { g.fillStyle = `hsl(25,${12 + Math.random() * 8}%,${10 + Math.random() * 7}%)`; g.fillRect(x, 0, s / 16 - 2, s); g.fillStyle = '#0d0b0a'; g.fillRect(x + s / 16 - 2, 0, 2, s); } speckle(g, s, 4000, 0.08); });
  TEX.boards = canvasTex(256, 2.4, (g, s) => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += s / 6) { g.fillStyle = '#d6d2c8'; g.fillRect(x, 0, 5, s); g.fillStyle = '#ffffff'; g.fillRect(x + 5, 0, 3, s); } speckle(g, s, 2500, 0.03); });
  TEX.concrete = canvasTex(512, 4, (g, s) => { g.fillStyle = '#a9a69e'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += s / 20) { g.fillStyle = `rgba(${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},0.0)`; g.fillStyle = `hsla(40,4%,${58 + Math.random() * 10}%,0.55)`; g.fillRect(0, y, s, s / 20 - 1); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y + s / 20 - 1, s, 1); } speckle(g, s, 20000, 0.08); });
  TEX.stone = canvasTex(512, 4, (g, s) => { g.fillStyle = '#6d655a'; g.fillRect(0, 0, s, s); const R = rng(3); for (let y = 0; y < s; y += 26 + R() * 10) { const h = 24 + R() * 10; for (let x = -R() * 40; x < s; x += 40 + R() * 50) { const w = 36 + R() * 48; g.fillStyle = `hsl(${30 + R() * 15},${12 + R() * 10}%,${52 + R() * 18}%)`; g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, h - 4, 6); g.fill(); } } speckle(g, s, 9000, 0.08); });
  TEX.seam = canvasTex(128, 1, (g, s) => { g.fillStyle = '#26282a'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += s / 2) { g.fillStyle = '#3c3f42'; g.fillRect(x, 0, 3, s); g.fillStyle = '#141516'; g.fillRect(x + 3, 0, 2, s); } });
  TEX.tile = canvasTex(256, 1.6, (g, s) => { for (let y = 0; y < s; y += s / 8) for (let x = 0; x < s; x += s / 8) { const gr = g.createLinearGradient(x, 0, x + s / 8, 0); const l = 40 + Math.random() * 10; gr.addColorStop(0, `hsl(14,55%,${l - 14}%)`); gr.addColorStop(0.5, `hsl(16,58%,${l + 6}%)`); gr.addColorStop(1, `hsl(14,55%,${l - 16}%)`); g.fillStyle = gr; g.fillRect(x, y, s / 8, s / 8); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + s / 8 - 3, s / 8, 3); } });
  TEX.deck = canvasTex(256, 2, (g, s) => { for (let y = 0; y < s; y += s / 12) { g.fillStyle = `hsl(28,${35 + Math.random() * 10}%,${36 + Math.random() * 10}%)`; g.fillRect(0, y, s, s / 12 - 2); g.fillStyle = '#2a1c12'; g.fillRect(0, y + s / 12 - 2, s, 2); } speckle(g, s, 3000, 0.08); });
  TEX.limestone = canvasTex(256, 3, (g, s) => { g.fillStyle = '#ddd3c0'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += s / 4) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, y, s, 2); for (let x = (y / (s / 4)) % 2 * s / 4; x < s; x += s / 2) g.fillRect(x, y, 2, s / 4); } speckle(g, s, 5000, 0.05); });
  TEX.ok = true; return TEX;
}
const std = (o) => { const m = new THREE.MeshStandardMaterial(o); m.shared = true; return m; };
const MATS = {};
export function materials() {
  if (MATS.ok) return MATS; const T = textures();
  Object.assign(MATS, {
    glass: Object.assign(new THREE.MeshPhysicalMaterial({ color: '#2a3a42', roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.3, envMapIntensity: 2.2, specularIntensity: 1, depthWrite: false }), { shared: true }),
    win: std({ color: '#1c262c', roughness: 0.05, metalness: 0.7, envMapIntensity: 1.6, emissive: '#ffb46a', emissiveIntensity: 0 }),
    interior: std({ color: '#efe3cf', roughness: 0.8, emissive: '#ffb066', emissiveIntensity: 0 }),
    interiorDark: std({ color: '#3a2c22', roughness: 0.8, emissive: '#ff9a50', emissiveIntensity: 0 }),
    frame: std({ color: '#151515', roughness: 0.45, metalness: 0.6 }),
    white: std({ color: '#f1efe9', roughness: 0.55 }),
    stucco: std({ map: T.stucco, roughness: 0.9 }), plaster: std({ map: T.plaster, roughness: 0.85 }), cedar: std({ map: T.cedar, roughness: 0.75 }), boards: std({ map: T.boards, roughness: 0.7 }),
    concrete: std({ map: T.concrete, roughness: 0.92 }), stone: std({ map: T.stone, roughness: 0.9 }), seam: std({ map: T.seam, roughness: 0.42, metalness: 0.65 }), tile: std({ map: T.tile, roughness: 0.75 }),
    deck: std({ map: T.deck, roughness: 0.8 }), limestone: std({ map: T.limestone, roughness: 0.85 }), wood: std({ color: '#a0703f', roughness: 0.6 }),
    pool: Object.assign(new THREE.MeshPhysicalMaterial({ color: '#2fb7d6', roughness: 0.05, metalness: 0, emissive: '#1a9ec0', emissiveIntensity: 0.25, clearcoat: 1, envMapIntensity: 1.4 }), { shared: true }),
    ok: true,
  });
  return MATS;
}
export function setNight(n) { const M = materials(); M.win.emissiveIntensity = 0.15 + n * 2.4; M.interior.emissiveIntensity = n * 1.3 + 0.05; M.interiorDark.emissiveIntensity = n * 1.2; M.pool.emissiveIntensity = 0.25 + n * 1.2; }

// Box with metre-true UVs.
function box(w, h, d, mat, x, y, z, parent) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = mat.transparent ? false : true; m.receiveShadow = true; parent.add(m); return m;
}

export const STYLE_SPEC = {
  glass: { wall: 'glass', roof: 'flat', slab: 'white', base: 'limestone', deck: 'limestone', over: 1.8, slabT: 0.45, pitch: 0 },
  aframe: { wall: 'cedar', roof: 'aframe', roofMat: 'seam', base: 'stone', deck: 'deck', pitch: 58 },
  med: { wall: 'stucco', roof: 'hip', roofMat: 'tile', base: 'stone', deck: 'limestone', pitch: 24, over: 0.7 },
  japandi: { wall: 'cedar', alt: 'plaster', roof: 'gable', roofMat: 'seam', base: 'concrete', deck: 'deck', pitch: 16, over: 1.6 },
  farmhouse: { wall: 'boards', roof: 'gable', roofMat: 'seam', base: 'stone', deck: 'deck', pitch: 40, over: 0.5 },
  brutalist: { wall: 'concrete', roof: 'flat', slab: 'concrete', base: 'concrete', deck: 'concrete', over: 0.5, slabT: 1.0, pitch: 0 },
};
export const SCALE = { retreat: 0.78, residence: 1, estate: 1.3, compound: 1.62 };

function plan(layout, s, size) {
  const B = (x, z, w, d, y, h, top = true) => ({ x: x * s, z: z * s, w: w * s, d: d * s, y, h, top });
  let blocks, pool = null;
  if (layout === 'single') blocks = [B(0, 0, 26, 13, 0, 3.8), B(-9, 9.5, 9, 7, 0, 3.6)];
  else if (layout === 'two') blocks = [B(0, 0, 20, 12, 0, 3.5, false), B(1.5, -0.5, 21, 12.5, 3.5, 3.4)];
  else if (layout === 'cantilever') blocks = [B(-4, 1.5, 15, 12, 0, 3.6, false), B(3.5, -1, 25, 10, 3.6, 3.4)];
  else { blocks = [B(0, 8, 28, 8, 0, 3.8), B(-10, -3, 8, 14, 0, 3.6), B(10, -3, 8, 14, 0, 3.6)]; pool = { x: 0, z: -2 * s, w: 10 * s, d: 7.5 * s }; }
  if (!pool && (size === 'estate' || size === 'compound')) pool = { x: 2 * s, z: -(blocks[0].d / 2 + 6.5 * s), w: 14 * s, d: 5.5 * s };
  if (size === 'compound') blocks.push({ x: -26 * s, z: -6 * s, w: 11, d: 9, y: 0, h: 3.5, top: true, guest: true });
  return { blocks, pool };
}

function addWindowsOnFace(g, b, face, spec, M, style) {
  const along = face === 'n' || face === 's' ? b.w : b.d, t = 0.16;
  const out = (face === 's' ? -1 : 1) * (face === 'n' || face === 's' ? b.d / 2 : b.w / 2);
  let ww, wh, sill, gap, arch = false;
  if (style === 'japandi') { ww = face === 's' ? 4.6 : 1.4; wh = b.h - 0.6; sill = 0.05; gap = face === 's' ? 0.5 : 2.8; }
  else if (style === 'farmhouse') { ww = 1.3; wh = 2.3; sill = 0.6; gap = 1.9; }
  else if (style === 'med') { ww = 1.25; wh = 2.0; sill = 0.65; gap = 2.2; arch = true; }
  else if (style === 'brutalist') { ww = along * 0.72; wh = 1.25; sill = 1.1; gap = along; }
  else if (style === 'aframe') { ww = 1.6; wh = 0.9; sill = 0.3; gap = 2.4; }
  const n = Math.max(1, Math.floor((along - 1.2) / (ww + gap))); const span = n * ww + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    const c = -span / 2 + ww / 2 + i * (ww + gap), y = b.y + sill + wh / 2;
    const place = (w, h, d, mat, yy, k) => { const off = d * k; let px = b.x + c, pz = b.z + c;
      if (face === 's') pz = b.z - b.d / 2 - off; else if (face === 'n') pz = b.z + b.d / 2 + off; else if (face === 'e') px = b.x + b.w / 2 + off; else px = b.x - b.w / 2 - off;
      if (face === 's' || face === 'n') pz = pz, px = b.x + c; else pz = b.z + c;
      const xs = face === 'e' || face === 'w'; box(xs ? d : w, h, xs ? w : d, mat, px, yy, pz, g); };
    place(ww + 0.18, wh + 0.18, t, M.frame, y, 0.3);
    place(ww, wh, t, M.win, y, 0.55);
    if (arch) { const a = new THREE.Mesh(new THREE.CircleGeometry(ww / 2 + 0.09, 16, 0, Math.PI), M.frame); const a2 = new THREE.Mesh(new THREE.CircleGeometry(ww / 2, 16, 0, Math.PI), M.win);
      for (const [m, k] of [[a, 0.3], [a2, 0.55]]) { m.position.set(b.x + (face === 'e' ? out + t * k + 0.05 : face === 'w' ? -out - t * k - 0.05 : c), y + wh / 2, b.z + (face === 'e' || face === 'w' ? c : face === 's' ? out - t * k - 0.05 : out + t * k + 0.05)); m.rotation.y = { s: Math.PI, n: 0, e: Math.PI / 2, w: -Math.PI / 2 }[face]; g.add(m); } }
  }
}

function gableRoof(g, b, pitchDeg, over, mat, endMat, alongX, glassEnds, M) {
  const L = alongX ? b.w : b.d, D = alongX ? b.d : b.w, p = THREE.MathUtils.degToRad(pitchDeg), rise = (D / 2) * Math.tan(p);
  const r = new THREE.Group(); r.position.set(b.x, b.y + b.h, b.z); if (!alongX) r.rotation.y = Math.PI / 2; g.add(r);
  const half = D / 2 + over, slopeLen = half / Math.cos(p), th = 0.28;
  for (const sgn of [1, -1]) { const m = box(L + 2 * over * (glassEnds ? 0.4 : 1), th, slopeLen, mat, 0, rise - (half * Math.tan(p)) / 2 + th / 2, sgn * half / 2, r); m.rotation.x = sgn * p; }
  const sh = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rise)]);
  if (glassEnds) {
    for (const sgn of [1, -1]) { const tri = new THREE.Mesh(new THREE.ShapeGeometry(sh), M.glass); tri.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2; tri.position.x = sgn * L / 2; r.add(tri);
      const back = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-D / 2 + 0.5, 0), new THREE.Vector2(D / 2 - 0.5, 0), new THREE.Vector2(0, rise - 0.8)])), M.interior); back.rotation.y = tri.rotation.y; back.position.x = sgn * (L / 2 - 2.5); r.add(back);
      for (let k = -2; k <= 2; k++) { const mul = box(0.12, rise * (1 - Math.abs(k) / 3), 0.12, M.frame, sgn * L / 2, rise * (1 - Math.abs(k) / 3) / 2, k * D / 6, r); }
      box(0.14, 0.12, D, M.frame, sgn * L / 2, rise * 0.45, 0, r); }
  } else {
    const ext = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }); ext.rotateY(Math.PI / 2); ext.translate(-L / 2, 0, 0);
    const uv = ext.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
    const m = new THREE.Mesh(ext, endMat); m.castShadow = m.receiveShadow = true; r.add(m);
  }
}
function hipRoof(g, b, pitchDeg, over, mat) {
  const w = b.w + 2 * over, d = b.d + 2 * over, p = THREE.MathUtils.degToRad(pitchDeg), rise = Math.min(w, d) / 2 * Math.tan(p), rl = Math.max(0, (w - d) / 2), rd = Math.max(0, (d - w) / 2);
  const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2], Dd = [-w / 2, 0, d / 2], R1 = [-rl, rise, -rd], R2 = [rl, rise, rd];
  const tris = [A, R1, B, B, R1, R2, B, R2, C, C, R2, Dd, Dd, R2, R1, Dd, R1, A];
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  // keep CCW from above
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i += 3) { const a = new THREE.Vector3().fromBufferAttribute(pos, i), b2 = new THREE.Vector3().fromBufferAttribute(pos, i + 1), c = new THREE.Vector3().fromBufferAttribute(pos, i + 2); const n = b2.clone().sub(a).cross(c.clone().sub(a)); if (n.y < 0) { pos.setXYZ(i + 1, c.x, c.y, c.z); pos.setXYZ(i + 2, b2.x, b2.y, b2.z); } }
  const uv = []; for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i) + pos.getY(i) * 0.6, pos.getZ(i) + pos.getY(i) * 0.6); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.position.set(b.x, b.y + b.h, b.z); m.castShadow = m.receiveShadow = true; g.add(m);
  box(w, 0.25, d, M_().white, b.x, b.y + b.h + 0.02, b.z, g).castShadow = false;
}
const M_ = () => materials();

export function buildHome(cfg) {
  const M = materials(), spec = STYLE_SPEC[cfg.style], s = SCALE[cfg.size] || 1, { blocks, pool } = plan(cfg.layout, s, cfg.size);
  const g = new THREE.Group();
  // footprint & terrace
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const b of blocks) { x0 = Math.min(x0, b.x - b.w / 2); x1 = Math.max(x1, b.x + b.w / 2); z0 = Math.min(z0, b.z - b.d / 2); z1 = Math.max(z1, b.z + b.d / 2); }
  if (pool) { z0 = Math.min(z0, pool.z - pool.d / 2 - 1.5); x0 = Math.min(x0, pool.x - pool.w / 2 - 1.5); x1 = Math.max(x1, pool.x + pool.w / 2 + 1.5); }
  const m = 3.2; x0 -= m; x1 += m; z0 -= m; z1 += m;
  box(x1 - x0, 0.35, z1 - z0, M[spec.deck], (x0 + x1) / 2, -0.175, (z0 + z1) / 2, g);
  box(x1 - x0 - 0.2, 30, z1 - z0 - 0.2, M[spec.base], (x0 + x1) / 2, -15.35, (z0 + z1) / 2, g).castShadow = false;
  if (pool) { box(pool.w, 0.2, pool.d, M.pool, pool.x, -0.12, pool.z, g); box(pool.w + 0.8, 0.12, pool.d + 0.8, M.limestone, pool.x, -0.24, pool.z, g); }

  blocks.forEach((b, bi) => {
    const wallMat = spec.alt && bi === 1 ? M[spec.alt] : M[spec.wall];
    if (cfg.style === 'glass') {
      box(b.w - 0.5, b.h - 0.1, b.d - 0.5, bi % 2 ? M.interiorDark : M.interior, b.x, b.y + b.h / 2, b.z, g).castShadow = false;
      // a solid stone core wall to anchor the volume
      box(b.w * 0.18, b.h, b.d * 0.9, M.limestone, b.x - b.w * 0.36, b.y + b.h / 2, b.z, g);
      box(b.w, b.h, b.d, M.glass, b.x, b.y + b.h / 2, b.z, g);
      const n = Math.round(b.w / 3); for (let i = 0; i <= n; i++) for (const zz of [-1, 1]) box(0.1, b.h, 0.1, M.frame, b.x - b.w / 2 + i * b.w / n, b.y + b.h / 2, b.z + zz * b.d / 2, g);
      const nd = Math.round(b.d / 3); for (let i = 1; i < nd; i++) for (const xx of [-1, 1]) box(0.1, b.h, 0.1, M.frame, b.x + xx * b.w / 2, b.y + b.h / 2, b.z - b.d / 2 + i * b.d / nd, g);
      box(b.w + 0.2, 0.3, b.d + 0.2, M.white, b.x, b.y + 0.15, b.z, g);
    } else if (cfg.style === 'aframe') {
      box(b.w, 1.3, b.d, wallMat, b.x, b.y + 0.65, b.z, g);
      box(b.w - 1, b.h, b.d - 1, M.interior, b.x, b.y + b.h / 2, b.z, g).castShadow = false;
    } else {
      box(b.w, b.h, b.d, wallMat, b.x, b.y + b.h / 2, b.z, g);
      for (const f of ['s', 'n', 'e', 'w']) addWindowsOnFace(g, b, f, spec, M, cfg.style);
      if (cfg.style === 'japandi' || cfg.style === 'farmhouse') box(b.w + 0.3, 0.25, b.d + 0.3, M.frame, b.x, b.y + 0.12, b.z, g);
    }
    // roofs
    if (spec.roof === 'flat' || !b.top) {
      if (!b.top || spec.roof === 'flat') box(b.w + 2 * (spec.over || 0.4), spec.slabT || 0.4, b.d + 2 * (spec.over || 0.4), M[spec.slab || 'white'], b.x, b.y + b.h + (spec.slabT || 0.4) / 2, b.z, g);
      if (cfg.style === 'brutalist' && b.top) box(b.w * 0.5, 0.9, 0.5, M.concrete, b.x + b.w * 0.2, b.y + b.h + 1.3, b.z + b.d / 2 - 0.25, g);
    } else if (spec.roof === 'hip') hipRoof(g, b, spec.pitch, spec.over, M[spec.roofMat]);
    else if (spec.roof === 'gable') gableRoof(g, b, spec.pitch, spec.over, M[spec.roofMat], spec.alt && bi === 1 ? M[spec.alt] : M[spec.wall], b.w >= b.d, false, M);
    else if (spec.roof === 'aframe') { const bb = { ...b, h: 1.3 }; gableRoof(g, bb, spec.pitch, 0.6, M.seam, M.cedar, b.w >= b.d, true, M); }
  });
  // signature details
  const main = blocks[0];
  if (cfg.style === 'med') { const n = Math.floor(main.w / 3.4); for (let i = 0; i <= n; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.4, 12), M.limestone); c.position.set(main.x - main.w / 2 + i * main.w / n, 1.7, main.z - main.d / 2 - 2.6); c.castShadow = true; g.add(c); } box(main.w + 0.6, 0.5, 3.2, M.stucco, main.x, 3.65, main.z - main.d / 2 - 1.5, g); box(main.w + 0.6, 0.14, 3.2, M.tile, main.x, 3.95, main.z - main.d / 2 - 1.5, g); }
  if (cfg.style === 'farmhouse') { const n = Math.floor(main.w / 3.2); for (let i = 0; i <= n; i++) box(0.22, 3, 0.22, M.frame, main.x - main.w / 2 + i * main.w / n, 1.5, main.z - main.d / 2 - 2.4, g); box(main.w + 0.4, 0.25, 2.8, M.seam, main.x, 3.1, main.z - main.d / 2 - 1.3, g).rotation.x = -0.15; box(1.4, 3, 1.4, M.stone, main.x + main.w * 0.3, main.y + main.h + 2.5, main.z + main.d * 0.15, g); }
  if (cfg.style === 'aframe') box(1.2, 3, 1.2, M.stone, main.x - main.w * 0.25, main.h + 6, main.z, g);
  if (cfg.style === 'japandi') { box(main.w + 2, 0.3, 2.2, M.deck, main.x, 0.3, main.z - main.d / 2 - 1.1, g); }
  if (cfg.style === 'glass' || cfg.style === 'brutalist') { const top = blocks.filter(b => b.top).pop(); if (cfg.layout !== 'courtyard') box(top.w * 0.6, 0.12, 0.08, M.frame, top.x, top.y + top.h + (spec.slabT || 0.4) + 0.5, top.z - top.d / 2 - (spec.over || 0.4) + 0.1, g); }
  g.traverse(o => { if (o.isMesh && o.material.transparent) o.castShadow = false; });
  const radius = Math.max(Math.hypot(x0, z0), Math.hypot(x1, z0), Math.hypot(x0, z1), Math.hypot(x1, z1));
  return { group: g, radius, bounds: [x0, x1, z0, z1] };
}

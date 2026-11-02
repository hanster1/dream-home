// Procedural plant, rock and grass geometry. Each kind is one merged geometry with vertex colors, drawn as an InstancedMesh.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { vnoise } from './noise.js';

const C = c => new THREE.Color(c);
function paint(g, top, bot, y0 = 0, y1 = 1) {
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position, col = new Float32Array(p.count * 3), a = C(bot), b = C(top), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0 || 1))); t.copy(a).lerp(b, k); const j = 0.92 + 0.16 * vnoise(p.getX(i) * 3, p.getZ(i) * 3 + p.getY(i)); col.set([t.r * j, t.g * j, t.b * j], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}
function blob(r, sx, sy, sz, x, y, z, detail = 2, wob = 0.28) {
  let g = new THREE.IcosahedronGeometry(r, detail); g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const n = 1 + wob * vnoise(vx * 1.7 + x * 3, vy * 1.7 + vz * 1.3 + z); p.setXYZ(i, vx * n * sx + x, vy * n * sy + y, vz * n * sz + z); }
  g.computeVertexNormals(); return g;
}
const cyl = (r0, r1, h, y = 0, seg = 7) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true); g.translate(0, y + h / 2, 0); return g; };
const cone = (r, h, y, seg = 9) => { const g = new THREE.ConeGeometry(r, h, seg, 1, true); g.translate(0, y + h / 2, 0); return g; };

function trunkAndCrown(trunk, crowns) { return mergeGeometries([...trunk, ...crowns].map(g => g.index ? g.toNonIndexed() : g).map(g => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.computeVertexNormals(); return g; })); }
function finish(parts) { // parts: [geo, top, bot, y0, y1]
  const gs = parts.map(([g, top, bot, y0, y1]) => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.normal) g.computeVertexNormals(); return paint(g, top, bot, y0, y1); });
  gs.forEach(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k); });
  return mergeGeometries(gs);
}

export function plantGeometry(kind) {
  switch (kind) {
    case 'pine': return finish([[cyl(0.45, 0.25, 9), '#5a3d28', '#3d2a1c', 0, 9], ...[0, 1, 2, 3].map(i => [cone(4.2 - i * 0.8, 6, 4 + i * 3.2), '#3c5a32', '#1e3420', 4 + i * 3.2, 10 + i * 3.2])]);
    case 'fir': return finish([[cyl(0.5, 0.2, 6), '#4a3322', '#3a2618', 0, 6], ...[0, 1, 2, 3, 4, 5].map(i => [cone(3.4 - i * 0.48, 5.5, 2.5 + i * 3), '#2e5236', '#16301e', 2.5 + i * 3, 8 + i * 3])]);
    case 'redwood': return finish([[cyl(2.4, 0.9, 62, 0, 10), '#8a4a2c', '#5c2c18', 0, 62], ...[0, 1, 2, 3, 4, 5, 6].map(i => [blob(5.5 - i * 0.55, 1, 0.55, 1, 0.6 * Math.sin(i * 2), 30 + i * 6.2, 0.6 * Math.cos(i * 2), 1, 0.35), '#3e6a36', '#1c3a1e', 26 + i * 6, 34 + i * 6])]);
    case 'broad': return finish([[cyl(0.45, 0.3, 5), '#5a4532', '#3d2c1e', 0, 5], [blob(3.3, 1.2, 0.9, 1.2, 0, 6.5, 0), '#6a9a42', '#2f5222', 4, 9.5], [blob(2.4, 1, 0.9, 1, 1.9, 8, 0.8), '#7aa84a', '#3a6028', 6, 10.5], [blob(2.3, 1, 0.9, 1, -1.6, 7.6, -1), '#6a9a42', '#2f5222', 5.5, 10]]);
    case 'sakura': return finish([[cyl(0.4, 0.25, 4.5), '#4a3530', '#30201c', 0, 4.5], [blob(3.2, 1.3, 0.75, 1.3, 0, 5.8, 0), '#ffd6e2', '#d98aa6', 4, 8], [blob(2.2, 1.1, 0.8, 1.1, 2, 6.6, 1), '#ffe0ea', '#e29ab2', 5, 8.5], [blob(2, 1, 0.8, 1, -2, 6.3, -0.8), '#ffd6e2', '#d98aa6', 5, 8]]);
    case 'aspen': return finish([[cyl(0.22, 0.12, 12), '#f2eee4', '#cfc8b8', 0, 12], [blob(1.9, 1, 1.6, 1, 0, 10.5, 0), '#ffd24a', '#c08a1c', 7.5, 13.5], [blob(1.4, 1, 1.4, 1, 0.9, 8.6, 0.6), '#ffc63a', '#b47a18', 6.5, 10.5]]);
    case 'olive': return finish([[cyl(0.35, 0.25, 2.2), '#6a5a48', '#4a3c30', 0, 2.2], [blob(2.2, 1.35, 0.65, 1.35, 0, 3.2, 0), '#a4ae7c', '#5e6a42', 2, 4.6]]);
    case 'cypress': return finish([[cyl(0.3, 0.2, 2), '#4a3826', '#3a2a1c', 0, 2], [blob(1.6, 1, 6.2, 1, 0, 8.5, 0, 2, 0.12), '#3a5530', '#1a2c18', 1, 17]]);
    case 'poplar': return finish([[cyl(0.3, 0.2, 2), '#5a4836', '#3a2a1c', 0, 2], [blob(2, 1, 5.4, 1, 0, 9, 0, 2, 0.16), '#8ab04a', '#3e6226', 2, 17]]);
    case 'shrub': return finish([[blob(1.1, 1.3, 0.8, 1.3, 0, 0.6, 0, 1, 0.3), '#6f7e44', '#3a4826', 0, 1.6]]);
    case 'fern': { const ps = []; for (let i = 0; i < 7; i++) { const g = new THREE.PlaneGeometry(0.5, 1.8, 1, 3); const p = g.attributes.position; for (let j = 0; j < p.count; j++) { const y = p.getY(j) + 0.9; p.setXYZ(j, p.getX(j) * (1 - y / 2.2), y * 0.55, y * y * 0.18 + y * 0.35); } g.rotateY(i / 7 * Math.PI * 2); ps.push([g, '#5f9a3e', '#24461e', 0, 1]); } return finish(ps); }
    case 'palm': {
      const ps = [], curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 5, 0), new THREE.Vector3(2.0, 10, 0), new THREE.Vector3(3.6, 14, 0)]);
      ps.push([new THREE.TubeGeometry(curve, 10, 0.32, 6), '#a08a6a', '#6e5c44', 0, 14]);
      for (let i = 0; i < 11; i++) { const g = new THREE.PlaneGeometry(1.1, 6, 1, 6); const p = g.attributes.position; for (let j = 0; j < p.count; j++) { const y = p.getY(j) + 3; const w = Math.sin(Math.PI * y / 6) * 0.9 + 0.1; p.setXYZ(j, p.getX(j) * w, -0.05 * y * y + 0.4 * y, y); } g.rotateX(-0.1 - (i % 3) * 0.15); g.rotateY(i / 11 * Math.PI * 2); g.translate(3.6, 14, 0); ps.push([g, '#6e9a3a', '#2e5222', 11, 15]); }
      return finish(ps);
    }
    case 'boulder': return finish([[blob(1.6, 1.4, 0.75, 1.1, 0, 0.5, 0, 2, 0.35), '#b6b2aa', '#8a867e', -0.5, 2]]);
  }
}
export function grassGeometry(tip, base) {
  const ps = [];
  for (let i = 0; i < 6; i++) { const g = new THREE.PlaneGeometry(0.09, 0.8, 1, 2); g.translate(0, 0.4, 0); const p = g.attributes.position; for (let j = 0; j < p.count; j++) { const y = p.getY(j); p.setX(j, p.getX(j) * (1 - y / 0.85)); p.setZ(j, y * y * 0.35); } g.rotateY(i * 2.4); g.translate(Math.sin(i * 1.7) * 0.18, 0, Math.cos(i * 1.3) * 0.18); g.scale(1, 0.8 + 0.4 * ((i * 7) % 3) / 2, 1); ps.push([g, tip, base, 0, 0.9]); }
  const g = finish(ps); g.computeVertexNormals(); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3); n.needsUpdate = true; g.normalizeNormals?.(); return g;
}
export const PLANT_RULES = { // max slope, min height above water, scale range, radius
  pine: [0.6, 2.5, 0.8, 1.4, 650], fir: [0.7, 2.5, 0.7, 1.5, 750], redwood: [0.45, 2, 0.75, 1.25, 520], broad: [0.55, 1.8, 0.8, 1.4, 600], sakura: [0.5, 1.5, 0.8, 1.2, 300], aspen: [0.55, 2, 0.8, 1.35, 600],
  olive: [0.7, 3, 0.8, 1.3, 500], cypress: [0.6, 3, 0.8, 1.3, 600], poplar: [0.5, 2, 0.8, 1.3, 600], shrub: [0.85, 1.5, 0.6, 1.8, 420], fern: [0.7, 1.5, 0.7, 1.6, 260], palm: [0.4, 0.8, 0.8, 1.3, 420], boulder: [1.2, 0.3, 0.6, 3.2, 420],
};

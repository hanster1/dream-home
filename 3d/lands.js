// Fifteen landscapes: real places, fantasized. Each one is a recipe for terrain, water, sky, plants and extras.
import { fbm, ridged, sstep } from './noise.js';

const P = { // palettes
  coastDry: { sand: '#e8d3a6', grass: '#9a9a52', grass2: '#c2a862', rock: '#a08a70', snow: '#f4f4f4', dirt: '#8a7458' },
  tropic: { sand: '#f4ead2', grass: '#4f8f3a', grass2: '#6aa548', rock: '#9b927e', snow: '#fff', dirt: '#806a4e' },
  medit: { sand: '#e2cfa3', grass: '#7d8a45', grass2: '#a29a55', rock: '#b9a98c', snow: '#fff', dirt: '#93785a' },
  forest: { sand: '#b8a27a', grass: '#3f6a2c', grass2: '#5d7d33', rock: '#6f6a60', snow: '#f2f4f8', dirt: '#5b4632' },
  pnw: { sand: '#9c9078', grass: '#2f5a2a', grass2: '#4a7a35', rock: '#5f625d', snow: '#f3f6fa', dirt: '#4a3a2a' },
  aspen: { sand: '#c4b48a', grass: '#7a8f3c', grass2: '#b49a3c', rock: '#8a8278', snow: '#f6f8fb', dirt: '#6e5a40' },
  sierra: { sand: '#d8cdb4', grass: '#5c7a3a', grass2: '#7c8a45', rock: '#a8a49a', snow: '#f5f7fa', dirt: '#7a6a52' },
  glacier: { sand: '#b8b2a4', grass: '#4a6e36', grass2: '#62803e', rock: '#7d7f82', snow: '#f4f8fc', dirt: '#5a5040' },
  sage: { sand: '#c9bc94', grass: '#8a9a5c', grass2: '#a8a46a', rock: '#8c8a84', snow: '#f5f7fa', dirt: '#7a6a50' },
  basalt: { sand: '#a89a7c', grass: '#3d6a2e', grass2: '#58803a', rock: '#4c4a48', snow: '#fff', dirt: '#4e3c2c' },
  limestone: { sand: '#d9c39a', grass: '#6a8a38', grass2: '#94a048', rock: '#d6b882', snow: '#fff', dirt: '#8c704c' },
  park: { sand: '#bfae86', grass: '#4d7a32', grass2: '#6c8c3a', rock: '#7c776e', snow: '#fff', dirt: '#6a5640' },
  hills: { sand: '#c8b080', grass: '#8a8a4a', grass2: '#a89458', rock: '#9c8468', snow: '#fff', dirt: '#86684a' },
};
const W = { // water
  pacific: { deep: '#0a3550', shallow: '#2b9fae', amp: 1.0, foam: 1.0 },
  caribbean: { deep: '#0b6a8a', shallow: '#44d8cc', amp: 0.45, foam: 0.8 },
  tyrrhenian: { deep: '#082a5c', shallow: '#1f86b4', amp: 0.6, foam: 0.7 },
  alpine: { deep: '#0a3a52', shallow: '#4fb3b0', amp: 0.12, foam: 0.25 },
  como: { deep: '#0c2c40', shallow: '#2f7f88', amp: 0.15, foam: 0.25 },
  glacial: { deep: '#0b6c8a', shallow: '#46d0cf', amp: 0.08, foam: 0.2 },
  river: { deep: '#123c3c', shallow: '#3e8a7c', amp: 0.08, foam: 0.5, flow: 1 },
  green: { deep: '#1d3d2a', shallow: '#4f8a5a', amp: 0.06, foam: 0.3, flow: 0.6 },
};

export const CAT_ORDER = ['beach', 'forest', 'lake', 'river', 'city'];
export const CAT_NAMES = { beach: 'Beaches', forest: 'Forests', lake: 'Lakes', river: 'Rivers', city: 'Cities' };

export const LANDS = {
  malibu: { cat: 'beach', name: 'Malibu Bluffs', inspired: 'Malibu, California', line: 'A golden bluff above endless Pacific swell.', type: 'coast', t: { shore: -85, cliff: 24, slope: 16, hills: 40 }, pal: P.coastDry, water: W.pacific, time: 'golden', sunAz: -18, sky: { turb: 3, ray: 1.4, cov: 0.32 }, fog: 0.00028, mountains: { h: 260, land: true }, plants: [['palm', 70], ['shrub', 1300], ['pine', 90]], grass: 'dry' },
  tulum: { cat: 'beach', name: 'Turquoise Cove', inspired: 'Tulum, Mexico', line: 'Powder sand, gin-clear lagoon and a palm jungle at your back.', type: 'coast', t: { shore: -45, cliff: 1.8, slope: 75, hills: 4 }, pal: P.tropic, water: W.caribbean, time: 'day', sunAz: 30, sky: { turb: 2.2, ray: 1.0, cov: 0.42 }, fog: 0.00022, plants: [['palm', 520], ['broad', 900], ['shrub', 900]], grass: 'lush' },
  amalfi: { cat: 'beach', name: 'Amalfi Terraces', inspired: 'Amalfi Coast, Italy', line: 'Lemon terraces stepping down limestone cliffs to a sapphire sea.', type: 'coast', t: { shore: -70, cliff: 34, slope: 14, hills: 150, terrace: 4.5 }, pal: P.medit, water: W.tyrrhenian, time: 'golden', sunAz: 35, sky: { turb: 2.6, ray: 1.2, cov: 0.25 }, fog: 0.00026, mountains: { h: 520, land: true }, plants: [['cypress', 240], ['olive', 1100], ['pine', 120]], grass: 'dry', extras: ['villas'] },
  redwoods: { cat: 'forest', name: 'Cathedral Redwoods', inspired: 'Redwood National Park, California', line: 'A sunlit clearing beneath the tallest trees on earth.', type: 'forest', t: { hills: 26, clear: 34 }, pal: P.forest, time: 'golden', sunAz: 60, sky: { turb: 4, ray: 1.2, cov: 0.3 }, fog: 0.0022, fogTint: '#c9b48c', plants: [['redwood', 900], ['fern', 2600], ['shrub', 600]], grass: 'lush', noWater: true },
  pnw: { cat: 'forest', name: 'Cascade Rainforest', inspired: 'Mount Rainier, Washington', line: 'Mossy firs, soft mist and a snow volcano floating above it all.', type: 'forest', t: { hills: 40, clear: 36 }, pal: P.pnw, time: 'day', sunAz: -40, sky: { turb: 3.5, ray: 1.6, cov: 0.45 }, fog: 0.0011, plants: [['fir', 1900], ['fern', 2200], ['broad', 200]], grass: 'lush', noWater: true, mountains: { h: 500 }, volcano: { x: -300, z: -3200, h: 1900, r: 1700 } },
  aspen: { cat: 'forest', name: 'Golden Aspens', inspired: 'Maroon Bells, Colorado', line: 'Quaking gold leaves beneath snow-dusted Rocky Mountain peaks.', type: 'forest', t: { hills: 34, clear: 40 }, pal: P.aspen, time: 'golden', sunAz: 50, sky: { turb: 2, ray: 1.0, cov: 0.2 }, fog: 0.0005, plants: [['aspen', 1500], ['fir', 380], ['shrub', 500]], grass: 'meadow', noWater: true, mountains: { h: 1300, snow: 0.55, jag: 1 } },
  tahoe: { cat: 'lake', name: 'Granite Bay', inspired: 'Lake Tahoe, California', line: 'Glass-clear water over granite boulders, Sierra snow beyond.', type: 'lake', t: { cx: 0, cz: -330, rx: 520, rz: 300, depth: 40, rise: 60, hills: 30 }, pal: P.sierra, water: W.alpine, time: 'golden', sunAz: -30, sky: { turb: 2, ray: 1.0, cov: 0.22 }, fog: 0.00035, plants: [['pine', 1300], ['shrub', 400], ['boulder', 260]], grass: 'meadow', mountains: { h: 750, snow: 0.6 } },
  como: { cat: 'lake', name: 'Villa Lake', inspired: 'Lake Como, Italy', line: 'Cypress, villas and mountains folded around deep blue water.', type: 'lake', t: { cx: 0, cz: -230, rx: 1400, rz: 190, depth: 60, rise: 260, hills: 60 }, pal: P.medit, water: W.como, time: 'golden', sunAz: 20, sky: { turb: 3, ray: 1.3, cov: 0.3 }, fog: 0.0005, plants: [['cypress', 420], ['broad', 900], ['olive', 400]], grass: 'lush', mountains: { h: 900, snow: 0.7 }, extras: ['villas'] },
  banff: { cat: 'lake', name: 'Ten Peaks Lake', inspired: 'Moraine Lake, Banff', line: 'Glacial turquoise ringed by a wall of jagged peaks.', type: 'lake', t: { cx: 0, cz: -260, rx: 360, rz: 210, depth: 30, rise: 90, hills: 50 }, pal: P.glacier, water: W.glacial, time: 'day', sunAz: 40, sky: { turb: 1.6, ray: 0.9, cov: 0.28 }, fog: 0.00035, plants: [['fir', 1600], ['boulder', 380]], grass: 'meadow', mountains: { h: 1600, snow: 0.45, jag: 1, near: 1 } },
  tetons: { cat: 'river', name: 'Snake River Bend', inspired: 'Grand Teton, Wyoming', line: 'Sage meadows and a silver river under jagged granite.', type: 'river', t: { z0: -70, w: 26, a1: 40, a2: 12, nearH: 2, nearRun: 30, farH: 3, farRun: 40, hills: 6 }, pal: P.sage, water: W.river, time: 'golden', sunAz: 160, sky: { turb: 2.2, ray: 1.1, cov: 0.3 }, fog: 0.0003, plants: [['fir', 420], ['shrub', 1500], ['aspen', 120]], grass: 'meadow', mountains: { h: 2000, snow: 0.5, jag: 1, arc: [-0.6, 0.6] } },
  gorge: { cat: 'river', name: 'Basalt Gorge', inspired: 'Columbia River Gorge, Oregon', line: 'A wide river below basalt walls and ribbon waterfalls.', type: 'river', t: { z0: -190, w: 120, a1: 30, a2: 10, nearH: 34, nearRun: 60, farH: 230, farRun: 90, hills: 18 }, pal: P.basalt, water: W.river, time: 'golden', sunAz: -70, sky: { turb: 3.5, ray: 1.4, cov: 0.4 }, fog: 0.0007, plants: [['fir', 2000], ['broad', 300], ['fern', 900]], grass: 'lush', extras: ['waterfall'] },
  dordogne: { cat: 'river', name: 'Golden Cliffs', inspired: 'Dordogne Valley, France', line: 'A slow green river curling under honey-colored limestone.', type: 'river', t: { z0: -80, w: 30, a1: 35, a2: 14, nearH: 3, nearRun: 30, farH: 75, farRun: 30, hills: 10 }, pal: P.limestone, water: W.green, time: 'golden', sunAz: 70, sky: { turb: 3, ray: 1.3, cov: 0.3 }, fog: 0.0005, plants: [['broad', 1300], ['poplar', 160], ['shrub', 500]], grass: 'lush', extras: ['villas'] },
  manhattan: { cat: 'city', name: 'Park Summit', inspired: 'Manhattan, New York', line: 'A private park hill facing a glittering wall of towers.', type: 'city', t: { hill: 22, floor: -18, edge0: 90, edge1: 170 }, pal: P.park, time: 'dusk', sunAz: -50, sky: { turb: 4, ray: 2, cov: 0.35 }, fog: 0.00045, plants: [['broad', 900], ['shrub', 300]], grass: 'lush', noWater: true, city: { kind: 'towers', min: 40, max: 380, density: 0.8 } },
  hollywood: { cat: 'city', name: 'Canyon Lights', inspired: 'Hollywood Hills, Los Angeles', line: 'Palms, canyon breeze and a whole city glittering below.', type: 'city', t: { hill: 70, floor: -10, edge0: 110, edge1: 260, rough: 1 }, pal: P.hills, time: 'dusk', sunAz: -75, sky: { turb: 5, ray: 2.2, cov: 0.12 }, fog: 0.00035, plants: [['palm', 260], ['shrub', 1700], ['pine', 120]], grass: 'dry', noWater: true, city: { kind: 'sprawl', min: 6, max: 30, density: 0.5, downtown: { x: 250, z: -1500 } } },
  tokyo: { cat: 'city', name: 'Lantern Hill', inspired: 'Azabu, Tokyo', line: 'A cherry-blossom hilltop facing a red tower and the neon grid.', type: 'city', t: { hill: 26, floor: -12, edge0: 90, edge1: 170 }, pal: P.park, time: 'dusk', sunAz: -30, sky: { turb: 4, ray: 2, cov: 0.3 }, fog: 0.0005, plants: [['sakura', 380], ['broad', 300], ['shrub', 400]], grass: 'lush', noWater: true, city: { kind: 'neon', min: 20, max: 170, density: 0.85 }, extras: ['tower'] },
};

export const TIMES = {
  day: { name: 'Midday', elev: 42 },
  golden: { name: 'Golden hour', elev: 7 },
  dusk: { name: 'Dusk', elev: 1.2 },
};

export function heightFn(L) {
  const k = L.t;
  if (L.type === 'coast') return (x, z) => {
    const shore = k.shore + 30 * fbm(x * 0.004, 3.1, 3) + 6 * fbm(x * 0.03, z * 0.03, 2);
    const t = z - shore;
    let land = k.cliff + k.hills * (0.55 + 0.45 * fbm(x * 0.004 + 5, z * 0.004, 5)) * sstep(20, 420, t) + 2.2 * fbm(x * 0.03, z * 0.03, 3);
    if (k.terrace) land += (Math.round(land / k.terrace) * k.terrace - land) * 0.7;
    const sea = -3 - Math.min(30, 0.08 * Math.max(0, -t));
    return sea + (land - sea) * sstep(-k.slope, 0, t);
  };
  if (L.type === 'forest') return (x, z) => {
    const h = k.hills * fbm(x * 0.004 + 2, z * 0.004, 5) + 5 * fbm(x * 0.02, z * 0.02, 3);
    const r = Math.hypot(x, z), h0 = k.hills * fbm(2, 0, 5);
    return (h - h0) * sstep(k.clear * 0.6, k.clear * 2.2, r) + 1.2 * fbm(x * 0.05, z * 0.05, 2) + 2;
  };
  if (L.type === 'lake') return (x, z) => {
    const dx = (x - k.cx) / k.rx, dz = (z - k.cz) / k.rz;
    const d = Math.hypot(dx, dz) + 0.1 * fbm(x * 0.006, z * 0.006, 3);
    const base = d < 1 ? -Math.min(k.depth, (1 - d) * k.depth * 4) : (d - 1) * k.rise * 3 * sstep(1, 1.25, d) + (d - 1) * 10;
    return base + k.hills * fbm(x * 0.005 + 9, z * 0.005, 5) * sstep(1.02, 1.6, d) + 1.2 * fbm(x * 0.04, z * 0.04, 2) * sstep(0.97, 1.05, d) + 1.0 * sstep(0.985, 1.03, d);
  };
  if (L.type === 'river') return (x, z) => {
    const zr = k.z0 + k.a1 * Math.sin(x * 0.006 + 1) + k.a2 * Math.sin(x * 0.019);
    const dz = z - zr, ad = Math.abs(dz), w = k.w * (1 + 0.15 * fbm(x * 0.01, 7, 2));
    if (ad < w) return -4 * (1 - (ad / w) ** 2) - 0.3;
    const near = dz > 0;
    const H = near ? k.nearH : k.farH, run = near ? k.nearRun : k.farRun;
    const cliff = H * sstep(w, w + run, ad + 8 * fbm(x * 0.02, z * 0.02, 3));
    return -0.3 + 1.2 * sstep(w, w + 6, ad) + cliff + k.hills * fbm(x * 0.006, z * 0.006, 4) * sstep(w, w + 60, ad) + 1.5 * fbm(x * 0.03, z * 0.03, 2);
  };
  // city: a garden hill facing a city floor.
  return (x, z) => {
    const t = sstep(k.edge0, k.edge1, -z + 20 * fbm(x * 0.006, 1, 2));
    const hill = k.hill * (1 - Math.min(1, (x * x) / 260000)) + (k.rough ? 40 : 8) * fbm(x * 0.006, z * 0.006, 4) + 2 * fbm(x * 0.04, z * 0.04, 2);
    const floor = k.floor + 1.5 * fbm(x * 0.01, z * 0.01, 2);
    const backHills = (k.rough ? 120 : 30) * sstep(200, 700, z) * (0.6 + 0.4 * fbm(x * 0.004, z * 0.004, 4));
    return hill * (1 - t) + floor * t + backHills;
  };
}

// Where the home starts and where the camera first looks from.
export function heroView(L) {
  const r = { gorge: 95, banff: 95, como: 100, amalfi: 95, malibu: 90, manhattan: 95, hollywood: 100, tokyo: 95 }[L.id] || 85;
  return { dist: r, az: L.camAz ?? 0.55, pol: L.camPol ?? 1.36 };
}
Object.entries(LANDS).forEach(([id, L]) => { L.id = id; });

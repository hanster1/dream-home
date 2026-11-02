window.DH = (() => {
  const CATS = [
    { id: 'beach', name: 'Beaches', kicker: 'Salt air & horizon', settings: [
      ['malibu','Malibu Bluffs','California','Cliff-top above the Pacific, where the coast road falls away to surf.'],
      ['tulum','Tulum Jungle Coast','Mexico','White sand, turquoise water and a canopy of palms at your back.'],
      ['amalfi','Amalfi Cliffs','Italy','Terraced limestone tumbling into the Tyrrhenian Sea.']]},
    { id: 'forest', name: 'Forests', kicker: 'Canopy & quiet', settings: [
      ['redwoods','Redwood Grove','Northern California','Cathedral light through the oldest trees on earth.'],
      ['pnw','Cascade Rainforest','Pacific Northwest','Moss, fern and a volcano peeking through the mist.'],
      ['aspen','Aspen Grove','Colorado Rockies','Quaking gold leaves beneath high alpine peaks.']]},
    { id: 'lake', name: 'Lakes', kicker: 'Still water', settings: [
      ['tahoe','Lake Tahoe','California · Nevada','Gin-clear water over granite boulders, Sierra snow beyond.'],
      ['como','Lake Como','Italy','Villas, cypress and mountains folded around deep blue water.'],
      ['banff','Moraine Lake','Banff, Canada','Glacial turquoise ringed by the Valley of the Ten Peaks.']]},
    { id: 'river', name: 'Rivers', kicker: 'Moving water', settings: [
      ['tetons','Snake River','Grand Tetons, Wyoming','Sage meadows and a winding river under jagged granite.'],
      ['gorge','Columbia River Gorge','Oregon','Waterfalls and basalt cliffs above a great river.'],
      ['dordogne','Dordogne Valley','France','Golden limestone cliffs over a slow, green river.']]},
    { id: 'city', name: 'Cities', kicker: 'Skyline living', settings: [
      ['manhattan','Manhattan Sky','New York','A rooftop above Central Park with the Empire State at eye level.'],
      ['hollywood','Hollywood Hills','Los Angeles','Palms, canyon breeze and the whole city glittering below.'],
      ['tokyo','Azabu Hill','Tokyo','A garden hilltop facing Tokyo Tower and the neon grid.']]}
  ];
  const STYLES = [
    { id: 'glass', name: 'Glass Modern', line: 'Floor-to-ceiling glazing, floating roof planes.', rate: 1150 },
    { id: 'aframe', name: 'Modern A-Frame', line: 'Steep black roof, a full wall of glass gable.', rate: 950 },
    { id: 'med', name: 'Mediterranean Villa', line: 'Stone, stucco, terracotta and arched loggias.', rate: 1050 },
    { id: 'japandi', name: 'Japandi', line: 'Charred cedar, pale plaster, deep calm eaves.', rate: 1100 },
    { id: 'farmhouse', name: 'Modern Farmhouse', line: 'Board-and-batten, standing-seam gables, porches.', rate: 850 },
    { id: 'brutalist', name: 'Brutalist', line: 'Board-formed concrete and bold cantilevers.', rate: 1250 }
  ];
  const LAYOUTS = [
    { id: 'single', name: 'Single Story', line: 'Everything on one level, opened to the land.', icon: 'M6 40h52M10 40V24h44v16M8 24h48' },
    { id: 'two', name: 'Two Story', line: 'Living below, a private sleeping floor above.', icon: 'M6 40h52M12 40V14h40v26M10 14h44M12 27h40' },
    { id: 'cantilever', name: 'Cantilever', line: 'An upper volume flying out over the view.', icon: 'M6 40h52M12 40V27h26v13M8 27h50v-13H8z' },
    { id: 'courtyard', name: 'Courtyard', line: 'Wings wrapped around a private garden or pool.', icon: 'M6 40h52M8 40V18h14v22M42 40V18h14v22M22 30h20' }
  ];
  const SIZES = [
    { id: 'retreat', name: 'Retreat', sqft: 2400, beds: 3, baths: 3, line: 'An intimate escape for two to six.' },
    { id: 'residence', name: 'Residence', sqft: 4200, beds: 4, baths: 5, line: 'A full-time family home with room to host.' },
    { id: 'estate', name: 'Estate', sqft: 7500, beds: 6, baths: 7, line: 'Guest wing, wine room, gym and pool house.' },
    { id: 'compound', name: 'Compound', sqft: 12000, beds: 8, baths: 10, line: 'Main house, guest house and staff quarters.' }
  ];
  const PAIRS = [['glass','japandi'],['aframe','farmhouse'],['med','brutalist']];
  const TWILIGHT = new Set(['malibu-glass','pnw-aframe','amalfi-med','tahoe-japandi','gorge-farmhouse','dordogne-brutalist']);
  const CAT_MULT = { beach: 1.35, forest: 0.95, lake: 1.2, river: 1.0, city: 1.6 };

  const settings = {};
  CATS.forEach(c => c.settings.forEach(([id, name, place, blurb], i) => {
    settings[id] = { id, name, place, blurb, cat: c.id, styles: PAIRS[i] };
  }));
  const catOf = id => CATS.find(c => c.id === id);
  const styleOf = id => STYLES.find(s => s.id === id);

  // Resolve which photographed render represents a setting + style.
  function render(settingId, styleId) {
    const s = settings[settingId];
    if (s.styles.includes(styleId)) return { setting: s, exact: true };
    const alt = catOf(s.cat).settings.map(x => settings[x[0]]).find(x => x.styles.includes(styleId));
    return { setting: alt, exact: false };
  }
  function views(settingId, styleId) {
    const r = render(settingId, styleId);
    const key = `${r.setting.id}-${styleId}`;
    const v = [{ id: 'ext', label: 'Exterior', src: `/img/ext-${key}.webp` },
               { id: 'int', label: 'Interior', src: `/img/int-${styleId}.webp` }];
    if (TWILIGHT.has(key)) v.push({ id: 'twi', label: 'Twilight', src: `/img/twi-${key}.webp` });
    return { ...r, views: v };
  }
  function price(design) {
    const s = settings[design.setting], st = styleOf(design.style), z = SIZES.find(x => x.id === design.size);
    const layoutMult = { single: 1, two: 1.02, cantilever: 1.15, courtyard: 1.08 }[design.layout] || 1;
    return Math.round(z.sqft * st.rate * CAT_MULT[s.cat] * layoutMult / 100000) * 100000;
  }
  return { CATS, STYLES, LAYOUTS, SIZES, settings, catOf, styleOf, render, views, price };
})();

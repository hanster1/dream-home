(() => {
  const { CATS, STYLES, LAYOUTS, SIZES, settings, catOf, styleOf, views, price } = window.DH;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app'), drawer = $('#drawer');
  const STEPS = ['Setting', 'Architecture', 'Layout', 'Size', 'Reveal'];
  const KEY = 'dreamhome.saved.v1';
  const state = { step: -1, cat: 'beach', setting: null, style: null, layout: null, size: null, view: 'ext', compare: [] };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`;
  const fmt = n => n.toLocaleString('en-US');
  const loadSaved = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const storeSaved = l => { localStorage.setItem(KEY, JSON.stringify(l)); $('#savedCount').textContent = l.length; };
  const design = () => ({ setting: state.setting, style: state.style, layout: state.layout, size: state.size });
  const dKey = d => [d.setting, d.style, d.layout, d.size].join('.');
  const valid = d => d && settings[d.setting] && styleOf(d.style) && LAYOUTS.some(l => l.id === d.layout) && SIZES.some(z => z.id === d.size);

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }

  function renderStepper() {
    $('#stepper').innerHTML = STEPS.map((s, i) => {
      const cls = i === state.step ? 'cur' : i < state.step ? 'done' : '';
      const can = i < state.step;
      return `<li class="${cls}"><button ${can ? '' : 'disabled'} data-go="${i}"><span>${i + 1}</span>${s}</button></li>`;
    }).join('');
    document.body.dataset.step = state.step;
  }

  function go(step) {
    state.step = step;
    if (step === 4) history.replaceState(null, '', '#' + new URLSearchParams(design()).toString());
    else if (location.hash) history.replaceState(null, '', location.pathname);
    renderStepper();
    app.classList.remove('enter'); void app.offsetWidth;
    app.innerHTML = [intro, pickSetting, pickStyle, pickLayout, pickSize, reveal][step + 1]();
    app.classList.add('enter');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (step === 4) setTimeout(() => $('.reveal')?.classList.add('lit'), 60);
  }

  const head = (n, title, sub) => `<div class="head"><p class="eyebrow">Step ${n} of 4</p><h1>${title}</h1><p class="sub">${sub}</p></div>`;
  const nav = (back, nextOk, nextLabel = 'Continue') => `<div class="navbar"><button class="ghost" data-go="${back}">← Back</button><button class="cta" data-next ${nextOk ? '' : 'disabled'}>${nextLabel} →</button></div>`;

  function intro() {
    return `<section class="hero">
      <img src="/img/ext-malibu-glass.webp" alt="Glass modern home on the Malibu bluffs" class="kb">
      <div class="hero-copy">
        <p class="eyebrow">The Dream Home Issue</p>
        <h1>Where would you <em>live</em>, if you could live anywhere?</h1>
        <p class="sub">Choose a setting, an architect's language, a plan and a scale. We'll photograph the house for you: outside, inside, and after dark.</p>
        <button class="cta big" data-go="0">Begin your home →</button>
        <p class="meta">15 settings · 6 architectures · 4 plans · 4 scales</p>
      </div></section>`;
  }

  function pickSetting() {
    const c = catOf(state.cat);
    return `${head(1, 'Choose your setting', 'Five landscapes, three extraordinary sites in each.')}
      <div class="tabs" role="tablist">${CATS.map(x => `<button role="tab" aria-selected="${x.id === state.cat}" data-cat="${x.id}">${x.name}</button>`).join('')}</div>
      <p class="kicker">${c.kicker}</p>
      <div class="grid g3">${c.settings.map(([id]) => {
        const s = settings[id];
        return `<button class="card ${state.setting === id ? 'sel' : ''}" data-setting="${id}">
          <img loading="lazy" src="/img/set-${id}.webp" alt="${esc(s.name)}"><div class="cap"><h3>${esc(s.name)}</h3><p class="place">${esc(s.place)}</p><p>${esc(s.blurb)}</p></div></button>`;
      }).join('')}</div>${nav(-1, !!state.setting)}`;
  }

  function pickStyle() {
    const s = settings[state.setting];
    return `${head(2, 'Choose the architecture', `Each one photographed in ${esc(catOf(s.cat).name.toLowerCase())} like ${esc(s.name)}.`)}
      <div class="grid g3">${STYLES.map(st => {
        const v = views(state.setting, st.id);
        return `<button class="card ${state.style === st.id ? 'sel' : ''}" data-style="${st.id}">
          <img loading="lazy" src="/img/ext-${v.setting.id}-${st.id}-sm.webp" alt="${esc(st.name)}"><div class="cap"><h3>${st.name}</h3><p>${st.line}</p>${v.exact ? '<p class="place">At your site</p>' : `<p class="place">Shown at ${esc(v.setting.name)}</p>`}</div></button>`;
      }).join('')}</div>${nav(0, !!state.style)}`;
  }

  function pickLayout() {
    return `${head(3, 'Choose the plan', 'How the house meets the land.')}
      <div class="grid g4">${LAYOUTS.map(l => `<button class="opt ${state.layout === l.id ? 'sel' : ''}" data-layout="${l.id}">
        <svg viewBox="0 0 64 48" aria-hidden="true"><path d="${l.icon}"/></svg><h3>${l.name}</h3><p>${l.line}</p></button>`).join('')}</div>${nav(1, !!state.layout)}`;
  }

  function pickSize() {
    return `${head(4, 'Choose the scale', 'From a weekend retreat to a family compound.')}
      <div class="grid g4">${SIZES.map(z => `<button class="opt ${state.size === z.id ? 'sel' : ''}" data-size="${z.id}">
        <p class="big-num">${fmt(z.sqft)}<small> sq ft</small></p><h3>${z.name}</h3><p>${z.beds} bedrooms · ${z.baths} baths</p><p>${z.line}</p></button>`).join('')}</div>${nav(2, !!state.size, 'Reveal my home')}`;
  }

  function title(d) {
    const s = settings[d.setting], st = styleOf(d.style), l = LAYOUTS.find(x => x.id === d.layout);
    const SHORT = { malibu: 'Malibu', tulum: 'Tulum', amalfi: 'Amalfi', redwoods: 'Redwood', pnw: 'Cascade', aspen: 'Aspen', tahoe: 'Tahoe', como: 'Como', banff: 'Moraine', tetons: 'Teton', gorge: 'Gorge', dordogne: 'Dordogne', manhattan: 'Park Avenue', hollywood: 'Canyon', tokyo: 'Azabu' };
    const NOUN = { glass: 'Glass House', aframe: 'A-Frame', med: 'Villa', japandi: 'Pavilion', farmhouse: 'Farmhouse', brutalist: 'Concrete House' };
    return `The ${SHORT[s.id]} ${NOUN[st.id]}` + (l.id === 'courtyard' ? ' & Courtyard' : '');
  }

  function summary(d, compact) {
    const s = settings[d.setting], st = styleOf(d.style), l = LAYOUTS.find(x => x.id === d.layout), z = SIZES.find(x => x.id === d.size);
    return `<dl class="facts ${compact ? 'compact' : ''}">
      <div><dt>Setting</dt><dd>${esc(s.name)}<small>${esc(s.place)}</small></dd></div>
      <div><dt>Architecture</dt><dd>${st.name}</dd></div>
      <div><dt>Plan</dt><dd>${l.name}</dd></div>
      <div><dt>Scale</dt><dd>${fmt(z.sqft)} sq ft<small>${z.beds} bd · ${z.baths} ba</small></dd></div>
      <div><dt>Est. build</dt><dd>${money(price(d))}<small>illustrative</small></dd></div></dl>`;
  }

  function reveal() {
    const d = design(), v = views(d.setting, d.style), s = settings[d.setting], st = styleOf(d.style), l = LAYOUTS.find(x => x.id === d.layout);
    if (!v.views.some(x => x.id === state.view)) state.view = 'ext';
    const cur = v.views.find(x => x.id === state.view);
    const saved = loadSaved().some(x => dKey(x) === dKey(d));
    return `<section class="reveal">
      <div class="stage">
        ${v.views.map(x => `<img class="shot ${x.id === state.view ? 'on' : ''}" data-v="${x.id}" src="${x.src}" alt="${x.label} view of your ${esc(st.name)} home">`).join('')}
        <div class="curtain"></div>
        <div class="vtabs" role="tablist">${v.views.map(x => `<button role="tab" aria-selected="${x.id === state.view}" data-view="${x.id}">${x.label}</button>`).join('')}</div>
      </div>
      <article class="summary">
        <p class="eyebrow">Your dream home</p>
        <h1>${esc(title(d))}</h1>
        <p class="dek">A ${l.name.toLowerCase()} ${st.name} home ${v.exact ? 'at' : 'for'} ${esc(s.name)}, ${esc(s.place)}. ${st.line}</p>
        ${v.exact ? '' : `<p class="note">The exterior is shown in a similar ${catOf(s.cat).name.toLowerCase().replace(/s$/, '')} setting: ${esc(v.setting.name)}.</p>`}
        ${cur.id === 'int' ? '<p class="note">Interior shows the style\'s signature great room.</p>' : ''}
        ${summary(d)}
        <div class="actions">
          <button class="cta" data-save ${saved ? 'disabled' : ''}>${saved ? 'Saved ✓' : 'Save home'}</button>
          <button class="ghost" data-share>Share link</button>
          <button class="ghost" data-go="0">Design another</button>
        </div>
      </article></section>`;
  }

  function renderDrawer() {
    const list = loadSaved();
    const cmp = state.compare.map(k => list.find(x => dKey(x) === k)).filter(Boolean);
    drawer.innerHTML = `<div class="drawer-in"><div class="drawer-head"><h2>Saved homes</h2><button class="ghost" data-close aria-label="Close">✕</button></div>
      ${list.length ? `<p class="hint">Tick two homes to compare them side by side.</p>` : '<p class="hint">Homes you save appear here. They stay in this browser.</p>'}
      <ul class="saved">${list.map(d => { const k = dKey(d), v = views(d.setting, d.style); return `<li>
        <img src="/img/ext-${v.setting.id}-${d.style}-sm.webp" alt="">
        <div><h3>${esc(title(d))}</h3><p>${fmt(SIZES.find(z => z.id === d.size).sqft)} sq ft · ${money(price(d))}</p>
        <div class="row"><label><input type="checkbox" data-cmp="${k}" ${state.compare.includes(k) ? 'checked' : ''}> Compare</label><button class="link" data-open="${k}">Open</button><button class="link" data-del="${k}">Remove</button></div></div></li>`; }).join('')}</ul>
      ${cmp.length === 2 ? `<div class="compare">${cmp.map(d => { const v = views(d.setting, d.style); return `<div><img src="/img/ext-${v.setting.id}-${d.style}.webp" alt=""><h3>${esc(title(d))}</h3>${summary(d, true)}</div>`; }).join('')}</div>` : ''}
    </div>`;
  }
  function openDrawer(on) { drawer.classList.toggle('on', on); drawer.setAttribute('aria-hidden', String(!on)); if (on) renderDrawer(); }

  document.addEventListener('click', async e => {
    const b = e.target.closest('button, a[data-home], input');
    if (!b) { if (e.target === drawer) openDrawer(false); return; }
    const ds = b.dataset;
    if ('home' in ds) { e.preventDefault(); go(-1); }
    else if (ds.go !== undefined) go(+ds.go);
    else if (ds.cat) { state.cat = ds.cat; go(0); }
    else if (ds.setting) { state.setting = ds.setting; go(0); setTimeout(() => $('.navbar')?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50); }
    else if (ds.style) { state.style = ds.style; go(1); }
    else if (ds.layout) { state.layout = ds.layout; go(2); }
    else if (ds.size) { state.size = ds.size; go(3); }
    else if ('next' in ds) { state.view = 'ext'; go(state.step + 1); }
    else if (ds.view) {
      state.view = ds.view;
      document.querySelectorAll('.shot').forEach(i => i.classList.toggle('on', i.dataset.v === ds.view));
      document.querySelectorAll('.vtabs button').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === ds.view)));
      const n = $('.summary .note:last-of-type'); if (n && /Interior/.test(n.textContent) && ds.view !== 'int') n.remove();
    }
    else if ('save' in ds) { const l = loadSaved(); l.unshift(design()); storeSaved(l.slice(0, 24)); b.textContent = 'Saved ✓'; b.disabled = true; toast('Saved to your homes'); }
    else if ('share' in ds) {
      const url = location.origin + '/#' + new URLSearchParams(design()).toString();
      try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ title: title(design()), url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } }
      catch { prompt('Copy this link', url); }
    }
    else if (b.id === 'savedBtn') openDrawer(true);
    else if ('close' in ds) openDrawer(false);
    else if (ds.del) { storeSaved(loadSaved().filter(x => dKey(x) !== ds.del)); state.compare = state.compare.filter(k => k !== ds.del); renderDrawer(); if (state.step === 4) go(4); }
    else if (ds.open) { Object.assign(state, loadSaved().find(x => dKey(x) === ds.open)); state.cat = settings[state.setting].cat; openDrawer(false); go(4); }
    else if (ds.cmp) { state.compare = b.checked ? [...state.compare.filter(k => k !== ds.cmp), ds.cmp].slice(-2) : state.compare.filter(k => k !== ds.cmp); renderDrawer(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') openDrawer(false); });

  // Boot: shared link → straight to the reveal.
  storeSaved(loadSaved());
  const p = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  if (valid(p)) { Object.assign(state, p); state.cat = settings[p.setting].cat; go(4); } else go(-1);
})();

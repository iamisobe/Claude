// ============================================================
// GRIMVALE — UI: input routing, dialogs, choices, panels, HUD.
// ============================================================
'use strict';

const $ = id => document.getElementById(id);

// ---------- input ----------
const Input = {
  stack: [],          // active modal handlers; top receives normalized keys
  held: {},           // for world movement
  keys: {},           // raw key state (e.g. literal 'a' during the fishing reel)
  push(h){ this.stack.push(h); this.sync(); },
  pop(h){ const i = this.stack.lastIndexOf(h); if (i >= 0) this.stack.splice(i,1); this.sync(); },
  top(){ return this.stack[this.stack.length-1]; },
  // touch layout: while a modal is open, hide combat controls so menus
  // are visible and directly tappable
  sync(){ document.body.classList.toggle('modal-open', this.stack.length > 0); },
};
function normKey(e){
  switch (e.key){
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    case 'z': case 'Z': case 'Enter': case ' ': return 'ok';
    case 'x': case 'X': case 'Escape': return 'no';
  }
  return null;
}
document.addEventListener('keydown', e => {
  if (typeof SFX !== 'undefined' && e.isTrusted) SFX.unlock();
  Input.keys[e.key] = true;
  const k = normKey(e);
  if (k){
    e.preventDefault();
    Input.held[k] = true;
  }
  const h = Input.top();
  if (h){ if (k) h(k); return; }
  // no modal: world receives the raw key (real-time controls)
  if (typeof World !== 'undefined' && World.active){
    if ('zZxXkKcClL'.includes(e.key) || e.key === 'Escape' || e.key === 'Enter') e.preventDefault();
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') World.face(k);
    World.rawKey(e.key);
  }
});
document.addEventListener('keyup', e => {
  Input.keys[e.key] = false;
  const k = normKey(e);
  if (k) Input.held[k] = false;
});

// device-appropriate control names for UI text ('A' on-screen button vs keys)
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const KEYN = IS_TOUCH
  ? { a:'A', bolt:'BOLT', jar:'JAR', menu:'☰' }
  : { a:'Z', bolt:'X', jar:'C', menu:'Esc' };

// ---------- touch controls (mobile / iPad) ----------
// Buttons synthesize the same key events the keyboard handler consumes,
// so all game logic (modals + real-time world) works identically.
function fireKey(type, key){ document.dispatchEvent(new KeyboardEvent(type, { key })); }
function initTouch(){
  const wrap = $('touch');
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const touchable = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || coarse;
  if (!touchable) return;                 // desktop: leave hidden, keyboard only
  wrap.classList.remove('hidden');
  document.body.classList.add('touch-on');
  for (const btn of wrap.querySelectorAll('.tbtn')){
    const key = btn.dataset.key;
    const down = ev => { ev.preventDefault(); if (typeof SFX !== 'undefined') SFX.unlock();
      btn.classList.add('down'); fireKey('keydown', key); };
    const up   = ev => { ev.preventDefault(); btn.classList.remove('down');
      fireKey('keyup', key); };   // all buttons report release (A is HELD while reeling fish)
    btn.addEventListener('touchstart', down, { passive:false });
    btn.addEventListener('touchend',   up,   { passive:false });
    btn.addEventListener('touchcancel',up,   { passive:false });
    // also support mouse for testing on desktop
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup',   up);
    btn.addEventListener('mouseleave',e => { if (btn.classList.contains('down')) up(e); });
  }
}

function initHotbar(){
  for (const el of document.querySelectorAll('.hslot')){
    const fire = ev => { ev.preventDefault(); if (typeof SFX !== 'undefined') SFX.unlock();
      if (G.started && !Input.top()) Combat.castSkill((G.hotbar || [])[+el.dataset.i]); };
    el.addEventListener('click', fire);
    el.addEventListener('touchstart', fire, { passive:false });
  }
}

// ---------- responsive scaling: fit the 720×528 frame to the screen ----------
// On touch devices the frame shrinks further to leave real bezels for
// the controls (sides in landscape, bottom strip helps in portrait),
// so buttons NEVER overlap the game.
function fitScreen(){
  const g = $('game');
  if (!g) return;
  const touch = document.body.classList.contains('touch-on');
  const w = window.innerWidth, h = window.innerHeight;
  let availW = w - 8, availH = h - 8;
  if (touch){
    if (w >= h){ availW = w - 400; availH = h - 16; }   // landscape: side bezels
    else { availW = w - 16; availH = h - 260; }          // portrait: bottom strip
  }
  const s = Math.max(0.3, Math.min(availW / 720, availH / 528));
  const portrait = touch && w < h;
  g.style.transform = `scale(${s})`;
  // portrait: pin the game to the top so it scales downward, leaving
  // the bottom strip for the controls
  g.style.transformOrigin = portrait ? 'top center' : 'center center';
  document.body.style.alignItems = portrait ? 'flex-start' : 'center';
  g.style.marginTop = portrait ? '8px' : '0';
}
window.addEventListener('resize', fitScreen);
window.addEventListener('orientationchange', () => setTimeout(fitScreen, 200));

// ---------- UI module ----------
const UI = (() => {

  // ----- dialog -----
  function say(lines, name){
    if (typeof lines === 'string') lines = [lines];
    const box = $('dialog'), txt = $('dialog-text'), nm = $('dialog-name');
    nm.textContent = name || '';
    nm.style.display = name ? '' : 'none';
    box.classList.remove('hidden');
    let i = 0;
    txt.textContent = lines[0];
    return new Promise(res => {
      const h = k => {
        if (k !== 'ok' && k !== 'no') return;
        i++;
        if (i < lines.length){ txt.textContent = lines[i]; return; }
        box.classList.add('hidden');
        Input.pop(h);
        res();
      };
      Input.push(h);
      box.onclick = () => h('ok');
    });
  }

  // ----- choice: resolves index, or -1 if cancelable and cancelled -----
  function choice(options, opts = {}){
    const box = $('choice');
    box.innerHTML = '';
    let sel = 0;
    const els = options.map((o, i) => {
      const d = document.createElement('div');
      d.className = 'opt'; d.textContent = o;
      d.onclick = () => { sel = i; done(i); };
      box.appendChild(d);
      return d;
    });
    function paint(){ els.forEach((e,i)=>e.classList.toggle('sel', i===sel)); els[sel].scrollIntoView({block:'nearest'}); }
    paint();
    box.classList.remove('hidden');
    let resolve;
    function done(v){ if (typeof SFX !== 'undefined') SFX.play('ui');
      box.classList.add('hidden'); Input.pop(h); resolve(v); }
    const h = k => {
      if (k === 'up'){ sel = (sel+options.length-1)%options.length; paint(); }
      else if (k === 'down'){ sel = (sel+1)%options.length; paint(); }
      else if (k === 'ok') done(sel);
      else if (k === 'no' && opts.cancelable !== false) done(-1);
    };
    Input.push(h);
    return new Promise(r => resolve = r);
  }

  async function confirm(prompt, name){
    await say(prompt, name);
    return (await choice(['Yes','No'])) === 0;
  }

  // ----- toast -----
  let toastT = null;
  function toast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = setTimeout(()=>t.classList.add('hidden'), 2200);
  }

  // ----- HUD -----
  const MOONS = ['🌑 New','🌒 Waxing','🌕 Full','🌘 Waning'];
  function moonPhase(){ return G.time.day % 4; } // 0 new, 2 full
  function isNight(){ const h = Math.floor(G.time.min/60); return h >= 20 || h < 6; }
  function hud(){
    if (!G.started) return;
    $('hud').classList.remove('hidden');
    $('vitals').classList.remove('hidden');
    $('hud-gold').textContent = '⛁ ' + G.gold;
    const h = Math.floor(G.time.min/60), m = Math.floor(G.time.min%60);
    $('hud-time').textContent = `Day ${G.time.day} — ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    $('hud-moon').textContent = MOONS[moonPhase()];
    $('hud-loc').textContent = World.locName();
    // vitals
    const ps = Combat.pstats();
    $('hp-fill').style.width = Math.max(0, G.pc.hp / ps.maxhp * 100) + '%';
    $('hp-txt').textContent = `${Math.ceil(G.pc.hp)}/${ps.maxhp}`;
    $('soul-fill').style.width = Math.max(0, G.pc.soul / ps.maxsoul * 100) + '%';
    $('soul-txt').textContent = `${Math.floor(G.pc.soul)}/${ps.maxsoul}`;
    $('pack-txt').textContent = `☠ ${G.party.filter(g => g.hp > 0).length}/${G.party.length} pack (cap ${Combat.minionCap()})`;
    // hotbar
    $('hotbar').classList.remove('hidden');
    const slots = document.querySelectorAll('.hslot');
    (G.hotbar || []).forEach((id, i) => {
      const el = slots[i];
      if (!el) return;
      const A = id && ACTIVES[id];
      el.querySelector('.hicon').textContent = A ? A.icon : '';
      const cd = A ? ((G.pc.cds || {})[id] || 0) : 0;
      el.querySelector('.hcd').style.height = A && cd > 0 ? `${Math.min(100, cd / A.cd * 100)}%` : '0';
      el.classList.toggle('ready', !!A && cd <= 0 && G.pc.soul >= A.soul);
      el.classList.toggle('nosoul', !!A && G.pc.soul < A.soul);
    });
  }

  // ----- generic list panel -----
  // items: [{spr:canvas|null, html:string, dim:bool}] -> resolves index or -1
  function panelList(title, items, opts = {}){
    const p = $('panel');
    p.innerHTML = `<h2>${title}</h2>`;
    let sel = 0;
    const rows = items.map((it, i) => {
      const r = document.createElement('div');
      r.className = 'row';
      if (it.spr){
        const c = document.createElement('canvas');
        c.width = it.spr.width; c.height = it.spr.height;
        c.getContext('2d').drawImage(it.spr, 0, 0);
        r.appendChild(c);
      }
      const d = document.createElement('div');
      d.className = 'grow'; d.innerHTML = it.html;
      r.appendChild(d);
      if (it.dim) r.style.opacity = .45;
      r.onclick = () => { sel = i; done(i); };
      p.appendChild(r);
      return r;
    });
    if (!items.length) p.insertAdjacentHTML('beforeend', '<div class="panel-foot">— nothing here —</div>');
    if (opts.footer) p.insertAdjacentHTML('beforeend', `<div class="panel-foot">${opts.footer}</div>`);
    function paint(){ rows.forEach((r,i)=>r.classList.toggle('sel', i===sel)); rows[sel]?.scrollIntoView({block:'nearest'}); }
    paint();
    p.classList.remove('hidden');
    let resolve;
    function done(v){ if (typeof SFX !== 'undefined') SFX.play('ui');
      p.classList.add('hidden'); Input.pop(h); resolve(v); }
    const h = k => {
      if (!rows.length){ if (k==='no'||k==='ok') done(-1); return; }
      if (k === 'up'){ sel = (sel+rows.length-1)%rows.length; paint(); }
      else if (k === 'down'){ sel = (sel+1)%rows.length; paint(); }
      else if (k === 'ok') done(sel);
      else if (k === 'no') done(-1);
    };
    Input.push(h);
    return new Promise(r => resolve = r);
  }

  function hpbarHTML(g){
    const st = statsFor(g.sp, g.lvl);
    const pct = Math.max(0, g.hp/st.maxhp);
    const cls = pct > .5 ? '' : pct > .2 ? ' mid' : ' low';
    return `<div class="hpbar${cls}"><div style="width:${pct*100}%"></div></div>`;
  }
  function grimRowHTML(g){
    const st = statsFor(g.sp, g.lvl);
    const types = DEX[g.sp].ty.map(t=>`<span class="tag" style="color:${TYPES[t].col}">${TYPES[t].n}</span>`).join(' ');
    const status = g.status ? ` <span class="tag" style="color:#e85d5d">${g.status.toUpperCase()}</span>` : '';
    return `<b>${g.nick}</b> <span class="dim">Lv.${g.lvl}</span> ${types}${status}<br>
      ${hpbarHTML(g)} <span class="dim">${Math.max(0,g.hp)}/${st.maxhp} HP</span>`;
  }

  // ----- party panel: resolves index of chosen grim or -1 -----
  function party(title = 'YOUR GRIMS'){
    return panelList(title, G.party.map(g => ({ spr: SPR.creature(g.sp), html: grimRowHTML(g) })),
      { footer: 'Z: select · X: back' });
  }

  async function grimSummary(g){
    const st = statsFor(g.sp, g.lvl), d = DEX[g.sp];
    const next = xpForLevel(g.lvl+1) - g.xp;
    const arch = ARCH[g.sp];
    const archD = { chaser:'melee — charges and bites', wisp:'swift melee — darts erratically',
      spitter:'ranged — keeps distance, spits bolts', tank:'bruiser — slow, heavy, durable',
      caster:'artillery — fires 3-bolt volleys' }[arch];
    await panelList(`${g.nick} — ${d.n}`, [
      { spr:SPR.creature(g.sp), html: grimRowHTML(g) },
      { html: `ATK ${st.atk} · DEF ${st.def} · SPD ${st.spd} · SPC ${st.spc}<br><span class="dim">XP ${g.xp} (${next} to next level)</span>` },
      { html: `<b>Fighting style:</b> ${arch.toUpperCase()} <span class="dim">(${archD})</span>` },
      { html: `<span class="dim">${d.desc}</span>` },
    ], { footer: 'X: back' });
  }

  // ----- bag -----
  function bagEntries(filter){
    return Object.entries(G.bag)
      .filter(([id, n]) => n > 0 && (!filter || filter(ITEMS[id], id)))
      .map(([id, n]) => ({ id, n }));
  }
  // resolves itemId or null
  async function pickItem(filter, title = 'SATCHEL'){
    const es = bagEntries(filter);
    const i = await panelList(title, es.map(e => ({
      html: `<b>${ITEMS[e.id].n}</b> ×${e.n}<br><span class="dim">${ITEMS[e.id].d || ''}</span>`
    })), { footer: 'Z: select · X: back' });
    return i >= 0 ? es[i].id : null;
  }

  return { say, choice, confirm, toast, hud, panelList, party, grimSummary,
           pickItem, bagEntries, hpbarHTML, grimRowHTML, moonPhase, isNight };
})();

// ---------- inventory ----------
const Inv = {
  add(id, n = 1){ G.bag[id] = (G.bag[id] || 0) + n; },
  take(id, n = 1){
    if ((G.bag[id] || 0) < n) return false;
    G.bag[id] -= n;
    if (G.bag[id] <= 0) delete G.bag[id];
    return true;
  },
  count(id){ return G.bag[id] || 0; },
  bestRod(){
    let best = 0;
    for (const id in G.bag) if (ITEMS[id].k === 'rod') best = Math.max(best, ITEMS[id].tier);
    return best;
  },
  bestBait(){
    let best = null;
    for (const id in G.bag)
      if (ITEMS[id].k === 'bait' && G.bag[id] > 0 && (!best || ITEMS[id].tier > ITEMS[best].tier)) best = id;
    return best;
  },
};

// use a heal/revive/cure item on a grim. returns message or null (no effect)
function useItemOn(itemId, g){
  const it = ITEMS[itemId];
  const st = statsFor(g.sp, g.lvl);
  if (it.k === 'heal'){
    if (g.hp <= 0 || g.hp >= st.maxhp) return null;
    const before = g.hp;
    g.hp = Math.min(st.maxhp, g.hp + it.amt);
    return `${g.nick} recovered ${g.hp - before} HP!`;
  }
  if (it.k === 'revive'){
    if (g.hp > 0) return null;
    g.hp = Math.floor(st.maxhp/2); g.status = null;
    return `${g.nick} drew a second breath!`;
  }
  if (it.k === 'cure'){
    if (!g.status) return null;
    g.status = null;
    return `${g.nick} was cleansed!`;
  }
  return null;
}

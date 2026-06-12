// Headless smoke test: loads every game script with DOM stubs and
// validates data integrity, map geometry, and core mechanics.
// Run: node test/smoke.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- universal stub: callable, chainable, property-tolerant ---
function anyStub(){
  const f = function(){ return p; };
  const p = new Proxy(f, {
    get(t, k){
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'length') return 0;
      if (k === Symbol.iterator) return function*(){};
      return p;
    },
    set(){ return true; },
    apply(){ return p; },
  });
  return p;
}
const stub = anyStub();

const sandbox = {
  console, Math, JSON, Object, Array, Promise, Number, String, Boolean, Set, Map,
  setTimeout, clearTimeout, parseFloat, parseInt,
  document: stub, window: stub, navigator: { maxTouchPoints: 0 }, performance: { now: () => 0 },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => 0,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  prompt: () => null,
  KeyboardEvent: function(){ return {}; },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const files = ['data.js','sprites.js','ui.js','combat.js','world.js','systems.js','tutorial.js','main.js'];
for (const f of files){
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
}

let fails = 0;
function check(name, cond, extra){
  if (cond) console.log('  ok  ' + name);
  else { console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); fails++; }
}

vm.runInContext(`(${function tests(check){
  // ---- species ----
  for (const [k, s] of Object.entries(DEX)){
    check(`dex ${k}: 16 art rows`, s.art.length === 16, 'rows=' + s.art.length);
    const maxW = s.sym ? 8 : 16;
    check(`dex ${k}: row widths <= ${maxW}`, s.art.every(r => r.length <= maxW),
      s.art.map(r=>r.length).join(','));
    check(`dex ${k}: base stats`, s.base.length === 5 && s.base.every(b => b > 0));
    check(`dex ${k}: types valid`, s.ty.every(t => TYPES[t]));
    check(`dex ${k}: moves exist`, s.mv.every(([l,m]) => MOVES[m]), JSON.stringify(s.mv));
    check(`dex ${k}: has lvl-1 move`, s.mv.some(([l]) => l === 1));
    if (s.ev) check(`dex ${k}: evolves to real species`, !!DEX[s.ev.to]);
  }
  // ---- moves reference valid types ----
  for (const [k, m] of Object.entries(MOVES))
    check(`move ${k}: type valid`, !!TYPES[m.t]);
  // ---- items / crops / brews / tables ----
  for (const [k, c] of Object.entries(CROPS)){
    if (c.item) check(`crop ${k}: item exists`, !!ITEMS[c.item]);
    if (c.hatch){
      const hs = Array.isArray(c.hatch) ? c.hatch : [c.hatch];
      check(`crop ${k}: hatch species exist`, hs.every(h => DEX[h]));
    }
  }
  for (const b of BREWS){
    check(`brew ${b.out}: output item exists`, !!ITEMS[b.out]);
    check(`brew ${b.out}: inputs exist`, Object.keys(b.ins).every(i => ITEMS[i]));
    check(`brew ${b.out}: has skill gate`, SKILL_REQ.brew[b.out] >= 1);
  }
  for (const e of FISH_TABLE) check(`fish ${e.sp}: species exists`, !!DEX[e.sp]);
  for (const [zone, list] of Object.entries(ENCOUNTERS))
    check(`encounters ${zone}: species exist`, list.every(e => DEX[e.sp]));
  check('rival pool species exist', RIVAL_POOL.every(s => DEX[s]));
  for (const id of Object.entries(ITEMS).filter(([,i]) => i.k === 'seed').map(([k]) => k))
    check(`seed item ${id}: crop exists`, !!CROPS[ITEMS[id].crop]);
  check('seed skill gates cover all crops', Object.keys(CROPS).every(c => SKILL_REQ.seed[c] >= 1));

  // ---- maps ----
  check('town rows uniform width 36', TOWN_ROWS.every(r => r.length === 36),
    TOWN_ROWS.map(r=>r.length).join(','));
  check('town has 28 rows', TOWN_ROWS.length === 28);
  check('manor rows uniform width 26', MANOR_ROWS.every(r => r.length === 26),
    MANOR_ROWS.map(r=>r.length).join(','));
  check('manor has 18 rows', MANOR_ROWS.length === 18);
  const woods = genWoods().rows;
  check('woods rows uniform width 30', woods.every(r => r.length === 30));
  check('woods exit is path', woods[0][15] === 'p');

  // every map char has a sprite mapping
  const chars = new Set();
  for (const rows of [TOWN_ROWS, MANOR_ROWS, woods]) for (const r of rows) for (const c of r) chars.add(c);
  check('all map chars have sprites', [...chars].every(c => TILE_SPR[c]),
    [...chars].filter(c => !TILE_SPR[c]).join(''));

  // key tiles
  const tt = (x,y) => TOWN_ROWS[y][x];
  check('manor door at town (17,5)', tt(17,5) === 'D');
  check('shop door at town (9,14)', tt(9,14) === 'D');
  check('arena door at town (24,14)', tt(24,14) === 'D');
  check('witch door at town (4,20)', tt(4,20) === 'D');
  check('catacomb hole at town (4,6)', tt(4,6) === 'h');
  check('south gate at town (17,27)(18,27)', tt(17,27) === 'p' && tt(18,27) === 'p');
  check('player start (17,8) walkable', tt(17,8) === 'p');
  check('cata exit spot (4,7) walkable', tt(4,7) === 'g');
  check('lake water present', tt(26,19) === 'w');
  check('farm soil at (27,3)', tt(27,3) === 's');
  const mt = (x,y) => MANOR_ROWS[y][x];
  check('manor exit door (13,17)', mt(13,17) === 'D');
  check('manor entry spot (13,16) floor', mt(13,16) === 'F');
  check('bed (10,8) / box (12,8) / cauldron (3,8)', mt(10,8) === 'b' && mt(12,8) === 'x' && mt(3,8) === 'k');
  check('altar (20,2) / crypt chest (22,2)', mt(20,2) === 'A' && mt(22,2) === 'C');
  check('conservatory plots', mt(3,2) === 's' && mt(5,2) === 's' && mt(7,2) === 's');
  for (const [key, room] of Object.entries(RESTORE_AT)){
    const [x,y] = key.split(',').map(Number);
    check(`rubble for ${room} at (${x},${y})`, mt(x,y) === 'R');
  }
  // NPC tiles walkable-adjacent (they stand on non-solid ground)
  for (const [x,y] of [[6,21],[11,15],[25,15],[28,17],[7,8]])
    check(`town npc spot (${x},${y}) not solid terrain`, !'#wfGBrWRCbkxAih'.includes(tt(x,y)), tt(x,y));

  // ---- catacomb generation: stairs always connected ----
  for (let trial = 0; trial < 30; trial++){
    const floor = 1 + trial % 12;
    const c = genCata(floor === 5 ? 5 : floor);
    const rows = c.rows;
    let u = null, d = null;
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++){
      if (r[x] === 'u') u = [x,y]; if (r[x] === 'd') d = [x,y]; } });
    if (!u || !d){ check(`cata trial ${trial}: stairs exist`, false); continue; }
    // flood fill
    const open = new Set(); const q = [u];
    open.add(u.join(','));
    while (q.length){
      const [x,y] = q.pop();
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x+dx, ny = y+dy, ch = rows[ny] && rows[ny][nx];
        if (ch && ch !== 'X' && !open.has(nx+','+ny)){ open.add(nx+','+ny); q.push([nx,ny]); }
      }
    }
    check(`cata trial ${trial} (B${floor}): d reachable from u`, open.has(d.join(',')));
    if (c.boss) check(`cata trial ${trial}: boss on open tile`, open.has(c.boss.join(',')));
  }

  // ---- real-time combat data ----
  for (const k of Object.keys(DEX))
    check(`arch ${k}: defined`, !!ARCH[k] && !!ARCH_STATS[ARCH[k]], ARCH[k]);
  // gear rolls are sane
  for (let i = 0; i < 40; i++){
    const g = rollGear(1 + i % 30);
    check(`gear roll ${i}: valid`, Object.keys(GEAR_SLOTS).includes(g.slot)
      && Object.keys(g.aff).length >= 1 && Object.keys(g.aff).every(k => AFFIXES[k])
      && g.rar >= 0 && g.rar <= 2, JSON.stringify(g));
  }
  // ---- zones: fixed bands, valid species, traversable, nodes ----
  {
    let prevMax = 0;
    let cur = 'woods';
    const chain = [];
    while (cur){ chain.push(cur); cur = ZONES[cur].next; }
    check('zone chain length >= 7', chain.length >= 7, chain.join('>'));
    for (const id of chain){
      const Z = ZONES[id];
      check(`zone ${id}: species exist`, Z.enemies.every(e => DEX[e.sp]));
      check(`zone ${id}: tougher than the last`, Z.lvl[0] > prevMax || id === 'woods',
        `${Z.lvl[0]} vs prev max ${prevMax}`);
      prevMax = Z.lvl[1];
      if (Z.oreTier) check(`zone ${id}: ore item exists`, !!ITEMS[Z.oreTier]);
      if (Z.plot) check(`zone ${id}: plot defined`, PLOTS[Z.plot] && PLOTS[Z.plot].map === id);
    }
    for (const [c2, nd] of Object.entries(NODES))
      if (nd.item) check(`node ${c2}: item exists`, !!ITEMS[nd.item]);
    for (const f of FORGE) check(`forge ${f.ore}: item exists`, !!ITEMS[f.ore]);
    // generated zones: gates connected, plot footprint clear
    const SOLIDZ = new Set(['#','w','Y','O','Q','V','C','i']);
    for (const id of chain){
      if (id === 'woods') continue;
      for (let trial = 0; trial < 5; trial++){
        const gz = genZone(id);
        const rows = gz.rows;
        check(`zone ${id} t${trial}: rows uniform`, rows.every(r => r.length === rows[0].length));
        const start = gz.gates.prev || gz.gates.next;
        const seen = new Set([start.join(',')]);
        const q = [start];
        while (q.length){
          const [x,y] = q.pop();
          for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const nx=x+dx, ny=y+dy, ch=rows[ny] && rows[ny][nx];
            if (ch && !SOLIDZ.has(ch) && !seen.has(nx+','+ny)){ seen.add(nx+','+ny); q.push([nx,ny]); }
          }
        }
        if (gz.gates.prev && gz.gates.next)
          check(`zone ${id} t${trial}: gates connected`, seen.has(gz.gates.next.join(',')));
        if (ZONES[id].plot){
          const p = PLOTS[ZONES[id].plot];
          check(`zone ${id} t${trial}: plot clear+reachable`,
            rows[p.y][p.x] === 'g' && seen.has(p.x + ',' + (p.y+1)));
        }
      }
    }
  }

  // ---- plots ----
  const woods2 = genWoods().rows;
  const mapRows = { town: TOWN_ROWS, woods: woods2 };
  const SOLID2 = new Set(['#','w','f','G','B','r','W','R','C','b','k','x','A','i','h','X','s']);
  for (const [id, p] of Object.entries(PLOTS)){
    if (!mapRows[p.map]){ check(`plot ${id}: in a real zone`, !!ZONES[p.map]); continue; }
    const rows = mapRows[p.map];
    const ok = t => t && !SOLID2.has(t);
    check(`plot ${id}: post tile open`, ok(rows[p.y] && rows[p.y][p.x]), rows[p.y] && rows[p.y][p.x]);
    check(`plot ${id}: house body open`, ok(rows[p.y-1][p.x]) && ok(rows[p.y-1][p.x-1]),
      rows[p.y-1][p.x] + rows[p.y-1][p.x-1]);
    check(`plot ${id}: approach tile open`, ok(rows[p.y+1] && rows[p.y+1][p.x]));
  }
  for (const t of PLOT_TIERS.slice(1)){
    check(`tier ${t.n}: cost items exist`, Object.keys(t.cost).every(k => k === 'gold' || ITEMS[k]));
  }
  check('arena map uniform', ARENA_ROWS.every(r => r.length === ARENA_ROWS[0].length));

  // ---- quests: rewards exist, checks run against a fresh game shape ----
  {
    const mockG = { stats:{}, dex:{}, cata:{}, arena:{rank:1,wins:0}, manor:{restored:{}},
      houses:{}, flags:{}, kills:0, quest:{} };
    QUESTS.forEach((q, i) => {
      check(`quest ${i} (${q.n}): reward items exist`,
        Object.keys(q.reward.items || {}).every(k => ITEMS[k]));
      const v = q.cur(mockG);
      check(`quest ${i} (${q.n}): check runs on fresh game`, typeof v === 'number' && v >= 0, String(v));
      check(`quest ${i} (${q.n}): req positive`, q.req > 0);
    });
    const b = bountyQuest(3);
    check('bounty quest valid', b.req > 0 && typeof b.cur(mockG) === 'number'
      && Object.keys(b.reward.items).every(k => ITEMS[k]));
  }

  // ---- talent tree data ----
  {
    const ids = new Set();
    for (const [b, B] of Object.entries(TREE)){
      for (const nd of B.nodes){
        check(`talent ${nd.id}: unique id`, !ids.has(nd.id));
        ids.add(nd.id);
        check(`talent ${nd.id}: desc renders`, typeof nd.d(1) === 'string' && nd.d(1).length > 0);
        check(`talent ${nd.id}: sane`, nd.max >= 1 && nd.tier >= 0 && nd.tier < TREE_TIER_REQ.length);
      }
    }
  }

  // ---- active skills ----
  for (const [id, A] of Object.entries(ACTIVES)){
    check(`active ${id}: tree node exists`, Object.values(TREE).some(B => B.nodes.some(nd => nd.id === id && nd.active)));
    check(`active ${id}: sane`, A.cd > 0 && A.soul > 0 && typeof A.d(1) === 'string' && !!A.icon);
  }

  // ---- mechanics math ----
  for (const k of Object.keys(DEX)){
    const g5 = makeGrim(k, 5), g40 = makeGrim(k, 40);
    check(`makeGrim ${k}: moves 1-4`, g5.moves.length >= 1 && g5.moves.length <= 4 && g40.moves.length <= 4);
    check(`makeGrim ${k}: hp positive`, g5.hp > 0 && g40.hp > g5.hp);
  }
  check('typeMult dual', typeMult('EMBER', ['FLORA','FROST']) === 4);
  check('typeMult resist', typeMult('EMBER', ['DROWNED']) === 0.5);
  check('typeMult neutral NONE', typeMult('NONE', ['SPIRIT','BONE']) === 1);
  check('skill level curve starts at 1', skillLevel(0) === 1 && skillXpFor(1) === 0);
  check('skill levels are endless & monotonic',
    skillLevel(skillXpFor(50)) === 50 && skillXpFor(51) > skillXpFor(50));
  check('xp curve', xpForLevel(10) === 1000);
  const w = pickW([{w:1, id:'a'}]); check('pickW returns entry', w.id === 'a');
  // fish economy: every fish species has a catch item and a render yield
  for (const e of FISH_TABLE){
    check(`fish item for ${e.sp} exists`, !!ITEMS['fish_' + e.sp]);
    const y = FISH_YIELD['fish_' + e.sp];
    check(`fish yield for ${e.sp} valid`, !!y && Object.keys(y).every(k => ITEMS[k]), JSON.stringify(y));
  }
  // moon fish availability: at least one fish at rod 1, day, any moon
  const basePool = FISH_TABLE.filter(e => e.rod <= 1 && !e.night && !e.moon);
  check('rod-1 daytime fish exists', basePool.length >= 1);
}})`, sandbox)(check);

console.log(fails ? `\n${fails} FAILURES` : '\nAll smoke tests passed.');
process.exit(fails ? 1 : 0);

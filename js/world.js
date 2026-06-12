// ============================================================
// GRIMVALE — world: maps, free movement, camera, time, plots,
// interactions. Combat happens live on these maps (combat.js).
// ============================================================
'use strict';

const TILE = 48;            // 16px art × 3
const VIEW_W = 15, VIEW_H = 11;

// tile char -> sprite name
const TILE_SPR = {
  '#':'tree','g':'grass','c':'cgrass','p':'path','w':'water','f':'fence','G':'grave',
  's':'soil','B':'bwall','r':'roof','D':'door','F':'floor','W':'iwall','R':'rubble',
  'u':'stairsU','d':'stairsD','C':'chest','b':'bed','k':'cauldron','x':'box','A':'altar',
  'i':'sign','l':'flower','m':'dirt','h':'hole','a':'arena','E':'cfloor','X':'cwall',
  'Y':'ntree','O':'nrock','Q':'nore_ironore','V':'nwisp','N':'board',
};
const SOLID = new Set(['#','w','f','G','B','r','W','R','C','b','k','x','A','i','h','X','s','Y','O','Q','V','N']);
// chars drawn as overlays on the zone's ground tile
const OVERLAY = new Set(['#','Y','O','Q','V']);

// ---------- static maps ----------
const TOWN_ROWS = [
'####################################',
'#ggggggggggggrrrrrrrrrrggfffffffffg#',
'#ggGgGgGgGgggrrrrrrrrrrggfgggggggfg#',
'#ggggggggggggrrrrrrrrrrggfgsgsgsgfg#',
'#ggGgGgGgGgggBBBBBBBBBBggfgggggggfg#',
'#ggggggggggggBBBBDBBBBBggfgsgsgsgfg#',
'#ggghigggggggggggpggggggfgggggggfgg#',
'#ggGgGgGgGgggggggpggggggffffgffffgg#',
'#ggggggggggggggggpggggggglgggglggg##',
'#ggggggggggggggggpgggNgggggggggggg##',
'#gglggggglgggggggpgggggggggggggggg##',
'#ggggggrrrrrrggggpgggrrrrrrrgggggg##',
'#ggggggrrrrrrggggpgggrrrrrrrgggggg##',
'#ggggggBBBBBBggggpgggBBBBBBBgggggg##',
'#ggggggBBDBBBggggpgggBBBDBBBgggggg##',
'#ggggggggpgggggggpggggggpggggggggg##',
'#gpppppppppppppppppppppppppppppppgg#',
'#grrrrrggggggggggpggggggggggggggg###',
'#grrrrrggggggggggpggggggwwwwwwwwggg#',
'#gBBBBBggggggggggpggggggwwwwwwwwggg#',
'#gBBDBBggggggggggpggggggwwwwwwwwggg#',
'#ggggggggggggggggpggggggwwwwwwwwggg#',
'#ggggggggggggggggpggggggwwwwwwwwggg#',
'#gglgggggggggggggpggggggwwwwwwwwggg#',
'#ggggggggggggggggpgggggggggggglgggg#',
'#gglgggggglggggggpggggggggggggggg###',
'#ggggggggggggggggpggggggggggggggggg#',
'#################pp#################',
];

const MANOR_ROWS = [
'WWWWWWWWWWWWWWWWWWWWWWWWWW',
'WFFFFFFFFFWWWWWWFFFFFFFFFW',
'WFFsFsFsFFWWWWWWFFFFAFCFFW',
'WFFFFFFFFFWWWWWWFFFFFFFFFW',
'WFFFFFFFFFWWWWWWFFFFFFFFFW',
'WFFFFFFFFFWWWWWWFFFFFFFFFW',
'WWWWWRWWWWWWWWWWWWWWRWWWWW',
'WFFFFFFWFFFFFFFFFFWFFFFFFW',
'WFFkFFFWFFbFxFFFFFWFFFFFFW',
'WFFFFFFRFFFFFFFFFFRFFFFFFW',
'WFFFFFFWFFFFFFFFFFWFFFFFFW',
'WFFFFFFWFFFFFFFFFFWFFFFFFW',
'WFFFFFFWFFFFFFFFFFWFFFFFFW',
'WFFFFFFFFFFFFFFFFFFFFFFFFW',
'WFFFFFFFFFFFFFFFFFFFFFFFFW',
'WFFFFFFFFFFFFFFFFFFFFFFFFW',
'WFFFFFFFFFFFFFFFFFFFFFFFFW',
'WWWWWWWWWWWWWDWWWWWWWWWWWW',
];
const RESTORE_AT = { '7,9':'kitchen', '18,9':'study', '5,6':'conservatory', '20,6':'crypt' };

const ARENA_ROWS = [
'WWWWWWWWWWWWWWWWW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WaaaaaaaaaaaaaaaW',
'WWWWWWWWDWWWWWWWW',
];

function genWoods(){
  const w = 30, h = 24;
  const rows = [];
  for (let y = 0; y < h; y++){
    let r = '';
    for (let x = 0; x < w; x++) r += (x===0||y===0||x===w-1||y===h-1) ? '#' : 'g';
    rows.push(r);
  }
  const set = (x,y,c) => { rows[y] = rows[y].slice(0,x) + c + rows[y].slice(x+1); };
  const rect = (x,y,rw,rh,c) => { for (let j=y;j<y+rh;j++) for (let i=x;i<x+rw;i++) set(i,j,c); };
  set(15,0,'p'); rect(15,1,1,4,'p');
  rect(3,3,8,5,'c'); rect(14,5,9,6,'c'); rect(4,14,7,6,'c'); rect(18,12,7,4,'c'); rect(20,19,6,3,'c');
  [[6,9],[7,9],[12,3],[12,4],[20,3],[21,3],[3,11],[13,16],[14,16],[10,20],[16,18]]
    .forEach(([x,y]) => set(x,y,'#'));
  rect(23,16,5,4,'w');
  set(27,2,'C'); set(2,21,'l'); set(17,8,'l'); rect(7,11,3,2,'m');
  // harvest nodes + the east gate onward to Gravefen
  [[4,8,'Y'],[10,16,'Y'],[19,9,'Y'],[24,5,'Y'],[8,21,'Y'],[5,12,'O'],[22,12,'O']]
    .forEach(([x,y,c2]) => set(x,y,c2));
  set(29,12,'p'); set(28,12,'g'); set(27,12,'g');
  return { rows, gates: { next:[29,12] } };
}

// procedural zone: ground field, solid scatter, cursed patches, nodes,
// gates on the left (back) and right (onward) edges of row 13
function genZone(id){
  const Z = ZONES[id];
  const w = 34, h = 26, mid = 13;
  const rows = [];
  for (let y = 0; y < h; y++){
    let r = '';
    for (let x = 0; x < w; x++) r += (x===0||y===0||x===w-1||y===h-1) ? '#' : 'g';
    rows.push(r);
  }
  const set = (x,y,c) => { rows[y] = rows[y].slice(0,x) + c + rows[y].slice(x+1); };
  const get = (x,y) => rows[y] && rows[y][x];
  const rect = (x,y,rw,rh,c) => { for (let j=y;j<y+rh;j++) for (let i=x;i<x+rw;i++) if (get(i,j)) set(i,j,c); };
  // keep the crossing road clear
  const clear = (x,y) => get(x,y) === 'g' && !(y >= mid-1 && y <= mid+1 && true);
  // solid scatter
  for (let i = 0; i < 26; i++){
    const x = 2 + rnd(w-4), y = 2 + rnd(h-4);
    if (clear(x,y)) set(x,y,'#');
  }
  // cursed patches (encounter flavor)
  for (let i = 0; i < 5; i++){
    const x = 2 + rnd(w-10), y = 2 + rnd(h-10);
    for (let j=0;j<4+rnd(4);j++) for (let k2=0;k2<3+rnd(3);k2++)
      if (get(x+j,y+k2) === 'g') set(x+j,y+k2,'c');
  }
  // water pool (fishable)
  if (Z.water){
    const wx = 4 + rnd(w-14), wy = rnd(2) ? 3 + rnd(6) : h - 9 + rnd(3);
    rect(wx, wy, 5, 3, 'w');
  }
  // harvest nodes
  for (const [c2, n] of Object.entries(Z.nodes || {})){
    let placed = 0, guard = 0;
    while (placed < n && guard++ < 200){
      const x = 2 + rnd(w-4), y = 2 + rnd(h-4);
      if (get(x,y) === 'g' && Math.abs(y - mid) > 1){ set(x,y,c2); placed++; }
    }
  }
  // one chest
  for (let g2 = 0; g2 < 60; g2++){
    const x = 3 + rnd(w-6), y = 3 + rnd(h-6);
    if (get(x,y) === 'g' && Math.abs(y-mid) > 1){ set(x,y,'C'); break; }
  }
  // gates + cleared road row
  for (let x = 1; x < w-1; x++) if ('#YOQVCw'.includes(get(x,mid))) set(x,mid,'g');
  const gates = {};
  if (Z.prev){ set(0,mid,'p'); set(1,mid,'g'); gates.prev = [0,mid]; }
  if (Z.next){ set(w-1,mid,'p'); set(w-2,mid,'g'); gates.next = [w-1,mid]; }
  // warning sign by the back gate
  if (Z.prev) set(2, mid-1, 'i');
  // deed plot: clear its footprint
  if (Z.plot){
    const p = PLOTS[Z.plot];
    for (let j = -2; j <= 1; j++) for (let i = -2; i <= 2; i++){
      const X = p.x + i, Y2 = p.y + j;
      if (X > 0 && X < w-1 && Y2 > 0 && Y2 < h-1) set(X, Y2, 'g');
    }
  }
  return { rows, gates };
}

function genCata(floor){
  const w = 23, h = 17;
  const grid = Array.from({length:h}, () => Array(w).fill('X'));
  let x = 11, y = 8;
  const start = [x,y];
  let far = [x,y], farD = 0;
  const carved = [];
  grid[y][x] = 'E'; carved.push([x,y]);
  for (let i = 0; i < 260; i++){
    const d = [[1,0],[-1,0],[0,1],[0,-1]][rnd(4)];
    const nx = Math.min(w-2, Math.max(1, x+d[0]));
    const ny = Math.min(h-2, Math.max(1, y+d[1]));
    x = nx; y = ny;
    if (grid[y][x] === 'X'){ grid[y][x] = 'E'; carved.push([x,y]); }
    const dist = Math.abs(x-start[0]) + Math.abs(y-start[1]);
    if (dist > farD){ farD = dist; far = [x,y]; }
  }
  grid[start[1]][start[0]] = 'u';
  grid[far[1]][far[0]] = 'd';
  const spots = carved.filter(([cx,cy]) => (cx!==start[0]||cy!==start[1]) && (cx!==far[0]||cy!==far[1]));
  const nChest = 1 + (rnd(100) < 45 ? 1 : 0);
  for (let i = 0; i < nChest && spots.length; i++){
    const s = spots.splice(rnd(spots.length),1)[0];
    grid[s[1]][s[0]] = 'C';
  }
  let boss = null;
  if (floor % 5 === 0){
    const opts = [[far[0]-1,far[1]],[far[0]+1,far[1]],[far[0],far[1]-1],[far[0],far[1]+1]]
      .filter(([bx,by]) => grid[by]?.[bx] === 'E');
    if (opts.length) boss = opts[0];
  }
  return { rows: grid.map(r => r.join('')), boss, start, far };
}

// house interior, sized by tier
function genHouse(tier){
  const w = 6 + tier*2, h = 5 + tier;
  const rows = [];
  for (let y = 0; y < h; y++){
    let r = '';
    for (let x = 0; x < w; x++) r += (x===0||y===0||x===w-1||y===h-1) ? 'W' : 'F';
    rows.push(r);
  }
  const set = (x,y,c) => { rows[y] = rows[y].slice(0,x) + c + rows[y].slice(x+1); };
  set(2, 1, 'b');                          // bed
  set(Math.floor(w/2), h-1, 'D');          // exit door
  return rows;
}

// ---------- world module ----------
const World = (() => {
  const cvs = $('world'), ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = {
    active: false, map: 'town', rows: [], w: 0, h: 0,
    ppx: 17*TILE+24, ppy: 8*TILE+24,   // pixel pos
    dir: 0,                            // 0 down 1 up 2 left 3 right
    cataFloor: 0, cata: null,
    houseId: null, zoneGates: null, nodeHits: {},
    stepFrame: 0, animT: 0, lastDay: 1,
  };
  const tileOf = v => Math.floor(v / TILE);

  function loadRows(map){
    if (map === 'town') return TOWN_ROWS.slice();
    if (map === 'woods'){ const g = genWoods(); W.zoneGates = g.gates; return g.rows; }
    if (ZONES[map]){ const g = genZone(map); W.zoneGates = g.gates; return g.rows; }
    if (map === 'arena') return ARENA_ROWS.slice();
    if (map === 'house') return genHouse(plotTier(W.houseId) || 1);
    if (map === 'manor'){
      const rows = MANOR_ROWS.slice();
      for (const [key, room] of Object.entries(RESTORE_AT)){
        if (G.manor.restored[room]){
          const [x,y] = key.split(',').map(Number);
          rows[y] = rows[y].slice(0,x) + 'F' + rows[y].slice(x+1);
        }
      }
      return rows;
    }
    if (map === 'cata') return W.cata.rows;
    return TOWN_ROWS.slice();
  }

  function enter(map, x, y){
    if (G.stats){ G.stats.zones = G.stats.zones || {}; if (ZONES[map]) G.stats.zones[map] = true; }
    if (map === 'cata' && !W.cata) W.cata = genCata(W.cataFloor);
    W.map = map;
    W.zoneGates = null;
    W.nodeHits = {};
    W.rows = loadRows(map);
    W.h = W.rows.length; W.w = W.rows[0].length;
    W.ppx = x*TILE + TILE/2; W.ppy = y*TILE + TILE/2;
    G.pos = { map, x, y };
    if (typeof Combat !== 'undefined')
      Combat.reset(ZONES[map] ? map : map === 'cata' ? 'cata' : null);
  }

  function tileAt(x, y){
    if (x < 0 || y < 0 || y >= W.h || x >= W.w) return '#';
    return W.rows[y][x];
  }
  function setTile(x, y, c){ W.rows[y] = W.rows[y].slice(0,x) + c + W.rows[y].slice(x+1); }

  // ---------- plots on this map ----------
  function plotsHere(){
    return Object.entries(PLOTS).filter(([, p]) => p.map === W.map);
  }
  function plotAt(x, y){
    for (const [id, p] of plotsHere()){
      if (x === p.x && y === p.y) return id;                                    // deed post
      if (plotTier(id) >= 1 && y === p.y - 1 && (x === p.x || x === p.x - 1)) return id; // house body
    }
    return null;
  }

  function npcs(){
    const list = [];
    if (W.map === 'town'){
      list.push(
        { x:6,  y:21, kind:'witch',  name:'Witch Morwen', script:() => Systems.witch() },
        { x:11, y:15, kind:'shop',   name:'Shopkeep Odd', script:() => Systems.shop() },
        { x:25, y:15, kind:'master', name:'Master Grell', script:() => Systems.arena() },
        { x:28, y:17, kind:'fisher', name:'Fisher Eli',   script:() => Systems.fisherTalk() },
        { x:7,  y:8,  kind:'digger', name:'Gravedigger',  script:() => Systems.diggerTalk() },
      );
    }
    if (W.map === 'woods' && G.flags.woodsRivalDay !== G.time.day){
      list.push({ x:8, y:11, kind:'rival', name:'Wandering Rival', script:() => Systems.woodsDuel() });
    }
    return list;
  }
  function npcAt(x, y){ return npcs().find(n => n.x === x && n.y === y); }

  function solidTile(x, y){
    const t = tileAt(x, y);
    if (SOLID.has(t)) return true;
    if (npcAt(x, y)) return true;
    if (plotAt(x, y)) return true;
    if ((W.map === 'manor' || W.map === 'house') && furnitureList().some(f => f.x === x && f.y === y)) return true;
    return false;
  }
  function solidPx(px, py){ return solidTile(tileOf(px), tileOf(py)); }
  // what stops projectiles: walls and trees, but NOT water — bolts fly over the lake
  function shotBlockedPx(px, py){ return '#BrWX'.includes(tileAt(tileOf(px), tileOf(py))); }
  function furnitureList(){
    if (W.map === 'manor') return G.manor.furniture;
    if (W.map === 'house' && W.houseId) return G.houses[W.houseId].furniture;
    return [];
  }

  // ---------- step events (warps & stairs) ----------
  async function stepOn(x, y){
    const t = tileAt(x, y);
    const at = (ax,ay) => x === ax && y === ay;
    if (W.map === 'town'){
      if (at(17,5)) return enter('manor', 13, 16);
      if (at(9,14)) { W.ppy = 15*TILE+24; return Systems.shop(); }
      if (at(24,14)){ W.ppy = 15*TILE+24; return Systems.arena(); }
      if (at(4,20)) { W.ppy = 21*TILE+24; return Systems.witch(); }
      if (at(17,27) || at(18,27)) return enter('woods', 15, 1);
    } else if (W.map === 'woods'){
      if (at(15,0)) return enter('town', 17, 26);
      if (W.zoneGates?.next && at(...W.zoneGates.next)) return enter('fen', 1, 13);
    } else if (ZONES[W.map]){
      const Z = ZONES[W.map];
      if (W.zoneGates?.prev && at(...W.zoneGates.prev))
        return Z.prev === 'woods' ? enter('woods', 28, 12) : enter(Z.prev, 32, 13);
      if (W.zoneGates?.next && at(...W.zoneGates.next)) return enter(Z.next, 1, 13);
    } else if (W.map === 'manor'){
      if (t === 'D') return enter('town', 17, 6);
    } else if (W.map === 'house'){
      if (t === 'D'){
        const p = PLOTS[W.houseId];
        const id = W.houseId; W.houseId = null;
        return enter(p.map, p.x, p.y + 1);
      }
    } else if (W.map === 'arena'){
      if (t === 'D'){ Systems.arenaExit(); return; }
    } else if (W.map === 'cata'){
      if (t === 'd') return Systems.descend();
      if (t === 'u') return Systems.ascend();
    }
  }

  // ---------- interact ----------
  const FACE_VECS = [[0,1],[0,-1],[-1,0],[1,0]];
  function faceVec(){ return FACE_VECS[W.dir]; }
  const DIR_OF = { down:0, up:1, left:2, right:3 };
  function face(name){ if (DIR_OF[name] !== undefined) W.dir = DIR_OF[name]; }
  function facingTile(){
    const [fx, fy] = faceVec();
    return [tileOf(W.ppx) + fx, tileOf(W.ppy) + fy];
  }
  function interactable(){
    const [fx, fy] = facingTile();
    if (npcAt(fx, fy)) return true;
    const pid = plotAt(fx, fy);
    if (pid) return true;
    return 'wsbkxRCihAYOQVN'.includes(tileAt(fx, fy)) ||
      ((W.map === 'manor' || W.map === 'house') && furnitureList().some(f => f.x === fx && f.y === fy));
  }
  async function interact(){
    const [fx, fy] = facingTile();
    const n = npcAt(fx, fy);
    if (n) return n.script();
    const pid = plotAt(fx, fy);
    if (pid) return Systems.plotMenu(pid);
    const t = tileAt(fx, fy);
    switch (t){
      case 'w': return Systems.fish();
      case 's': return Systems.plot(fx, fy);
      case 'b': return Systems.sleep();
      case 'k': return Systems.cauldron();
      case 'x': return Systems.storage();
      case 'R': return Systems.restore(fx, fy);
      case 'C': return Systems.chest(fx, fy);
      case 'h': return Systems.enterCata();
      case 'A': return Systems.altar();
      case 'Y': case 'O': case 'Q': case 'V': return Systems.gather(t, fx, fy);
      case 'N': return Systems.questBoard();
      case 'i': {
        const Z = ZONES[W.map];
        if (Z) return UI.say([`A warning is carved here: "${Z.n.toUpperCase()} — beasts of level ${Z.lvl[0]} to ${Z.lvl[1]}."`,
          '"Turn back if your pack is green. The valley does not soften for anyone."']);
        return UI.say(['"Here lies the door to the catacombs."',
          '"Depth is wealth. Depth is also teeth. — The Gravedigger"']);
      }
      case 'F':
        if (W.map === 'manor' || W.map === 'house') return Systems.placeFurniture(fx, fy);
        break;
    }
  }

  // raw key input while no modal is open
  function rawKey(key){
    if (!W.active) return;
    switch (key){
      case 'z': case 'Z': case ' ':
        // interact takes priority when something interactable is faced and no enemy is on top of us
        if (interactable() && !Combat.nearestEnemy(W.ppx, W.ppy, 70)) interact();
        else Combat.playerAttack();
        break;
      case 'x': case 'X': case 'k': case 'K': Combat.playerBolt(); break;
      case 'c': case 'C': case 'l': case 'L': Combat.throwJar(); break;
      case 'Escape': case 'Enter': Systems.pauseMenu(); break;
    }
  }

  // ---------- update ----------
  function update(dt){
    if (!W.active) return;
    if (Input.top()) return; // modal open: world & combat pause
    // time: 2 game minutes per real second
    G.time.min += dt * 2;
    if (G.time.min >= 1440){
      G.time.min -= 1440; G.time.day++;
      const rent = plotTier('townhouse') * 60;
      if (rent){ G.gold += rent; UI.toast(`Rent collected: +${rent}⛁`); }
    }
    // movement
    let mx = 0, my = 0;
    if (Input.held.left) mx -= 1;
    if (Input.held.right) mx += 1;
    if (Input.held.up) my -= 1;
    if (Input.held.down) my += 1;
    if (mx || my){
      const len = Math.hypot(mx, my);
      const spd = Combat.pstats().speed;
      const nx = W.ppx + mx/len * spd * dt;
      const ny = W.ppy + my/len * spd * dt;
      const r = 13;
      const oldTx = tileOf(W.ppx), oldTy = tileOf(W.ppy);
      if (![[-r,-4],[r,-4],[-r,r],[r,r]].some(([ox,oy]) => solidPx(nx+ox, W.ppy+oy))) W.ppx = nx;
      if (![[-r,-4],[r,-4],[-r,r],[r,r]].some(([ox,oy]) => solidPx(W.ppx+ox, ny+oy))) W.ppy = ny;
      W.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 3 : 2) : (my > 0 ? 0 : 1);
      W.animT += dt;
      if (W.animT > 0.18){ W.animT = 0; W.stepFrame ^= 1; }
      const tx = tileOf(W.ppx), ty = tileOf(W.ppy);
      if (tx !== oldTx || ty !== oldTy){
        G.pos = { map:W.map, x:tx, y:ty };
        stepOn(tx, ty);
      }
    }
    Combat.update(dt);
    UI.hud();
  }

  // ---------- draw ----------
  function tileSprite(x, y, t){
    if (t === 's'){
      const p = G.farm[`${W.map}:${x},${y}`];
      return SPR.get(p && p.wet ? 'soilwet' : 'soil');
    }
    if (t === 'C'){
      if (W.map !== 'cata' && G.flags.chests[`${W.map}:${x},${y}`]) return SPR.get('chestO');
      if (W.map === 'cata' && W.cata.opened?.[`${x},${y}`]) return SPR.get('chestO');
    }
    if (t === 'x' && W.map === 'manor' && !G.manor.storageBuilt) return SPR.get('boxBroken');
    const Z = ZONES[W.map];
    if (Z && t === 'g' && Z.ground) return SPR.get(Z.ground);
    if (Z && t === 'Q') return SPR.get('nore_' + (Z.oreTier || 'ironore'));
    return SPR.get(TILE_SPR[t] || 'grass');
  }
  function groundSprite(){
    const Z = ZONES[W.map];
    return SPR.get((Z && Z.ground) || 'grass');
  }

  function draw(){
    ctx.fillStyle = '#0b0812';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    if (!W.active) return;
    let camX = W.ppx - cvs.width/2;
    let camY = W.ppy - cvs.height/2;
    camX = Math.max(0, Math.min(W.w * TILE - cvs.width, camX));
    camY = Math.max(0, Math.min(W.h * TILE - cvs.height, camY));
    if (W.w * TILE < cvs.width) camX = (W.w * TILE - cvs.width) / 2;
    if (W.h * TILE < cvs.height) camY = (W.h * TILE - cvs.height) / 2;

    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    for (let y = y0; y <= y0 + VIEW_H + 1; y++){
      for (let x = x0; x <= x0 + VIEW_W + 1; x++){
        const t = tileAt(x, y);
        if (OVERLAY.has(t)) // trees & harvest nodes sit on the zone's ground
          ctx.drawImage(groundSprite(), Math.round(x*TILE - camX), Math.round(y*TILE - camY), TILE, TILE);
        ctx.drawImage(tileSprite(x, y, t), Math.round(x*TILE - camX), Math.round(y*TILE - camY), TILE, TILE);
        if (t === 's'){
          const p = G.farm[`${W.map}:${x},${y}`];
          if (p && p.crop){
            const stage = Systems.cropStage(p);
            const spr = stage >= 3 ? SPR.get('ready_' + p.crop) : SPR.get('crop' + stage);
            ctx.drawImage(spr, Math.round(x*TILE - camX), Math.round(y*TILE - camY), TILE, TILE);
          }
        }
      }
    }
    // furniture
    for (const f of furnitureList()){
      ctx.drawImage(SPR.get(ITEMS[f.id].spr), Math.round(f.x*TILE - camX), Math.round(f.y*TILE - camY), TILE, TILE);
    }
    // plots: deed posts + built houses
    for (const [id, p] of plotsHere()){
      const sx = Math.round(p.x*TILE - camX), sy = Math.round(p.y*TILE - camY);
      const tier = plotTier(id);
      if (tier >= 1){
        // simple house: 2 wide, drawn over the two cells above the post + roof above
        const hx = sx - TILE, hy = sy - TILE;
        ctx.fillStyle = '#3a2c4a'; ctx.fillRect(hx, hy - TILE + 14, TILE*2, TILE - 8); // roof
        ctx.fillStyle = '#2c2138'; ctx.fillRect(hx, hy - TILE + 14, TILE*2, 8);
        ctx.fillStyle = tier >= 3 ? '#5e4a76' : '#4a4055';                              // walls
        ctx.fillRect(hx, hy + 6, TILE*2, TILE - 6);
        ctx.fillStyle = '#2a2014'; ctx.fillRect(hx + TILE - 10, hy + 14, 20, TILE - 14); // door
        ctx.fillStyle = '#e8c95d'; ctx.fillRect(hx + 10, hy + 14, 8, 8);                 // window
        ctx.fillRect(hx + TILE*2 - 18, hy + 14, 8, 8);
        if (tier >= 2){ ctx.fillStyle = '#e8e08a'; ctx.fillRect(hx + TILE - 4, hy - TILE + 4, 8, 12); } // chimney
      }
      // deed post
      ctx.fillStyle = '#5a4632'; ctx.fillRect(sx + 20, sy + 10, 8, 30);
      ctx.fillStyle = tier ? '#6dd86d' : '#e8c95d';
      ctx.fillRect(sx + 8, sy + 6, 32, 14);
      ctx.fillStyle = '#17131f'; ctx.font = 'bold 9px monospace';
      ctx.fillText(tier ? 'HOME' : 'SALE', sx + 12, sy + 16);
    }
    // combat layer (enemies, minions, projectiles, drops, floaters)
    Combat.draw(ctx, camX, camY);
    drawBobber(ctx, camX, camY);
    // npcs (shadow + idle sway) — 64px detailed bodies, feet on the tile
    const nowT = performance.now();
    for (const n of npcs()){
      const nx = n.x*TILE - camX + TILE/2, ny = n.y*TILE - camY;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(nx, ny + TILE - 5, 15, 5, 0, 0, 7); ctx.fill();
      ctx.drawImage(SPR.actor(n.kind, n.dir ?? 0, 0),
        Math.round(nx - 32), Math.round(ny + TILE - 62 + Math.sin(nowT/700 + n.x) * 1.2), 64, 64);
    }
    // player: shadow, walk/idle bob, swing + cast animations
    const px = W.ppx - camX, py = W.ppy - camY;
    const moving = Input.held.left || Input.held.right || Input.held.up || Input.held.down;
    const bobY = moving ? Math.sin(nowT/130) * 1.6 : Math.sin(nowT/600) * 1.0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(px, py + 16, 15, 5, 0, 0, 7); ctx.fill();
    const fishing = typeof Systems !== 'undefined' && Systems.fishingFx && Systems.fishingFx();
    const pmode = fishing ? 'rod' : (G.pc && G.pc.swing > 0 ? 'bare' : null);
    ctx.drawImage(SPR.actor('player', W.dir, moving ? W.stepFrame : 0, pmode),
      Math.round(px - 32), Math.round(py - 44 + bobY), 64, 64);
    if (G.pc && G.pc.swing > 0){
      // staff sweeps through the strike arc
      const prog = 1 - G.pc.swing / 0.18;
      const [fvx, fvy] = faceVec();
      const base = Math.atan2(fvy, fvx);
      const ang = base - 1.2 + 2.4 * prog;
      ctx.strokeStyle = 'rgba(232,224,208,0.30)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px, py - 6, 38, base - 1.2, ang); ctx.stroke(); ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(px, py - 6);
      ctx.rotate(ang);
      ctx.drawImage(SPR.get('fx_staff'), 8, -7, 34, 14);
      ctx.restore();
    }
    if (G.pc && G.pc.cast > 0){
      // hex bolt leaves a violet flare at the staff tip
      const [fvx, fvy] = faceVec();
      const t = G.pc.cast / 0.18;
      ctx.fillStyle = `rgba(155,109,255,${0.8 * t})`;
      ctx.beginPath(); ctx.arc(px + fvx*26, py - 10 + fvy*26, 5 + (1 - t) * 10, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(205,180,255,${t})`;
      ctx.beginPath(); ctx.arc(px + fvx*26, py - 10 + fvy*26, 3, 0, 7); ctx.fill();
    }
    if (G.pc && G.pc.inv > 0.2){ ctx.strokeStyle = '#e8e0d066';
      ctx.beginPath(); ctx.arc(px, py - 6, 26, 0, 7); ctx.stroke(); }

    // light tint
    let tint = 0;
    const h = G.time.min / 60;
    if (W.map === 'cata') tint = 0.45;
    else if (W.map === 'manor' || W.map === 'house' || W.map === 'arena') tint = 0;
    else if (h >= 21 || h < 5) tint = 0.55;
    else if (h >= 19) tint = (h - 19) / 2 * 0.55;
    else if (h < 7) tint = (7 - h) / 2 * 0.55;
    if (ZONES[W.map] && ZONES[W.map].dark) tint = Math.max(tint, ZONES[W.map].dark);
    if (tint > 0){
      ctx.fillStyle = `rgba(8,5,24,${tint})`;
      ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
    if (W.map === 'cata'){
      const g = ctx.createRadialGradient(W.ppx - camX, W.ppy - camY, 90, W.ppx - camX, W.ppy - camY, 430);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
  }

  // fishing bobber: cast arc, splash, idle ripples, nibbles, bite plunge
  function drawBobber(ctx, camX, camY){
    const ff = typeof Systems !== 'undefined' && Systems.fishingFx && Systems.fishingFx();
    if (!ff) return;
    const now = performance.now();
    const px = W.ppx - camX, py = W.ppy - camY - 14;
    let bx = ff.x - camX, by = ff.y - camY;
    if (ff.phase === 'cast'){
      const t = Math.min(1, (now - ff.t) / 650);
      bx = px + (bx - px) * t;
      by = (py + (by - py) * t) - Math.sin(t * Math.PI) * 42;
      if (t >= 0.97){ // splash
        ctx.strokeStyle = 'rgba(138,216,232,0.8)';
        ctx.beginPath(); ctx.arc(ff.x - camX, ff.y - camY, 10, 0, 7); ctx.stroke();
      }
    } else {
      const dipAge = now - (ff.dip || 0);
      const nib = dipAge < 320 ? 6 : 0;
      const sink = ff.phase === 'bite' ? 9 : ff.phase === 'reel' ? 12 : 0;
      by += Math.sin(now / 380) * 2.5 + nib + sink;
      // ripples
      const rt = (now / 900) % 1;
      ctx.strokeStyle = `rgba(138,216,232,${0.5 * (1 - rt)})`;
      ctx.beginPath(); ctx.arc(bx, by - sink + 4, 6 + rt * 16, 0, 7); ctx.stroke();
      if (ff.phase === 'bite' || (nib && dipAge < 160)){
        ctx.strokeStyle = 'rgba(138,216,232,0.9)';
        ctx.beginPath(); ctx.arc(bx, by + 2, 9, 0, 7); ctx.stroke();
      }
      if (ff.phase === 'bite'){
        ctx.fillStyle = '#e8c95d';
        ctx.font = 'bold 26px monospace';
        ctx.fillText('!', bx - 5, by - 26 + Math.sin(now / 80) * 3);
      }
    }
    // line from the ROD TIP to the bobber
    const [fvx2, fvy2] = faceVec();
    const rx = px + fvx2 * 26, ry = py - 24 + (fvy2 > 0 ? 26 : fvy2 < 0 ? -8 : 0);
    ctx.strokeStyle = 'rgba(232,224,208,0.45)';
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.quadraticCurveTo((rx + bx) / 2, Math.min(ry, by) - 16, bx, by - 4);
    ctx.stroke();
    // the bobber itself
    ctx.fillStyle = '#e8442e';
    ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f8ecd0';
    ctx.beginPath(); ctx.arc(bx, by - 2, 2.5, 0, 7); ctx.fill();
  }

  function locName(){
    if (W.map === 'house' && W.houseId) return PLOTS[W.houseId].n;
    if (ZONES[W.map]) return `${ZONES[W.map].n} (Lv.${ZONES[W.map].lvl[0]}-${ZONES[W.map].lvl[1]})`;
    return { town:'Grimvale', manor:'Hollow Manor', arena:'Soul Arena',
      cata:`Catacombs B${W.cataFloor}` }[W.map] || 'Grimvale';
  }

  return {
    enter, update, draw, rawKey, face, locName, tileAt, setTile, faceVec, npcs, interactable,
    solidTile, solidPx, shotBlockedPx,
    get active(){ return W.active; }, set active(v){ W.active = v; },
    get map(){ return W.map; },
    get px(){ return tileOf(W.ppx); }, get py(){ return tileOf(W.ppy); },
    get ppx(){ return W.ppx; }, get ppy(){ return W.ppy; },
    get mapW(){ return W.w; }, get mapH(){ return W.h; },
    get cataFloor(){ return W.cataFloor; }, set cataFloor(v){ W.cataFloor = v; },
    get cata(){ return W.cata; }, set cata(v){ W.cata = v; },
    get houseId(){ return W.houseId; }, set houseId(v){ W.houseId = v; },
    zone(){ return ZONES[W.map] || null; },
    get nodeHits(){ return W.nodeHits; },
  };
})();

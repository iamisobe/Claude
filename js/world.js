// ============================================================
// GRIMVALE — world: maps, movement, camera, time, interactions.
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
};
const SOLID = new Set(['#','w','f','G','B','r','W','R','C','b','k','x','A','i','h','X','s']);

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
'#ggggggggggggggggpgggggggggggggggg##',
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
// which rubble tile unlocks which room
const RESTORE_AT = { '7,9':'kitchen', '18,9':'study', '5,6':'conservatory', '20,6':'crypt' };

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
  // path from north gate
  set(15,0,'p'); rect(15,1,1,4,'p');
  // cursed grass patches
  rect(3,3,8,5,'c'); rect(14,5,9,6,'c'); rect(4,14,7,6,'c'); rect(18,12,7,4,'c'); rect(20,19,6,3,'c');
  // tree clumps
  [[6,9],[7,9],[12,3],[12,4],[20,3],[21,3],[3,11],[13,16],[14,16],[26,9],[25,9],[10,20],[16,18]]
    .forEach(([x,y]) => set(x,y,'#'));
  // pond
  rect(23,16,5,4,'w');
  // chest + flowers + dirt clearing for the rival
  set(27,2,'C'); set(2,21,'l'); set(17,8,'l'); rect(7,11,3,2,'m');
  return rows;
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
  // chests
  const spots = carved.filter(([cx,cy]) => (cx!==start[0]||cy!==start[1]) && (cx!==far[0]||cy!==far[1]));
  const nChest = 1 + (rnd(100) < 45 ? 1 : 0);
  for (let i = 0; i < nChest && spots.length; i++){
    const s = spots.splice(rnd(spots.length),1)[0];
    grid[s[1]][s[0]] = 'C';
  }
  // boss floor: a rival guards the stairs
  let boss = null;
  if (floor % 5 === 0){
    const opts = [[far[0]-1,far[1]],[far[0]+1,far[1]],[far[0],far[1]-1],[far[0],far[1]+1]]
      .filter(([bx,by]) => grid[by]?.[bx] === 'E');
    if (opts.length) boss = opts[0];
  }
  return { rows: grid.map(r => r.join('')), boss, start, far };
}

// ---------- world module ----------
const World = (() => {
  const cvs = $('world'), ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = {
    active: false, map: 'town', rows: [], w: 0, h: 0,
    px: 17, py: 7, dir: 0, // 0 down 1 up 2 left 3 right
    mov: null,             // {fx,fy,tx,ty,t}
    cataFloor: 0, cata: null,
    stepFrame: 0,
  };

  function loadRows(map){
    if (map === 'town') return TOWN_ROWS.slice();
    if (map === 'woods') return genWoods();
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
    if (map === 'cata' && !W.cata) W.cata = genCata(W.cataFloor);
    W.map = map;
    W.rows = loadRows(map);
    W.h = W.rows.length; W.w = W.rows[0].length;
    W.px = x; W.py = y; W.mov = null;
    G.pos = { map, x, y };
  }

  function tileAt(x, y){
    if (x < 0 || y < 0 || y >= W.h || x >= W.w) return '#';
    return W.rows[y][x];
  }
  function setTile(x, y, c){ W.rows[y] = W.rows[y].slice(0,x) + c + W.rows[y].slice(x+1); }

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
    if (W.map === 'cata' && W.cata.boss && !W.cata.bossDown){
      list.push({ x:W.cata.boss[0], y:W.cata.boss[1], kind:'rival', name:'Crypt Guardian',
        script:() => Systems.cataBoss() });
    }
    return list;
  }
  function npcAt(x, y){ return npcs().find(n => n.x === x && n.y === y); }

  function solid(x, y){
    const t = tileAt(x, y);
    if (SOLID.has(t)) return true;
    if (npcAt(x, y)) return true;
    if (W.map === 'manor' && G.manor.furniture.some(f => f.x === x && f.y === y)) return true;
    return false;
  }

  // ---------- step events ----------
  async function stepOn(x, y){
    const t = tileAt(x, y);
    const at = (ax,ay) => x === ax && y === ay;
    if (W.map === 'town'){
      if (at(17,5)) return enter('manor', 13, 16);
      if (at(9,14)) { W.py = 15; return Systems.shop(); }
      if (at(24,14)){ W.py = 15; return Systems.arena(); }
      if (at(4,20)) { W.py = 21; return Systems.witch(); }
      if (at(17,27) || at(18,27)) return enter('woods', 15, 1);
    } else if (W.map === 'woods'){
      if (at(15,0)) return enter('town', 17, 26);
      if (t === 'c' && Math.random() < 0.12) return Systems.wildEncounter('woods');
    } else if (W.map === 'manor'){
      if (t === 'D') return enter('town', 17, 6);
    } else if (W.map === 'cata'){
      if (t === 'd') return Systems.descend();
      if (t === 'u') return Systems.ascend();
      if (t === 'E' && Math.random() < 0.10) return Systems.wildEncounter('cata');
    }
  }

  // ---------- interact (Z on facing tile) ----------
  function facing(){
    const d = [[0,1],[0,-1],[-1,0],[1,0]][W.dir];
    return [W.px + d[0], W.py + d[1]];
  }
  async function interact(){
    const [fx, fy] = facing();
    const n = npcAt(fx, fy);
    if (n) return n.script();
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
      case 'i': return UI.say(['"Here lies the door to the catacombs."',
        '"Depth is wealth. Depth is also teeth. — The Gravedigger"']);
      case 'F': case 'E':
        if (W.map === 'manor') return Systems.placeFurniture(fx, fy);
        break;
    }
  }

  const DIRS = { down:[0,1,0], up:[0,-1,1], left:[-1,0,2], right:[1,0,3] };
  function tryStep(name){
    const [dx, dy, d] = DIRS[name];
    W.dir = d;
    const tx = W.px + dx, ty = W.py + dy;
    if (!solid(tx, ty)){
      W.mov = { fx:W.px, fy:W.py, tx, ty, t:0 };
      W.stepFrame ^= 1;
    }
  }

  function key(k){
    if (!W.active || W.mov) return;
    if (k === 'ok') interact();
    else if (k === 'no') Systems.pauseMenu();
    else if (DIRS[k]) tryStep(k); // single tap = single step
  }

  // ---------- update ----------
  function update(dt){
    if (!W.active) return;
    // time: 2 game minutes per real second
    G.time.min += dt * 2;
    if (G.time.min >= 1440){ G.time.min -= 1440; G.time.day++; }
    G.playSec = (G.playSec || 0) + dt;
    // movement
    if (W.mov){
      W.mov.t += dt / 0.16;
      if (W.mov.t >= 1){
        W.px = W.mov.tx; W.py = W.mov.ty; W.mov = null;
        G.pos = { map: W.map, x: W.px, y: W.py };
        stepOn(W.px, W.py);
      }
    } else if (!Input.top()){
      for (const name of Object.keys(DIRS)){
        if (Input.held[name]){ tryStep(name); break; }
      }
    }
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
    return SPR.get(TILE_SPR[t] || 'grass');
  }

  function draw(){
    ctx.fillStyle = '#0b0812';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    if (!W.active) return;
    // camera (in pixels), follows interpolated player pos
    let ppx = W.px, ppy = W.py;
    if (W.mov){
      ppx = W.mov.fx + (W.mov.tx - W.mov.fx) * W.mov.t;
      ppy = W.mov.fy + (W.mov.ty - W.mov.fy) * W.mov.t;
    }
    let camX = ppx * TILE + TILE/2 - cvs.width/2;
    let camY = ppy * TILE + TILE/2 - cvs.height/2;
    camX = Math.max(0, Math.min(W.w * TILE - cvs.width, camX));
    camY = Math.max(0, Math.min(W.h * TILE - cvs.height, camY));
    if (W.w * TILE < cvs.width) camX = (W.w * TILE - cvs.width) / 2;
    if (W.h * TILE < cvs.height) camY = (W.h * TILE - cvs.height) / 2;

    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    for (let y = y0; y <= y0 + VIEW_H + 1; y++){
      for (let x = x0; x <= x0 + VIEW_W + 1; x++){
        const t = tileAt(x, y);
        ctx.drawImage(tileSprite(x, y, t), Math.round(x*TILE - camX), Math.round(y*TILE - camY), TILE, TILE);
        // crops
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
    // furniture (manor)
    if (W.map === 'manor'){
      for (const f of G.manor.furniture){
        ctx.drawImage(SPR.get(ITEMS[f.id].spr), Math.round(f.x*TILE - camX), Math.round(f.y*TILE - camY), TILE, TILE);
      }
    }
    // npcs
    for (const n of npcs()){
      ctx.drawImage(SPR.actor(n.kind, n.dir ?? 0, 0), Math.round(n.x*TILE - camX), Math.round(n.y*TILE - camY), TILE, TILE);
    }
    // player
    ctx.drawImage(SPR.actor('player', W.dir, W.mov ? W.stepFrame : 0),
      Math.round(ppx*TILE - camX), Math.round(ppy*TILE - camY - 6), TILE, TILE);

    // light tint
    let tint = 0;
    const h = G.time.min / 60;
    if (W.map === 'cata') tint = 0.45;
    else if (h >= 21 || h < 5) tint = 0.55;
    else if (h >= 19) tint = (h - 19) / 2 * 0.55;
    else if (h < 7) tint = (7 - h) / 2 * 0.55;
    if (tint > 0){
      ctx.fillStyle = `rgba(8,5,24,${tint})`;
      ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
    if (W.map === 'cata'){ // torchlight vignette
      const g = ctx.createRadialGradient(cvs.width/2, cvs.height/2, 90, cvs.width/2, cvs.height/2, 420);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
  }

  function locName(){
    return { town:'Grimvale', woods:'Murkwood', manor:'Hollow Manor',
      cata:`Catacombs B${W.cataFloor}` }[W.map] || 'Grimvale';
  }

  return {
    enter, update, draw, key, locName, tileAt, setTile, facing, npcs,
    get active(){ return W.active; }, set active(v){ W.active = v; },
    get map(){ return W.map; }, get px(){ return W.px; }, get py(){ return W.py; },
    get cataFloor(){ return W.cataFloor; }, set cataFloor(v){ W.cataFloor = v; },
    get cata(){ return W.cata; }, set cata(v){ W.cata = v; },
  };
})();

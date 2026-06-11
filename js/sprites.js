// ============================================================
// GRIMVALE — sprites: every asset generated in code, no files.
// ============================================================
'use strict';

const SPR = (() => {
  const cache = {};
  function cv(w=16, h=16){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  // deterministic noise for tile texture
  function hash(x, y, s){ let h = x*374761393 + y*668265263 + s*1442695041; h = (h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967295; }

  // --- creature art -> canvas ---
  // sym arts are full 8×16 designs rendered with 2px-wide pixels;
  // asym arts (fish etc.) are 16×16 with square pixels.
  function drawArt(art, pal, sym){
    const c = cv(16,16), x = c.getContext('2d');
    for (let r = 0; r < 16; r++){
      const row = art[r] || '';
      const w = sym ? 8 : 16;
      for (let i = 0; i < w; i++){
        const ch = row[i];
        if (!ch || ch === '.') continue;
        const col = pal[ch];
        if (!col) continue;
        x.fillStyle = col;
        if (sym) x.fillRect(i*2, r, 2, 1);
        else x.fillRect(i, r, 1, 1);
      }
    }
    return c;
  }
  function creature(key){
    const k = 'cr_'+key;
    if (!cache[k]){
      const s = DEX[key];
      cache[k] = drawArt(s.art, s.pal, !!s.sym);
    }
    return cache[k];
  }

  // --- tiles ---
  const T = {}; // name -> canvas
  function tile(name, fn){
    const c = cv(); fn(c.getContext('2d')); T[name] = c;
  }
  function fill(x, col){ x.fillStyle = col; x.fillRect(0,0,16,16); }
  function speck(x, col, n, seed){
    x.fillStyle = col;
    for (let i = 0; i < n; i++){
      x.fillRect(Math.floor(hash(i,7,seed)*16), Math.floor(hash(3,i,seed)*16), 1, 1);
    }
  }

  function buildTiles(){
    tile('grass', x => { fill(x,'#2e4a2e'); speck(x,'#3a5c3a',14,1); speck(x,'#243c24',8,2); });
    tile('cgrass', x => { fill(x,'#2a3a4a'); speck(x,'#3a5c5c',10,3); speck(x,'#9b6dff',5,4);
      x.fillStyle='#1c2a38'; x.fillRect(2,10,1,5); x.fillRect(7,8,1,7); x.fillRect(12,11,1,4);
      x.fillStyle='#4a6a7a'; x.fillRect(3,9,1,6); x.fillRect(8,7,1,8); x.fillRect(13,10,1,5); });
    tile('path', x => { fill(x,'#5a5048'); speck(x,'#6a5f55',12,5); speck(x,'#4a423c',10,6); });
    tile('dirt', x => { fill(x,'#4a3a2e'); speck(x,'#5a4a3a',12,7); speck(x,'#3a2c22',8,8); });
    tile('water', x => { fill(x,'#1f3a5c'); x.fillStyle='#2e4a78';
      x.fillRect(1,3,5,1); x.fillRect(9,7,5,1); x.fillRect(3,12,5,1);
      x.fillStyle='#16294a'; x.fillRect(8,2,4,1); x.fillRect(2,8,4,1); x.fillRect(10,13,4,1); });
    tile('tree', x => { fill(x,'#2e4a2e');
      x.fillStyle='#16241a'; x.fillRect(2,0,12,11);
      x.fillStyle='#1f3324'; x.fillRect(3,1,10,9); x.fillRect(1,3,14,6);
      x.fillStyle='#2a4530'; x.fillRect(4,2,4,3); x.fillRect(9,4,4,3);
      x.fillStyle='#3a2c1c'; x.fillRect(7,11,3,5); x.fillStyle='#2a2014'; x.fillRect(7,11,1,5); });
    tile('fence', x => { fill(x,'#2e4a2e'); speck(x,'#3a5c3a',8,9);
      x.fillStyle='#5a4632'; x.fillRect(1,6,14,2); x.fillRect(2,3,2,10); x.fillRect(12,3,2,10);
      x.fillStyle='#3e3022'; x.fillRect(2,12,2,1); x.fillRect(12,12,2,1); });
    tile('grave', x => { fill(x,'#2a3a4a'); speck(x,'#3a5c5c',6,10);
      x.fillStyle='#7a7a8a'; x.fillRect(4,3,8,10); x.fillRect(5,1,6,3);
      x.fillStyle='#9a9aaa'; x.fillRect(5,2,2,2);
      x.fillStyle='#5a5a6a'; x.fillRect(10,3,2,10); x.fillRect(4,12,8,1);
      x.fillStyle='#4a4a5a'; x.fillRect(6,6,4,1); x.fillRect(6,8,4,1); });
    tile('soil', x => { fill(x,'#4a3424'); x.fillStyle='#3a281c';
      for (let r=1;r<16;r+=4) x.fillRect(0,r,16,2); speck(x,'#5a4030',8,11); });
    tile('soilwet', x => { fill(x,'#33241a'); x.fillStyle='#281b12';
      for (let r=1;r<16;r+=4) x.fillRect(0,r,16,2); speck(x,'#1f1610',8,12); });
    tile('bwall', x => { fill(x,'#4a4055'); x.fillStyle='#3a3244';
      x.fillRect(0,4,16,1); x.fillRect(0,9,16,1); x.fillRect(0,14,16,1);
      x.fillRect(4,0,1,4); x.fillRect(11,5,1,4); x.fillRect(6,10,1,4);
      x.fillStyle='#574b66'; speck(x,'#574b66',6,13); });
    tile('roof', x => { fill(x,'#3a2c4a'); x.fillStyle='#2c2138';
      for (let r=0;r<16;r+=4) x.fillRect(0,r,16,1);
      x.fillStyle='#4a3a5e'; for (let r=1;r<16;r+=4) x.fillRect(0,r,16,1); });
    tile('door', x => { fill(x,'#4a4055'); x.fillStyle='#2a2014'; x.fillRect(2,1,12,15);
      x.fillStyle='#4a3a26'; x.fillRect(3,2,10,13); x.fillStyle='#3a2c1c'; x.fillRect(8,2,1,13);
      x.fillStyle='#e8c95d'; x.fillRect(6,8,1,2); x.fillRect(10,8,1,2); });
    tile('floor', x => { fill(x,'#4a3a2e'); x.fillStyle='#3e3026';
      x.fillRect(0,3,16,1); x.fillRect(0,7,16,1); x.fillRect(0,11,16,1); x.fillRect(0,15,16,1);
      x.fillStyle='#564538'; speck(x,'#564538',6,14); });
    tile('iwall', x => { fill(x,'#2e2440'); x.fillStyle='#241c33';
      x.fillRect(0,5,16,1); x.fillRect(0,11,16,1); x.fillRect(5,0,1,5); x.fillRect(11,6,1,5); x.fillRect(3,12,1,4);
      x.fillStyle='#3a2e50'; x.fillRect(0,15,16,1); });
    tile('rubble', x => { fill(x,'#3a3244');
      x.fillStyle='#6a6a7a'; x.fillRect(1,9,5,5); x.fillRect(8,7,6,7); x.fillRect(4,4,5,4);
      x.fillStyle='#4a4a5a'; x.fillRect(2,10,3,3); x.fillRect(10,9,3,4);
      x.fillStyle='#8a8a9a'; x.fillRect(5,5,2,2); x.fillRect(9,8,2,1); });
    tile('cfloor', x => { fill(x,'#262030'); x.fillStyle='#1e1a28';
      x.fillRect(0,5,16,1); x.fillRect(0,11,16,1); x.fillRect(5,0,1,16); x.fillRect(11,0,1,16);
      speck(x,'#322a40',5,15); });
    tile('cwall', x => { fill(x,'#14101e'); x.fillStyle='#1f1930';
      x.fillRect(1,1,6,4); x.fillRect(9,1,6,4); x.fillRect(1,7,6,4); x.fillRect(9,7,6,4); x.fillRect(1,13,6,3); x.fillRect(9,13,6,3);
      x.fillStyle='#0c0a14'; x.fillRect(0,5,16,1); x.fillRect(0,11,16,1); });
    tile('stairsD', x => { fill(x,'#262030'); x.fillStyle='#0a0810'; x.fillRect(2,2,12,12);
      x.fillStyle='#3a3244'; x.fillRect(2,2,12,3); x.fillStyle='#2a2438'; x.fillRect(4,5,10,3);
      x.fillStyle='#1c1826'; x.fillRect(6,8,8,3); });
    tile('stairsU', x => { fill(x,'#262030'); x.fillStyle='#56506a'; x.fillRect(2,11,12,3);
      x.fillStyle='#46405a'; x.fillRect(2,7,10,3); x.fillStyle='#36304a'; x.fillRect(2,3,8,3);
      x.fillStyle='#e8c95d'; x.fillRect(3,1,2,1); });
    tile('chest', x => { fill(x,'#262030');
      x.fillStyle='#5a3a1f'; x.fillRect(2,4,12,10); x.fillStyle='#7a5226'; x.fillRect(3,5,10,4);
      x.fillStyle='#e8c95d'; x.fillRect(7,8,2,3); x.fillStyle='#3a2814'; x.fillRect(2,9,12,1); });
    tile('chestO', x => { fill(x,'#262030');
      x.fillStyle='#3a2814'; x.fillRect(2,4,12,10); x.fillStyle='#5a3a1f'; x.fillRect(3,10,10,3);
      x.fillStyle='#14101e'; x.fillRect(3,5,10,5); });
    tile('bed', x => { fill(x,'#4a3a2e');
      x.fillStyle='#3a2c1c'; x.fillRect(1,1,14,14);
      x.fillStyle='#6d2e4a'; x.fillRect(2,5,12,9); x.fillStyle='#8a3a5e'; x.fillRect(2,5,12,2);
      x.fillStyle='#e8e0d0'; x.fillRect(3,2,10,3); });
    tile('cauldron', x => { fill(x,'#4a3a2e'); x.fillStyle='#3e3026'; x.fillRect(0,7,16,1);
      x.fillStyle='#1c1c24'; x.fillRect(3,5,10,9); x.fillRect(2,7,12,5);
      x.fillStyle='#2e2e3a'; x.fillRect(4,6,8,2);
      x.fillStyle='#6dd86d'; x.fillRect(4,5,8,2); x.fillStyle='#a8f0a8'; x.fillRect(6,4,2,1); x.fillRect(10,3,1,1);
      x.fillStyle='#0e0e14'; x.fillRect(2,13,3,2); x.fillRect(11,13,3,2); });
    tile('box', x => { fill(x,'#4a3a2e'); x.fillStyle='#3e3026'; x.fillRect(0,11,16,1);
      x.fillStyle='#4a3a5e'; x.fillRect(2,3,12,11); x.fillStyle='#5e4a76'; x.fillRect(3,4,10,4);
      x.fillStyle='#9b6dff'; x.fillRect(7,8,2,2); x.fillStyle='#2e2440'; x.fillRect(2,8,12,1); });
    tile('altar', x => { fill(x,'#262030');
      x.fillStyle='#56506a'; x.fillRect(3,6,10,8); x.fillStyle='#6a647e'; x.fillRect(2,5,12,2);
      x.fillStyle='#8af0e8'; x.fillRect(7,2,2,3); x.fillStyle='#46e0d0'; x.fillRect(7,1,2,1);
      x.fillStyle='#3a3450'; x.fillRect(4,8,8,1) ; x.fillRect(4,11,8,1); });
    tile('sign', x => { fill(x,'#2e4a2e'); speck(x,'#3a5c3a',8,16);
      x.fillStyle='#5a4632'; x.fillRect(3,2,10,7); x.fillRect(7,9,2,6);
      x.fillStyle='#3e3022'; x.fillRect(4,4,8,1); x.fillRect(4,6,6,1); });
    tile('flower', x => { fill(x,'#2e4a2e'); speck(x,'#3a5c3a',10,17);
      x.fillStyle='#9b6dff'; x.fillRect(3,4,2,2); x.fillRect(11,9,2,2);
      x.fillStyle='#e8e08a'; x.fillRect(4,5,1,1) ; x.fillRect(12,10,1,1);
      x.fillStyle='#3a5c3a'; x.fillRect(4,6,1,3); x.fillRect(12,11,1,2); });
    tile('arena', x => { fill(x,'#3a3244'); x.fillStyle='#322a3c';
      x.fillRect(0,0,8,8); x.fillRect(8,8,8,8);
      x.fillStyle='#9b6dff'; x.fillRect(7,7,2,2); });
    tile('hole', x => { fill(x,'#2a3a4a'); x.fillStyle='#06040a'; x.fillRect(2,2,12,12);
      x.fillStyle='#16121f'; x.fillRect(2,2,12,3);
      x.fillStyle='#56506a'; x.fillRect(1,1,14,1); x.fillRect(1,14,14,1); x.fillRect(1,1,1,14); x.fillRect(14,1,1,14); });
  }

  // --- furniture (16x16 each) ---
  function buildFurniture(){
    tile('fchair', x => { x.fillStyle='#5a3a1f'; x.fillRect(4,2,8,2); x.fillRect(4,4,2,8); x.fillRect(4,10,8,2); x.fillRect(10,4,2,8);
      x.fillStyle='#7a5226'; x.fillRect(6,5,4,5); x.fillStyle='#3a2814'; x.fillRect(4,12,2,3); x.fillRect(10,12,2,3); });
    tile('ftable', x => { x.fillStyle='#5a3a1f'; x.fillRect(1,4,14,7); x.fillStyle='#7a5226'; x.fillRect(2,5,12,4);
      x.fillStyle='#3a2814'; x.fillRect(2,11,2,4); x.fillRect(12,11,2,4);
      x.fillStyle='#e8e08a'; x.fillRect(7,5,2,2); });
    tile('frug', x => { x.fillStyle='#6d2e4a'; x.fillRect(1,2,14,12); x.fillStyle='#8a3a5e'; x.fillRect(3,4,10,8);
      x.fillStyle='#e8c95d'; x.fillRect(5,6,6,4); x.fillStyle='#6d2e4a'; x.fillRect(6,7,4,2); });
    tile('fcandle', x => { x.fillStyle='#8a8268'; x.fillRect(7,6,2,8); x.fillRect(3,7,10,1); x.fillRect(3,7,1,3); x.fillRect(12,7,1,3);
      x.fillStyle='#e8e0d0'; x.fillRect(7,4,2,2); x.fillRect(3,5,1,2); x.fillRect(12,5,1,2);
      x.fillStyle='#f0c84a'; x.fillRect(7,2,2,2); x.fillRect(3,3,1,2); x.fillRect(12,3,1,2);
      x.fillStyle='#6a6250'; x.fillRect(5,14,6,2); });
    tile('fshelf', x => { x.fillStyle='#3a2814'; x.fillRect(1,0,14,16); x.fillStyle='#5a3a1f'; x.fillRect(2,1,12,14);
      x.fillStyle='#9b6dff'; x.fillRect(3,2,2,5); x.fillStyle='#6dd86d'; x.fillRect(6,2,2,5);
      x.fillStyle='#e8825d'; x.fillRect(9,2,3,5); x.fillStyle='#5d8ae8'; x.fillRect(3,9,3,5);
      x.fillStyle='#e8c95d'; x.fillRect(7,9,2,5); x.fillStyle='#c98ad8'; x.fillRect(10,9,2,5); });
    tile('fmirror', x => { x.fillStyle='#8a8268'; x.fillRect(3,0,10,15);
      x.fillStyle='#1c2a40'; x.fillRect(4,1,8,12); x.fillStyle='#46e0d0'; x.fillRect(5,2,2,9);
      x.fillStyle='#2e4a78'; x.fillRect(8,3,3,8); });
    tile('fclock', x => { x.fillStyle='#3a2814'; x.fillRect(4,0,8,16); x.fillStyle='#5a3a1f'; x.fillRect(5,1,6,14);
      x.fillStyle='#e8e0d0'; x.fillRect(6,2,4,4); x.fillStyle='#17131f'; x.fillRect(7,3,1,2); x.fillRect(8,4,1,1);
      x.fillStyle='#e8c95d'; x.fillRect(7,9,2,3); });
    tile('fgarg', x => { x.fillStyle='#56506a'; x.fillRect(5,4,6,8); x.fillRect(3,2,3,4); x.fillRect(10,2,3,4);
      x.fillStyle='#6a647e'; x.fillRect(6,5,4,3); x.fillStyle='#e8442e'; x.fillRect(6,6,1,1); x.fillRect(9,6,1,1);
      x.fillStyle='#46405a'; x.fillRect(4,12,8,3); });
    tile('fthrone', x => { x.fillStyle='#d8d0b8'; x.fillRect(3,0,2,12); x.fillRect(11,0,2,12); x.fillRect(3,10,10,3);
      x.fillStyle='#a89e80'; x.fillRect(5,2,6,9); x.fillStyle='#6d2e4a'; x.fillRect(5,3,6,7);
      x.fillStyle='#d8d0b8'; x.fillRect(3,13,2,3); x.fillRect(11,13,2,3);
      x.fillStyle='#e8c95d'; x.fillRect(3,0,2,1); x.fillRect(11,0,2,1); });
    tile('fbanner', x => { x.fillStyle='#5a4632'; x.fillRect(2,0,12,2);
      x.fillStyle='#4a2e5e'; x.fillRect(3,2,10,12); x.fillStyle='#5e3a76'; x.fillRect(4,3,8,9);
      x.fillStyle='#e8e0d0'; x.fillRect(6,5,4,3); x.fillRect(7,8,2,1);
      x.fillStyle='#17131f'; x.fillRect(7,6,1,1); x.fillRect(9,6,1,1)
      ; x.fillStyle='#4a2e5e'; x.fillRect(3,14,3,2); x.fillRect(10,14,3,2); });
    tile('fplant', x => { x.fillStyle='#8a4a2e'; x.fillRect(5,11,6,4); x.fillStyle='#a85a36'; x.fillRect(5,11,6,1);
      x.fillStyle='#1f5c1f'; x.fillRect(7,5,2,6); x.fillRect(4,4,2,4); x.fillRect(10,3,2,5);
      x.fillStyle='#3da33d'; x.fillRect(7,3,2,3); x.fillRect(4,2,2,3); x.fillRect(10,1,2,3);
      x.fillStyle='#e8442e'; x.fillRect(10,1,1,1); });
  }

  // --- crop growth stages (0 sprout, 1 mid, 2 tall, 3 ready) ---
  function buildCrops(){
    tile('crop0', x => { x.fillStyle='#6dd86d'; x.fillRect(7,11,2,3); x.fillStyle='#3da33d'; x.fillRect(7,13,2,1); });
    tile('crop1', x => { x.fillStyle='#3da33d'; x.fillRect(7,8,2,6); x.fillStyle='#6dd86d'; x.fillRect(5,8,2,2); x.fillRect(9,9,2,2); });
    tile('crop2', x => { x.fillStyle='#2e8a2e'; x.fillRect(7,4,2,10); x.fillStyle='#3da33d'; x.fillRect(4,6,3,2); x.fillRect(9,5,3,2); x.fillRect(5,10,2,2); x.fillRect(9,9,2,2); });
    const ready = { bloodberry:'#e8442e', gravefruit:'#9b6dff', moonwheat:'#e8e08a',
      pumpkid:'#e8823a', mandragora:'#c9a86d', mystery:'#46e0d0' };
    for (const [crop, col] of Object.entries(ready)){
      tile('ready_'+crop, x => {
        x.fillStyle='#2e8a2e'; x.fillRect(7,4,2,10);
        x.fillStyle='#3da33d'; x.fillRect(4,6,3,2); x.fillRect(9,5,3,2);
        x.fillStyle=col; x.fillRect(4,8,4,4); x.fillRect(9,7,4,4);
        x.fillStyle='#17131f';
        if (crop==='pumpkid'||crop==='mandragora'||crop==='mystery'){ x.fillRect(5,9,1,1); x.fillRect(7,9,1,1); x.fillRect(10,8,1,1); x.fillRect(12,8,1,1); }
      });
    }
  }

  // --- actors: 16x16, generated from a body template + outfit colors ---
  // kinds: player, witch, shop, fisher, master, digger, rival
  const OUTFITS = {
    player: { robe:'#4a2e5e', robe2:'#5e3a76', skin:'#e8c9a8', hood:true,  trim:'#9b6dff' },
    witch:  { robe:'#2e4a2e', robe2:'#3a5c3a', skin:'#d8c9b8', hood:true,  trim:'#6dd86d', hair:'#c8c8d8' },
    shop:   { robe:'#5a4632', robe2:'#6d5640', skin:'#e8c9a8', hood:false, trim:'#e8c95d', hair:'#3a2c1c' },
    fisher: { robe:'#2e4a5e', robe2:'#3a5c76', skin:'#d8b890', hood:false, trim:'#5d8ae8', hair:'#8a8268' },
    master: { robe:'#5e2e2e', robe2:'#763a3a', skin:'#c9a886', hood:false, trim:'#e8825d', hair:'#17131f' },
    digger: { robe:'#46405a', robe2:'#56506a', skin:'#d8c9b8', hood:true,  trim:'#8a8268' },
    rival:  { robe:'#17131f', robe2:'#241e30', skin:'#cdc4b8', hood:true,  trim:'#e8442e' },
  };
  function actorCanvas(kind, dir, step){
    // dir: 0 down, 1 up, 2 left, 3 right
    const o = OUTFITS[kind] || OUTFITS.rival;
    const c = cv(16,16), x = c.getContext('2d');
    const flip = dir === 2;
    if (flip){ x.translate(16,0); x.scale(-1,1); }
    const side = dir === 2 || dir === 3;
    // legs/robe bottom
    x.fillStyle = o.robe;
    x.fillRect(4,8,8,6);
    x.fillRect(step ? 4 : 9, 14, 3, 1); x.fillRect(step ? 9 : 4, 14, 3, 2);
    x.fillStyle = o.robe2; x.fillRect(5,9,6,4);
    // torso trim
    x.fillStyle = o.trim; x.fillRect(4,8,8,1);
    // head
    if (dir === 1){ // back
      x.fillStyle = o.hood ? o.robe : (o.hair || '#3a2c1c');
      x.fillRect(4,1,8,7); x.fillStyle = o.hood ? o.robe2 : (o.hair||'#3a2c1c'); x.fillRect(5,2,6,5);
    } else {
      x.fillStyle = o.skin; x.fillRect(5,2,6,6);
      if (o.hood){ x.fillStyle = o.robe; x.fillRect(4,1,8,2); x.fillRect(4,1,1,7); x.fillRect(11,1,1,7); x.fillRect(5,3,1,1); x.fillRect(10,3,1,1); }
      else { x.fillStyle = o.hair || '#3a2c1c'; x.fillRect(4,1,8,2); x.fillRect(4,2,1,3); x.fillRect(11,2,1,3); }
      // eyes
      x.fillStyle = '#17131f';
      if (side){ x.fillRect(9,4,1,2); }
      else { x.fillRect(6,4,1,2); x.fillRect(9,4,1,2); }
    }
    return c;
  }
  const actorCache = {};
  function actor(kind, dir, step){
    const k = `${kind}_${dir}_${step?1:0}`;
    if (!actorCache[k]) actorCache[k] = actorCanvas(kind, dir, step);
    return actorCache[k];
  }

  function init(){ buildTiles(); buildFurniture(); buildCrops(); }
  function get(name){ return T[name]; }

  return { init, get, creature, actor, drawArt, cv };
})();

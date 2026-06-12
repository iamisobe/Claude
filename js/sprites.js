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
  // Scale2x (EPX): doubles resolution while smoothing staircase edges,
  // giving sprites real added definition without any blur
  function scale2x(src){
    const w = src.width, h = src.height;
    const out = cv(w*2, h*2);
    const sctx = src.getContext('2d'), octx = out.getContext('2d');
    const sd = sctx.getImageData(0, 0, w, h).data;
    const od = octx.createImageData(w*2, h*2);
    const px = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      const i = (y*w + x) * 4;
      return sd[i] << 24 | sd[i+1] << 16 | sd[i+2] << 8 | sd[i+3];
    };
    const set = (x, y, v) => {
      const i = (y*w*2 + x) * 4;
      od.data[i] = v >>> 24; od.data[i+1] = (v >> 16) & 255;
      od.data[i+2] = (v >> 8) & 255; od.data[i+3] = v & 255;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const P = px(x,y), A = px(x,y-1), B = px(x+1,y), C = px(x-1,y), D = px(x,y+1);
      let e1 = P, e2 = P, e3 = P, e4 = P;
      if (C === A && C !== D && A !== B) e1 = A;
      if (A === B && A !== C && B !== D) e2 = B;
      if (D === C && D !== B && C !== A) e3 = C;
      if (B === D && B !== A && D !== C) e4 = D;
      set(x*2, y*2, e1); set(x*2+1, y*2, e2);
      set(x*2, y*2+1, e3); set(x*2+1, y*2+1, e4);
    }
    octx.putImageData(od, 0, 0);
    return out;
  }
  // detail synthesis: contour outline, top-left rim light, under-shadow.
  // unlike pure upscaling this ADDS form information to the sprite.
  function detailPass(c){
    const w = c.width, h = c.height, ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y*w + x)*4 + 3];
    const out = ctx.createImageData(w, h);
    out.data.set(d);
    const o = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
      const i = (y*w + x) * 4;
      if (d[i+3] === 0){
        // contour: transparent pixel hugging the silhouette becomes outline
        if (alpha(x+1,y) || alpha(x-1,y) || alpha(x,y+1) || alpha(x,y-1)){
          o[i] = 12; o[i+1] = 9; o[i+2] = 18; o[i+3] = 255;
        }
      } else {
        const top = !alpha(x, y-1), left = !alpha(x-1, y), bot = !alpha(x, y+1);
        if (top || left){       // rim light from the upper-left
          o[i]   = Math.min(255, d[i]   * 1.45 + 18);
          o[i+1] = Math.min(255, d[i+1] * 1.45 + 18);
          o[i+2] = Math.min(255, d[i+2] * 1.45 + 18);
        } else if (bot){        // grounded shadow along the underside
          o[i] = d[i] * .62; o[i+1] = d[i+1] * .62; o[i+2] = d[i+2] * .62;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    return c;
  }
  function creature(key){
    const k = 'cr_'+key;
    if (!cache[k]){
      const s = DEX[key];
      cache[k] = detailPass(scale2x(drawArt(s.art, s.pal, !!s.sym)));
    }
    return cache[k];
  }


  // ============ COMBAT VFX FLIPBOOKS ============
  // pre-rendered frame sequences, like real games' effect sheets.
  // played by combat with additive blending for glow.
  const FXBOOK = {};
  function flip(n, size, draw){
    const arr = [];
    for (let f = 0; f < n; f++){
      const c = cv(size, size), g = c.getContext('2d');
      g.translate(size/2, size/2);
      draw(g, f / (n - 1), size);
      arr.push(c);
    }
    return arr;
  }
  function buildFX(){
    // slash: thick motion-streaked crescent (points right; rotated at play)
    FXBOOK.slash = flip(8, 96, (g, p) => {
      const a = 1 - p;
      g.rotate(-0.7 + p * 1.6);
      // hot core
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = 11 * a + 3;
      g.beginPath(); g.arc(0, 0, 32, -1.0, 1.0); g.stroke();
      // violet bloom
      g.strokeStyle = `rgba(190,150,255,${0.7 * a})`;
      g.lineWidth = 22 * a + 6;
      g.beginPath(); g.arc(0, 0, 32, -0.8, 0.8); g.stroke();
      // trailing streaks
      g.strokeStyle = `rgba(255,255,255,${0.5 * a})`;
      g.lineWidth = 2;
      for (const r of [22, 40]){
        g.beginPath(); g.arc(0, 0, r, -0.9 + p * 0.4, 0.9); g.stroke();
      }
      // tip spark
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath(); g.arc(Math.cos(0.95) * 32, Math.sin(0.95) * 32, 4 * a + 1, 0, 7); g.fill();
    });
    // impact: flash + radial spikes + ring
    FXBOOK.impact = flip(7, 56, (g, p) => {
      const a = 1 - p;
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath(); g.arc(0, 0, 7 * a + 1, 0, 7); g.fill();
      g.strokeStyle = `rgba(255,240,200,${a * 0.9})`;
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++){
        const ang = i * Math.PI / 3 + 0.3;
        const r0 = 4 + p * 16, r1 = r0 + 7 * a + 2;
        g.beginPath();
        g.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
        g.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        g.stroke();
      }
      g.strokeStyle = `rgba(255,255,255,${a * 0.6})`;
      g.beginPath(); g.arc(0, 0, p * 22 + 3, 0, 7); g.stroke();
    });
    // blast: violet plasma explosion
    FXBOOK.blast = flip(10, 96, (g, p) => {
      if (p < 0.18){ // opening frame: white concussion flash
        g.fillStyle = `rgba(255,255,255,${1 - p / 0.18})`;
        g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill();
      }
      { // double shockwave rings
        const a2 = 1 - p;
        g.strokeStyle = `rgba(255,255,255,${a2 * 0.7})`;
        g.lineWidth = 2.5;
        g.beginPath(); g.arc(0, 0, 8 + p * 40, 0, 7); g.stroke();
        g.strokeStyle = `rgba(205,180,255,${a2 * 0.5})`;
        g.beginPath(); g.arc(0, 0, 4 + p * 28, 0, 7); g.stroke();
      }
      return blastInner(g, p);
    });
    function blastInner(g, p){
      const a = 1 - p;
      const grd = g.createRadialGradient(0, 0, 1, 0, 0, 12 + p * 16);
      grd.addColorStop(0, `rgba(255,255,255,${a})`);
      grd.addColorStop(0.4, `rgba(155,109,255,${a * 0.9})`);
      grd.addColorStop(1, 'rgba(155,109,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, 12 + p * 16, 0, 7); g.fill();
      g.strokeStyle = `rgba(205,180,255,${a * 0.8})`;
      g.lineWidth = 3 * a + 1;
      g.beginPath(); g.arc(0, 0, p * 30 + 4, 0, 7); g.stroke();
      g.fillStyle = `rgba(106,79,154,${a * 0.5})`;
      for (let i = 0; i < 5; i++){
        const ang = i * 1.26 + p * 2;
        g.beginPath(); g.arc(Math.cos(ang) * p * 22, Math.sin(ang) * p * 22, 6 * a + 1, 0, 7); g.fill();
      }
    }
    // soulburst: death — expanding ring + wisps spiraling up
    FXBOOK.soulburst = flip(8, 72, (g, p) => {
      const a = 1 - p;
      g.strokeStyle = `rgba(138,216,232,${a * 0.9})`;
      g.lineWidth = 3 * a + 1;
      g.beginPath(); g.arc(0, 0, 6 + p * 26, 0, 7); g.stroke();
      g.fillStyle = `rgba(155,109,255,${a})`;
      for (let i = 0; i < 6; i++){
        const ang = i * 1.05 + p * 1.5;
        g.beginPath();
        g.arc(Math.cos(ang) * (8 + p * 14), Math.sin(ang) * (8 + p * 10) - p * 22, 3 * a + 1, 0, 7);
        g.fill();
      }
      if (p < 0.3){ g.fillStyle = `rgba(255,255,255,${1 - p / 0.3})`;
        g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); }
    });
    // sigil: cast circle under the player
    FXBOOK.circle = flip(8, 88, (g, p) => {
      const a = Math.sin(p * Math.PI);
      g.scale(1, 0.5); // floor perspective
      g.strokeStyle = `rgba(155,109,255,${a * 0.9})`;
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 0, 26 + p * 8, 0, 7); g.stroke();
      g.beginPath(); g.arc(0, 0, 18 + p * 5, 0, 7); g.stroke();
      g.fillStyle = `rgba(205,180,255,${a})`;
      for (let i = 0; i < 4; i++){
        const ang = i * Math.PI / 2 + p * 2.5;
        g.fillRect(Math.cos(ang) * (22 + p * 6) - 3, Math.sin(ang) * (22 + p * 6) - 3, 6, 6);
      }
    });
    // bone spikes erupting (Grave Grasp)
    FXBOOK.spikes = flip(7, 72, (g, p) => {
      const h = Math.sin(p * Math.PI);
      for (let i = 0; i < 5; i++){
        const x = (i - 2) * 13;
        const ht = (16 + (i % 2) * 8) * h;
        g.fillStyle = '#d8d0b8';
        g.beginPath();
        g.moveTo(x - 5, 22); g.lineTo(x, 22 - ht); g.lineTo(x + 5, 22);
        g.closePath(); g.fill();
        g.strokeStyle = '#8a8268'; g.lineWidth = 1; g.stroke();
      }
    });
    // bone shards flying out (shield break)
    FXBOOK.shards = flip(7, 64, (g, p) => {
      const a = 1 - p;
      g.fillStyle = `rgba(216,208,184,${a})`;
      for (let i = 0; i < 8; i++){
        const ang = i * 0.785 + 0.4;
        const r = 6 + p * 26;
        g.save();
        g.translate(Math.cos(ang) * r, Math.sin(ang) * r + p * p * 14);
        g.rotate(ang + p * 4);
        g.fillRect(-3, -1.5, 6, 3);
        g.restore();
      }
    });
    // heal motes rising
    FXBOOK.heal = flip(8, 56, (g, p) => {
      const a = Math.sin(p * Math.PI);
      g.fillStyle = `rgba(109,216,109,${a})`;
      for (let i = 0; i < 6; i++){
        const x = Math.sin(i * 2.2 + p * 5) * 14;
        g.beginPath(); g.arc(x, 16 - p * 34 + i * 3, 2.4, 0, 7); g.fill();
      }
    });
  }
  function fx(name){ return FXBOOK[name]; }

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
    tile('tree', x => { x.clearRect(0,0,16,16);
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
    // ---- zone terrains ----
    tile('marsh', x => { fill(x,'#2a3a30'); speck(x,'#36493c',12,20); speck(x,'#1e2c24',8,21);
      x.fillStyle='#24343c'; x.fillRect(2,11,4,2); x.fillRect(10,4,4,2); });
    tile('rockg', x => { fill(x,'#46424c'); speck(x,'#534e58',12,22); speck(x,'#3a3640',10,23); });
    tile('dgrass', x => { fill(x,'#22302a'); speck(x,'#2c3e34',12,24); speck(x,'#182420',8,25);
      x.fillStyle='#9b6dff'; x.fillRect(12,12,1,1); });
    tile('ashg', x => { fill(x,'#3c3434'); speck(x,'#4a403c',12,26); speck(x,'#2e2828',8,27);
      x.fillStyle='#e8825d'; x.fillRect(4,12,1,1); });
    tile('snow', x => { fill(x,'#aeb6c6'); speck(x,'#c2cad8',12,28); speck(x,'#969eb2',10,29); });
    // ---- harvest nodes ----
    tile('ntree', x => { x.clearRect(0,0,16,16);
      x.fillStyle='#241c10'; x.fillRect(6,8,4,8); x.fillStyle='#3a2c1c'; x.fillRect(7,8,2,8);
      x.fillStyle='#1f3324'; x.fillRect(2,1,12,8); x.fillStyle='#2a4530'; x.fillRect(3,2,10,6);
      x.fillStyle='#e8c95d'; x.fillRect(4,4,2,2); x.fillRect(10,3,2,2); });
    tile('nrock', x => { x.clearRect(0,0,16,16);
      x.fillStyle='#6a6a7a'; x.fillRect(2,5,12,9); x.fillRect(4,3,8,3);
      x.fillStyle='#8a8a9a'; x.fillRect(4,5,4,3); x.fillStyle='#52525e'; x.fillRect(9,8,4,4); });
    for (const [name, vein, glow] of [['nore_ironore','#b87a4a','#d89a6a'],
        ['nore_silverore','#cdd4e8','#f0f4ff'], ['nore_moonore','#9b6dff','#cdb4ff']]){
      tile(name, x => { x.clearRect(0,0,16,16);
        x.fillStyle='#56525e'; x.fillRect(2,4,12,10); x.fillRect(4,2,8,3);
        x.fillStyle=vein; x.fillRect(4,6,3,2); x.fillRect(9,9,3,2); x.fillRect(6,11,2,2);
        x.fillStyle=glow; x.fillRect(5,6,1,1); x.fillRect(10,9,1,1); });
    }
    tile('nwisp', x => { x.clearRect(0,0,16,16);
      x.fillStyle='#3a4a5a'; x.fillRect(4,6,8,8);
      x.fillStyle='#8af0e8'; x.fillRect(6,3,4,5); x.fillRect(7,1,2,2);
      x.fillStyle='#d0fff8'; x.fillRect(7,4,2,2); });
    tile('board', x => { fill(x,'#2e4a2e'); speck(x,'#3a5c3a',8,30);
      x.fillStyle='#5a4632'; x.fillRect(2,2,12,9); x.fillRect(4,11,2,4); x.fillRect(10,11,2,4);
      x.fillStyle='#3e3022'; x.fillRect(2,2,12,1);
      x.fillStyle='#e8e0d0'; x.fillRect(4,4,3,4); x.fillRect(9,4,3,5);
      x.fillStyle='#8a7fa8'; x.fillRect(5,5,1,1); x.fillRect(5,6,1,1); x.fillRect(10,5,1,1); x.fillRect(10,7,1,1); });
    tile('boxBroken', x => { fill(x,'#4a3a2e'); x.fillStyle='#3e3026'; x.fillRect(0,11,16,1);
      x.fillStyle='#3a2c20'; x.fillRect(2,5,12,9);
      x.fillStyle='#2a2014'; x.fillRect(3,6,4,3); x.fillRect(9,9,4,4);
      x.fillStyle='#5a4632'; x.fillRect(2,5,5,2); x.fillRect(11,5,3,6);
      x.fillStyle='#1c140c'; x.fillRect(7,4,2,10); });
    // the player's staff, horizontal — rotated for the swing animation
    tile('fx_staff', x => { x.clearRect(0,0,16,16);
      x.fillStyle='#8a5a3a'; x.fillRect(0,7,13,2);
      x.fillStyle='#6d4528'; x.fillRect(0,8,13,1);
      x.fillStyle='#9b6dff'; x.fillRect(13,6,3,4);
      x.fillStyle='#cdb4ff'; x.fillRect(14,7,1,2); });
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
  function actorCanvas(kind, dir, step, mode, eq){
    // 64×64 detailed body with VISIBLE EQUIPMENT (paperdoll layers)
    // mode: falsy | 'bare' | 'rod' | 'attack0' (windup) | 'attack1' (strike)
    //       | 'cast' (arms raised) | 'flinch' (hurt recoil)
    // eq: {helm,chest,pants,boots,gloves,cape,amulet,w1,w2} -> rarity|null
    eq = eq || {};
    const atk = mode === 'attack0' ? 1 : mode === 'attack1' ? 2 : 0;
    const cast = mode === 'cast';
    const flinch = mode === 'flinch';
    const bare = mode === 'bare' || !!atk;   // swung staff is drawn as the arc overlay
    const o = OUTFITS[kind] || OUTFITS.rival;
    const c = cv(64,64), x = c.getContext('2d');
    const flip = dir === 2;
    if (flip){ x.translate(64,0); x.scale(-1,1); }
    const side = dir === 2 || dir === 3;
    const up = dir === 1;
    const sw = step ? 3 : 0;
    const dark = '#17131f';
    const sh = (hex, f, add = 0) => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.min(255, ((n>>16)&255)*f + add | 0);
      const g2 = Math.min(255, ((n>>8)&255)*f + add | 0);
      const b = Math.min(255, (n&255)*f + add | 0);
      return `rgb(${r},${g2},${b})`;
    };
    const lite = h2 => sh(h2, 1.3, 14);
    const MET = '#6a7080', METD = '#4a4f5e', METL = '#9aa1b4';
    const rc = r => RARITIES[r].col;

    const bx = side ? 20 : 16, bw = side ? 24 : 32;

    // ===== CAPE (behind the body, except seen from behind) =====
    if (eq.cape != null && !up){
      const cc = sh(rc(eq.cape), .55), ccd = sh(rc(eq.cape), .35);
      if (side){ // trails behind (left of body when facing right)
        x.fillStyle = cc;  x.fillRect(bx-7, 28, 12, 26);
        x.fillStyle = ccd; x.fillRect(bx-7, 46, 5, 8); x.fillRect(bx-7, 28, 2, 26);
      } else {
        x.fillStyle = cc;  x.fillRect(bx-4, 28, bw+8, 27);
        x.fillStyle = ccd; x.fillRect(bx-4, 50, bw+8, 5);
      }
    }

    // ===== BODY =====
    x.fillStyle = sh(o.robe, .8);  x.fillRect(bx, 27, bw, 27);
    x.fillStyle = o.robe;          x.fillRect(bx+2, 27, bw-4, 25);
    x.fillStyle = o.robe2;         x.fillRect(bx+5, 29, bw-10, 21);
    x.fillStyle = lite(o.robe2);   x.fillRect(bx+5, 29, 2, 21);
    x.fillStyle = sh(o.robe, .55);
    x.fillRect(bx + (bw>>2), 40, 2, 12);
    x.fillRect(bx + bw - (bw>>2) - 2, 40, 2, 12);
    x.fillRect(bx, 52, bw, 2);
    x.fillStyle = o.trim;  x.fillRect(bx, 27, bw, 2);
    x.fillRect(bx+2, 36, bw-4, 4);
    x.fillStyle = sh(o.trim,.6); x.fillRect(bx + (bw>>1) - 3, 36, 6, 4);
    x.fillStyle = lite(o.trim);  x.fillRect(bx + (bw>>1) - 1, 37, 2, 2);

    // chest plate over the robe
    if (eq.chest != null){
      x.fillStyle = MET;  x.fillRect(bx+3, 28, bw-6, 12);
      x.fillStyle = METL; x.fillRect(bx+3, 28, bw-6, 2);
      x.fillStyle = METD; x.fillRect(bx + (bw>>1) - 1, 30, 2, 10);
      x.fillStyle = rc(eq.chest); x.fillRect(bx+3, 39, bw-6, 2);   // rarity band
      // pauldrons
      x.fillStyle = MET;  x.fillRect(bx-1, 26, 7, 5); x.fillRect(bx+bw-6, 26, 7, 5);
      x.fillStyle = rc(eq.chest); x.fillRect(bx-1, 26, 7, 1); x.fillRect(bx+bw-6, 26, 7, 1);
    }
    // greaves peeking under the hem
    if (eq.pants != null){
      x.fillStyle = METD; x.fillRect(bx+3, 50, bw-6, 4);
      x.fillStyle = rc(eq.pants); x.fillRect(bx+3, 50, bw-6, 1);
    }

    // ===== FEET / BOOTS =====
    const bootC = eq.boots != null ? MET : '#2a2014';
    const bootD = eq.boots != null ? METD : '#1a140c';
    x.fillStyle = bootC;
    x.fillRect(bx+4, 54, 9, 6 - sw);
    x.fillRect(bx+bw-13, 54, 9, 3 + sw);
    x.fillStyle = bootD;
    x.fillRect(bx+4, 59 - sw, 9, 2);
    x.fillRect(bx+bw-13, 56 + sw, 9, 2);
    if (eq.boots != null){
      x.fillStyle = rc(eq.boots);
      x.fillRect(bx+4, 54, 9, 1); x.fillRect(bx+bw-13, 54, 9, 1);
    }

    // ===== ARMS / GLOVES / WEAPONS =====
    const handC = eq.gloves != null ? MET : o.skin;
    if (side){
      x.fillStyle = sh(o.robe, .5); x.fillRect(bx+2, 30, 4, 13);
      if (atk === 1){            // WINDUP: arm cocked back high
        x.fillStyle = o.robe2;        x.fillRect(bx+bw-12, 24, 10, 7);
        x.fillStyle = sh(o.robe2,.7); x.fillRect(bx+bw-12, 29, 10, 2);
        x.fillStyle = handC;          x.fillRect(bx+bw-4, 22, 5, 5);
      } else if (atk === 2){     // STRIKE: arm rammed fully forward
        x.fillStyle = o.robe2;        x.fillRect(bx+bw-6, 30, 16, 7);
        x.fillStyle = sh(o.robe2,.7); x.fillRect(bx+bw-6, 35, 16, 2);
        x.fillStyle = eq.gloves != null ? rc(eq.gloves) : o.trim;
        x.fillRect(bx+bw+7, 30, 3, 7);
        x.fillStyle = handC;          x.fillRect(bx+bw+10, 31, 5, 5);
      } else if (cast){          // CAST: arm thrust skyward
        x.fillStyle = o.robe2;        x.fillRect(bx+bw-6, 14, 7, 16);
        x.fillStyle = handC;          x.fillRect(bx+bw-5, 9, 5, 5);
      } else {
        x.fillStyle = o.robe2;        x.fillRect(bx+bw-8, 30 + sw, 12, 7);
        x.fillStyle = sh(o.robe2,.7); x.fillRect(bx+bw-8, 35 + sw, 12, 2);
        x.fillStyle = eq.gloves != null ? rc(eq.gloves) : o.trim;
        x.fillRect(bx+bw+1, 30 + sw, 3, 7);
        x.fillStyle = handC; x.fillRect(bx+bw+4, 31 + sw, 4, 5);
      }
      if (kind === 'player' && !bare){
        const stx = bx + bw + 6;
        x.fillStyle = '#6d4528';    x.fillRect(stx, 10, 4, 48);
        x.fillStyle = '#8a5a3a';    x.fillRect(stx, 10, 2, 48);
        x.fillStyle = '#4a2f1c';    x.fillRect(stx, 30 + sw, 4, 8);
        const gem = eq.w1 != null ? rc(eq.w1) : o.trim;
        x.fillStyle = gem;          x.fillRect(stx-2, 3, 8, 8);
        x.fillStyle = lite(gem);    x.fillRect(stx-1, 4, 3, 3);
        x.fillStyle = '#cdb4ff';    x.fillRect(stx, 5, 2, 2);
        x.fillStyle = handC;        x.fillRect(stx-1, 31 + sw, 6, 5);
        if (eq.w2 != null){ // offhand hilt over the shoulder
          x.fillStyle = '#6d4528'; x.fillRect(bx-2, 22, 3, 10);
          x.fillStyle = rc(eq.w2); x.fillRect(bx-3, 19, 5, 4);
        }
      }
    } else {
      x.fillStyle = o.robe2;
      x.fillRect(8, 29 + sw, 8, 16);
      x.fillRect(48, 32 - sw, 8, 16);
      x.fillStyle = lite(o.robe2);
      x.fillRect(8, 29 + sw, 2, 16); x.fillRect(48, 32 - sw, 2, 16);
      x.fillStyle = eq.gloves != null ? rc(eq.gloves) : o.trim;
      x.fillRect(8, 43 + sw, 8, 3); x.fillRect(48, 46 - sw, 8, 3);
      x.fillStyle = handC;
      x.fillRect(9, 46 + sw, 6, 5); x.fillRect(49, 49 - sw, 6, 5);
      x.fillStyle = sh(handC.startsWith('#') ? handC : MET, .8);
      x.fillRect(9, 49 + sw, 6, 2); x.fillRect(49, 52 - sw, 6, 2);
      if (kind === 'player' && !bare){
        const stx = up ? 6 : 54;
        x.fillStyle = '#6d4528';     x.fillRect(stx, 14, 4, 44);
        x.fillStyle = '#8a5a3a';     x.fillRect(stx, 14, 2, 44);
        x.fillStyle = '#4a2f1c';     x.fillRect(stx, 44, 4, 8);
        const gem = eq.w1 != null ? rc(eq.w1) : o.trim;
        x.fillStyle = gem;           x.fillRect(stx-2, 6, 8, 9);
        x.fillStyle = lite(gem);     x.fillRect(stx-1, 7, 3, 4);
        x.fillStyle = '#cdb4ff';     x.fillRect(stx, 8, 2, 3);
        if (eq.w2 != null){ // second weapon on the other side
          const stx2 = up ? 54 : 6;
          x.fillStyle = '#6d4528';   x.fillRect(stx2, 18, 3, 36);
          x.fillStyle = rc(eq.w2);   x.fillRect(stx2-2, 11, 7, 8);
          x.fillStyle = lite(rc(eq.w2)); x.fillRect(stx2-1, 12, 3, 3);
        }
      }
    }

    // cape over the back when seen from behind
    if (eq.cape != null && up){
      const cc = sh(rc(eq.cape), .6);
      x.fillStyle = cc; x.fillRect(bx+2, 28, bw-4, 26);
      x.fillStyle = sh(rc(eq.cape), .4);
      x.fillRect(bx+6, 32, 2, 20); x.fillRect(bx+bw-8, 32, 2, 20);
      x.fillRect(bx+2, 51, bw-4, 3);
      x.fillStyle = rc(eq.cape); x.fillRect(bx+2, 28, bw-4, 2); // clasp band
    }

    // ===== HEAD =====
    if (up){
      x.fillStyle = o.hood ? o.robe : (o.hair || '#3a2c1c');
      x.fillRect(18, 6, 28, 22);
      x.fillStyle = o.hood ? o.robe2 : sh(o.hair || '#3a2c1c', .8);
      x.fillRect(22, 10, 20, 16);
      x.fillStyle = sh(o.robe, .6);
      if (o.hood) x.fillRect(30, 6, 4, 22);
      x.fillStyle = lite(o.hood ? o.robe : (o.hair || '#3a2c1c'));
      x.fillRect(18, 6, 28, 2);
    } else {
      x.fillStyle = o.skin;          x.fillRect(20, 9, 24, 19);
      x.fillStyle = sh(o.skin, .85); x.fillRect(20, 23, 24, 5);
      x.fillStyle = lite(o.skin);    x.fillRect(22, 10, 20, 2);
      if (o.hood){
        x.fillStyle = o.robe;
        x.fillRect(16, 4, 32, 4);
        x.fillRect(16, 4, 5, 26); x.fillRect(43, 4, 5, 26);
        x.fillStyle = lite(o.robe); x.fillRect(17, 4, 30, 2);
        x.fillStyle = o.robe2;      x.fillRect(20, 9, 24, 2);
        x.fillStyle = sh(o.robe, .55);
        x.fillRect(21, 11, 4, 3); x.fillRect(39, 11, 4, 3);
      } else {
        const hr = o.hair || '#3a2c1c';
        x.fillStyle = hr;
        x.fillRect(16, 4, 32, 8); x.fillRect(16, 9, 5, 13); x.fillRect(43, 9, 5, 13);
        x.fillStyle = lite(hr);    x.fillRect(17, 4, 30, 2);
        x.fillStyle = sh(hr, .7);  x.fillRect(16, 10, 32, 2);
      }
      if (flinch){
        x.fillStyle = dark;   // eyes screwed shut, teeth gritted
        if (side){ x.fillRect(36, 17, 6, 2); }
        else { x.fillRect(23, 17, 6, 2); x.fillRect(35, 17, 6, 2); }
        x.fillStyle = '#f4f0e4'; x.fillRect(side ? 34 : 27, 24, side ? 7 : 10, 3);
        x.fillStyle = dark; x.fillRect(side ? 36 : 29, 24, 1, 3); x.fillRect(side ? 39 : 33, 24, 1, 3);
      } else if (side){
        x.fillStyle = '#f4f0e4'; x.fillRect(36, 15, 5, 5);
        x.fillStyle = dark;      x.fillRect(38, 16, 3, 4);
        x.fillStyle = sh(o.skin, .8); x.fillRect(43, 20, 2, 3);
        x.fillStyle = sh(o.skin, .6); x.fillRect(34, 25, 7, 2);
      } else {
        x.fillStyle = '#f4f0e4';
        x.fillRect(23, 15, 6, 5); x.fillRect(35, 15, 6, 5);
        x.fillStyle = dark;
        x.fillRect(25, 16, 3, 4); x.fillRect(37, 16, 3, 4);
        x.fillStyle = sh(o.skin, .8); x.fillRect(31, 19, 2, 4);
        x.fillStyle = sh(o.skin, .6); x.fillRect(28, 25, 8, 2);
      }
    }

    // ===== HELM (over hood/hair) =====
    if (eq.helm != null){
      x.fillStyle = MET;
      x.fillRect(16, 2, 32, 7);                      // dome
      x.fillRect(15, 7, 4, 12); x.fillRect(45, 7, 4, 12); // cheek guards
      x.fillStyle = METL; x.fillRect(17, 2, 30, 2);
      x.fillStyle = METD; x.fillRect(16, 7, 32, 2);
      x.fillStyle = rc(eq.helm); x.fillRect(28, 0, 8, 3); // crest
      if (!up && !side){ x.fillStyle = METD; x.fillRect(30, 9, 4, 6); } // nose guard
    }

    // amulet pendant at the collar
    if (eq.amulet != null && !up && !side){
      x.fillStyle = '#8a8268'; x.fillRect(30, 28, 4, 1);
      x.fillStyle = rc(eq.amulet); x.fillRect(30, 29, 4, 4);
      x.fillStyle = lite(rc(eq.amulet)); x.fillRect(31, 30, 1, 1);
    }

    // ===== FISHING ROD (weapons stowed) =====
    if (mode === 'rod' && kind === 'player'){
      x.fillStyle = '#8a5a3a';
      if (side){
        // rod angles up and out over the water
        for (let i = 0; i < 7; i++) x.fillRect(46 + i*2, 30 - i*3, 3, 3);
        x.fillStyle = '#6d4528'; x.fillRect(46, 28, 3, 6);   // grip
        x.fillStyle = '#d8d0b8'; x.fillRect(47, 33, 3, 3);   // reel
        x.fillStyle = o.skin;    x.fillRect(45, 30, 4, 4);   // hand on grip
      } else if (up){
        for (let i = 0; i < 6; i++) x.fillRect(10 - i, 26 - i*3, 3, 4);
        x.fillStyle = '#d8d0b8'; x.fillRect(10, 28, 3, 3);
        x.fillStyle = o.skin;    x.fillRect(8, 25, 4, 4);
      } else {
        // facing the viewer: rod juts down-right toward the water
        for (let i = 0; i < 6; i++) x.fillRect(50 + i*2, 44 + i*3, 3, 3);
        x.fillStyle = '#6d4528'; x.fillRect(49, 42, 3, 6);
        x.fillStyle = '#d8d0b8'; x.fillRect(52, 47, 3, 3);
        x.fillStyle = o.skin;    x.fillRect(48, 45, 4, 4);
      }
    }
    return c;
  }

  const actorCache = {};
  function playerEq(){
    if (typeof G === 'undefined' || !G.gear || !G.gear.equip) return null;
    const e = G.gear.equip;
    const r = g => g ? g.rar : null;
    return { helm:r(e.helm), chest:r(e.chest), pants:r(e.pants), boots:r(e.boots),
      gloves:r(e.gloves), cape:r(e.cape), amulet:r(e.amulet),
      w1:r(e.weapon1), w2:r(e.weapon2) };
  }
  function actor(kind, dir, step, mode){
    const eq = kind === 'player' ? playerEq() : null;
    const sig = eq ? Object.values(eq).map(v => v == null ? '-' : v).join('') : '';
    const k = `${kind}_${dir}_${step?1:0}_${mode||0}_${sig}`;
    if (!actorCache[k]) actorCache[k] = actorCanvas(kind, dir, step, mode, eq);
    return actorCache[k];
  }

  // --- gear icons (slot glyph tinted by rarity) ---
  function gearIcon(slot, rar){
    const k = `gi_${slot}_${rar}`;
    if (cache[k]) return cache[k];
    const c = cv(16,16), x = c.getContext('2d');
    const col = RARITIES[rar].col;
    switch (slot){
      case 'weapon': case 'staff':
        x.strokeStyle = '#8a5a3a'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(4,13); x.lineTo(11,4); x.stroke();
        x.fillStyle = col; x.fillRect(10,2,4,4);
        x.fillStyle = '#fff8'; x.fillRect(11,3,1,1);
        break;
      case 'helm':
        x.fillStyle = '#3a3050'; x.fillRect(3,5,10,7);
        x.fillStyle = col; x.fillRect(3,4,10,3);
        x.fillStyle = '#17131f'; x.fillRect(5,9,6,2);
        x.fillStyle = '#3a3050'; x.fillRect(7,2,2,3);
        break;
      case 'chest': case 'robe':
        x.fillStyle = '#3a3050'; x.fillRect(4,3,8,11);
        x.fillRect(2,4,3,5); x.fillRect(11,4,3,5);
        x.fillStyle = col; x.fillRect(4,3,8,2); x.fillRect(7,5,2,8);
        break;
      case 'cape':
        x.fillStyle = '#3a3050'; x.fillRect(4,2,8,2);
        x.fillStyle = col;
        x.fillRect(3,4,10,7);
        x.fillRect(3,11,3,3); x.fillRect(7,11,3,2); x.fillRect(11,11,2,3);
        x.fillStyle = '#fff4'; x.fillRect(5,5,1,5);
        break;
      case 'pants':
        x.fillStyle = '#3a3050'; x.fillRect(4,3,8,4);
        x.fillRect(4,7,3,7); x.fillRect(9,7,3,7);
        x.fillStyle = col; x.fillRect(4,3,8,2);
        break;
      case 'boots':
        x.fillStyle = '#3a3050'; x.fillRect(5,3,4,8);
        x.fillRect(5,11,7,3);
        x.fillStyle = col; x.fillRect(5,3,4,2); x.fillRect(9,12,3,2);
        break;
      case 'gloves':
        x.fillStyle = '#3a3050'; x.fillRect(5,4,6,8);
        x.fillRect(3,7,3,4);
        x.fillStyle = col; x.fillRect(5,11,6,3);
        break;
      case 'ring':
        x.strokeStyle = col; x.lineWidth = 2;
        x.beginPath(); x.arc(8,9,4,0,7); x.stroke();
        x.fillStyle = col; x.fillRect(6,2,4,4);
        x.fillStyle = '#fff8'; x.fillRect(7,3,1,1);
        break;
      default: // amulet / charm
        x.strokeStyle = '#8a8268'; x.lineWidth = 1;
        x.beginPath(); x.arc(8,6,4,Math.PI,0); x.stroke();
        x.fillStyle = col; x.beginPath(); x.arc(8,10,4,0,7); x.fill();
        x.fillStyle = '#fff8'; x.fillRect(7,9,1,1);
    }
    cache[k] = c;
    return c;
  }

  function init(){ buildTiles(); buildFurniture(); buildCrops(); buildFX(); }
  function get(name){ return T[name]; }

  return { init, get, creature, actor, drawArt, cv, gearIcon, fx };
})();

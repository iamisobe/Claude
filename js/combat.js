// ============================================================
// GRIMVALE — combat: real-time ARPG. You fight with staff and
// hex bolts; your bound grims fight beside you as minions; wild
// grims roam the maps as enemies. Weaken + jar = capture.
// ============================================================
'use strict';

const Combat = (() => {
  let ents = [];      // enemies, projectiles, drops, floaters, fx
  let minions = [];   // live minion bodies (built from G.party)
  let dying = false;

  // ---------- player derived stats ----------
  function pstats(){
    const nl = Systems.skillLvl('necromancy');
    const fr = (G.pc && G.pc.frenzy > 0) ? 1.3 : 1;       // Reaper's Momentum
    return {
      maxhp:   Math.floor(50 + nl*6 + gearAffix('hp') + 20*treeRank('hpMax')),
      maxsoul: Math.floor(25 + nl*2 + gearAffix('soul') + 15*treeRank('soulMax')),
      melee:   (7 + nl*1.6) * (1 + gearAffix('dmg')/100) * (1 + 0.12*treeRank('melD')) * fr,
      bolt:    (10 + nl*2.2) * (1 + gearAffix('bolt')/100) * (1 + 0.12*treeRank('boltD')),
      speed:   165 * (1 + gearAffix('speed')/100) * (fr > 1 ? 1.25 : 1) * (G.pc && G.pc.vigor > 0 ? 1.3 : 1),
      regen:   (2.2 + nl*0.08) * (1 + gearAffix('regen')/100) * (1 + 0.2*treeRank('wind')) * (G.pc && G.pc.vigor > 0 ? 2 : 1),
    };
  }
  function minionCap(){ return Math.min(11, 3 + Math.floor(Systems.skillLvl('necromancy') / 5) + treeRank('packcap')); }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---------- spawning ----------
  function enemyFor(sp, lvl, opts = {}){
    const a = ARCH_STATS[ARCH[sp]];
    const boss = !!opts.boss;
    const maxhp = Math.floor((14 + 7*lvl) * a.hp * (boss ? 6 : 1));
    return {
      k:'e', sp, lvl, boss, x:opts.x, y:opts.y,
      hp:maxhp, maxhp,
      dmg:(3 + 1.4*lvl) * a.dmg * (boss ? 1.6 : 1),
      spd:a.spd * (boss ? 0.8 : 1), arch:ARCH[sp],
      cd:1 + Math.random(), t:0, wx:opts.x, wy:opts.y, sx:opts.x, sy:opts.y,
      aggro:!!opts.aggro, hooked:!!opts.hooked, riv:opts.riv || null,
      hurtT:0, burstCd:4,
    };
  }
  function spawnEnemy(sp, lvl, opts){ const e = enemyFor(sp, lvl, opts); ents.push(e); G.dex[sp] = Math.max(G.dex[sp] || 0, 1); return e; }

  function freeSpot(minD = 6){
    for (let i = 0; i < 80; i++){
      const x = 1 + rnd(World.mapW - 2), y = 1 + rnd(World.mapH - 2);
      if (World.solidTile(x, y)) continue;
      const px = x*TILE + TILE/2, py = y*TILE + TILE/2;
      if (Math.hypot(px - World.ppx, py - World.ppy) < minD*TILE) continue;
      return { x:px, y:py };
    }
    return null;
  }

  function zoneLevel(zone){
    if (ZONES[zone]) return Math.round((ZONES[zone].lvl[0] + ZONES[zone].lvl[1]) / 2);
    if (zone === 'cata') return 1 + World.cataFloor * 2;
    return 3;
  }

  function spawnZone(zone){
    if (ZONES[zone]){
      // fixed difficulty band — the ZONE is dangerous, not the math
      const Z = ZONES[zone];
      const n = Z.count + (zone === 'woods' ? plotTier('hide') * 2 : 0);
      const tbl = Z.enemies.filter(e => !e.night || UI.isNight());
      for (let i = 0; i < n; i++){
        const s = freeSpot(); if (!s) continue;
        const e = pickW(tbl);
        spawnEnemy(e.sp, Z.lvl[0] + rnd(Z.lvl[1] - Z.lvl[0] + 1), s);
      }
    } else if (zone === 'cata'){
      const lvl = zoneLevel('cata');
      // sparser floors that thicken with depth; nothing spawns near the stairs
      for (let i = 0; i < 7 + Math.min(12, World.cataFloor); i++){
        const s = freeSpot(7); if (!s) continue;
        const e = pickW(ENCOUNTERS.cata);
        spawnEnemy(e.sp, Math.max(2, lvl - 2 + rnd(4)), s);
      }
      if (World.cata.boss && !World.cata.bossDown){
        const [bx, by] = World.cata.boss;
        const idx = Math.min(4, Math.floor(World.cataFloor / 5) - 1);
        const BOSSES = ['gravehound','mycolossus','nocturnyx','cryptlord','hollowking'];
        const sp = World.cataFloor % 25 === 0 ? 'hollowking' : BOSSES[((idx % 5) + 5) % 5];
        const b = spawnEnemy(sp, lvl + 4, { x:bx*TILE+TILE/2, y:by*TILE+TILE/2, boss:true });
        b.guard = true;
      }
    }
  }

  function reset(zone){
    ents = [];
    if (zone) spawnZone(zone);
    syncMinions();
  }

  // ---------- minions ----------
  function syncMinions(){
    minions = [];
    G.party.forEach((g, i) => {
      if (g.hp > 0) minions.push({ k:'m', g, slot:i, cd:Math.random(),
        x: World.ppx + Math.cos(i)*40, y: World.ppy + Math.sin(i)*40 });
    });
  }
  function minionDmg(g){
    const st = statsFor(g.sp, g.lvl);
    const base = (Math.max(st.atk, st.spc) * 0.45 + g.lvl * 0.9);
    return base * (1 + gearAffix('minion')/100) * (1 + 0.10*treeRank('minD'))
      * (G.pc.packFrenzy > 0 ? 1 + G.pc.packFrenzyAmt : 1);
  }

  // ---------- helpers ----------
  let freeze = 0, shakeAmp = 0;   // hit-stop + camera shake
  function floater(x, y, txt, col){ ents.push({ k:'f', x, y, txt, col, ttl:0.9 }); }
  function poof(x, y, col){ ents.push({ k:'x', x, y, ttl:0.35, col }); }
  // flipbook VFX instance (rot in radians; additive unless soft)
  function playFX(name, x, y, opt = {}){
    ents.push({ k:'v', name, x, y, t:0, rot:opt.rot || 0,
      scale:opt.scale || 1, fps:opt.fps || 20, soft:!!opt.soft });
  }
  // spark/mote particles
  function particles(x, y, n, col, opt = {}){
    for (let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2;
      const sp = (opt.speed || 90) * (0.4 + Math.random() * 0.8);
      ents.push({ k:'pt', x, y, col, ttl: 0.5 + Math.random() * 0.4,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0),
        g: opt.gravity ?? 160, size: opt.size || 2.5 });
    }
  }
  function shoot(x, y, tx, ty, dmg, ally, col, spd = 230){
    const d = Math.hypot(tx-x, ty-y) || 1;
    ents.push({ k:'p', x, y, vx:(tx-x)/d*spd, vy:(ty-y)/d*spd, dmg, ally, col, ttl:1.8 });
  }
  function enemies(){ return ents.filter(e => e.k === 'e'); }
  function nearestEnemy(x, y, r, pred){
    let best = null, bd = r;
    for (const e of enemies()){
      if (pred && !pred(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd){ bd = d; best = e; }
    }
    return best;
  }
  function allyTargets(){ // what enemies can hit
    const t = [{ kind:'player', x:World.ppx, y:World.ppy }];
    for (const m of minions) t.push({ kind:'minion', m, x:m.x, y:m.y });
    return t;
  }
  function moveEnt(e, dx, dy, dt){
    const nx = e.x + dx * dt, ny = e.y + dy * dt;
    // an entity somehow inside solid ground (e.g. dragged into water) may always
    // move — it can escape, never gets wedged
    const stuck = World.solidPx(e.x, e.y);
    if (stuck || !World.solidPx(nx, e.y)) e.x = nx;
    if (stuck || !World.solidPx(e.x, ny)) e.y = ny;
  }
  // steer toward a point with wall-slide: when blocked, sidestep along the
  // wall for a moment instead of grinding into it (fixes corner pile-ups)
  function seek(e, tx, ty, spd, dt){
    const d = Math.hypot(tx - e.x, ty - e.y) || 1;
    let vx = (tx - e.x) / d, vy = (ty - e.y) / d;
    if (e.unstick > 0){
      e.unstick -= dt;
      const s = e.uside || 1;
      const pvx = -vy * s, pvy = vx * s;
      vx = (vx + pvx * 2) / 3; vy = (vy + pvy * 2) / 3;
    }
    const ox = e.x, oy = e.y;
    moveEnt(e, vx * spd, vy * spd, dt);
    if (Math.hypot(e.x - ox, e.y - oy) < spd * dt * 0.3){
      e.unstick = 0.45;
      e.uside = Math.random() < 0.5 ? 1 : -1;
    }
    if (Math.abs(vx) > 0.2) e.face = vx >= 0 ? 1 : -1;
  }

  // ---------- damage ----------
  function hurtEnemy(e, dmg, attType, srcXY){
    const tm = attType ? typeMult(attType, DEX[e.sp].ty) : 1;
    const final = Math.max(1, Math.round(dmg * tm * (0.9 + Math.random()*0.2)));
    e.hp -= final; e.aggro = true; e.hurtT = 0.15;
    particles(e.x, e.y - 8, 3, TYPES[DEX[e.sp].ty[0]].col, { speed: 80 });
    floater(e.x, e.y - 24, String(final), tm > 1 ? '#e8c95d' : tm < 1 ? '#8a7fa8' : '#e8e0d0');
    if (srcXY){ const d = Math.hypot(e.x-srcXY.x, e.y-srcXY.y) || 1;
      moveEnt(e, (e.x-srcXY.x)/d * 1400, (e.y-srcXY.y)/d * 1400, 0.016); }
    if (e.hp <= 0) killEnemy(e);
    return final;
  }
  function hurtPlayer(dmg){
    if (G.pc.inv > 0 || dying) return;
    // Bone Armor absorbs first
    if (G.pc.shield > 0){
      const ab = Math.min(G.pc.shield, dmg);
      G.pc.shield -= ab;
      dmg -= ab;
      floater(World.ppx, World.ppy - 28, `(${Math.round(ab)})`, '#8ad8e8');
      if (G.pc.shield <= 0) playFX('shards', World.ppx, World.ppy - 8, { soft: true, fps: 22 });
      if (dmg <= 0){ G.pc.inv = 0.4; return; }
    }
    G.pc.hp -= Math.max(1, Math.round(dmg));
    G.pc.inv = 0.7;
    shakeAmp = Math.max(shakeAmp, 0.25);
    particles(World.ppx, World.ppy - 10, 5, '#e85d5d', { speed: 110 });
    floater(World.ppx, World.ppy - 28, String(Math.max(1, Math.round(dmg))), '#e85d5d');
    if (G.pc.hp <= 0){ dying = true; G.pc.hp = 0; Systems.afterLoss().then(() => dying = false); }
  }
  function hurtMinion(m, dmg){
    dmg *= 1 - 0.07 * treeRank('minT');   // Grave Ward
    m.g.hp -= Math.max(1, Math.round(dmg));
    floater(m.x, m.y - 24, String(Math.max(1, Math.round(dmg))), '#e8825d');
    if (m.g.hp <= 0){
      if (m.g.temp){
        poof(m.x, m.y, '#d8d0b8');
        minions = minions.filter(x => x !== m);
        return;
      }
      m.g.hp = 0; m.g.downT = treeRank('legion') ? 7.5 : 15;
      poof(m.x, m.y, '#9b6dff');
      UI.toast(`${m.g.nick} was knocked down!`);
      minions = minions.filter(x => x !== m);
    }
  }

  function killEnemy(e){
    ents = ents.filter(x => x !== e);
    playFX('soulburst', e.x, e.y - 8, { scale: e.boss ? 1.8 : 1, fps: 18 });
    particles(e.x, e.y - 10, 10, '#9b6dff', { speed: 60, up: 70, gravity: -40, size: 3 });
    if (e.boss) shakeAmp = 0.5;
    G.kills = (G.kills || 0) + 1;
    // talents: Soul Harvest + Reaper's Momentum
    const hv = treeRank('harvest');
    if (hv) G.pc.hp = Math.min(pstats().maxhp, G.pc.hp + 2*hv);
    if (treeRank('reaper')) G.pc.frenzy = 4;
    // xp
    const baseXp = Math.floor(DEX[e.sp].xp * e.lvl / 12) + 2;
    let mult = 1 + gearAffix('xp')/100 + (G.manor.restored.study ? 0.15 : 0);
    if (World.map === 'woods') mult += 0.10 * plotTier('cabin');
    for (const m of minions) grantXp(m.g, Math.floor(baseXp * mult));
    Systems.skillAdd('necromancy', 3 + e.lvl + (e.boss ? e.lvl * 2 : 0));
    if (e.boss) onBossDown(e);
    if (e.riv) onRivalDown(e);
    dropLoot(e);
  }

  function grantXp(g, xp){
    g.xp += xp;
    while (g.xp >= xpForLevel(g.lvl + 1)){
      const oldMax = statsFor(g.sp, g.lvl).maxhp;
      g.lvl++;
      g.hp = Math.min(statsFor(g.sp, g.lvl).maxhp, g.hp + statsFor(g.sp, g.lvl).maxhp - oldMax);
      UI.toast(`${g.nick} grew to Lv.${g.lvl}!`);
      const ev = DEX[g.sp].ev;
      if (ev && g.lvl >= ev.lvl){
        const pct = Math.max(0.3, g.hp / statsFor(g.sp, g.lvl).maxhp);
        const renamed = g.nick !== DEX[g.sp].n;
        g.sp = ev.to;
        if (!renamed) g.nick = DEX[ev.to].n;
        g.hp = Math.floor(statsFor(g.sp, g.lvl).maxhp * pct);
        G.dex[g.sp] = 2;
        UI.toast(`★ ${g.nick === DEX[ev.to].n ? 'It' : g.nick} evolved into ${DEX[ev.to].n}!`);
      }
    }
  }

  function dropLoot(e){
    const goldMult = 1 + gearAffix('gold')/100 + 0.08 * plotTier('frostlodge');
    const gold = Math.round((4 + e.lvl * 2.2) * (e.boss ? 8 : 1) * goldMult * (0.7 + Math.random()*0.6));
    ents.push({ k:'d', x:e.x + rnd(20)-10, y:e.y + rnd(20)-10, gold, ttl:45 });
    if (e.boss || Math.random() < 0.07)
      ents.push({ k:'d', x:e.x + rnd(28)-14, y:e.y, gear: rollGear(e.lvl), ttl:60 });
    if (Math.random() < 0.10){
      const tbl = ['tonic','jar','plank','stone','worm','bloodberry', e.lvl >= 8 ? 'ecto' : 'plank', e.lvl >= 12 ? 'gjar' : 'jar'];
      ents.push({ k:'d', x:e.x, y:e.y + rnd(20)-10, item: tbl[rnd(tbl.length)], n:1, ttl:60 });
    }
  }

  function onBossDown(e){
    if (World.map === 'cata' && World.cata){
      World.cata.bossDown = true;
      const gold = 150 + World.cataFloor * 30;
      G.gold += gold;
      Systems.skillAdd('delving', 40 + World.cataFloor * 3);
      UI.toast(`Guardian slain! +${gold}⛁ — the stairs lie open.`);
      if (e.sp === 'hollowking' && !G.flags.kingFallen){
        G.flags.kingFallen = true;
        UI.say(['The Hollow King\'s crown rolls to your feet, then crumbles to dust.',
          '★ Floor 25 is conquered — but the catacombs are ENDLESS. They go deeper. They always go deeper...']);
      }
      Systems.save();
    }
  }
  function onRivalDown(e){
    // remove the rival's surviving pack
    ents = ents.filter(x => !(x.k === 'e' && x.riv === e.riv));
    Systems.rivalDefeated(e.riv);
  }

  // ---------- player actions ----------
  function playerAttack(){
    if (G.pc.atkCd > 0) return false;
    const ps = pstats();
    G.pc.atkCd = 0.38;
    G.pc.swing = 0.18;
    const [fx, fy] = World.faceVec();
    playFX('slash', World.ppx + fx*34, World.ppy - 6 + fy*34, { rot: Math.atan2(fy, fx), fps: 26 });
    const reach = 1 + 0.2 * treeRank('sweep');   // Wide Sweep
    let hit = 0;
    for (const e of enemies()){
      const dx = e.x - World.ppx, dy = e.y - World.ppy;
      const d = Math.hypot(dx, dy);
      if (d > (e.boss ? 78 : 58) * reach) continue;
      const dot = (dx*fx + dy*fy) / (d || 1);
      if (dot < 0.25 && d > 26) continue;
      hurtEnemy(e, ps.melee, null, { x:World.ppx, y:World.ppy });
      playFX('impact', e.x, e.y - 10, { fps: 24, scale: e.boss ? 1.5 : 1 });
      particles(e.x, e.y - 8, 5, '#ffe9b0', { speed: 130 });
      hit++;
    }
    if (hit){ freeze = 0.045; }   // hit-stop: impacts feel heavy
    return hit > 0;
  }
  function playerBolt(){
    if (G.pc.boltCd > 0) return;
    const cost = Math.max(3, 6 - treeRank('boltC'));   // Frugal Magic
    if (G.pc.soul < cost){ UI.toast('Not enough Soul.'); return; }
    const ps = pstats();
    G.pc.soul -= cost;
    G.pc.boltCd = 0.55;
    G.pc.cast = 0.18;
    const t = nearestEnemy(World.ppx, World.ppy, 430);
    let tx, ty;
    if (t){ tx = t.x; ty = t.y; }
    else { const [fx, fy] = World.faceVec(); tx = World.ppx + fx*200; ty = World.ppy + fy*200; }
    shoot(World.ppx, World.ppy - 8, tx, ty, ps.bolt, true, '#9b6dff', 300);
    // Echoing Hex: a second bolt leaps to another foe
    if (Math.random() < 0.15 * treeRank('echo')){
      const t2 = nearestEnemy(World.ppx, World.ppy, 430, e => e !== t);
      if (t2) setTimeout(() => shoot(World.ppx, World.ppy - 8, t2.x, t2.y, ps.bolt, true, '#cdb4ff', 300), 120);
    }
  }

  function bestJarFor(e){
    const tiers = ['jar','gjar','ajar'].filter(id => Inv.count(id) > 0);
    if (!tiers.length) return null;
    for (const id of tiers) if (catchChance(e, id) >= 0.5) return id;
    return tiers[tiers.length - 1];
  }
  function catchChance(e, jarId){
    const houseB = 0.05 * plotTier('moontower');
    const skillB = 1 + 0.015 * (Systems.skillLvl('necromancy') - 1) + gearAffix('capture')/100 + houseB;
    let c = ((3*e.maxhp - 2*e.hp) / (3*e.maxhp)) * (DEX[e.sp].catch / 255) * ITEMS[jarId].mult * skillB;
    return Math.min(0.95, c);
  }
  function throwJar(){
    const e = nearestEnemy(World.ppx, World.ppy, 230, x => !x.riv && x.hp / x.maxhp <= 0.35);
    if (!e){
      const any = nearestEnemy(World.ppx, World.ppy, 230, x => !x.riv);
      UI.toast(any ? 'Weaken it below 35% first! (jar icon appears)' : 'No weakened grim in range.');
      return;
    }
    const jarId = bestJarFor(e);
    if (!jarId){ UI.toast('You have no soul jars!'); return; }
    Inv.take(jarId, 1);
    const c = catchChance(e, jarId);
    floater(e.x, e.y - 34, ITEMS[jarId].n + '!', '#8ad8e8');
    if (Math.random() < c){
      ents = ents.filter(x => x !== e);
      poof(e.x, e.y, '#8ad8e8');
      const g = makeGrim(e.sp, e.lvl);
      g.hp = Math.floor(statsFor(e.sp, e.lvl).maxhp * 0.6);
      G.dex[e.sp] = 2;
      Systems.skillAdd('necromancy', 25 + e.lvl * 3);
      if (e.hooked) Systems.skillAdd('fishing', 15 + e.lvl);
      if (G.party.length < minionCap()){
        G.party.push(g);
        syncMinions();
        UI.toast(`★ BOUND ${g.nick} (Lv.${g.lvl}) — it rises to fight for you!`);
      } else {
        G.storage.push(g);
        UI.toast(`★ BOUND ${g.nick} (Lv.${g.lvl}) — sent to storage (pack is full).`);
      }
    } else {
      UI.toast(`${DEX[e.sp].n} broke free!`);
      e.aggro = true; e.rage = 2.5;
    }
  }

  // ---------- update ----------
  function update(dt){
    shakeAmp = Math.max(0, shakeAmp - dt * 1.6);
    if (freeze > 0){ freeze -= dt; return; }   // hit-stop: the world holds its breath
    const ps = pstats();
    G.pc.atkCd = Math.max(0, G.pc.atkCd - dt);
    G.pc.boltCd = Math.max(0, (G.pc.boltCd || 0) - dt);
    G.pc.inv = Math.max(0, (G.pc.inv || 0) - dt);
    G.pc.swing = Math.max(0, (G.pc.swing || 0) - dt);
    G.pc.cast = Math.max(0, (G.pc.cast || 0) - dt);
    G.pc.frenzy = Math.max(0, (G.pc.frenzy || 0) - dt);
    G.pc.packFrenzy = Math.max(0, (G.pc.packFrenzy || 0) - dt);
    G.pc.vigor = Math.max(0, (G.pc.vigor || 0) - dt);
    G.pc.shieldT = Math.max(0, (G.pc.shieldT || 0) - dt);
    if (G.pc.shieldT <= 0) G.pc.shield = 0;
    G.pc.cds = G.pc.cds || {};
    for (const k of Object.keys(G.pc.cds)) G.pc.cds[k] = Math.max(0, G.pc.cds[k] - dt);
    // temporary bone servants expire
    for (const m of minions.slice()){
      if (m.g && m.g.temp){
        m.g.ttl -= dt;
        if (m.g.ttl <= 0){ poof(m.x, m.y, '#d8d0b8'); minions = minions.filter(x => x !== m); }
      }
    }
    G.pc.soul = Math.min(ps.maxsoul, G.pc.soul + ps.regen * dt);

    // regen when no pursuer is close — escaping danger lets you breathe
    const anyAggro = enemies().some(e => e.aggro &&
      Math.hypot(e.x - World.ppx, e.y - World.ppy) < 450);
    if (!anyAggro){
      G.pc.hp = Math.min(ps.maxhp, G.pc.hp + ps.maxhp * 0.04 * dt);
      for (const m of minions){
        const mx = statsFor(m.g.sp, m.g.lvl).maxhp;
        m.g.hp = Math.min(mx, m.g.hp + mx * 0.05 * dt);
      }
    }
    // downed grims recover
    for (const g of G.party){
      if (g.hp <= 0 && g.downT !== undefined){
        g.downT -= dt;
        if (g.downT <= 0){
          delete g.downT;
          g.hp = Math.floor(statsFor(g.sp, g.lvl).maxhp * (treeRank('legion') ? 0.5 : 0.25));
          UI.toast(`${g.nick} staggers back up.`);
          syncMinions();
        }
      }
    }

    const targets = allyTargets();
    for (const e of ents.slice()){
      if (e.k === 'e') updateEnemy(e, dt, targets);
      else if (e.k === 'p') updateProj(e, dt);
      else if (e.k === 'd') updateDrop(e, dt);
      else if (e.k === 'f'){ e.ttl -= dt; e.y -= 26*dt; if (e.ttl <= 0) ents = ents.filter(x => x !== e); }
      else if (e.k === 'x'){ e.ttl -= dt; if (e.ttl <= 0) ents = ents.filter(x => x !== e); }
      else if (e.k === 'v'){ e.t += dt; const fr = SPR.fx(e.name);
        if (e.t * e.fps >= fr.length) ents = ents.filter(x => x !== e); }
      else if (e.k === 'pt'){ e.ttl -= dt; e.vy += e.g * dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.ttl <= 0) ents = ents.filter(x => x !== e); }
    }
    for (const m of minions) updateMinion(m, dt);
  }

  function updateEnemy(e, dt, targets){
    e.hurtT = Math.max(0, e.hurtT - dt);
    e.cd -= dt;
    e.t -= dt;
    if (e.rage) e.rage = Math.max(0, e.rage - dt);
    if (e.rooted > 0){ e.rooted -= dt; e.cd -= dt * 0; /* held fast */ }
    // target
    let tgt = null, td = 1e9;
    for (const t of targets){
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d < td){ td = d; tgt = t; }
    }
    if (!e.aggro){
      // the catacombs are dark: enemies notice you later there
      const aggroR = World.map === 'cata' ? 185 : 240;
      if (td < aggroR) e.aggro = true;
      else { // wander
        if (e.t <= 0){ e.t = 2 + Math.random()*2.5; e.wx = e.sx + rnd(120)-60; e.wy = e.sy + rnd(120)-60; }
        const d = Math.hypot(e.wx-e.x, e.wy-e.y);
        if (d > 8) moveEnt(e, (e.wx-e.x)/d * e.spd*0.4, (e.wy-e.y)/d * e.spd*0.4, dt);
        return;
      }
    } else if (td > 480 && !e.boss && !e.riv){
      // leash: lose interest when you escape far enough, head home
      e.aggro = false;
      e.wx = e.sx; e.wy = e.sy;
      return;
    }
    if (!tgt) return;
    const spd = e.rooted > 0 ? 0 : e.spd * (e.rage ? 1.5 : 1);
    const dx = (tgt.x - e.x)/ (td||1), dy = (tgt.y - e.y)/(td||1);
    const hitR = e.boss ? 50 : 34;
    const hit = () => { if (tgt.kind === 'player') hurtPlayer(e.dmg); else hurtMinion(tgt.m, e.dmg); };
    switch (e.arch){
      case 'chaser': case 'tank':
        if (td > hitR) seek(e, tgt.x, tgt.y, spd, dt);
        else if (e.cd <= 0){ e.cd = e.arch === 'tank' ? 1.5 : 1.0; hit(); }
        break;
      case 'wisp': {
        const sway = Math.sin(performance.now()/180 + e.sx) * 60;
        if (td > hitR) seek(e, tgt.x - dy*sway, tgt.y + dx*sway, spd, dt);
        else if (e.cd <= 0){ e.cd = 0.9; hit(); }
        break;
      }
      case 'spitter':
        if (td < 110) seek(e, e.x - dx*100, e.y - dy*100, spd, dt);
        else if (td > 210) seek(e, tgt.x, tgt.y, spd, dt);
        if (e.cd <= 0 && td < 320){ e.cd = 1.7 + Math.random()*0.6;
          shoot(e.x, e.y, tgt.x, tgt.y, e.dmg, false, TYPES[DEX[e.sp].ty[0]].col, 200); }
        break;
      case 'caster':
        if (td < 140) seek(e, e.x - dx*100, e.y - dy*100, spd, dt);
        else if (td > 240) seek(e, tgt.x, tgt.y, spd, dt);
        if (e.cd <= 0 && td < 380){ e.cd = 2.6;
          for (const a of [-0.25, 0, 0.25]){
            const c = Math.cos(a), s = Math.sin(a);
            const vx = dx*c - dy*s, vy = dx*s + dy*c;
            shoot(e.x, e.y, e.x + vx*100, e.y + vy*100, e.dmg*0.9, false, TYPES[DEX[e.sp].ty[0]].col, 190);
          }
        }
        break;
    }
    if (e.boss){
      e.burstCd -= dt;
      if (e.burstCd <= 0 && td < 420){
        e.burstCd = 6;
        shakeAmp = Math.max(shakeAmp, 0.35);
        playFX('blast', e.x, e.y - 8, { scale: 1.6, fps: 20 });
        for (let i = 0; i < 10; i++){
          const a = i/10 * Math.PI*2;
          shoot(e.x, e.y, e.x + Math.cos(a)*100, e.y + Math.sin(a)*100, e.dmg, false, '#e8c95d', 160);
        }
      }
    }
    if (e.riv){ // rival necromancer: extra bolts
      e.cd2 = (e.cd2 ?? 1.5) - dt;
      if (e.cd2 <= 0 && td < 420){ e.cd2 = 1.9; shoot(e.x, e.y, tgt.x, tgt.y, e.dmg*1.1, false, '#e8442e', 240); }
    }
  }

  function updateMinion(m, dt){
    m.cd -= dt;
    const st = statsFor(m.g.sp, m.g.lvl);
    const spd = 150 + st.spd;
    const tgt = nearestEnemy(m.x, m.y, 270) || nearestEnemy(World.ppx, World.ppy, 230);
    const ranged = ['spitter','caster'].includes(ARCH[m.g.sp]);
    if (tgt){
      const d = dist(m, tgt) || 1;
      const want = ranged ? 130 : (tgt.boss ? 52 : 32);
      if (d > want + 8) seek(m, tgt.x, tgt.y, spd, dt);
      else if (d < want - 24) seek(m, m.x - (tgt.x-m.x)/d*100, m.y - (tgt.y-m.y)/d*100, spd, dt);
      if (m.cd <= 0 && d < (ranged ? 280 : want + 14)){
        m.cd = (ranged ? 1.4 : 1.0) * (1 - 0.08*treeRank('minS'));
        if (ranged) shoot(m.x, m.y, tgt.x, tgt.y, minionDmg(m.g), true, TYPES[DEX[m.g.sp].ty[0]].col, 240, );
        else hurtEnemy(tgt, minionDmg(m.g), DEX[m.g.sp].ty[0], { x:m.x, y:m.y });
      }
    } else {
      // follow formation slot behind player
      const a = (m.slot / Math.max(1, G.party.length)) * Math.PI*2;
      const hx = World.ppx + Math.cos(a)*44, hy = World.ppy + Math.sin(a)*44;
      const d = Math.hypot(hx-m.x, hy-m.y);
      if (d > 26) seek(m, hx, hy, spd, dt);
      if (d > 420){ m.x = hx; m.y = hy; } // teleport if left behind
    }
  }

  function updateProj(p, dt){
    p.ttl -= dt;
    if (p.ally){ p.trail = p.trail || []; p.trail.push({ x:p.x, y:p.y });
      if (p.trail.length > 6) p.trail.shift(); }
    p.x += p.vx*dt; p.y += p.vy*dt;
    if (p.ttl <= 0 || World.shotBlockedPx(p.x, p.y)){ ents = ents.filter(x => x !== p); return; }
    if (p.ally){
      const e = nearestEnemy(p.x, p.y, 22);
      if (e){
        const dealt = hurtEnemy(e, p.dmg, 'SPIRIT');
        playFX('blast', p.x, p.y, { scale: treeRank('nova') ? 1.4 : 0.8, fps: 24 });
        if (p.heal && dealt){
          G.pc.hp = Math.min(pstats().maxhp, G.pc.hp + dealt * p.heal);
          playFX('heal', World.ppx, World.ppy - 14, { fps: 18 });
          floater(World.ppx, World.ppy - 30, '+' + Math.round(dealt * p.heal), '#6dd86d');
        }
        if (treeRank('nova')){ // burst: splash nearby foes
          for (const e2 of enemies()){
            if (e2 !== e && Math.hypot(e2.x - p.x, e2.y - p.y) < 64)
              hurtEnemy(e2, p.dmg * 0.6, 'SPIRIT');
          }
        }
        ents = ents.filter(x => x !== p);
      }
    } else {
      if (Math.hypot(p.x-World.ppx, p.y-World.ppy+6) < 20){ hurtPlayer(p.dmg); ents = ents.filter(x => x !== p); return; }
      for (const m of minions){
        if (Math.hypot(p.x-m.x, p.y-m.y) < 20){ hurtMinion(m, p.dmg); ents = ents.filter(x => x !== p); return; }
      }
    }
  }

  function updateDrop(d, dt){
    d.ttl -= dt;
    if (d.ttl <= 0){ ents = ents.filter(x => x !== d); return; }
    const dd = Math.hypot(d.x-World.ppx, d.y-World.ppy);
    if (dd < 140){ d.x += (World.ppx-d.x)*4*dt; d.y += (World.ppy-d.y)*4*dt; } // magnet
    if (dd < 26){
      if (d.gold){ G.gold += d.gold; floater(World.ppx, World.ppy-30, '+'+d.gold+'⛁', '#e8c95d'); }
      else if (d.item){ Inv.add(d.item, d.n); UI.toast(`Picked up ${ITEMS[d.item].n}.`); }
      else if (d.gear){
        if (G.gear.bag.length < 60){ G.gear.bag.push(d.gear);
          UI.toast(`${RARITIES[d.gear.rar].n.toUpperCase()} loot: ${d.gear.name}!`); }
        else UI.toast('Gear bag full!');
      }
      ents = ents.filter(x => x !== d);
    }
  }

  // ---------- draw ----------
  function draw(ctx, camX, camY){
    const all = [...ents.filter(e => 'exdf'.includes(e.k) === false ? true : true)];
    // drops & fx below actors
    for (const d of ents){
      const sx = d.x - camX, sy = d.y - camY;
      if (d.k === 'd'){
        if (d.gold){ ctx.fillStyle = '#e8c95d'; ctx.fillRect(sx-4, sy-3, 8, 6); ctx.fillStyle = '#b89a3a'; ctx.fillRect(sx-4, sy+1, 8, 2); }
        else if (d.item){ ctx.fillStyle = '#8ad8e8'; ctx.fillRect(sx-5, sy-5, 10, 10); ctx.fillStyle = '#2e4a5a'; ctx.fillRect(sx-3, sy-3, 6, 6); }
        else if (d.gear){ ctx.fillStyle = RARITIES[d.gear.rar].col; ctx.beginPath(); ctx.arc(sx, sy, 6 + Math.sin(performance.now()/200)*1.5, 0, 7); ctx.fill(); }
      } else if (d.k === 'x'){
        ctx.globalAlpha = Math.max(0, d.ttl / 0.35);
        ctx.fillStyle = d.col; ctx.beginPath(); ctx.arc(sx, sy, 18 * (1 - d.ttl/0.35) + 6, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // enemies + minions sorted with player by world draw; combat draws them itself sorted by y
    const actors = [...enemies(), ...minions].sort((a, b) => a.y - b.y);
    const nowT = performance.now();
    for (const a of actors){
      const sx = a.x - camX, sy = a.y - camY;
      const size = a.boss ? 76 : a.k === 'm' ? 40 : 46;
      const spr = SPR.creature(a.k === 'm' ? a.g.sp : a.sp);
      // drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(sx, sy + size*0.36, size*0.28, size*0.11, 0, 0, 7); ctx.fill();
      if (a.k === 'm'){ ctx.strokeStyle = '#6dd86d55'; ctx.beginPath(); ctx.arc(sx, sy + size*0.4, 12, 0, 7); ctx.stroke(); }
      // living bob + facing flip + hit squash
      const bob = Math.sin(nowT/150 + (a.sx || a.slot*7 || 0)) * 1.6;
      ctx.save();
      ctx.translate(sx, sy - 6 + bob);
      if ((a.face || 1) < 0) ctx.scale(-1, 1);
      if (a.hurtT > 0){ ctx.scale(1.14, 0.86); }
      ctx.drawImage(spr, -size/2, -size/2, size, size);
      if (a.hurtT > 0){ // white impact flash, additive second pass
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a.hurtT * 4;
        ctx.drawImage(spr, -size/2, -size/2, size, size);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      // hp bar
      const hp = a.k === 'm' ? a.g.hp : a.hp;
      const mx = a.k === 'm' ? statsFor(a.g.sp, a.g.lvl).maxhp : a.maxhp;
      if (hp < mx){
        const w = a.boss ? 60 : 34;
        ctx.fillStyle = '#0008'; ctx.fillRect(sx - w/2, sy - size/2 - 12, w, 5);
        ctx.fillStyle = a.k === 'm' ? '#6dd86d' : '#e85d5d';
        ctx.fillRect(sx - w/2, sy - size/2 - 12, w * Math.max(0, hp/mx), 5);
      }
      // capture hint
      if (a.k === 'e' && !a.riv && a.hp / a.maxhp <= 0.35){
        ctx.fillStyle = '#8ad8e8';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('◍', sx - 4, sy - size/2 - 16 + Math.sin(performance.now()/180)*2);
      }
      if (a.riv){
        ctx.fillStyle = '#e8442e'; ctx.font = 'bold 10px monospace';
        ctx.fillText('RIVAL', sx - 14, sy - size/2 - 16);
      }
    }
    // projectiles & floaters on top
    for (const p of ents){
      const sx = p.x - camX, sy = p.y - camY;
      if (p.k === 'p'){
        if (p.trail){ // glowing trail
          ctx.globalCompositeOperation = 'lighter';
          p.trail.forEach((t, i) => {
            ctx.globalAlpha = (i / p.trail.length) * 0.45;
            ctx.fillStyle = p.col;
            ctx.beginPath(); ctx.arc(t.x - camX, t.y - camY, 2 + i * 0.6, 0, 7); ctx.fill();
          });
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(sx, sy, p.ally ? 5 : 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(sx, sy, 2, 0, 7); ctx.fill();
      } else if (p.k === 'v'){
        const fr = SPR.fx(p.name);
        const f = Math.min(fr.length - 1, Math.floor(p.t * p.fps));
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.scale(p.scale, p.scale);
        if (!p.soft) ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(fr[f], -fr[f].width/2, -fr[f].height/2);
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.k === 'pt'){
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, p.ttl * 2.2);
        ctx.fillStyle = p.col;
        ctx.fillRect(sx - p.size/2, sy - p.size/2, p.size, p.size);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.k === 'f'){
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#000'; ctx.fillText(p.txt, sx+1, sy+1);
        ctx.fillStyle = p.col; ctx.fillText(p.txt, sx, sy);
      }
    }
    // buff auras: a slow sigil under the player while empowered
    if (G.pc.vigor > 0 || G.pc.packFrenzy > 0 || G.pc.frenzy > 0 || G.pc.shield > 0){
      const fr = SPR.fx('circle');
      const f = Math.floor(performance.now() / 70) % fr.length;
      ctx.save();
      ctx.translate(World.ppx - camX, World.ppy - camY + 12);
      ctx.globalAlpha = 0.4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(fr[f], -fr[f].width/2, -fr[f].height/2);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // player swing arc
    if (G.pc.swing > 0){
      const [fx, fy] = World.faceVec();
      const a0 = Math.atan2(fy, fx);
      ctx.strokeStyle = '#e8e0d0aa'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(World.ppx - camX, World.ppy - camY - 6, 40, a0 - 0.9, a0 + 0.9);
      ctx.stroke(); ctx.lineWidth = 1;
    }
  }

  // ---------- active skills (hotbar) ----------
  function castSkill(id){
    if (!id) return;
    const r = treeRank(id);
    if (!r) return UI.toast('Skill not learned — see your Talents.');
    const A = ACTIVES[id];
    G.pc.cds = G.pc.cds || {};
    if ((G.pc.cds[id] || 0) > 0) return;
    if (G.pc.soul < A.soul) return UI.toast('Not enough Soul.');
    const ps = pstats();
    G.pc.soul -= A.soul;
    G.pc.cds[id] = A.cd;
    G.pc.cast = 0.18;
    playFX('circle', World.ppx, World.ppy + 12, { fps: 22 });
    const [fx, fy] = World.faceVec();
    const tgt = nearestEnemy(World.ppx, World.ppy, 430);
    const tx = tgt ? tgt.x : World.ppx + fx*200, ty = tgt ? tgt.y : World.ppy + fy*200;
    switch (id){
      case 'barrage': {
        const n = 4 + r, base = Math.atan2(ty - World.ppy, tx - World.ppx);
        for (let i = 0; i < n; i++){
          const a = base + (i - (n-1)/2) * 0.22;
          shoot(World.ppx, World.ppy - 8, World.ppx + Math.cos(a)*100, World.ppy - 8 + Math.sin(a)*100,
            ps.bolt * (0.6 + 0.1*r), true, '#9b6dff', 290);
        }
        break;
      }
      case 'coil': {
        const p = { k:'p', x:World.ppx, y:World.ppy - 8, dmg: ps.bolt * (1.5 + 0.5*r),
          ally:true, col:'#6dd86d', ttl:1.8, heal:0.5 };
        const d = Math.hypot(tx - p.x, ty - p.y) || 1;
        p.vx = (tx - p.x)/d * 260; p.vy = (ty - p.y)/d * 260;
        ents.push(p);
        break;
      }
      case 'grasp': {
        if (!tgt){ UI.toast('No foe in reach.'); G.pc.soul += A.soul; G.pc.cds[id] = 0; return; }
        playFX('spikes', tgt.x, tgt.y, { soft: true, fps: 16, scale: 1.3 });
        shakeAmp = Math.max(shakeAmp, 0.2);
        for (const e of enemies()){
          if (Math.hypot(e.x - tgt.x, e.y - tgt.y) < 85){
            hurtEnemy(e, ps.bolt * (0.8 + 0.2*r), 'BONE');
            e.rooted = 1.5 + 0.5*r;
            floater(e.x, e.y - 34, 'ROOTED', '#d8d0b8');
          }
        }
        break;
      }
      case 'bones': {
        const nl = Systems.skillLvl('necromancy');
        for (let i = 0; i <= r; i++){
          const lvl = Math.max(3, Math.round(nl * 1.2));
          const st = statsFor('skulpup', lvl);
          minions.push({ k:'m', slot: 90 + i, cd: Math.random(),
            x: World.ppx + Math.cos(i*2)*50, y: World.ppy + Math.sin(i*2)*50,
            g: { sp:'skulpup', lvl, hp: st.maxhp, nick:'Bone Servant', xp:0, temp:true, ttl:15 } });
        }
        UI.toast(`${1 + r} bone servant${r ? 's' : ''} claw out of the earth!`);
        break;
      }
      case 'frenzy':
        G.pc.packFrenzy = 5 + r;
        G.pc.packFrenzyAmt = 0.3 + 0.1*r;
        UI.toast('Your pack howls with borrowed fury!');
        break;
      case 'armor':
        G.pc.shield = Math.round(ps.maxhp * (0.25 + 0.1*r));
        G.pc.shieldT = 8;
        break;
      case 'whirl': {
        G.pc.swing = 0.24;
        const reach = (1 + 0.2 * treeRank('sweep')) * 75;
        for (const e of enemies()){
          if (Math.hypot(e.x - World.ppx, e.y - World.ppy) < reach + (e.boss ? 20 : 0))
            hurtEnemy(e, ps.melee * (1.2 + 0.3*r), null, { x:World.ppx, y:World.ppy });
        }
        break;
      }
      case 'vigor':
        G.pc.vigor = 5 + r;
        break;
    }
  }

  function spawnRivalPack(riv, rank){
    const px = World.ppx, py = World.ppy;
    const lvl = Math.max(3, 4 + Math.floor(rank * 2.0));
    const r = spawnEnemy('hollowshade', lvl + 2, { x:px + 200, y:py, aggro:true, riv });
    r.maxhp = r.hp = Math.floor(60 + rank * 40);
    r.dmg = 4 + rank * 1.5;
    r.isRivalBody = true;
    const n = Math.min(6, 1 + Math.ceil(rank / 2));
    for (let i = 0; i < n; i++){
      const a = i / n * Math.PI * 2;
      spawnEnemy(RIVAL_POOL[rnd(RIVAL_POOL.length)], Math.max(2, lvl - 1 + rnd(3)),
        { x:px + 200 + Math.cos(a)*70, y:py + Math.sin(a)*70, aggro:true, riv });
    }
    return r;
  }

  function clearHostiles(){ ents = ents.filter(e => e.k !== 'e' && e.k !== 'p'); }

  return { reset, update, draw, playerAttack, playerBolt, throwJar, pstats, minionCap,
    castSkill, floatText: floater, shake: () => shakeAmp,
    syncMinions, spawnEnemy, spawnRivalPack, clearHostiles, zoneLevel,
    enemies: () => enemies(), nearestEnemy, hasAggro: () => enemies().some(e => e.aggro) };
})();

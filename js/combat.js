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
    return {
      maxhp:   Math.floor(50 + nl*6 + gearAffix('hp')),
      maxsoul: Math.floor(25 + nl*2 + gearAffix('soul')),
      melee:   (7 + nl*1.6) * (1 + gearAffix('dmg')/100),
      bolt:    (10 + nl*2.2) * (1 + gearAffix('bolt')/100),
      speed:   165 * (1 + gearAffix('speed')/100),
      regen:   (2.2 + nl*0.08) * (1 + gearAffix('regen')/100),
    };
  }
  function minionCap(){ return Math.min(9, 3 + Math.floor(Systems.skillLvl('necromancy') / 5)); }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---------- spawning ----------
  function enemyFor(sp, lvl, opts = {}){
    const a = ARCH_STATS[ARCH[sp]];
    const boss = !!opts.boss;
    const maxhp = Math.floor((14 + 7*lvl) * a.hp * (boss ? 6 : 1));
    return {
      k:'e', sp, lvl, boss, x:opts.x, y:opts.y,
      hp:maxhp, maxhp,
      dmg:(3 + 1.7*lvl) * a.dmg * (boss ? 1.6 : 1),
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
    const nl = Systems.skillLvl('necromancy');
    if (zone === 'cata') return 3 + World.cataFloor * 2;
    return 2 + Math.floor((nl - 1) * 0.7);
  }

  function spawnZone(zone){
    if (zone === 'woods'){
      const n = 9 + plotTier('hide') * 2;
      const tbl = ENCOUNTERS.woods.filter(e => !e.night || UI.isNight());
      for (let i = 0; i < n; i++){
        const s = freeSpot(); if (!s) continue;
        let pool = tbl;
        if (plotTier('hide') && Math.random() < 0.12 * plotTier('hide')) pool = tbl.filter(e => e.w <= 5).length ? tbl.filter(e => e.w <= 5) : tbl;
        const e = pickW(pool);
        spawnEnemy(e.sp, e.min + rnd(e.max - e.min + 1) + Math.floor((Systems.skillLvl('necromancy')-1) * 0.7), s);
      }
    } else if (zone === 'cata'){
      const lvl = zoneLevel('cata');
      for (let i = 0; i < 11 + Math.min(10, Math.floor(World.cataFloor/3)); i++){
        const s = freeSpot(4); if (!s) continue;
        const e = pickW(ENCOUNTERS.cata);
        spawnEnemy(e.sp, Math.max(2, lvl - 1 + rnd(4)), s);
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
    return base * (1 + gearAffix('minion')/100);
  }

  // ---------- helpers ----------
  function floater(x, y, txt, col){ ents.push({ k:'f', x, y, txt, col, ttl:0.9 }); }
  function poof(x, y, col){ ents.push({ k:'x', x, y, ttl:0.35, col }); }
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

  // ---------- damage ----------
  function hurtEnemy(e, dmg, attType, srcXY){
    const tm = attType ? typeMult(attType, DEX[e.sp].ty) : 1;
    const final = Math.max(1, Math.round(dmg * tm * (0.9 + Math.random()*0.2)));
    e.hp -= final; e.aggro = true; e.hurtT = 0.15;
    floater(e.x, e.y - 24, String(final), tm > 1 ? '#e8c95d' : tm < 1 ? '#8a7fa8' : '#e8e0d0');
    if (srcXY){ const d = Math.hypot(e.x-srcXY.x, e.y-srcXY.y) || 1;
      moveEnt(e, (e.x-srcXY.x)/d * 1400, (e.y-srcXY.y)/d * 1400, 0.016); }
    if (e.hp <= 0) killEnemy(e);
  }
  function hurtPlayer(dmg){
    if (G.pc.inv > 0 || dying) return;
    G.pc.hp -= Math.max(1, Math.round(dmg));
    G.pc.inv = 0.5;
    floater(World.ppx, World.ppy - 28, String(Math.max(1, Math.round(dmg))), '#e85d5d');
    if (G.pc.hp <= 0){ dying = true; G.pc.hp = 0; Systems.afterLoss().then(() => dying = false); }
  }
  function hurtMinion(m, dmg){
    m.g.hp -= Math.max(1, Math.round(dmg));
    floater(m.x, m.y - 24, String(Math.max(1, Math.round(dmg))), '#e8825d');
    if (m.g.hp <= 0){
      m.g.hp = 0; m.g.downT = 15;
      poof(m.x, m.y, '#9b6dff');
      UI.toast(`${m.g.nick} was knocked down!`);
      minions = minions.filter(x => x !== m);
    }
  }

  function killEnemy(e){
    ents = ents.filter(x => x !== e);
    poof(e.x, e.y, '#5a4a7a');
    G.kills = (G.kills || 0) + 1;
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
    const goldMult = 1 + gearAffix('gold')/100;
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
    let hit = 0;
    for (const e of enemies()){
      const dx = e.x - World.ppx, dy = e.y - World.ppy;
      const d = Math.hypot(dx, dy);
      if (d > (e.boss ? 78 : 58)) continue;
      const dot = (dx*fx + dy*fy) / (d || 1);
      if (dot < 0.25 && d > 26) continue;
      hurtEnemy(e, ps.melee, null, { x:World.ppx, y:World.ppy });
      hit++;
    }
    return hit > 0;
  }
  function playerBolt(){
    if (G.pc.boltCd > 0) return;
    if (G.pc.soul < 6){ UI.toast('Not enough Soul.'); return; }
    const ps = pstats();
    G.pc.soul -= 6;
    G.pc.boltCd = 0.55;
    const t = nearestEnemy(World.ppx, World.ppy, 430);
    let tx, ty;
    if (t){ tx = t.x; ty = t.y; }
    else { const [fx, fy] = World.faceVec(); tx = World.ppx + fx*200; ty = World.ppy + fy*200; }
    shoot(World.ppx, World.ppy - 8, tx, ty, ps.bolt, true, '#9b6dff', 300);
  }

  function bestJarFor(e){
    const tiers = ['jar','gjar','ajar'].filter(id => Inv.count(id) > 0);
    if (!tiers.length) return null;
    for (const id of tiers) if (catchChance(e, id) >= 0.5) return id;
    return tiers[tiers.length - 1];
  }
  function catchChance(e, jarId){
    const houseB = 0.05 * plotTier('moontower') + (e.hooked ? 0.06 * plotTier('shore') : 0);
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
    const ps = pstats();
    G.pc.atkCd = Math.max(0, G.pc.atkCd - dt);
    G.pc.boltCd = Math.max(0, (G.pc.boltCd || 0) - dt);
    G.pc.inv = Math.max(0, (G.pc.inv || 0) - dt);
    G.pc.swing = Math.max(0, (G.pc.swing || 0) - dt);
    G.pc.soul = Math.min(ps.maxsoul, G.pc.soul + ps.regen * dt);

    const anyAggro = enemies().some(e => e.aggro);
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
          g.hp = Math.floor(statsFor(g.sp, g.lvl).maxhp * 0.25);
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
    }
    for (const m of minions) updateMinion(m, dt);
  }

  function updateEnemy(e, dt, targets){
    e.hurtT = Math.max(0, e.hurtT - dt);
    e.cd -= dt;
    e.t -= dt;
    if (e.rage) e.rage = Math.max(0, e.rage - dt);
    // target
    let tgt = null, td = 1e9;
    for (const t of targets){
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d < td){ td = d; tgt = t; }
    }
    if (!e.aggro){
      if (td < (e.hooked ? 9999 : 240)) e.aggro = true;
      else { // wander
        if (e.t <= 0){ e.t = 2 + Math.random()*2.5; e.wx = e.sx + rnd(120)-60; e.wy = e.sy + rnd(120)-60; }
        const d = Math.hypot(e.wx-e.x, e.wy-e.y);
        if (d > 8) moveEnt(e, (e.wx-e.x)/d * e.spd*0.4, (e.wy-e.y)/d * e.spd*0.4, dt);
        return;
      }
    }
    if (!tgt) return;
    const spd = e.spd * (e.rage ? 1.5 : 1);
    const dx = (tgt.x - e.x)/ (td||1), dy = (tgt.y - e.y)/(td||1);
    const hitR = e.boss ? 50 : 34;
    const hit = () => { if (tgt.kind === 'player') hurtPlayer(e.dmg); else hurtMinion(tgt.m, e.dmg); };
    switch (e.arch){
      case 'chaser': case 'tank':
        if (td > hitR) moveEnt(e, dx*spd, dy*spd, dt);
        else if (e.cd <= 0){ e.cd = e.arch === 'tank' ? 1.5 : 1.0; hit(); }
        break;
      case 'wisp': {
        const sway = Math.sin(performance.now()/180 + e.sx) * 0.6;
        if (td > hitR) moveEnt(e, (dx - dy*sway)*spd, (dy + dx*sway)*spd, dt);
        else if (e.cd <= 0){ e.cd = 0.9; hit(); }
        break;
      }
      case 'spitter':
        if (td < 110) moveEnt(e, -dx*spd, -dy*spd, dt);
        else if (td > 210) moveEnt(e, dx*spd, dy*spd, dt);
        if (e.cd <= 0 && td < 320){ e.cd = 1.7 + Math.random()*0.6;
          shoot(e.x, e.y, tgt.x, tgt.y, e.dmg, false, TYPES[DEX[e.sp].ty[0]].col, 200); }
        break;
      case 'caster':
        if (td < 140) moveEnt(e, -dx*spd, -dy*spd, dt);
        else if (td > 240) moveEnt(e, dx*spd, dy*spd, dt);
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
      if (d > want + 8) moveEnt(m, (tgt.x-m.x)/d*spd, (tgt.y-m.y)/d*spd, dt);
      else if (d < want - 24) moveEnt(m, -(tgt.x-m.x)/d*spd, -(tgt.y-m.y)/d*spd, dt);
      if (m.cd <= 0 && d < (ranged ? 280 : want + 14)){
        m.cd = ranged ? 1.4 : 1.0;
        if (ranged) shoot(m.x, m.y, tgt.x, tgt.y, minionDmg(m.g), true, TYPES[DEX[m.g.sp].ty[0]].col, 240, );
        else hurtEnemy(tgt, minionDmg(m.g), DEX[m.g.sp].ty[0], { x:m.x, y:m.y });
      }
    } else {
      // follow formation slot behind player
      const a = (m.slot / Math.max(1, G.party.length)) * Math.PI*2;
      const hx = World.ppx + Math.cos(a)*44, hy = World.ppy + Math.sin(a)*44;
      const d = Math.hypot(hx-m.x, hy-m.y);
      if (d > 26) moveEnt(m, (hx-m.x)/d*spd, (hy-m.y)/d*spd, dt);
      if (d > 420){ m.x = hx; m.y = hy; } // teleport if left behind
    }
  }

  function updateProj(p, dt){
    p.ttl -= dt;
    p.x += p.vx*dt; p.y += p.vy*dt;
    if (p.ttl <= 0 || World.shotBlockedPx(p.x, p.y)){ ents = ents.filter(x => x !== p); return; }
    if (p.ally){
      const e = nearestEnemy(p.x, p.y, 22);
      if (e){ hurtEnemy(e, p.dmg, 'SPIRIT'); ents = ents.filter(x => x !== p); }
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
    if (dd < 90){ d.x += (World.ppx-d.x)*4*dt; d.y += (World.ppy-d.y)*4*dt; } // magnet
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
    for (const a of actors){
      const sx = a.x - camX, sy = a.y - camY;
      const size = a.boss ? 76 : a.k === 'm' ? 40 : 46;
      const spr = SPR.creature(a.k === 'm' ? a.g.sp : a.sp);
      if (a.k === 'm'){ ctx.strokeStyle = '#6dd86d55'; ctx.beginPath(); ctx.arc(sx, sy + size*0.4, 12, 0, 7); ctx.stroke(); }
      if (a.hurtT > 0){ ctx.globalAlpha = 0.6; }
      ctx.drawImage(spr, sx - size/2, sy - size/2 - 6, size, size);
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
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(sx, sy, p.ally ? 5 : 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(sx, sy, 2, 0, 7); ctx.fill();
      } else if (p.k === 'f'){
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#000'; ctx.fillText(p.txt, sx+1, sy+1);
        ctx.fillStyle = p.col; ctx.fillText(p.txt, sx, sy);
      }
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
    syncMinions, spawnEnemy, spawnRivalPack, clearHostiles, zoneLevel,
    enemies: () => enemies(), nearestEnemy, hasAggro: () => enemies().some(e => e.aggro) };
})();

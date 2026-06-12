// ============================================================
// GRIMVALE — systems: skills, farming, fishing, manor + deeds
// housing, catacombs, Soul Ladder, gear, shop, menus, saves.
// ============================================================
'use strict';

const Systems = (() => {
  const nowMin = () => G.time.day * 1440 + G.time.min;

  // ---------- skills ----------
  function skillLvl(s){ return skillLevel(G.skills[s] || 0); }
  function skillAdd(s, xp){
    const old = skillLvl(s);
    G.skills[s] = (G.skills[s] || 0) + Math.floor(xp);
    const nw = skillLvl(s);
    if (nw > old) UI.toast(`${SKILLS[s].icon} ${SKILLS[s].n} rose to Lv.${nw}!`);
  }

  function healAll(){
    G.pc.hp = Combat.pstats().maxhp;
    G.pc.soul = Combat.pstats().maxsoul;
    for (const g of G.party){ g.hp = statsFor(g.sp, g.lvl).maxhp; g.status = null; delete g.downT; }
    Combat.syncMinions();
  }

  // ---------- defeat ----------
  async function afterLoss(){
    await UI.say(['Everything went dark...',
      'You wake in your own bed at Hollow Manor. Witch Morwen must have dragged you home — and helped herself to some coin for the trouble.']);
    G.gold = Math.max(0, G.gold - Math.ceil(G.gold * 0.1));
    World.cata = null;
    World.houseId = null;
    World.enter('manor', 10, 9);
    healAll();
    save();
  }

  // ---------- farming ----------
  function growMult(map){
    let m = 1 + 0.02 * (skillLvl('farming') - 1) + 0.15 * plotTier('garden');
    if (map === 'manor') m *= 2; // conservatory beds
    return m;
  }
  function cropStage(p){
    const t = CROPS[p.crop].time / growMult(p.map) / (p.wet ? 1.5 : 1);
    return Math.min(3, Math.floor((nowMin() - p.at) / (t / 3)));
  }
  const FARM_XP = { bloodberry:10, gravefruit:18, moonwheat:28, pumpkid:45, mandragora:60, mystery:80 };

  async function plot(x, y){
    const key = `${World.map}:${x},${y}`;
    const p = G.farm[key];
    if (!p || !p.crop){
      const seedId = await UI.pickItem(it => it.k === 'seed', 'PLANT WHICH SEED?');
      if (!seedId) return;
      const crop = ITEMS[seedId].crop;
      const req = SKILL_REQ.seed[crop] || 1;
      if (skillLvl('farming') < req)
        return UI.say(`You need Farming Lv.${req} to handle this seed. (You are Lv.${skillLvl('farming')})`);
      Inv.take(seedId, 1);
      G.farm[key] = { crop, at: nowMin(), wet: false, map: World.map };
      skillAdd('farming', 5);
      UI.toast(`Planted ${CROPS[crop].n}.`);
      return;
    }
    const stage = cropStage(p);
    if (stage < 3){
      if (!p.wet){
        const tDry = CROPS[p.crop].time / growMult(p.map);
        const frac = (nowMin() - p.at) / tDry;
        p.wet = true;
        p.at = nowMin() - frac * (tDry / 1.5);
        skillAdd('farming', 2);
        UI.toast('You water the plot. It gurgles appreciatively.');
      } else {
        await UI.say(`The ${CROPS[p.crop].n} is growing... (stage ${stage + 1}/4)`);
      }
      return;
    }
    // harvest
    const c = CROPS[p.crop];
    delete G.farm[key];
    if (c.item){
      let qty = c.qty[0] + rnd(c.qty[1] - c.qty[0] + 1);
      if (Math.random() < 0.02 * skillLvl('farming')) { qty++; UI.toast('Bonus yield!'); }
      Inv.add(c.item, qty);
      skillAdd('farming', FARM_XP[p.crop] || 10);
      await UI.say(`Harvested ${qty}× ${ITEMS[c.item].n}!`);
    } else {
      const sp = Array.isArray(c.hatch) ? c.hatch[rnd(c.hatch.length)] : c.hatch;
      const lvl = 3 + Math.floor(skillLvl('farming') * 0.8) + rnd(3);
      const g = makeGrim(sp, lvl);
      G.dex[sp] = 2;
      skillAdd('farming', FARM_XP[p.crop] || 40);
      skillAdd('necromancy', 20);
      await UI.say([`The soil heaves... something claws its way out!`,
        `A ${DEX[sp].n} (Lv.${lvl}) crawls from your garden and stares at you adoringly.`]);
      if (G.party.length < Combat.minionCap()){ G.party.push(g); Combat.syncMinions(); }
      else { G.storage.push(g); await UI.say('Your pack is full — it was sent to the storage box.'); }
    }
  }

  // ---------- fishing: cast → wait → bite → reel struggle ----------
  let fxFish = null; // {x,y,phase:'cast'|'wait'|'bite'|'reel', t, dip} — drawn by World
  function fishingFx(){ return fxFish; }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // wait for the bite; resolves 'hit' | 'early' | 'miss' | 'cancel'
  function waitPhase(biteAfter, nibbleTimes){
    return new Promise(res => {
      let done = false;
      const timers = [];
      for (const t of nibbleTimes)
        timers.push(setTimeout(() => { if (fxFish) fxFish.dip = performance.now(); }, t));
      timers.push(setTimeout(() => {
        if (!fxFish) return;
        fxFish.phase = 'bite';
        fxFish.t = performance.now();
        timers.push(setTimeout(() => finish('miss'), 900)); // strike window
      }, biteAfter));
      const h = k => {
        // the literal 'A' key also strikes (it normalizes to 'left', so check raw state)
        if (k === 'ok' || Input.keys['a'] || Input.keys['A'])
          finish(fxFish && fxFish.phase === 'bite' ? 'hit' : 'early');
        else if (k === 'no') finish('cancel');
      };
      function finish(r){
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        Input.pop(h);
        res(r);
      }
      Input.push(h);
    });
  }

  // hold-to-lift reel struggle; resolves true if landed
  function reelGame(sp, lvl){
    return new Promise(res => {
      $('fishing').classList.remove('hidden');
      const cv = $('fish-cv'), c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      // silhouette of the (still unknown) catch
      const sil = document.createElement('canvas');
      sil.width = sil.height = 16;
      const sc = sil.getContext('2d');
      sc.drawImage(SPR.creature(sp), 0, 0);
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = '#0d1320';
      sc.fillRect(0, 0, 16, 16);

      $('fish-hint').textContent = IS_TOUCH
        ? 'HOLD the A button to lift the hook — keep the fish in the green!'
        : 'HOLD Z (or A / Space) to lift the hook — keep the fish in the green!';
      const lifting = () => Input.held.ok || Input.keys['a'] || Input.keys['A'];
      const trackTop = 16, trackH = 252, trackX = 38, trackW = 84;
      const fl = skillLvl('fishing'), rod = Inv.bestRod();
      const barH = Math.min(170, 78 + fl * 2.2 + rod * 6 + 6 * plotTier('pondshack'));
      let barY = trackTop + trackH - barH, vy = 0;
      let fishY = barY + barH / 2, fishTgt = fishY, retarget = 0.8; // starts hooked, inside the bar
      const feisty = 36 + lvl * 2.8 + (DEX[sp].rare ? 50 : 0);
      let prog = 42, last = performance.now(), raf, doneFlag = false;

      function update(dt, now){
        // catch bar physics: hold to lift
        vy += (lifting() ? -560 : 460) * dt;
        vy *= 0.92;
        barY += vy * dt;
        if (barY < trackTop){ barY = trackTop; vy *= -0.25; }
        if (barY > trackTop + trackH - barH){ barY = trackTop + trackH - barH; vy *= -0.25; }
        // fish darts around
        retarget -= dt;
        if (retarget <= 0){
          retarget = 0.4 + Math.random() * 1.1;
          fishTgt = trackTop + 14 + Math.random() * (trackH - 28);
        }
        const d = fishTgt - fishY;
        fishY += Math.sign(d) * Math.min(Math.abs(d), feisty * dt) + Math.sin(now / 90) * 0.6;
        // progress: a slow tug-of-war, not a coin flip
        const inside = fishY >= barY - 5 && fishY <= barY + barH + 5;
        prog += (inside ? 15 : -(7 + lvl * 0.2)) * dt;
        window._reelDbg = { barY, barH, fishY, prog };
      }
      function draw(now){
        c.clearRect(0, 0, 220, 300);
        // water shimmer
        c.fillStyle = '#0d1320'; c.fillRect(trackX, trackTop, trackW, trackH);
        c.strokeStyle = '#564a78'; c.strokeRect(trackX - 1, trackTop - 1, trackW + 2, trackH + 2);
        for (let i = 0; i < 5; i++){
          c.fillStyle = 'rgba(93,138,232,0.10)';
          c.fillRect(trackX, trackTop + ((now / 26 + i * 55) % trackH), trackW, 7);
        }
        // catch bar
        const stress = lifting() ? 0.95 : 0.75;
        c.fillStyle = `rgba(109,216,109,${0.30 * stress})`;
        c.fillRect(trackX + 2, barY, trackW - 4, barH);
        c.strokeStyle = '#6dd86d'; c.strokeRect(trackX + 2, barY, trackW - 4, barH);
        // fishing line + fish silhouette (wiggling)
        c.strokeStyle = '#8a8268';
        c.beginPath(); c.moveTo(trackX + trackW / 2, trackTop); c.lineTo(trackX + trackW / 2, fishY - 12); c.stroke();
        const wig = Math.sin(now / 70) * (lifting() ? 5 : 2.5);
        c.save();
        c.translate(trackX + trackW / 2 + wig, fishY);
        c.rotate(Math.sin(now / 120) * 0.25);
        c.drawImage(sil, -16, -16, 32, 32);
        c.restore();
        // progress meter
        c.fillStyle = '#0b0812'; c.fillRect(160, trackTop, 22, trackH);
        c.strokeStyle = '#564a78'; c.strokeRect(159, trackTop - 1, 24, trackH + 2);
        const ph = trackH * Math.max(0, Math.min(1, prog / 100));
        c.fillStyle = prog > 70 ? '#e8c95d' : '#6dd86d';
        c.fillRect(161, trackTop + trackH - ph, 20, ph);
        c.fillStyle = '#8a7fa8'; c.font = '10px monospace';
        c.fillText('CATCH', 152, trackTop + trackH + 18);
        c.fillText('???', trackX + trackW / 2 - 10, trackTop + trackH + 18);
      }
      function frame(now){
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt, now);
        draw(now);
        if (prog >= 100) return end(true);
        if (prog <= 0) return end(false);
        raf = requestAnimationFrame(frame);
      }
      const h = k => { if (k === 'no') end(false); };
      function end(win){
        if (doneFlag) return;
        doneFlag = true;
        cancelAnimationFrame(raf);
        Input.pop(h);
        $('fishing').classList.add('hidden');
        res(win);
      }
      Input.push(h);
      raf = requestAnimationFrame(frame);
    });
  }

  async function fish(){
    let rod = Inv.bestRod();
    if (!rod) return UI.say('The water churns hungrily, but you have no rod. Fisher Eli by the lake might help.');
    const fl = skillLvl('fishing');
    const allowed = fl >= SKILL_REQ.rod[3] ? 3 : fl >= SKILL_REQ.rod[2] ? 2 : 1;
    if (rod > allowed){
      UI.toast(`Fishing Lv.${SKILL_REQ.rod[rod]} needed for that rod — using a lesser one.`);
      rod = allowed;
    }
    const bait = Inv.bestBait();
    if (bait) Inv.take(bait, 1);
    const moon = UI.moonPhase();
    let pool = FISH_TABLE.filter(e =>
      e.rod <= rod &&
      (!e.night || UI.isNight()) &&
      (!e.moon || (e.moon === 'new' && moon === 0) || (e.moon === 'full' && moon === 2)));
    pool = pool.map(e => ({ ...e,
      w: e.w * (e.rod > 1 && bait ? 1 + ITEMS[bait].tier : 1) * (e.rod > 1 ? 1 + 0.2 * plotTier('pier') : 1) }));
    const e = pickW(pool);
    const lvl = e.min + rnd(e.max - e.min + 1) + Math.floor(fl / 2);

    // CAST: bobber arcs out
    const [fxv, fyv] = World.faceVec();
    const bobX = World.ppx + fxv * TILE * 1.8, bobY = World.ppy + fyv * TILE * 1.8;
    fxFish = { x: bobX, y: bobY, phase: 'cast', t: performance.now(), dip: 0 };
    skillAdd('fishing', 2);
    await wait(650);
    if (!fxFish) return;
    fxFish.phase = 'wait';
    fxFish.t = performance.now();

    // WAIT: nibbles tease, then the real bite
    const biteAfter = Math.max(1500,
      2500 + rnd(5500) - (bait ? ITEMS[bait].tier * 600 : 0) - fl * 40);
    const nibbles = [];
    const n = rnd(3);
    for (let i = 0; i < n; i++) nibbles.push(600 + rnd(Math.max(400, biteAfter - 1200)));
    const r = await waitPhase(biteAfter, nibbles);
    if (r !== 'hit'){
      fxFish = null;
      if (r === 'early') UI.toast('Too soon! The line comes back empty.');
      else if (r === 'miss'){ skillAdd('fishing', 3); UI.toast('It spat the hook and vanished...'); }
      return;
    }

    // REEL: the struggle
    fxFish.phase = 'reel';
    const landed = await reelGame(e.sp, lvl);
    fxFish = null;
    if (!landed){
      skillAdd('fishing', 4);
      return UI.toast('The line goes slack — it escapes into the dark.');
    }
    // CAUGHT! The rod did the work — now choose its fate.
    G.dex[e.sp] = Math.max(G.dex[e.sp] || 0, 1);
    skillAdd('fishing', 14 + lvl + (DEX[e.sp].rare ? 50 : 0));
    const itemId = 'fish_' + e.sp;
    await UI.say(`You haul it onto the bank — a ${DEX[e.sp].n} (Lv.${lvl})${DEX[e.sp].rare ? ', a LEGEND of the deep!' : '!'}`);
    const jarId = ['jar','gjar','ajar'].find(id => Inv.count(id) > 0);
    const opts = [`Keep the catch — ${ITEMS[itemId].n}`];
    if (jarId) opts.push(`Bind it into your pack (uses 1 ${ITEMS[jarId].n})`);
    const c = await UI.choice(opts, { cancelable:false });
    if (c === 1 && jarId){
      Inv.take(jarId, 1);
      const g = makeGrim(e.sp, lvl);
      G.dex[e.sp] = 2;
      skillAdd('necromancy', 20 + lvl * 2);
      if (G.party.length < Combat.minionCap()){
        G.party.push(g);
        Combat.syncMinions();
        UI.toast(`★ ${g.nick} (Lv.${lvl}) slips into the jar and rises to fight for you!`);
      } else {
        G.storage.push(g);
        UI.toast(`★ ${g.nick} (Lv.${lvl}) bound — sent to storage (pack is full).`);
      }
    } else {
      Inv.add(itemId, 1);
      UI.toast(`${ITEMS[itemId].n} added to your satchel. Eli buys catches — or renders them.`);
    }
  }

  // ---------- gathering: chop trees, quarry rock, mine ore ----------
  async function gather(t, x, y){
    const N = NODES[t];
    if (!N) return;
    const Z = World.zone() || {};
    const item = t === 'Q' ? (Z.oreTier || 'ironore') : N.item;
    if (t === 'Q'){
      const req = ORE_REQ[item] || 1;
      if (skillLvl('gathering') < req)
        return UI.say(`This vein needs Gathering Lv.${req}. (You are Lv.${skillLvl('gathering')})`);
    }
    const key = `${x},${y}`;
    const hits = (World.nodeHits[key] || 0) + 1;
    World.nodeHits[key] = hits;
    G.pc.swing = 0.18; // swing the staff at it
    if (hits < N.hits){
      Combat.floatText(x*TILE + 24, y*TILE + 10, '✦', '#e8c95d');
      return;
    }
    // it breaks!
    let qty = N.qty[0] + rnd(N.qty[1] - N.qty[0] + 1);
    if (Math.random() < 0.02 * skillLvl('gathering') + 0.05 * plotTier('fenstilts')){
      qty *= 2;
      UI.toast('Double yield!');
    }
    if (t === 'Q' && Math.random() < 0.20 * plotTier('hillfort')) qty++;
    Inv.add(item, qty);
    skillAdd('gathering', t === 'Q' ? ORE_XP[item] : N.xp);
    World.setTile(x, y, 'g');
    Combat.floatText(x*TILE + 24, y*TILE + 10, `+${qty} ${ITEMS[item].n}`, '#c9a86d');
  }
  function manorDone(){ return ['kitchen','study','conservatory','crypt'].every(r => G.manor.restored[r]); }

  async function restore(x, y){
    if (World.map !== 'manor') return;
    const room = RESTORE_AT[`${x},${y}`];
    if (!room) return;
    const R = ROOMS[room];
    const c = R.cost;
    const needs = Object.entries(c).filter(([k]) => k !== 'gold');
    const needTxt = [`${c.gold}⛁`].concat(needs.map(([k,n]) => `${n}× ${ITEMS[k].n}`)).join(', ');
    await UI.say([`Rubble blocks the ${R.n}. ${R.d}`, `Restoring it needs: ${needTxt}.`]);
    const can = G.gold >= c.gold && needs.every(([k,n]) => Inv.count(k) >= n);
    if (!can) return UI.say('You lack the materials. The shop sells planks and stone; the catacombs hide ectoplasm.');
    if ((await UI.choice(['Restore it!','Not yet'])) !== 0) return;
    G.gold -= c.gold;
    needs.forEach(([k,n]) => Inv.take(k, n));
    G.manor.restored[room] = true;
    World.setTile(x, y, 'F');
    skillAdd('delving', 30);
    await UI.say(`The rubble clears itself away, stone by stone. The ${R.n} is yours again!`);
    if (room === 'crypt') await UI.say('Deep in the crypt, a sealed chest waits beside the old altar.');
    if (manorDone()){
      await UI.say(['As the last room settles, a raven drops a heavy ledger at your feet: THE DEED BOOK.',
        '★ The manor is whole! You can now BUY LAND all over the valley.',
        'Look for the yellow SALE posts — in town, by the lake, the graveyard, and deep in Murkwood. Each location grants its own power, and each can grow from camp to cottage to hall.']);
    }
    save();
  }

  async function placeFurniture(x, y){
    const list = World.map === 'manor' ? G.manor.furniture
      : World.houseId ? G.houses[World.houseId].furniture : null;
    if (!list) return;
    const i = list.findIndex(f => f.x === x && f.y === y);
    if (i >= 0){
      const f = list[i];
      if (await UI.confirm(`Put the ${ITEMS[f.id].n} back in your satchel?`)){
        list.splice(i, 1);
        Inv.add(f.id, 1);
      }
      return;
    }
    if (!UI.bagEntries(it => it.k === 'furn').length) return;
    if (World.houseId){
      const cap = PLOT_TIERS[plotTier(World.houseId)].furn;
      if (list.length >= cap) return UI.say(`This ${PLOT_TIERS[plotTier(World.houseId)].n.toLowerCase()} fits only ${cap} furnishings. Upgrade it for more.`);
    }
    const id = await UI.pickItem(it => it.k === 'furn', 'PLACE WHICH FURNISHING?');
    if (!id) return;
    Inv.take(id, 1);
    list.push({ id, x, y });
    UI.toast(`Placed the ${ITEMS[id].n}.`);
  }

  async function sleep(){
    if (!(await UI.confirm('Sleep until morning? You and your grims will fully recover.'))) return;
    G.time.day++; G.time.min = 6 * 60;
    G.flags.slept = true;
    healAll();
    save();
    await UI.say(`You dream of ${['endless staircases','a fish with your name','singing pumpkins','the moon, blinking','a polite skeleton'][rnd(5)]}... and wake refreshed. (${UI.moonPhase() === 2 ? 'The moon is FULL tonight.' : UI.moonPhase() === 0 ? 'The moon is NEW tonight.' : 'Day ' + G.time.day})`);
  }

  async function storage(){
    for(;;){
      const c = await UI.choice([`Deposit a grim (pack: ${G.party.length}/${Combat.minionCap()})`, `Withdraw a grim (box: ${G.storage.length})`, 'Close']);
      if (c === -1 || c === 2) return;
      if (c === 0){
        if (G.party.length <= 1){ await UI.say('You cannot deposit your last grim.'); continue; }
        const i = await UI.party('DEPOSIT WHICH GRIM?');
        if (i < 0) continue;
        const g = G.party.splice(i, 1)[0];
        G.storage.push(g);
        Combat.syncMinions();
        UI.toast(`${g.nick} curls up in the box.`);
      } else {
        if (!G.storage.length){ await UI.say('The box is empty.'); continue; }
        if (G.party.length >= Combat.minionCap()){ await UI.say(`Your pack is full (${Combat.minionCap()}). It grows with Necromancy.`); continue; }
        const i = await UI.panelList('WITHDRAW WHICH GRIM?', G.storage.map(g => ({
          spr: SPR.creature(g.sp), html: UI.grimRowHTML(g) })), { footer:'Z: select · X: back' });
        if (i < 0) continue;
        const g = G.storage.splice(i, 1)[0];
        G.party.push(g);
        Combat.syncMinions();
        UI.toast(`${g.nick} rejoins you.`);
      }
    }
  }

  async function cauldron(){
    const bl = skillLvl('brewing');
    const avail = BREWS.map(b => {
      const req = SKILL_REQ.brew[b.out] || 1;
      const have = Object.entries(b.ins).every(([k,n]) => Inv.count(k) >= n);
      const ins = Object.entries(b.ins).map(([k,n]) => `${n}× ${ITEMS[k].n} (${Inv.count(k)})`).join(' + ');
      return { b, req, have, html: bl < req
        ? `<b>???</b><br><span class="dim">Brewing Lv.${req} required</span>`
        : `<b>${ITEMS[b.out].n}</b><br><span class="dim">${ins}</span>`,
        dim: bl < req || !have };
    });
    const i = await UI.panelList(`CAULDRON — Brewing Lv.${bl}`, avail.map(a => ({ html:a.html, dim:a.dim })),
      { footer:'Z: brew · X: back' });
    if (i < 0) return;
    const a = avail[i];
    if (bl < a.req) return UI.say(`Your Brewing must reach Lv.${a.req} first.`);
    if (!a.have) return UI.say('You lack the ingredients. The farm provides.');
    Object.entries(a.b.ins).forEach(([k,n]) => Inv.take(k, n));
    let qty = 1;
    if (Math.random() < 0.02 * bl + 0.05 * plotTier('moontower')){ qty = 2; UI.toast('A perfect brew — double batch!'); }
    Inv.add(a.b.out, qty);
    skillAdd('brewing', 20 + (SKILL_REQ.brew[a.b.out] || 1) * 6);
    await UI.say(`The cauldron belches green smoke. You bottle ${qty}× ${ITEMS[a.b.out].n}.`);
  }

  async function altar(){
    if (G.flags.altarDay === G.time.day)
      return UI.say('The altar is quiet. It has given all it can today.');
    G.flags.altarDay = G.time.day;
    healAll();
    await UI.say('Cold light washes over you and your grims. All are fully restored.');
  }

  // ---------- DEEDS: buildable plots ----------
  async function plotMenu(id){
    const P = PLOTS[id];
    const owned = !!G.houses[id];
    const tier = plotTier(id);
    if (!manorDone() && !owned){
      return UI.say([`A weathered post: "FOR SALE — ${P.n}."`,
        'The Gravedigger spits: "Deed book\'s still buried in your manor\'s rubble, friend. Finish restoring ALL FOUR wings of Hollow Manor first."']);
    }
    for(;;){
      const opts = [];
      if (!owned) opts.push(`Buy land — ${P.land}⛁`);
      else if (tier < 3){
        const T = PLOT_TIERS[tier + 1];
        const costTxt = Object.entries(T.cost).map(([k,n]) => k === 'gold' ? `${n}⛁` : `${n} ${ITEMS[k].n}`).join(', ');
        opts.push(`Upgrade to ${T.n} — ${costTxt}`);
      }
      if (tier >= 1) opts.push('Enter house');
      opts.push('About this plot', 'Leave');
      const c = await UI.choice(opts);
      const pick = c < 0 ? 'Leave' : opts[c];
      if (pick === 'Leave' || c === -1) return;
      if (pick.startsWith('About')){
        await UI.say([`${P.n} — ${tier ? PLOT_TIERS[tier].n + ' (tier ' + tier + '/3)' : 'unclaimed land, ' + P.land + '⛁'}.`,
          `Location power: ${P.buff}`,
          tier ? `Furnishing slots: ${G.houses[id].furniture.length}/${PLOT_TIERS[tier].furn}.` :
          'Buy it to raise a camp, then upgrade to cottage and hall — bigger rooms, stronger power.']);
        continue;
      }
      if (pick.startsWith('Buy land')){
        if (G.gold < P.land){ await UI.say(`You need ${P.land}⛁. (You have ${G.gold}⛁)`); continue; }
        if (!(await UI.confirm(`Buy ${P.n} for ${P.land}⛁?`))) continue;
        G.gold -= P.land;
        G.houses[id] = { tier: 0, furniture: [] };
        // immediately offer the camp build
        await UI.say(`The land is yours! Now raise a ${PLOT_TIERS[1].n} on it.`);
        return plotMenu(id);
      }
      if (pick.startsWith('Upgrade')){
        const T = PLOT_TIERS[tier + 1];
        const needs = Object.entries(T.cost).filter(([k]) => k !== 'gold');
        const can = G.gold >= (T.cost.gold || 0) && needs.every(([k,n]) => Inv.count(k) >= n);
        if (!can){ await UI.say('You lack gold or materials. (The shop sells planks and stone; ectoplasm hides in the catacombs.)'); continue; }
        if (!(await UI.confirm(`Build the ${T.n}?`))) continue;
        G.gold -= T.cost.gold || 0;
        needs.forEach(([k,n]) => Inv.take(k, n));
        G.houses[id].tier = tier + 1;
        skillAdd('delving', 25 * (tier + 1));
        await UI.say([`Hammers you did not hire knock through the night... the ${T.n} stands!`,
          `Location power active: ${P.buff}`]);
        save();
        return;
      }
      if (pick === 'Enter house'){
        World.houseId = id;
        const rows = genHouse(plotTier(id));
        const dx = Math.floor(rows[0].length / 2);
        World.enter('house', dx, rows.length - 2);
        return;
      }
    }
  }
  // special-case tier-0 owned land: PLOTS with tier 0 need building before buffs/entry
  // (plotTier returns 0 for owned-but-unbuilt; tier 1 = camp)

  // ---------- catacombs ----------
  async function enterCata(){
    if (!(await UI.confirm('A cold draft rises from the dark. Descend into the catacombs?', 'The Hole'))) return;
    const start = 1 + 2 * plotTier('ossuary');
    World.cataFloor = start;
    World.cata = genCata(start);
    G.cata.maxFloor = Math.max(G.cata.maxFloor || 0, start);
    World.enter('cata', World.cata.start[0], World.cata.start[1]);
    UI.toast(`Catacombs B${start}${start > 1 ? ' (ossuary shortcut)' : ''} — fight to the stairs.`);
  }
  async function descend(){
    if (Combat.enemies().some(e => e.boss)){
      UI.toast('The guardian bars the stairs — slay or bind it first!');
      return;
    }
    const step = 1 + Math.floor(skillLvl('delving') / 5);
    World.cataFloor += step;
    World.cata = genCata(World.cataFloor);
    World.enter('cata', World.cata.start[0], World.cata.start[1]);
    G.cata.maxFloor = Math.max(G.cata.maxFloor || 0, World.cataFloor);
    skillAdd('delving', 15 + World.cataFloor * 2);
    UI.toast(`Catacombs B${World.cataFloor}${step > 1 ? ` (descended ${step} floors!)` : ''}`);
  }
  async function ascend(){
    if (World.cataFloor <= 1 + 2 * plotTier('ossuary')){
      World.cata = null;
      World.enter('town', 4, 7);
      UI.toast('You climb back into the gloomy daylight.');
      return;
    }
    World.cataFloor--;
    World.cata = genCata(World.cataFloor);
    World.enter('cata', World.cata.far[0], World.cata.far[1]);
    UI.toast(`Catacombs B${World.cataFloor}`);
  }

  async function chest(x, y){
    if (World.map === 'cata'){
      World.cata.opened = World.cata.opened || {};
      if (World.cata.opened[`${x},${y}`]) return UI.say('Empty. Someone — probably you — got here first.');
      World.cata.opened[`${x},${y}`] = true;
      const f = World.cataFloor, dl = skillLvl('delving');
      const gold = Math.floor((30 + f * 15) * (1 + 0.03 * dl) * (1 + gearAffix('gold')/100) * (0.8 + Math.random() * 0.5));
      G.gold += gold;
      skillAdd('delving', 12);
      if (Math.random() < 0.30){
        const gear = rollGear(Combat.zoneLevel('cata'));
        if (G.gear.bag.length < 60){ G.gear.bag.push(gear);
          return UI.say(`The chest creaks open: ${gold}⛁ and ${RARITIES[gear.rar].n} gear — ${gear.name}!`); }
      }
      const lootPool = [
        ['ecto', 1], ['stone', 2], ['plank', 2], ['tonic', 1], ['jar', 2],
        f >= 5 ? ['gjar', 1] : ['worm', 3],
        f >= 8 ? ['bigtonic', 1] : ['bloodberry', 2],
        f >= 12 ? ['ajar', 1] : ['stone', 1],
        f >= 15 ? ['seed_mystery', 1] : ['glowbait', 2],
      ];
      const [item, n] = lootPool[rnd(lootPool.length)];
      Inv.add(item, n);
      return UI.say(`The chest creaks open: ${gold}⛁ and ${n}× ${ITEMS[item].n}!`);
    }
    const key = `${World.map}:${x},${y}`;
    if (G.flags.chests[key]) return UI.say('The chest is empty.');
    G.flags.chests[key] = true;
    if (World.map === 'woods'){
      G.gold += 250; Inv.add('gjar', 2); Inv.add('ecto', 1);
      return UI.say('Inside: 250⛁, 2× Greater Jar, and a wobbling lump of Ectoplasm!');
    }
    if (World.map === 'manor'){
      G.gold += 1000; Inv.add('ajar', 2); Inv.add('seed_mystery', 1);
      return UI.say('The sealed chest sighs open: 1000⛁, 2× Ancient Jar, and a Mystery Seed!');
    }
  }

  // ---------- the Soul Ladder (real-time duels) ----------
  let duel = null; // {kind:'ladder'|'woods', rank, name}
  async function arena(){
    const rank = G.arena.rank;
    for(;;){
      const c = await UI.choice([`Duel — Soul Ladder Rank ${rank}`, 'View the Ladder', 'How it works', 'Leave']);
      if (c === 3 || c === -1) return;
      if (c === 2){
        await UI.say(['"Every necromancer in the valley duels on the Soul Ladder," Grell rumbles.',
          '"You, your pack, your staff — against theirs. Strike the RIVAL down and the rest scatter."',
          '"Beat the rank above you, take their place. There is no top. There is only UP."'], 'Master Grell');
        continue;
      }
      if (c === 1){
        if (G.tut) G.tut.arenaSeen = true;
        const rows = [];
        for (let i = 3; i >= -2; i--){
          const r = rank + i;
          if (r < 1) continue;
          if (i === 0) rows.push({ html:`<b>Rank ${r} — YOU (${G.name})</b> <span class="dim">${G.arena.wins} wins</span>` });
          else rows.push({ html:`Rank ${r} — ${RIVAL_NAMES[(r * 7) % RIVAL_NAMES.length]} <span class="dim">the ${RIVAL_TITLES[(r * 3) % RIVAL_TITLES.length]}</span>`, dim: i > 0 });
        }
        await UI.panelList('THE SOUL LADDER', rows, { footer:'The ladder has no top rung.' });
        continue;
      }
      // start the duel
      const name = `${RIVAL_NAMES[rnd(RIVAL_NAMES.length)]} the ${RIVAL_TITLES[rnd(RIVAL_TITLES.length)]}`;
      duel = { kind:'ladder', rank, name };
      await UI.say(`"Rank ${rank}. Your opponent: ${name}. To the pit!"`, 'Master Grell');
      World.enter('arena', 8, 8);
      Combat.spawnRivalPack(duel, rank);
      UI.toast(`DUEL: strike down ${name}! (door = forfeit)`);
      return;
    }
  }
  function arenaExit(){
    if (duel && duel.kind === 'ladder') UI.toast('You forfeit the duel.');
    duel = null;
    Combat.clearHostiles();
    World.enter('town', 24, 15);
  }
  async function rivalDefeated(riv){
    if (riv.kind === 'ladder'){
      const gold = 120 + riv.rank * 60;
      G.gold += gold;
      G.arena.rank++;
      G.arena.wins++;
      skillAdd('necromancy', 40 + riv.rank * 5);
      duel = null;
      await UI.say([`${riv.name} bows, defeated, and their pack scatters to dust.`,
        `Purse: +${gold}⛁ · You are now Rank ${G.arena.rank}.`], 'Master Grell');
      Combat.clearHostiles();
      World.enter('town', 24, 15);
      save();
    } else {
      const gold = riv.gold || 150;
      G.gold += gold;
      skillAdd('necromancy', 30);
      UI.toast(`${riv.name} flees into the trees, dropping ${gold}⛁!`);
    }
  }

  async function woodsDuel(){
    const avg = Math.max(2, Math.round(G.party.reduce((s,g) => s + g.lvl, 0) / Math.max(1, G.party.length)));
    const rank = Math.max(1, Math.floor(avg / 2));
    const name = `${RIVAL_NAMES[rnd(RIVAL_NAMES.length)]} the ${RIVAL_TITLES[rnd(RIVAL_TITLES.length)]}`;
    await UI.say(`"Oi! These are MY hunting grounds," snarls ${name}. "Have at you!"`, name);
    G.flags.woodsRivalDay = G.time.day;
    Combat.spawnRivalPack({ kind:'woods', rank, name, gold: 80 + avg * 12 }, rank);
  }

  // ---------- gear ----------
  function gearHTML(g, equipped){
    const affTxt = Object.entries(g.aff).map(([k,v]) => AFFIXES[k].n.replace('#', v)).join(' · ');
    return `<b style="color:${RARITIES[g.rar].col}">${g.name}</b> <span class="tag">${g.slot}</span>${equipped ? ' <span class="tag" style="color:#6dd86d">WORN</span>' : ''}<br><span class="dim">${affTxt}</span>`;
  }
  async function gearMenu(){
    for(;;){
      const rows = [];
      const eq = [];
      for (const s of ['staff','robe','charm']){
        const g = G.gear.equip[s];
        rows.push(g ? { html: gearHTML(g, true) } : { html:`<span class="dim">— empty ${s} slot —</span>`, dim:true });
        eq.push(g);
      }
      const bag = G.gear.bag;
      for (const g of bag) rows.push({ html: gearHTML(g, false) });
      const i = await UI.panelList(`GEAR — ${bag.length}/60 in bag`, rows,
        { footer:'Z on bag gear: equip/salvage · Z on worn gear: unequip · X: back' });
      if (i < 0) return;
      if (i < 3){
        const slot = ['staff','robe','charm'][i];
        const g = G.gear.equip[slot];
        if (!g) continue;
        if (bag.length >= 60){ UI.toast('Gear bag full.'); continue; }
        G.gear.equip[slot] = null;
        bag.push(g);
        UI.toast(`Unequipped ${g.name}.`);
        continue;
      }
      const g = bag[i - 3];
      const a = await UI.choice(['Equip', `Salvage (+${30 + g.lvl * 8 + g.rar * 60}⛁)`, 'Back']);
      if (a === 0){
        const old = G.gear.equip[g.slot];
        G.gear.equip[g.slot] = g;
        bag.splice(i - 3, 1);
        if (old) bag.push(old);
        UI.toast(`Equipped ${g.name}.`);
        G.pc.hp = Math.min(G.pc.hp, Combat.pstats().maxhp);
      } else if (a === 1){
        G.gold += 30 + g.lvl * 8 + g.rar * 60;
        bag.splice(i - 3, 1);
        UI.toast(`Salvaged ${g.name}.`);
      }
    }
  }

  async function deedsMenu(){
    const rows = Object.entries(PLOTS).map(([id, p]) => {
      const t = plotTier(id);
      const owned = !!G.houses[id];
      return { html:`<b>${p.n}</b> <span class="tag">${p.map}</span> ${t ? `<span class="tag" style="color:#6dd86d">${PLOT_TIERS[t].n}</span>` : owned ? '<span class="tag">land only</span>' : `<span class="dim">${p.land}⛁</span>`}<br><span class="dim">${p.buff}</span>`,
        dim: !owned };
    });
    await UI.panelList(manorDone() ? 'THE DEED BOOK' : 'THE DEED BOOK (sealed — finish your manor!)', rows,
      { footer:'Visit a SALE post in the world to buy and build.' });
  }

  // ---------- shop ----------
  const SHOP_STOCK = ['jar','gjar','ajar','tonic','bigtonic','fulltonic','cleanse','revive','graverune',
    'seed_blood','seed_grave','seed_moon','seed_pumpkid','seed_mandrake','seed_mystery',
    'worm','glowbait','voidbait','bonerod','abyssrod','plank','stone','ecto',
    'f_chair','f_table','f_rug','f_candle','f_shelf','f_mirror','f_clock','f_gargoyle','f_throne','f_banner','f_plant'];
  function buyPrice(id){ return Math.ceil(ITEMS[id].price * (1 - 0.05 * plotTier('townhouse'))); }

  async function shop(){
    for(;;){
      const c = await UI.choice(['Buy', 'Sell', 'Forge gear (3 ore)', 'Leave']);
      if (c === 3 || c === -1) return;
      if (c === 2){
        for(;;){
          const i = await UI.panelList(`THE FORGE — Odd hammers ore into gear`, FORGE.map(f => ({
            html:`<b>${f.n}</b> — 3× ${ITEMS[f.ore].n} (have ${Inv.count(f.ore)}) + ${f.gold}⛁`,
            dim: Inv.count(f.ore) < 3 || G.gold < f.gold,
          })), { footer:'Z: forge · X: back · result is random gear of that level' });
          if (i < 0) break;
          const f = FORGE[i];
          if (Inv.count(f.ore) < 3 || G.gold < f.gold){ UI.toast('Not enough ore or gold.'); continue; }
          if (G.gear.bag.length >= 60){ UI.toast('Gear bag full!'); continue; }
          Inv.take(f.ore, 3);
          G.gold -= f.gold;
          const g = rollGear(f.lvl);
          G.gear.bag.push(g);
          skillAdd('gathering', 15);
          await UI.say(`Odd hammers, quenches, mutters... ${RARITIES[g.rar].n.toUpperCase()}: ${g.name}! (in your gear bag)`);
        }
        continue;
      }
      if (c === 0){
        for(;;){
          const stock = SHOP_STOCK.filter(id => !(ITEMS[id].k === 'rod' && Inv.count(id) > 0));
          const i = await UI.panelList(`SHOPKEEP ODD — your gold: ${G.gold}⛁${plotTier('townhouse') ? ` (townhouse discount ${5*plotTier('townhouse')}%)` : ''}`, stock.map(id => ({
            html:`<b>${ITEMS[id].n}</b> — ${buyPrice(id)}⛁ <span class="dim">(have ${Inv.count(id)})</span><br><span class="dim">${ITEMS[id].d || ''}</span>`,
            dim: G.gold < buyPrice(id),
          })), { footer:'Z: buy one · X: back' });
          if (i < 0) break;
          const id = stock[i];
          if (G.gold < buyPrice(id)){ UI.toast('Not enough gold.'); continue; }
          G.gold -= buyPrice(id);
          Inv.add(id, 1);
          UI.toast(`Bought ${ITEMS[id].n}.`);
          UI.hud();
        }
      } else {
        for(;;){
          const es = UI.bagEntries(it => it.price > 0 && it.k !== 'rod');
          const i = await UI.panelList(`SELL — your gold: ${G.gold}⛁`, es.map(e => ({
            html:`<b>${ITEMS[e.id].n}</b> ×${e.n} — sells for ${Math.floor(ITEMS[e.id].price/2)}⛁ each`,
          })), { footer:'Z: sell one · X: back' });
          if (i < 0) break;
          const id = es[i].id;
          Inv.take(id, 1);
          G.gold += Math.floor(ITEMS[id].price / 2);
          UI.toast(`Sold ${ITEMS[id].n}.`);
          UI.hud();
        }
      }
    }
  }

  // ---------- npc talk ----------
  async function witch(){
    const c = await UI.choice(['Heal us, please', 'Any advice?', 'Goodbye']);
    if (c === 0){
      healAll();
      await UI.say('Morwen mutters over you and your jars. All of you are fully restored, dear.', 'Witch Morwen');
      save();
    } else if (c === 1){
      const tips = [
        `Your bound grims fight BESIDE you now, dear. Weaken a wild one below a third (watch for the jar mark) and use ${KEYN.jar} to bind it.`,
        `${KEYN.bolt} hurls a hex bolt — it costs Soul, which returns with time. Your staff (${KEYN.a}) costs nothing but courage.`,
        'Monster seeds grow into grims! And your Farming level decides how strong they hatch.',
        'Some fish bite only at night, the rarest under a NEW or FULL moon. Sleep in a bed to pass the days.',
        'Finish restoring ALL of Hollow Manor and the deed book is yours — then every SALE post in the valley can become a home with its own power.',
        'Gear drops from the dead. Staves, robes, charms — eldritch ones carry three blessings.',
        'The Soul Ladder has no top. The catacombs have no bottom. The valley tests how far you will go in both directions.',
      ];
      await UI.say(tips[rnd(tips.length)], 'Witch Morwen');
    }
  }
  function eliPrice(id){ return Math.round(ITEMS[id].price * (1 + 0.10 * plotTier('shore'))); }
  async function fisherTalk(){
    if (!G.flags.metEli){
      G.flags.metEli = true;
      Inv.add('oldrod', 1); Inv.add('worm', 5);
      return UI.say(['"New blood! The lake\'s full of drowned things that bite."',
        '"Here — my old rod and some grubs. Face the water, press the button, and WAIT. Patience is the whole sport."',
        '"Ignore the nibbles. When the bobber PLUNGES — strike! Then HOLD ON and keep the brute in the green while you reel."',
        '"Whatever you land: keep it and I\'ll BUY it at full price, RENDER it into useful stuff... or jar it for your pack."'], 'Fisher Eli');
    }
    for(;;){
      const c = await UI.choice(['Sell my catch', 'Render a catch', 'Any advice?', 'Goodbye']);
      if (c === -1 || c === 3) return;
      if (c === 0){
        for(;;){
          const es = UI.bagEntries(it => it.k === 'fish');
          const i = await UI.panelList(`ELI BUYS — your gold: ${G.gold}⛁${plotTier('shore') ? ` (shore cottage +${10*plotTier('shore')}%)` : ''}`,
            es.map(e => ({ html:`<b>${ITEMS[e.id].n}</b> ×${e.n} — Eli pays ${eliPrice(e.id)}⛁ each` })),
            { footer: es.length ? 'Z: sell one · X: back' : 'Catch something first!' });
          if (i < 0) break;
          const id = es[i].id;
          Inv.take(id, 1);
          G.gold += eliPrice(id);
          UI.toast(`Sold ${ITEMS[id].n} for ${eliPrice(id)}⛁.`);
          UI.hud();
        }
      } else if (c === 1){
        for(;;){
          const es = UI.bagEntries(it => it.k === 'fish');
          const i = await UI.panelList('RENDER A CATCH INTO RESOURCES', es.map(e => ({
            html:`<b>${ITEMS[e.id].n}</b> ×${e.n} → ${Object.entries(FISH_YIELD[e.id] || {}).map(([k,n]) => `${n}× ${ITEMS[k].n}`).join(' + ')}`,
          })), { footer: es.length ? 'Z: render one · X: back' : 'Catch something first!' });
          if (i < 0) break;
          const id = es[i].id;
          Inv.take(id, 1);
          const out = Object.entries(FISH_YIELD[id] || {});
          out.forEach(([k, n]) => Inv.add(k, n));
          skillAdd('fishing', 5);
          UI.toast(`Rendered: ${out.map(([k,n]) => `${n}× ${ITEMS[k].n}`).join(', ')}.`);
        }
      } else if (c === 2){
        const tips = [
          '"Phantfin only rise at night. Lanternjaw? New moon, Bone Rod or better."',
          '"They whisper of the MOONSCALE — full moon, Abyss Rod, Fishing 15. Worth 600 coin... or two lumps of ectoplasm."',
          '"A Lakeside Pier of your own makes the rare ones bite. A Shore Cottage makes me pay better."',
          '"Phantfin render into ectoplasm — cheaper than the shop ever sells it. Builders fish, friend."',
        ];
        await UI.say(tips[rnd(tips.length)], 'Fisher Eli');
      }
    }
  }
  async function diggerTalk(){
    if (!G.flags.metDigger){
      G.flags.metDigger = true;
      Inv.add('graverune', 2);
      return UI.say(['"That hole? Goes down forever, far as I ever dug."',
        '"Take these Grave Runes — use one from your satchel to climb out in a pinch."',
        '"Every fifth floor something big guards the stairs. Slay it... or jar it, if you\'ve the nerve."'], 'Gravedigger');
    }
    return UI.say(`"Deepest you've gone is floor ${G.cata.maxFloor || 0}. The dark remembers."`, 'Gravedigger');
  }

  // ---------- pause menu ----------
  async function pauseMenu(){
    if (G.tut) G.tut.menuOpened = true;
    for(;;){
      const base = ['Pack', 'Satchel', 'Gear', 'Skills', 'Deeds', 'Grimdex', 'Save'];
      const opts = Tutorial.active() ? base.concat(['Skip tutorial', 'Close']) : base.concat(['Close']);
      const c = await UI.choice(opts);
      const pick = c < 0 ? 'Close' : opts[c];
      if (pick === 'Close') return;
      if (pick === 'Skip tutorial'){
        if (await UI.confirm('Skip the rest of the tutorial? Morwen will stop guiding you.')) Tutorial.skip();
        continue;
      }
      if (pick === 'Pack'){
        for(;;){
          const i = await UI.party('YOUR PACK');
          if (i < 0) break;
          const g = G.party[i];
          const a = await UI.choice(['Summary', 'Rename', 'Back']);
          if (a === 0) await UI.grimSummary(g);
          else if (a === 1){
            const nm = prompt('New nickname:', g.nick);
            if (nm && nm.trim()) g.nick = nm.trim().slice(0, 14);
          }
        }
      } else if (pick === 'Satchel'){
        for(;;){
          const id = await UI.pickItem(null);
          if (!id) break;
          const it = ITEMS[id];
          if (['heal','revive','cure'].includes(it.k)){
            const who = await UI.choice(['Use on myself', 'Use on a grim', 'Back']);
            if (who === 0){
              const ps = Combat.pstats();
              if (it.k === 'heal' && G.pc.hp < ps.maxhp){
                Inv.take(id, 1);
                G.pc.hp = Math.min(ps.maxhp, G.pc.hp + it.amt);
                UI.toast(`You recover ${it.amt} life.`);
              } else UI.toast('No effect.');
            } else if (who === 1){
              const ti = await UI.party('USE ON WHICH GRIM?');
              if (ti < 0) continue;
              const msg = useItemOn(id, G.party[ti]);
              if (msg){ Inv.take(id, 1); delete G.party[ti].downT; Combat.syncMinions(); UI.toast(msg); }
              else UI.toast('It would have no effect.');
            }
          }
          else if (it.k === 'charm'){
            if (World.map === 'cata'){
              Inv.take(id, 1);
              World.cata = null;
              World.enter('town', 4, 7);
              UI.toast('The rune yanks you up through the dark!');
              return;
            }
            UI.toast('It only works in the catacombs.');
          }
          else if (it.k === 'seed') UI.toast('Plant it at a soil plot (face it, press Z).');
          else if (it.k === 'furn') UI.toast('Place it on a free floor tile in any of your houses.');
          else if (it.k === 'rod') UI.toast('Face water and press Z to fish.');
          else UI.toast(it.d || '...');
        }
      } else if (pick === 'Gear') await gearMenu();
      else if (pick === 'Skills'){
        await UI.panelList('SKILLS', Object.entries(SKILLS).map(([k, s]) => {
          const lvl = skillLvl(k), xp = G.skills[k] || 0;
          const cur = skillXpFor(lvl), next = skillXpFor(lvl + 1);
          const pct = Math.min(100, Math.round((xp - cur) / (next - cur) * 100));
          return { html:`<b style="color:${s.col}">${s.icon} ${s.n} — Lv.${lvl}</b> <span class="dim">${xp - cur}/${next - cur} xp (${pct}%)</span><br><span class="dim">${s.d}</span>` };
        }), { footer:'Skills have NO level cap. Everything scales forever.' });
      } else if (pick === 'Deeds') await deedsMenu();
      else if (pick === 'Grimdex'){
        const keys = Object.keys(DEX);
        const caught = keys.filter(k => G.dex[k] === 2).length;
        await UI.panelList(`GRIMDEX — ${caught}/${keys.length} bound`, keys.map(k => {
          const st = G.dex[k] || 0;
          if (!st) return { html:`<span class="dim">??? — unseen</span>`, dim:true };
          return { spr: SPR.creature(k),
            html:`<b>${DEX[k].n}</b> ${st === 2 ? '<span class="tag" style="color:#6dd86d">BOUND</span>' : '<span class="tag">seen</span>'}<br><span class="dim">${st === 2 ? DEX[k].desc : '...'}</span>` };
        }), { footer:'Bind them all... if the valley lets you.' });
      } else if (pick === 'Save'){
        save();
        UI.toast('Game saved.');
      }
    }
  }

  // ---------- save / load ----------
  const SAVE_KEY = 'grimvale_save_v2';
  function save(){
    if (!G.started) return;
    const pos = (World.map === 'cata' || World.map === 'arena' || World.map === 'house')
      ? { map:'town', x:17, y:8 } : { map:World.map, x:World.px, y:World.py };
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...G, pos }));
  }
  function load(){
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  return { skillLvl, skillAdd, afterLoss, healAll, cropStage, plot, fish, fishingFx, gather,
    restore, placeFurniture, sleep, storage, cauldron, altar, manorDone,
    enterCata, descend, ascend, chest, arena, arenaExit, rivalDefeated, woodsDuel,
    plotMenu, deedsMenu, gearMenu,
    shop, witch, fisherTalk, diggerTalk, pauseMenu, save, load };
})();

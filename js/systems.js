// ============================================================
// GRIMVALE — systems: skills, farming, fishing, housing,
// catacombs, the Soul Ladder arena, shop, menus, save/load.
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

  // ---------- encounters & loss ----------
  async function afterLoss(){
    await UI.say(['Everything went dark...',
      'You wake in your own bed at Hollow Manor. Witch Morwen must have dragged you home — and helped herself to some coin for the trouble.']);
    G.gold = Math.max(0, G.gold - Math.ceil(G.gold * 0.1));
    for (const g of G.party){ g.hp = statsFor(g.sp, g.lvl).maxhp; g.status = null; }
    World.cata = null;
    World.enter('manor', 10, 9);
    save();
  }

  async function wildEncounter(zone){
    let pool = ENCOUNTERS[zone].filter(e => !e.night || UI.isNight());
    const e = pickW(pool);
    let lvl;
    if (zone === 'cata'){
      lvl = 3 + World.cataFloor * 2 + rnd(3);
    } else {
      lvl = e.min + rnd(e.max - e.min + 1) + Math.floor((skillLvl('necromancy') - 1) * 0.7);
    }
    const r = await Battle.start({ eParty:[makeGrim(e.sp, lvl)], canCatch:true, canRun:true });
    if (r.wiped) await afterLoss();
  }

  // ---------- farming ----------
  function growMult(map){
    let m = 1 + 0.02 * (skillLvl('farming') - 1);
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
        // watering rebases progress so growth already made is kept
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
      if (G.party.length < 6) G.party.push(g);
      else { G.storage.push(g); await UI.say('Your party is full — it was sent to the storage box.'); }
    }
  }

  // ---------- fishing ----------
  function fishGame(zonePct){
    return new Promise(res => {
      const box = $('fishing'), zone = $('fish-zone'), marker = $('fish-marker');
      box.classList.remove('hidden');
      const zoneW = zonePct, zoneX = 5 + Math.random() * (90 - zoneW);
      zone.style.left = zoneX + '%'; zone.style.width = zoneW + '%';
      let t = Math.random() * 6, done = false, raf;
      const speed = 2.4 + Math.random() * 1.2;
      function frame(ts){
        t += 0.016 * speed;
        const pos = (Math.sin(t) + 1) / 2 * 95;
        marker.style.left = pos + '%';
        if (!done) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      const h = k => {
        if (k !== 'ok' && k !== 'no') return;
        done = true;
        cancelAnimationFrame(raf);
        Input.pop(h);
        box.classList.add('hidden');
        if (k === 'no') return res(false);
        const pos = parseFloat(marker.style.left);
        res(pos >= zoneX && pos <= zoneX + zoneW + 2);
      };
      Input.push(h);
    });
  }

  async function fish(){
    let rod = Inv.bestRod();
    if (!rod) return UI.say('The water churns hungrily, but you have no rod. Fisher Eli by the lake might help.');
    const fl = skillLvl('fishing');
    const allowed = fl >= (SKILL_REQ.rod[3]) ? 3 : fl >= SKILL_REQ.rod[2] ? 2 : 1;
    if (rod > allowed){
      UI.toast(`Fishing Lv.${SKILL_REQ.rod[rod]} needed for that rod — using a lesser one.`);
      rod = allowed;
    }
    const bait = Inv.bestBait();
    if (bait) Inv.take(bait, 1);
    const moon = UI.moonPhase(); // 0 new, 2 full
    let pool = FISH_TABLE.filter(e =>
      e.rod <= rod &&
      (!e.night || UI.isNight()) &&
      (!e.moon || (e.moon === 'new' && moon === 0) || (e.moon === 'full' && moon === 2)));
    pool = pool.map(e => ({ ...e, w: e.w * (e.rod > 1 && bait ? 1 + ITEMS[bait].tier : 1) }));
    const zonePct = Math.min(45, 16 + fl * 1.1 + rod * 2);
    const hit = await fishGame(zonePct);
    if (!hit){
      skillAdd('fishing', 3);
      return UI.say('The line snaps back, empty. Something laughs beneath the surface.');
    }
    const e = pickW(pool);
    const lvl = e.min + rnd(e.max - e.min + 1) + Math.floor(fl / 2);
    skillAdd('fishing', 12 + lvl + (DEX[e.sp].rare ? 50 : 0));
    const r = await Battle.start({ eParty:[makeGrim(e.sp, lvl)], canCatch:true, canRun:true,
      intro:`You hooked a ${DEX[e.sp].n}${DEX[e.sp].rare ? ' — a legend of the deep!' : '!'}` });
    if (r.win) skillAdd('fishing', 10 + lvl);
    if (r.wiped) await afterLoss();
  }

  // ---------- housing ----------
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
    save();
  }

  async function placeFurniture(x, y){
    if (World.map !== 'manor') return;
    const i = G.manor.furniture.findIndex(f => f.x === x && f.y === y);
    if (i >= 0){
      const f = G.manor.furniture[i];
      if (await UI.confirm(`Put the ${ITEMS[f.id].n} back in your satchel?`)){
        G.manor.furniture.splice(i, 1);
        Inv.add(f.id, 1);
      }
      return;
    }
    if (!UI.bagEntries(it => it.k === 'furn').length) return;
    const id = await UI.pickItem(it => it.k === 'furn', 'PLACE WHICH FURNISHING?');
    if (!id) return;
    Inv.take(id, 1);
    G.manor.furniture.push({ id, x, y });
    UI.toast(`Placed the ${ITEMS[id].n}.`);
  }

  async function sleep(){
    if (!(await UI.confirm('Sleep until morning? Your grims will fully recover.'))) return;
    G.time.day++; G.time.min = 6 * 60;
    for (const g of G.party){ g.hp = statsFor(g.sp, g.lvl).maxhp; g.status = null;
      for (const m of g.moves) m.pp = MOVES[m.id].pp; }
    save();
    await UI.say(`You dream of ${['endless staircases','a fish with your name','singing pumpkins','the moon, blinking','a polite skeleton'][rnd(5)]}... and wake refreshed. (${UI.moonPhase() === 2 ? 'The moon is FULL tonight.' : UI.moonPhase() === 0 ? 'The moon is NEW tonight.' : 'Day ' + G.time.day})`);
  }

  async function storage(){
    for(;;){
      const c = await UI.choice([`Deposit a grim (party: ${G.party.length})`, `Withdraw a grim (box: ${G.storage.length})`, 'Close']);
      if (c <= -1 || c === 2) return;
      if (c === 0){
        if (G.party.length <= 1){ await UI.say('You cannot deposit your last grim.'); continue; }
        const i = await UI.party('DEPOSIT WHICH GRIM?');
        if (i < 0) continue;
        const g = G.party.splice(i, 1)[0];
        G.storage.push(g);
        UI.toast(`${g.nick} curls up in the box.`);
      } else {
        if (!G.storage.length){ await UI.say('The box is empty.'); continue; }
        if (G.party.length >= 6){ await UI.say('Your party is full (6).'); continue; }
        const i = await UI.panelList('WITHDRAW WHICH GRIM?', G.storage.map(g => ({
          spr: SPR.creature(g.sp), html: UI.grimRowHTML(g) })), { footer:'Z: select · X: back' });
        if (i < 0) continue;
        const g = G.storage.splice(i, 1)[0];
        G.party.push(g);
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
    if (Math.random() < 0.02 * bl){ qty = 2; UI.toast('A perfect brew — double batch!'); }
    Inv.add(a.b.out, qty);
    skillAdd('brewing', 20 + (SKILL_REQ.brew[a.b.out] || 1) * 6);
    await UI.say(`The cauldron belches green smoke. You bottle ${qty}× ${ITEMS[a.b.out].n}.`);
  }

  async function altar(){
    if (G.flags.altarDay === G.time.day)
      return UI.say('The altar is quiet. It has given all it can today.');
    G.flags.altarDay = G.time.day;
    for (const g of G.party){ g.hp = statsFor(g.sp, g.lvl).maxhp; g.status = null; }
    await UI.say('Cold light washes over your grims. They are fully restored.');
  }

  // ---------- catacombs ----------
  async function enterCata(){
    if (!(await UI.confirm('A cold draft rises from the dark. Descend into the catacombs?', 'The Hole'))) return;
    World.cataFloor = 1;
    World.cata = genCata(1);
    G.cata.maxFloor = Math.max(G.cata.maxFloor || 0, 1);
    World.enter('cata', World.cata.start[0], World.cata.start[1]);
    UI.toast('Catacombs B1 — Z on stairs to climb out.');
  }
  async function descend(){
    if (World.cata.boss && !World.cata.bossDown) return cataBoss();
    const step = 1 + Math.floor(skillLvl('delving') / 5);
    World.cataFloor += step;
    World.cata = genCata(World.cataFloor);
    World.enter('cata', World.cata.start[0], World.cata.start[1]);
    G.cata.maxFloor = Math.max(G.cata.maxFloor || 0, World.cataFloor);
    skillAdd('delving', 15 + World.cataFloor * 2);
    UI.toast(`Catacombs B${World.cataFloor}${step > 1 ? ` (descended ${step} floors!)` : ''}`);
  }
  async function ascend(){
    if (World.cataFloor <= 1){
      World.cata = null;
      World.enter('town', 4, 7);
      UI.toast('You climb back into the gloomy daylight.');
      return;
    }
    World.cataFloor--;
    World.cata = genCata(World.cataFloor);
    World.enter('cata', World.cata.far[0], World.cata.far[1]);
    // stand on 'd'? move off stairs to avoid instant re-descend
    World.cata.rows[World.cata.far[1]] = World.cata.rows[World.cata.far[1]]; // keep
    UI.toast(`Catacombs B${World.cataFloor}`);
  }

  async function chest(x, y){
    if (World.map === 'cata'){
      World.cata.opened = World.cata.opened || {};
      if (World.cata.opened[`${x},${y}`]) return UI.say('Empty. Someone — probably you — got here first.');
      World.cata.opened[`${x},${y}`] = true;
      const f = World.cataFloor, dl = skillLvl('delving');
      const gold = Math.floor((30 + f * 15) * (1 + 0.03 * dl) * (0.8 + Math.random() * 0.5));
      G.gold += gold;
      skillAdd('delving', 12);
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
    if (World.map === 'manor'){ // crypt reward chest
      G.gold += 1000; Inv.add('ajar', 2); Inv.add('seed_mystery', 1);
      return UI.say('The sealed chest sighs open: 1000⛁, 2× Ancient Jar, and a Mystery Seed!');
    }
  }

  const BOSS_LADDER = ['gravehound','mycolossus','nocturnyx','cryptlord','hollowking'];
  async function cataBoss(){
    const f = World.cataFloor;
    const idx = Math.min(BOSS_LADDER.length - 1, Math.floor(f / 5) - 1);
    const sp = f % 25 === 0 ? 'hollowking' : BOSS_LADDER[idx % BOSS_LADDER.length];
    const lvl = 6 + f * 2 + rnd(3);
    await UI.say(`Something vast unfolds from the shadows guarding the stairs... a ${DEX[sp].n} (Lv.${lvl})!`);
    const r = await Battle.start({ eParty:[makeGrim(sp, lvl)], canCatch:true, canRun:false,
      intro:`The ${DEX[sp].n} bars your way!` });
    if (r.wiped) return afterLoss();
    if (r.win){
      World.cata.bossDown = true;
      const gold = 100 + f * 25;
      G.gold += gold;
      skillAdd('delving', 40 + f * 3);
      skillAdd('necromancy', 30 + f * 2);
      await UI.say(`The guardian dissolves into grave-dust. You claim ${gold}⛁. The stairs lie open.`);
      if (sp === 'hollowking' && !G.flags.kingFallen){
        G.flags.kingFallen = true;
        await UI.say(['The Hollow King\'s crown rolls to your feet, then crumbles.',
          'The catacombs rumble approvingly. They go deeper. They always go deeper...',
          '★ You have conquered floor 25 — but the descent is ENDLESS. How deep can you go?']);
      }
      save();
    }
  }

  // ---------- arena: the Soul Ladder ----------
  function genRival(rank){
    const name = RIVAL_NAMES[rnd(RIVAL_NAMES.length)];
    const title = RIVAL_TITLES[rnd(RIVAL_TITLES.length)];
    const size = Math.min(6, 1 + Math.ceil(rank / 2));
    const lvl = Math.max(3, 4 + Math.floor(rank * 2.2));
    const party = [];
    for (let i = 0; i < size; i++)
      party.push(makeGrim(RIVAL_POOL[rnd(RIVAL_POOL.length)], Math.max(2, lvl - 1 + rnd(3))));
    return { name: `${name} the ${title}`, party };
  }

  async function arena(){
    const rank = G.arena.rank;
    for(;;){
      const c = await UI.choice([`Duel — Soul Ladder Rank ${rank}`, 'View the Ladder', 'How it works', 'Leave']);
      if (c <= 0 && c !== 0) return;
      if (c === 3 || c === -1) return;
      if (c === 2){
        await UI.say(['"Every necromancer in the valley duels on the Soul Ladder," Grell rumbles.',
          '"Beat the rank above you, take their place. There is no top. There is only UP."',
          '"Your grims keep their wounds — brew tonics, or sleep before you climb."'], 'Master Grell');
        continue;
      }
      if (c === 1){
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
      // duel
      const rival = genRival(rank);
      await UI.say(`"Rank ${rank}. Your opponent: ${rival.name}. Begin!"`, 'Master Grell');
      const r = await Battle.start({ eParty: rival.party, trainer: rival.name, canCatch:false, canRun:false });
      if (r.wiped) return afterLoss();
      if (r.noFight) return;
      if (r.win){
        const gold = 120 + rank * 60;
        G.gold += gold;
        G.arena.rank++;
        G.arena.wins++;
        skillAdd('necromancy', 40 + rank * 5);
        await UI.say([`${rival.name} bows, defeated. You take their rung.`,
          `Purse: +${gold}⛁ · You are now Rank ${G.arena.rank}.`], 'Master Grell');
        save();
      } else {
        await UI.say('"Hah! The Ladder keeps what it catches. Come back stronger."', 'Master Grell');
      }
      return;
    }
  }

  async function woodsDuel(){
    const avg = Math.round(G.party.reduce((s,g) => s + g.lvl, 0) / G.party.length);
    const rival = genRival(Math.max(1, Math.floor(avg / 2)));
    await UI.say(`"Oi! These are MY hunting grounds," snarls ${rival.name}. "Duel me for them!"`, rival.name);
    const r = await Battle.start({ eParty: rival.party.slice(0, 2 + rnd(2)), trainer: rival.name, canCatch:false, canRun:false });
    G.flags.woodsRivalDay = G.time.day;
    if (r.wiped) return afterLoss();
    if (r.win){
      const gold = 80 + avg * 12;
      G.gold += gold;
      skillAdd('necromancy', 25 + avg * 2);
      await UI.say(`${rival.name} flees into the trees, dropping a purse of ${gold}⛁!`);
    }
  }

  // ---------- shop ----------
  const SHOP_STOCK = ['jar','gjar','ajar','tonic','bigtonic','fulltonic','cleanse','revive','graverune',
    'seed_blood','seed_grave','seed_moon','seed_pumpkid','seed_mandrake','seed_mystery',
    'worm','glowbait','voidbait','bonerod','abyssrod','plank','stone','ecto',
    'f_chair','f_table','f_rug','f_candle','f_shelf','f_mirror','f_clock','f_gargoyle','f_throne','f_banner','f_plant'];

  async function shop(){
    for(;;){
      const c = await UI.choice(['Buy', 'Sell', 'Leave']);
      if (c === 2 || c === -1) return;
      if (c === 0){
        for(;;){
          const stock = SHOP_STOCK.filter(id => !(ITEMS[id].k === 'rod' && Inv.count(id) > 0));
          const i = await UI.panelList(`SHOPKEEP ODD — your gold: ${G.gold}⛁`, stock.map(id => ({
            html:`<b>${ITEMS[id].n}</b> — ${ITEMS[id].price}⛁ <span class="dim">(have ${Inv.count(id)})</span><br><span class="dim">${ITEMS[id].d || ''}</span>`,
            dim: G.gold < ITEMS[id].price,
          })), { footer:'Z: buy one · X: back' });
          if (i < 0) break;
          const id = stock[i];
          if (G.gold < ITEMS[id].price){ UI.toast('Not enough gold.'); continue; }
          G.gold -= ITEMS[id].price;
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
    const c = await UI.choice(['Heal my grims', 'Any advice?', 'Goodbye']);
    if (c === 0){
      for (const g of G.party){ g.hp = statsFor(g.sp, g.lvl).maxhp; g.status = null;
        for (const m of g.moves) m.pp = MOVES[m.id].pp; }
      await UI.say('Morwen mutters over your jars. Your grims are fully restored, dear.', 'Witch Morwen');
      save();
    } else if (c === 1){
      const tips = [
        'Monster seeds grow into grims! The farming plots are beside your manor — and your Farming level decides how strong they hatch.',
        'Some fish bite only at night, and the rarest only under a NEW or FULL moon. Sleep in your bed to pass the days.',
        'The catacombs have no bottom, dear. Every fifth floor a guardian waits — beat it, or better, BIND it.',
        'Weaken a wild grim and put it to sleep before throwing a jar. Your Necromancy level helps too.',
        'Restore the manor\'s Study and all your grims learn faster. Restore the Kitchen and you can brew.',
        'Master Grell\'s Soul Ladder has no top rung. The duelists climb forever, and so can you.',
      ];
      await UI.say(tips[rnd(tips.length)], 'Witch Morwen');
    }
  }
  async function fisherTalk(){
    if (!G.flags.metEli){
      G.flags.metEli = true;
      Inv.add('oldrod', 1); Inv.add('worm', 5);
      return UI.say(['"New blood! The lake\'s full of drowned things that bite."',
        '"Here — my old rod and some grubs. Face the water and press Z to cast."',
        '"Level your Fishing and buy my Bone Rod design at the shop. The Abyss Rod... earn that one."'], 'Fisher Eli');
    }
    const tips = [
      '"Phantfin only rise at night. Lanternjaw? New moon, Bone Rod or better."',
      '"They whisper of the MOONSCALE — full moon, Abyss Rod, Fishing 15. A living legend."',
      '"Better bait, better odds on the strange ones. The witch\'s cauldron brews Void Bait."',
      '"Your Fishing level widens the catch-window. Even an old eel like me started clumsy."',
    ];
    return UI.say(tips[rnd(tips.length)], 'Fisher Eli');
  }
  async function diggerTalk(){
    if (!G.flags.metDigger){
      G.flags.metDigger = true;
      Inv.add('graverune', 2);
      return UI.say(['"That hole? Goes down forever, far as I ever dug."',
        '"Take these Grave Runes — use one from your satchel to climb out in a pinch."',
        '"Chests get richer the deeper you go. So do the teeth. Delving\'s a skill like any other."'], 'Gravedigger');
    }
    return UI.say(`"Deepest you've gone is floor ${G.cata.maxFloor || 0}. The dark remembers."`, 'Gravedigger');
  }

  // ---------- pause menu ----------
  async function pauseMenu(){
    for(;;){
      const c = await UI.choice(['Grims', 'Satchel', 'Skills', 'Grimdex', 'Save', 'Close']);
      if (c === -1 || c === 5) return;
      if (c === 0){
        for(;;){
          const i = await UI.party();
          if (i < 0) break;
          const g = G.party[i];
          const a = await UI.choice(['Summary', 'Move to front', 'Rename', 'Back']);
          if (a === 0) await UI.grimSummary(g);
          else if (a === 1){ G.party.splice(i, 1); G.party.unshift(g); UI.toast(`${g.nick} leads the way.`); }
          else if (a === 2){
            const nm = prompt('New nickname:', g.nick);
            if (nm && nm.trim()) g.nick = nm.trim().slice(0, 14);
          }
        }
      } else if (c === 1){
        for(;;){
          const id = await UI.pickItem(null);
          if (!id) break;
          const it = ITEMS[id];
          if (['heal','revive','cure'].includes(it.k)){
            const ti = await UI.party('USE ON WHICH GRIM?');
            if (ti < 0) continue;
            const msg = useItemOn(id, G.party[ti]);
            if (msg){ Inv.take(id, 1); UI.toast(msg); }
            else UI.toast('It would have no effect.');
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
          else if (it.k === 'furn') UI.toast('Place it on a free floor tile in your manor.');
          else if (it.k === 'rod') UI.toast('Face water and press Z to fish.');
          else UI.toast(it.d || '...');
        }
      } else if (c === 2){
        await UI.panelList('SKILLS', Object.entries(SKILLS).map(([k, s]) => {
          const lvl = skillLvl(k), xp = G.skills[k] || 0;
          const cur = skillXpFor(lvl), next = skillXpFor(lvl + 1);
          const pct = Math.min(100, Math.round((xp - cur) / (next - cur) * 100));
          return { html:`<b style="color:${s.col}">${s.icon} ${s.n} — Lv.${lvl}</b> <span class="dim">${xp - cur}/${next - cur} xp (${pct}%)</span><br><span class="dim">${s.d}</span>` };
        }), { footer:'Skills have NO level cap. Everything scales forever.' });
      } else if (c === 3){
        const keys = Object.keys(DEX);
        const caught = keys.filter(k => G.dex[k] === 2).length;
        await UI.panelList(`GRIMDEX — ${caught}/${keys.length} bound`, keys.map(k => {
          const st = G.dex[k] || 0;
          if (!st) return { html:`<span class="dim">??? — unseen</span>`, dim:true };
          return { spr: st ? SPR.creature(k) : null,
            html:`<b>${DEX[k].n}</b> ${st === 2 ? '<span class="tag" style="color:#6dd86d">BOUND</span>' : '<span class="tag">seen</span>'}<br><span class="dim">${st === 2 ? DEX[k].desc : '...'}</span>` };
        }), { footer:'Bind them all... if the valley lets you.' });
      } else if (c === 4){
        save();
        UI.toast('Game saved.');
      }
    }
  }

  // ---------- save / load ----------
  const SAVE_KEY = 'grimvale_save_v1';
  function save(){
    if (!G.started) return;
    const pos = World.map === 'cata' ? { map:'town', x:4, y:7 } : { map:World.map, x:World.px, y:World.py };
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...G, pos }));
  }
  function load(){
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  return { skillLvl, skillAdd, wildEncounter, afterLoss, cropStage, plot, fish,
    restore, placeFurniture, sleep, storage, cauldron, altar,
    enterCata, descend, ascend, chest, cataBoss, arena, woodsDuel,
    shop, witch, fisherTalk, diggerTalk, pauseMenu, save, load };
})();

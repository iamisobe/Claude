// ============================================================
// GRIMVALE — battle: turn-based duels, capture, XP, evolution.
// ============================================================
'use strict';

const Battle = (() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let B = null;

  // ---------- helpers ----------
  const stageMult = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  function eff(side){ return side === 'ally' ? B.ally : B.enemy; }
  function stagesOf(side){ return side === 'ally' ? B.aStages : B.eStages; }
  function statOf(g, side, stat){
    const base = statsFor(g.sp, g.lvl)[stat];
    let v = base * stageMult(stagesOf(side)[stat] || 0);
    if (stat === 'atk' && g.status === 'brn') v *= 0.5;
    return Math.max(1, Math.floor(v));
  }

  function blog(t){ $('b-log').textContent = t; return sleep(850); }

  function infoHTML(g){
    const st = statsFor(g.sp, g.lvl);
    const pct = Math.max(0, g.hp / st.maxhp);
    const cls = pct > .5 ? '' : pct > .2 ? ' mid' : ' low';
    const status = g.status ? `<span class="st">${g.status.toUpperCase()}</span>` : '';
    return `<div class="nm">${g.nick}${status}<span class="lv">Lv.${g.lvl}</span></div>
      <div class="hpbar${cls}"><div style="width:${pct*100}%"></div></div>
      <div style="font-size:11px;color:#8a7fa8">${Math.max(0,g.hp)}/${st.maxhp} HP</div>`;
  }
  function paint(){
    $('b-enemy-info').innerHTML = infoHTML(B.enemy);
    $('b-player-info').innerHTML = infoHTML(B.ally);
    drawSpr('b-enemy-spr', B.enemy.sp);
    drawSpr('b-player-spr', B.ally.sp);
  }
  function drawSpr(id, sp){
    const c = $(id), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 96, 96);
    x.drawImage(SPR.creature(sp), 0, 0, 96, 96);
  }
  function shake(id){ const e = $(id); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }
  function blink(id){ const e = $(id); e.classList.remove('blink'); void e.offsetWidth; e.classList.add('blink'); }

  // ---------- action buttons (keyboard + mouse) ----------
  function pick(buttons, cancelable){
    const box = $('b-actions');
    box.innerHTML = '';
    let sel = 0, resolve;
    const els = buttons.map((b, i) => {
      const el = document.createElement('button');
      el.innerHTML = b.sub ? `${b.label}<small>${b.sub}</small>` : b.label;
      if (b.off) el.disabled = true;
      el.onclick = () => { if (!b.off) done(i); };
      box.appendChild(el);
      return el;
    });
    function paintSel(){ els.forEach((e,i)=>e.classList.toggle('sel', i===sel)); }
    paintSel();
    function done(v){ Input.pop(h); box.innerHTML = ''; resolve(v); }
    const h = k => {
      if (k === 'left' || k === 'up'){ sel = (sel+buttons.length-1)%buttons.length; paintSel(); }
      else if (k === 'right' || k === 'down'){ sel = (sel+1)%buttons.length; paintSel(); }
      else if (k === 'ok'){ if (!buttons[sel].off) done(sel); }
      else if (k === 'no' && cancelable) done(-1);
    };
    Input.push(h);
    return new Promise(r => resolve = r);
  }

  // ---------- damage ----------
  async function doMove(attSide, mv){
    const att = eff(attSide), def = eff(attSide === 'ally' ? 'enemy' : 'ally');
    const defSide = attSide === 'ally' ? 'enemy' : 'ally';
    const M = MOVES[mv.id];
    // sleep check
    if (att.status === 'slp'){
      att.slpTurns = (att.slpTurns ?? (1 + rnd(3))) - 1;
      if (att.slpTurns > 0){ await blog(`${att.nick} is fast asleep...`); return; }
      att.status = null;
      await blog(`${att.nick} woke up!`);
    }
    mv.pp = Math.max(0, mv.pp - 1);
    await blog(`${att.nick} used ${M.n}!`);
    if (Math.random()*100 >= M.a){ await blog('...but it missed!'); return; }

    if (M.c === 'x'){ // status move
      const fx = M.fx;
      if (fx.heal){
        const st = statsFor(att.sp, att.lvl);
        att.hp = Math.min(st.maxhp, att.hp + Math.floor(st.maxhp * fx.heal));
        paint(); await blog(`${att.nick} recovered!`);
      } else if (fx.stat){
        const side = fx.self ? attSide : defSide;
        const tgt = fx.self ? att : def;
        const st = stagesOf(side);
        st[fx.stat] = Math.max(-4, Math.min(4, (st[fx.stat] || 0) + fx.delta));
        await blog(`${tgt.nick}'s ${fx.stat.toUpperCase()} ${fx.delta > 0 ? 'rose' : 'fell'}!`);
      } else if (fx.status){
        if (!def.status){
          def.status = fx.status;
          paint(); await blog(`${def.nick} was ${({psn:'poisoned',brn:'burned',slp:'put to sleep'})[fx.status]}!`);
        } else await blog('...but it failed!');
      }
      return;
    }

    const A = statOf(att, attSide, M.c === 'p' ? 'atk' : 'spc');
    const D = statOf(def, defSide, M.c === 'p' ? 'def' : 'spc');
    const tm = typeMult(M.t, DEX[def.sp].ty);
    const stab = DEX[att.sp].ty.includes(M.t) ? 1.5 : 1;
    const crit = Math.random() < 1/16 ? 1.5 : 1;
    let dmg = Math.floor((((2*att.lvl/5 + 2) * M.p * A / D) / 50 + 2) * tm * stab * crit * (0.85 + Math.random()*0.15));
    if (tm === 0){ await blog('It has no effect...'); return; }
    dmg = Math.max(1, dmg);
    def.hp = Math.max(0, def.hp - dmg);
    shake(defSide === 'enemy' ? 'b-enemy-spr' : 'b-player-spr');
    paint();
    if (crit > 1) await blog('A vicious strike!');
    if (tm > 1) await blog("It's devastating!");
    else if (tm < 1) await blog("It's not very effective...");
    // secondary effects
    const fx = M.fx;
    if (fx && def.hp > 0){
      if (fx.status && !def.status && Math.random()*100 < (fx.chance ?? 100)){
        def.status = fx.status;
        paint(); await blog(`${def.nick} was ${({psn:'poisoned',brn:'burned',slp:'put to sleep'})[fx.status]}!`);
      }
      if (fx.stat && Math.random()*100 < (fx.chance ?? 100)){
        const st = stagesOf(defSide);
        st[fx.stat] = Math.max(-4, (st[fx.stat] || 0) + fx.delta);
        await blog(`${def.nick}'s ${fx.stat.toUpperCase()} fell!`);
      }
    }
    if (fx && fx.drain){
      const st = statsFor(att.sp, att.lvl);
      att.hp = Math.min(st.maxhp, att.hp + Math.max(1, Math.floor(dmg * fx.drain)));
      paint(); await blog(`${att.nick} drained the wound!`);
    }
  }

  async function endOfTurn(g, side){
    if (g.hp <= 0) return;
    const st = statsFor(g.sp, g.lvl);
    if (g.status === 'psn'){
      g.hp = Math.max(0, g.hp - Math.max(1, Math.floor(st.maxhp/8)));
      paint(); await blog(`${g.nick} suffers from poison!`);
    } else if (g.status === 'brn'){
      g.hp = Math.max(0, g.hp - Math.max(1, Math.floor(st.maxhp/10)));
      paint(); await blog(`${g.nick} is seared by its burn!`);
    }
  }

  // ---------- AI ----------
  function aiMove(){
    const usable = B.enemy.moves.filter(m => m.pp > 0);
    if (!usable.length) return { id:'bash', pp:1 };
    if (Math.random() < 0.3) return usable[rnd(usable.length)];
    let best = usable[0], bestV = -1;
    for (const m of usable){
      const M = MOVES[m.id];
      const v = (M.p || 25) * typeMult(M.t, DEX[B.ally.sp].ty) * (DEX[B.enemy.sp].ty.includes(M.t) ? 1.5 : 1);
      if (v > bestV){ bestV = v; best = m; }
    }
    return best;
  }

  // ---------- xp & growth ----------
  async function grantXp(){
    const g = B.ally;
    if (g.hp <= 0) return;
    let xp = Math.floor(DEX[B.enemy.sp].xp * B.enemy.lvl / 7);
    if (B.trainer) xp = Math.floor(xp * 1.5);
    if (G.manor.restored.study) xp = Math.floor(xp * 1.15);
    xp = Math.floor(xp * (1 + 0.005 * (Systems.skillLvl('necromancy') - 1)));
    g.xp += xp;
    await blog(`${g.nick} gained ${xp} XP!`);
    while (g.xp >= xpForLevel(g.lvl + 1)){
      const oldMax = statsFor(g.sp, g.lvl).maxhp;
      g.lvl++;
      g.hp = Math.min(statsFor(g.sp, g.lvl).maxhp, g.hp + (statsFor(g.sp, g.lvl).maxhp - oldMax));
      paint();
      await blog(`${g.nick} grew to Lv.${g.lvl}!`);
      // learn moves
      for (const [l, mid] of DEX[g.sp].mv){
        if (l === g.lvl && !g.moves.some(m => m.id === mid)){
          if (g.moves.length < 4){
            g.moves.push({ id: mid, pp: MOVES[mid].pp });
            await blog(`${g.nick} learned ${MOVES[mid].n}!`);
          } else {
            await blog(`${g.nick} wants to learn ${MOVES[mid].n}!`);
            const opts = g.moves.map(m => `Forget ${MOVES[m.id].n}`).concat([`Give up on ${MOVES[mid].n}`]);
            const c = await UI.choice(opts, { cancelable:false });
            if (c >= 0 && c < 4){
              g.moves[c] = { id: mid, pp: MOVES[mid].pp };
              await blog(`${g.nick} learned ${MOVES[mid].n}!`);
            }
          }
        }
      }
      // evolution
      const ev = DEX[g.sp].ev;
      if (ev && g.lvl >= ev.lvl){
        if (await UI.confirm(`${g.nick} is transforming! Allow it to become ${DEX[ev.to].n}?`)){
          const wasNick = g.nick === DEX[g.sp].n;
          const hpPct = g.hp / statsFor(g.sp, g.lvl).maxhp;
          g.sp = ev.to;
          if (wasNick) g.nick = DEX[ev.to].n;
          g.hp = Math.max(1, Math.floor(statsFor(g.sp, g.lvl).maxhp * hpPct));
          G.dex[g.sp] = 2;
          paint();
          await blog(`It became ${DEX[ev.to].n}!`);
        }
      }
    }
  }

  // ---------- catching ----------
  async function tryCatch(jarId){
    Inv.take(jarId, 1);
    const e = B.enemy;
    const st = statsFor(e.sp, e.lvl);
    const statusB = e.status === 'slp' ? 2 : e.status ? 1.5 : 1;
    const skillB = 1 + 0.015 * (Systems.skillLvl('necromancy') - 1);
    let chance = ((3*st.maxhp - 2*e.hp) / (3*st.maxhp)) * (DEX[e.sp].catch / 255)
               * ITEMS[jarId].mult * statusB * skillB;
    chance = Math.min(0.95, chance);
    await blog(`You hurl the ${ITEMS[jarId].n}!`);
    for (let i = 0; i < 3; i++){ blink('b-enemy-spr'); await sleep(550); }
    if (Math.random() < chance){
      paint();
      await blog(`Got it! ${e.nick} was bound to the jar!`);
      G.dex[e.sp] = 2;
      delete e.slpTurns;
      Systems.skillAdd('necromancy', 30 + e.lvl * 3);
      if (G.party.length < 6){ G.party.push(e); }
      else { G.storage.push(e); await blog(`${e.nick} was sent to the manor storage box.`); }
      return true;
    }
    shake('b-enemy-spr');
    await blog('It broke free!');
    return false;
  }

  // ---------- player turn: returns action or null if turn skipped ----------
  async function playerAction(){
    for(;;){
      const a = await pick([
        { label:'FIGHT' }, { label:'BAG' },
        { label:'SWAP' }, { label: B.canRun ? 'RUN' : 'FORFEIT' },
      ]);
      if (a === 0){
        const mvs = B.ally.moves.map(m => ({
          label: MOVES[m.id].n,
          sub: `${TYPES[MOVES[m.id].t].n} · ${m.pp}/${MOVES[m.id].pp}pp`,
          off: m.pp <= 0,
        }));
        mvs.push({ label:'BACK', sub:' ' });
        const mi = await pick(mvs, true);
        if (mi < 0 || mi === B.ally.moves.length) continue;
        return { kind:'move', mv: B.ally.moves[mi] };
      }
      if (a === 1){
        const id = await UI.pickItem(it => ['heal','revive','cure','jar'].includes(it.k), 'BATTLE SATCHEL');
        if (!id) continue;
        if (ITEMS[id].k === 'jar'){
          if (!B.canCatch){ await blog('You cannot bind another soul-binder\'s grim!'); continue; }
          return { kind:'jar', id };
        }
        const ti = await UI.party('USE ON WHICH GRIM?');
        if (ti < 0) continue;
        const msg = useItemOn(id, G.party[ti]);
        if (!msg){ await blog('It would have no effect.'); continue; }
        Inv.take(id, 1);
        paint();
        await blog(msg);
        return { kind:'item' };
      }
      if (a === 2){
        const ti = await UI.party('SWAP TO WHICH GRIM?');
        if (ti < 0) continue;
        const tgt = G.party[ti];
        if (tgt === B.ally){ await blog(`${tgt.nick} is already out!`); continue; }
        if (tgt.hp <= 0){ await blog(`${tgt.nick} has no fight left!`); continue; }
        return { kind:'swap', g: tgt };
      }
      if (a === 3){
        if (!B.canRun){
          if (await UI.confirm('Forfeit the duel?')) return { kind:'forfeit' };
          continue;
        }
        return { kind:'run' };
      }
    }
  }

  async function swapIn(g){
    B.ally = g;
    B.aStages = {};
    paint();
    await blog(`Go, ${g.nick}!`);
  }

  async function enemyNext(){
    B.ei++;
    if (B.ei >= B.eParty.length) return false;
    B.enemy = B.eParty[B.ei];
    B.eStages = {};
    G.dex[B.enemy.sp] = Math.max(G.dex[B.enemy.sp] || 0, 1);
    paint();
    await blog(`${B.trainer} sends out ${B.enemy.nick}!`);
    return true;
  }

  // ---------- main ----------
  // opts: {eParty, trainer?, canCatch, canRun, intro}
  async function start(opts){
    const first = G.party.find(g => g.hp > 0);
    if (!first){ await UI.say('Your grims are in no shape to fight!'); return { win:false, noFight:true }; }
    World.active = false; // freeze overworld input & clock during the duel
    B = {
      eParty: opts.eParty, ei: 0, enemy: opts.eParty[0],
      ally: first, trainer: opts.trainer || null,
      canCatch: !!opts.canCatch, canRun: !!opts.canRun,
      aStages: {}, eStages: {},
    };
    $('battle').classList.remove('hidden');
    G.dex[B.enemy.sp] = Math.max(G.dex[B.enemy.sp] || 0, 1);
    paint();
    await blog(opts.intro || (B.trainer ? `${B.trainer} challenges you!` : `A wild ${B.enemy.nick} appears!`));
    if (B.trainer) await blog(`${B.trainer} sends out ${B.enemy.nick}!`);
    await blog(`Go, ${B.ally.nick}!`);

    let result = null;
    while (!result){
      const act = await playerAction();
      // resolve player non-move actions first
      if (act.kind === 'run'){
        const mySpd = statOf(B.ally, 'ally', 'spd'), eSpd = statOf(B.enemy, 'enemy', 'spd');
        if (Math.random() < Math.min(0.95, 0.5 + (mySpd - eSpd) / 100 + 0.15)){
          await blog('You slipped away into the mist!');
          result = { win:false, fled:true };
          break;
        }
        await blog('You could not escape!');
      } else if (act.kind === 'forfeit'){
        result = { win:false, forfeit:true };
        break;
      } else if (act.kind === 'jar'){
        if (await tryCatch(act.id)){ result = { win:true, caught:true }; break; }
      } else if (act.kind === 'swap'){
        await swapIn(act.g);
      }

      // turn order
      const playerMoves = act.kind === 'move';
      const pFirst = !playerMoves ? false
        : statOf(B.ally,'ally','spd') >= statOf(B.enemy,'enemy','spd');
      const seq = playerMoves
        ? (pFirst ? ['p','e'] : ['e','p'])
        : ['e'];
      for (const who of seq){
        if (B.ally.hp <= 0 || B.enemy.hp <= 0) break;
        if (who === 'p') await doMove('ally', act.mv);
        else await doMove('enemy', aiMove());
      }
      // end of turn statuses
      if (!result){
        if (B.enemy.hp > 0) await endOfTurn(B.enemy, 'enemy');
        if (B.ally.hp > 0) await endOfTurn(B.ally, 'ally');
      }
      // faints
      if (B.enemy.hp <= 0){
        await blog(`${B.enemy.nick} was vanquished!`);
        await grantXp();
        Systems.skillAdd('necromancy', 10 + B.enemy.lvl * 2);
        if (!(await enemyNext())) result = { win:true };
      }
      if (!result && B.ally.hp <= 0){
        await blog(`${B.ally.nick} fainted!`);
        const next = G.party.find(g => g.hp > 0);
        if (!next) result = { win:false, wiped:true };
        else {
          let ti = -1;
          while (ti < 0 || G.party[ti].hp <= 0) ti = await UI.party('SEND OUT WHICH GRIM?');
          await swapIn(G.party[ti]);
        }
      }
    }
    for (const g of G.party) delete g.slpTurns;
    $('battle').classList.add('hidden');
    B = null;
    World.active = true;
    return result;
  }

  return { start };
})();

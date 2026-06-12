// ============================================================
// GRIMVALE — main: boot, title, new game, loop.
// ============================================================
'use strict';

var G = { started:false, time:{ day:1, min:480 } };

function freshGame(){
  return {
    started: true, name: 'Mourner', gold: 400,
    time: { day: 1, min: 8 * 60 },
    pc: { hp: 50, soul: 25, atkCd: 0, boltCd: 0, inv: 0, swing: 0 },
    party: [], storage: [],
    bag: { jar: 5, tonic: 3, seed_blood: 2 },
    gear: { equip: Object.fromEntries(EQUIP_KEYS.map(k => [k, null])), bag: [] },
    houses: {},
    dex: {}, skills: {}, farm: {},
    manor: { restored: {}, furniture: [], storageBuilt: false },
    arena: { rank: 1, wins: 0 },
    cata: { maxFloor: 0 },
    flags: { chests: {} },
    stats: {}, quest: { i: 0 },
    pos: { map: 'town', x: 17, y: 8 },
  };
}

const STARTERS = ['sproutling', 'cindling', 'dripp'];

async function newGame(){
  Input.pop(titleKeys);
  G = freshGame();
  $('title').classList.add('hidden');
  World.enter('town', 17, 8);
  Systems.healAll();
  World.active = true;
  UI.hud();
  await UI.say([
    'Welcome to GRIMVALE, dear. I am Morwen — the witch, the doctor, and the only person here who knocks.',
    'You have inherited Hollow Manor: one good room, four ruined ones, six soil plots, and a remarkable amount of fog.',
    'A necromancer never fights alone. I brought three soul jars. Choose your first grim — it will rise and fight BESIDE you.',
  ], 'Witch Morwen');
  let pick = -1;
  while (pick < 0){
    pick = await UI.panelList('CHOOSE YOUR FIRST GRIM', STARTERS.map(sp => ({
      spr: SPR.creature(sp),
      html: `<b>${DEX[sp].n}</b> ${DEX[sp].ty.map(t => `<span class="tag" style="color:${TYPES[t].col}">${TYPES[t].n}</span>`).join(' ')}<br><span class="dim">${DEX[sp].desc} <i>(${ARCH[sp]})</i></span>`,
    })), { footer: 'Z: choose' });
  }
  const sp = STARTERS[pick];
  G.party.push(makeGrim(sp, 5));
  G.dex[sp] = 2;
  Combat.syncMinions();
  await UI.say([
    `${DEX[sp].n}! ` + ['A gentle soul with thorns.', 'Warm hands, warmer temper.', 'It has already started crying. That means it likes you.'][pick],
    'Stay close and I will teach you everything, step by step. Follow the glowing objective at the top of the screen.',
  ], 'Witch Morwen');
  if (await UI.confirm('Play the guided tutorial? (Recommended for your first time.)')){
    Tutorial.begin();
  } else {
    await UI.say('As you like, dear. Press ☰ (or Esc) any time for your menu. Off you go.', 'Witch Morwen');
  }
  Systems.save();
}

function continueGame(){
  const s = Systems.load();
  if (!s) return;
  Input.pop(titleKeys);
  G = s;
  // backfill for forward compatibility
  G.flags = G.flags || { chests: {} };
  G.flags.chests = G.flags.chests || {};
  G.pc = G.pc || { hp: 50, soul: 25, atkCd: 0 };
  G.gear = G.gear || { equip: {}, bag: [] };
  migrateGear();
  G.houses = G.houses || {};
  G.stats = G.stats || {};
  G.quest = G.quest || { i: 0 };
  if (G.manor.storageBuilt === undefined) G.manor.storageBuilt = true; // veterans keep their chest
  $('title').classList.add('hidden');
  World.enter(G.pos.map, G.pos.x, G.pos.y);
  World.active = true;
  UI.hud();
  UI.toast('Welcome back to Grimvale.');
}

// ---------- boot ----------
SPR.init();
initTouch();
fitScreen();

$('btn-new').onclick = async () => {
  if (Systems.load() && !(await UI.confirm('Start over? Your old save will be erased.'))) return;
  newGame();
};
$('btn-continue').onclick = () => continueGame();
if (!Systems.load()) $('btn-continue').disabled = true;

// keyboard on title
function titleKeys(k){
  if ($('title').classList.contains('hidden')){ Input.pop(titleKeys); return; }
  if (k === 'ok'){
    if (Systems.load()) continueGame();
    else newGame();
  }
}
Input.push(titleKeys);

// ---------- loop ----------
let lastT = performance.now(), saveT = 0;
function loop(t){
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (G.started){
    World.update(dt);
    Tutorial.update();
    saveT += dt;
    if (saveT > 30){ saveT = 0; Systems.save(); }
  }
  World.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

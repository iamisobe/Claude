// ============================================================
// GRIMVALE — main: boot, title, new game, loop.
// ============================================================
'use strict';

var G = { started:false, time:{ day:1, min:480 } };

function freshGame(){
  return {
    started: true, name: 'Mourner', gold: 400,
    time: { day: 1, min: 8 * 60 },
    party: [], storage: [],
    bag: { jar: 5, tonic: 3, seed_blood: 2 },
    dex: {}, skills: {}, farm: {},
    manor: { restored: {}, furniture: [] },
    arena: { rank: 1, wins: 0 },
    cata: { maxFloor: 0 },
    flags: { chests: {} },
    pos: { map: 'town', x: 17, y: 8 },
  };
}

const STARTERS = ['sproutling', 'cindling', 'dripp'];

async function newGame(){
  Input.pop(titleKeys);
  G = freshGame();
  $('title').classList.add('hidden');
  World.enter('town', 17, 8);
  World.active = true;
  UI.hud();
  await UI.say([
    'Welcome to GRIMVALE, dear. I am Morwen — the witch, the doctor, and the only person here who knocks.',
    'You have inherited Hollow Manor: one good room, four ruined ones, six soil plots, and a remarkable amount of fog.',
    'A necromancer needs a companion. I brought three soul jars. Choose, and choose with your heart.',
  ], 'Witch Morwen');
  let pick = -1;
  while (pick < 0){
    pick = await UI.panelList('CHOOSE YOUR FIRST GRIM', STARTERS.map(sp => ({
      spr: SPR.creature(sp),
      html: `<b>${DEX[sp].n}</b> ${DEX[sp].ty.map(t => `<span class="tag" style="color:${TYPES[t].col}">${TYPES[t].n}</span>`).join(' ')}<br><span class="dim">${DEX[sp].desc}</span>`,
    })), { footer: 'Z: choose' });
  }
  const sp = STARTERS[pick];
  const g = makeGrim(sp, 5);
  G.party.push(g);
  G.dex[sp] = 2;
  await UI.say([
    `${DEX[sp].n}! ` + ['A gentle soul with thorns.', 'Warm hands, warmer temper.', 'It has already started crying. That means it likes you.'][pick],
    'Your satchel holds soul jars, tonics, and two bloodberry seeds. Press X for your menu.',
    'Cursed grass in MURKWOOD (south gate) hides wild grims. The lake bites. The hole in the graveyard goes down forever.',
    'Sleep in your manor bed to pass days — the MOON decides what rises. Off you go, little necromancer.',
  ], 'Witch Morwen');
  Systems.save();
}

function continueGame(){
  const s = Systems.load();
  if (!s) return;
  Input.pop(titleKeys);
  G = s;
  G.flags = G.flags || { chests: {} };
  G.flags.chests = G.flags.chests || {};
  $('title').classList.add('hidden');
  World.enter(G.pos.map, G.pos.x, G.pos.y);
  World.active = true;
  UI.hud();
  UI.toast('Welcome back to Grimvale.');
}

// ---------- boot ----------
SPR.init();

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
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  if (G.started){
    World.update(dt);
    saveT += dt;
    if (saveT > 30){ saveT = 0; Systems.save(); }
  }
  World.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

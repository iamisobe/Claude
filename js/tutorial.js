// ============================================================
// GRIMVALE — tutorial: a full, guided, objective-driven course
// through EVERY system: moving, fighting, binding, menus,
// fishing, farming, resting, restoring, brewing, delving,
// the arena, and gear. Watches live game state to advance.
// ============================================================
'use strict';

const Tutorial = (() => {
  const K = KEYN; // device-appropriate names: {a, bolt, jar, menu}

  // Each step: {icon, obj, intro? (Morwen, once), gift? (run once), check}
  const STEPS = [
    { icon:'✦', obj:IS_TOUCH ? 'Move with the D-pad.' : 'Move with WASD or the arrow keys.',
      check: () => Tutorial._moved >= 5 },

    { icon:'↓', obj:'Head SOUTH down the path, through the gate, into Murkwood.',
      intro:['See the bars at the bottom-left? Red is your LIFE, purple your SOUL.',
        'Now walk SOUTH, dear — all the way down the path and through the gate. Murkwood waits.'],
      check: () => World.map === 'woods' },

    { icon:'⚔', obj:`Defeat a wild grim! ${K.a} swings your staff, ${K.bolt} hurls a hex.`,
      intro:['Murkwood crawls with wild grims, and they will not wait to be asked.',
        `Get close and use ${K.a} to swing your staff. Or use ${K.bolt} — it spends Soul, which returns on its own.`,
        'Your own grim fights at your side. Go on — put one DOWN.'],
      check: () => (G.kills || 0) >= 1 },

    { icon:'◍', obj:`Weaken a grim until the ◍ mark appears, then use ${K.jar} to bind it!`,
      intro:['Now, the necromancer\'s true art. Hurt a wild grim until it is nearly spent —',
        `a glowing ◍ mark appears above it. THEN use ${K.jar} to hurl a soul jar.`,
        'A bound grim rises and fights for you, forever. Your pack grows with your Necromancy skill. Catch one!'],
      check: () => (G.party.length + G.storage.length) >= 2 },

    { icon:'☰', obj:`Open the MENU (${K.menu}) and have a look around, then close it.`,
      intro:['Splendid! That grim is yours now.',
        `Open the menu (${K.menu}) any time: your PACK, your SATCHEL, your GEAR, your SKILLS, the DEED BOOK, and the Grimdex.`,
        'Every skill climbs FOREVER — Necromancy, Fishing, Farming, Brewing, Delving. Open the menu and look around.'],
      check: () => !!G.tut.menuOpened },

    { icon:'🪓', obj:`Chop a gnarled tree in Murkwood: face it and use ${K.a} (3 hits). Get 2 planks.`,
      intro:['A necromancer builds as much as binds. See the GNARLED TREES with golden fruit? They drop PLANKS.',
        `Face one and strike it with ${K.a} — three good hits fells it. Gather TWO planks. Stone heaps and ore veins work the same way.`],
      check: () => (G.stats.planks || 0) >= 2 || G.manor.storageBuilt },

    { icon:'📦', obj:'Repair the SPLINTERED storage chest in your manor hall (2 planks).',
      intro:['Your first craft! In your manor hall stands a chest too broken to hold anything.',
        `Carry your planks home, face the splintered chest beside the bed, and use ${K.a} to repair it.`,
        'A working chest stores the grims your pack cannot carry — you will need it, binder of many.'],
      check: () => !!G.manor.storageBuilt },

    { icon:'🎣', obj:`Find Fisher Eli by the town lake (east side) and talk to him (${K.a}).`,
      intro:['Time you learned to fish. Head back NORTH to town.',
        `Fisher Eli idles by the lake on the east side. Talk to him — face him and use ${K.a}. He owes me a favour.`],
      check: () => !!G.flags.metEli },

    { icon:'🎣', obj:`Cast (${K.a} at the water), wait for the "!", strike, then HOLD ${K.a} to reel it in!`,
      intro:[`Rod in hand! Stand at the water's edge, FACE the water, and use ${K.a} to cast.`,
        `Then WAIT. The bobber will twitch — ignore the little nibbles. When it PLUNGES and you see "!", strike fast with ${K.a}!`,
        `Then HOLD ${K.a} to lift the hook, let go to drop it. Keep the fish inside the green band until the CATCH meter fills — and it's yours.`,
        'Every catch is yours to use: SELL it to Eli, have him RENDER it into bait and building reagents, or bind it into your pack with a jar. The rarest fish bite only at night or under a new or full moon.'],
      check: () => (G.skills.fishing || 0) > 0 },

    { icon:'☘', obj:`Plant a seed: walk to the farm plots (north-east, by the fence) and use ${K.a} at a soil plot.`,
      intro:['Now for the garden. You carry two BLOODBERRY SEEDS in your satchel.',
        'The farm plots sit north-east of town, inside the little fence — the gap is on the south side.',
        `FACE a dark soil plot, use ${K.a}, and choose a seed. Use it again later to WATER the plot — water makes everything grow half again as fast.`],
      check: () => Object.keys(G.farm).length > 0 },

    { icon:'🌙', obj:'Go home to Hollow Manor (north door) and SLEEP in your bed.',
      intro:['Crops take time. Luckily, time is yours to spend.',
        `Your manor is the big house at the TOP of town. Inside, face the bed and use ${K.a} to sleep.`,
        'Sleeping heals everything, passes the day, and turns the MOON — new moon, waxing, full, waning. The moon decides what bites.'],
      check: () => !!G.flags.slept },

    { icon:'⛏', obj:`Restore the KITCHEN: face the rubble in the west doorway and use ${K.a}.`,
      gift: () => { G.gold += 800; Inv.add('plank', 3); Inv.add('stone', 2);
        UI.toast('Morwen slips you 800⛁, 3 planks and 2 stones.'); },
      intro:['This manor is your first home — and your training in the builder\'s art.',
        `I have tucked some coin and materials into your satchel. Face the RUBBLE blocking the west doorway and use ${K.a} to restore the KITCHEN.`,
        'Each restored wing grants a power. All four restored... and the valley\'s DEED BOOK opens. But one wing will do for now.'],
      check: () => !!G.manor.restored.kitchen },

    { icon:'⚗', obj:'Brew at the cauldron: 3 bloodberries make a Grave Tonic.',
      gift: () => { if (Inv.count('bloodberry') < 3) Inv.add('bloodberry', 3 - Inv.count('bloodberry'));
        UI.toast('Morwen tops up your bloodberries.'); },
      intro:['A kitchen! Now we cook. Well — BREW.',
        `The cauldron bubbles in your new kitchen. Face it, use ${K.a}, and brew a GRAVE TONIC from three bloodberries.`,
        'Your farm grows the ingredients; your Brewing skill unlocks finer recipes — baits, elixirs, even Second Breath.'],
      check: () => (G.skills.brewing || 0) > 0 },

    { icon:'🕳', obj:'Descend into the catacombs (the dark hole in the graveyard) and reach floor B2.',
      intro:['You are ready for the dark, I think.',
        `In the graveyard, west of town, a HOLE waits. Use ${K.a} at its edge to climb down.`,
        'Fight to the DOWN STAIRS and descend to floor B2. Chests hide gold and gear. The floors go down FOREVER — every fifth one is guarded.',
        'If it goes badly, use a GRAVE RUNE from your satchel to escape. The Gravedigger gives them to those who ask.'],
      check: () => (G.cata.maxFloor || 0) >= 2 },

    { icon:'⚔', obj:`Equip a piece of gear from your CHARACTER sheet (${K.menu} → Character).`,
      gift: () => { G.gear.bag.push(rollGear(3)); UI.toast('Morwen presses an old family heirloom into your hands.'); },
      intro:['The dead drop more than dust — staves, robes, charms, each with its own blessings.',
        `I have given you a piece to start. Open ${K.menu} → CHARACTER, inspect it, and EQUIP it.`,
        'Common is white, CURSED is blue, ELDRITCH is gold with three blessings. Salvage what you do not want.'],
      check: () => EQUIP_KEYS.some(k => G.gear.equip[k]) },

    { icon:'♛', obj:'Visit Master Grell at the arena (east building) and view the Soul Ladder.',
      intro:['One last introduction. Master Grell keeps the SOUL LADDER — duels against every necromancer in the valley.',
        'His arena is the east building in town. Talk to him and VIEW THE LADDER. Duel when you feel strong; the ladder has no top rung.'],
      check: () => !!G.tut.arenaSeen },

    { icon:'★', obj:'You know everything. The valley is yours.',
      intro:['And that is everything I can teach, little necromancer. The rest, the valley teaches.',
        'Your long road: restore ALL FOUR manor wings to open the DEED BOOK — then buy and build homes at every SALE post, each with its own power.',
        'Bind all 32 grims. Climb the Ladder. Sound the depths. The catacombs fall forever; so can you... try not to.',
        'Sleep when hurt. Brew when poor. And visit an old witch now and then, hm? Off you go.'],
      final: true },
  ];

  function showObjective(icon, text){
    const o = $('objective');
    $('obj-icon').textContent = icon;
    $('obj-text').textContent = text;
    o.classList.remove('hidden');
  }
  function hideObjective(){ $('objective').classList.add('hidden'); }

  function update(){
    if (!G.started || !G.tut || G.tut.done) return;
    // track movement distance (tiles)
    const key = `${World.map}:${World.px},${World.py}`;
    if (Tutorial._lastTile && Tutorial._lastTile !== key) Tutorial._moved = (Tutorial._moved || 0) + 1;
    Tutorial._lastTile = key;

    const s = STEPS[G.tut.step];
    if (!s){ G.tut.done = true; hideObjective(); return; }

    // teach once per step, when no other modal is up
    if ((s.intro || s.gift) && !G.tut.introShown){
      if (Input.top()) return;
      G.tut.introShown = true;
      if (s.gift) s.gift();
      if (s.intro) UI.say(s.intro, 'Witch Morwen');
      return;
    }
    if (s.final){
      if (!Input.top()){
        G.tut.done = true;
        hideObjective();
        UI.toast('★ Tutorial complete — the valley is yours.');
        Systems.save();
      }
      return;
    }

    showObjective(s.icon, `${s.obj}  (${G.tut.step + 1}/${STEPS.length - 1})`);
    if (s.check(G)){
      G.tut.step++;
      G.tut.introShown = false;
      hideObjective();
      UI.toast('✓ Objective complete!');
      Systems.save();
    }
  }

  function begin(){
    G.tut = { step: 0, introShown: false, done: false };
    Tutorial._moved = 0;
    Tutorial._lastTile = null;
  }
  function skip(){
    if (G.tut){ G.tut.done = true; hideObjective(); UI.toast('Tutorial skipped.'); }
  }
  function active(){ return !!(G.tut && !G.tut.done); }

  return { update, begin, skip, active, _moved: 0, _lastTile: null };
})();

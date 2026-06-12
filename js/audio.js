// ============================================================
// GRIMVALE — audio: every sound synthesized with Web Audio.
// No files. Unlocked on the first user gesture (browser policy).
// ============================================================
'use strict';

const SFX = (() => {
  let ctx = null, master = null, musicBus = null, musicTimer = null;
  let sndOn = true, musOn = true;
  try {
    sndOn = localStorage.getItem('gv_snd') !== '0';
    musOn = localStorage.getItem('gv_mus') !== '0';
  } catch (e) {}
  const last = {};

  function init(){
    if (ctx) return;
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = musOn ? 0.16 : 0; musicBus.connect(master);
      startMusic();
    } catch (e) { ctx = null; }
  }
  function unlock(){
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // ---- synth primitives ----
  function env(g, t0, a, d, peak){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function osc(type, f0, f1, t0, dur, vol){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    env(g, t0, 0.008, dur, vol);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function noise(t0, dur, vol, fStart, fEnd, type = 'bandpass'){
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(fStart, t0);
    if (fEnd) f.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), t0 + dur);
    const g = ctx.createGain();
    env(g, t0, 0.005, dur, vol);
    src.connect(f).connect(g).connect(master);
    src.start(t0); src.stop(t0 + dur + 0.1);
  }

  // ---- the sound book ----
  const RECIPES = {
    swing(t){ noise(t, .12, .22, 1900, 480); },
    hit(t){ noise(t, .08, .38, 900, 280, 'lowpass'); osc('sine', 95, 40, t, .13, .5); },
    bolt(t){ osc('sawtooth', 280, 950, t, .14, .16); osc('sine', 560, 1500, t, .12, .1); },
    blast(t){ noise(t, .28, .4, 1300, 110, 'lowpass'); osc('sine', 120, 34, t, .3, .5); },
    kill(t){ osc('triangle', 720, 170, t, .42, .2); noise(t, .35, .1, 3000, 700); },
    roar(t){ osc('sawtooth', 92, 44, t, .55, .32); osc('sawtooth', 96, 47, t, .55, .26); noise(t, .5, .2, 520, 110, 'lowpass'); },
    hurt(t){ osc('square', 220, 80, t, .16, .26); },
    shield(t){ osc('sine', 1450, 1150, t, .12, .18); osc('sine', 2210, 1800, t, .1, .09); },
    shieldBreak(t){ noise(t, .25, .35, 2600, 380); osc('square', 300, 85, t, .22, .22); },
    cast(t){ [520, 660, 880].forEach((f, i) => osc('sine', f, f * 1.07, t + i * .05, .18, .12)); },
    heal(t){ [440, 554, 660].forEach((f, i) => osc('sine', f, null, t + i * .07, .22, .1)); },
    pickup(t){ osc('square', 988, null, t, .06, .1); osc('square', 1319, null, t + .07, .09, .1); },
    gear(t){ [659, 784, 988].forEach((f, i) => osc('square', f, null, t + i * .08, .11, .1)); },
    jar(t){ osc('sine', 300, 900, t, .18, .18); osc('sine', 900, 1600, t + .18, .16, .18); },
    jarFail(t){ osc('sawtooth', 310, 85, t, .3, .2); },
    levelup(t){ [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, null, t + i * .08, .17, .14)); },
    quest(t){ [523, 659, 784, 1047, 1319].forEach((f, i) => osc('triangle', f, null, t + i * .09, .2, .13)); },
    ui(t){ osc('sine', 720, null, t, .045, .07); },
    chop(t){ noise(t, .09, .28, 720, 240, 'lowpass'); osc('sine', 165, 70, t, .08, .28); },
    splash(t){ noise(t, .26, .26, 1500, 380); },
    bite(t){ osc('sine', 180, 75, t, .1, .32); osc('square', 1150, null, t + .11, .12, .18); },
    door(t){ noise(t, .2, .14, 900, 190); },
    sleep(t){ [392, 494, 587].forEach((f, i) => osc('sine', f, null, t + i * .13, .32, .1)); },
  };
  const MIN_GAP = { hit: .055, pickup: .07, swing: .08, blast: .06, ui: .05 };

  function play(name){
    if (!sndOn || !ctx || ctx.state !== 'running') return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const gap = MIN_GAP[name] ?? 0.03;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    const r = RECIPES[name];
    if (r) try { r(ctx.currentTime); } catch (e) {}
  }

  // ---- generative music: a slow plucked lute in A minor ----
  // No sustained tones — every voice is a short pluck that decays away,
  // walking an Am→F→C→Em progression so it stays harmonic, never droning.
  const PROG = [
    { bass: 110.00, tones: [220.00, 261.63, 329.63, 440.00] },  // Am
    { bass:  87.31, tones: [220.00, 261.63, 349.23, 440.00] },  // F
    { bass: 130.81, tones: [196.00, 261.63, 329.63, 392.00] },  // C
    { bass:  82.41, tones: [196.00, 246.94, 329.63, 392.00] },  // Em
  ];
  let mstep = 0;
  function pluck(f, t, vol, dur){
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);  // human detune
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(musicBus);
    o.start(t); o.stop(t + dur + 0.1);
  }
  function startMusic(){
    if (!ctx || musicTimer) return;
    musicTimer = setInterval(() => {
      if (!musOn || !sndOn || !ctx || ctx.state !== 'running') return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const t = ctx.currentTime;
      const ch = PROG[Math.floor(mstep / 8) % PROG.length];
      const beat = mstep % 8;
      if (beat === 0) pluck(ch.bass, t, 0.30, 2.2);
      if (beat === 4 && Math.random() < 0.7) pluck(ch.bass * 1.5, t, 0.16, 1.6);
      if (Math.random() < (beat % 2 === 0 ? 0.6 : 0.25)){
        const f = ch.tones[Math.floor(Math.random() * ch.tones.length)] * (Math.random() < 0.15 ? 2 : 1);
        pluck(f, t, 0.13, 1.3);
      }
      mstep++;
    }, 340);
  }

  function toggleSound(){
    sndOn = !sndOn;
    try { localStorage.setItem('gv_snd', sndOn ? '1' : '0'); } catch (e) {}
    return sndOn;
  }
  function toggleMusic(){
    musOn = !musOn;
    if (musicBus) musicBus.gain.value = musOn ? 0.16 : 0;
    try { localStorage.setItem('gv_mus', musOn ? '1' : '0'); } catch (e) {}
    return musOn;
  }

  return { play, unlock, toggleSound, toggleMusic,
    soundOn: () => sndOn, musicOn: () => musOn, names: () => Object.keys(RECIPES) };
})();

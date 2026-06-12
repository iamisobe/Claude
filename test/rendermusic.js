// Render a sample of the generative music offline → WAV, for auditioning.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const pcm = await page.evaluate(async () => {
    const SR = 44100, DUR = 20;
    const ctx = new OfflineAudioContext(1, SR * DUR, SR);
    const bus = ctx.createGain(); bus.gain.value = 0.16 * 0.5; bus.connect(ctx.destination);
    const PROG = [
      { bass: 110.00, tones: [220.00, 261.63, 329.63, 440.00] },
      { bass:  87.31, tones: [220.00, 261.63, 349.23, 440.00] },
      { bass: 130.81, tones: [196.00, 261.63, 329.63, 392.00] },
      { bass:  82.41, tones: [196.00, 246.94, 329.63, 392.00] },
    ];
    function pluck(f, t, vol, dur){
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'triangle';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(bus);
      o.start(t); o.stop(t + dur + 0.1);
    }
    for (let s = 0; s * 0.34 < DUR - 0.5; s++){
      const t = s * 0.34;
      const ch = PROG[Math.floor(s / 8) % PROG.length];
      const beat = s % 8;
      if (beat === 0) pluck(ch.bass, t, 0.30, 2.2);
      if (beat === 4 && Math.random() < 0.7) pluck(ch.bass * 1.5, t, 0.16, 1.6);
      if (Math.random() < (beat % 2 === 0 ? 0.6 : 0.25)){
        const f = ch.tones[Math.floor(Math.random() * ch.tones.length)] * (Math.random() < 0.15 ? 2 : 1);
        pluck(f, t, 0.13, 1.3);
      }
    }
    const buf = await ctx.startRendering();
    return Array.from(buf.getChannelData(0));
  });
  // write 16-bit mono WAV
  const n = pcm.length, data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(44100, 24); data.writeUInt32LE(44100 * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767 * 4))), 44 + i * 2);
  fs.writeFileSync('/tmp/grimvale-music.wav', data);
  console.log('wrote /tmp/grimvale-music.wav', n, 'samples');
  await browser.close();
})();

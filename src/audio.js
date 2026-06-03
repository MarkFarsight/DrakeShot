// ============================================================================
// AUDIO  —  procedural sound effects via the Web Audio API (no audio files)
// ----------------------------------------------------------------------------
// Every sound is synthesised from oscillators + filtered noise with short gain
// envelopes, so the game stays self-contained and works offline / from file://.
//
// Browsers require a user gesture before audio can play, so main.js calls
// Audio.init() from the "click to play" handler. Every SFX is a safe no-op until
// then (and in non-browser test environments), so it can be called anywhere.
// Press M in-game to mute.
// ============================================================================

const Audio = (function () {
  let ctx = null;
  let master = null;
  let enabled = true;
  let noiseBuf = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function noiseBuffer() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // Exponential attack/decay envelope on a gain node (can't ramp to 0).
  function env(gain, t0, peak, dur, attack) {
    gain.setValueAtTime(0.0001, t0);
    gain.exponentialRampToValueAtTime(peak, t0 + (attack || 0.004));
    gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  // A single oscillator blip, optionally sliding in pitch. `attack` lets a note
  // swell in slowly (for dramatic, building sounds).
  function osc(freq, type, dur, gain, slideTo, delay, attack) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    env(g.gain, t0, gain == null ? 0.5 : gain, dur, attack || 0.004);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  // A burst of filtered noise (cracks, thuds, rumbles).
  function noise(dur, gain, cutoff, type, delay, attack) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = cutoff || 1200;
    const g = ctx.createGain();
    env(g.gain, t0, gain == null ? 0.5 : gain, dur, attack || 0.002);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur + 0.03);
  }

  return {
    // call from a user gesture (click) to create/resume the audio context
    init() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggle() { enabled = !enabled; return enabled; },
    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; },

    // --- weapons ---
    shoot(tier) {
      if (tier >= 2) { noise(0.18, 0.6, 1000, 'lowpass'); osc(95, 'sine', 0.18, 0.6, 34); }
      else if (tier === 1) { noise(0.10, 0.55, 1800, 'lowpass'); osc(140, 'sine', 0.10, 0.45, 48); }
      else { noise(0.07, 0.5, 2600, 'lowpass'); osc(180, 'sine', 0.08, 0.4, 60); }
    },
    dryFire() { osc(220, 'square', 0.03, 0.12); osc(180, 'square', 0.03, 0.10, null, 0.04); },

    // --- building ---
    breakBlock() { noise(0.12, 0.4, 1500, 'lowpass'); osc(130, 'sine', 0.09, 0.2, 60); },
    placeBlock() { osc(200, 'sine', 0.08, 0.3, 120); noise(0.05, 0.15, 800, 'lowpass'); },

    // --- combat ---
    enemyHit() { osc(420, 'square', 0.05, 0.18, 300); },
    enemyDie() { osc(300, 'sawtooth', 0.25, 0.3, 70); noise(0.2, 0.18, 900, 'lowpass'); },
    hurt() { osc(165, 'sine', 0.2, 0.4, 70); noise(0.12, 0.2, 500, 'lowpass'); },

    // --- items ---
    pickup() { osc(620, 'sine', 0.10, 0.3, 1000); },
    heal() { osc(660, 'sine', 0.12, 0.3); osc(990, 'sine', 0.14, 0.3, null, 0.09); },
    craft() { osc(523, 'triangle', 0.12, 0.3); osc(784, 'triangle', 0.16, 0.3, null, 0.09); },

    // --- dragon quest ---
    // Egg charge — tension builds with each stone (deeper sub + brighter sparkle).
    charge(level) {
      const L = level || 0;
      const base = 280 + L * 48;
      osc(base, 'triangle', 0.22, 0.30, base + 80, 0, 0.012);          // rising lead
      osc(base / 2, 'sawtooth', 0.26, 0.16 + L * 0.013, base / 2 + 30); // sub thickens as it fills
      osc(base * 3 + L * 90, 'triangle', 0.10, 0.10, null, 0.03);       // sparkle on top
    },
    fieldOn() { osc(120, 'sawtooth', 0.3, 0.25, 320); },
    fieldOff() { osc(320, 'sawtooth', 0.3, 0.25, 90); },

    // Hatch — three egg-cracks, a slow rising roar chord, a shimmer arpeggio,
    // then a deep boom. Big and cinematic (~1.6s).
    dragonHatch() {
      noise(0.10, 0.40, 3200, 'highpass');
      noise(0.10, 0.40, 3200, 'highpass', 0.18);
      noise(0.12, 0.45, 2600, 'highpass', 0.34);
      osc(48, 'sine', 1.3, 0.50, 170, 0.10, 0.12);      // rising sub sweep
      osc(90, 'sawtooth', 1.2, 0.22, 150, 0.25, 0.18);  // detuned roar chord
      osc(92, 'sawtooth', 1.2, 0.22, 152, 0.25, 0.18);
      osc(136, 'sawtooth', 1.2, 0.18, 226, 0.25, 0.20);
      osc(660, 'triangle', 0.18, 0.12, null, 0.50);     // shimmer up
      osc(990, 'triangle', 0.18, 0.12, null, 0.62);
      osc(1320, 'triangle', 0.22, 0.12, null, 0.74);
      noise(1.1, 0.28, 520, 'lowpass', 0.10, 0.10);     // rumble
      osc(70, 'sine', 0.5, 0.50, 45, 0.95);             // final boom
    },

    // Per-shot impact on the dragon — deep thud + crack + metallic ring (short).
    dragonHit() {
      osc(150, 'sine', 0.12, 0.32, 70);
      noise(0.05, 0.22, 2600, 'highpass');
      osc(300, 'square', 0.08, 0.16, 250);
    },

    // Death — a long descending detuned roar, sub-bass drop, wail, rumble, and a
    // final low boom (~2s).
    dragonDie() {
      osc(240, 'sawtooth', 1.7, 0.42, 42, 0, 0.04);     // roar chord, gliding down
      osc(242, 'sawtooth', 1.7, 0.42, 43, 0, 0.04);
      osc(360, 'sawtooth', 1.6, 0.22, 60, 0, 0.05);
      osc(120, 'sine', 1.9, 0.50, 28, 0, 0.05);         // sub-bass drop
      osc(520, 'triangle', 1.2, 0.20, 110, 0.10);       // anguished wail
      noise(1.7, 0.34, 650, 'lowpass', 0.04, 0.05);     // rumble
      osc(52, 'sine', 0.7, 0.50, 32, 1.40);             // final boom
    },
  };
})();

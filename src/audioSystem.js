export const MAX_AUDIO_VOICES = 24;

export function cannonRecipe({ player = false, strong = false, tier = 1, boss = false } = {}) {
  if (boss) {
    return {
      tones: [
        { freq: 118, endFreq: 72, duration: 0.12, type: 'sawtooth', gain: 0.034 },
        { freq: 58, endFreq: 42, duration: 0.16, type: 'square', gain: 0.018, delay: 0.008 },
      ],
      noise: { duration: 0.055, gain: 0.018, filter: 780 },
    };
  }

  if (!player) {
    return {
      tones: [{ freq: strong ? 178 : 228, endFreq: strong ? 120 : 176, duration: 0.055, type: 'square', gain: strong ? 0.022 : 0.016 }],
      noise: strong ? { duration: 0.035, gain: 0.01, filter: 1050 } : null,
    };
  }

  const t = Math.max(1, Math.min(3, Math.floor(Number(tier) || 1)));
  const base = t === 1 ? 390 : t === 2 ? 330 : 285;
  return {
    tones: [
      { freq: base, endFreq: base * 0.58, duration: 0.065 + t * 0.008, type: t >= 3 ? 'sawtooth' : 'square', gain: 0.024 + t * 0.004 },
      ...(strong || t >= 2
        ? [{ freq: base * 0.48, endFreq: base * 0.32, duration: 0.09, type: 'triangle', gain: 0.015 }]
        : []),
    ],
    noise: { duration: 0.035 + t * 0.006, gain: 0.009 + t * 0.002, filter: 1300 - t * 140 },
  };
}

export function impactRecipe(kind = 'steel') {
  if (kind === 'brick') {
    return {
      tones: [{ freq: 132, endFreq: 88, duration: 0.045, type: 'square', gain: 0.012 }],
      noise: { duration: 0.055, gain: 0.014, filter: 620 },
    };
  }
  if (kind === 'bossArmor') {
    return {
      tones: [
        { freq: 820, endFreq: 420, duration: 0.08, type: 'square', gain: 0.018 },
        { freq: 116, endFreq: 92, duration: 0.07, type: 'triangle', gain: 0.012 },
      ],
      noise: { duration: 0.03, gain: 0.008, filter: 1900 },
    };
  }
  return {
    tones: [
      { freq: 410, endFreq: 238, duration: 0.055, type: 'square', gain: 0.014 },
      { freq: 122, endFreq: 96, duration: 0.06, type: 'triangle', gain: 0.008 },
    ],
    noise: { duration: 0.025, gain: 0.006, filter: 2400 },
  };
}

export function explosionRecipe({ boss = false, heavy = false } = {}) {
  if (boss) {
    return {
      tones: [
        { freq: 94, endFreq: 38, duration: 0.32, type: 'sawtooth', gain: 0.04 },
        { freq: 54, endFreq: 30, duration: 0.42, type: 'triangle', gain: 0.026, delay: 0.025 },
      ],
      noise: { duration: 0.28, gain: 0.032, filter: 520 },
    };
  }
  return {
    tones: [
      { freq: heavy ? 108 : 142, endFreq: heavy ? 52 : 72, duration: heavy ? 0.22 : 0.15, type: 'sawtooth', gain: heavy ? 0.032 : 0.022 },
    ],
    noise: { duration: heavy ? 0.18 : 0.11, gain: heavy ? 0.024 : 0.017, filter: heavy ? 680 : 880 },
  };
}

export function bossAlertRecipe(phase = 1) {
  if (phase === 2) {
    return {
      tones: [
        { freq: 138, endFreq: 92, duration: 0.16, type: 'sawtooth', gain: 0.026 },
        { freq: 184, endFreq: 122, duration: 0.16, type: 'sawtooth', gain: 0.022, delay: 0.14 },
      ],
      noise: null,
    };
  }
  return {
    tones: [
      { freq: 96, endFreq: 96, duration: 0.12, type: 'square', gain: 0.024 },
      { freq: 128, endFreq: 128, duration: 0.12, type: 'square', gain: 0.021, delay: 0.13 },
      { freq: 84, endFreq: 70, duration: 0.17, type: 'sawtooth', gain: 0.026, delay: 0.27 },
    ],
    noise: null,
  };
}

export function pickupRecipe(type = 'utility') {
  const arsenal = type === 'arsenal';
  return {
    tones: arsenal
      ? [
          { freq: 520, endFreq: 760, duration: 0.09, type: 'square', gain: 0.018 },
          { freq: 760, endFreq: 1040, duration: 0.11, type: 'triangle', gain: 0.016, delay: 0.075 },
        ]
      : [
          { freq: 620, endFreq: 820, duration: 0.075, type: 'square', gain: 0.015 },
          { freq: 820, endFreq: 940, duration: 0.08, type: 'triangle', gain: 0.012, delay: 0.06 },
        ],
    noise: null,
  };
}

export function createAudioSystem() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let activeVoices = 0;
  let peakVoices = 0;
  let eventCount = 0;
  let rateLimited = 0;
  const lastEvent = new Map();

  function ensure() {
    if (ctx) return ctx;
    const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtor) return null;

    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.74;
    master.connect(ctx.destination);

    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.5));
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let seed = 0x5a17;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = ((seed / 0xffffffff) * 2 - 1) * 0.92;
    }
    return ctx;
  }

  function unlock() {
    const audio = ensure();
    if (audio?.state === 'suspended') audio.resume().catch(() => {});
  }

  function rateLimit(key, intervalMs) {
    const now = globalThis.performance?.now?.() ?? Date.now();
    const previous = lastEvent.get(key) ?? -Infinity;
    if (now - previous < intervalMs) {
      rateLimited++;
      return true;
    }
    lastEvent.set(key, now);
    return false;
  }

  function reserveVoice() {
    if (activeVoices >= MAX_AUDIO_VOICES) {
      rateLimited++;
      return false;
    }
    activeVoices++;
    peakVoices = Math.max(peakVoices, activeVoices);
    return true;
  }

  function releaseVoice() {
    activeVoices = Math.max(0, activeVoices - 1);
  }

  function pulse({ freq = 220, endFreq = freq, duration = 0.05, type = 'square', gain = 0.02, delay = 0 } = {}) {
    const audio = ensure();
    if (!audio || !master || !reserveVoice()) return;

    try {
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      const start = audio.currentTime + Math.max(0, delay);
      const end = start + Math.max(0.01, duration);
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), end);
      amp.gain.setValueAtTime(Math.max(0.0001, gain), start);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(amp).connect(master);
      osc.onended = releaseVoice;
      osc.start(start);
      osc.stop(end + 0.005);
    } catch {
      releaseVoice();
    }
  }

  function noise({ duration = 0.05, gain = 0.01, filter = 900, delay = 0 } = {}) {
    const audio = ensure();
    if (!audio || !master || !noiseBuffer || !reserveVoice()) return;

    try {
      const source = audio.createBufferSource();
      const biquad = audio.createBiquadFilter();
      const amp = audio.createGain();
      const start = audio.currentTime + Math.max(0, delay);
      const end = start + Math.max(0.01, duration);
      source.buffer = noiseBuffer;
      biquad.type = 'lowpass';
      biquad.frequency.value = filter;
      amp.gain.setValueAtTime(Math.max(0.0001, gain), start);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      source.connect(biquad).connect(amp).connect(master);
      source.onended = releaseVoice;
      source.start(start);
      source.stop(end + 0.005);
    } catch {
      releaseVoice();
    }
  }

  function playRecipe(recipe) {
    if (!recipe) return;
    eventCount++;
    for (const part of recipe.tones || []) pulse(part);
    if (recipe.noise) noise(recipe.noise);
  }

  return {
    unlock,
    tone(freq = 220, duration = 0.05, type = 'square', gain = 0.04) {
      playRecipe({ tones: [{ freq, endFreq: freq, duration, type, gain }], noise: null });
    },
    cannon(options = {}) {
      const key = options.player
        ? `player-cannon-${options.slot || 1}`
        : options.boss
          ? 'boss-cannon'
          : 'enemy-cannon';
      if (rateLimit(key, options.player ? 38 : 32)) return;
      playRecipe(cannonRecipe(options));
    },
    impact(kind = 'steel') {
      if (rateLimit(`impact-${kind}`, kind === 'brick' ? 28 : 22)) return;
      playRecipe(impactRecipe(kind));
    },
    explosion(options = {}) {
      if (rateLimit(options.boss ? 'boss-explosion' : 'explosion', options.boss ? 120 : 38)) return;
      playRecipe(explosionRecipe(options));
    },
    pickup(type = 'utility') {
      if (rateLimit('pickup', 55)) return;
      playRecipe(pickupRecipe(type));
    },
    bossAlert(phase = 1) {
      if (rateLimit(`boss-alert-${phase}`, 500)) return;
      playRecipe(bossAlertRecipe(phase));
    },
    track(slot = 1, speed = 1) {
      const interval = Math.max(72, 128 - Math.min(1.4, Math.max(0.7, speed)) * 28);
      if (rateLimit(`track-${slot}`, interval)) return;
      playRecipe({
        tones: [{ freq: slot === 2 ? 92 : 78, endFreq: 62, duration: 0.024, type: 'square', gain: 0.0045 }],
        noise: { duration: 0.018, gain: 0.0035, filter: 520 },
      });
    },
    debug() {
      return {
        supported: Boolean(globalThis.AudioContext || globalThis.webkitAudioContext),
        state: ctx?.state || 'uninitialized',
        activeVoices,
        peakVoices,
        eventCount,
        rateLimited,
        maxVoices: MAX_AUDIO_VOICES,
      };
    },
  };
}

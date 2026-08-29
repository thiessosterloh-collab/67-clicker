// Self-contained synth audio engine: SFX + procedurally scheduled music "discs".
// No external audio files — everything is generated with the WebAudio API.
const Audio67 = (() => {
  "use strict";

  let ctx = null;
  let masterGain, musicGain, sfxGain;
  let muted = false;
  let unmutedVolume = 0.7;

  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    sfxGain.gain.value = 0.55;
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    masterGain.gain.value = muted ? 0 : unmutedVolume;
  }

  function init() {
    ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
  }

  // ---------- noise buffer (for real-feeling wind / rumble / boom effects) ----------
  let noiseBuffer = null;
  function getNoiseBuffer() {
    ensureCtx();
    if (noiseBuffer) return noiseBuffer;
    const len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // ---------- note name -> frequency ----------
  const SEMITONE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  function noteFreq(name) {
    const m = /^([A-G]#?)(\d)$/.exec(name);
    if (!m) return 0;
    const midi = (parseInt(m[2], 10) + 1) * 12 + SEMITONE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---------- one-shot SFX ----------
  function blip(freq, dur, type, gainMult, when) {
    ensureCtx();
    const t0 = when != null ? when : ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.5 * gainMult, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function playTap(key) {
    if (!ctx) return;
    blip(key === "a" ? noteFreq("A5") : noteFreq("D6"), 0.09, "triangle", 1);
  }

  function playMilestone() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    ["C5", "E5", "G5"].forEach((n, i) => blip(noteFreq(n), 0.22, "square", 0.7, t0 + i * 0.07));
  }

  function playAchievement() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, t0);
    g.gain.setValueAtTime(0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.5);
    ["C5", "E5", "G5", "C6", "E6"].forEach((n, i) => blip(noteFreq(n), 0.35, "square", 0.75, t0 + i * 0.09));
  }

  function playPurchase() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    ["C5", "E5", "G5", "C6"].forEach((n, i) => blip(noteFreq(n), 0.25, "triangle", 0.8, t0 + i * 0.06));
  }

  function playSonicBoom() {
    ensureCtx();
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2200, t0);
    filter.frequency.exponentialRampToValueAtTime(90, t0 + 0.35);
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + 0.45);

    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(120, t0);
    sub.frequency.exponentialRampToValueAtTime(35, t0 + 0.3);
    subG.gain.setValueAtTime(0.7, t0);
    subG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    sub.connect(subG);
    subG.connect(sfxGain);
    sub.start(t0);
    sub.stop(t0 + 0.4);
  }

  function playRocketRumble() {
    ensureCtx();
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220, t0);
    filter.frequency.linearRampToValueAtTime(70, t0 + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.1);
    g.gain.linearRampToValueAtTime(0, t0 + 1.4);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + 1.45);
  }

  function playEmpty() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
    g.gain.setValueAtTime(0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.16);
  }

  // ---------- continuous wind (real-ish filtered noise, intensity follows speed) ----------
  let windSrc = null, windFilter = null, windGain = null;
  function ensureWind() {
    if (windSrc) return;
    ensureCtx();
    windSrc = ctx.createBufferSource();
    windSrc.buffer = getNoiseBuffer();
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(sfxGain);
    windSrc.start();
  }
  function setWindIntensity(intensity) {
    if (!ctx) return;
    ensureWind();
    const clamped = Math.max(0, Math.min(1, intensity));
    windGain.gain.setTargetAtTime(clamped * 0.4, ctx.currentTime, 0.15);
    windFilter.frequency.setTargetAtTime(300 + clamped * 900, ctx.currentTime, 0.2);
  }

  function playLand() {
    if (!ctx) return;
    ensureCtx();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.2);
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  // ---------- music tracks ----------
  // each track: tempo (BPM), and up to two layers (bass/lead), each a looping
  // pattern of { n: noteName|null, d: durationInBeats }
  const TRACKS = {
    arcade: {
      name: "Arcade Pulse",
      tempo: 132,
      bass: { wave: "triangle", gain: 0.9, pattern: [
        { n: "C3", d: 0.5 }, { n: "C3", d: 0.5 }, { n: "G2", d: 0.5 }, { n: "G2", d: 0.5 },
        { n: "A2", d: 0.5 }, { n: "A2", d: 0.5 }, { n: "F2", d: 0.5 }, { n: "F2", d: 0.5 },
      ] },
      lead: { wave: "square", gain: 0.5, pattern: [
        { n: "C5", d: 0.25 }, { n: "E5", d: 0.25 }, { n: "G5", d: 0.25 }, { n: "E5", d: 0.25 },
        { n: "C5", d: 0.25 }, { n: "G4", d: 0.25 }, { n: null, d: 0.25 }, { n: "A4", d: 0.25 },
        { n: "C5", d: 0.25 }, { n: "D5", d: 0.25 }, { n: "F5", d: 0.25 }, { n: "D5", d: 0.25 },
        { n: "C5", d: 0.25 }, { n: "A4", d: 0.25 }, { n: null, d: 0.25 }, { n: "G4", d: 0.25 },
      ] },
    },
    zerog: {
      name: "Zero-G",
      tempo: 66,
      bass: { wave: "sine", gain: 0.7, pattern: [
        { n: "C2", d: 4 }, { n: "A1", d: 4 }, { n: "F1", d: 4 }, { n: "G1", d: 4 },
      ] },
      lead: { wave: "sine", gain: 0.4, pattern: [
        { n: "E4", d: 2 }, { n: "G4", d: 2 }, { n: "C5", d: 2 }, { n: null, d: 1 }, { n: "A4", d: 1 },
        { n: "F4", d: 2 }, { n: "A4", d: 2 }, { n: "D5", d: 2 }, { n: null, d: 2 },
      ] },
    },
    retro: {
      name: "Retro Wave",
      tempo: 100,
      bass: { wave: "sawtooth", gain: 0.55, pattern: [
        { n: "A2", d: 0.5 }, { n: null, d: 0.5 }, { n: "A2", d: 0.5 }, { n: "E2", d: 0.5 },
        { n: "F2", d: 0.5 }, { n: null, d: 0.5 }, { n: "F2", d: 0.5 }, { n: "C2", d: 0.5 },
      ] },
      lead: { wave: "triangle", gain: 0.55, pattern: [
        { n: "A4", d: 0.5 }, { n: "C5", d: 0.5 }, { n: "E5", d: 0.5 }, { n: "C5", d: 0.5 },
        { n: "F4", d: 0.5 }, { n: "A4", d: 0.5 }, { n: "C5", d: 0.5 }, { n: "A4", d: 0.5 },
      ] },
    },
    deep: {
      name: "Deep Space",
      tempo: 46,
      bass: { wave: "sine", gain: 0.8, pattern: [
        { n: "C2", d: 6 }, { n: "G1", d: 6 },
      ] },
      lead: { wave: "sine", gain: 0.3, pattern: [
        { n: "G5", d: 0.5 }, { n: null, d: 5.5 }, { n: "D5", d: 0.5 }, { n: null, d: 3.5 }, { n: "E5", d: 0.5 }, { n: null, d: 1.5 },
      ] },
    },
    off: { name: "Off", tempo: 100, bass: null, lead: null },
  };

  let currentTrackId = "arcade";
  let schedulerHandle = null;
  let nextBassTime = 0, bassIdx = 0;
  let nextLeadTime = 0, leadIdx = 0;
  const scheduleAhead = 0.15;
  const tickMs = 25;

  function scheduleNote(layer, freqName, t0, durSec) {
    if (freqName == null) return;
    ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = layer.wave;
    osc.frequency.value = noteFreq(freqName);
    const peak = 0.35 * layer.gain;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.02);
    g.gain.setValueAtTime(peak, Math.max(t0 + 0.02, t0 + durSec - 0.08));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + durSec);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + durSec + 0.05);
  }

  function schedulerTick() {
    const track = TRACKS[currentTrackId];
    if (!track || !ctx) return;
    const secPerBeat = 60 / track.tempo;
    const horizon = ctx.currentTime + scheduleAhead;

    if (track.bass) {
      while (nextBassTime < horizon) {
        const step = track.bass.pattern[bassIdx % track.bass.pattern.length];
        scheduleNote(track.bass, step.n, nextBassTime, step.d * secPerBeat * 0.95);
        nextBassTime += step.d * secPerBeat;
        bassIdx++;
      }
    }
    if (track.lead) {
      while (nextLeadTime < horizon) {
        const step = track.lead.pattern[leadIdx % track.lead.pattern.length];
        scheduleNote(track.lead, step.n, nextLeadTime, step.d * secPerBeat * 0.9);
        nextLeadTime += step.d * secPerBeat;
        leadIdx++;
      }
    }
  }

  function stopScheduler() {
    if (schedulerHandle) {
      clearInterval(schedulerHandle);
      schedulerHandle = null;
    }
  }

  function startScheduler() {
    stopScheduler();
    ensureCtx();
    nextBassTime = ctx.currentTime + 0.05;
    nextLeadTime = ctx.currentTime + 0.05;
    bassIdx = 0;
    leadIdx = 0;
    if (currentTrackId === "off") return;
    schedulerHandle = setInterval(schedulerTick, tickMs);
    schedulerTick();
  }

  function setTrack(id) {
    if (!TRACKS[id]) return;
    currentTrackId = id;
    localStorage.setItem("sixseven_track", id);
    ensureCtx();
    const t0 = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t0);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t0);
    musicGain.gain.linearRampToValueAtTime(0, t0 + 0.12);
    setTimeout(() => {
      startScheduler();
      if (ctx) {
        const t1 = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t1);
        musicGain.gain.setValueAtTime(0, t1);
        musicGain.gain.linearRampToValueAtTime(0.35, t1 + 0.25);
      }
    }, 140);
  }

  function getTracks() {
    return Object.keys(TRACKS).map((id) => ({ id, name: TRACKS[id].name }));
  }

  function currentTrack() {
    return currentTrackId;
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem("sixseven_muted", muted ? "1" : "0");
    if (ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : unmutedVolume, ctx.currentTime, 0.05);
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function restoreSettings() {
    const savedTrack = localStorage.getItem("sixseven_track");
    if (savedTrack && TRACKS[savedTrack]) currentTrackId = savedTrack;
    muted = localStorage.getItem("sixseven_muted") === "1";
  }
  restoreSettings();

  function startMusic() {
    init();
    if (masterGain) masterGain.gain.value = muted ? 0 : unmutedVolume;
    startScheduler();
  }

  return {
    init,
    startMusic,
    playTap,
    playMilestone,
    playAchievement,
    playPurchase,
    playLand,
    playSonicBoom,
    playRocketRumble,
    playEmpty,
    setWindIntensity,
    setTrack,
    getTracks,
    currentTrack,
    toggleMute,
    isMuted,
  };
})();

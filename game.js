(() => {
  "use strict";

  // ---------- Canvas setup ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Utility ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const r = Math.round(lerp(a[0], b[0], t));
    const g = Math.round(lerp(a[1], b[1], t));
    const bl = Math.round(lerp(a[2], b[2], t));
    return `rgb(${r},${g},${bl})`;
  }

  // deterministic pseudo-random hash, stable per key
  function hash(n) {
    let x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------- Real-world constants ----------
  const C = 299792458;              // speed of light, m/s
  const AU = 149597870700;          // astronomical unit, m
  const LY = 9.4607304725808e15;    // light-year, m
  const GRAVITY = 9.81;             // real Earth gravity, m/s^2

  // ---------- Game tuning ----------
  const TAP_IMPULSE_BASE = 8;       // m/s per valid alternation (2x — faster overall progress)
  const COMBO_BONUS = 1.2;          // extra m/s per combo step (2x)
  const MAX_COMBO_BONUS_STEPS = 250;   // 10x — bigger combos matter over a much bigger world
  const MAX_VELOCITY = 1e15;        // safety ceiling, raised 100x — practically unbounded
  const MIN_VELOCITY = -3000;
  const COMBO_WINDOW = 520;         // ms allowed between alternating presses
  const IDLE_CURRENCY_RATE = 0.008; // 67s per m/s of velocity per second (~3x — faster economy)
  const FALL_GRAVITY_MULT = 22;     // once you're actually descending, gravity hits far harder

  const WINGS_MAX = 120;    // 10x
  const TRAIL_MAX = 120;    // 10x
  const ENGINE_MAX = 6000;  // 12x
  const STAMINA_MAX = 700;  // ~12x
  const STAMINA_DRAIN_PER_TAP = 8;

  const ENGINE_FUEL_MAX = 60;     // seconds of continuous engine runtime on a full tank
  const ENGINE_REFUEL_TIME = 25;  // seconds to fully refuel once the tank runs dry

  // ---------- Real-world distances (meters) ----------
  const KARMAN = 100000;            // edge of space
  const ISS = 400000;               // low Earth orbit
  const MOON = 384400000;           // 384,400 km
  const MARS = 2.25e11;
  const JUPITER = 6.287e11;
  const SATURN = 1.28e12;
  const URANUS = 2.72e12;
  const NEPTUNE = 4.35e12;
  const PLUTO = 5.9e12;
  const HELIOPAUSE = 1.8e13;        // ~120 AU, Voyager 1 territory
  const PROXIMA = 4.0e16;           // ~4.24 ly, nearest star
  const GALACTIC_CENTER = 26000 * LY;   // ~26,000 ly, real distance to the core
  const GALAXY_FAR_EDGE = 160000 * LY;  // full diameter of the Milky Way's disk — actually leaving the galaxy
  const ANDROMEDA = 2.4e22;         // ~2.5 million ly, beyond the galaxy entirely

  const ZONES = [
    { start: 0,               top: "#6ec6ff", bottom: "#eaf6ff" }, // city
    { start: 2000,            top: "#4fa8e0", bottom: "#cfe9ff" }, // clouds
    { start: 9000,            top: "#1c6fb0", bottom: "#a9d8f5" }, // planes cruise
    { start: 50000,           top: "#0b3d6b", bottom: "#5c93c2" }, // stratosphere / rockets
    { start: KARMAN,          top: "#020814", bottom: "#16324f" }, // Karman line — edge of space
    { start: 2000000,         top: "#000000", bottom: "#050818" }, // deep space transit
    { start: 6e12,            top: "#000000", bottom: "#05040d" }, // outer solar system
    { start: HELIOPAUSE,      top: "#020103", bottom: "#0c0518" }, // interstellar
    { start: GALACTIC_CENTER, top: "#050110", bottom: "#170a2e" }, // galactic core
    { start: GALAXY_FAR_EDGE, top: "#000000", bottom: "#030103" }, // intergalactic void
  ];

  const MILESTONES = [
    { at: 50,               text: "Liftoff! 6... 7..." },
    { at: 2000,             text: "Leaving the city..." },
    { at: 9000,             text: "Cruising altitude — planes below!" },
    { at: KARMAN,           text: "The Kármán Line — official edge of space!" },
    { at: ISS,              text: "ISS altitude — satellites all around." },
    { at: MOON,             text: "The Moon! 384,400 km from home." },
    { at: MARS,             text: "Mars, dead ahead." },
    { at: JUPITER,          text: "Jupiter looms." },
    { at: SATURN,           text: "Saturn's rings!" },
    { at: URANUS,           text: "Uranus, tilted and cold." },
    { at: NEPTUNE,          text: "Neptune — edge of the known planets." },
    { at: PLUTO,            text: "Pluto. Still counts." },
    { at: HELIOPAUSE,       text: "The Heliopause — leaving the Sun's influence." },
    { at: PROXIMA,          text: "Proxima Centauri — the nearest star. Countless more ahead." },
    { at: GALACTIC_CENTER,  text: "The Galactic Center. You are basically a myth now." },
    { at: GALAXY_FAR_EDGE,  text: "You've crossed the entire Milky Way — 160,000 light-years. You actually left the galaxy." },
    { at: ANDROMEDA,        text: "Andromeda. Okay, now you're just showing off." },
  ];

  const LANDMARKS = [
    { at: MOON,           r: 130, color: "#b9b6ad", type: "moon" },
    { at: MARS,           r: 46,  color: "#c1440e", type: "planet" },
    { at: JUPITER,        r: 100, color: "#d8b26a", type: "planet" },
    { at: SATURN,         r: 84,  color: "#e3c98f", type: "planet", ring: true },
    { at: URANUS,         r: 58,  color: "#7fd8d8", type: "planet" },
    { at: NEPTUNE,        r: 60,  color: "#4f7ecb", type: "planet" },
    { at: PLUTO,          r: 20,  color: "#c9b8a3", type: "planet" },
    { at: PROXIMA,        r: 70,  color: "#ffe9d0", type: "star" },
    { at: GALACTIC_CENTER, r: 140, color: "#fff3d0", type: "core" },
    { at: ANDROMEDA,      r: 90,  color: "#c9c8ff", type: "galaxy" },
  ];

  // ---------- Many, many solar systems — the "levels" of the galaxy crossing ----------
  // Real stellar density means countless systems between here and the far side of the
  // disk; we render a representative sample, spaced by order of magnitude (log-distance)
  // across the real span from our nearest neighbor star out to the far edge of the galaxy.
  const NUM_SOLAR_SYSTEMS = 90;
  const STAR_PALETTE = ["#ffd27a", "#fff3d0", "#a8c8ff", "#ff8a5c", "#e8eaff"];
  const SYS_PLANET_COLORS = ["#c1440e", "#d8b26a", "#7fd8d8", "#4f7ecb", "#c9b8a3", "#e3c98f", "#ff9f6e", "#9fb8ff"];
  const NAME_PREFIXES = ["Kepler", "HD", "Gliese", "TRAPPIST", "Wolf", "Ross", "HIP", "TOI", "Barnard"];

  function genSystemName(seed) {
    const prefix = NAME_PREFIXES[Math.floor(hash(seed + 2.2) * NAME_PREFIXES.length)];
    const num = 100 + Math.floor(hash(seed + 3.3) * 9899);
    return prefix + "-" + num;
  }

  // Each system's objects are laid out SEQUENTIALLY along the distance axis —
  // planet, planet, ..., star — each getting its own tight visibility window, so you
  // meet them one at a time (planet, planet, star, void, planet, planet, star, void...)
  // instead of the whole system appearing as one cluttered cluster.
  const SYSTEM_SPAN_FRACTION = 0.07; // how much of its own distance a system's objects spread across
  const SOLAR_SYSTEMS = [];
  {
    // start right past our own solar system rather than all the way out at Proxima's
    // real distance — brings the first "other system" a lot closer
    const logStart = Math.log10(HELIOPAUSE);
    const logEnd = Math.log10(GALAXY_FAR_EDGE);
    for (let i = 0; i < NUM_SOLAR_SYSTEMS; i++) {
      const frac = i / (NUM_SOLAR_SYSTEMS - 1);
      const centerAt = Math.pow(10, logStart + frac * (logEnd - logStart));
      const seed = i * 7.13 + 1;
      const planetCount = 2 + Math.floor(hash(seed + 0.3) * 4);
      const objectCount = planetCount + 1; // planets, then the star last
      const span = centerAt * SYSTEM_SPAN_FRACTION;
      const step = span / objectCount;
      const startAt = centerAt - span / 2;

      const planets = [];
      for (let p = 0; p < planetCount; p++) {
        planets.push({
          at: startAt + step * p,
          r: 15 + hash(seed + p + 0.7) * 50,
          color: SYS_PLANET_COLORS[Math.floor(hash(seed + p + 0.9) * SYS_PLANET_COLORS.length)],
          ring: hash(seed + p + 1.1) > 0.82,
        });
      }
      SOLAR_SYSTEMS.push({
        at: startAt,
        starAt: startAt + step * planetCount,
        level: i + 1,
        starColor: STAR_PALETTE[Math.floor(hash(seed + 0.2) * STAR_PALETTE.length)],
        starR: 70 + hash(seed + 0.4) * 90,
        name: genSystemName(seed),
        planets,
      });
    }
  }

  // ---------- Achievements (velocity thresholds, m/s) ----------
  const ACHIEVEMENTS = [
    { id: "mach1",    v: 343,          name: "Mach 1",                        desc: "Broke the sound barrier." },
    { id: "escape",   v: 11200,        name: "Escape Velocity",               desc: "Faster than Earth's escape velocity — gravity can't hold you." },
    { id: "onepct",   v: 0.01 * C,     name: "1% Light Speed",                desc: "Now we're getting relativistic." },
    { id: "halfc",    v: 0.5 * C,      name: "Half Light Speed",              desc: "Halfway to being made of pure energy." },
    { id: "c",        v: C,            name: "LIGHT SPEED",                   desc: "Einstein is furious right now." },
    { id: "10c",      v: 10 * C,       name: "Ludicrous Speed",               desc: "Ten times light speed. Physics has left the chat." },
    { id: "100c",     v: 100 * C,      name: "Faster Than Light, Casually",   desc: "One hundred light speeds. No big deal." },
    { id: "1000c",    v: 1000 * C,     name: "Tachyon Certified",             desc: "One thousand times light speed." },
    { id: "systems50", kind: "systems", v: 50,             name: "Grand Tour",  desc: "Passed 50 solar systems on the way through." },
    { id: "galaxyout", kind: "distance", v: GALAXY_FAR_EDGE, name: "Galaxy's Edge", desc: "160,000 light-years — you crossed the entire Milky Way. REBIRTH is now unlocked in the shop." },
  ];

  // ---------- Decorative world objects (seeded, fixed, real-ish altitude bands) ----------
  const buildings = [];
  {
    let x = -40;
    let seed = 1;
    while (x < 2000) {
      const w = 60 + hash(seed) * 70;
      const h = 80 + hash(seed + 0.5) * 260;
      buildings.push({ x, w, h });
      x += w + 8 + hash(seed + 0.2) * 20;
      seed += 1.7;
    }
  }

  const clouds = [];
  for (let i = 0; i < 34; i++) {
    clouds.push({
      x: hash(i * 3.1) * 2000 - 500,
      y: 500 + hash(i * 5.3) * 8500,
      s: 0.6 + hash(i * 7.7) * 1.4,
      speed: 8 + hash(i * 2.1) * 14,
    });
  }

  const birds = [];
  for (let i = 0; i < 24; i++) {
    birds.push({
      x: hash(i * 9.3) * 2000 - 500,
      y: 300 + hash(i * 4.1) * 5000,
      s: 0.7 + hash(i * 6.6) * 0.8,
      speed: 30 + hash(i * 3.3) * 40,
      phase: hash(i * 1.9) * 10,
    });
  }

  const planes = [];
  for (let i = 0; i < 12; i++) {
    planes.push({
      x: hash(i * 11.2) * 2200 - 600,
      y: 9000 + hash(i * 8.4) * 3000,
      s: 0.8 + hash(i * 2.7) * 0.6,
      speed: 40 + hash(i * 5.5) * 30,
      dir: hash(i * 3.9) > 0.5 ? 1 : -1,
    });
  }

  const rockets = [];
  for (let i = 0; i < 8; i++) {
    rockets.push({
      x: hash(i * 13.1) * 900 - 300,
      y: 20000 + hash(i * 6.2) * 70000,
      s: 0.8 + hash(i * 4.4) * 0.6,
    });
  }

  const satellites = [];
  for (let i = 0; i < 8; i++) {
    satellites.push({
      x: hash(i * 15.6) * 1400 - 400,
      y: 300000 + hash(i * 9.9) * 1700000,
      s: 0.8 + hash(i * 1.2) * 0.7,
      speed: 15 + hash(i * 8.8) * 20,
    });
  }

  // ---------- Persistence ----------
  function loadNum(key, fallback) {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  }
  function loadSet(key) {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  const hadPreviousSession = localStorage.getItem("sixseven_lastseen") != null;
  const lastSeen = loadNum("sixseven_lastseen", 0);
  const lastVelocity = loadNum("sixseven_lastvelocity", 0);

  const state = {
    altitude: 0,
    velocity: 0,
    lastKey: null,
    lastPressAt: 0,
    combo: 0,
    best: loadNum("sixseven_best", 0),
    bestVelocity: loadNum("sixseven_bestvelocity", 0),
    rebirthCount: loadNum("sixseven_rebirths", 0),
    leaderboardSyncAccum: 0,
    bank: loadNum("sixseven_bank", 0),
    wingsLevel: clamp(loadNum("sixseven_wings", 0), 0, WINGS_MAX),
    trailLevel: clamp(loadNum("sixseven_trail", 0), 0, TRAIL_MAX),
    engineLevel: clamp(loadNum("sixseven_engine", 0), 0, ENGINE_MAX),
    staminaLevel: clamp(loadNum("sixseven_stamina", 0), 0, STAMINA_MAX),
    stamina: 0,
    exhausted: false,
    engineFuel: ENGINE_FUEL_MAX,
    engineDepleted: false,
    achievements: loadSet("sixseven_achievements"),
    systemsPassed: 0,
    nextSystemIdx: 0,
    running: false,
    paused: false,
    t: 0,
    milestoneIdx: 0,
    aDown: false,
    dDown: false,
    tilt: 0,
    kickPhase: 0,
    particles: [],
    bursts: [],
    landed: true,
    trailEmitAccum: 0,
    saveAccum: 0,
  };

  // grant offline idle earnings from accumulated velocity while the tab was closed
  if (hadPreviousSession && lastVelocity > 0) {
    const elapsed = clamp((Date.now() - lastSeen) / 1000, 0, 6 * 3600);
    const gain = elapsed * lastVelocity * IDLE_CURRENCY_RATE;
    if (gain > 1) {
      state.bank += gain;
      state.pendingWelcomeBack = Math.floor(gain);
    }
  }

  function persistBank() { localStorage.setItem("sixseven_bank", String(Math.floor(state.bank))); }
  function persistLevels() {
    localStorage.setItem("sixseven_wings", String(state.wingsLevel));
    localStorage.setItem("sixseven_trail", String(state.trailLevel));
    localStorage.setItem("sixseven_engine", String(state.engineLevel));
    localStorage.setItem("sixseven_stamina", String(state.staminaLevel));
  }
  function persistSession() {
    localStorage.setItem("sixseven_lastseen", String(Date.now()));
    localStorage.setItem("sixseven_lastvelocity", String(Math.max(state.velocity, 0)));
  }
  window.addEventListener("beforeunload", persistSession);

  function wingsCost(level) { return Math.round(20 * Math.pow(1.45, level)); }
  function trailCost(level) { return Math.round(15 * Math.pow(1.4, level)); }
  function engineCost(level) { return Math.round(22 * Math.pow(1.2, level)); }
  function staminaCost(level) { return Math.round(25 * Math.pow(1.25, level)); }
  function wingsThrustMult(level) { return 1 + level * 0.16; }
  function wingsGravityMult(level) { return 1 - Math.min(level * 0.035, 0.35); }
  function trailTapValue(level) { return 1 + level; }
  function engineAccel(level) { return level <= 0 ? 0 : 8 * Math.pow(1.5, level - 1); }
  function staminaMax(level) { return 100 * Math.pow(1.35, level); }
  function staminaRegenRate(level) { return staminaMax(level) * 0.12; }
  // wings/trail make each tap hit harder and earn more — tax stamina proportionally
  // so that power creep doesn't come for free
  function staminaDrainMult() { return 1 + state.wingsLevel * 0.025 + state.trailLevel * 0.015; }
  // permanent thrust multiplier from rebirthing, doubling each time
  function rebirthMult() { return Math.pow(2, state.rebirthCount); }

  // exponential currency bonus that scales with how far out you are (in decades of
  // real distance), so income keeps pace with the exponentially pricier upgrades
  function distanceRewardMult(distance) {
    const decades = Math.max(0, Math.log10(distance + 1) - 2);
    return Math.pow(1.5, decades);
  }

  state.stamina = staminaMax(state.staminaLevel);

  function fmtDistance(m) {
    if (m < 1000) return Math.floor(m) + " m";
    if (m < 1e6) return (m / 1000).toFixed(2) + " km";
    if (m < 0.1 * AU) return Math.round(m / 1000).toLocaleString() + " km";
    if (m < LY) return (m / AU).toFixed(2) + " AU";
    return (m / LY).toFixed(3) + " ly";
  }

  function fmtVelocity(v) {
    const av = Math.abs(v);
    if (av >= 0.01 * C) return (v / C).toFixed(av >= C ? 2 : 4) + "c";
    if (av >= 340) return (v / 340).toFixed(2) + " Mach";
    return Math.round(v) + " m/s";
  }

  // ---------- DOM ----------
  const altEl = document.getElementById("altitude-value");
  const speedEl = document.getElementById("speed-value");
  const bestEl = document.getElementById("best-value");
  const bankEl = document.getElementById("bank-value");
  const shopBankEl = document.getElementById("shop-bank-value");
  const milestoneEl = document.getElementById("milestone");
  const comboEl = document.getElementById("combo-display");
  const keyAEl = document.getElementById("key-a");
  const keyDEl = document.getElementById("key-d");
  const startScreen = document.getElementById("start-screen");
  const startBtn = document.getElementById("start-btn");
  const shopOpenBtn = document.getElementById("shop-open-btn");
  const shopScreen = document.getElementById("shop-screen");
  const shopCloseBtn = document.getElementById("shop-close-btn");
  const menuBtn = document.getElementById("menu-btn");
  const wingsLevelEl = document.getElementById("wings-level");
  const wingsDescEl = document.getElementById("wings-desc");
  const buyWingsBtn = document.getElementById("buy-wings");
  const trailLevelEl = document.getElementById("trail-level");
  const trailDescEl = document.getElementById("trail-desc");
  const buyTrailBtn = document.getElementById("buy-trail");
  const engineLevelEl = document.getElementById("engine-level");
  const engineDescEl = document.getElementById("engine-desc");
  const buyEngineBtn = document.getElementById("buy-engine");
  const staminaLevelEl = document.getElementById("stamina-level");
  const staminaDescEl = document.getElementById("stamina-desc");
  const buyStaminaBtn = document.getElementById("buy-stamina");
  const rebirthCardEl = document.getElementById("card-rebirth");
  const rebirthLevelEl = document.getElementById("rebirth-level");
  const rebirthDescEl = document.getElementById("rebirth-desc");
  const buyRebirthBtn = document.getElementById("buy-rebirth");
  const staminaFillEl = document.getElementById("stamina-fill");
  const fuelWrapEl = document.getElementById("fuel-wrap");
  const fuelFillEl = document.getElementById("fuel-fill");
  const discRack = document.getElementById("disc-rack");
  const muteBtn = document.getElementById("mute-btn");
  const achievementListEl = document.getElementById("achievement-list");
  const lbSignedOutEl = document.getElementById("leaderboard-signed-out");
  const lbSignedInEl = document.getElementById("leaderboard-signed-in");
  const lbAvatarEl = document.getElementById("leaderboard-avatar");
  const lbUsernameEl = document.getElementById("leaderboard-username");
  const lbSigninBtn = document.getElementById("leaderboard-signin-btn");
  const lbSignoutBtn = document.getElementById("leaderboard-signout-btn");
  const lbListEl = document.getElementById("leaderboard-list");
  const startAuthStatusEl = document.getElementById("start-auth-status");
  const authToastEl = document.getElementById("auth-toast");

  function refreshBankDisplays() {
    bankEl.textContent = Math.floor(state.bank).toLocaleString();
    shopBankEl.textContent = Math.floor(state.bank).toLocaleString();
  }

  function refreshShopUI() {
    refreshBankDisplays();

    const wLevel = state.wingsLevel;
    const wMaxed = wLevel >= WINGS_MAX;
    wingsLevelEl.textContent = wMaxed ? "MAX" : "Lv " + wLevel;
    wingsDescEl.textContent = `+${Math.round((wingsThrustMult(wLevel) - 1) * 100)}% thrust per 67 · softer falls · costs more stamina per tap`;
    setBuyState(buyWingsBtn, wMaxed, wingsCost(wLevel));

    const tLevel = state.trailLevel;
    const tMaxed = tLevel >= TRAIL_MAX;
    trailLevelEl.textContent = tMaxed ? "MAX" : "Lv " + tLevel;
    trailDescEl.textContent = `${trailTapValue(tLevel)} 67s earned per A/D press · costs more stamina per tap`;
    setBuyState(buyTrailBtn, tMaxed, trailCost(tLevel));

    const eLevel = state.engineLevel;
    const eMaxed = eLevel >= ENGINE_MAX;
    engineLevelEl.textContent = eMaxed ? "MAX" : "Lv " + eLevel;
    engineDescEl.textContent = eLevel <= 0
      ? "Passive thrust — keeps accelerating even when you're not tapping. Runs on a 60s fuel tank; land back on the ground to refuel."
      : `+${engineAccel(eLevel).toLocaleString(undefined, { maximumFractionDigits: 1 })} m/s² of passive thrust · 60s tank, refuels on landing`;
    setBuyState(buyEngineBtn, eMaxed, engineCost(eLevel));

    const sLevel = state.staminaLevel;
    const sMaxed = sLevel >= STAMINA_MAX;
    staminaLevelEl.textContent = sMaxed ? "MAX" : "Lv " + sLevel;
    staminaDescEl.textContent = `Max stamina: ${Math.round(staminaMax(sLevel))} — longer climbs before you drop. Recharges on the ground.`;
    setBuyState(buyStaminaBtn, sMaxed, staminaCost(sLevel));

    if (state.achievements.has("galaxyout")) {
      rebirthCardEl.classList.remove("hidden");
      rebirthLevelEl.textContent = "×" + rebirthMult().toLocaleString();
      rebirthDescEl.textContent = `Restart from Earth with ×${(rebirthMult() * 2).toLocaleString()} thrust (up from ×${rebirthMult().toLocaleString()}). Keeps your 67s, upgrades, and records.`;
    }

    refreshAchievementsUI();
  }

  function setBuyState(btn, maxed, cost) {
    if (maxed) {
      btn.innerHTML = "MAXED";
      btn.classList.add("maxed");
      btn.disabled = true;
    } else {
      btn.innerHTML = `<span>${cost.toLocaleString()}</span> 67s`;
      btn.classList.remove("maxed");
      btn.disabled = state.bank < cost;
    }
  }

  function buyWings() {
    if (state.wingsLevel >= WINGS_MAX) return;
    const cost = wingsCost(state.wingsLevel);
    if (state.bank < cost) return;
    state.bank -= cost;
    state.wingsLevel++;
    persistBank();
    persistLevels();
    Audio67.playPurchase();
    refreshShopUI();
  }

  function buyTrail() {
    if (state.trailLevel >= TRAIL_MAX) return;
    const cost = trailCost(state.trailLevel);
    if (state.bank < cost) return;
    state.bank -= cost;
    state.trailLevel++;
    persistBank();
    persistLevels();
    Audio67.playPurchase();
    refreshShopUI();
  }

  function buyEngine() {
    if (state.engineLevel >= ENGINE_MAX) return;
    const cost = engineCost(state.engineLevel);
    if (state.bank < cost) return;
    state.bank -= cost;
    state.engineLevel++;
    persistBank();
    persistLevels();
    Audio67.playPurchase();
    refreshShopUI();
  }

  function buyStamina() {
    if (state.staminaLevel >= STAMINA_MAX) return;
    const cost = staminaCost(state.staminaLevel);
    if (state.bank < cost) return;
    state.bank -= cost;
    state.staminaLevel++;
    persistBank();
    persistLevels();
    Audio67.playPurchase();
    refreshShopUI();
  }

  function performRebirth() {
    if (!state.achievements.has("galaxyout")) return;
    state.rebirthCount++;
    localStorage.setItem("sixseven_rebirths", String(state.rebirthCount));

    // back to Earth, stronger than ever — records, currency and upgrades are kept
    state.altitude = 0;
    state.velocity = 0;
    state.combo = 0;
    state.lastKey = null;
    state.tilt = 0;
    state.landed = true;
    state.milestoneIdx = 0;
    state.nextSystemIdx = 0;
    state.particles = [];
    state.bursts = [];
    state.stamina = staminaMax(state.staminaLevel);
    state.exhausted = false;
    state.engineFuel = ENGINE_FUEL_MAX;
    state.engineDepleted = false;

    Audio67.playAchievement();
    showMilestone(`🌌 REBIRTH! Thrust now ×${rebirthMult().toLocaleString()}. Starting over from Earth, stronger than ever.`, 5000);
    refreshShopUI();
  }

  buyWingsBtn.addEventListener("click", buyWings);
  buyTrailBtn.addEventListener("click", buyTrail);
  buyEngineBtn.addEventListener("click", buyEngine);
  buyStaminaBtn.addEventListener("click", buyStamina);
  buyRebirthBtn.addEventListener("click", performRebirth);

  // ---------- Achievements UI ----------
  function achievementThresh(a) {
    if (a.kind === "distance") return fmtDistance(a.v);
    if (a.kind === "systems") return a.v + " systems";
    return fmtVelocity(a.v);
  }

  function refreshAchievementsUI() {
    achievementListEl.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = state.achievements.has(a.id);
      const el = document.createElement("div");
      el.className = "achievement" + (unlocked ? " unlocked" : "");
      el.innerHTML = `
        <div class="achievement-icon">${unlocked ? "🏆" : "🔒"}</div>
        <div class="achievement-text">
          <div class="achievement-name">${unlocked ? a.name : "???"}</div>
          <div class="achievement-desc">${unlocked ? a.desc : "Reach " + achievementThresh(a) + " to unlock."}</div>
        </div>
        <div class="achievement-thresh">${achievementThresh(a)}</div>
      `;
      achievementListEl.appendChild(el);
    });
  }

  function achievementProgress(a) {
    if (a.kind === "distance") return state.altitude;
    if (a.kind === "systems") return state.systemsPassed;
    return state.velocity;
  }

  function checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (!state.achievements.has(a.id) && achievementProgress(a) >= a.v) {
        state.achievements.add(a.id);
        localStorage.setItem("sixseven_achievements", JSON.stringify([...state.achievements]));
        Audio67.playAchievement();
        if (a.id === "mach1") Audio67.playSonicBoom();
        showMilestone("🏆 " + a.name + " — " + a.desc, 4200);
      }
    }
  }

  // ---------- Leaderboard (Firebase) ----------
  function updateLeaderboardAuthUI(user) {
    if (user) {
      lbSignedOutEl.classList.add("hidden");
      lbSignedInEl.classList.remove("hidden");
      lbAvatarEl.src = user.photoURL || "";
      lbUsernameEl.textContent = user.displayName || "Player";
      startAuthStatusEl.classList.remove("hidden");
      startAuthStatusEl.innerHTML = `${user.photoURL ? `<img src="${user.photoURL}" alt="">` : ""}Signed in as ${escapeHtml(user.displayName || "Player")}`;
      submitLeaderboardScore();
    } else {
      lbSignedOutEl.classList.remove("hidden");
      lbSignedInEl.classList.add("hidden");
      startAuthStatusEl.classList.add("hidden");
    }
  }

  let authToastTimer = null;
  function showAuthToast(text, kind) {
    authToastEl.textContent = text;
    authToastEl.className = kind;
    clearTimeout(authToastTimer);
    authToastTimer = setTimeout(() => { authToastEl.className = "hidden"; }, 6000);
  }
  window.addEventListener("leaderboard-signin-success", (e) => {
    showAuthToast(`✅ Signed in as ${e.detail.displayName || "Player"}!`, "success");
  });
  window.addEventListener("leaderboard-signin-error", (e) => {
    showAuthToast(`❌ Sign-in failed: ${e.detail}`, "error");
  });

  // leaderboard.js is a deferred ES module, so it may not have run yet when this
  // (classic, synchronous) script does — wire up once it's actually ready.
  function wireLeaderboard() {
    window.Leaderboard.onAuthChange(updateLeaderboardAuthUI);
  }
  if (window.Leaderboard) wireLeaderboard();
  else window.addEventListener("leaderboard-ready", wireLeaderboard, { once: true });

  lbSigninBtn.addEventListener("click", async () => {
    if (!window.Leaderboard) return;
    lbSigninBtn.disabled = true;
    lbSigninBtn.textContent = "Signing in…";
    const ok = await window.Leaderboard.signInWithGoogle();
    lbSigninBtn.disabled = false;
    lbSigninBtn.textContent = "Sign in with Google";
    if (ok) refreshLeaderboardUI();
  });
  lbSignoutBtn.addEventListener("click", async () => {
    if (!window.Leaderboard) return;
    await window.Leaderboard.signOutUser();
    refreshLeaderboardUI();
  });

  async function submitLeaderboardScore() {
    if (!window.Leaderboard || !window.Leaderboard.getCurrentUser()) return;
    await window.Leaderboard.submitScore({
      bestDistance: state.best,
      bestVelocity: state.bestVelocity,
      achievementsCount: state.achievements.size,
      systemsPassed: state.systemsPassed,
      engineLevel: state.engineLevel,
      rebirths: state.rebirthCount,
    });
  }

  async function refreshLeaderboardUI() {
    if (!window.Leaderboard) {
      lbListEl.innerHTML = '<div class="lb-empty">Leaderboard unavailable.</div>';
      return;
    }
    lbListEl.innerHTML = '<div class="lb-empty">Loading…</div>';
    const rows = await window.Leaderboard.fetchLeaderboard(50);
    const me = window.Leaderboard.getCurrentUser();
    if (rows.length === 0) {
      lbListEl.innerHTML = '<div class="lb-empty">No scores yet — be the first!</div>';
      return;
    }
    const header = `
      <div class="lb-row lb-header">
        <div>#</div><div>Player</div><div>Distance</div><div>Top Speed</div><div>Achv</div><div>Systems</div><div>Engine</div><div>Reborn</div>
      </div>`;
    const body = rows.map((r, i) => `
      <div class="lb-row${me && r.id === me.uid ? " lb-me" : ""}">
        <div class="lb-rank">${i + 1}</div>
        <div class="lb-player">${r.photoURL ? `<img src="${r.photoURL}" alt="">` : ""}<span class="lb-name">${escapeHtml(r.name || "Player")}</span></div>
        <div>${fmtDistance(r.bestDistance || 0)}</div>
        <div>${fmtVelocity(r.bestVelocity || 0)}</div>
        <div>${r.achievementsCount || 0}/${ACHIEVEMENTS.length}</div>
        <div>${r.systemsPassed || 0}</div>
        <div>Lv${r.engineLevel || 0}</div>
        <div>×${Math.pow(2, r.rebirths || 0).toLocaleString()}</div>
      </div>`).join("");
    lbListEl.innerHTML = header + body;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ---------- Shop / menu wiring ----------
  let audioStarted = false;
  function ensureAudioStarted() {
    if (audioStarted) return;
    audioStarted = true;
    Audio67.startMusic();
    updateMuteBtn();
  }

  function updateMuteBtn() {
    muteBtn.textContent = Audio67.isMuted() ? "🔇 SOUND OFF" : "🔊 SOUND ON";
  }

  function populateDiscRack() {
    discRack.innerHTML = "";
    Audio67.getTracks().forEach((track) => {
      const el = document.createElement("div");
      el.className = "disc" + (track.id === Audio67.currentTrack() ? " active" : "");
      el.dataset.id = track.id;
      el.innerHTML = `<div class="disc-art"></div><div class="disc-name">${track.name}</div>`;
      el.addEventListener("click", () => {
        ensureAudioStarted();
        Audio67.setTrack(track.id);
        [...discRack.children].forEach((c) => c.classList.toggle("active", c.dataset.id === track.id));
      });
      discRack.appendChild(el);
    });
  }
  populateDiscRack();
  updateMuteBtn();

  muteBtn.addEventListener("click", () => {
    ensureAudioStarted();
    Audio67.toggleMute();
    updateMuteBtn();
  });

  function setShopTab(name) {
    document.querySelectorAll(".shop-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.getElementById("tab-upgrades").classList.toggle("hidden", name !== "upgrades");
    document.getElementById("tab-achievements").classList.toggle("hidden", name !== "achievements");
    document.getElementById("tab-leaderboard").classList.toggle("hidden", name !== "leaderboard");
    document.getElementById("tab-music").classList.toggle("hidden", name !== "music");
    if (name === "leaderboard") refreshLeaderboardUI();
  }
  document.querySelectorAll(".shop-tab").forEach((b) => {
    b.addEventListener("click", () => setShopTab(b.dataset.tab));
  });

  function openShop(tab) {
    ensureAudioStarted();
    refreshShopUI();
    setShopTab(tab || "upgrades");
    shopScreen.classList.remove("hidden");
    if (state.running) state.paused = true;
  }
  function closeShop() {
    shopScreen.classList.add("hidden");
    state.paused = false;
  }

  shopOpenBtn.addEventListener("click", () => openShop("upgrades"));
  menuBtn.addEventListener("click", () => openShop("upgrades"));
  shopCloseBtn.addEventListener("click", closeShop);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !shopScreen.classList.contains("hidden")) closeShop();
  });

  // ---------- Input ----------
  function tryThrust(mult) {
    if (state.exhausted || state.stamina <= 0) {
      Audio67.playEmpty();
      return false;
    }
    applyThrust(mult);
    state.stamina = Math.max(0, state.stamina - STAMINA_DRAIN_PER_TAP * staminaDrainMult());
    if (state.stamina <= 0) state.exhausted = true;
    return true;
  }

  function press(key) {
    if (!state.running || state.paused) return;
    const now = performance.now();
    if (key === "a") { state.aDown = true; keyAEl.classList.add("active"); }
    if (key === "d") { state.dDown = true; keyDEl.classList.add("active"); }
    Audio67.playTap(key);

    if (state.lastKey === null) {
      state.lastKey = key;
      state.lastPressAt = now;
      state.combo = 1;
      tryThrust(0.6);
      return;
    }

    if (key !== state.lastKey) {
      const withinWindow = now - state.lastPressAt < COMBO_WINDOW;
      if (withinWindow) {
        state.combo += 1;
      } else {
        state.combo = 1;
      }
      state.lastKey = key;
      state.lastPressAt = now;
      state.tilt = key === "a" ? -1 : 1;

      if (tryThrust(1)) {
        spawnLabel(key);
        state.bank += trailTapValue(state.trailLevel) * distanceRewardMult(state.altitude);
        persistBank();
        refreshBankDisplays();
      }
    } else {
      // same key twice in a row: no thrust, breaks combo
      state.combo = 0;
      state.lastPressAt = now;
    }
  }

  function release(key) {
    if (key === "a") keyAEl.classList.remove("active");
    if (key === "d") keyDEl.classList.remove("active");
  }

  function applyThrust(mult) {
    const bonusSteps = Math.min(state.combo, MAX_COMBO_BONUS_STEPS);
    const power = (TAP_IMPULSE_BASE + bonusSteps * COMBO_BONUS) * mult * wingsThrustMult(state.wingsLevel) * rebirthMult();
    state.velocity = clamp(state.velocity + power, MIN_VELOCITY, MAX_VELOCITY);
    state.landed = false;
    const count = 6 + state.trailLevel * 2;
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x: (hash(state.t * 13 + i) - 0.5) * 40,
        y: 0,
        vy: 60 + hash(state.t * 7 + i) * 80,
        vx: (hash(state.t * 3 + i) - 0.5) * 60,
        life: 0.5 + hash(i) * 0.3,
        age: 0,
        color: trailColor(state.trailLevel, i),
        size: 3 + Math.min(state.trailLevel, 6) * 0.3,
      });
    }
  }

  function trailColor(level, seed) {
    if (level <= 0) return "#5dd8ff";
    if (level <= 2) return seed % 2 === 0 ? "#5dd8ff" : "#ff5da2";
    if (level <= 4) return hash(seed + level) > 0.5 ? "#eafcff" : "#5dd8ff";
    const hue = (state.t * 140 + seed * 47) % 360;
    return `hsl(${hue}, 90%, 65%)`;
  }

  function spawnLabel(key) {
    state.bursts.push({
      text: key === "a" ? "6" : "7",
      x: key === "a" ? -70 : 70,
      y: -20,
      age: 0,
      life: 0.7,
      color: key === "a" ? "#ff5da2" : "#5dd8ff",
    });
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "a" || k === "d") {
      if (!e.repeat) press(k);
      e.preventDefault();
    }
    if (!state.running && (k === "a" || k === "d" || k === "enter" || k === " ")) {
      startGame();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k === "a" || k === "d") release(k);
  });

  function bindTouch(btn, key) {
    const down = (e) => { e.preventDefault(); press(key); };
    const up = (e) => { e.preventDefault(); release(key); };
    btn.addEventListener("touchstart", down, { passive: false });
    btn.addEventListener("touchend", up, { passive: false });
    btn.addEventListener("mousedown", down);
    btn.addEventListener("mouseup", up);
    btn.addEventListener("mouseleave", up);
  }
  bindTouch(document.getElementById("btn-a"), "a");
  bindTouch(document.getElementById("btn-d"), "d");

  startBtn.addEventListener("click", startGame);

  function startGame() {
    ensureAudioStarted();
    if (state.running) return;
    state.running = true;
    startScreen.classList.add("hidden");
    if (state.pendingWelcomeBack) {
      showMilestone(`Welcome back! +${state.pendingWelcomeBack.toLocaleString()} 67s earned while you were away.`, 4000);
      refreshBankDisplays();
      state.pendingWelcomeBack = null;
    }
  }

  // ---------- Milestone banner ----------
  let milestoneTimer = null;
  function checkMilestones() {
    while (
      state.milestoneIdx < MILESTONES.length &&
      state.altitude >= MILESTONES[state.milestoneIdx].at
    ) {
      if (state.milestoneIdx === 0) Audio67.playRocketRumble();
      showMilestone(MILESTONES[state.milestoneIdx].text);
      state.milestoneIdx++;
    }
  }
  function showMilestone(text, duration) {
    milestoneEl.textContent = text;
    milestoneEl.classList.add("show");
    Audio67.playMilestone();
    clearTimeout(milestoneTimer);
    milestoneTimer = setTimeout(() => milestoneEl.classList.remove("show"), duration || 2600);
  }

  // ---------- Solar systems passed ----------
  function checkSolarSystems() {
    while (
      state.nextSystemIdx < SOLAR_SYSTEMS.length &&
      state.altitude >= SOLAR_SYSTEMS[state.nextSystemIdx].at
    ) {
      state.systemsPassed++;
      const sys = SOLAR_SYSTEMS[state.nextSystemIdx];
      if (sys.level <= 10 || sys.level % 5 === 0) {
        showMilestone(`Level ${sys.level}: entering system ${sys.name}`);
      }
      state.nextSystemIdx++;
    }
  }

  // ---------- World -> screen ----------
  // Each object/category gets its OWN fixed scale (based on its own real-world
  // characteristic distance, not the player's current position). That means as you
  // pass something, its screen position keeps moving — steadily downward — and it
  // scrolls fully off the bottom instead of asymptotically settling in place. Every
  // object gets a comparable "screen life" relative to its own scale, so a nearby
  // building and a distant galaxy both cross the screen over a similar, consistent
  // stretch, just at wildly different real distances.
  const CENTER_Y_FRAC = 0.56;
  const VIEW_WINDOW = 0.45;
  const DIST_FLOOR = 600;

  function scaleFor(referenceDistance) {
    return (VIEW_WINDOW * H) / Math.max(referenceDistance, DIST_FLOOR);
  }
  // For a landmark whose own real distance IS its reference point: using scaleFor(at)
  // directly is a trap — at cancels out of (at - distance) * scale, so every landmark
  // would appear at the same fixed spot the instant the game starts, no matter how
  // far away it actually is. Instead size the window as a FRACTION of the landmark's
  // own distance, so bigger/farther things get a proportionally bigger (but still
  // genuinely distance-gated) window to appear, cross, and scroll away in.
  function scaleForLandmark(at) {
    const WINDOW_FRACTION = 0.3;
    return (VIEW_WINDOW * H) / (WINDOW_FRACTION * Math.max(at, DIST_FLOOR));
  }
  // solar-system objects need a much tighter window than the real planets: they're
  // packed close together (see SYSTEM_SPAN_FRACTION) and meant to be met one at a
  // time in sequence, not all visible together
  function scaleForSystemObject(at) {
    const WINDOW_FRACTION = 0.01;
    return (VIEW_WINDOW * H) / (WINDOW_FRACTION * Math.max(at, DIST_FLOOR));
  }
  function screenY(worldY, distance, scale, parallax = 1) {
    return H * CENTER_Y_FRAC - (worldY - distance) * scale * parallax;
  }
  // soft fade only right at the true screen edge — objects stay visible the whole
  // time they're actually on screen instead of popping based on arbitrary distance
  function edgeFade(sy) {
    const pad = 90;
    if (sy < -pad || sy > H + pad) return 0;
    const topFade = clamp((sy + pad) / pad, 0, 1);
    const bottomFade = clamp((H + pad - sy) / pad, 0, 1);
    return Math.min(topFade, bottomFade, 1);
  }

  const CITY_SCALE_REF = 2000;
  const CLOUD_SCALE_REF = 5000;
  const PLANE_SCALE_REF = 10000;
  const ROCKET_SCALE_REF = 55000;
  const SATELLITE_SCALE_REF = 1200000;
  const EARTH_SCALE_REF = 1500000;
  const EARTH_R = 260;

  // ---------- Drawing helpers ----------
  function currentZoneColors(altitude) {
    let i = 0;
    for (; i < ZONES.length - 1; i++) {
      if (altitude < ZONES[i + 1].start) break;
    }
    const a = ZONES[i];
    const b = ZONES[Math.min(i + 1, ZONES.length - 1)];
    const span = Math.max(1, b.start - a.start);
    const t = i === ZONES.length - 1 ? 0 : clamp((altitude - a.start) / span, 0, 1);
    return {
      top: lerpColor(a.top, b.top, t),
      bottom: lerpColor(a.bottom, b.bottom, t),
    };
  }

  function drawSky(altitude) {
    const c = currentZoneColors(altitude);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function starOpacity(altitude) {
    return clamp((altitude - 60000) / 240000, 0, 1);
  }

  function drawStars(altitude, t) {
    const op = starOpacity(altitude);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op;
    const spacing = 260;
    const STAR_DRIFT_RATE = 0.00025;
    const parallax = 0.15;
    const offset = (altitude * STAR_DRIFT_RATE * parallax) % spacing;
    const cols = Math.ceil(W / spacing) + 2;
    const rows = Math.ceil(H / spacing) + 2;
    for (let r = -1; r < rows; r++) {
      for (let cI = -1; cI < cols; cI++) {
        const cellY = Math.floor((altitude * parallax) / spacing) + r;
        const seed = cellY * 977 + cI * 131;
        const x = (cI * spacing + hash(seed) * spacing) % (W + spacing) - spacing / 2;
        const y = (r * spacing + hash(seed + 0.33) * spacing) + offset - spacing;
        const twinkle = 0.5 + 0.5 * Math.sin(t * (1 + hash(seed + 0.6) * 2) + seed);
        const size = 0.6 + hash(seed + 0.9) * 1.8;
        ctx.globalAlpha = op * (0.35 + 0.65 * twinkle);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawGalaxySwirl(altitude, t) {
    const op = clamp((altitude - 2e20) / 4e19, 0, 1);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op * 0.9;
    const cx = W * 0.5 + Math.sin(t * 0.05) * 60;
    const cy = H * 0.4;
    const arms = 3;
    for (let a = 0; a < arms; a++) {
      for (let i = 0; i < 90; i++) {
        const ang = i * 0.18 + (a * Math.PI * 2) / arms + t * 0.02;
        const rad = i * 4.2;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad * 0.5;
        const hue = 260 + i * 1.2 + a * 30;
        ctx.fillStyle = `hsla(${hue % 360}, 80%, ${60 - i * 0.2}%, ${0.55 - i * 0.005})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, 2.6 - i * 0.02), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawEarth(altitude) {
    const scale = scaleFor(EARTH_SCALE_REF);
    const sy = screenY(0, altitude, scale);
    const op = edgeFade(sy);
    if (op <= 0) return;
    // no curvature is visible from the ground — it fades in through the stratosphere
    const curveFade = clamp((altitude - 20000) / 60000, 0, 1);
    if (curveFade <= 0) return;
    const shrink = clamp(EARTH_SCALE_REF / Math.max(altitude, EARTH_SCALE_REF), 0.06, 1);
    const r = EARTH_R * shrink;
    const sx = W / 2;

    ctx.save();
    ctx.globalAlpha = op * curveFade;

    const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
    g.addColorStop(0, "#bfe8ff");
    g.addColorStop(0.35, "#4a9fd6");
    g.addColorStop(0.7, "#2f6fae");
    g.addColorStop(1, "#0c2c4a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(90,140,80,0.55)";
    [[-0.3, -0.2, 0.35], [0.25, 0.1, 0.3], [-0.1, 0.35, 0.22], [0.4, -0.35, 0.18]].forEach(([dx, dy, rr]) => {
      ctx.beginPath();
      ctx.arc(sx + dx * r, sy + dy * r, rr * r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    [[-0.15, -0.3, 0.25], [0.3, 0.2, 0.2], [-0.35, 0.15, 0.18]].forEach(([dx, dy, rr]) => {
      ctx.beginPath();
      ctx.ellipse(sx + dx * r, sy + dy * r, rr * r, rr * r * 0.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.strokeStyle = "rgba(150,210,255,0.5)";
    ctx.lineWidth = Math.max(2, r * 0.04);
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.02, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBuildings(altitude) {
    const y = screenY(0, altitude, scaleFor(CITY_SCALE_REF));
    if (y < -400 || y > H + 400) return;
    const op = edgeFade(y);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.fillStyle = "#2b3a55";
    for (const b of buildings) {
      const screenX = ((b.x - altitude * 0.02) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.fillRect(screenX, y - b.h, b.w, b.h);
      ctx.fillStyle = "rgba(255,220,150,0.5)";
      for (let wy = 10; wy < b.h - 10; wy += 22) {
        for (let wx = 8; wx < b.w - 8; wx += 18) {
          if (hash(b.x + wx + wy) > 0.5) ctx.fillRect(screenX + wx, y - b.h + wy, 6, 8);
        }
      }
      ctx.fillStyle = "#2b3a55";
    }
    ctx.restore();
  }

  function drawCloudsAndBirds(altitude, t) {
    const scale = scaleFor(CLOUD_SCALE_REF);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const c of clouds) {
      const sy = screenY(c.y, altitude, scale);
      const op = edgeFade(sy);
      if (op <= 0) continue;
      ctx.globalAlpha = op * 0.85;
      const sx = ((c.x + t * c.speed) % (W + 400)) - 200;
      const s = c.s * 40;
      ctx.beginPath();
      ctx.ellipse(sx, sy, s, s * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(sx + s * 0.6, sy + 6, s * 0.7, s * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(sx - s * 0.6, sy + 6, s * 0.6, s * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(40,40,40,0.7)";
    ctx.lineWidth = 2;
    for (const b of birds) {
      const sy = screenY(b.y, altitude, scale) + Math.sin(t * 2 + b.phase) * 8;
      const op = edgeFade(sy);
      if (op <= 0) continue;
      ctx.globalAlpha = op * 0.7;
      const sx = ((b.x + t * b.speed) % (W + 200)) - 100;
      const flap = Math.sin(t * 8 + b.phase) * 6 * b.s;
      ctx.beginPath();
      ctx.moveTo(sx - 10 * b.s, sy + flap);
      ctx.quadraticCurveTo(sx, sy - 6 * b.s, sx + 10 * b.s, sy + flap);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlanes(altitude, t) {
    const scale = scaleFor(PLANE_SCALE_REF);
    ctx.save();
    for (const p of planes) {
      const sy = screenY(p.y, altitude, scale);
      const op = edgeFade(sy);
      if (op <= 0) continue;
      ctx.globalAlpha = op;
      const sx = (((p.x + t * p.speed * p.dir) % (W + 400)) + W + 400) % (W + 400) - 200;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(p.dir * p.s, p.s);
      ctx.fillStyle = "#e8eef5";
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(24, -4);
      ctx.lineTo(30, 0);
      ctx.lineTo(24, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(6, -16);
      ctx.lineTo(10, -16);
      ctx.lineTo(2, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(-70, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRockets(altitude) {
    const scale = scaleFor(ROCKET_SCALE_REF);
    ctx.save();
    for (const r of rockets) {
      const sy = screenY(r.y, altitude, scale);
      const op = edgeFade(sy);
      if (op <= 0) continue;
      ctx.globalAlpha = op;
      ctx.save();
      ctx.translate(r.x % W, sy);
      ctx.scale(r.s, r.s);
      ctx.fillStyle = "#f0f0f0";
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(10, -6);
      ctx.lineTo(10, 20);
      ctx.lineTo(-10, 20);
      ctx.lineTo(-10, -6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff5da2";
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.lineTo(-20, 24);
      ctx.lineTo(-10, 20);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(20, 24);
      ctx.lineTo(10, 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffb84d";
      ctx.beginPath();
      ctx.moveTo(-6, 20);
      ctx.lineTo(0, 34 + hash(r.x) * 8);
      ctx.lineTo(6, 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSatellites(altitude, t) {
    const scale = scaleFor(SATELLITE_SCALE_REF);
    ctx.save();
    ctx.fillStyle = "#cfd6e0";
    for (const s of satellites) {
      const sy = screenY(s.y, altitude, scale);
      const op = edgeFade(sy);
      if (op <= 0) continue;
      ctx.globalAlpha = op;
      const sx = ((s.x + t * s.speed) % (W + 300)) - 150;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 0.3);
      ctx.scale(s.s, s.s);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = "#5dd8ff";
      ctx.fillRect(-30, -4, 18, 8);
      ctx.fillRect(12, -4, 18, 8);
      ctx.fillStyle = "#cfd6e0";
      ctx.restore();
    }
    ctx.restore();
  }

  function drawLandmarks(altitude, t) {
    for (const p of LANDMARKS) {
      const sy = screenY(p.at, altitude, scaleForLandmark(p.at), 0.6);
      const op = edgeFade(sy);
      if (op <= 0) continue;
      const sx = W * (0.3 + 0.4 * hash(p.at));
      ctx.save();
      ctx.globalAlpha = op;

      if (p.type === "galaxy") {
        ctx.translate(sx, sy);
        ctx.rotate(0.4);
        const g = ctx.createRadialGradient(0, 0, p.r * 0.1, 0, 0, p.r);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.3, p.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      if (p.type === "star") {
        const pulse = 1 + 0.08 * Math.sin(t * 3);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * pulse);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.4, p.color);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + t * 0.2;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(ang) * p.r * 0.5, sy + Math.sin(ang) * p.r * 0.5);
          ctx.lineTo(sx + Math.cos(ang) * p.r * 1.6, sy + Math.sin(ang) * p.r * 1.6);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      if (p.type === "core") {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.25, p.color);
        g.addColorStop(1, "rgba(255,220,150,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      if (p.ring) {
        ctx.strokeStyle = "rgba(230,210,160,0.8)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.ellipse(sx, sy, p.r * 1.7, p.r * 0.5, -0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(sx - p.r * 0.3, sy - p.r * 0.3, p.r * 0.1, sx, sy, p.r);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.15, p.color);
      g.addColorStop(1, "#000");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
      ctx.fill();

      if (p.type === "moon") {
        ctx.fillStyle = "rgba(150,148,140,0.5)";
        [[-40, -20, 18], [30, 10, 26], [-10, 50, 14], [50, -50, 12]].forEach(([dx, dy, cr]) => {
          ctx.beginPath();
          ctx.arc(sx + dx, sy + dy, cr, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
    }
  }

  function drawSolarSystems(altitude, t) {
    for (const sys of SOLAR_SYSTEMS) {
      const sx = W * (0.25 + 0.5 * hash(sys.at));

      // planets first, one at a time — each has its own tight window, so only one
      // or two objects from this system are ever in view at once
      for (const pl of sys.planets) {
        const scale = scaleForSystemObject(pl.at);
        const psy = screenY(pl.at, altitude, scale, 0.6);
        const op = edgeFade(psy);
        if (op <= 0) continue;
        ctx.save();
        ctx.globalAlpha = op;
        if (pl.ring) {
          ctx.strokeStyle = "rgba(230,210,160,0.7)";
          ctx.lineWidth = pl.r * 0.35;
          ctx.beginPath();
          ctx.ellipse(sx, psy, pl.r * 1.7, pl.r * 0.5, -0.3, 0, Math.PI * 2);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(sx - pl.r * 0.3, psy - pl.r * 0.3, pl.r * 0.1, sx, psy, pl.r);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.2, pl.color);
        g.addColorStop(1, "#000");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, psy, pl.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // the star comes last — the system's climax before the void to the next one
      const starScale = scaleForSystemObject(sys.starAt);
      const starSy = screenY(sys.starAt, altitude, starScale, 0.6);
      const starOp = edgeFade(starSy);
      if (starOp > 0) {
        ctx.save();
        ctx.globalAlpha = starOp;
        const pulse = 1 + 0.06 * Math.sin(t * 2 + sys.starAt * 0.0000001);
        const g = ctx.createRadialGradient(sx, starSy, 0, sx, starSy, sys.starR * pulse);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.4, sys.starColor);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, starSy, sys.starR * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ---------- Player ----------
  function drawWings(level, t) {
    if (level <= 0) return;
    const size = 22 + level * 3.6;
    const flap = Math.sin(t * 5 + state.kickPhase * 0.3) * (6 + level);
    const tier = level >= 8 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0;
    const palettes = [
      ["#e8e8ec", "#c9c9d2"],
      ["#fff3d0", "#ffd76a"],
      ["#bff2ff", "#5dd8ff"],
      ["#ffe3fb", "#ff5da2"],
    ];
    const [light, dark] = palettes[tier];

    ctx.save();
    if (tier >= 2) {
      ctx.shadowColor = dark;
      ctx.shadowBlur = 18 + tier * 6;
    }

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.translate(6, 2);
      ctx.rotate(-0.3 + flap * 0.012);
      const grad = ctx.createLinearGradient(0, 0, size, size * 0.6);
      if (tier === 3) {
        grad.addColorStop(0, `hsl(${(t * 60) % 360},90%,75%)`);
        grad.addColorStop(1, `hsl(${(t * 60 + 80) % 360},90%,60%)`);
      } else {
        grad.addColorStop(0, light);
        grad.addColorStop(1, dark);
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(size * 0.5, -size * 0.35, size, size * 0.15);
      ctx.quadraticCurveTo(size * 0.55, size * 0.1, size * 0.4, size * 0.55);
      ctx.quadraticCurveTo(size * 0.15, size * 0.3, 0, 0);
      ctx.closePath();
      ctx.fill();

      const feathers = 3 + Math.min(level, 5);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= feathers; i++) {
        const f = i / (feathers + 1);
        ctx.beginPath();
        ctx.moveTo(size * 0.15 * f, size * 0.05 * f);
        ctx.lineTo(size * (0.3 + f * 0.6), size * (0.1 + f * 0.35));
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPlayer(t) {
    const cx = W / 2;
    const cy = H * CENTER_Y_FRAC;
    const bob = Math.sin(t * 3) * (state.landed ? 2 : 6);
    const tiltAngle = state.tilt * 0.22;

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(tiltAngle * 0.3);

    drawWings(state.wingsLevel, t);

    // legs (flutter kick)
    const kick = Math.sin(state.kickPhase) * (state.landed ? 4 : 16);
    ctx.strokeStyle = "#2b2b3a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, 24);
    ctx.lineTo(-16 + kick * 0.3, 52 + Math.abs(kick));
    ctx.moveTo(6, 24);
    ctx.lineTo(16 - kick * 0.3, 52 + Math.abs(-kick));
    ctx.stroke();

    // torso
    ctx.fillStyle = "#ff9f43";
    ctx.beginPath();
    ctx.moveTo(-16, -10);
    ctx.lineTo(16, -10);
    ctx.lineTo(12, 26);
    ctx.lineTo(-12, 26);
    ctx.closePath();
    ctx.fill();

    // arms — the "6-7" tipping-scale gesture
    const leftY = -4 - state.tilt * -18;
    const rightY = -4 - state.tilt * 18;
    ctx.strokeStyle = "#ffc98a";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-48, leftY);
    ctx.moveTo(14, -4);
    ctx.lineTo(48, rightY);
    ctx.stroke();
    ctx.fillStyle = "#ffc98a";
    ctx.beginPath();
    ctx.arc(-48, leftY, 6, 0, Math.PI * 2);
    ctx.arc(48, rightY, 6, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.fillStyle = "#ffc98a";
    ctx.beginPath();
    ctx.arc(0, -26, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b3a";
    ctx.beginPath();
    ctx.arc(-5, -28, 1.8, 0, Math.PI * 2);
    ctx.arc(5, -28, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2b2b3a";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -22, 4, 0, Math.PI);
    ctx.stroke();

    ctx.restore();

    // floating 6 / 7 bursts
    for (const b of state.bursts) {
      const p2 = b.age / b.life;
      ctx.save();
      ctx.globalAlpha = 1 - p2;
      ctx.fillStyle = b.color;
      ctx.font = "bold 26px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.text, cx + b.x, cy + b.y - p2 * 40);
      ctx.restore();
    }

    // thrust / trail particles
    ctx.save();
    for (const pt of state.particles) {
      const p2 = pt.age / pt.life;
      ctx.globalAlpha = (1 - p2) * 0.75;
      ctx.fillStyle = pt.color || "#5dd8ff";
      ctx.beginPath();
      ctx.arc(cx + pt.x + pt.vx * pt.age, cy + 40 + pt.y + pt.vy * pt.age, (pt.size || 3) * (1 - p2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Main loop ----------
  let lastTime = performance.now();
  function frame(now) {
    let dt = (now - lastTime) / 1000;
    dt = clamp(dt, 0, 0.05);
    lastTime = now;
    state.t += dt;

    if (state.running && !state.paused) {
      // engine fuel: a full tank runs the engine for ENGINE_FUEL_MAX seconds, then it
      // cuts out; it only refuels once you're actually back on the ground
      let effEngineAccel = 0;
      if (state.engineLevel > 0) {
        if (!state.engineDepleted && state.engineFuel > 0) {
          effEngineAccel = engineAccel(state.engineLevel) * rebirthMult();
          state.engineFuel = Math.max(0, state.engineFuel - dt);
          if (state.engineFuel <= 0) state.engineDepleted = true;
        } else if (state.landed) {
          state.engineFuel = Math.min(ENGINE_FUEL_MAX, state.engineFuel + (ENGINE_FUEL_MAX / ENGINE_REFUEL_TIME) * dt);
          if (state.engineFuel >= ENGINE_FUEL_MAX) state.engineDepleted = false;
        }
      }

      const normalGravity = GRAVITY * wingsGravityMult(state.wingsLevel);
      const outOfGas = state.exhausted && effEngineAccel < normalGravity;
      const fallMult = (state.velocity < 0 || outOfGas) ? FALL_GRAVITY_MULT : 1;
      const effGravity = normalGravity * fallMult;
      state.velocity += (effEngineAccel - effGravity) * dt;
      state.velocity = clamp(state.velocity, MIN_VELOCITY, MAX_VELOCITY);

      const wasAirborne = state.altitude > 0;
      state.altitude += state.velocity * dt;
      if (state.altitude <= 0) {
        state.altitude = 0;
        if (state.velocity < 0) state.velocity = 0;
        if (wasAirborne && !state.landed) Audio67.playLand();
        state.landed = state.velocity <= 0;
      } else {
        state.landed = false;
      }

      // stamina only recharges once you're actually back on the ground
      const smaxNow = staminaMax(state.staminaLevel);
      if (state.landed) {
        state.stamina = Math.min(smaxNow, state.stamina + staminaRegenRate(state.staminaLevel) * dt);
      }
      if (state.exhausted && state.stamina >= smaxNow * 0.25) state.exhausted = false;
      if (state.velocity <= 0 && state.altitude <= 0) state.combo = 0;

      state.kickPhase += dt * (6 + Math.abs(state.velocity) * 0.0001);
      state.tilt = lerp(state.tilt, state.aDown === state.dDown ? state.tilt * 0.9 : (state.lastKey === "a" ? -1 : 1), 0.2);

      if (state.altitude > state.best) {
        state.best = state.altitude;
        localStorage.setItem("sixseven_best", String(Math.floor(state.best)));
      }
      if (state.velocity > state.bestVelocity) {
        state.bestVelocity = state.velocity;
        localStorage.setItem("sixseven_bestvelocity", String(state.bestVelocity));
      }

      // idle currency income, proportional to current speed, amplified the further out you are
      if (state.velocity > 0) {
        state.bank += state.velocity * IDLE_CURRENCY_RATE * dt * distanceRewardMult(state.altitude);
      }

      // combo decays if too slow
      if (state.lastKey && now - state.lastPressAt > COMBO_WINDOW * 1.4) {
        state.combo = 0;
      }

      // passive contrail at high trail levels
      if (state.trailLevel >= 6 && !state.landed) {
        state.trailEmitAccum += dt;
        const interval = 0.05;
        while (state.trailEmitAccum > interval) {
          state.trailEmitAccum -= interval;
          state.particles.push({
            x: (hash(state.t * 29) - 0.5) * 20,
            y: 0,
            vy: 40 + hash(state.t * 17) * 40,
            vx: (hash(state.t * 11) - 0.5) * 20,
            life: 0.4,
            age: 0,
            color: trailColor(state.trailLevel, Math.floor(state.t * 40)),
            size: 2.4,
          });
        }
      }

      checkMilestones();
      checkSolarSystems();
      checkAchievements();

      Audio67.setWindIntensity(state.altitude < KARMAN ? clamp(Math.abs(state.velocity) / 300, 0, 1) : 0);

      for (const pt of state.particles) pt.age += dt;
      state.particles = state.particles.filter((p) => p.age < p.life);
      for (const b of state.bursts) b.age += dt;
      state.bursts = state.bursts.filter((b) => b.age < b.life);

      altEl.textContent = fmtDistance(state.altitude);
      speedEl.textContent = fmtVelocity(state.velocity);
      bestEl.textContent = fmtDistance(state.best);
      comboEl.textContent = state.combo > 1 ? `COMBO ×${state.combo}` : "";

      const smax = staminaMax(state.staminaLevel);
      const staminaPct = clamp((state.stamina / smax) * 100, 0, 100);
      staminaFillEl.style.width = staminaPct + "%";
      staminaFillEl.classList.toggle("low", staminaPct < 30 && staminaPct > 0);
      staminaFillEl.classList.toggle("empty", staminaPct <= 0);

      if (state.engineLevel > 0) {
        fuelWrapEl.classList.remove("hidden");
        const fuelPct = clamp((state.engineFuel / ENGINE_FUEL_MAX) * 100, 0, 100);
        fuelFillEl.style.width = fuelPct + "%";
        fuelFillEl.classList.toggle("empty", state.engineDepleted);
      }

      state.saveAccum += dt;
      if (state.saveAccum > 1) {
        state.saveAccum = 0;
        persistBank();
        persistSession();
        if (!shopScreen.classList.contains("hidden")) refreshBankDisplays();
      }

      state.leaderboardSyncAccum += dt;
      if (state.leaderboardSyncAccum > 15) {
        state.leaderboardSyncAccum = 0;
        submitLeaderboardScore();
      }
    }

    drawSky(state.altitude);
    drawStars(state.altitude, state.t);
    drawGalaxySwirl(state.altitude, state.t);
    drawEarth(state.altitude);
    drawLandmarks(state.altitude, state.t);
    drawSolarSystems(state.altitude, state.t);
    drawSatellites(state.altitude, state.t);
    drawRockets(state.altitude);
    drawPlanes(state.altitude, state.t);
    drawCloudsAndBirds(state.altitude, state.t);
    drawBuildings(state.altitude);
    drawPlayer(state.t);

    requestAnimationFrame(frame);
  }

  altEl.textContent = fmtDistance(0);
  speedEl.textContent = fmtVelocity(0);
  bestEl.textContent = fmtDistance(state.best);
  refreshBankDisplays();
  requestAnimationFrame(frame);
})();

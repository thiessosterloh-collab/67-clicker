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

  // ---------- Game constants ----------
  const GRAVITY = 780;          // units/s^2 pulling altitude down
  const THRUST = 195;           // base impulse per valid alternation
  const COMBO_BONUS = 22;       // extra thrust per combo step (capped)
  const MAX_COMBO_BONUS_STEPS = 14;
  const MAX_VELOCITY = 1050;
  const MIN_VELOCITY = -560;
  const ALT_SCALE = 0.11;       // world->screen px per unit at reference zoom
  const COMBO_WINDOW = 540;     // ms allowed between alternating presses
  const MAX_LEVEL = 10;
  const MOON_ALT = 26000;

  const ZONES = [
    { start: 0,      name: "city",     top: "#6ec6ff", bottom: "#eaf6ff" },
    { start: 1600,   name: "clouds",   top: "#4fa8e0", bottom: "#cfe9ff" },
    { start: 4750,   name: "planes",   top: "#1c6fb0", bottom: "#a9d8f5" },
    { start: 10000,  name: "rockets",  top: "#0b3d6b", bottom: "#5c93c2" },
    { start: 18000,  name: "edge",     top: "#041022", bottom: "#254a75" },
    { start: 26000,  name: "moon",     top: "#000714", bottom: "#0f2038" },
    { start: 41000,  name: "solar",    top: "#000000", bottom: "#08081a" },
    { start: 110000, name: "galaxy",   top: "#050110", bottom: "#170a2e" },
  ];

  const MILESTONES = [
    { at: 50,     text: "Liftoff! 6... 7..." },
    { at: 1600,   text: "Leaving the city..." },
    { at: 4750,   text: "Above the clouds — birds everywhere!" },
    { at: 10000,  text: "Cruising altitude. Planes below!" },
    { at: 18000,  text: "Rockets & satellites incoming!" },
    { at: 26000,  text: "The Moon!" },
    { at: 38000,  text: "Mars, dead ahead." },
    { at: 50000,  text: "Jupiter looms." },
    { at: 62000,  text: "Saturn's rings!" },
    { at: 74000,  text: "Uranus, tilted and cold." },
    { at: 86000,  text: "Neptune — edge of the system." },
    { at: 98000,  text: "Pluto. Still counts." },
    { at: 104000, text: "Leaving the Solar System..." },
    { at: 110000, text: "The Galaxy." },
    { at: 140000, text: "Deeper into the galaxy..." },
    { at: 180000, text: "Still going. Six. Seven." },
    { at: 250000, text: "You are the myth now." },
  ];

  const PLANETS = [
    { at: 38000, r: 46,  color: "#c1440e", ring: false, name: "mars" },
    { at: 50000, r: 100, color: "#d8b26a", ring: false, name: "jupiter" },
    { at: 62000, r: 84,  color: "#e3c98f", ring: true,  name: "saturn" },
    { at: 74000, r: 58,  color: "#7fd8d8", ring: false, name: "uranus" },
    { at: 86000, r: 60,  color: "#4f7ecb", ring: false, name: "neptune" },
    { at: 98000, r: 20,  color: "#c9b8a3", ring: false, name: "pluto" },
  ];

  // ---------- Decorative world objects (seeded, fixed) ----------
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
      y: 750 + hash(i * 5.3) * 3750,
      s: 0.6 + hash(i * 7.7) * 1.4,
      speed: 8 + hash(i * 2.1) * 14,
    });
  }

  const birds = [];
  for (let i = 0; i < 24; i++) {
    birds.push({
      x: hash(i * 9.3) * 2000 - 500,
      y: 1250 + hash(i * 4.1) * 3250,
      s: 0.7 + hash(i * 6.6) * 0.8,
      speed: 30 + hash(i * 3.3) * 40,
      phase: hash(i * 1.9) * 10,
    });
  }

  const planes = [];
  for (let i = 0; i < 12; i++) {
    planes.push({
      x: hash(i * 11.2) * 2200 - 600,
      y: 5000 + hash(i * 8.4) * 4500,
      s: 0.8 + hash(i * 2.7) * 0.6,
      speed: 40 + hash(i * 5.5) * 30,
      dir: hash(i * 3.9) > 0.5 ? 1 : -1,
    });
  }

  const rockets = [];
  for (let i = 0; i < 8; i++) {
    rockets.push({
      x: hash(i * 13.1) * 900 - 300,
      y: 11000 + hash(i * 6.2) * 7000,
      s: 0.8 + hash(i * 4.4) * 0.6,
    });
  }

  const satellites = [];
  for (let i = 0; i < 8; i++) {
    satellites.push({
      x: hash(i * 15.6) * 1400 - 400,
      y: 14000 + hash(i * 9.9) * 8000,
      s: 0.8 + hash(i * 1.2) * 0.7,
      speed: 15 + hash(i * 8.8) * 20,
    });
  }

  // ---------- Persistence ----------
  function loadNum(key, fallback) {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  }

  const state = {
    altitude: 0,
    velocity: 0,
    lastKey: null,
    lastPressAt: 0,
    combo: 0,
    best: loadNum("sixseven_best", 0),
    bank: loadNum("sixseven_bank", 0),
    wingsLevel: clamp(loadNum("sixseven_wings", 0), 0, MAX_LEVEL),
    trailLevel: clamp(loadNum("sixseven_trail", 0), 0, MAX_LEVEL),
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
  };

  function persistBank() { localStorage.setItem("sixseven_bank", String(Math.floor(state.bank))); }
  function persistLevels() {
    localStorage.setItem("sixseven_wings", String(state.wingsLevel));
    localStorage.setItem("sixseven_trail", String(state.trailLevel));
  }

  function wingsCost(level) { return Math.round(20 * Math.pow(1.55, level)); }
  function trailCost(level) { return Math.round(15 * Math.pow(1.5, level)); }
  function wingsThrustMult(level) { return 1 + level * 0.16; }
  function wingsGravityMult(level) { return 1 - Math.min(level * 0.035, 0.35); }
  function trailTapValue(level) { return 1 + level; }

  function fmtAltitude(v) {
    if (v < 1000) return Math.floor(v) + " m";
    if (v < 41000) return (v / 1000).toFixed(2) + " km";
    if (v < 110000) return (v / 1000).toFixed(1) + " km — solar system";
    const ly = (v - 110000) / 6000;
    return ly.toFixed(2) + " ly — the galaxy";
  }

  // ---------- DOM ----------
  const altEl = document.getElementById("altitude-value");
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
  const wingsCostEl = document.getElementById("wings-cost");
  const buyWingsBtn = document.getElementById("buy-wings");
  const trailLevelEl = document.getElementById("trail-level");
  const trailDescEl = document.getElementById("trail-desc");
  const trailCostEl = document.getElementById("trail-cost");
  const buyTrailBtn = document.getElementById("buy-trail");
  const discRack = document.getElementById("disc-rack");
  const muteBtn = document.getElementById("mute-btn");

  function refreshBankDisplays() {
    bankEl.textContent = Math.floor(state.bank);
    shopBankEl.textContent = Math.floor(state.bank);
  }

  function refreshShopUI() {
    refreshBankDisplays();

    const wLevel = state.wingsLevel;
    const wMaxed = wLevel >= MAX_LEVEL;
    wingsLevelEl.textContent = wMaxed ? "MAX" : "Lv " + wLevel;
    wingsDescEl.textContent = `+${Math.round((wingsThrustMult(wLevel) - 1) * 100)}% height per 67 · softer falls`;
    if (wMaxed) {
      buyWingsBtn.innerHTML = "MAXED";
      buyWingsBtn.classList.add("maxed");
      buyWingsBtn.disabled = true;
    } else {
      const cost = wingsCost(wLevel);
      buyWingsBtn.innerHTML = `<span>${cost}</span> 67s`;
      buyWingsBtn.classList.remove("maxed");
      buyWingsBtn.disabled = state.bank < cost;
    }

    const tLevel = state.trailLevel;
    const tMaxed = tLevel >= MAX_LEVEL;
    trailLevelEl.textContent = tMaxed ? "MAX" : "Lv " + tLevel;
    trailDescEl.textContent = `${trailTapValue(tLevel)} 67s earned per A/D press`;
    if (tMaxed) {
      buyTrailBtn.innerHTML = "MAXED";
      buyTrailBtn.classList.add("maxed");
      buyTrailBtn.disabled = true;
    } else {
      const cost = trailCost(tLevel);
      buyTrailBtn.innerHTML = `<span>${cost}</span> 67s`;
      buyTrailBtn.classList.remove("maxed");
      buyTrailBtn.disabled = state.bank < cost;
    }
  }

  function buyWings() {
    if (state.wingsLevel >= MAX_LEVEL) return;
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
    if (state.trailLevel >= MAX_LEVEL) return;
    const cost = trailCost(state.trailLevel);
    if (state.bank < cost) return;
    state.bank -= cost;
    state.trailLevel++;
    persistBank();
    persistLevels();
    Audio67.playPurchase();
    refreshShopUI();
  }

  buyWingsBtn.addEventListener("click", buyWings);
  buyTrailBtn.addEventListener("click", buyTrail);

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
    document.getElementById("tab-music").classList.toggle("hidden", name !== "music");
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
      applyThrust(0.6);
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
      applyThrust(1);
      spawnLabel(key);

      state.bank += trailTapValue(state.trailLevel);
      persistBank();
      refreshBankDisplays();
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
    const power = (THRUST + bonusSteps * COMBO_BONUS) * mult * wingsThrustMult(state.wingsLevel);
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
  }

  // ---------- Milestone banner ----------
  let milestoneTimer = null;
  function checkMilestones() {
    while (
      state.milestoneIdx < MILESTONES.length &&
      state.altitude >= MILESTONES[state.milestoneIdx].at
    ) {
      showMilestone(MILESTONES[state.milestoneIdx].text);
      state.milestoneIdx++;
    }
  }
  function showMilestone(text) {
    milestoneEl.textContent = text;
    milestoneEl.classList.add("show");
    Audio67.playMilestone();
    clearTimeout(milestoneTimer);
    milestoneTimer = setTimeout(() => milestoneEl.classList.remove("show"), 2600);
  }

  // ---------- World -> screen ----------
  const CENTER_Y_FRAC = 0.56;
  function worldToScreenY(worldY, altitude, parallax = 1) {
    return H * CENTER_Y_FRAC - (worldY - altitude) * ALT_SCALE * parallax;
  }

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
    return clamp((altitude - 13000) / 15000, 0, 1);
  }

  function drawStars(altitude, t) {
    const op = starOpacity(altitude);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op;
    const spacing = 260;
    const parallax = 0.15;
    const offset = (altitude * ALT_SCALE * parallax) % spacing;
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
    const op = clamp((altitude - 100000) / 20000, 0, 1);
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

  function drawBuildings(altitude) {
    const op = clamp(1 - altitude / 2500, 0, 1);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.fillStyle = "#2b3a55";
    for (const b of buildings) {
      const y = worldToScreenY(0, altitude);
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
    const op = clamp(1 - (altitude - 1500) / 8000, 0.05, 1) * clamp(altitude / 300, 0, 1);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(op, 1);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const c of clouds) {
      const sy = worldToScreenY(c.y, altitude);
      if (sy < -100 || sy > H + 100) continue;
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
      const sy = worldToScreenY(b.y, altitude) + Math.sin(t * 2 + b.phase) * 8;
      if (sy < -50 || sy > H + 50) continue;
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
    const op = clamp(1 - Math.abs(altitude - 7000) / 11000, 0, 1);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op;
    for (const p of planes) {
      const sy = worldToScreenY(p.y, altitude);
      if (sy < -60 || sy > H + 60) continue;
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
    const op = clamp(1 - Math.abs(altitude - 14000) / 13000, 0, 1);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op;
    for (const r of rockets) {
      const sy = worldToScreenY(r.y, altitude);
      if (sy < -80 || sy > H + 80) continue;
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
    const op = clamp(1 - Math.abs(altitude - 18000) / 15000, 0, 1);
    if (op <= 0) return;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.fillStyle = "#cfd6e0";
    for (const s of satellites) {
      const sy = worldToScreenY(s.y, altitude);
      if (sy < -60 || sy > H + 60) continue;
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

  function drawMoon(altitude) {
    const op = clamp(1 - Math.abs(altitude - MOON_ALT) / 17500, 0, 1);
    if (op <= 0) return;
    const sy = worldToScreenY(MOON_ALT, altitude, 0.5);
    ctx.save();
    ctx.globalAlpha = op;
    const r = 130;
    const g = ctx.createRadialGradient(W * 0.5 - 30, sy - 30, 10, W * 0.5, sy, r);
    g.addColorStop(0, "#f4f1ea");
    g.addColorStop(1, "#b9b6ad");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(W * 0.5, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150,148,140,0.5)";
    [[-40, -20, 18], [30, 10, 26], [-10, 50, 14], [50, -50, 12]].forEach(([dx, dy, cr]) => {
      ctx.beginPath();
      ctx.arc(W * 0.5 + dx, sy + dy, cr, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawPlanets(altitude) {
    for (const p of PLANETS) {
      const op = clamp(1 - Math.abs(altitude - p.at) / 5000, 0, 1);
      if (op <= 0) continue;
      const sy = worldToScreenY(p.at, altitude, 0.6);
      const sx = W * (0.3 + 0.4 * hash(p.at));
      ctx.save();
      ctx.globalAlpha = op;
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
      ctx.restore();
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
      const effGravity = GRAVITY * wingsGravityMult(state.wingsLevel);
      state.velocity -= effGravity * dt;
      state.velocity = clamp(state.velocity, MIN_VELOCITY, MAX_VELOCITY);
      const wasAirborne = state.altitude > 0;
      state.altitude += state.velocity * dt;
      if (state.altitude <= 0) {
        state.altitude = 0;
        state.velocity = 0;
        if (wasAirborne && !state.landed) Audio67.playLand();
        state.landed = true;
      }
      if (state.velocity <= 0 && state.altitude <= 0) state.combo = 0;

      state.kickPhase += dt * (6 + Math.abs(state.velocity) * 0.01);
      state.tilt = lerp(state.tilt, state.aDown === state.dDown ? state.tilt * 0.9 : (state.lastKey === "a" ? -1 : 1), 0.2);

      if (state.altitude > state.best) {
        state.best = state.altitude;
        localStorage.setItem("sixseven_best", String(Math.floor(state.best)));
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

      for (const pt of state.particles) pt.age += dt;
      state.particles = state.particles.filter((p) => p.age < p.life);
      for (const b of state.bursts) b.age += dt;
      state.bursts = state.bursts.filter((b) => b.age < b.life);

      altEl.textContent = fmtAltitude(state.altitude);
      bestEl.textContent = fmtAltitude(state.best);
      comboEl.textContent = state.combo > 1 ? `COMBO ×${state.combo}` : "";
    }

    drawSky(state.altitude);
    drawStars(state.altitude, state.t);
    drawGalaxySwirl(state.altitude, state.t);
    drawPlanets(state.altitude);
    drawMoon(state.altitude);
    drawSatellites(state.altitude, state.t);
    drawRockets(state.altitude);
    drawPlanes(state.altitude, state.t);
    drawCloudsAndBirds(state.altitude, state.t);
    drawBuildings(state.altitude);
    drawPlayer(state.t);

    requestAnimationFrame(frame);
  }

  altEl.textContent = fmtAltitude(0);
  bestEl.textContent = fmtAltitude(state.best);
  refreshBankDisplays();
  requestAnimationFrame(frame);
})();

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
  const GRAVITY = 620;         // units/s^2 pulling altitude down
  const THRUST = 260;          // base impulse per valid alternation
  const COMBO_BONUS = 26;      // extra thrust per combo step (capped)
  const MAX_COMBO_BONUS_STEPS = 12;
  const MAX_VELOCITY = 980;
  const MIN_VELOCITY = -520;
  const ALT_SCALE = 0.11;      // world->screen px per unit at reference zoom
  const COMBO_WINDOW = 620;    // ms allowed between alternating presses

  const ZONES = [
    { start: 0,     name: "city",     top: "#6ec6ff", bottom: "#eaf6ff" },
    { start: 320,   name: "clouds",   top: "#4fa8e0", bottom: "#cfe9ff" },
    { start: 950,   name: "planes",   top: "#1c6fb0", bottom: "#a9d8f5" },
    { start: 2000,  name: "rockets",  top: "#0b3d6b", bottom: "#5c93c2" },
    { start: 3600,  name: "edge",     top: "#041022", bottom: "#254a75" },
    { start: 5200,  name: "moon",     top: "#000714", bottom: "#0f2038" },
    { start: 8200,  name: "solar",    top: "#000000", bottom: "#08081a" },
    { start: 19000, name: "galaxy",   top: "#050110", bottom: "#170a2e" },
  ];

  const MILESTONES = [
    { at: 10,    text: "Liftoff! 6... 7..." },
    { at: 320,   text: "Leaving the city..." },
    { at: 950,   text: "Above the clouds — birds everywhere!" },
    { at: 2000,  text: "Cruising altitude. Planes below!" },
    { at: 3600,  text: "Rockets & satellites incoming!" },
    { at: 5200,  text: "The Moon!" },
    { at: 7200,  text: "Mars, dead ahead." },
    { at: 9600,  text: "Jupiter looms." },
    { at: 12200, text: "Saturn's rings!" },
    { at: 14800, text: "Neptune — edge of the system." },
    { at: 17200, text: "Leaving the Solar System..." },
    { at: 19000, text: "The Galaxy." },
    { at: 30000, text: "Deeper into the galaxy..." },
    { at: 45000, text: "Still going. Six. Seven." },
  ];

  const PLANETS = [
    { at: 7200,  r: 46, color: "#c1440e", ring: false, name: "mars" },
    { at: 9600,  r: 100, color: "#d8b26a", ring: false, name: "jupiter" },
    { at: 12200, r: 84, color: "#e3c98f", ring: true,  name: "saturn" },
    { at: 14800, r: 60, color: "#4f7ecb", ring: false, name: "neptune" },
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
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: hash(i * 3.1) * 2000 - 500,
      y: 150 + hash(i * 5.3) * 750,
      s: 0.6 + hash(i * 7.7) * 1.4,
      speed: 8 + hash(i * 2.1) * 14,
    });
  }

  const birds = [];
  for (let i = 0; i < 18; i++) {
    birds.push({
      x: hash(i * 9.3) * 2000 - 500,
      y: 250 + hash(i * 4.1) * 650,
      s: 0.7 + hash(i * 6.6) * 0.8,
      speed: 30 + hash(i * 3.3) * 40,
      phase: hash(i * 1.9) * 10,
    });
  }

  const planes = [];
  for (let i = 0; i < 8; i++) {
    planes.push({
      x: hash(i * 11.2) * 2200 - 600,
      y: 1000 + hash(i * 8.4) * 900,
      s: 0.8 + hash(i * 2.7) * 0.6,
      speed: 40 + hash(i * 5.5) * 30,
      dir: hash(i * 3.9) > 0.5 ? 1 : -1,
    });
  }

  const rockets = [];
  for (let i = 0; i < 6; i++) {
    rockets.push({
      x: hash(i * 13.1) * 900 - 300,
      y: 2200 + hash(i * 6.2) * 1400,
      s: 0.8 + hash(i * 4.4) * 0.6,
    });
  }

  const satellites = [];
  for (let i = 0; i < 6; i++) {
    satellites.push({
      x: hash(i * 15.6) * 1400 - 400,
      y: 2800 + hash(i * 9.9) * 1600,
      s: 0.8 + hash(i * 1.2) * 0.7,
      speed: 15 + hash(i * 8.8) * 20,
    });
  }

  // ---------- State ----------
  const best0 = Number(localStorage.getItem("sixseven_best") || 0);
  const state = {
    altitude: 0,
    velocity: 0,
    lastKey: null,
    lastPressAt: 0,
    combo: 0,
    best: best0,
    running: false,
    t: 0,
    milestoneIdx: 0,
    aDown: false,
    dDown: false,
    tilt: 0,
    kickPhase: 0,
    particles: [],
    bursts: [],
    landed: true,
  };

  function fmtAltitude(v) {
    if (v < 1000) return Math.floor(v) + " m";
    if (v < 20000) return (v / 1000).toFixed(2) + " km";
    if (v < 8200) return (v / 1000).toFixed(1) + " km";
    if (v < 19000) return (v / 1000).toFixed(1) + " km — solar system";
    const ly = (v - 19000) / 1200;
    return ly.toFixed(2) + " ly — the galaxy";
  }

  // ---------- Input ----------
  const altEl = document.getElementById("altitude-value");
  const bestEl = document.getElementById("best-value");
  const milestoneEl = document.getElementById("milestone");
  const comboEl = document.getElementById("combo-display");
  const keyAEl = document.getElementById("key-a");
  const keyDEl = document.getElementById("key-d");
  const startScreen = document.getElementById("start-screen");
  const startBtn = document.getElementById("start-btn");

  function press(key) {
    if (!state.running) return;
    const now = performance.now();
    if (key === "a") { state.aDown = true; keyAEl.classList.add("active"); }
    if (key === "d") { state.dDown = true; keyDEl.classList.add("active"); }

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
    const power = (THRUST + bonusSteps * COMBO_BONUS) * mult;
    state.velocity = clamp(state.velocity + power, MIN_VELOCITY, MAX_VELOCITY);
    state.landed = false;
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        x: (hash(state.t * 13 + i) - 0.5) * 40,
        y: 0,
        vy: 60 + hash(state.t * 7 + i) * 80,
        vx: (hash(state.t * 3 + i) - 0.5) * 60,
        life: 0.5 + hash(i) * 0.3,
        age: 0,
      });
    }
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
    return clamp((altitude - 2600) / 3000, 0, 1);
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
    const op = clamp((altitude - 17000) / 4000, 0, 1);
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
    const op = clamp(1 - altitude / 500, 0, 1);
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
    const op = clamp(1 - (altitude - 300) / 1600, 0.05, 1) * clamp(altitude / 60, 0, 1);
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
    const op = clamp(1 - Math.abs(altitude - 1400) / 2200, 0, 1);
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
    const op = clamp(1 - Math.abs(altitude - 3000) / 2600, 0, 1);
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
    const op = clamp(1 - Math.abs(altitude - 3600) / 3000, 0, 1);
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
    const op = clamp(1 - Math.abs(altitude - 5200) / 3500, 0, 1);
    if (op <= 0) return;
    const sy = worldToScreenY(5200, altitude, 0.5);
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
      const op = clamp(1 - Math.abs(altitude - p.at) / 1000, 0, 1);
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
  function drawPlayer(t) {
    const cx = W / 2;
    const cy = H * CENTER_Y_FRAC;
    const bob = Math.sin(t * 3) * (state.landed ? 2 : 6);
    const tiltAngle = state.tilt * 0.22;

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(tiltAngle * 0.3);

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

    // thrust particles
    ctx.save();
    for (const pt of state.particles) {
      const p2 = pt.age / pt.life;
      ctx.globalAlpha = (1 - p2) * 0.7;
      ctx.fillStyle = "#5dd8ff";
      ctx.beginPath();
      ctx.arc(cx + pt.x + pt.vx * pt.age, cy + 40 + pt.y + pt.vy * pt.age, 3 * (1 - p2), 0, Math.PI * 2);
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

    if (state.running) {
      state.velocity -= GRAVITY * dt;
      state.velocity = clamp(state.velocity, MIN_VELOCITY, MAX_VELOCITY);
      state.altitude += state.velocity * dt;
      if (state.altitude <= 0) {
        state.altitude = 0;
        state.velocity = 0;
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
  requestAnimationFrame(frame);
})();

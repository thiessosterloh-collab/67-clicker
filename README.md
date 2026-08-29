# 67 Clicker — Ascension

He's doing the six seven, for real this time. Alternate **A** / **D** (6 / 7) to flap and levitate, using true real-world distances and real-world physics — from your rooftop, past the Kármán line, the ISS, the Moon (384,400 km), Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, the heliopause, Proxima Centauri, dozens of other real-ish solar systems, the Galactic Center, all the way out past 160,000 light-years to actually leave the Milky Way — and beyond, toward Andromeda. Speed is real too: break the sound barrier, then Earth's escape velocity, then push toward — and past — the speed of light.

Manual tapping gets you going, but the real distances involved (light-years!) mean **upgrades, especially the Engine, are the main way to get anywhere** — buy passive thrust and you'll keep accelerating even while you're not tapping, or even with the tab closed. Tapping also costs **stamina**: run out and gravity hits you 22x harder until you recover, so how high you can climb in one push is capped until you upgrade Stamina — a limit that keeps rising as you invest in it.

## Play

Open [`index.html`](index.html) directly in a browser, or serve the folder with any static file server. No build step, no dependencies.

On mobile, on-screen 6 / 7 buttons appear automatically.

## How it works

- Pure HTML5 canvas + vanilla JS (`game.js`) and the WebAudio API (`audio.js`) — no frameworks, no external assets. (Note: "real sounds" here means realistic *synthesized* audio — filtered noise for wind/rumble/sonic-boom, not licensed real-world recordings, which can't legally be embedded without a source.)
- Distance is tracked in real meters and speed in real m/s, with real Earth gravity (9.81 m/s²) pulling you back — 22x harder once you're actually falling or have run out of stamina with no engine to compensate, so a bad fall is short and sharp. Alternating `A`/`D` presses apply a thrust impulse and cost stamina; only genuine alternation (not repeats) counts, and consecutive alternations build a combo that increases thrust.
- **Stamina** depletes with every tap and regenerates over time. Run it out and you're "exhausted" — no more manual thrust, and gravity hits far harder — until it recovers to 25%. The **Stamina** upgrade raises your capacity (exponentially per level), which is what actually lets you climb higher before you're forced to drop and recover.
- Every object — buildings, clouds, planes, rockets, satellites, the Moon, planets, other solar systems — has its own fixed real-distance "window" it's visible within (proportionally sized to how far away it actually is, so distant things get a proportionally bigger window and aren't missed at high speed). It only appears once you're genuinely getting close, then visibly scrolls downward past you and off-screen as you continue on — never popping and never freezing in place.
- Starting around the stratosphere, the ground gives way to a full view of Earth curving away beneath you — a proper sphere with oceans, continents and cloud swirls that shrinks and recedes as you keep climbing, the way it actually would.
- Beyond our own Solar System's edge (the heliopause), the journey to the far edge of the galaxy passes through **~90 procedurally-generated solar systems** (with real-astronomy-style catalog names like `Kepler-4821` or `Gliese-663`), spaced by order of magnitude across the real ~160,000-light-year span it takes to actually leave the Milky Way.
- Every genuine A/D alternation earns **67s**, a persistent currency (saved across sessions), and moving forward also earns 67s passively over time. Both scale up **exponentially** the further out you are (based on orders of magnitude of real distance), so income keeps pace with the exponentially pricier upgrades. Spend 67s in the shop (`☰` menu button, or "UPGRADES" on the start screen) on four upgrades:
  - **Engine** — passive thrust that keeps accelerating you even when you're not tapping (and while the tab is closed). Runs on a 60-second fuel tank that cuts out and takes ~25s to auto-refuel once empty (watch the ENGINE FUEL bar). This is the primary progression path — the only realistic way to approach and exceed light speed. (up to level 6000)
  - **Stamina** — raises your max stamina, i.e. how far you can climb before you're forced to drop and recover. (up to level 700)
  - **Wings** — more thrust per tap and softer gravity, with the wing sprite growing more elaborate each tier. (up to level 120)
  - **Trail** — more 67s earned per tap, with the particle trail growing flashier each tier. (up to level 120)
- **Achievements** unlock at real velocity milestones: Mach 1 (with an actual sonic-boom sound), Earth escape velocity, 1% and 50% of light speed, light speed itself, and multiples of it (10c, 100c, 1000c) — plus distance/exploration achievements for crossing the whole galaxy and passing 50 solar systems. See them all (locked and unlocked) in the shop's ACHIEVEMENTS tab.
- **Music**: the shop's MUSIC tab is a rack of discs — synthesized, royalty-free chiptune/ambient tracks generated live with WebAudio oscillators. Pick a disc to switch the soundtrack instantly, or mute entirely.
- Best distance, currency, upgrade levels, unlocked achievements, and music/mute preference all persist via `localStorage`.

## Files

- `index.html` — page structure, HUD (including the stamina bar), shop overlay
- `style.css` — layout, HUD, shop/disc/achievement/stamina styling
- `game.js` — game loop, real-world physics, stamina, adaptive camera, solar system generation, upgrades, achievements, rendering
- `audio.js` — synthesized SFX (including noise-based wind/rumble/sonic-boom) and the music engine (note scheduler + track definitions)

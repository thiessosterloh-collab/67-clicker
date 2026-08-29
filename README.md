# 67 Clicker — Ascension

He's doing the six seven, for real this time. Alternate **A** / **D** (6 / 7) to flap and levitate, using true real-world distances and real-world physics — from your rooftop, past the Kármán line, the ISS, the Moon (384,400 km), Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, the heliopause, Proxima Centauri, the Galactic Center, and Andromeda. Speed is real too: break the sound barrier, then Earth's escape velocity, then push toward — and past — the speed of light.

Manual tapping gets you going, but the real distances involved (light-years!) mean **upgrades, especially the Engine, are the main way to get anywhere** — buy passive thrust and you'll keep accelerating even while you're not tapping, or even with the tab closed (you earn 67s for the time you were away, based on how fast you were going when you left).

## Play

Open [`index.html`](index.html) directly in a browser, or serve the folder with any static file server. No build step, no dependencies.

On mobile, on-screen 6 / 7 buttons appear automatically.

## How it works

- Pure HTML5 canvas + vanilla JS (`game.js`) and the WebAudio API (`audio.js`) — no frameworks, no external assets.
- Distance is tracked in real meters and speed in real m/s, with real Earth gravity (9.81 m/s²) pulling you back. Alternating `A`/`D` presses apply a thrust impulse; only genuine alternation (not repeats) counts, and consecutive alternations build a combo that increases thrust.
- The camera zoom adapts automatically to your current distance, so the same real, 1:1 journey — from meters to light-years — stays visually readable at every scale. Scenery is drawn purely from its actual position on screen (with a soft fade only right at the true screen edge), so nothing pops in or out of existence early; it stays visible the whole time it's actually in view and recedes naturally as you pass it.
- Every genuine A/D alternation earns **67s**, a persistent currency (saved across sessions), and moving forward also earns 67s passively over time. Spend 67s in the shop (`☰` menu button, or "UPGRADES" on the start screen) on three upgrades:
  - **Engine** — passive thrust that keeps accelerating you even when you're not tapping (and while the tab is closed). This is the primary progression path — the only realistic way to approach and exceed light speed.
  - **Wings** — more thrust per tap and softer gravity, with the wing sprite growing more elaborate each tier.
  - **Trail** — more 67s earned per tap, with the particle trail growing flashier each tier.
- **Achievements** unlock at real velocity milestones: Mach 1, Earth escape velocity, 1% and 50% of light speed, light speed itself, and multiples of it (10c, 100c, 1000c) for going well past light speed. See them all (locked and unlocked) in the shop's ACHIEVEMENTS tab.
- **Music**: the shop's MUSIC tab is a rack of discs — synthesized, royalty-free chiptune/ambient tracks generated live with WebAudio oscillators (no audio files). Pick a disc to switch the soundtrack instantly, or mute entirely.
- Best distance, currency, upgrade levels, unlocked achievements, and music/mute preference all persist via `localStorage`.

## Files

- `index.html` — page structure, HUD, shop overlay
- `style.css` — layout, HUD, shop/disc/achievement styling
- `game.js` — game loop, real-world physics, adaptive camera, upgrades, achievements, rendering
- `audio.js` — synthesized SFX and the music engine (note scheduler + track definitions)

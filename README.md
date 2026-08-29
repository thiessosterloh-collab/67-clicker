# 67 Clicker — Ascension

He's doing the six seven. Alternate **A** / **D** (6 / 7) to flap and levitate, straight up past the city, the birds, the planes, the rockets and satellites, the Moon, out through Mars, Jupiter, Saturn, Uranus, Neptune and Pluto, past the edge of the Solar System, and into the galaxy.

Stop mashing and gravity brings you back down — keep alternating to keep climbing. It's a long way up, and it gets harder the further you go.

## Play

Open [`index.html`](index.html) directly in a browser, or serve the folder with any static file server. No build step, no dependencies.

On mobile, on-screen 6 / 7 buttons appear automatically.

## How it works

- Pure HTML5 canvas + vanilla JS (`game.js`) and the WebAudio API (`audio.js`) — no frameworks, no external assets.
- Alternating `A`/`D` presses apply an upward thrust impulse; gravity pulls you back down continuously. Only genuine alternation (not repeats) generates lift, and consecutive alternations build a combo that increases thrust.
- Altitude drives a zone system: city → clouds & birds → planes → rockets & satellites → the Moon → six planets → deep space → an endless galaxy, each with its own sky gradient, parallax scenery, and milestone banner. The world is large and the physics unforgiving — this is a long climb.
- Every genuine A/D alternation earns **67s**, a persistent currency (saved across sessions) spent in the in-game shop (`☰` menu button, or "UPGRADES" on the start screen):
  - **Wings** — increases height gained per 67 and softens gravity's pull, with the wing sprite itself growing more elaborate each tier.
  - **Trail** — increases the number of 67s earned per A/D press, with the particle trail behind the character growing flashier each tier (culminating in a continuous rainbow contrail).
- **Music**: the shop's MUSIC tab is a rack of discs — synthesized, royalty-free chiptune/ambient tracks generated live with WebAudio oscillators (no audio files). Pick a disc to switch the soundtrack instantly, or mute entirely.
- Best altitude, currency, upgrade levels, and music/mute preference all persist via `localStorage`.

## Files

- `index.html` — page structure, HUD, shop overlay
- `style.css` — layout, HUD, shop/disc styling
- `game.js` — game loop, physics, world content, upgrades, rendering
- `audio.js` — synthesized SFX and the music engine (note scheduler + track definitions)

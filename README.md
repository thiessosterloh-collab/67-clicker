# 67 Clicker — Ascension

He's doing the six seven. Alternate **A** / **D** (6 / 7) to flap and levitate, straight up past the city, the birds, the planes, the rockets and satellites, the Moon, out through the planets, past the edge of the Solar System, and into the galaxy.

Stop mashing and gravity brings you back down — keep alternating to keep climbing.

## Play

Open [`index.html`](index.html) directly in a browser, or serve the folder with any static file server. No build step, no dependencies.

On mobile, on-screen 6 / 7 buttons appear automatically.

## How it works

- Pure HTML5 canvas + vanilla JS (`game.js`), no frameworks.
- Alternating `A`/`D` presses apply an upward thrust impulse; gravity pulls you back down continuously. Only genuine alternation (not repeats) generates lift, and consecutive alternations build a combo that increases thrust.
- Altitude drives a zone system: city → clouds & birds → planes → rockets & satellites → the Moon → the planets → deep space → the galaxy, each with its own sky gradient, parallax scenery, and milestone banner.
- Best altitude is saved to `localStorage`.

## Files

- `index.html` — page structure and HUD
- `style.css` — layout, HUD, start screen styling
- `game.js` — game loop, physics, rendering, all world content

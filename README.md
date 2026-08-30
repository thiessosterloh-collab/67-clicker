# 67 Clicker — Ascension

He's doing the six seven, for real this time. Alternate **A** / **D** (6 / 7) to flap and levitate, using true real-world distances and real-world physics — from your rooftop, past the Kármán line, the ISS, the Moon (384,400 km), Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, the heliopause, Proxima Centauri, dozens of other real-ish solar systems, the Galactic Center, all the way out past 160,000 light-years to actually leave the Milky Way — and beyond, toward Andromeda. Speed is real too: break the sound barrier, then Earth's escape velocity, then push toward — and past — the speed of light.

Manual tapping gets you going, but the real distances involved (light-years!) mean **upgrades, especially the Engine, are the main way to get anywhere** — buy passive thrust and you'll keep accelerating even while you're not tapping, or even with the tab closed. Tapping also costs **stamina**, and the Engine runs on a **60-second fuel tank** — both only recharge once you're actually back on the ground, so a run is a real there-and-back trip: climb, run dry, fall, land, recharge, go again — a little higher each time as your upgrades grow.

## Play

Open [`index.html`](index.html) directly in a browser, or serve the folder with any static file server. No build step, no dependencies.

On mobile, on-screen 6 / 7 buttons appear automatically.

## How it works

- Pure HTML5 canvas + vanilla JS (`game.js`) and the WebAudio API (`audio.js`) — no frameworks, no external assets. (Note: "real sounds" here means realistic *synthesized* audio — filtered noise for wind/rumble/sonic-boom, not licensed real-world recordings, which can't legally be embedded without a source.)
- Distance is tracked in real meters and speed in real m/s, with real Earth gravity (9.81 m/s²) pulling you back — 22x harder once you're actually falling or have run out of stamina with no engine to compensate, so a bad fall is short and sharp. Alternating `A`/`D` presses apply a thrust impulse and cost stamina; only genuine alternation (not repeats) counts, and consecutive alternations build a combo that increases thrust.
- **Stamina** is a backup for when the Engine isn't actively burning — while it's lit, tapping costs nothing; the moment it isn't (not yet ignited, or run dry), every tap drains stamina instead, and it only recharges once you're back on the ground (altitude 0), not passively over time. Run it out and you're "exhausted" — no more manual thrust, and (unless a strong-enough engine is covering you) gravity hits far harder — until it recovers to 25% (after landing). The **Stamina** upgrade raises your capacity (exponentially per level).
- Every object — buildings, clouds, planes, rockets, satellites, the Moon, planets, other solar systems — has its own fixed real-distance "window" it's visible within (proportionally sized to how far away it actually is, so distant things get a proportionally bigger window and aren't missed at high speed). It only appears once you're genuinely getting close, then visibly scrolls downward past you and off-screen as you continue on — never popping and never freezing in place.
- Starting around the stratosphere, the ground gives way to a full view of Earth curving away beneath you — a proper sphere with oceans, continents and cloud swirls that shrinks and recedes as you keep climbing, the way it actually would.
- Beyond our own Solar System's edge (the heliopause), the journey to the far edge of the galaxy passes through **~90 procedurally-generated solar systems**, numbered as levels ("Level 6: entering system TRAPPIST-4459", with real-astronomy-style catalog names). Each named planet follows real exoplanet naming convention too (e.g. `TRAPPIST-4459 b`, `TRAPPIST-4459 c`). Systems are met one at a time in sequence — planet, planet, star, then genuine empty void before the next system — each with its own tight visibility window, rather than the whole system appearing as one cluttered cluster.
- **Rebirth**: once you've crossed the whole Milky Way, a REBIRTH option unlocks in the shop. It resets your current position back to Earth (altitude, velocity, stamina and engine fuel) but permanently **doubles your thrust** — every rebirth doubles it again (×2, ×4, ×8, …) — while keeping your 67s, upgrade levels, achievements and records. It's how you get back out past the galaxy faster and faster on each run.
- Every genuine A/D alternation earns **67s**, a persistent currency (saved across sessions), and moving forward also earns 67s passively over time. Both scale up **exponentially** the further out you are (based on orders of magnitude of real distance), so income keeps pace with the exponentially pricier upgrades. Spend 67s in the shop (`☰` menu button, or "UPGRADES" on the start screen) on four upgrades:
  - **Engine** — passive thrust that keeps accelerating you even when you're not tapping (and while the tab is closed) — but only once you've **ignited** it (press `Space`, or tap the 🔥 IGNITE button). It doesn't just run on its own. Runs on a 60-second fuel tank; once it runs dry it needs to be landed-and-refueled *and* re-ignited before it does anything again. This is the primary progression path — the only realistic way to approach and exceed light speed. (up to level 6000)
  - **Stamina** — raises your max stamina, i.e. how far you can climb before you're forced to drop and recover. (up to level 700)
  - **Wings** — more thrust per tap and softer gravity, with the wing sprite growing more elaborate each tier. Costs more stamina per tap as it grows, so it doesn't just trivialize the stamina limit. (up to level 120)
  - **Trail** — more 67s earned per tap, with the particle trail growing flashier each tier. Also costs more stamina per tap as it grows, for the same reason. (up to level 120)
- **Achievements** unlock at real velocity milestones: Mach 1 (with an actual sonic-boom sound), Earth escape velocity, 1% and 50% of light speed, light speed itself, and multiples of it (10c, 100c, 1000c) — plus distance/exploration achievements for crossing the whole galaxy and passing 50 solar systems. See them all (locked and unlocked) in the shop's ACHIEVEMENTS tab.
- **Music**: the shop's MUSIC tab is a rack of discs — synthesized, royalty-free chiptune/ambient tracks generated live with WebAudio oscillators. Pick a disc to switch the soundtrack instantly, or mute entirely.
- **Leaderboard**: sign in with Google from the shop's LEADERBOARD tab to save your best distance, top speed, achievements, systems passed, Engine level and rebirths to a global leaderboard (Firebase Auth + Firestore). Sign-in uses Google Identity Services (Google's own official sign-in button, rendered directly on the page) rather than Firebase's popup or redirect helpers, both of which turned out to be unreliable on GitHub Pages — this exchanges a Google ID token for a Firebase credential without ever leaving the page. Playing without signing in still works exactly the same — it's opt-in.
- Best distance, currency, upgrade levels, unlocked achievements, and music/mute preference all persist via `localStorage`.

## Files

- `index.html` — page structure, HUD (including the stamina bar), shop overlay
- `style.css` — layout, HUD, shop/disc/achievement/stamina/leaderboard styling
- `game.js` — game loop, real-world physics, stamina, adaptive camera, solar system generation, upgrades, achievements, rendering
- `audio.js` — synthesized SFX (including noise-based wind/rumble/sonic-boom) and the music engine (note scheduler + track definitions)
- `leaderboard.js` — Firebase Auth (Google sign-in) + Firestore leaderboard, loaded as an ES module

## Leaderboard setup (Firebase Console)

The client code is already wired up to your `clicker-284f6` project. A few things need to be done once in the [Firebase Console](https://console.firebase.google.com/) itself (not something I can do from here):

1. **Authentication → Sign-in method** → enable the **Google** provider.
2. **Authentication → Settings → Authorized domains** → make sure `thiessosterloh-collab.github.io` is listed (and `localhost` if you want to test locally — it's usually there by default).
3. **Firestore Database** → create a database if you haven't (Native mode, any region).
4. **Firestore Database → Rules** → paste this so players can only write their own score, but everyone can read the board:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /leaderboard/{userId} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

Until those are done, the LEADERBOARD tab still works without errors — it just shows "No scores yet". Sign-in failures are no longer silent: a red toast banner appears at the top of the screen (visible even on the start screen) with the actual Firebase error code, and a green one confirms a successful sign-in with your name. If sign-in still doesn't complete after the domain/rules setup above, whatever the red toast says is the next thing to fix — likely either the domain isn't quite right in Authorized domains, or the browser is blocking cross-site storage access to `firebaseapp.com` during the redirect (a known Chrome/Safari privacy restriction), which would need a different sign-in strategy to work around.

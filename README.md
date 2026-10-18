# Neon Dash

An original 3D endless runner. You are a glowing robot sprinting down a 3-lane road through a neon city at night. Dodge barriers, trains and gaps, grab coins and power-ups, and see how far you can get.

Everything is made with code: the 3D models (Three.js shapes and glow materials), the textures (drawn on a canvas), the icon, and all music and sound effects (Web Audio API). There are no image, model or sound files.

## Controls

| Action | Keyboard | Touch screen |
| --- | --- | --- |
| Change lane | Left / Right arrows, A / D | Swipe left / right |
| Jump | Up arrow, W, Space | Swipe up |
| Slide (in the air: drop fast) | Down arrow, S | Swipe down |
| Pause | Esc (or P) | Pause button |
| Fullscreen (desktop app) | F11 | |

Menus also work with the arrow keys and Enter.

## Gameplay

- You run forward on your own, and the speed slowly goes up (about 50 km/h at the start, up to about 130 km/h).
- Obstacles: low barriers (jump), high barriers (slide), trains and blocks (change lane), and gaps in the road (jump).
- Tracks are random, but there is always a way through. The generator keeps a "safe lane" that never holds a train and never jumps more than one lane at a time, and the tests check this on thousands of tracks.
- Coins come in lines and in arcs over barriers.
- Power-ups: Magnet (pulls coins in), Shield (survives one hit), 2x Score, and Jetpack (fly for 6 seconds and collect a trail of coins in the sky).
- Score = metres run + 10 per coin (doubled while 2x is active).
- A crash gives a short slow-motion moment and a camera shake, then the game-over screen.

## Requirements

- Node.js 18 or newer (20 LTS recommended): https://nodejs.org
- Windows 10/11 for the installer. The game itself also runs in any modern browser.

## 1. Quick test in the browser

```bash
npm install
npm run dev
```

Then open http://localhost:5173. In the browser, high scores and settings are saved in the browser's local storage.

## 2. Run it as a desktop app

```bash
npm run start
```

This builds the game and opens it in its own Electron window. Your save file is kept on the laptop at:

```
%APPDATA%\Neon Dash\neon-dash-save.json
```

It survives closing the app and updates.

Optional self-check of the desktop app (opens the app, checks the security settings and the save file, prints the result and closes):

```bash
npm run smoke
```

## 3. Make the Windows installer

Run this on your Windows laptop:

```bash
npm run dist
```

The installer ends up here:

```
release\Neon-Dash-Setup-1.0.0.exe
```

Double-click it to install. It lets you pick the install folder, and creates a Start Menu entry and a desktop shortcut called "Neon Dash". The installer and the app use the icon drawn by `scripts/make-icon.mjs`. Uninstall from Windows Settings > Apps.

The installer is not code-signed, so Windows SmartScreen may show "Windows protected your PC" the first time. Click **More info** and then **Run anyway**.

## Tests

```bash
npm test
```

The tests run in the terminal with Node's built-in test runner, and use the same game logic as the real game:

- Lane changes, jump height and air time, sliding, fast drop and the jetpack.
- Collisions for every obstacle type, and how to survive each one (jump, slide or change lane).
- Shield (exactly one hit) and jetpack (flies over trains).
- Scoring, the 2x multiplier, power-up timers and the magnet.
- The speed ramp and its cap.
- Object pooling: a 90-second run creates almost no new objects after the first 30 seconds.
- Track generator: 1,500 random tracks of 300 rows each always have a way through, at slow, fast and rising speeds.
- An autopilot plays 40 random runs for 3 minutes each with the real physics and no shield, and survives all of them.
- Saving: round trip, top-10 table, broken files, and the real desktop save file being written and read back after a "restart".

## Settings

- Music and sound effects volume.
- Graphics quality. **High** adds bloom glow, smoothing and sharper pixels. **Low** turns those off and shows fewer buildings, for older laptops.
- Show FPS.

## Performance

- The game logic runs at a fixed 120 steps per second, separate from the frame rate, so it plays the same on any screen.
- Coins, buildings, signs, street lights and traffic use instanced meshes, so each group is one draw call.
- Obstacles, power-ups, coins and particles come from object pools and are reused, never created per frame.
- About 90 draw calls and 11k triangles per frame on Low quality, which is light work for any laptop GPU.

## Security (desktop app)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and no `webview`.
- The page only gets a tiny API through the preload script: load save, write save, quit. The main process only answers requests from the bundled game page, and only accepts valid JSON under 64 KB as a save.
- No remote content: navigation, redirects, new windows and permission requests are blocked, any non-local request is cancelled, and a strict Content Security Policy is set.

## Project layout

```
electron/
  main.cjs          secure window, save IPC, F11, self-test
  preload.cjs       tiny safe bridge for the page
  save-file.cjs     atomic save file on disk
src/
  main.js           boot: load save, start the game
  logic/            pure game rules (no 3D), tested in Node
    constants.js    tuning: lanes, physics, speeds, sizes
    player.js       lanes, jump, slide, jetpack
    collision.js    box collision
    spawner.js      seeded track generator + path checker
    run.js          one run: spawning, collisions, coins, power-ups
    powerups.js     power-up timers
    score.js        distance + coins
    save.js         save format, high scores, validation
    pool.js         object pool
  game/
    game.js         states, camera, effects, wiring
    loop.js         fixed-step game loop, slow motion, FPS
    input.js        keyboard + swipe
    obstacles.js    pooled obstacle models
    pickups.js      instanced coins, pooled power-up models
  world/            city, sky, robot
  render/           renderer (quality levels), canvas textures
  fx/particles.js   pooled particle bursts
  audio/audio.js    synth music + sound effects
  ui/               HUD and menus
  save/storage.js   desktop file save or browser localStorage
scripts/
  make-icon.mjs     draws the app icon and writes build/icon.ico
  smoke.mjs         desktop self-test launcher
tests/              terminal tests
```

## License

MIT

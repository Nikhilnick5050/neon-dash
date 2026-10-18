# Neon Dash: Build Plan

An original endless runner: a glowing robot runs on a 3-lane neon city road at night. No names, art, models or sounds from existing games.

## Stack
- Three.js for 3D (all models built from code: boxes, cylinders, glow materials)
- Vite for the web build
- Electron for the desktop app (contextIsolation on, nodeIntegration off, no remote content)
- electron-builder for a Windows NSIS installer (.exe) with a code-made icon and start-menu + desktop shortcuts
- Web Audio API for all sound and music (no sound files)
- Saving: a JSON file in the app's user data folder on the desktop (localStorage in the browser)

## Project layout
- `index.html`, `src/main.js`: entry, boot, screen switching
- `src/game/loop.js`: fixed-step game loop, slow motion, camera shake, FPS counter
- `src/game/player.js`: lanes, run, jump, slide, jetpack, smooth animations, swipe input
- `src/game/obstacles.js`: barriers (jump), high barriers (slide), trains/blocks (change lane), gaps
- `src/game/spawner.js`: random but always-solvable patterns, speed ramp over time
- `src/game/pickups.js`: coins in lines and arcs, power-ups (magnet, shield, 2x score, jetpack)
- `src/game/collision.js`: box collision and lane logic
- `src/game/score.js`: distance + coins, 2x multiplier
- `src/world/city.js`: road, neon buildings, moving sky, passing lights, fog
- `src/fx/particles.js`: coin particle bursts (pooled)
- `src/fx/pool.js`: generic object pool used everywhere
- `src/ui/hud.js`, `src/ui/menus.js`: HUD (score, coins, speed), start, pause, game over, high scores, settings
- `src/audio/audio.js`: synth SFX and looping music from Web Audio oscillators
- `src/save/storage.js`: high scores and settings
- `src/game/*.test.js` (or `tests/`): logic tests run in Node
- `electron/main.cjs`, `electron/preload.cjs`: secure window setup
- `build/icon` generated from code (script writes a PNG/ICO)
- `electron-builder.yml`, `package.json` scripts: `dev`, `start`, `dist`, `test`
- `README.md`

## Gameplay rules
- Speed starts slow and rises gradually over time, with a cap.
- Lanes: left, centre, right. Keys: arrows or A/D, plus swipe on touch.
- Jump: Up, W or Space. Slide: Down or S. Both use eased animations.
- Spawner always leaves at least one safe lane or a jump/slide window, so there is always a way through.
- Power-ups: magnet, shield (absorbs one hit), 2x score, jetpack (flies a few seconds, collects air coins).
- Score = distance + coins (2x doubles the total while active).
- Hitting an obstacle without shield: short slow motion, camera shake, game over.

## Screens
- Start menu: Play, High scores, Settings, Quit
- Pause (Esc): resume, restart, menu
- Game over: score, best score, Play again
- Settings: volume, graphics low/high, show FPS

## Quality and proof
- Pooled meshes, particles and obstacles; no new objects per frame.
- Target 60 FPS on a normal laptop; FPS counter available in settings.
- Terminal tests: lane changes, collisions, scoring, power-up timers, save/load round trip. Output shown in chat.
- Build check: `npm run build` for the web bundle, then the Windows installer via `npm run dist`.

## Delivery
- README: `npm install` + `npm run dev` (browser), `npm run start` (desktop), `npm run dist` (installer and where the .exe lands).
- Push to a new GitHub repo (private by default unless you choose public).

## Decisions
- Repo: public, named `neon-dash`. Game name: Neon Dash.
- Pure game rules live in `src/logic/` (no Three.js), so the same code runs in the game and in the Node tests.
- Electron files are CommonJS (`.cjs`) because sandboxed preload scripts must be CommonJS.

## Status
- [x] p1 Project setup
- [x] p2 World and robot
- [x] p3 Core gameplay
- [x] p4 Game feel and UI
- [x] p5 Audio and saving
- [x] p6 Tests and proof (33 tests passing, plus a browser end-to-end check)
- [x] p7 Desktop app and installer config (Windows app folder packaged in the sandbox; the .exe installer is built on Windows with `npm run dist`)
- [x] p8 README and GitHub

// Entry point: load the save, build the game, show the start menu.
import { Game } from './game/game.js';
import { loadSave, isDesktop } from './save/storage.js';

async function boot() {
  const save = await loadSave();
  const game = new Game(document.getElementById('game'), save, isDesktop);
  document.getElementById('loading').remove();
  game.start();
  if (import.meta.env.DEV) window.__game = game; // handy for testing in the browser console
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Could not start the game (WebGL needed).';
});

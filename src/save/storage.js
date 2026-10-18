// Saving to the laptop. In the desktop app the save is a JSON file in the app's
// user data folder (written by the main process). In the browser it uses localStorage.
import { parseSave, serializeSave } from '../logic/save.js';

const KEY = 'neon-dash-save';
const bridge = typeof window !== 'undefined' ? window.neonDash : undefined;

export const isDesktop = !!bridge?.isDesktop;

export async function loadSave() {
  try {
    if (bridge) return parseSave(await bridge.loadSave());
    return parseSave(localStorage.getItem(KEY));
  } catch {
    return parseSave(null);
  }
}

let timer = 0;
let latest = null;

async function write(text) {
  try {
    if (bridge) await bridge.writeSave(text);
    else localStorage.setItem(KEY, text);
  } catch (err) {
    console.warn('Could not save', err);
  }
}

/** Save soon (settings sliders call this a lot, so writes are grouped). */
export function persist(save) {
  latest = serializeSave(save);
  clearTimeout(timer);
  timer = setTimeout(() => {
    write(latest);
    latest = null;
  }, 300);
}

/** Save right now (end of a run, closing the app). */
export function persistNow(save) {
  clearTimeout(timer);
  latest = null;
  return write(serializeSave(save));
}

/** Write any pending save before the window closes. */
export function flushPending() {
  if (latest) {
    clearTimeout(timer);
    write(latest);
    latest = null;
  }
}

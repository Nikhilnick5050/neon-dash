// Power-up timers. Pure logic.
import { POWER_DURATION, POWER_TYPES } from './constants.js';

export function createPowers() {
  return { magnet: 0, shield: 0, double: 0, jetpack: 0 };
}

export function resetPowers(pw) {
  for (const k of POWER_TYPES) pw[k] = 0;
}

/** Start (or refresh) a power-up. */
export function activatePower(pw, type) {
  if (!(type in POWER_DURATION)) throw new Error(`Unknown power-up: ${type}`);
  pw[type] = POWER_DURATION[type];
}

/** Count timers down. Calls onEnd(type) for each one that runs out. */
export function tickPowers(pw, dt, onEnd) {
  for (let i = 0; i < POWER_TYPES.length; i++) {
    const k = POWER_TYPES[i];
    if (pw[k] > 0) {
      pw[k] -= dt;
      if (pw[k] <= 0) {
        pw[k] = 0;
        if (onEnd) onEnd(k);
      }
    }
  }
}

export const isActive = (pw, type) => pw[type] > 0;
export const scoreMultiplier = (pw) => (pw.double > 0 ? 2 : 1);

/** Use the shield to survive a hit. Returns true if it saved the player. */
export function consumeShield(pw) {
  if (pw.shield > 0) {
    pw.shield = 0;
    return true;
  }
  return false;
}

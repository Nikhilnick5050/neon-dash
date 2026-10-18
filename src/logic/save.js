// Save data format: high scores and settings. Pure logic (the storage layer does the disk I/O).
import { MAX_HIGH_SCORES } from './constants.js';

export const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    best: 0,
    totalCoins: 0,
    highScores: [],
    settings: { music: 60, sfx: 80, quality: 'high', showFps: false },
  };
}

const num = (v, min, max, fallback) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;

/** Turn anything (old, broken or edited save data) into a valid save. */
export function sanitizeSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const scores = Array.isArray(raw.highScores) ? raw.highScores : [];
  const highScores = scores
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      score: num(e.score, 0, 1e9, 0),
      coins: num(e.coins, 0, 1e9, 0),
      date: typeof e.date === 'string' ? e.date.slice(0, 32) : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HIGH_SCORES);
  return {
    version: SAVE_VERSION,
    best: Math.max(num(raw.best, 0, 1e9, 0), highScores[0]?.score ?? 0),
    totalCoins: num(raw.totalCoins, 0, 1e12, 0),
    highScores,
    settings: {
      music: num(s.music, 0, 100, d.settings.music),
      sfx: num(s.sfx, 0, 100, d.settings.sfx),
      quality: s.quality === 'low' ? 'low' : 'high',
      showFps: s.showFps === true,
    },
  };
}

export function parseSave(text) {
  if (typeof text !== 'string' || !text) return defaultSave();
  try {
    return sanitizeSave(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export const serializeSave = (save) => JSON.stringify(sanitizeSave(save));

/** Add a finished run. Returns { isBest, rank } (rank is 1-based, 0 if not in the table). */
export function recordRun(save, score, coins, date = new Date().toISOString()) {
  const isBest = score > save.best;
  if (isBest) save.best = score;
  save.totalCoins += coins;
  const entry = { score, coins, date };
  save.highScores.push(entry);
  save.highScores.sort((a, b) => b.score - a.score);
  save.highScores.length = Math.min(save.highScores.length, MAX_HIGH_SCORES);
  const rank = save.highScores.indexOf(entry) + 1;
  return { isBest, rank };
}

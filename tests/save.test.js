import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { defaultSave, parseSave, serializeSave, recordRun, sanitizeSave } from '../src/logic/save.js';

const require = createRequire(import.meta.url);
const { readSave, writeSave, savePath } = require('../electron/save-file.cjs');

test('high score and settings survive a save/load round trip', () => {
  const save = defaultSave();
  recordRun(save, 1234, 56);
  save.settings.music = 25;
  save.settings.quality = 'low';
  save.settings.showFps = true;
  const loaded = parseSave(serializeSave(save));
  assert.equal(loaded.best, 1234);
  assert.equal(loaded.totalCoins, 56);
  assert.deepEqual(loaded.settings, { music: 25, sfx: 80, quality: 'low', showFps: true });
});

test('high score table keeps the top 10, sorted, and reports new bests', () => {
  const save = defaultSave();
  const scores = [500, 100, 900, 300, 700, 50, 1000, 200, 800, 400, 600, 150];
  let lastBest = null;
  for (const s of scores) lastBest = recordRun(save, s, 1);
  assert.equal(save.highScores.length, 10);
  assert.deepEqual(save.highScores.map((e) => e.score), [1000, 900, 800, 700, 600, 500, 400, 300, 200, 150]);
  assert.equal(save.best, 1000);
  assert.deepEqual(lastBest, { isBest: false, rank: 10 });
  assert.equal(recordRun(save, 2000, 0).isBest, true);
});

test('broken or edited save files fall back to safe values', () => {
  assert.deepEqual(parseSave('not json {'), defaultSave());
  assert.deepEqual(parseSave(''), defaultSave());
  const s = sanitizeSave({ best: -5, settings: { music: 999, quality: 'ultra', showFps: 'yes' }, highScores: [null, { score: 'x' }] });
  assert.equal(s.best, 0);
  assert.equal(s.settings.music, 100);
  assert.equal(s.settings.quality, 'high');
  assert.equal(s.settings.showFps, false);
});

test('desktop save file: written to disk, read back after a "restart"', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-dash-'));
  assert.equal(readSave(dir), null, 'no save on first launch');
  const save = defaultSave();
  recordRun(save, 4321, 9);
  assert.equal(writeSave(dir, serializeSave(save)), true);
  assert.ok(fs.existsSync(savePath(dir)));
  // Simulate closing and reopening the app: read from disk again.
  const again = parseSave(readSave(dir));
  assert.equal(again.best, 4321);
  assert.equal(writeSave(dir, '{bad json'), false, 'invalid data is refused');
  assert.equal(parseSave(readSave(dir)).best, 4321, 'old save kept');
  fs.rmSync(dir, { recursive: true, force: true });
});

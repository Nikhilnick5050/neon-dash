import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpawner, generateRow, findPath } from '../src/logic/spawner.js';
import { LANE_BLOCKERS, SPEED, OBSTACLE } from '../src/logic/constants.js';

const SEEDS = 500;
const ROWS = 300;

function generate(seed, speedOf) {
  const sp = createSpawner(seed);
  const rows = [];
  for (let i = 0; i < ROWS; i++) rows.push(generateRow(sp, speedOf(i)));
  return rows;
}

for (const [name, speedOf] of [
  ['start speed', () => SPEED.start],
  ['max speed', () => SPEED.max],
  ['speeding up', (i) => Math.min(SPEED.max, SPEED.start + i * 0.1)],
]) {
  test(`every generated track has a way through (${SEEDS} seeds x ${ROWS} rows, ${name})`, () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rows = generate(seed, speedOf);
      const speed = speedOf(ROWS);
      const res = findPath(rows, speed);
      assert.ok(res.ok, `seed ${seed} blocked at row ${res.row}`);
    }
  });
}

test('the safe lane never holds a train or block, and moves at most one lane per row', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rows = generate(seed, () => 25);
    let prev = 1;
    for (const row of rows) {
      assert.ok(Math.abs(row.safe - prev) <= 1);
      for (const o of row.obstacles) {
        if (o.lane === row.safe) assert.ok(!LANE_BLOCKERS.has(o.type), `seed ${seed}: blocker in safe lane`);
      }
      prev = row.safe;
    }
  }
});

test('the checker really catches a blocked road', () => {
  const wall = { z: 50, safe: 1, coins: [], power: null, obstacles: [0, 1, 2].map((lane) => ({ type: 'train', lane, z: 50, length: 10 })) };
  assert.equal(findPath([wall], 20).ok, false);
});

test('all obstacle types and power-ups show up, and coins never sit inside a train', () => {
  const seen = new Set();
  const powers = new Set();
  for (let seed = 1; seed <= 50; seed++) {
    const rows = generate(seed, (i) => Math.min(SPEED.max, SPEED.start + i * 0.1));
    const trains = [[], [], []];
    for (const row of rows) {
      for (const o of row.obstacles) {
        seen.add(o.type);
        if (LANE_BLOCKERS.has(o.type)) trains[o.lane].push([o.z, o.z + o.length]);
      }
      if (row.power) powers.add(row.power.type);
    }
    for (const row of rows) {
      for (const c of row.coins) {
        const inside = trains[c.lane].some(([a, b]) => c.z > a - 0.5 && c.z < b + 0.5);
        assert.ok(!inside, `seed ${seed}: coin at ${c.z.toFixed(1)} inside a train`);
      }
    }
  }
  for (const t of Object.keys(OBSTACLE)) assert.ok(seen.has(t), `missing obstacle type ${t}`);
  assert.deepEqual([...powers].sort(), ['double', 'jetpack', 'magnet', 'shield']);
});

test('same seed gives the same track', () => {
  assert.deepEqual(generate(42, () => 20), generate(42, () => 20));
});

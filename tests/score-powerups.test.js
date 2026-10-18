import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScore, addDistance, addCoin, totalScore } from '../src/logic/score.js';
import { createPowers, activatePower, tickPowers, scoreMultiplier, consumeShield } from '../src/logic/powerups.js';
import { createRun, startRun, stepRun, runScore } from '../src/logic/run.js';
import { POWER_DURATION, SPEED } from '../src/logic/constants.js';

test('score = distance + 10 per coin', () => {
  const s = createScore();
  addDistance(s, 250.7);
  for (let i = 0; i < 12; i++) addCoin(s);
  assert.equal(s.coins, 12);
  assert.equal(totalScore(s), 250 + 120);
});

test('2x doubles both distance and coin points while active', () => {
  const s = createScore();
  addDistance(s, 100, 2);
  addCoin(s, 2);
  assert.equal(totalScore(s), 220);
});

test('power-up timers count down and report when they end', () => {
  const pw = createPowers();
  activatePower(pw, 'double');
  activatePower(pw, 'magnet');
  assert.equal(scoreMultiplier(pw), 2);
  const ended = [];
  for (let t = 0; t < POWER_DURATION.double + 0.1; t += 0.1) tickPowers(pw, 0.1, (k) => ended.push(k));
  assert.deepEqual(ended.sort(), ['double', 'magnet']);
  assert.equal(scoreMultiplier(pw), 1);
  assert.throws(() => activatePower(pw, 'teleport'));
});

test('shield is used up by one hit', () => {
  const pw = createPowers();
  assert.equal(consumeShield(pw), false);
  activatePower(pw, 'shield');
  assert.equal(consumeShield(pw), true);
  assert.equal(consumeShield(pw), false);
});

test('magnet pulls coins from the next lane into the player', () => {
  const run = createRun();
  startRun(run, 3);
  run.obstacles.length = 0;
  run.coins.length = 0;
  run.pickups.length = 0;
  run.spawner.nextZ = 1e9;
  run.coins.push({ x: 2.4, y: 0.7, z: 15, magnet: false }); // right lane, player is in the centre
  run.powers.magnet = 10;
  let got = 0;
  run.hooks.coin = () => got++;
  for (let i = 0; i < 240; i++) stepRun(run, 1 / 120);
  assert.equal(got, 1);
  assert.equal(run.score.coins, 1);
});

test('speed rises over time and stops at the cap; score grows with distance', () => {
  const run = createRun();
  startRun(run, 7);
  run.obstacles.length = 0;
  run.spawner.nextZ = 1e9;
  for (let i = 0; i < 120 * 10; i++) stepRun(run, 1 / 120);
  assert.ok(run.speed > SPEED.start && run.speed < SPEED.max);
  assert.ok(Math.abs(run.speed - (SPEED.start + SPEED.accel * 10)) < 0.01);
  assert.ok(runScore(run) >= Math.floor(run.score.distance));
  run.time = 1e4;
  stepRun(run, 1 / 120);
  assert.equal(run.speed, SPEED.max);
});

test('object pools: a long run reuses objects instead of creating new ones', () => {
  const run = createRun();
  startRun(run, 11);
  run.powers.shield = 1e9; // survive everything, so the run keeps going
  run.invuln = 0;
  const step = () => {
    run.powers.shield = 1e9;
    stepRun(run, 1 / 120);
  };
  for (let i = 0; i < 120 * 30; i++) step();
  const created = run.obstaclePool.created + run.coinPool.created;
  for (let i = 0; i < 120 * 60; i++) step();
  const after = run.obstaclePool.created + run.coinPool.created;
  assert.equal(run.state, 'running');
  assert.ok(after - created < 20, `created ${after - created} new objects in the second minute`);
});

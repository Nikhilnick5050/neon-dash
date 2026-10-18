import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, startRun, stepRun, actJump, actSlide, actLeft } from '../src/logic/run.js';
import { createPlayer, playerBox, slide, jump, updatePlayer } from '../src/logic/player.js';
import { makeBox, hitsObstacle } from '../src/logic/collision.js';

const DT = 1 / 120;

// A run with an empty track, then one hand-placed obstacle 20 m ahead.
function runWith(obstacle) {
  const run = createRun();
  startRun(run, 1);
  run.obstacles.length = 0;
  run.coins.length = 0;
  run.pickups.length = 0;
  run.spawner.nextZ = 1e9; // no new rows
  run.obstacles.push({ hit: false, view: null, ...obstacle, z: 20 });
  return run;
}

/** Run until past the obstacle or dead. `act(run, distanceToObstacle)` can press buttons. */
function play(run, act = () => {}) {
  for (let i = 0; i < 120 * 4 && run.state === 'running'; i++) {
    act(run, 20 - run.player.dist);
    stepRun(run, DT);
    if (run.player.dist > 32) break;
  }
  return run.state;
}

const once = (fn, at) => {
  let done = false;
  return (run, d) => {
    if (!done && d < at) { done = true; fn(run); }
  };
};

test('box overlap: standing player hits a low barrier in its lane', () => {
  const p = createPlayer();
  p.dist = 20.2;
  assert.equal(hitsObstacle(playerBox(p, makeBox()), { type: 'low', lane: 1, z: 20 }), true);
  assert.equal(hitsObstacle(playerBox(p, makeBox()), { type: 'low', lane: 0, z: 20 }), false, 'other lane is clear');
});

test('sliding player passes under a high barrier, standing player does not', () => {
  const p = createPlayer();
  p.dist = 20.2;
  const o = { type: 'high', lane: 1, z: 20 };
  assert.equal(hitsObstacle(playerBox(p, makeBox()), o), true);
  slide(p);
  assert.equal(hitsObstacle(playerBox(p, makeBox()), o), false);
});

test('running into a low barrier ends the run; jumping clears it', () => {
  assert.equal(play(runWith({ type: 'low', lane: 1 })), 'dead');
  assert.equal(play(runWith({ type: 'low', lane: 1 }), once(actJump, 4)), 'running');
});

test('high barrier: slide under it to survive', () => {
  assert.equal(play(runWith({ type: 'high', lane: 1 })), 'dead');
  assert.equal(play(runWith({ type: 'high', lane: 1 }), once(actSlide, 4)), 'running');
});

test('gap: falling in ends the run, jumping over survives', () => {
  const r = runWith({ type: 'gap', lane: 1 });
  assert.equal(play(r), 'dead');
  assert.equal(r.fellInGap, true);
  assert.equal(play(runWith({ type: 'gap', lane: 1 }), once(actJump, 3)), 'running');
});

test('train: cannot jump over it, changing lane avoids it', () => {
  assert.equal(play(runWith({ type: 'train', lane: 1, length: 12 }), once(actJump, 3)), 'dead');
  assert.equal(play(runWith({ type: 'train', lane: 1, length: 12 }), once(actLeft, 8)), 'running');
});

test('shield absorbs exactly one hit', () => {
  const run = runWith({ type: 'block', lane: 1, length: 2.5 });
  run.powers.shield = 10;
  let broke = 0;
  run.hooks.shieldBreak = () => broke++;
  assert.equal(play(run), 'running');
  assert.equal(broke, 1);
  assert.equal(run.powers.shield, 0);
});

test('jetpack flies over a train', () => {
  const run = runWith({ type: 'train', lane: 1, length: 20 });
  run.pickups.push({ type: 'jetpack', x: 0, y: 1, z: 1, view: null });
  assert.equal(play(run), 'running');
  assert.ok(run.player.y > 3.3, `flying at ${run.player.y.toFixed(1)} m`);
});

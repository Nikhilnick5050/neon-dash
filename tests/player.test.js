import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayer, changeLane, jump, slide, updatePlayer, playerHeight, setJet,
} from '../src/logic/player.js';
import { laneX, PLAYER, JET } from '../src/logic/constants.js';

const DT = 1 / 120;
const run = (p, seconds, speed = 14) => {
  for (let t = 0; t < seconds; t += DT) updatePlayer(p, DT, speed);
};

test('lane changes move left and right and stop at the edges', () => {
  const p = createPlayer();
  assert.equal(p.lane, 1);
  assert.equal(changeLane(p, -1), true);
  assert.equal(p.lane, 0);
  assert.equal(changeLane(p, -1), false, 'cannot go past the left edge');
  assert.equal(p.lane, 0);
  changeLane(p, 1);
  changeLane(p, 1);
  assert.equal(p.lane, 2);
  assert.equal(changeLane(p, 1), false, 'cannot go past the right edge');
});

test('lane change is smooth and finishes in about a quarter second', () => {
  const p = createPlayer();
  changeLane(p, 1);
  updatePlayer(p, DT, 14);
  assert.ok(p.x > 0 && p.x < laneX(2), 'moves part of the way after one step');
  run(p, 0.35);
  assert.ok(Math.abs(p.x - laneX(2)) < 0.01, `x=${p.x} should reach lane 2`);
});

test('jump goes up about 1.8 m and lands after about 0.7 s', () => {
  const p = createPlayer();
  assert.equal(jump(p), true);
  assert.equal(jump(p), false, 'no double jump');
  let peak = 0;
  let t = 0;
  while (!p.grounded && t < 2) {
    updatePlayer(p, DT, 14);
    peak = Math.max(peak, p.y);
    t += DT;
  }
  assert.ok(peak > 1.7 && peak < 1.95, `peak ${peak.toFixed(2)}`);
  assert.ok(t > 0.6 && t < 0.8, `air time ${t.toFixed(2)}`);
  assert.equal(p.y, 0);
});

test('slide lowers the player, then stands back up', () => {
  const p = createPlayer();
  slide(p);
  assert.equal(playerHeight(p), PLAYER.slideHeight);
  run(p, 0.8);
  assert.equal(playerHeight(p), PLAYER.height);
});

test('slide in the air drops fast and slides on landing', () => {
  const p = createPlayer();
  jump(p);
  run(p, 0.1);
  slide(p);
  let t = 0;
  while (!p.grounded) {
    updatePlayer(p, DT, 14);
    t += DT;
  }
  assert.ok(t < 0.2, `fast fall took ${t.toFixed(2)} s`);
  assert.equal(playerHeight(p), PLAYER.slideHeight);
});

test('jetpack lifts the player up and gravity brings it back', () => {
  const p = createPlayer();
  setJet(p, true);
  assert.equal(jump(p), false, 'no jumping while flying');
  run(p, 2);
  assert.ok(Math.abs(p.y - JET.height) < 0.1, `flying at ${p.y.toFixed(2)}`);
  setJet(p, false);
  run(p, 1.5);
  assert.equal(p.y, 0);
  assert.equal(p.grounded, true);
});

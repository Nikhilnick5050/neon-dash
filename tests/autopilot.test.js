// End-to-end proof: a simple bot plays real generated runs with the real physics
// and collision code, using only the same moves a player has (left, right, jump, slide).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, startRun, stepRun, actLeft, actRight, actJump, actSlide, runScore } from '../src/logic/run.js';
import { LANE_BLOCKERS, laneX } from '../src/logic/constants.js';
import { obstacleDepth } from '../src/logic/collision.js';

const DT = 1 / 120;

/** How far ahead (metres) a lane stays free of trains and blocks. */
function freeAhead(run, lane) {
  const p = run.player;
  let first = Infinity;
  for (const o of run.obstacles) {
    if (o.lane !== lane || !LANE_BLOCKERS.has(o.type)) continue;
    const end = o.z + obstacleDepth(o);
    if (end < p.dist - 1) continue;
    first = Math.min(first, Math.max(0, o.z - p.dist));
  }
  return first;
}

/** Is there a barrier or gap in this lane just ahead (too close to cross while changing lane)? */
function hazardSoon(run, lane) {
  const p = run.player;
  for (const o of run.obstacles) {
    if (o.lane !== lane || LANE_BLOCKERS.has(o.type)) continue;
    const d = o.z - p.dist;
    if (d > -obstacleDepth(o) - 1 && d < run.speed * 0.4 + 2) return true;
  }
  return false;
}

function bot(run) {
  const p = run.player;
  const nowClear = run.speed * 0.3 + 1.5; // a lane must be clear this far to move through it
  // Plan: head for the lane that stays clear the longest and can be reached now.
  let target = p.lane;
  let best = freeAhead(run, p.lane);
  const emergency = best < nowClear * 1.6; // own lane about to be blocked: move even past barriers
  for (let l = 0; l < 3; l++) {
    const step = Math.sign(l - p.lane);
    let reachable = true;
    for (let k = p.lane + step; k !== l + step && step !== 0; k += step) {
      if (freeAhead(run, k) < nowClear || (!emergency && hazardSoon(run, k))) reachable = false;
    }
    if (step !== 0 && !emergency && hazardSoon(run, p.lane)) reachable = false;
    const f = freeAhead(run, l);
    if (reachable && f > best + 6) { best = f; target = l; }
  }
  if (target !== p.lane) (target < p.lane ? actLeft : actRight)(run);

  // Jump or slide for anything in the lanes the robot's body is in right now.
  for (const o of run.obstacles) {
    if (LANE_BLOCKERS.has(o.type) || Math.abs(laneX(o.lane) - p.x) > 1.5) continue;
    const d = o.z - p.dist;
    if (o.type === 'high' && d > 0 && d < run.speed * 0.2 + 0.6) actSlide(run);
    if ((o.type === 'low' || o.type === 'gap') && d > 0 && d < run.speed * 0.12 + 0.8) actJump(run);
  }
}

test('autopilot survives 3 minutes on 40 random tracks (real physics, no shield)', () => {
  const results = [];
  for (let seed = 1; seed <= 40; seed++) {
    const run = createRun();
    startRun(run, seed);
    for (let i = 0; i < 120 * 180 && run.state === 'running'; i++) {
      bot(run);
      stepRun(run, DT);
    }
    results.push({ seed, state: run.state, metres: Math.round(run.score.distance), score: runScore(run), by: run.deathBy?.type });
  }
  console.log(results.map((r) => `seed ${String(r.seed).padStart(2)}: ${r.state.padEnd(7)} ${String(r.metres).padStart(5)} m  score ${r.score}${r.by ? '  hit ' + r.by : ''}`).join('\n'));
  const dead = results.filter((r) => r.state !== 'running');
  assert.equal(dead.length, 0, `bot crashed on seeds ${dead.map((r) => r.seed).join(', ')}`);
});

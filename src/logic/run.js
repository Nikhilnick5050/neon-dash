// One run of the game: player, track, coins, power-ups, collisions and score.
// Pure logic (no Three.js, no DOM). The renderer reads this state every frame.
import {
  SPEED, PHYS, JET, MAGNET_RANGE, COIN_RADIUS, POWER_RADIUS, HIT_GRACE, POWER_DURATION, laneX,
} from './constants.js';
import {
  createPlayer, resetPlayer, updatePlayer, playerBox, changeLane, jump, slide, setJet,
} from './player.js';
import { makeBox, hitsObstacle, obstacleDepth, nearPlayer } from './collision.js';
import { createSpawner, generateRow } from './spawner.js';
import { createScore, resetScore, addDistance, addCoin, totalScore } from './score.js';
import { createPowers, resetPowers, activatePower, tickPowers, consumeShield, scoreMultiplier } from './powerups.js';
import { Pool, swapRemove } from './pool.js';

export const VIEW_AHEAD = 170; // metres of track kept spawned in front of the player
const BEHIND = 12; // metres behind the player before things are recycled

const noop = () => {};

export function createRun(hooks = {}) {
  const run = {
    hooks: {
      coin: noop, power: noop, powerEnd: noop, shieldBreak: noop, death: noop,
      obstacleRemoved: noop, powerRemoved: noop, ...hooks,
    },
    player: createPlayer(),
    powers: createPowers(),
    score: createScore(),
    spawner: null,
    speed: SPEED.start,
    time: 0,
    invuln: 0,
    state: 'running', // 'running' | 'dead'
    deathT: 0,
    deathBy: null,
    fellInGap: false,
    jetEnd: -1, // distance where the jetpack runs out
    calmFrom: -1, // no obstacles in this stretch, so the jetpack landing is safe
    calmTo: -1,
    obstacles: [],
    coins: [],
    pickups: [],
    obstaclePool: new Pool(() => ({ type: '', lane: 0, z: 0, length: undefined, hit: false, view: null })),
    coinPool: new Pool(() => ({ x: 0, y: 0, z: 0, magnet: false }), null, 128),
    pickupPool: new Pool(() => ({ type: '', x: 0, y: 0, z: 0, view: null })),
    _box: makeBox(),
  };
  return run;
}

export function startRun(run, seed = (Math.random() * 2 ** 31) | 0) {
  clearEntities(run);
  resetPlayer(run.player);
  resetPowers(run.powers);
  resetScore(run.score);
  run.spawner = createSpawner(seed);
  run.speed = SPEED.start;
  run.time = 0;
  run.invuln = 0;
  run.state = 'running';
  run.deathT = 0;
  run.deathBy = null;
  run.fellInGap = false;
  run.jetEnd = run.calmFrom = run.calmTo = -1;
  fillTrack(run);
}

function clearEntities(run) {
  for (const o of run.obstacles) releaseObstacle(run, o);
  for (const c of run.coins) run.coinPool.release(c);
  for (const pk of run.pickups) releasePickup(run, pk);
  run.obstacles.length = run.coins.length = run.pickups.length = 0;
}

function releaseObstacle(run, o) {
  run.hooks.obstacleRemoved(o);
  o.view = null;
  o.hit = false;
  o.length = undefined;
  run.obstaclePool.release(o);
}

function releasePickup(run, pk) {
  run.hooks.powerRemoved(pk);
  pk.view = null;
  run.pickupPool.release(pk);
}

function fillTrack(run) {
  const sp = run.spawner;
  const p = run.player;
  while (sp.nextZ < p.dist + VIEW_AHEAD) {
    const z = sp.nextZ;
    const calm = z >= run.calmFrom && z <= run.calmTo;
    const jet = z < run.jetEnd - 4;
    const row = generateRow(sp, run.speed, { jet });
    if (!calm) {
      for (const src of row.obstacles) {
        const o = run.obstaclePool.acquire();
        o.type = src.type;
        o.lane = src.lane;
        o.z = src.z;
        o.length = src.length;
        o.hit = false;
        run.obstacles.push(o);
      }
    }
    for (const src of row.coins) {
      const c = run.coinPool.acquire();
      c.x = laneX(src.lane);
      c.y = src.y;
      c.z = src.z;
      c.magnet = false;
      run.coins.push(c);
    }
    if (row.power && !jet) {
      const pk = run.pickupPool.acquire();
      pk.type = row.power.type;
      pk.x = laneX(row.power.lane);
      pk.y = row.power.y;
      pk.z = row.power.z;
      run.pickups.push(pk);
    }
  }
}

// Input actions (return true if something happened, used for sounds).
export const actLeft = (run) => run.state === 'running' && changeLane(run.player, -1);
export const actRight = (run) => run.state === 'running' && changeLane(run.player, 1);
export const actJump = (run) => run.state === 'running' && jump(run.player);
export const actSlide = (run) => run.state === 'running' && slide(run.player);

export const runScore = (run) => totalScore(run.score);

function startJetpack(run) {
  const p = run.player;
  setJet(p, true);
  const flight = run.speed * POWER_DURATION.jetpack;
  run.jetEnd = p.dist + flight;
  // Clear a landing zone: the descent takes about 0.7 s, plus a margin.
  run.calmFrom = run.jetEnd - 8;
  run.calmTo = run.jetEnd + run.speed * 1.6 + 20;
  for (let i = run.obstacles.length - 1; i >= 0; i--) {
    const o = run.obstacles[i];
    if (o.z + obstacleDepth(o) >= run.calmFrom && o.z <= run.calmTo) {
      releaseObstacle(run, o);
      swapRemove(run.obstacles, i);
    }
  }
  // A weaving trail of coins in the sky for the whole flight.
  const lane0 = p.lane;
  for (let z = p.dist + 18, i = 0; z < run.jetEnd - 6; z += 2.4, i++) {
    const c = run.coinPool.acquire();
    const lane = Math.round(1 + Math.sin(i * 0.16 + lane0) * 1.0);
    c.x = laneX(lane);
    c.y = JET.height + 0.9;
    c.z = z;
    c.magnet = false;
    run.coins.push(c);
  }
}

function die(run, o) {
  run.state = 'dead';
  run.deathT = 0;
  run.deathBy = o;
  const p = run.player;
  if (o.type === 'gap') {
    run.fellInGap = true;
    p.grounded = false;
    p.vy = -2;
  } else {
    run.speed = 0;
  }
  run.hooks.death(o);
}

function onPowerEnd(run, type) {
  if (type === 'jetpack') {
    setJet(run.player, false);
    run.invuln = Math.max(run.invuln, JET.landingGrace);
    run.jetEnd = -1;
  }
  run.hooks.powerEnd(type);
}

/** Advance the run by dt seconds (call with a fixed step). */
export function stepRun(run, dt) {
  const p = run.player;

  if (run.state === 'dead') {
    run.deathT += dt;
    if (run.fellInGap) {
      p.vy -= PHYS.gravity * dt;
      p.y += p.vy * dt;
      p.dist += run.speed * dt;
      run.speed *= Math.exp(-3 * dt);
    }
    return;
  }

  run.time += dt;
  run.speed = Math.min(SPEED.max, SPEED.start + SPEED.accel * run.time);

  updatePlayer(p, dt, run.speed);
  addDistance(run.score, run.speed * dt, scoreMultiplier(run.powers));
  tickPowers(run.powers, dt, (type) => onPowerEnd(run, type));
  if (run.invuln > 0) run.invuln = Math.max(0, run.invuln - dt);

  fillTrack(run);

  // Obstacles: recycle the ones behind, test the ones near the player.
  const box = playerBox(p, run._box);
  const safe = p.jet || run.invuln > 0;
  for (let i = run.obstacles.length - 1; i >= 0; i--) {
    const o = run.obstacles[i];
    const end = o.z + obstacleDepth(o);
    if (end < p.dist - BEHIND) {
      releaseObstacle(run, o);
      swapRemove(run.obstacles, i);
      continue;
    }
    if (safe || o.hit || o.z > p.dist + 2 || end < p.dist - 2) continue;
    if (hitsObstacle(box, o)) {
      if (consumeShield(run.powers)) {
        o.hit = true;
        run.invuln = HIT_GRACE;
        run.hooks.shieldBreak(o);
      } else {
        die(run, o);
        return;
      }
    }
  }

  // Coins: magnet pull, pickup, recycle.
  const magnet = run.powers.magnet > 0;
  const pull = 1 - Math.exp(-14 * dt);
  for (let i = run.coins.length - 1; i >= 0; i--) {
    const c = run.coins[i];
    if (c.z < p.dist - BEHIND) {
      run.coinPool.release(c);
      swapRemove(run.coins, i);
      continue;
    }
    if (magnet && !c.magnet && c.z - p.dist < MAGNET_RANGE && c.z > p.dist - 1) c.magnet = true;
    if (c.magnet) {
      c.x += (p.x - c.x) * pull;
      c.y += (p.y + 0.9 - c.y) * pull;
      c.z += (p.dist - c.z) * pull;
    }
    if (nearPlayer(p, c.x, c.y, c.z, COIN_RADIUS)) {
      addCoin(run.score, scoreMultiplier(run.powers));
      run.hooks.coin(c);
      run.coinPool.release(c);
      swapRemove(run.coins, i);
    }
  }

  // Power-up pickups.
  for (let i = run.pickups.length - 1; i >= 0; i--) {
    const pk = run.pickups[i];
    const behind = pk.z < p.dist - BEHIND;
    const got = !behind && nearPlayer(p, pk.x, pk.y, pk.z, POWER_RADIUS);
    if (got) {
      activatePower(run.powers, pk.type);
      if (pk.type === 'jetpack') startJetpack(run);
      run.hooks.power(pk.type);
    }
    if (behind || got) {
      releasePickup(run, pk);
      swapRemove(run.pickups, i);
    }
  }
}

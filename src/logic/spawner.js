// Endless pattern generator. Pure logic, seeded, testable.
//
// Rule that keeps every run possible: the generator walks a "safe lane" through the
// rows. The safe lane never holds a train or block, it only moves one lane per row,
// and it may only move into a lane once any train there has ended, with room to switch.
// The safe lane can still hold a low barrier, high barrier or gap (jump or slide past).
import { LANE_COUNT, SPEED, OBSTACLE, LANE_BLOCKERS } from './constants.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const difficulty = (speed) => clamp((speed - SPEED.start) / (SPEED.max - SPEED.start), 0, 1);
/** Distance needed to change lane safely before a row, at this speed. */
export const switchMargin = (speed) => Math.max(5, speed * 0.4);

export function createSpawner(seed = Date.now()) {
  return {
    rng: mulberry32(seed),
    nextZ: 45, // first row 45 m ahead of the start
    prevZ: 0,
    safe: 1,
    laneFreeAt: [0, 0, 0], // where the last train/block in each lane ends
    row: 0,
    lastPowerRow: 0,
  };
}

function pickPower(r) {
  const k = r();
  if (k < 0.3) return 'magnet';
  if (k < 0.55) return 'shield';
  if (k < 0.82) return 'double';
  return 'jetpack';
}

/**
 * Generate the next row of the track.
 * @returns {{z:number, safe:number, obstacles:Array, coins:Array, power:object|null}}
 */
export function generateRow(sp, speed, opts = {}) {
  const r = sp.rng;
  const diff = difficulty(speed);
  const z = sp.nextZ;
  const span = z - sp.prevZ;
  const margin = switchMargin(speed);

  // 1. Move the safe lane (at most one lane, only into lanes that are free in time).
  let safe = sp.safe;
  const cands = [];
  for (let l = sp.safe - 1; l <= sp.safe + 1; l++) {
    if (l >= 0 && l < LANE_COUNT && l !== sp.safe && sp.laneFreeAt[l] + margin <= z) cands.push(l);
  }
  if (cands.length && r() < 0.45) safe = cands[Math.floor(r() * cands.length)];

  // 2. Obstacles. Safe lane: nothing, or something you can jump/slide past.
  const obstacles = [];
  const gentle = sp.row < 3;
  if (!gentle && r() < 0.3 + 0.35 * diff) {
    const k = r();
    const type = k < 0.4 ? 'low' : k < 0.75 ? 'high' : sp.row > 5 ? 'gap' : 'low';
    obstacles.push({ type, lane: safe, z });
  }

  // Other lanes: anything, including trains and blocks.
  const fill = gentle ? 0.35 : 0.5 + 0.35 * diff;
  for (let l = 0; l < LANE_COUNT; l++) {
    if (l === safe || sp.laneFreeAt[l] > z || r() > fill) continue;
    const k = r();
    if (k < 0.42) {
      const isBlock = k < 0.14;
      const length = isBlock ? 2.5 : 10 + r() * 14;
      obstacles.push({ type: isBlock ? 'block' : 'train', lane: l, z, length });
      sp.laneFreeAt[l] = z + length;
    } else {
      const type = k < 0.62 ? 'low' : k < 0.82 ? 'high' : 'gap';
      obstacles.push({ type, lane: l, z });
    }
  }

  // 3. Coins and power-ups (placed only where the lane is clear).
  const coins = [];
  let power = null;
  const freeFrom = sp.laneFreeAt[safe] + 1.5; // safe lane never gets a new train, so this is stable
  const safeType = obstacles.length && obstacles[0].lane === safe ? obstacles[0].type : null;

  if (opts.jet) {
    // Flying over this row: the run places the air coins itself, so no ground coins here.
  } else {
    const placePower = sp.row - sp.lastPowerRow >= 6 && sp.row > 3 && r() < 0.14;
    if (placePower) {
      const pz = z - span * 0.5;
      if (pz > freeFrom) {
        power = { type: pickPower(r), lane: safe, z: pz, y: 1.0 };
        sp.lastPowerRow = sp.row;
      }
    }
    if ((safeType === 'low' || safeType === 'gap') && r() < 0.8) {
      // Arc over the obstacle, following the jump.
      const mid = z + OBSTACLE[safeType].d / 2;
      for (let i = 0; i < 7; i++) {
        const u = (i / 6) * 2 - 1;
        coins.push({ lane: safe, z: mid + u * 5.5, y: 0.7 + 1.5 * (1 - u * u) });
      }
    } else if (!power && r() < 0.7) {
      // Straight line leading into the row.
      for (let cz = z - span * 0.45; cz < z - 3; cz += 2.0) {
        if (cz > freeFrom) coins.push({ lane: safe, z: cz, y: 0.7 });
      }
    }
  }

  // 4. Next row distance grows with speed, so reaction time stays fair.
  sp.prevZ = z;
  sp.safe = safe;
  sp.row++;
  sp.nextZ = z + Math.max(14, speed * 0.9) * (1 + r() * 0.4);

  return { z, speed, safe, obstacles, coins, power };
}

/**
 * Independent checker used by the tests: is there a lane path through these rows?
 * A lane is open at a row unless a train/block covers it; moving between rows can
 * shift one lane, if both lanes are clear for the switch. The switch distance uses
 * the speed each row was made for (row.speed), or `speed` if it is missing.
 */
export function findPath(rows, speed) {
  const lanes = [[], [], []];
  for (const row of rows) {
    for (const o of row.obstacles) {
      if (LANE_BLOCKERS.has(o.type)) lanes[o.lane].push([o.z, o.z + o.length]);
    }
  }
  const blocked = (lane, a, b) => lanes[lane].some(([s, e]) => s < b && e > a);
  let reach = [1];
  let prevZ = 0;
  for (let i = 0; i < rows.length; i++) {
    const z = rows[i].z;
    const sw = Math.max(3, (rows[i].speed ?? speed) * 0.25);
    const next = [];
    for (let L = 0; L < LANE_COUNT; L++) {
      if (blocked(L, z - 0.5, z + 0.5)) continue;
      const ok = reach.some(
        (l) => Math.abs(l - L) <= 1 && !blocked(l, prevZ + 0.5, z - sw) && !blocked(L, z - sw, z),
      );
      if (ok) next.push(L);
    }
    if (!next.length) return { ok: false, row: i };
    reach = next;
    prevZ = z;
  }
  return { ok: true };
}

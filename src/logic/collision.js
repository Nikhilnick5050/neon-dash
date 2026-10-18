// Axis-aligned box collision between the player and obstacles. Pure logic.
import { OBSTACLE, laneX } from './constants.js';

export const makeBox = () => ({ minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });

export function overlaps(a, b) {
  return (
    a.minX < b.maxX && a.maxX > b.minX &&
    a.minY < b.maxY && a.maxY > b.minY &&
    a.minZ < b.maxZ && a.maxZ > b.minZ
  );
}

/** Depth of an obstacle along the track. */
export function obstacleDepth(o) {
  return o.length ?? OBSTACLE[o.type].d;
}

/** Write an obstacle's box into `out`. Obstacle: { type, lane, z, length? }. */
export function obstacleBox(o, out) {
  const s = OBSTACLE[o.type];
  const x = laneX(o.lane);
  out.minX = x - s.w / 2;
  out.maxX = x + s.w / 2;
  out.minY = s.y;
  out.maxY = s.y + s.h;
  out.minZ = o.z;
  out.maxZ = o.z + obstacleDepth(o);
  return out;
}

const _o = makeBox();
/** True if the player box touches the obstacle. */
export function hitsObstacle(playerB, o) {
  return overlaps(playerB, obstacleBox(o, _o));
}

/** Distance check for coins and power-ups (sphere-ish, around the player's chest). */
export function nearPlayer(p, x, y, z, radius, chestY = 0.9) {
  const dx = p.x - x;
  const dy = p.y + chestY - y;
  const dz = p.dist - z;
  return dx * dx + dy * dy + dz * dz < radius * radius;
}

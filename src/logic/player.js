// Player movement rules: lanes, jump, slide, jetpack. Pure logic.
import { LANE_COUNT, PHYS, PLAYER, JET, laneX } from './constants.js';

export function createPlayer() {
  return {
    lane: 1,
    x: 0,
    y: 0,
    vy: 0,
    dist: 0, // distance run, in metres
    grounded: true,
    slideT: 0,
    queuedSlide: false,
    jet: false,
    tilt: 0, // -1..1, used by the animation when changing lane
  };
}

export function resetPlayer(p) {
  Object.assign(p, createPlayer());
}

/** Move one lane left (-1) or right (+1). Returns true if the lane changed. */
export function changeLane(p, dir) {
  const next = Math.max(0, Math.min(LANE_COUNT - 1, p.lane + dir));
  if (next === p.lane) return false;
  p.lane = next;
  p.tilt = dir;
  return true;
}

export function jump(p) {
  if (p.jet || !p.grounded) return false;
  p.vy = PHYS.jumpVelocity;
  p.grounded = false;
  p.slideT = 0;
  p.queuedSlide = false;
  return true;
}

export function slide(p) {
  if (p.jet) return false;
  if (!p.grounded) {
    // In the air: drop fast, then slide on landing.
    p.vy = Math.min(p.vy, PHYS.fastFallVelocity);
    p.queuedSlide = true;
    return true;
  }
  p.slideT = PHYS.slideTime;
  return true;
}

export function setJet(p, on) {
  p.jet = on;
  if (on) {
    p.slideT = 0;
    p.queuedSlide = false;
    p.grounded = false;
  } else {
    p.vy = 0; // fall back down under gravity
  }
}

export const isSliding = (p) => p.slideT > 0;
export const playerHeight = (p) => (p.slideT > 0 ? PLAYER.slideHeight : PLAYER.height);

/** Advance the player by dt seconds while moving forward at `speed` m/s. */
export function updatePlayer(p, dt, speed) {
  p.dist += speed * dt;

  const tx = laneX(p.lane);
  p.x += (tx - p.x) * (1 - Math.exp(-PHYS.laneSharpness * dt));
  if (Math.abs(tx - p.x) < 0.001) p.x = tx;
  p.tilt *= Math.exp(-8 * dt);

  if (p.jet) {
    p.y += (JET.height - p.y) * (1 - Math.exp(-3.5 * dt));
    p.vy = 0;
  } else if (!p.grounded) {
    p.vy -= PHYS.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
      if (p.queuedSlide) {
        p.queuedSlide = false;
        p.slideT = PHYS.slideTime;
      }
    }
  }

  if (p.slideT > 0) p.slideT = Math.max(0, p.slideT - dt);
}

/** Write the player's collision box into `out` (reused, no allocation). */
export function playerBox(p, out) {
  const hw = PLAYER.width / 2;
  const hd = PLAYER.depth / 2;
  out.minX = p.x - hw;
  out.maxX = p.x + hw;
  out.minY = p.y;
  out.maxY = p.y + playerHeight(p);
  out.minZ = p.dist - hd;
  out.maxZ = p.dist + hd;
  return out;
}

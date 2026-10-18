// Shared game tuning. Pure data: no Three.js, no DOM, so it can be tested in Node.

export const LANE_COUNT = 3;
export const LANE_WIDTH = 2.4;
/** World X position of a lane (0 = left, 1 = centre, 2 = right). */
export const laneX = (lane) => (lane - 1) * LANE_WIDTH;

export const PLAYER = {
  width: 0.9,
  depth: 0.8,
  height: 1.8,
  slideHeight: 0.8,
};

export const PHYS = {
  gravity: 30,
  jumpVelocity: 10.5, // peak about 1.84 m, air time about 0.7 s
  fastFallVelocity: -22, // pressing slide in the air drops you fast
  slideTime: 0.75,
  laneSharpness: 16, // higher = snappier lane change
};

export const SPEED = {
  start: 14, // m/s
  max: 36,
  accel: 0.16, // m/s gained per second of running
};

/** Collision sizes. z = front edge, the obstacle runs from z to z + depth. */
export const OBSTACLE = {
  low: { w: 2.0, h: 0.9, d: 0.5, y: 0 }, // jump over
  high: { w: 2.0, h: 1.9, d: 0.5, y: 1.15 }, // slide under (bar from 1.15 m to 3.05 m)
  gap: { w: 1.4, h: 3.05, d: 3.2, y: -3 }, // hole in the road (top just above ground level), jump over
  train: { w: 2.1, h: 3.3, y: 0 }, // depth = length, change lane
  block: { w: 2.1, h: 2.4, y: 0 }, // depth = length, change lane
};

/** Obstacle types that fill a lane completely, so you must change lane. */
export const LANE_BLOCKERS = new Set(['train', 'block']);

export const POWER_TYPES = ['magnet', 'shield', 'double', 'jetpack'];
export const POWER_DURATION = {
  magnet: 10,
  shield: 20, // or until it absorbs one hit
  double: 10,
  jetpack: 6,
};

export const JET = { height: 6.5, landingGrace: 1.0 };
export const MAGNET_RANGE = 9;
export const COIN_RADIUS = 0.9;
export const POWER_RADIUS = 1.2;
export const HIT_GRACE = 1.2; // seconds of invulnerability after a shield breaks

export const SCORE = { perMeter: 1, perCoin: 10 };
export const MAX_HIGH_SCORES = 10;

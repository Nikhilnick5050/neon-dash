// Score = distance + coins. The 2x power-up doubles whatever you earn while it is active.
import { SCORE } from './constants.js';

export function createScore() {
  return { distance: 0, distPoints: 0, coins: 0, coinPoints: 0 };
}

export function resetScore(s) {
  s.distance = 0;
  s.distPoints = 0;
  s.coins = 0;
  s.coinPoints = 0;
}

export function addDistance(s, metres, mult = 1) {
  s.distance += metres;
  s.distPoints += metres * SCORE.perMeter * mult;
}

export function addCoin(s, mult = 1) {
  s.coins += 1;
  s.coinPoints += SCORE.perCoin * mult;
}

export const totalScore = (s) => Math.floor(s.distPoints + s.coinPoints);

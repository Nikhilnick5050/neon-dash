// In-game HUD: score, coins, speed, power-up timers, FPS and short messages.
// Only touches the DOM when a value actually changes.
import { POWER_TYPES, POWER_DURATION } from '../logic/constants.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.score = $('hud-score');
    this.coins = $('hud-coins');
    this.speed = $('hud-speed');
    this.mult = $('hud-mult');
    this.fps = $('hud-fps');
    this.toastEl = $('toast');
    this.flashEl = $('flash');
    this.powers = {};
    for (const type of POWER_TYPES) {
      const el = document.querySelector(`.power[data-power="${type}"]`);
      this.powers[type] = { el, fill: el.querySelector('.fill'), on: false, w: -1 };
    }
    this.last = { score: -1, coins: -1, speed: -1, mult: false };
    this.toastTimer = 0;
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
  }

  update(score, coins, speedMs, powers) {
    if (score !== this.last.score) this.score.textContent = (this.last.score = score).toLocaleString();
    if (coins !== this.last.coins) this.coins.textContent = this.last.coins = coins;
    const kmh = Math.round(speedMs * 3.6);
    if (kmh !== this.last.speed) this.speed.textContent = this.last.speed = kmh;
    const mult = powers.double > 0;
    if (mult !== this.last.mult) this.mult.classList.toggle('hidden', !(this.last.mult = mult));

    for (const type of POWER_TYPES) {
      const p = this.powers[type];
      const on = powers[type] > 0;
      if (on !== p.on) p.el.classList.toggle('hidden', !(p.on = on));
      if (on) {
        const w = Math.round((powers[type] / POWER_DURATION[type]) * 100) / 100;
        if (w !== p.w) p.fill.style.transform = `scaleX(${(p.w = w)})`;
      }
    }
  }

  setFps(visible, fps) {
    this.fps.classList.toggle('hidden', !visible);
    if (visible) this.fps.textContent = `${fps} FPS`;
  }

  toast(text, ms = 1200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  flash(kind = 'hit') {
    const f = this.flashEl;
    f.classList.toggle('shield', kind === 'shield');
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  }
}

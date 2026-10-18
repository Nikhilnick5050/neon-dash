// requestAnimationFrame loop with a fixed-step simulation and an FPS counter.
export const FIXED_STEP = 1 / 120; // physics runs at 120 Hz no matter the screen rate
const MAX_STEPS = 12; // never spiral after a long freeze

export class Loop {
  /**
   * @param {(dt:number)=>void} step   fixed-step update (game time)
   * @param {(dt:number, realDt:number)=>void} frame  once per frame (render, effects)
   */
  constructor(step, frame) {
    this.stepFn = step;
    this.frameFn = frame;
    this.timeScale = 1;
    this.acc = 0;
    this.last = 0;
    this.fps = 0;
    this._frames = 0;
    this._fpsTime = 0;
    this.running = false;
    this._tick = (now) => this.tick(now);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);
    const real = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    this._frames++;
    this._fpsTime += real;
    if (this._fpsTime >= 0.5) {
      this.fps = Math.round(this._frames / this._fpsTime);
      this._frames = 0;
      this._fpsTime = 0;
    }

    const dt = real * this.timeScale;
    this.acc += dt;
    let n = 0;
    while (this.acc >= FIXED_STEP && n < MAX_STEPS) {
      this.stepFn(FIXED_STEP);
      this.acc -= FIXED_STEP;
      n++;
    }
    if (n === MAX_STEPS) this.acc = 0;
    this.frameFn(dt, real);
  }
}

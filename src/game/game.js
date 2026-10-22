// Ties everything together: game states, the loop, camera, effects, audio, UI and saving.
import * as THREE from 'three';
import { Renderer } from '../render/renderer.js';
import { Sky } from '../world/sky.js';
import { City } from '../world/city.js';
import { Trains } from '../world/trains.js';
import { Robot } from '../world/robot.js';
import { ObstacleViews } from './obstacles.js';
import { PickupViews, POWER_COLORS } from './pickups.js';
import { Particles } from '../fx/particles.js';
import { AudioEngine } from '../audio/audio.js';
import { Hud } from '../ui/hud.js';
import { Menus } from '../ui/menus.js';
import { Input } from './input.js';
import { Loop } from './loop.js';
import { createRun, startRun, stepRun, actLeft, actRight, actJump, actSlide, runScore } from '../logic/run.js';
import { createPowers } from '../logic/powerups.js';
import { createPlayer } from '../logic/player.js';
import { difficulty } from '../logic/spawner.js';
import { recordRun } from '../logic/save.js';
import { persist, persistNow, flushPending } from '../save/storage.js';

const POWER_NAMES = { magnet: 'MAGNET', shield: 'SHIELD', double: '2X SCORE', jetpack: 'JETPACK' };
const GOLD = new THREE.Color(3, 2, 0.4);
const PINK = new THREE.Color(3, 0.4, 1.8);
const ORANGE = new THREE.Color(3, 1.2, 0.2);
const DYING_TIME = 1.5; // real seconds of slow motion before the game-over screen

const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export class Game {
  constructor(canvas, save, isDesktop) {
    this.save = save;
    this.isDesktop = isDesktop;
    this.r = new Renderer(canvas);
    const scene = this.r.scene;
    this.sky = new Sky(scene);
    this.city = new City(scene);
    this.trains = new Trains(scene);
    this.robot = new Robot(scene);
    this.obstacleViews = new ObstacleViews(scene);
    this.pickupViews = new PickupViews(scene);
    this.particles = new Particles(scene);
    this.audio = new AudioEngine();
    this.hud = new Hud();

    this.run = createRun({
      coin: (c) => this.onCoin(c),
      power: (t) => this.onPower(t),
      powerEnd: (t) => this.onPowerEnd(t),
      shieldBreak: () => this.onShieldBreak(),
      death: (o) => this.onDeath(o),
      obstacleRemoved: (o) => this.obstacleViews.release(o),
      powerRemoved: (pk) => this.pickupViews.release(pk),
    });

    // A stand-in player for the menu, where the robot runs through the city on its own.
    this.menuPlayer = createPlayer();
    this.noPowers = createPowers();
    this.menuDist = 0;

    this.state = 'menu';
    this.time = 0;
    this.shake = 0;
    this.dyingT = 0;
    this.jumpBuffer = 0;
    this.lastDist = 0;
    this.bestAtStart = 0;
    this.toastedBest = false;
    this.nextMilestone = 1000;
    this.fpsShown = -1;
    this.camPos = new THREE.Vector3(5, 3, 6);
    this.camLook = new THREE.Vector3(0, 1.2, -4);
    this._tPos = new THREE.Vector3();
    this._tLook = new THREE.Vector3();

    this.menus = new Menus(save, {
      play: () => this.startGame(),
      restart: () => this.startGame(),
      resume: () => this.resume(),
      pause: () => this.pause(),
      toMenu: () => this.toMenu(),
      quit: () => this.quit(),
      settingsChanged: () => this.applySettings(true),
      click: () => this.audio.click(),
    }, isDesktop);

    this.input = new Input(canvas, (a) => this.onAction(a));
    this.loop = new Loop((dt) => this.step(dt), (dt, real) => this.frame(dt, real));

    // Audio can only start after the first click or key press.
    const unlock = () => {
      this.audio.unlock();
      this.audio.setMode(this.state === 'playing' ? 'game' : this.state === 'paused' ? 'pause' : 'menu');
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, unlock, true);
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, true);

    // Pause automatically when the window loses focus or is minimised.
    window.addEventListener('blur', () => { if (this.state === 'playing') this.pause(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing') this.pause();
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    });
    window.addEventListener('beforeunload', () => flushPending());

    this.applySettings(false);
  }

  start() {
    this.menus.show('menu');
    this.loop.start();
  }

  applySettings(saveNow) {
    const s = this.save.settings;
    this.r.setQuality(s.quality);
    this.city.setQuality(s.quality);
    this.trains.setQuality(s.quality);
    this.audio.setVolumes(s.music, s.sfx);
    this.fpsShown = -1;
    if (saveNow) persist(this.save);
  }

  // ---------- states ----------

  startGame() {
    startRun(this.run);
    this.particles.clear();
    this.robot.reset();
    this.state = 'playing';
    this.loop.timeScale = 1;
    this.jumpBuffer = 0;
    this.shake = 0;
    this.bestAtStart = this.save.best;
    this.toastedBest = this.bestAtStart === 0;
    this.nextMilestone = 1000;
    this.lastDist = 0;
    this.menus.hideAll();
    this.hud.show(true);
    this.audio.setMode('game');
    this.hud.toast('GO!', 700);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.loop.timeScale = 0;
    this.audio.setMode('pause');
    this.menus.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.loop.timeScale = 1;
    this.menus.hideAll();
    this.audio.setMode('game');
    if (this.run.player.jet) this.audio.jet(true);
  }

  toMenu() {
    startRun(this.run); // clears the track (nothing is recorded for an abandoned run)
    this.particles.clear();
    this.robot.reset();
    this.state = 'menu';
    this.loop.timeScale = 1;
    this.hud.show(false);
    this.audio.setMode('menu');
    this.menus.show('menu');
  }

  gameOver() {
    this.state = 'over';
    this.loop.timeScale = 1;
    const score = runScore(this.run);
    const coins = this.run.score.coins;
    const { isBest } = recordRun(this.save, score, coins);
    persistNow(this.save);
    this.hud.show(false);
    this.menus.showGameOver(score, coins, this.save.best, isBest && score > 0);
    if (isBest && score > 0) this.audio.newBest();
  }

  async quit() {
    await persistNow(this.save);
    if (window.neonDash?.quit) window.neonDash.quit();
  }

  // ---------- input ----------

  onAction(a) {
    const run = this.run;
    if (this.state === 'playing') {
      if (a === 'left' && actLeft(run)) this.audio.lane();
      else if (a === 'right' && actRight(run)) this.audio.lane();
      else if (a === 'jump') {
        if (actJump(run)) this.audio.jump();
        else this.jumpBuffer = 0.15; // pressed just before landing: jump on landing
      } else if (a === 'slide' && actSlide(run)) this.audio.slide();
      else if (a === 'pause') this.pause();
      return;
    }
    if (this.state === 'dying') return;
    if (a === 'jump') this.menus.moveFocus(-1);
    else if (a === 'slide') this.menus.moveFocus(1);
    else if (a === 'pause') {
      if (this.state === 'paused' && this.menus.current === 'pause') this.resume();
      else this.menus.back();
    } else if (a === 'confirm') {
      if (this.state === 'menu' && this.menus.current === 'menu') this.startGame();
      else if (this.state === 'over') this.startGame();
    }
  }

  // ---------- run events ----------

  onCoin(c) {
    this.audio.coin();
    this.particles.emit(c.x, c.y, -(c.z - this.run.player.dist), 7, GOLD, 3.5, 0.45, 1.5);
  }

  onPower(type) {
    this.audio.power(type);
    this.hud.toast(POWER_NAMES[type]);
    const p = this.run.player;
    this.particles.emit(p.x, p.y + 1, 0, 30, POWER_COLORS[type], 6, 0.7, 1);
    if (type === 'jetpack') this.audio.jet(true);
  }

  onPowerEnd(type) {
    this.audio.powerEnd();
    if (type === 'jetpack') this.audio.jet(false);
  }

  onShieldBreak() {
    this.audio.shieldBreak();
    this.hud.flash('shield');
    this.shake = Math.max(this.shake, 0.45);
    const p = this.run.player;
    this.particles.emit(p.x, p.y + 1, -0.5, 40, POWER_COLORS.shield, 7, 0.8, 1);
  }

  onDeath(o) {
    this.state = 'dying';
    this.dyingT = 0;
    this.shake = o.type === 'gap' ? 0.35 : 1;
    this.hud.flash('hit');
    if (o.type === 'gap') this.audio.fall();
    else this.audio.crash();
    this.audio.setMode('over');
    const p = this.run.player;
    this.particles.emit(p.x, p.y + 1, -0.6, 70, PINK, 8, 1.0, 2);
    this.particles.emit(p.x, p.y + 1, -0.6, 40, new THREE.Color(0.3, 2.6, 3), 5, 1.2, 3);
  }

  // ---------- loop ----------

  step(dt) {
    if (this.state === 'playing' || this.state === 'dying') {
      if (this.jumpBuffer > 0) {
        this.jumpBuffer -= dt;
        if (actJump(this.run)) {
          this.jumpBuffer = 0;
          this.audio.jump();
        }
      }
      stepRun(this.run, dt);
    } else if (this.state === 'menu') {
      this.menuDist += 10 * dt;
    }
  }

  frame(dt, real) {
    this.time += real;
    const inRun = this.state !== 'menu';
    const run = this.run;
    const p = inRun ? run.player : this.menuPlayer;
    const powers = inRun ? run.powers : this.noPowers;
    const dist = inRun ? p.dist : this.menuDist;
    const speed = inRun ? run.speed : 10;
    const scroll = dist - this.lastDist;
    this.lastDist = dist;

    // Slow motion after a crash, then the game-over screen.
    if (this.state === 'dying') {
      this.dyingT += real;
      this.loop.timeScale = this.dyingT < 0.9 ? 0.2 : damp(this.loop.timeScale, 1, 4, real);
      if (this.dyingT > DYING_TIME) this.gameOver();
    }

    this.city.update(dist, dt, this.state === 'playing' ? speed : speed * 0.4, this.time);
    this.trains.update(dist, dt, speed, this.time);
    if (inRun) {
      this.obstacleViews.update(run, dt);
      this.pickupViews.update(run, this.time);
    }
    const mode = this.state === 'menu' ? 'menu' : this.state === 'dying' || this.state === 'over' ? 'dead' : 'run';
    if (this.state !== 'paused') {
      this.robot.update(p, powers, speed, dt, this.time, mode, run.deathT, run.fellInGap);
    }
    if (p.jet && this.state === 'playing') {
      this.particles.emit(p.x, p.y + 0.6, 0.5, 2, ORANGE, 1.2, 0.35, -5);
    }
    this.particles.update(dt, Math.max(0, scroll));

    this.updateCamera(p, speed, real);
    this.sky.update(this.time, this.r.camera);

    if (this.state === 'playing') {
      const score = runScore(run);
      this.hud.update(score, run.score.coins, run.speed, run.powers);
      this.audio.setIntensity(difficulty(run.speed));
      if (!this.toastedBest && score > this.bestAtStart) {
        this.toastedBest = true;
        this.hud.toast('NEW BEST!', 1500);
        this.audio.newBest();
      } else if (score >= this.nextMilestone) {
        this.hud.toast(`${this.nextMilestone.toLocaleString()}`, 900);
        this.nextMilestone += this.nextMilestone < 5000 ? 1000 : 5000;
      }
    }
    const showFps = this.save.settings.showFps;
    const fps = showFps ? this.loop.fps : 0;
    if (fps !== this.fpsShown) {
      this.fpsShown = fps;
      this.hud.setFps(showFps, fps);
    }

    this.r.render();
  }

  updateCamera(p, speed, real) {
    const cam = this.r.camera;
    if (this.state === 'menu') {
      const t = this.time * 0.18;
      this._tPos.set(Math.sin(t) * 4.5 + 1.5, 2.1 + Math.sin(t * 0.7) * 0.4, 4.8 + Math.cos(t) * 1.2);
      this._tLook.set(0, 1.3, -1.5);
    } else {
      const jet = p.jet ? 1 : 0;
      this._tPos.set(p.x * 0.55, 3.3 + p.y * 0.72 + jet * 0.8, 6.6 + jet * 1.2);
      this._tLook.set(p.x * 0.4, 1.2 + p.y * 0.85, -10);
    }
    const rate = this.state === 'menu' ? 2 : 7;
    this.camPos.x = damp(this.camPos.x, this._tPos.x, rate, real);
    this.camPos.y = damp(this.camPos.y, this._tPos.y, rate * 0.8, real);
    this.camPos.z = damp(this.camPos.z, this._tPos.z, rate * 0.6, real);
    this.camLook.lerp(this._tLook, 1 - Math.exp(-rate * real));

    cam.position.copy(this.camPos);
    if (this.shake > 0.001) {
      const s = this.shake * 0.35;
      cam.position.x += (Math.random() * 2 - 1) * s;
      cam.position.y += (Math.random() * 2 - 1) * s;
      this.shake *= Math.exp(-5 * real);
    }
    cam.lookAt(this.camLook);

    // Wider view as speed rises: feels faster.
    const fov = 60 + (this.state === 'menu' ? 0 : difficulty(speed) * 14);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = damp(cam.fov, fov, 2, real);
      cam.updateProjectionMatrix();
    }
  }
}

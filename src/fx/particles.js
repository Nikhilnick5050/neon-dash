// Pooled particle bursts (coin sparks, crash debris, jetpack exhaust, shield shards).
// One fixed buffer of particles is reused forever: no allocation while playing.
import * as THREE from 'three';
import { dotTexture } from '../render/textures.js';

export class Particles {
  constructor(scene, max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.next = 0;
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.32,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** Burst of `count` particles at (x, y, z) in world space. */
  emit(x, y, z, count, color, speed = 4, life = 0.6, up = 2) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const i3 = i * 3;
      this.pos[i3] = x;
      this.pos[i3 + 1] = y;
      this.pos[i3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - b * b);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.vel[i3] = Math.cos(a) * r * s;
      this.vel[i3 + 1] = b * s + up;
      this.vel[i3 + 2] = Math.sin(a) * r * s;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.base[i3] = color.r;
      this.base[i3 + 1] = color.g;
      this.base[i3 + 2] = color.b;
    }
  }

  /** `scroll` = how far the world moved toward the camera this frame. */
  update(dt, scroll) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      const i3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i3 + 1] = -999;
        this.col[i3] = this.col[i3 + 1] = this.col[i3 + 2] = 0;
        continue;
      }
      this.vel[i3 + 1] -= 9 * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt + scroll;
      const f = this.life[i] / this.maxLife[i];
      this.col[i3] = this.base[i3] * f;
      this.col[i3 + 1] = this.base[i3 + 1] * f;
      this.col[i3 + 2] = this.base[i3 + 2] * f;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -999;
    this.col.fill(0);
  }
}

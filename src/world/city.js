// The neon city: road, side grid, buildings with signs, street lights, arches,
// flying traffic and speed streaks. Everything is instanced and recycled as you run.
import * as THREE from 'three';
import { roadTexture, gridTexture, windowTexture, dotTexture } from '../render/textures.js';

const SPAN = 480; // metres of city before it repeats
const BACK = 40; // how far behind the camera things stay before wrapping to the front
const ROAD_LEN = 520;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Track position -> world z, wrapped so the city never ends. */
function wrapZ(trackZ, dist) {
  let rel = (trackZ - dist + BACK) % SPAN;
  if (rel < 0) rel += SPAN;
  return -(rel - BACK);
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

const NEON = [0x2ef2ff, 0xff3fb4, 0xffcf4a, 0x9b5bff, 0x3dff9a, 0xff5a36];

export class City {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._buildLights();
    this._buildRoad();
    this._buildBuildings();
    this._buildStreetLights();
    this._buildArches();
    this._buildTraffic();
    this._buildStreaks();
  }

  _buildLights() {
    this.group.add(new THREE.HemisphereLight(0x7a5cff, 0x1a0020, 1.1));
    const key = new THREE.DirectionalLight(0xff7ad9, 1.0);
    key.position.set(-4, 10, -12);
    this.group.add(key);
    const fill = new THREE.DirectionalLight(0x40e0ff, 0.7);
    fill.position.set(6, 6, 10);
    this.group.add(fill);
  }

  _buildRoad() {
    this.roadTex = roadTexture();
    this.roadTex.repeat.set(1, ROAD_LEN / 10);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, ROAD_LEN),
      new THREE.MeshStandardMaterial({
        map: this.roadTex,
        emissiveMap: this.roadTex,
        emissive: 0xffffff,
        emissiveIntensity: 1.3,
        roughness: 0.32,
        metalness: 0.55,
      }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -ROAD_LEN / 2 + 30;
    this.group.add(road);

    this.gridTex = gridTexture();
    this.gridTex.repeat.set(220 / 4, ROAD_LEN / 4);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, ROAD_LEN),
      new THREE.MeshBasicMaterial({ map: this.gridTex, color: 0xb070ff }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -ROAD_LEN / 2 + 30);
    this.group.add(ground);

    // Glowing guard rails along both edges.
    const railMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 1.5) });
    for (const x of [-4.25, 4.25]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, ROAD_LEN), railMat);
      rail.position.set(x, 0.55, -ROAD_LEN / 2 + 30);
      this.group.add(rail);
    }
  }

  _buildBuildings() {
    const count = 150;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ map: windowTexture(), color: 0xffffff });
    this.buildings = new THREE.InstancedMesh(geo, mat, count);
    this.buildings.frustumCulled = false;
    const signGeo = new THREE.BoxGeometry(1, 1, 1);
    this.signs = new THREE.InstancedMesh(signGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), count);
    this.signs.frustumCulled = false;

    this.bData = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const w = rand(5, 12);
      const d = rand(7, 16);
      const h = Math.random() < 0.2 ? rand(45, 80) : rand(10, 40);
      const x = side * (rand(7.5, 30) + w / 2);
      const z = Math.random() * SPAN;
      const sign = Math.random() < 0.7;
      const signColor = NEON[(Math.random() * NEON.length) | 0];
      this.bData.push({ x, z, w, d, h, side, sign, vertical: Math.random() < 0.6, signY: rand(0.25, 0.75), signLen: rand(3, 9) });
      _c.setHSL(rand(0.6, 0.9), 0.6, rand(0.45, 0.8));
      this.buildings.setColorAt(i, _c);
      _c.set(signColor).multiplyScalar(2.6);
      this.signs.setColorAt(i, _c);
    }
    // Shuffle so "low quality" (fewer buildings) still covers the whole street.
    this.bData.sort(() => Math.random() - 0.5);
    this.group.add(this.buildings, this.signs);
  }

  _buildStreetLights() {
    const perSide = 28;
    const n = perSide * 2;
    this.lightSpacing = SPAN / perSide;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1b1830, metalness: 0.8, roughness: 0.4 });
    const pole = new THREE.CylinderGeometry(0.08, 0.12, 7, 6);
    pole.translate(0, 3.5, 0);
    this.poles = new THREE.InstancedMesh(pole, poleMat, n);
    this.heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.12, 0.35), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    const pool = new THREE.PlaneGeometry(4.5, 7);
    pool.rotateX(-Math.PI / 2);
    this.pools = new THREE.InstancedMesh(pool, new THREE.MeshBasicMaterial({
      map: dotTexture(), color: 0xffffff, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }), n);
    for (const m of [this.poles, this.heads, this.pools]) m.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      const col = i % 4 < 2 ? new THREE.Color(3, 0.6, 2.2) : new THREE.Color(0.4, 2.4, 3);
      this.heads.setColorAt(i, col);
      this.pools.setColorAt(i, col.clone().multiplyScalar(0.45));
    }
    this.group.add(this.poles, this.heads, this.pools);
  }

  _buildArches() {
    const n = 4;
    this.arches = new THREE.InstancedMesh(
      new THREE.TorusGeometry(7.2, 0.16, 6, 48, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      n,
    );
    this.arches.frustumCulled = false;
    for (let i = 0; i < n; i++) this.arches.setColorAt(i, i % 2 ? new THREE.Color(0.3, 2.6, 3) : new THREE.Color(3, 0.4, 2));
    this.group.add(this.arches);
  }

  _buildTraffic() {
    const n = 40;
    this.cars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.35, 2.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    this.cars.frustumCulled = false;
    this.carData = [];
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.carData.push({ x: rand(-34, 34), y: rand(12, 34), z: Math.random() * SPAN, v: dir * rand(12, 40) });
      this.cars.setColorAt(i, dir > 0 ? new THREE.Color(3, 0.3, 0.6) : new THREE.Color(2.5, 2.5, 3));
    }
    this.group.add(this.cars);
  }

  _buildStreaks() {
    const n = 36;
    this.streaks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.03, 0.03, 4),
      new THREE.MeshBasicMaterial({ color: 0x9feaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      n,
    );
    this.streaks.frustumCulled = false;
    this.streakData = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      this.streakData.push({ x: side * rand(1.8, 7), y: rand(0.3, 5.5), z: Math.random() * 60 });
    }
    this.group.add(this.streaks);
  }

  setQuality(q) {
    const high = q !== 'low';
    this.buildings.count = this.signs.count = high ? this.bData.length : 80;
    this.cars.count = high ? this.carData.length : 16;
    this.streaks.visible = high;
    this.pools.visible = high;
  }

  /** Move the city to match the distance run. `speed` drives the speed streaks. */
  update(dist, dt, speed, time) {
    this.roadTex.offset.y = (dist / 10) % 1;
    this.gridTex.offset.y = (dist / 4) % 1;

    // Buildings and signs.
    for (let i = 0; i < this.buildings.count; i++) {
      const b = this.bData[i];
      const z = wrapZ(b.z, dist);
      _p.set(b.x, 0, z);
      _s.set(b.w, b.h, b.d);
      this.buildings.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
      if (b.sign) {
        const face = b.x - b.side * (b.w / 2 + 0.12);
        if (b.vertical) {
          _p.set(face, b.h * b.signY, z);
          _s.set(0.25, Math.min(b.signLen, b.h * 0.6), 0.9);
        } else {
          _p.set(face, b.h * b.signY, z);
          _s.set(0.25, 0.7, Math.min(b.signLen, b.d * 0.8));
        }
      } else {
        _p.set(0, -50, 0);
        _s.set(0.001, 0.001, 0.001);
      }
      this.signs.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.buildings.instanceMatrix.needsUpdate = true;
    this.signs.instanceMatrix.needsUpdate = true;

    // Street lights (alternating sides) and the light pools they throw on the road.
    const n = this.poles.count;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const z = wrapZ((i >> 1) * this.lightSpacing + (side > 0 ? this.lightSpacing / 2 : 0), dist);
      _s.set(1, 1, 1);
      _p.set(side * 4.7, 0, z);
      this.poles.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
      _p.set(side * 4.1, 7, z);
      this.heads.setMatrixAt(i, _m.compose(_p, _q, _s));
      _p.set(side * 2.4, 0.02, z);
      this.pools.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.poles.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.pools.instanceMatrix.needsUpdate = true;

    // Arches over the road.
    for (let i = 0; i < this.arches.count; i++) {
      const z = wrapZ(i * (SPAN / this.arches.count) + 60, dist);
      _p.set(0, 0, z);
      _s.set(1, 1, 1);
      this.arches.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
    }
    this.arches.instanceMatrix.needsUpdate = true;

    // Flying traffic.
    for (let i = 0; i < this.cars.count; i++) {
      const c = this.carData[i];
      c.z += c.v * dt;
      _p.set(c.x, c.y + Math.sin(time * 0.7 + i) * 0.4, wrapZ(c.z, dist));
      _s.set(1, 1, 1);
      this.cars.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
    }
    this.cars.instanceMatrix.needsUpdate = true;

    // Speed streaks: faster = more visible.
    if (this.streaks.visible) {
      this.streaks.material.opacity = Math.max(0, Math.min(0.55, (speed - 16) / 30));
      for (let i = 0; i < this.streakData.length; i++) {
        const s = this.streakData[i];
        s.z += speed * 1.5 * dt;
        if (s.z > 60) s.z -= 60;
        _p.set(s.x, s.y, s.z - 50);
        _s.set(1, 1, 0.6 + speed / 25);
        this.streaks.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
      }
      this.streaks.instanceMatrix.needsUpdate = true;
    }
  }
}


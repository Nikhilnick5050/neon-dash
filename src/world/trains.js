// Live moving subway trains on elevated rails beside the road. They travel in real
// time while the player runs, so the scene feels like a real subway. Everything is
// built from code and recycled/wrapped, like the city's flying traffic.
import * as THREE from 'three';

const SPAN = 480; // metres of track before it repeats
const BACK = 40; // how far behind the camera things stay before wrapping to the front
const RAIL_X = 6.4; // distance of each rail from the centre of the road
const RAIL_Y = 2.7; // height of the rails above the road
const RAIL_LEN = 520;

/** Track position -> world z, wrapped so the rails never end. */
function wrapZ(trackZ, dist) {
  let rel = (trackZ - dist + BACK) % SPAN;
  if (rel < 0) rel += SPAN;
  return -(rel - BACK);
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function makeMaterials() {
  return {
    body: new THREE.MeshStandardMaterial({ color: 0x232846, metalness: 0.75, roughness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x161a2e, metalness: 0.8, roughness: 0.35 }),
    window: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.6, 3) }),
    pink: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 2) }),
    cyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.6, 3) }),
    white: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }),
    rail: new THREE.MeshStandardMaterial({ color: 0x1b1830, metalness: 0.8, roughness: 0.4 }),
    railGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 3) }),
  };
}

/** One train car: dark body, glowing window band, roof line, headlights, under-glow. */
function makeCar(M) {
  const g = new THREE.Group();
  g.add(box(1.7, 1.1, 6, M.body, 0, 0.55, 0));
  for (const s of [-1, 1]) g.add(box(0.05, 0.4, 5.6, M.window, s * 0.86, 0.75, 0));
  g.add(box(0.4, 0.06, 6.1, M.pink, 0, 1.16, 0));
  g.add(box(1.5, 0.05, 6.1, M.cyan, 0, 0.06, 0));
  for (const s of [-0.5, 0.5]) g.add(box(0.3, 0.18, 0.06, M.white, s, 0.55, 3.05));
  return g;
}

/** A short two-car train. The front (headlights) faces +z. */
function makeTrain(M) {
  const g = new THREE.Group();
  const c1 = makeCar(M);
  c1.position.z = -3;
  const c2 = makeCar(M);
  c2.position.z = 3;
  g.add(c1, c2);
  return g;
}

export class Trains {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = makeMaterials();
    this._buildRails();
    this._buildTrains();
  }

  _buildRails() {
    // Two elevated rails, one on each side of the road, with support posts.
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, RAIL_LEN), this.mats.rail);
      rail.position.set(side * RAIL_X, RAIL_Y, -RAIL_LEN / 2 + 30);
      this.group.add(rail);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, RAIL_LEN), this.mats.railGlow);
      glow.position.set(side * RAIL_X, RAIL_Y + 0.02, -RAIL_LEN / 2 + 30);
      this.group.add(glow);
      // Support posts every 20 m.
      for (let z = 0; z <= RAIL_LEN; z += 20) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, RAIL_Y, 0.16), this.mats.rail);
        post.position.set(side * RAIL_X, RAIL_Y / 2, -RAIL_LEN / 2 + 30 + z);
        this.group.add(post);
      }
    }
  }

  _buildTrains() {
    // 8 trains: 4 per side, moving in both directions at different speeds.
    this.trains = [];
    this.trainData = [];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const dir = i % 4 < 2 ? 1 : -1; // half move forward, half toward the player
      const t = makeTrain(this.mats);
      t.position.set(side * RAIL_X, RAIL_Y, 0);
      this.group.add(t);
      this.trains.push(t);
      this.trainData.push({
        x: side * RAIL_X,
        z: Math.random() * SPAN,
        dir,
        v: dir * (14 + Math.random() * 22), // m/s in world space
      });
    }
  }

  setQuality(q) {
    const high = q !== 'low';
    const count = high ? this.trains.length : 4;
    for (let i = 0; i < this.trains.length; i++) this.trains[i].visible = i < count;
  }

  /** Move the trains along the rails to match the distance run. */
  update(dist, dt, speed, time) {
    for (let i = 0; i < this.trains.length; i++) {
      if (!this.trains[i].visible) continue;
      const t = this.trainData[i];
      t.z += t.v * dt;
      const z = wrapZ(t.z, dist);
      this.trains[i].position.set(t.x, RAIL_Y, z);
      // Face the direction of travel (headlights point forward).
      this.trains[i].rotation.y = t.dir > 0 ? 0 : Math.PI;
    }
  }
}
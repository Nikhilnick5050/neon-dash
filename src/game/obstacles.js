// Obstacle visuals. Every obstacle type has a pool of ready-made meshes; the run's
// obstacle data borrows one while it is on screen and gives it back afterwards.
import * as THREE from 'three';
import { laneX, OBSTACLE } from '../logic/constants.js';
import { obstacleDepth } from '../logic/collision.js';
import { stripeTexture } from '../render/textures.js';
import { Pool } from '../logic/pool.js';

const bright = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

function makeMaterials() {
  const metal = new THREE.MeshStandardMaterial({ color: 0x161a2e, metalness: 0.8, roughness: 0.35 });
  const orangeStripes = stripeTexture('#ff9a2e');
  const pinkStripes = stripeTexture('#ff3fb4');
  pinkStripes.repeat.set(2, 1);
  orangeStripes.repeat.set(2, 1);
  return {
    metal,
    trainBody: new THREE.MeshStandardMaterial({ color: 0x232846, metalness: 0.75, roughness: 0.3 }),
    low: new THREE.MeshStandardMaterial({ map: orangeStripes, emissiveMap: orangeStripes, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5 }),
    high: new THREE.MeshStandardMaterial({ map: pinkStripes, emissiveMap: pinkStripes, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5, side: THREE.DoubleSide }),
    crate: new THREE.MeshStandardMaterial({ map: orangeStripes, emissiveMap: orangeStripes, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.6 }),
    cyan: bright(0.3, 2.6, 3),
    pink: bright(3, 0.4, 2),
    orange: bright(3, 1.3, 0.2),
    white: bright(3, 3, 3),
    red: bright(3, 0.15, 0.2),
    hole: new THREE.MeshBasicMaterial({ color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
}

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
};

function boxMesh(mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(geo.box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

// Each factory builds one obstacle. The group origin is the front edge (nearest the
// player), centred on the lane; the obstacle extends toward -z.
const factories = {
  low(M) {
    const s = OBSTACLE.low;
    const g = new THREE.Group();
    g.add(boxMesh(M.low, s.w, s.h - 0.12, s.d, 0, (s.h - 0.12) / 2, -s.d / 2));
    g.add(boxMesh(M.orange, s.w + 0.08, 0.12, s.d + 0.08, 0, s.h - 0.06, -s.d / 2));
    return g;
  },
  high(M) {
    const s = OBSTACLE.high;
    const g = new THREE.Group();
    g.add(boxMesh(M.high, s.w, s.h, 0.25, 0, s.y + s.h / 2, -s.d / 2));
    g.add(boxMesh(M.pink, s.w + 0.1, 0.1, 0.32, 0, s.y + 0.05, -s.d / 2)); // glowing bottom edge: slide under here
    for (const x of [-1, 1]) g.add(boxMesh(M.metal, 0.14, s.y + s.h, 0.3, x * (s.w / 2 + 0.07), (s.y + s.h) / 2, -s.d / 2));
    return g;
  },
  gap(M) {
    const s = OBSTACLE.gap;
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.3, s.d), M.hole);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(0, 0.01, -s.d / 2);
    g.add(hole);
    g.add(boxMesh(M.red, 2.3, 0.05, 0.12, 0, 0.03, 0));
    g.add(boxMesh(M.red, 2.3, 0.05, 0.12, 0, 0.03, -s.d));
    for (const x of [-1, 1]) g.add(boxMesh(M.orange, 0.08, 0.05, s.d, x * 1.15, 0.03, -s.d / 2));
    return g;
  },
  train(M) {
    const s = OBSTACLE.train;
    const g = new THREE.Group();
    // Parts that stretch with the train's length go in `stretch` (scaled on z).
    const stretch = new THREE.Group();
    stretch.add(boxMesh(M.trainBody, s.w, s.h - 0.3, 1, 0, 0.3 + (s.h - 0.3) / 2, -0.5));
    for (const x of [-1, 1]) {
      stretch.add(boxMesh(M.cyan, 0.04, 0.35, 0.96, x * (s.w / 2 + 0.01), 2.25, -0.5)); // window band
      stretch.add(boxMesh(M.pink, 0.04, 0.06, 1, x * (s.w / 2 + 0.01), 0.55, -0.5));
    }
    stretch.add(boxMesh(M.pink, 0.5, 0.05, 1, 0, s.h + 0.01, -0.5)); // roof line
    stretch.add(boxMesh(M.cyan, s.w * 0.9, 0.04, 1, 0, 0.12, -0.5)); // under-glow
    g.add(stretch);
    g.userData.stretch = stretch;
    // Front face.
    g.add(boxMesh(M.metal, s.w + 0.04, s.h - 0.3, 0.12, 0, 0.3 + (s.h - 0.3) / 2, 0.03));
    g.add(boxMesh(M.cyan, s.w * 0.75, 0.5, 0.05, 0, 2.3, 0.1)); // windscreen
    for (const x of [-0.65, 0.65]) g.add(boxMesh(M.white, 0.35, 0.22, 0.05, x, 1.0, 0.1)); // headlights
    g.add(boxMesh(M.pink, s.w, 0.06, 0.05, 0, 0.62, 0.1));
    return g;
  },
  block(M) {
    const s = OBSTACLE.block;
    const g = new THREE.Group();
    const stretch = new THREE.Group();
    stretch.add(boxMesh(M.crate, s.w, s.h, 1, 0, s.h / 2, -0.5));
    g.add(stretch);
    g.userData.stretch = stretch;
    // Glowing frame on the front.
    g.add(boxMesh(M.orange, s.w + 0.06, 0.08, 0.08, 0, s.h, 0));
    g.add(boxMesh(M.orange, s.w + 0.06, 0.08, 0.08, 0, 0.04, 0));
    for (const x of [-1, 1]) g.add(boxMesh(M.orange, 0.08, s.h, 0.08, x * (s.w / 2), s.h / 2, 0));
    return g;
  },
};

export class ObstacleViews {
  constructor(scene) {
    this.scene = scene;
    this.mats = makeMaterials();
    this.pools = {};
    const prefill = { low: 10, high: 10, gap: 8, train: 10, block: 6 };
    for (const type of Object.keys(factories)) {
      this.pools[type] = new Pool(() => {
        const g = factories[type](this.mats);
        g.visible = false;
        g.userData.type = type;
        scene.add(g);
        return g;
      }, (g) => { g.visible = false; }, prefill[type]);
    }
  }

  /** Called by the run when an obstacle is recycled. */
  release(o) {
    if (o.view) this.pools[o.view.userData.type].release(o.view);
  }

  update(run, dt) {
    const dist = run.player.dist;
    for (let i = 0; i < run.obstacles.length; i++) {
      const o = run.obstacles[i];
      if (!o.view) {
        o.view = this.pools[o.type].acquire();
        o.view.visible = true;
        const stretch = o.view.userData.stretch;
        if (stretch) stretch.scale.z = obstacleDepth(o);
      }
      const ud = o.view.userData;
      // An obstacle the shield knocked away flies up and off.
      if (o.hit) ud.fly = (ud.fly || 0) + dt;
      else ud.fly = 0;
      o.view.position.set(laneX(o.lane), ud.fly * 9, -(o.z - dist) - ud.fly * 6);
      o.view.rotation.x = -ud.fly * 5;
    }
  }
}

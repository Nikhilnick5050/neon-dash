// Coin and power-up visuals. Coins are one instanced mesh (one draw call for all of
// them); power-ups use small pools of ready-made models.
import * as THREE from 'three';
import { Pool } from '../logic/pool.js';
import { labelTexture } from '../render/textures.js';

const MAX_COINS = 400;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();

export const POWER_COLORS = {
  magnet: new THREE.Color(3, 0.35, 0.5),
  shield: new THREE.Color(0.3, 2.6, 3),
  double: new THREE.Color(0.5, 3, 0.7),
  jetpack: new THREE.Color(3, 1.4, 0.2),
};

function powerModel(type) {
  const color = POWER_COLORS[type];
  const glow = new THREE.MeshBasicMaterial({ color });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc8d0ff, metalness: 0.9, roughness: 0.2 });
  const g = new THREE.Group();
  const icon = new THREE.Group();
  g.add(icon);
  if (type === 'magnet') {
    const u = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 8, 20, Math.PI), glow);
    u.rotation.z = Math.PI;
    icon.add(u);
    for (const x of [-0.32, 0.32]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), metal);
      tip.position.set(x, 0.06, 0);
      icon.add(tip);
    }
  } else if (type === 'shield') {
    icon.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), new THREE.MeshBasicMaterial({ color, wireframe: true })));
    icon.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), glow));
  } else if (type === 'double') {
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 6), glow);
    hex.rotation.x = Math.PI / 2;
    icon.add(hex);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ map: labelTexture('2x', '#000'), transparent: true, color: 0x0a2010 }),
    );
    label.position.z = 0.05;
    icon.add(label);
    const back = label.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.05;
    icon.add(back);
  } else {
    for (const x of [-0.13, 0.13]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 12), metal);
      tank.position.x = x;
      icon.add(tank);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 10), glow);
      flame.rotation.x = Math.PI;
      flame.position.set(x, -0.38, 0);
      icon.add(flame);
    }
  }
  // Glowing ring and a light beam so power-ups are easy to spot from far away.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 32), glow);
  g.add(ring);
  g.userData.ring = ring;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 9, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.25), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 3.5;
  g.add(beam);
  g.userData.icon = icon;
  return g;
}

export class PickupViews {
  constructor(scene) {
    const coinGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.08, 20);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffc93c, emissive: 0xffa000, emissiveIntensity: 1.6, metalness: 0.9, roughness: 0.25,
    });
    this.coins = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
    this.coins.frustumCulled = false;
    this.coins.count = 0;
    scene.add(this.coins);

    this.pools = {};
    for (const type of Object.keys(POWER_COLORS)) {
      this.pools[type] = new Pool(() => {
        const g = powerModel(type);
        g.visible = false;
        g.userData.type = type;
        scene.add(g);
        return g;
      }, (g) => { g.visible = false; }, 2);
    }
  }

  release(pk) {
    if (pk.view) this.pools[pk.view.userData.type].release(pk.view);
  }

  update(run, time) {
    const dist = run.player.dist;
    let n = 0;
    for (let i = 0; i < run.coins.length && n < MAX_COINS; i++) {
      const c = run.coins[i];
      const z = -(c.z - dist);
      if (z < -220 || z > 20) continue;
      _p.set(c.x, c.y + Math.sin(time * 3 + c.z * 0.4) * 0.08, z);
      _q.setFromEuler(_e.set(0, time * 3.5 + c.z * 0.25, 0));
      this.coins.setMatrixAt(n++, _m.compose(_p, _q, _s));
    }
    this.coins.count = n;
    this.coins.instanceMatrix.needsUpdate = true;

    for (const pk of run.pickups) {
      if (!pk.view) {
        pk.view = this.pools[pk.type].acquire();
        pk.view.visible = true;
      }
      pk.view.position.set(pk.x, pk.y + Math.sin(time * 2.5) * 0.15, -(pk.z - dist));
      pk.view.userData.icon.rotation.y = time * 2;
      pk.view.userData.ring.rotation.y = -time * 1.4;
    }
  }
}

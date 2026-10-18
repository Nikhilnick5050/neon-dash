// The player's glowing robot, built from simple shapes, with code-driven animation
// for running, jumping, sliding, lane tilts, the jetpack, the shield and crashing.
import * as THREE from 'three';
import { shadowTexture } from '../render/textures.js';

const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export class Robot {
  constructor(scene) {
    const body = new THREE.MeshStandardMaterial({ color: 0x1c2036, metalness: 0.85, roughness: 0.28 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x3a3f66, metalness: 0.7, roughness: 0.35 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 3 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xff3fb4, emissive: 0xff3fb4, emissiveIntensity: 3 });
    this.glowMat = glow;

    this.root = new THREE.Group(); // follows the player position
    this.pose = new THREE.Group(); // leans, tilts and slides
    this.root.add(this.pose);

    // Hips and torso.
    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    this.pose.add(this.hips);
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    this.torso.add(box(0.72, 0.72, 0.46, body, 0, 0.42, 0));
    this.torso.add(box(0.6, 0.22, 0.5, plate, 0, 0.62, 0));
    this.torso.add(box(0.08, 0.6, 0.04, glow, 0, 0.42, 0.25)); // glowing spine (seen from behind)
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), glow);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.45, -0.25);
    this.torso.add(core);
    this.torso.add(box(0.74, 0.06, 0.48, pink, 0, 0.1, 0)); // belt line

    // Head with visor and antenna.
    this.head = new THREE.Group();
    this.head.position.y = 0.98;
    this.torso.add(this.head);
    this.head.add(box(0.52, 0.42, 0.46, body, 0, 0.1, 0));
    this.head.add(box(0.44, 0.12, 0.05, glow, 0, 0.14, -0.24)); // visor
    this.head.add(box(0.05, 0.16, 0.16, pink, -0.28, 0.1, 0));
    this.head.add(box(0.05, 0.16, 0.16, pink, 0.28, 0.1, 0));
    this.head.add(box(0.03, 0.3, 0.03, plate, 0.14, 0.45, 0.05));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), pink);
    tip.position.set(0.14, 0.62, 0.05);
    this.head.add(tip);

    // Arms (pivot at the shoulder).
    const arm = (side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.47, 0.68, 0);
      g.add(box(0.18, 0.5, 0.2, plate, 0, -0.25, 0));
      g.add(box(0.2, 0.06, 0.22, glow, 0, -0.04, 0));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), glow);
      hand.position.y = -0.56;
      g.add(hand);
      this.torso.add(g);
      return g;
    };
    this.armL = arm(-1);
    this.armR = arm(1);

    // Legs (pivot at the hip).
    const leg = (side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.19, 0.02, 0);
      g.add(box(0.22, 0.78, 0.24, plate, 0, -0.4, 0));
      g.add(box(0.24, 0.06, 0.26, glow, 0, -0.3, 0));
      g.add(box(0.26, 0.12, 0.38, glow, 0, -0.86, -0.05)); // glowing boots
      this.hips.add(g);
      return g;
    };
    this.legL = leg(-1);
    this.legR = leg(1);

    // Jetpack with flames.
    this.jetpack = new THREE.Group();
    this.jetpack.position.set(0, 0.45, 0.32);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x593a1a, metalness: 0.8, roughness: 0.3, emissive: 0xff7a00, emissiveIntensity: 0.25 });
    this.flames = [];
    for (const s of [-1, 1]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 12), tankMat);
      tank.position.x = s * 0.15;
      this.jetpack.add(tank);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.7, 10),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      flame.rotation.x = Math.PI;
      flame.position.set(s * 0.15, -0.6, 0);
      this.jetpack.add(flame);
      this.flames.push(flame);
    }
    this.jetpack.visible = false;
    this.torso.add(this.jetpack);

    // Shield bubble.
    this.shield = new THREE.Group();
    this.shield.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x2ef2ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
    ));
    this.shield.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.3, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2, 2.5), wireframe: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    ));
    this.shield.position.y = 1;
    this.shield.visible = false;
    this.root.add(this.shield);

    // Magnet ring.
    this.magnetRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.04, 6, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.magnetRing.rotation.x = Math.PI / 2;
    this.magnetRing.visible = false;
    this.root.add(this.magnetRing);

    // Blob shadow (stays on the road).
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);

    // Small light that makes the road glow under the robot.
    this.light = new THREE.PointLight(0x2ef2ff, 6, 7, 1.6);
    this.light.position.set(0, 1.2, 0.6);
    this.root.add(this.light);

    scene.add(this.root);
    this.phase = 0;
    this.deathSpin = 0;
    this.reset();
  }

  reset() {
    this.phase = 0;
    this.pose.rotation.set(0, 0, 0);
    this.pose.position.set(0, 0, 0);
    this.hips.position.y = 0.95;
    this.root.rotation.set(0, 0, 0);
    this.root.visible = true;
  }

  /**
   * @param {object} p player state, @param {object} pw power timers
   * @param {number} speed m/s, @param {string} mode 'run' | 'menu' | 'dead'
   */
  update(p, pw, speed, dt, time, mode, deathT = 0, fellInGap = false) {
    this.root.position.set(p.x, p.y, 0);

    const grounded = p.grounded && !p.jet;
    const sliding = p.slideT > 0;
    this.phase += dt * (mode === 'menu' ? 9 : 5 + speed * 0.42);
    const s = Math.sin(this.phase);

    let legL = 0, legR = 0, armL = 0, armR = 0, lean = -0.18, hipsY = 0.95 + Math.abs(Math.cos(this.phase)) * 0.07, poseX = 0;
    if (mode === 'dead') {
      // Crash: fall forward and spin a little. Gap: tumble down.
      const k = Math.min(1, deathT * 3);
      poseX = fellInGap ? deathT * 4 : -1.35 * k;
      lean = 0;
      legL = 0.6 * k; legR = -0.4 * k; armL = -2.2 * k; armR = -1.8 * k;
      hipsY = fellInGap ? 0.95 : 0.95 - 0.55 * k;
      this.root.position.z = fellInGap ? 0 : 0.8 * k;
    } else if (p.jet) {
      legL = 0.35 + s * 0.08; legR = 0.25 - s * 0.08; armL = 0.5; armR = 0.5; lean = -0.45;
    } else if (sliding) {
      // Lean back with feet first: the whole body tips toward the camera.
      poseX = 1.15; legL = 0.25; legR = -0.1; armL = -2.6; armR = -2.4; hipsY = 0.62; lean = -0.2;
    } else if (!grounded) {
      legL = -0.9; legR = 0.6; armL = 1.9; armR = -0.6; lean = -0.3;
    } else {
      legL = s * 0.95; legR = -s * 0.95; armL = -s * 0.85; armR = s * 0.85;
    }

    const r = 18;
    this.legL.rotation.x = damp(this.legL.rotation.x, legL, r, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, legR, r, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, armL, r, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, armR, r, dt);
    this.torso.rotation.x = damp(this.torso.rotation.x, lean, 10, dt);
    this.hips.position.y = damp(this.hips.position.y, hipsY, 16, dt);
    this.pose.rotation.x = mode === 'dead' && fellInGap ? poseX : damp(this.pose.rotation.x, poseX, 14, dt);
    this.pose.rotation.z = damp(this.pose.rotation.z, -p.tilt * 0.35, 12, dt);
    this.pose.rotation.y = damp(this.pose.rotation.y, mode === 'menu' ? Math.sin(time * 0.6) * 0.15 : -p.tilt * 0.25, 8, dt);
    this.head.rotation.y = mode === 'menu' ? Math.sin(time * 0.9) * 0.3 : 0;

    // Effects.
    this.jetpack.visible = p.jet || pw.jetpack > 0;
    if (this.jetpack.visible) {
      for (const f of this.flames) f.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }
    const shieldOn = pw.shield > 0;
    this.shield.visible = shieldOn && (pw.shield > 2 || Math.sin(time * 20) > 0);
    if (shieldOn) {
      this.shield.rotation.y = time * 0.8;
      this.shield.scale.setScalar(1 + Math.sin(time * 4) * 0.03);
    }
    this.magnetRing.visible = pw.magnet > 0 && (pw.magnet > 2 || Math.sin(time * 20) > 0);
    if (this.magnetRing.visible) {
      this.magnetRing.position.y = 0.2 + (Math.sin(time * 5) * 0.5 + 0.5) * 1.6;
      this.magnetRing.scale.setScalar(1 + Math.sin(time * 5) * 0.15);
    }
    this.glowMat.emissiveIntensity = pw.double > 0 ? 3 + Math.sin(time * 10) * 1.2 : 3;

    // Shadow shrinks and fades as the robot rises.
    const h = Math.max(0, p.y);
    const sh = 1 / (1 + h * 0.5);
    this.shadow.position.set(p.x, 0.03, this.root.position.z);
    this.shadow.scale.setScalar(sh);
    this.shadow.visible = !fellInGap;
    this.shadow.material.opacity = sh;
  }
}

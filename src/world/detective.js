import * as THREE from 'three';
import { Builder, rbox, cyl, cone, sphere, torus } from '../core/geo.js';
import { SkeletalBody } from './detectiveRig.js';

const part = (fn, name) => {
  const b = new Builder();
  fn(b);
  const m = b.build({ name });
  return m;
};

const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
function angleDamp(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/**
 * The detective: long coat, fedora, red scarf and a lit lantern.
 * Rigged with simple pivots so the idle and walk cycles read at miniature scale.
 */
export class Detective {
  constructor(gltf = null) {
    if (gltf) {
      this._skeletal(gltf);
      return;
    }
    this.root = new THREE.Group();
    this.root.name = 'detective';
    this.root.scale.setScalar(1.3);
    this.body = new THREE.Group();
    this.root.add(this.body);

    // legs (pivot at hip)
    this.legs = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.085, 0.56, 0);
      pivot.add(
        part((b) => {
          b.add(cyl(0.072, 0.062, 0.5, 8), 'trousers', [0, -0.25, 0]);
          b.add(rbox(0.12, 0.08, 0.22, 0.035), 'hat', [0, -0.52, 0.04]);
        }, 'leg')
      );
      this.body.add(pivot);
      return pivot;
    });

    // torso / coat
    this.torso = new THREE.Group();
    this.torso.position.y = 0.56;
    this.body.add(this.torso);
    this.torso.add(
      part((b) => {
        // coat skirt, flared, split at the back
        b.add(cyl(0.2, 0.28, 0.6, 12, false), 'coat', [0, -0.08, 0]);
        b.add(cyl(0.205, 0.2, 0.42, 12), 'coat', [0, 0.42, 0]);
        b.add(cyl(0.21, 0.21, 0.06, 12), 'coatDark', [0, 0.2, 0]); // belt
        b.add(rbox(0.07, 0.05, 0.02, 0.01), 'brass', [0.0, 0.2, 0.205]);
        // lapels
        b.add(rbox(0.08, 0.26, 0.04, 0.02), 'coatDark', [-0.07, 0.48, 0.18], [0.12, 0, 0.32]);
        b.add(rbox(0.08, 0.26, 0.04, 0.02), 'coatDark', [0.07, 0.48, 0.18], [0.12, 0, -0.32]);
        // buttons
        for (let i = 0; i < 3; i++) b.add(sphere(0.016, 5, 3), 'coatDark', [0.06, 0.05 - i * 0.12, 0.25 - i * 0.012]);
        // shoulders + cape
        b.add(sphere(0.1, 8, 5), 'coat', [-0.19, 0.6, 0], [0, 0, 0], [1, 0.8, 1]);
        b.add(sphere(0.1, 8, 5), 'coat', [0.19, 0.6, 0], [0, 0, 0], [1, 0.8, 1]);
        b.add(cyl(0.2, 0.27, 0.22, 12, false), 'coatDark', [0, 0.52, -0.01]);
        // collar up + scarf
        b.add(cyl(0.11, 0.15, 0.12, 10, true), 'coat', [0, 0.69, 0]);
        b.add(torus(0.1, 0.045, 6, 12), 'scarf', [0, 0.66, 0.01], [Math.PI / 2, 0, 0]);
        b.add(rbox(0.07, 0.3, 0.035, 0.015), 'scarf', [0.07, 0.48, 0.2], [0.2, 0, 0.12]);
        b.add(rbox(0.07, 0.04, 0.04, 0.012), 'clothRed', [0.08, 0.33, 0.215], [0.2, 0, 0.12]);
      }, 'coat')
    );

    // head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.74, 0);
    this.torso.add(this.head);
    this.head.add(
      part((b) => {
        b.add(cyl(0.05, 0.055, 0.08, 6), 'skin', [0, 0.02, 0]);
        b.add(sphere(0.115, 10, 8), 'skin', [0, 0.14, 0.0], [0, 0, 0], [1, 1.05, 1]);
        b.add(cone(0.025, 0.06, 5), 'skin', [0, 0.13, 0.12], [Math.PI / 2, 0, 0]);
        b.add(sphere(0.013, 4, 3), 'void', [-0.04, 0.165, 0.1]);
        b.add(sphere(0.013, 4, 3), 'void', [0.04, 0.165, 0.1]);
        b.add(rbox(0.12, 0.03, 0.03, 0.01), 'hat', [0, 0.08, 0.1]); // moustache
        // fedora
        b.add(cyl(0.22, 0.22, 0.02, 16), 'hat', [0, 0.235, 0.0], [0.06, 0, 0]);
        b.add(cyl(0.12, 0.135, 0.15, 12), 'hat', [0, 0.31, -0.005], [0.06, 0, 0]);
        b.add(cyl(0.137, 0.137, 0.035, 12), 'coatDark', [0, 0.265, -0.005], [0.06, 0, 0]);
        b.add(rbox(0.12, 0.03, 0.2, 0.012), 'hat', [0, 0.385, 0], [0.06, 0, 0]);
      }, 'head')
    );

    // arms (pivot at shoulder)
    this.arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.23, 0.6, 0);
      this.torso.add(pivot);
      pivot.add(
        part((b) => {
          b.add(cyl(0.06, 0.055, 0.42, 8), 'coat', [0, -0.21, 0]);
          b.add(cyl(0.062, 0.062, 0.05, 8), 'coatDark', [0, -0.4, 0]);
          b.add(sphere(0.05, 7, 5), 'glove', [0, -0.46, 0]);
        }, 'arm')
      );
      return pivot;
    });

    // lantern in the right hand
    this.lanternPivot = new THREE.Group();
    this.lanternPivot.position.set(0, -0.48, 0.02);
    this.arms[1].add(this.lanternPivot);
    this.lanternPivot.add(
      part((b) => {
        b.add(torus(0.05, 0.008, 4, 10, Math.PI), 'iron', [0, -0.03, 0], [0, 0, Math.PI]);
        b.add(cone(0.07, 0.06, 6), 'iron', [0, -0.08, 0]);
        b.add(cyl(0.05, 0.05, 0.12, 6), 'lantern', [0, -0.17, 0]);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + 0.4;
          b.add(rbox(0.012, 0.13, 0.012, 0.004), 'iron', [Math.cos(a) * 0.052, -0.17, Math.sin(a) * 0.052]);
        }
        b.add(cyl(0.065, 0.06, 0.03, 6), 'iron', [0, -0.245, 0]);
      }, 'lantern')
    );
    this.light = new THREE.PointLight('#ffb35a', 9, 8, 1.5);
    this.light.position.set(0, -0.17, 0);
    this.lanternPivot.add(this.light);

    // soft contact shadow so the figure sits on the ground
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false, map: blobTexture() })
    );
    blob.position.y = 0.09;
    blob.renderOrder = 3;
    this.root.add(blob);

    this.root.traverse((o) => {
      if (o.isMesh && o !== blob) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this._common();
  }

  _common() {
    this.speed = 2.1;
    this.target = null;
    this.path = [];
    this.heading = 0;
    this.walk = 0; // 0..1 blend
    this.phase = 0;
    this.lookTarget = null;
    this.onArrive = null;
    this.t = Math.random() * 10;
    this.stepCb = null;
    this.lastStep = 0;
  }

  /** Realistic rigged body from the Universal Base Characters pack. */
  _skeletal(gltf) {
    this.root = new THREE.Group();
    this.root.name = 'detective';
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.skel = new SkeletalBody(gltf);
    this.body.add(this.skel.model);

    // lantern hangs from the right hand under gravity (kept outside the rig)
    this.lantern = new THREE.Group();
    const lb = new Builder();
    lb.add(torus(0.035, 0.006, 4, 10, Math.PI), 'iron', [0, 0.03, 0], [0, 0, 0]);
    lb.add(cone(0.05, 0.045, 6), 'iron', [0, -0.015, 0]);
    lb.add(cyl(0.036, 0.036, 0.09, 6), 'lantern', [0, -0.08, 0]);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      lb.add(rbox(0.008, 0.095, 0.008, 0.003), 'iron', [Math.cos(a) * 0.037, -0.08, Math.sin(a) * 0.037]);
    }
    lb.add(cyl(0.046, 0.042, 0.022, 6), 'iron', [0, -0.135, 0]);
    const lm = lb.build({ name: 'lantern' });
    this.lantern.add(lm);
    this.light = new THREE.PointLight('#ffb35a', 6, 8, 1.7);
    this.light.position.set(0, -0.08, 0.05);
    this.lantern.add(this.light);
    this.lightBase = 6;
    this.lanternVel = new THREE.Vector2();
    this.lanternSwing = new THREE.Vector2();
    this.lanternPrev = new THREE.Vector3();

    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.34, depthWrite: false, map: blobTexture() })
    );
    blob.position.y = 0.09;
    blob.renderOrder = 3;
    this.root.add(blob);

    // cheap picking proxy, so hover tests don't raycast a skinned mesh every frame
    this.pickProxy = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.35, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.pickProxy.position.y = 0.68;
    this.pickProxy.name = 'detective-proxy';
    this._common();
    this.lookYaw = 0;
  }

  /** Called by the scene once the root is added, so the lantern can live in world space. */
  attachTo(scene) {
    scene.add(this.root);
    if (this.lantern) scene.add(this.lantern);
    if (this.pickProxy) scene.add(this.pickProxy);
  }

  setPosition(x, z, heading = 0) {
    this.root.position.set(x, 0.06, z);
    this.heading = heading;
    this.root.rotation.y = heading;
  }

  walkTo(x, z, onArrive = null, faceAfter = null) {
    this.follow([new THREE.Vector2(x, z)], onArrive, faceAfter);
  }

  /** Walk a list of waypoints (THREE.Vector2), then call onArrive. */
  follow(points, onArrive = null, faceAfter = null) {
    this.path = points.slice();
    this.target = this.path.shift() || null;
    this.onArrive = onArrive;
    this.faceAfter = faceAfter;
    if (!this.target) this._arrive();
  }

  _arrive() {
    this.target = null;
    this.path = [];
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
  }

  /** @param collide (x,z) => boolean */
  update(dt, collide) {
    this.t += dt;
    const pos = this.root.position;
    let moving = false;
    const run = this.running ? 1.75 : 1;

    if (this.steer && this.steer.lengthSq() > 0.01) {
      // direct keyboard control overrides any click path
      this.target = null;
      this.path = [];
      this.onArrive = null;
      this.faceAfter = null;
      moving = true;
      const want = Math.atan2(this.steer.x, this.steer.y);
      this.heading = angleDamp(this.heading, want, 12, dt);
      const sp = this.speed * run * dt * (0.4 + this.walk * 0.6);
      const nx = pos.x + this.steer.x * sp, nz = pos.z + this.steer.y * sp;
      if (!collide(nx, nz)) pos.set(nx, pos.y, nz);
      else if (!collide(nx, pos.z)) pos.x = nx;
      else if (!collide(pos.x, nz)) pos.z = nz;
    } else if (this.target) {
      const dx = this.target.x - pos.x, dz = this.target.y - pos.z;
      const dist = Math.hypot(dx, dz);
      const last = !this.path || this.path.length === 0;
      if (dist < (last ? 0.06 : 0.25)) {
        if (last) this._arrive();
        else this.target = this.path.shift();
      } else {
        moving = true;
        const want = Math.atan2(dx, dz);
        this.heading = angleDamp(this.heading, want, 10, dt);
        const sp = Math.min(this.speed * run * dt * (0.4 + this.walk * 0.6), dist);
        const nx = pos.x + (dx / dist) * sp, nz = pos.z + (dz / dist) * sp;
        if (!collide(nx, nz)) pos.set(nx, pos.y, nz);
        else if (!collide(nx, pos.z)) pos.x = nx;
        else if (!collide(pos.x, nz)) pos.z = nz;
        else this._arrive(); // blocked: stop here rather than strand the player
      }
    } else if (this.faceAfter != null) {
      this.heading = angleDamp(this.heading, this.faceAfter, 6, dt);
      if (Math.abs(this.heading - this.faceAfter) < 0.01) this.faceAfter = null;
    }

    this.walk = damp(this.walk, moving ? 1 : 0, 8, dt);
    this.root.rotation.y = this.heading;

    const w = this.walk;
    this.phase += dt * (2 + 7.5 * w * (moving ? run : 1));
    const sw = Math.sin(this.phase);

    if (this.skel) {
      this._poseSkeletal(dt, w);
      this._flickerAndSteps(w, pos);
      return;
    }

    // walk cycle
    this.legs[0].rotation.x = sw * 0.6 * w;
    this.legs[1].rotation.x = -sw * 0.6 * w;
    this.arms[0].rotation.x = -sw * 0.45 * w;
    this.arms[1].rotation.x = sw * 0.18 * w - 0.12;
    this.arms[0].rotation.z = -0.06;
    this.arms[1].rotation.z = 0.08;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.035 * w;
    this.torso.rotation.y = sw * 0.08 * w;

    // idle: breathe, look around, adjust hat now and then
    const idle = 1 - w;
    const breathe = Math.sin(this.t * 1.6) * 0.012 * idle;
    this.torso.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
    const look = Math.sin(this.t * 0.37) * 0.55 + Math.sin(this.t * 0.11) * 0.3;
    this.head.rotation.y = damp(this.head.rotation.y, look * idle, 3, dt);
    this.head.rotation.x = damp(this.head.rotation.x, (Math.sin(this.t * 0.23) * 0.08 - 0.04) * idle, 3, dt);
    // lantern sway lags behind the arm
    this.lanternPivot.rotation.x = -this.arms[1].rotation.x * 0.8 + Math.sin(this.t * 2.1) * 0.05;
    this.lanternPivot.rotation.z = Math.sin(this.t * 1.3) * 0.06;

    this._flickerAndSteps(w, pos);
  }

  _poseSkeletal(dt, w) {
    const idle = 1 - w;
    const look = (Math.sin(this.t * 0.37) * 0.55 + Math.sin(this.t * 0.11) * 0.3) * idle;
    this.lookYaw = damp(this.lookYaw, look, 3, dt);
    const pitch = (Math.sin(this.t * 0.23) * 0.08 - 0.04) * idle;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.025 * w;
    this.skel.pose(this.root, this.phase, w, this.t, this.lookYaw, pitch);
    // lantern: follow the hand, swing like a pendulum against the motion
    const hand = this.skel.handWorld(new THREE.Vector3());
    const vel = hand.clone().sub(this.lanternPrev).divideScalar(Math.max(dt, 1e-3));
    this.lanternPrev.copy(hand);
    const acc = new THREE.Vector2(-vel.x, -vel.z).multiplyScalar(0.02);
    this.lanternVel.addScaledVector(this.lanternSwing, -40 * dt).add(acc.multiplyScalar(dt * 30)).multiplyScalar(Math.exp(-3 * dt));
    this.lanternSwing.addScaledVector(this.lanternVel, dt).clampLength(0, 0.5);
    this.lantern.position.copy(hand).add(new THREE.Vector3(0, -0.035, 0));
    this.lantern.rotation.set(this.lanternSwing.y + Math.sin(this.t * 2.1) * 0.04, this.heading, -this.lanternSwing.x + Math.sin(this.t * 1.3) * 0.05, 'YXZ');
    if (this.pickProxy) this.pickProxy.position.set(this.root.position.x, 0.68, this.root.position.z);
  }

  _flickerAndSteps(w, pos) {
    // flame flicker
    this.light.intensity = (this.lightBase ?? 8.6) + Math.sin(this.t * 17) * 0.35 + Math.sin(this.t * 7.3) * 0.4 + (Math.random() - 0.5) * 0.25;

    // footstep callback at each foot plant
    if (w > 0.5) {
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.lastStep) {
        this.lastStep = step;
        this.stepCb?.(pos);
      }
    }
  }
}

let _blob;
function blobTexture() {
  if (_blob) return _blob;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _blob = new THREE.CanvasTexture(c);
  return _blob;
}
export { blobTexture };

/** A raven that turns its head and occasionally hops. */
export class Raven {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'raven';
    const body = new Builder();
    body.add(sphere(0.13, 8, 6), 'raven', [0, 0.14, 0], [0, 0, 0], [0.85, 0.8, 1.3]);
    body.add(rbox(0.12, 0.03, 0.22, 0.01), 'raven', [0, 0.12, -0.2], [0.35, 0, 0]);
    body.add(rbox(0.05, 0.16, 0.18, 0.02), 'raven', [-0.1, 0.16, -0.02], [0.2, 0, 0.15]);
    body.add(rbox(0.05, 0.16, 0.18, 0.02), 'raven', [0.1, 0.16, -0.02], [0.2, 0, -0.15]);
    body.add(cyl(0.012, 0.012, 0.08, 4), 'beak', [-0.04, 0.03, 0.02]);
    body.add(cyl(0.012, 0.012, 0.08, 4), 'beak', [0.04, 0.03, 0.02]);
    this.root.add(body.build({ name: 'raven-body' }));
    this.head = new THREE.Group();
    this.head.position.set(0, 0.27, 0.12);
    const hb = new Builder();
    hb.add(sphere(0.075, 8, 6), 'raven', [0, 0, 0]);
    hb.add(cone(0.03, 0.12, 5), 'beak', [0, -0.01, 0.1], [Math.PI / 2, 0, 0]);
    hb.add(sphere(0.012, 4, 3), 'brass', [-0.045, 0.02, 0.04]);
    hb.add(sphere(0.012, 4, 3), 'brass', [0.045, 0.02, 0.04]);
    this.head.add(hb.build({ name: 'raven-head' }));
    this.root.add(this.head);
    this.root.traverse((o) => o.isMesh && (o.castShadow = true));
    this.next = 1;
    this.yaw = 0;
    this.t = 0;
    this.baseY = 0;
    this.hop = 0;
  }

  update(dt) {
    this.t += dt;
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 0.8 + Math.random() * 2.6;
      this.yaw = (Math.random() - 0.5) * 2.2;
      if (Math.random() < 0.18) this.hop = 1;
    }
    this.head.rotation.y = damp(this.head.rotation.y, this.yaw, 14, dt);
    this.head.rotation.x = Math.sin(this.t * 0.7) * 0.1;
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt * 3.2);
      this.root.position.y = this.baseY + Math.sin(this.hop * Math.PI) * 0.12;
      this.root.rotation.y += dt * 2.5;
    }
  }
}

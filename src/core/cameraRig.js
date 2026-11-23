import * as THREE from 'three';

const deg = THREE.MathUtils.degToRad;
const damp = (a, b, l, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-l * dt));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function angleLerp(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/**
 * Perspective orbit camera for an open world.
 *  - pose = { yaw, pitch, dist, target, offset }; `zoom` is kept as an alias (dist = BASE / zoom)
 *  - scripted moves (moveTo), cursor parallax, drag to orbit, wheel / pinch to dolly
 *  - `orbitFree` lets the player spin all the way round while exploring
 */
export class CameraRig {
  constructor(dom) {
    this.dom = dom;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.3, 900);
    this.BASE = 46;
    this.target = new THREE.Vector3(0, 1.5, 0);
    this.goalTarget = this.target.clone();
    this.yaw = deg(42);
    this.pitch = deg(24);
    this.zoom = 1;
    this.goal = { yaw: deg(42), pitch: deg(24), zoom: 1 };
    this.userYaw = 0;
    this.userPitch = 0;
    this.userZoom = 1;
    this.parallax = new THREE.Vector2();
    this.pointer = new THREE.Vector2();
    this.offset = new THREE.Vector2(0, 0);
    this.goalOffset = new THREE.Vector2(0, 0);
    this.script = null;
    this.interactive = false;
    this.orbitFree = false;
    this.dragging = false;
    this.dragMoved = 0;
    this.minPitch = deg(6);
    this.maxPitch = deg(62);
    this.zoomRange = [0.5, 2.6];
    this._bind();
  }

  _bind() {
    const el = this.dom;
    let lastX = 0, lastY = 0;
    const pinch = { d: 0 };
    el.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (this.dragging && this.interactive) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        this.dragMoved += Math.abs(dx) + Math.abs(dy);
        const yaw = this.userYaw - dx * 0.0065;
        this.userYaw = this.orbitFree ? yaw : THREE.MathUtils.clamp(yaw, deg(-40), deg(40));
        this.userPitch = THREE.MathUtils.clamp(this.userPitch + dy * 0.004, deg(-16), deg(26));
      }
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.dragMoved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    addEventListener('pointerup', () => (this.dragging = false));
    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.interactive) return;
        e.preventDefault();
        this.userZoom = THREE.MathUtils.clamp(this.userZoom * Math.exp(-e.deltaY * 0.0012), ...this.zoomRange);
      },
      { passive: false }
    );
    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.interactive) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch.d) this.userZoom = THREE.MathUtils.clamp(this.userZoom * (d / pinch.d), ...this.zoomRange);
        pinch.d = d;
      }
    }, { passive: true });
    el.addEventListener('touchend', () => (pinch.d = 0));
  }

  resize(w, h) {
    this.aspect = w / h;
    this.w = w;
    this.h = h;
    this.camera.aspect = this.aspect;
    // portrait screens need a wider lens to keep the village in frame
    this.camera.fov = this.aspect < 1 ? 50 : this.aspect < 1.4 ? 42 : 38;
    this._project();
  }

  get dist() {
    return this.BASE / (this.zoom || 1);
  }

  _project() {
    const cam = this.camera;
    if (this.w && (this.offset.x || this.offset.y)) {
      cam.setViewOffset(this.w, this.h, (-this.offset.x * this.w) / 2, (this.offset.y * this.h) / 2, this.w, this.h);
    } else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }

  /** Scripted move to a pose over `dur` seconds. */
  moveTo({ yaw, pitch, zoom, target, offset }, dur = 2, onDone) {
    const from = { yaw: this.goal.yaw, pitch: this.goal.pitch, zoom: this.goal.zoom, target: this.goalTarget.clone(), offset: this.goalOffset.clone() };
    this.script = {
      t: 0,
      dur,
      from,
      to: {
        yaw: yaw ?? from.yaw,
        pitch: pitch ?? from.pitch,
        zoom: zoom ?? from.zoom,
        target: target ? target.clone() : from.target,
        offset: offset ? offset.clone() : from.offset,
      },
      onDone,
    };
  }

  snap(pose) {
    Object.assign(this.goal, { yaw: pose.yaw ?? this.goal.yaw, pitch: pose.pitch ?? this.goal.pitch, zoom: pose.zoom ?? this.goal.zoom });
    this.yaw = this.goal.yaw;
    this.pitch = this.goal.pitch;
    this.zoom = this.goal.zoom;
    if (pose.target) {
      this.goalTarget.copy(pose.target);
      this.target.copy(pose.target);
    }
    if (pose.offset) {
      this.goalOffset.copy(pose.offset);
      this.offset.copy(pose.offset);
    }
  }

  /** Fold the player's orbit into the base pose (used when leaving explore mode). */
  bakeUserOrbit() {
    this.goal.yaw += this.userYaw;
    this.yaw += this.userYaw;
    this.userYaw = 0;
    this.userPitch = 0;
  }

  update(dt, groundAt = null) {
    if (this.script) {
      const s = this.script;
      s.t += dt;
      const k = ease(Math.min(1, s.t / s.dur));
      this.goal.yaw = angleLerp(s.from.yaw, s.to.yaw, k);
      this.goal.pitch = THREE.MathUtils.lerp(s.from.pitch, s.to.pitch, k);
      this.goal.zoom = THREE.MathUtils.lerp(s.from.zoom, s.to.zoom, k);
      this.goalTarget.lerpVectors(s.from.target, s.to.target, k);
      this.goalOffset.lerpVectors(s.from.offset, s.to.offset, k);
      if (s.t >= s.dur) {
        this.script = null;
        s.onDone?.();
      }
    }

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const px = reduce || this.dragging ? 0 : this.pointer.x, py = reduce || this.dragging ? 0 : this.pointer.y;
    this.parallax.x = damp(this.parallax.x, px, 2.0, dt);
    this.parallax.y = damp(this.parallax.y, py, 2.0, dt);

    const yawGoal = this.goal.yaw + this.userYaw + this.parallax.x * deg(1.8);
    const pitchGoal = THREE.MathUtils.clamp(this.goal.pitch + this.userPitch + this.parallax.y * deg(1.2), this.minPitch, this.maxPitch);
    this.yaw = angleLerp(this.yaw, yawGoal, 1 - Math.exp(-6 * dt));
    // keep angles small so float precision never drifts
    const TAU = Math.PI * 2;
    if (Math.abs(this.yaw) > TAU) this.yaw = ((this.yaw % TAU) + TAU) % TAU;
    if (Math.abs(this.userYaw) > TAU * 4) this.userYaw %= TAU;
    this.pitch = damp(this.pitch, pitchGoal, 6, dt);
    this.zoom = damp(this.zoom, this.goal.zoom * this.userZoom, 5, dt);
    this.target.x = damp(this.target.x, this.goalTarget.x, 5, dt);
    this.target.y = damp(this.target.y, this.goalTarget.y, 5, dt);
    this.target.z = damp(this.target.z, this.goalTarget.z, 5, dt);
    this.offset.x = damp(this.offset.x, this.goalOffset.x, 6, dt);
    this.offset.y = damp(this.offset.y, this.goalOffset.y, 6, dt);

    const R = this.dist;
    const cp = Math.cos(this.pitch);
    const cam = this.camera;
    cam.position.set(
      this.target.x + Math.sin(this.yaw) * cp * R,
      this.target.y + Math.sin(this.pitch) * R,
      this.target.z + Math.cos(this.yaw) * cp * R
    );
    // never dip below the hills
    if (groundAt) {
      const g = groundAt(cam.position.x, cam.position.z) + 1.2;
      if (cam.position.y < g) cam.position.y = g;
    }
    cam.lookAt(this.target);
    this._project();
  }
}

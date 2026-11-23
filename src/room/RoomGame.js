import * as THREE from 'three';
import { Post } from '../core/post.js';
import { fogUniforms, paletteMaterial } from '../core/palette.js';
import { weatherUniforms, bake, K } from '../world/kit.js';
import { setTexturedKit } from '../core/geo.js';
import { SkeletalBody } from '../world/detectiveRig.js';
import { Detective } from '../world/detective.js';
import { NavGrid } from '../world/nav.js';
import { RoomUI } from './roomUI.js';
import * as F from './furniture.js';
import { resolveScene, PIECES, RK, W, D, CEIL, HW, HD } from './scenes.js';
import { kitHouse } from '../world/kitHouse.js';

const deg = THREE.MathUtils.degToRad;
const damp = (a, b, l, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-l * dt));
const PEOPLE = 1.14; // characters a touch larger indoors, for real proportions against doors

const GENERIC = [
  'I don\'t see what that has to do with me, Inspector.',
  'That proves nothing. Ask someone else.',
  'You\'re grasping at fog.',
  'I\'ve never seen it before tonight.',
];

/**
 * One crime-scene room: a cut-away diorama with its own camera, lights and rules.
 */
export class RoomGame {
  constructor({ renderer, canvas, kit, charGltf, detGltf, environment, audio, ui, store, quality, onExit }) {
    Object.assign(this, { renderer, canvas, kit, charGltf, detGltf, audio, ui, store, onExit });
    this.quality = quality;
    this.active = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1411');
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.32;
    this.t = 0;

    // orthographic diorama camera
    // an eye-level lens standing inside the room: walls, floor and ceiling always fill the frame
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.08, 60);
    // shot system: follow (explore), talk (over the shoulder), inspect (object close-up), reveal, intro
    this.cam = { userYaw: 0, userZoom: 1, pos: new THREE.Vector3(3, 2.4, 3.5), look: new THREE.Vector3(0, 1, 0), fov: 52 };
    this.view = { mode: 'intro', until: 0, subject: null };
    this.keys = new Set();
    this.steerVec = new THREE.Vector2();
    this.pointer = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    this.roomUI = new RoomUI({
      accuse: () => this.openAccuse(),
      leave: () => this.leave(),
      compare: (a, b) => this.compare(a, b),
      closeDialog: () => this.closeDialog(),
      sound: (k) => (k === 'page' ? this.audio.page() : this.audio.uiHover()),
    });
    this._bindInput();
  }

  /* ================================================================ */
  /* Build                                                            */
  /* ================================================================ */

  build(caseData) {
    this.caseData = caseData;
    F.reseed(424242);
    const s = this.scene;
    const sc = resolveScene(caseData.scene);
    this.sceneDef = sc;
    this.street = sc.type === 'street';
    // walls are where the camera stops; walk is where people can stand
    this.bounds = this.street
      ? { x0: -HW - 2.5, x1: HW + 2.5, z0: -HD + 0.35, z1: HD + 3.4, top: 5.2, walk: { x0: -HW + 0.4, x1: HW - 0.55, z0: -HD + 0.85, z1: HD - 0.45 } }
      : { x0: -HW, x1: HW, z0: -HD, z1: HD, top: CEIL, walk: { x0: -HW + 0.55, x1: HW - 0.55, z0: -HD + 0.55, z1: HD - 0.55 } };

    setTexturedKit(this.kit);
    if (this.street) this._buildStreet(sc);
    else this._buildShell(sc.shell);

    // props from the scene layout
    this.pieces = {};
    this.labels = {};
    this.occluders = [];
    this.swingers = [];
    this.lightDefs = [];
    const blockers = [];
    for (const p of sc.layout) {
      const def = PIECES[p.piece];
      const mesh = def.make(...(p.args || []));
      mesh.position.set(p.at[0], p.at[1], p.at[2]);
      mesh.rotation.set(p.rx || 0, p.ry || 0, 0, 'YXZ');
      if (p.scale) mesh.scale.setScalar(p.scale);
      s.add(mesh);
      this.pieces[p.id] = mesh;
      this.labels[p.id] = p.label || def.label;
      if (p.occlude ?? def.occlude) this.occluders.push(mesh);
      if ((p.block ?? def.block) && p.piece !== 'proxy') blockers.push(mesh);
      if (def.swing) this.swingers.push(mesh);
      if (p.light) this.lightDefs.push({ ...p.light, pos: new THREE.Vector3(...p.at).add(new THREE.Vector3(...p.light.at)) });
    }
    setTexturedKit(null);

    // obstacles for walking
    this.obstacles = [...(this.streetBlocks || [])];
    for (const m of blockers) {
      const b = new THREE.Box3().setFromObject(m).expandByScalar(0.18);
      this.obstacles.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z });
    }

    this.buildAtmosphere(sc);

    // interactables: evidence objects with picking proxies
    this.interact = [];
    for (const ev of caseData.evidence) {
      const target = this.pieces[ev.object];
      if (!target) {
        console.warn(`[case] evidence ${ev.id} points at "${ev.object}", which this scene does not have`);
        continue;
      }
      const box = new THREE.Box3().setFromObject(target);
      const size = box.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.6, 0.35, 0.6));
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
      box.getCenter(proxy.position);
      s.add(proxy);
      const it = { kind: 'object', ev, mesh: target, proxy, stand: this._standPoint(box), label: ev.place || this.labels[ev.object] };
      proxy.userData.it = it;
      this.interact.push(it);
    }

    // suspects: nudged clear of furniture if a case puts someone inside a table
    this.suspects = caseData.suspects.map((def) => {
      const [px, pz] = this._freeSpot(def.pos[0], def.pos[1], 0.45);
      const body = new SkeletalBody(this.charGltf, { body: def.body, hair: def.hair, look: def.look, clone: true });
      const root = new THREE.Group();
      root.add(body.model);
      root.scale.setScalar(PEOPLE);
      root.position.set(px, 0, pz);
      root.rotation.y = Math.PI / 4 + (def.face ?? 0) * 0.3;
      root.userData.baseYaw = root.rotation.y;
      s.add(root);
      const blob = this._blob(0.34);
      root.add(blob);
      const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.55, 8), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.set(px, 0.78, pz);
      s.add(proxy);
      this.obstacles.push({ minX: px - 0.42, maxX: px + 0.42, minZ: pz - 0.42, maxZ: pz + 0.42 });
      const sp = { def, body, root, proxy, faceYaw: 0, t: Math.random() * 10, breakK: 0 };
      const it = { kind: 'suspect', sp, mesh: root, proxy, stand: null };
      proxy.userData.it = it;
      this.interact.push(it);
      return sp;
    });

    // the detective walks in through the door (or out of the fog, on a street)
    this.detective = new Detective(this.detGltf);
    this.detective.root.scale.setScalar(PEOPLE);
    this.detective.attachTo(this.scene);
    this.detective.stepCb = () => this.audio.footstep();

    this._buildLights(sc);

    this.post = new Post(this.renderer, this.scene, this.camera, { msaa: 4, ao: this.quality().ao });
    this.post.outline.visibleEdgeColor.set('#ffd28c');
    this.post.outline.hiddenEdgeColor.set('#2a1a0a');
    // close-up: a thin, steady rim instead of the village's soft glow
    this.post.outline.edgeStrength = 2.4;
    this.post.outline.edgeGlow = 0.0;
    this.post.outline.edgeThickness = 1.0;
    this.post.outline.pulsePeriod = 0;
    this.post.grade.uniforms.uVignette.value = 0.95;
    this.post.bloom.strength = this.street ? 0.5 : 0.38;
    this.post.bloom.threshold = this.street ? 0.85 : 0.95;
    if (this.street) this.post.grade.uniforms.uTint.value.set(0.96, 0.99, 1.04);
    else this.post.grade.uniforms.uTint.value.set(1.02, 0.98, 0.94);

    const w = this.bounds.walk;
    this.nav = new NavGrid((x, z) => this.collide(x, z), Math.max(-w.x0, w.x1, -w.z0, w.z1) + 0.4, 0.22);
    this.built = true;
  }

  /** A closed room: four timber-framed walls two storeys high under a beamed ceiling. */
  _buildShell(shell) {
    const s = this.scene;
    const kit = this.kit;
    const g = new THREE.Group();
    const brick = shell.walls === 'brick';
    const thin = shell.winType === 'thin';
    const win = shell.windows || {};
    for (let i = 0; i < W / 2; i++) for (let j = 0; j < D / 2; j++) kit.place(g, 'Floor_WoodDark', -W / 2 + 1 + i * 2, 0, -D / 2 + 1 + j * 2, 0);
    const cold = { swap: { MI_WindowGlass: 'MI_WindowGlass_Cold' } };
    const wallRun = (count, at, rot, windows, doorSlot = -1) => {
      for (let i = 0; i < count; i++) {
        const [x, z] = at(i);
        const sp = i === doorSlot ? 'door' : windows.includes(i) ? 'window' : null;
        let base;
        if (sp === 'window') base = brick ? 'Wall_UnevenBrick_Window_Thin_Round' : thin ? 'Wall_Plaster_Window_Thin_Round' : 'Wall_Plaster_Window_Wide_Flat';
        else if (sp === 'door') base = brick ? 'Wall_UnevenBrick_Door_Flat' : 'Wall_Plaster_Door_Flat';
        else base = brick ? 'Wall_UnevenBrick_Straight' : shell.grid && i % 2 ? 'Wall_Plaster_WoodGrid' : 'Wall_Plaster_Straight_Base';
        kit.place(g, base, x, 0, z, rot);
        if (sp === 'window') kit.place(g, thin || brick ? 'Window_Thin_Round1' : 'Window_Wide_Flat1', x, 0, z, rot, cold);
        if (sp === 'door') {
          kit.place(g, 'DoorFrame_Flat_WoodDark', x, 0, z, rot);
          const d = kit.place(g, 'Door_1_Flat', 0, 0, 0, 0);
          const hinge = new THREE.Vector3(-0.56, 0, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
          d.position.set(x + hinge.x, 0, z + hinge.z);
          d.rotation.y = rot + 1.2; // left open: the detective just came in
        }
        // second storey of wall, cut by the ceiling, with the floor beam between
        kit.place(g, i % 2 ? 'Wall_Plaster_Straight' : 'Wall_Plaster_WoodGrid', x, 3.0, z, rot);
        kit.place(g, 'Wall_BottomCover', x, 3.0, z, rot);
      }
    };
    wallRun(W / 2, (i) => [-W / 2 + 1 + i * 2, -D / 2], Math.PI, win.back || []);
    wallRun(W / 2, (i) => [-W / 2 + 1 + i * 2, D / 2], 0, win.front || []);
    wallRun(D / 2, (j) => [-W / 2, -D / 2 + 1 + j * 2], -Math.PI / 2, win.left || [], 5);
    wallRun(D / 2, (j) => [W / 2, -D / 2 + 1 + j * 2], Math.PI / 2, win.right || []);
    const corner = brick ? 'Corner_Exterior_Brick' : 'Corner_Exterior_Wood';
    for (const [cx, cz, r] of [[-W / 2, -D / 2, Math.PI], [W / 2, -D / 2, Math.PI / 2], [-W / 2, D / 2, -Math.PI / 2], [W / 2, D / 2, 0]]) {
      kit.place(g, corner, cx, 0, cz, r);
      kit.place(g, 'Corner_Exterior_Wood', cx, 3.0, cz, r);
    }
    const baked = bake(g);
    baked.scale.setScalar(RK);
    s.add(baked);
    s.add(F.ceiling(W * RK, D * RK, CEIL));
    s.background = new THREE.Color('#1a1411');
  }

  /** A lane between two rows of kit houses, running off into the fog at both ends. */
  _buildStreet(sc) {
    const s = this.scene;
    const H = sc.houses;
    this.streetBlocks = [];
    const row = (specs, faceZ, flip) => {
      // measure every house, then stand them shoulder to shoulder, centred on the lane
      const houses = specs.map((spec) => {
        const h = kitHouse(this.kit, { ...spec, lit: spec.lit || new Set() }).group;
        h.scale.multiplyScalar(RK / K);
        if (flip) h.rotation.y = Math.PI;
        h.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(h);
        return { h, box, w: box.max.x - box.min.x };
      });
      const gap = 0.12;
      const total = houses.reduce((a, o) => a + o.w, 0) + gap * (houses.length - 1);
      let x = -total / 2;
      for (const o of houses) {
        const cx = (o.box.min.x + o.box.max.x) / 2;
        o.h.position.x += x + o.w / 2 - cx;
        o.h.position.z += flip ? faceZ - o.box.min.z : faceZ - o.box.max.z;
        s.add(o.h);
        x += o.w + gap;
      }
    };
    row(H.back, H.backZ, false);
    row(H.front, H.frontZ, true);
    s.background = fogUniforms.uFogColor.value.clone();
  }

  /** Lights for the scene: moonlight, the main lamp, every practical the layout carries, a soft fill. */
  _buildLights(sc) {
    const s = this.scene;
    const street = this.street;
    this.hemiBase = street ? 0.55 : 0.62;
    this.hemiColors = street ? ['#8ea4c8', '#46566e'] : ['#ffd9b0', '#5a6f9a'];
    this.hemi = new THREE.HemisphereLight(this.hemiColors[0], street ? '#2a2a30' : '#3a2a1e', this.hemiBase);
    s.add(this.hemi);
    this.keyBase = street ? 1.7 : 2.2;
    this.keyColor = new THREE.Color(street ? '#a9bfe6' : '#9db4dc');
    this.key = new THREE.DirectionalLight(this.keyColor, this.keyBase);
    if (street) {
      this.key.position.set(-7, 12, 9);
      this.key.target.position.set(0, 0, -1.5);
    } else {
      // moonlight falls through the back window that the room kind names
      const mx = sc.moon.x;
      this.key.position.set(mx - 1.56, 4.2, -14);
      this.key.target.position.set(mx + 2.24, 0, -1.6);
    }
    this.key.castShadow = true;
    const sh = street ? 13 : 9;
    Object.assign(this.key.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 45 });
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 3;
    s.add(this.key, this.key.target);
    // the main lamp: a warm cone of light with soft shadows
    this.spotBase = street ? 30 : 38;
    this.lampSpot = new THREE.SpotLight('#ffb877', this.spotBase, street ? 9 : 11, street ? 0.9 : 1.15, 0.85, 1.4);
    this.lampSpot.position.set(...sc.spot.at);
    this.lampSpot.target.position.set(...sc.spot.target);
    this.lampSpot.castShadow = true;
    this.lampSpot.shadow.mapSize.set(1024, 1024);
    this.lampSpot.shadow.bias = -0.0006;
    this.lampSpot.shadow.radius = 5;
    this.lampSpot.shadow.camera.near = 0.2;
    s.add(this.lampSpot, this.lampSpot.target);
    this.practicals = this.lightDefs.map((d) => {
      const l = new THREE.PointLight(d.color, d.i, d.d || (street ? 9 : 7), 1.6);
      l.position.copy(d.pos);
      l.userData.base = d.i;
      l.userData.seed = Math.random() * 10;
      s.add(l);
      return l;
    });
    // soft fill from the open side, so faces read without flattening the lamplight
    this.fillBase = street ? 3.5 : 7;
    this.fill = new THREE.PointLight(street ? '#9fb4d8' : '#ffcf9e', this.fillBase, 14, 1.4);
    this.fill.position.set(3.2, 2.6, 3.8);
    s.add(this.fill);
    // a spotlight that only wakes up for the reveal
    this.revealSpot = new THREE.SpotLight('#dfe6ff', 0, 12, 0.32, 0.6, 1.2);
    this.revealSpot.position.set(0, this.bounds.top - 0.3, 2);
    s.add(this.revealSpot, this.revealSpot.target);
  }

  /** The nearest spot at least `r` clear of furniture. */
  _freeSpot(x, z, r) {
    const clear = (a, b) => !this.collide(a - r, b) && !this.collide(a + r, b) && !this.collide(a, b - r) && !this.collide(a, b + r) && !this.collide(a, b);
    if (clear(x, z)) return [x, z];
    for (let rad = 0.2; rad < 4; rad += 0.2) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const nx = x + Math.cos(a) * rad, nz = z + Math.sin(a) * rad;
        if (clear(nx, nz)) return [nx, nz];
      }
    }
    return [x, z];
  }

  /** Fake volumetrics: moonlight through the back window and dust indoors; falling snow outside. */
  buildAtmosphere(sc) {
    const s = this.scene;
    const street = this.street;
    if (!street) {
      const backZ = -HD + 0.27;
      const win = { x: sc.moon.x, y: 1.42, z: backZ - 0.02, w: sc.moon.w, h: sc.moon.h };
      const kp = new THREE.Vector3(win.x - 1.56, 4.2, -14), kt = new THREE.Vector3(win.x + 2.24, 0, -1.6);
      const dir = kt.sub(kp).normalize();
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(win.x + (a * win.w) / 2, win.y + (b * win.h) / 2, win.z));
      const floor = corners.map((c) => c.clone().addScaledVector(dir, c.y / -dir.y));
      const pos = [], fade = [];
      const quad = (a, b, c, d, fa, fb, fc, fd) => {
        pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
        fade.push(fa, fb, fc, fa, fc, fd);
      };
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        quad(corners[i], corners[j], floor[j], floor[i], 1, 1, 0, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
      this.shaftMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color('#8fb0e0') }, uAlpha: { value: 0.055 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: 'attribute float aFade; varying float vF; varying vec3 vP; void main(){ vF = aFade; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying float vF; varying vec3 vP; void main(){ float n = 0.75 + 0.25 * sin(vP.x * 7.0 + vP.y * 5.0 + uTime * 0.4); gl_FragColor = vec4(uColor, uAlpha * pow(clamp(vF, 0.0, 1.0), 0.8) * max(n, 0.0)); }',
      });
      const shaft = new THREE.Mesh(g, this.shaftMat);
      shaft.renderOrder = 5;
      shaft.userData.noAO = true;
      s.add(shaft);
    } else {
      this.shaftMat = null;
    }

    // dust motes drifting in the lamplight, or snow falling through the lane
    const N = street ? 1600 : 700;
    const ex = street ? HW + 3 : HW - 0.4, ez = street ? HD + 2 : HD - 0.4, top = street ? 6 : CEIL - 0.5;
    const p = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      p.set([(Math.random() * 2 - 1) * ex, 0.2 + Math.random() * top, (Math.random() * 2 - 1) * ez + (street ? 1 : 0)], i * 3);
      seed[i] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const vertex = street
      ? `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA; void main(){ vec3 q = position; float fall = uTime * (0.35 + aSeed * 0.35); q.y = 0.05 + mod(position.y - fall, ${top.toFixed(1)}); q.x += sin(uTime * 0.6 + aSeed * 40.0) * 0.25; q.z += cos(uTime * 0.5 + aSeed * 29.0) * 0.2; vec4 mv = modelViewMatrix * vec4(q,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.018 + aSeed * 0.02) / -mv.z; vA = 0.55 + 0.4 * aSeed; }`
      : 'attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA; void main(){ vec3 q = position; float t = uTime * (0.03 + aSeed * 0.04); q.x += sin(t * 6.28 + aSeed * 40.0) * 0.35; q.y += sin(t * 3.0 + aSeed * 17.0) * 0.25; q.z += cos(t * 5.0 + aSeed * 29.0) * 0.35; vec4 mv = modelViewMatrix * vec4(q,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.008 + aSeed * 0.012) / -mv.z; vA = 0.25 + 0.5 * fract(aSeed * 13.7 + uTime * 0.05); }';
    const color = street ? 'vec3(0.92, 0.95, 1.0)' : 'vec3(1.0, 0.86, 0.66)';
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: street ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: vertex,
      fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)) * vA; gl_FragColor = vec4(${color}, a * ${street ? '0.8' : '0.55'}); }`,
    });
    this.clickRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2c386', transparent: true, opacity: 0, depthWrite: false }));
    this.clickRing.userData.t = 1;
    this.clickRing.renderOrder = 7;
    s.add(this.clickRing);
    const dust = new THREE.Points(dg, this.dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 6;
    s.add(dust);
  }

  _blob(r) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false, map: new THREE.CanvasTexture(c) }));
    m.position.y = 0.02;
    return m;
  }

  /** A free spot in front of an object, toward the room centre. */
  _standPoint(box) {
    const c = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(0.2 - c.x, 0, 0.6 - c.z).normalize();
    const reach = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 0.55;
    return new THREE.Vector2(c.x + dir.x * reach, c.z + dir.z * reach);
  }

  collide(x, z) {
    const w = this.bounds.walk;
    if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) return true;
    for (const o of this.obstacles) if (x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ) return true;
    return false;
  }

  /* ================================================================ */
  /* Lifecycle                                                        */
  /* ================================================================ */

  enter() {
    this.active = true;
    // indoors: no ground mist, no snow on the floorboards
    this.savedFog = { g: fogUniforms.uFogGround.value, n: fogUniforms.uFogNear.value, f: fogUniforms.uFogFar.value, a: fogUniforms.uFogAbyss.value };
    this.savedWeather = { s: weatherUniforms.uSnow.value, w: weatherUniforms.uWet.value };
    this.savedExposure = this.renderer.toneMappingExposure;
    this.savedEmissive = paletteMaterial().emissiveIntensity;
    if (this.street) {
      // the lane: mist on the cobbles, the far ends lost in fog, snow settling on every ledge
      fogUniforms.uFogGround.value = 0.3;
      fogUniforms.uFogNear.value = 7;
      fogUniforms.uFogFar.value = 30;
      weatherUniforms.uSnow.value = this.savedWeather.s * 0.7;
      weatherUniforms.uWet.value = this.savedWeather.w;
      paletteMaterial().emissiveIntensity = 1.8;
      this.exposure = 1.3;
    } else {
      fogUniforms.uFogGround.value = 0;
      fogUniforms.uFogNear.value = 1e4;
      fogUniforms.uFogFar.value = 2e4;
      fogUniforms.uFogAbyss.value = -1e4;
      weatherUniforms.uSnow.value = 0;
      weatherUniforms.uWet.value = 0;
      // glowing glass is seen up close indoors: keep it from blooming into glare
      paletteMaterial().emissiveIntensity = 1.25;
      this.exposure = 1.55;
    }
    this.renderer.toneMappingExposure = this.exposure;
    this.reset();
    this.roomUI.show(this.caseData);
    this.post.ao = this.quality().ao;
  }

  exit() {
    this.active = false;
    this.roomUI.hide();
    this.ui.hideNote();
    this.ui.hideTooltip();
    Object.assign(fogUniforms.uFogGround, { value: this.savedFog.g });
    fogUniforms.uFogNear.value = this.savedFog.n;
    fogUniforms.uFogFar.value = this.savedFog.f;
    fogUniforms.uFogAbyss.value = this.savedFog.a;
    weatherUniforms.uSnow.value = this.savedWeather.s;
    weatherUniforms.uWet.value = this.savedWeather.w;
    this.renderer.toneMappingExposure = this.savedExposure ?? 1.3;
    paletteMaterial().emissiveIntensity = this.savedEmissive ?? 2.4;
  }

  reset() {
    const c = this.caseData;
    this.actions = c.actions;
    this.searched = new Set();
    this.questioned = new Set();
    this.confronted = new Set();
    this.entries = [];
    this.flagged = new Set();
    this.talking = null;
    this.phase = 'play';
    this.mood = 0; // 0 warm investigation -> 1 midnight reveal
    this.focus = null;
    this.cam.userYaw = 0;
    this.cam.userZoom = 1;
    // establishing shot from just inside the door, then the camera takes up its place behind the detective
    this.cam.pos.set(-HW + 1.3, 1.75, HD - 1.0);
    this.cam.look.set(0.6, 1.0, -1.8);
    this.cam.fov = 58;
    this.setView('intro', null, 2.8);
    this.detective.setPosition(-HW + 0.75, 4.0, deg(100));
    this.detective.walkTo(-3.5, 2.9);
    for (const sp of this.suspects) sp.breakK = 0;
    this.roomUI.setActions(this.actions, c.actions);
    this.roomUI.setNotebook(this.entries, this.flagged);
    this.revealSpot.intensity = 0;
  }

  /** Retire this room for good: the next case builds its own. */
  dispose() {
    if (this.active) this.exit();
    this.active = false;
    this.roomUI.root.remove();
    this.post?.composer?.dispose?.();
  }

  leave() {
    if (this.phase === 'reveal') return;
    this.onExit?.({ solved: false });
  }

  /* ================================================================ */
  /* Rules                                                            */
  /* ================================================================ */

  spend(n = 1) {
    this.actions = Math.max(0, this.actions - n);
    this.roomUI.setActions(this.actions, this.caseData.actions);
    if (this.actions === 0) this._outOfActions = true;
  }

  _maybeForceAccuse() {
    if (this._outOfActions && this.phase === 'play') {
      this._outOfActions = false;
      setTimeout(() => this.openAccuse('That was your last action. Name the killer, and show the evidence that proves it.', false), 900);
    }
  }

  addEntry(key, kind, title, text) {
    if (this.entries.some((e) => e.key === key)) return;
    this.entries.push({ key, kind, title, text });
    this.roomUI.setNotebook(this.entries, this.flagged);
  }

  search(it) {
    const ev = it.ev;
    const first = !this.searched.has(ev.id);
    if (first && this.actions <= 0) return this.openAccuse('You have no actions left. Name the killer.', false);
    this.closeDialog();
    this._walkThen(it.stand, it.mesh, () => {
      if (first) {
        this.spend(1);
        this.searched.add(ev.id);
        if (ev.clue) this.addEntry(ev.id, 'evidence', ev.name, ev.found);
      }
      this.audio.page();
      this.setView('inspect', it, 3 + ev.found.length * 0.03);
      this.ui.showNote(ev.name, ev.found + (first && ev.clue ? ' Added to your notebook.' : ''));
      this._maybeForceAccuse();
    });
  }

  question(sp) {
    const def = sp.def;
    const first = !this.questioned.has(def.id);
    if (first && this.actions <= 0) return this.openAccuse('You have no actions left. Name the killer.', false);
    this.ui.hideNote();
    const p = sp.root.position;
    const toward = new THREE.Vector2(this.detective.root.position.x - p.x, this.detective.root.position.z - p.z).normalize();
    const stand = new THREE.Vector2(p.x + toward.x * 1.05, p.z + toward.y * 1.05);
    this._walkThen(stand, sp.root, () => {
      if (first) {
        this.spend(1);
        this.questioned.add(def.id);
        this.addEntry(`s:${def.id}`, 'statement', `${def.name} said`, def.statement);
      }
      this.talking = sp;
      this.setView('talk', sp);
      this._showTalk(sp, def.statement);
    });
  }

  _showTalk(sp, text) {
    const def = sp.def;
    const found = this.caseData.evidence.filter((e) => this.searched.has(e.id) && e.clue);
    const buttons = [];
    buttons.push({
      label: 'Show evidence',
      cost: 1,
      primary: true,
      disabled: !found.length || this.actions <= 0,
      onClick: () => this._pickEvidence(sp, found),
    });
    buttons.push({ label: 'Done', quiet: true, onClick: () => this.closeDialog() });
    this.roomUI.showDialog({ name: def.name, role: def.role, text, buttons });
    this.audio.uiHover();
  }

  _pickEvidence(sp, found) {
    const def = sp.def;
    const buttons = found.map((e) => ({
      label: e.name,
      disabled: this.confronted.has(`${def.id}:${e.id}`),
      onClick: () => this.confront(sp, e),
    }));
    buttons.push({ label: 'Back', quiet: true, onClick: () => this._showTalk(sp, def.statement) });
    this.roomUI.showDialog({ name: def.name, role: def.role, text: 'Which piece of evidence do you put in front of them? It costs one action.', buttons });
  }

  confront(sp, ev) {
    const def = sp.def;
    const key = `${def.id}:${ev.id}`;
    if (this.confronted.has(key) || this.actions <= 0) return;
    this.spend(1);
    this.confronted.add(key);
    const reply = def.confront?.[ev.id];
    const text = reply || GENERIC[(def.id.length + ev.id.length) % GENERIC.length];
    if (reply) this.addEntry(`c:${key}`, 'statement', `${def.name}, shown ${ev.name.toLowerCase()}`, reply);
    if (reply && def.culprit && this.caseData.proof.includes(ev.id)) sp.breakK = 0.6; // the mask slips
    this.audio.page();
    this.roomUI.showDialog({
      name: def.name,
      role: def.role,
      text,
      buttons: [
        { label: 'Show more evidence', cost: 1, disabled: this.actions <= 0, onClick: () => this._pickEvidence(sp, this.caseData.evidence.filter((e) => this.searched.has(e.id) && e.clue)) },
        { label: 'Done', quiet: true, onClick: () => this.closeDialog() },
      ],
    });
  }

  closeDialog() {
    this.roomUI.hideDialog();
    this.talking = null;
    if (this.view.mode === 'talk') this.setView('follow');
    this._maybeForceAccuse();
  }

  compare(a, b) {
    const hit = this.caseData.contradictions.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
    if (hit) {
      this.flagged.add(a);
      this.flagged.add(b);
      this.audio.uiSelect();
      return { found: true, text: hit.text };
    }
    return { found: false, text: 'These two don\'t contradict each other.' };
  }

  openAccuse(message, canCancel = true) {
    if (this.phase !== 'play') return;
    this.closeDialog();
    this.ui.hideNote();
    const found = this.caseData.evidence.filter((e) => this.searched.has(e.id) && e.clue);
    this.roomUI.openAccuse({
      suspects: this.caseData.suspects,
      evidence: found,
      message,
      canCancel: canCancel && this.actions > 0,
      onAccuse: (sid, evIds) => this.accuse(sid, evIds),
    });
  }

  accuse(sid, evIds) {
    const c = this.caseData;
    this.roomUI.closeAccuse();
    const right = sid === c.culprit && evIds.some((e) => c.proof.includes(e));
    const sp = this.suspects.find((s) => s.def.id === sid);
    this.phase = right ? 'reveal' : 'fail';
    this.roomUI.root.querySelector('.room-tools').hidden = true;
    this.focus = sp;
    this.setView('reveal', sp);
    this.audio.swell();
    if (right) {
      setTimeout(() => this.audio.thunder(0.9), 600);
      const rev = c.reveal;
      setTimeout(() => {
        this.ui.showCard(
          { num: `${c.label} solved`, title: rev.title, text: rev.text, meta: 'Case II is now open' },
          () => this.onExit?.({ solved: true }),
          'Close the case'
        );
      }, 3200);
    } else {
      const text = c.failures[sid] || 'The wrong person pays, and the fog keeps its secret.';
      setTimeout(() => {
        this.ui.showCard(
          { num: 'Wrong accusation', title: 'The fog keeps its secret', text, meta: 'The killer walks free tonight' },
          () => {
            this.roomUI.root.querySelector('.room-tools').hidden = false;
            this.reset();
          },
          'Replay the case',
          { label: 'Leave', onClick: () => this.onExit?.({ solved: false }) }
        );
      }, 2400);
    }
  }

  /* ================================================================ */
  /* Walking + input                                                  */
  /* ================================================================ */

  _walkThen(stand, faceObj, cb) {
    const det = this.detective;
    const p = det.root.position;
    const face = () => {
      const o = faceObj.getWorldPosition(new THREE.Vector3());
      det.faceAfter = Math.atan2(o.x - p.x, o.z - p.z);
    };
    if (Math.hypot(stand.x - p.x, stand.y - p.z) < 0.35) {
      face();
      return cb();
    }
    const path = this.nav.find(p.x, p.z, stand.x, stand.y);
    if (path) det.follow(path, () => (face(), cb()));
    else (face(), cb());
  }

  _bindInput() {
    const c = this.canvas;
    let down = null, moved = 0;
    c.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.lastPointer = { x: e.clientX, y: e.clientY, type: e.pointerType };
      if (down) {
        const dx = e.clientX - down.x;
        moved += Math.abs(dx);
        down.x = e.clientX;
        if (this.view.mode === 'follow') this.cam.userYaw = THREE.MathUtils.clamp(this.cam.userYaw - dx * 0.005, deg(-40), deg(40));
      }
    });
    c.addEventListener('pointerleave', () => (this.lastPointer = null));
    c.addEventListener('pointerdown', (e) => {
      if (!this.active || e.button !== 0) return;
      down = { x: e.clientX };
      moved = 0;
    });
    addEventListener('pointerup', (e) => {
      if (!this.active || !down) return;
      down = null;
      if (moved > 6 || this.phase !== 'play') return;
      const it = this._pick(e.clientX, e.clientY);
      if (it) {
        if (it.kind === 'object') this.search(it);
        else this.question(it.sp);
        return;
      }
      // click the floor to walk there
      const f = this._pickFloor(e.clientX, e.clientY);
      if (f && !this.collide(f.x, f.z)) {
        this.closeDialog();
        this.ui.hideNote();
        if (this.view.mode !== 'follow') this.setView('follow');
        const p = this.detective.root.position;
        const path = this.nav.find(p.x, p.z, f.x, f.z);
        if (path) this.detective.follow(path);
        this.clickRing.position.set(f.x, 0.03, f.z);
        this.clickRing.userData.t = 0;
      }
    });
    addEventListener('keydown', (e) => {
      if (!this.active || e.target.closest?.('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        if (!this.roomUI.accusePanel.hidden) return;
        this.keys.add(k);
        if (k !== 'shift' && this.talking) this.closeDialog();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    c.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.cam.userZoom = THREE.MathUtils.clamp(this.cam.userZoom * Math.exp(-e.deltaY * 0.0012), 0.75, 1.6);
    }, { passive: false });
  }

  setView(mode, subject = null, seconds = 0) {
    this.view = { mode, subject, until: seconds ? this.t + seconds : 0 };
  }

  /** How far a camera at `pos` can see `look` before furniture gets in the way (1 = clear). */
  _clearance(pos, look) {
    const dir = new THREE.Vector3().subVectors(pos, look);
    const len = dir.length();
    this._ray = this._ray || new THREE.Raycaster();
    this._ray.set(look, dir.normalize());
    this._ray.far = len;
    const hit = this._ray.intersectObjects(this.occluders, true).find((h) => h.distance > 0.35);
    return hit ? hit.distance / len : 1;
  }

  _pickFloor(x, y) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? hit : null;
  }

  _readSteer() {
    if (this.phase !== 'play') return null;
    const k = this.keys;
    const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    if (!f && !r) return null;
    const fwd = new THREE.Vector3().subVectors(this.cam.look, this.cam.pos).setY(0).normalize();
    this.steerVec.set(fwd.x * f - fwd.z * r, fwd.z * f + fwd.x * r).normalize();
    if (this.view.mode !== 'follow') this.setView('follow');
    return this.steerVec;
  }

  _inside(v, m = 0.45) {
    const b = this.bounds;
    return Math.min(v.x - b.x0 - m, b.x1 - m - v.x, v.z - b.z0 - m, b.z1 - m - v.z);
  }

  /** Where the camera wants to be for the current shot. */
  _shot() {
    const D = this.detective.root.position;
    const eye = 1.42 * PEOPLE;
    const v = this.view;
    if (v.mode === 'talk' && v.subject) {
      // over the detective's shoulder onto the suspect's face; pick the side with more room
      const S = v.subject.root.position;
      const u = new THREE.Vector3(S.x - D.x, 0, S.z - D.z).normalize();
      const r = new THREE.Vector3(u.z, 0, -u.x);
      const cands = [1, -1].map((side) => new THREE.Vector3(D.x, eye + 0.3, D.z).addScaledVector(u, -1.5).addScaledVector(r, side * 0.82));
      const faceAt = new THREE.Vector3(S.x, eye, S.z);
      const rate = (c) => this._clearance(c, faceAt) * 2 + Math.min(this._inside(c), 0.8);
      const side = (v.side ??= rate(cands[0]) >= rate(cands[1]) ? 1 : -1);
      const pos = side === 1 ? cands[0] : cands[1];
      // aim below and beside the face: it lands in the upper third, clear of the dialogue card,
      // on the camera's side of the frame with the detective's shoulder opposite
      const look = new THREE.Vector3(S.x, eye - 0.42, S.z).addScaledVector(r, -side * 0.22);
      return { pos, look, fov: 40, k: 3.0 };
    }
    if (v.mode === 'reveal' && v.subject) {
      const S = v.subject.root.position;
      const u = new THREE.Vector3(D.x - S.x, 0, D.z - S.z).normalize();
      const pos = new THREE.Vector3(S.x, eye + 0.05, S.z).addScaledVector(u, 2.1).add(new THREE.Vector3(u.z * 0.35, 0, -u.x * 0.35));
      return { pos, look: new THREE.Vector3(S.x, eye - 0.18, S.z), fov: 34, k: 1.1 };
    }
    if (v.mode === 'inspect' && v.subject) {
      const box = new THREE.Box3().setFromObject(v.subject.mesh);
      const O = box.getCenter(new THREE.Vector3());
      const u = new THREE.Vector3(D.x - O.x, 0, D.z - O.z);
      if (u.lengthSq() < 0.01) u.set(0.6, 0, 1);
      u.normalize();
      // high three-quarter view beside the detective, not through his hat: the object fills
      // the upper frame and the detective stands at its edge, leaning in
      if (v.cache) return v.cache;
      const look = O.clone().addScaledVector(u, 0.12).add(new THREE.Vector3(0, -0.12, 0));
      const lift = Math.min(O.y + 1.25, this.bounds.top - 0.9);
      // try both shoulders and a few swings around the object; keep the clearest, roomiest view
      let best = null;
      for (const swing of [0, 0.45, -0.45, 0.9, -0.9]) {
        const c = Math.cos(swing), sn = Math.sin(swing);
        const uu = new THREE.Vector3(u.x * c - u.z * sn, 0, u.x * sn + u.z * c);
        const rr = new THREE.Vector3(uu.z, 0, -uu.x);
        for (const side of [1, -1]) {
          const pos = new THREE.Vector3(O.x, lift, O.z).addScaledVector(uu, 1.25).addScaledVector(rr, side * 1.05);
          const room = this._inside(pos);
          const clear = room > 0 ? this._clearance(pos, look) : 0;
          const score = clear * 3 + Math.min(room, 1) - Math.abs(swing) * 0.6;
          if (!best || score > best.score) best = { pos, score, clear };
        }
      }
      // still blocked: slide in front of whatever is in the way
      if (best.clear < 1) best.pos.lerp(look, 1 - best.clear + 0.12);
      v.cache = { pos: best.pos, look, fov: 40, k: 2.6 };
      return v.cache;
    }
    if (v.mode === 'intro') {
      return { pos: new THREE.Vector3(-HW + 1.6, 1.9, HD - 1.1), look: new THREE.Vector3(0.4, 1.0, -1.6), fov: 56, k: 1.2 };
    }
    // follow: behind and above the detective at a steady three-quarter angle, leaning toward the room
    const L = new THREE.Vector3(D.x, 1.05, D.z).lerp(new THREE.Vector3(0.2, 1.0, -0.9), 0.3);
    const yaw = deg(40) + this.cam.userYaw + this.parallax.x * deg(2);
    const dist = 4.9 / this.cam.userZoom;
    const pos = new THREE.Vector3(L.x + Math.sin(yaw) * dist, L.y + 1.75 / this.cam.userZoom + this.parallax.y * 0.15, L.z + Math.cos(yaw) * dist);
    return { pos, look: L, fov: 52, k: 2.4 };
  }

  _pick(x, y) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.interact.map((i) => i.proxy), false);
    return hits[0]?.object.userData.it || null;
  }

  _hover() {
    if (!this.lastPointer || this.lastPointer.type === 'touch' || this.phase !== 'play' || !this.roomUI.accusePanel.hidden) {
      this._setHover(null);
      return;
    }
    const it = this._pick(this.lastPointer.x, this.lastPointer.y);
    this._setHover(it);
    if (it) {
      const name = it.kind === 'object' ? it.ev.name.replace(/^(A|An|The) /, (m) => m) : it.sp.def.name;
      const done = it.kind === 'object' ? this.searched.has(it.ev.id) : this.questioned.has(it.sp.def.id);
      const label = it.kind === 'object' ? (done ? 'Searched' : 'Search · 1 action') : done ? 'Talk again' : 'Question · 1 action';
      this.ui.showTooltip(this.lastPointer.x, this.lastPointer.y, it.kind === 'object' && !done ? it.label || it.ev.name : name, label);
    }
  }


  _setHover(it) {
    if (this.hovered === it) return;
    this.hovered = it;
    this.post.outline.selectedObjects = it ? [it.mesh] : [];
    this.post.outline.enabled = !!it;
    this.canvas.style.cursor = it ? 'pointer' : 'default';
    if (!it) this.ui.hideTooltip();
    else this.audio.uiHover();
  }

  /* ================================================================ */
  /* Frame                                                            */
  /* ================================================================ */

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.post?.setSize(w, h, this.renderer.getPixelRatio());
  }

  update(dt) {
    if (!this.built) return;
    this.t += dt;
    const t = this.t;

    // camera: each shot eases in; the lens never leaves the room or rises through the ceiling
    if (this.view.until && this.t > this.view.until && this.phase === 'play') this.setView(this.talking ? 'talk' : 'follow', this.talking);
    this.parallax.x = damp(this.parallax.x, this.pointer.x, 2, dt);
    this.parallax.y = damp(this.parallax.y, this.pointer.y, 2, dt);
    const shot = this._shot();
    const k = 1 - Math.exp(-shot.k * dt);
    const cam = this.cam;
    cam.pos.lerp(shot.pos, k);
    cam.look.lerp(shot.look, Math.min(1, k * 1.25));
    const bd = this.bounds;
    cam.pos.x = THREE.MathUtils.clamp(cam.pos.x, bd.x0 + 0.4, bd.x1 - 0.4);
    cam.pos.z = THREE.MathUtils.clamp(cam.pos.z, bd.z0 + 0.4, bd.z1 - 0.4);
    cam.pos.y = THREE.MathUtils.clamp(cam.pos.y, 0.5, bd.top - 0.4);
    const aspect = (this.w || innerWidth) / (this.h || innerHeight);
    const fovGoal = shot.fov * (aspect < 1 ? 1.35 : aspect < 1.4 ? 1.12 : 1);
    cam.fov = damp(cam.fov, fovGoal, 2.5, dt);
    this.camera.position.copy(cam.pos);
    this.camera.lookAt(cam.look);
    this.camera.aspect = aspect;
    this.camera.fov = cam.fov;
    this.camera.updateProjectionMatrix();
    if (this.view.mode === 'intro' && this.t > this.view.until) this.setView('follow');
    // floor marker
    if (this.clickRing.userData.t < 1) {
      this.clickRing.userData.t = Math.min(1, this.clickRing.userData.t + dt * 1.8);
      const q = this.clickRing.userData.t;
      this.clickRing.scale.setScalar(1 + q * 1.4);
      this.clickRing.material.opacity = (1 - q) * 0.8;
    }
    if (this.shaftMat) this.shaftMat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uPx.value = (this.h || innerHeight) * this.renderer.getPixelRatio() * 0.5 * this.camera.projectionMatrix.elements[5];
    this.swingers.forEach((m, i) => {
      m.rotation.z = Math.sin(t * 0.7 + i * 1.7) * 0.02;
      m.rotation.x = Math.sin(t * 0.6 + i * 2.3 + 1) * 0.02;
    });

    // characters
    const det = this.detective;
    det.steer = this._readSteer();
    det.running = this.keys.has('shift');
    det.update(dt, (x, z) => this.collide(x, z));
    det.root.position.y = 0.02;
    const dp = det.root.position;
    for (const sp of this.suspects) {
      sp.t += dt;
      const p = sp.root.position;
      // whoever is being questioned turns to face the detective, then settles back
      const toDet = Math.atan2(dp.x - p.x, dp.z - p.z);
      const baseYaw = this.talking === sp || (this.phase === 'reveal' && this.focus === sp) ? toDet : sp.root.userData.baseYaw;
      const dy = Math.atan2(Math.sin(baseYaw - sp.root.rotation.y), Math.cos(baseYaw - sp.root.rotation.y));
      sp.root.rotation.y += dy * (1 - Math.exp(-3 * dt));
      const want = toDet - sp.root.rotation.y;
      const rel = Math.atan2(Math.sin(want), Math.cos(want));
      const near = Math.hypot(dp.x - p.x, dp.z - p.z) < 3.2 || this.talking === sp;
      sp.faceYaw = damp(sp.faceYaw, near ? THREE.MathUtils.clamp(rel, -1.1, 1.1) : 0, 4, dt);
      let kind = sp.def.idle;
      if (this.talking === sp) kind = 'talk';
      if ((this.phase === 'reveal' && sp === this.focus) || sp.breakK > 0.5) kind = 'break';
      if (this.phase === 'reveal' && sp === this.focus) sp.breakK = Math.min(1, sp.breakK + dt * 0.6);
      sp.body.idle(sp.root, sp.t, kind, sp.faceYaw, Math.max(sp.breakK, 0.6));
      sp.proxy.position.set(p.x, 0.78, p.z);
      // never film from inside someone's coat: hide whoever the camera brushes past
      sp.root.visible = Math.hypot(this.camera.position.x - p.x, this.camera.position.z - p.z) > 0.75 || this.talking === sp;
    }

    // mood: warm amber while investigating, midnight blue for the verdict
    const goal = this.phase === 'play' ? 0 : 1;
    this.mood = damp(this.mood, goal, 1.2, dt);
    const m = this.mood;
    this.inspectK = damp(this.inspectK || 0, this.view.mode === 'inspect' ? 1 : 0, 2.5, dt);
    this.renderer.toneMappingExposure = this.exposure * (1 - this.inspectK * 0.22);
    this.key.color.copy(this.keyColor);
    this.key.intensity = this.keyBase + m * 0.6;
    this.hemi.intensity = this.hemiBase - m * 0.4;
    this.lampSpot.intensity = this.spotBase * (1 - m * 0.8) * (1 - this.inspectK * 0.4) * (1 + Math.sin(t * 7.3) * 0.03);
    if (this.shaftMat) this.shaftMat.uniforms.uAlpha.value = 0.055 + m * 0.05;
    this.fill.intensity = this.fillBase * (1 - m * 0.7);
    this.hemi.color.set(this.hemiColors[0]).lerp(new THREE.Color(this.hemiColors[1]), m);
    for (const l of this.practicals) {
      const f = 1 + Math.sin(t * 9 + l.userData.seed) * 0.04 + Math.sin(t * 21 + l.userData.seed) * 0.03;
      l.intensity = l.userData.base * f * (1 - m * 0.75);
    }
    if (this.focus) {
      this.revealSpot.target.position.copy(this.focus.root.position);
      this.revealSpot.position.set(this.focus.root.position.x + 0.6, this.bounds.top - 0.3, this.focus.root.position.z + 0.8);
      this.revealSpot.intensity = damp(this.revealSpot.intensity, 60 * m, 2, dt);
    }

    if (this.phase === 'play') this._hover();
    else this._setHover(null);
  }

  render(dt) {
    this.renderer.shadowMap.needsUpdate = true;
    this.post.grade.uniforms.uTime.value = this.t;
    this.post.composer.render(dt);
  }
}

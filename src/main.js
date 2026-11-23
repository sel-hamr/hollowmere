import './style.css';
import * as THREE from 'three';
import { fogUniforms, paletteMaterial } from './core/palette.js';
import { Post } from './core/post.js';
import { CameraRig } from './core/cameraRig.js';
import { buildVillage } from './world/village.js';
import { Detective } from './world/detective.js';
import { makeEnvironment, Rain, Ripples, Smoke, Sky } from './fx/atmosphere.js';
import { roadField } from './world/terrain.js';
import { NavGrid } from './world/nav.js';
import { Kit, gltfLoader } from './world/kit.js';
import { AudioEngine } from './audio/audio.js';
import { UI, store, CASES } from './ui/ui.js';
import { RoomGame } from './room/RoomGame.js';
import { CASE_I } from './room/caseLamplighter.js';

const deg = THREE.MathUtils.degToRad;
const loaderBar = document.querySelector('.loader__bar span');
const loaderText = document.querySelector('.loader__text');
const progress = (p, label) => {
  loaderBar.style.width = `${Math.round(p * 100)}%`;
  if (label) loaderText.textContent = label;
};
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* ------------------------------------------------------------------ */
/* Settings & quality tiers                                           */
/* ------------------------------------------------------------------ */

const isSmall = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const settings = Object.assign(
  { quality: isSmall ? 'low' : 'high', rain: 0.7, music: 0.7, sfx: 0.8, muted: false },
  store.get('settings', {})
);
const TIERS = {
  low: { dpr: 1, shadow: 1024, ao: false, rain: 0.45, lights: 3, bloom: true },
  medium: { dpr: Math.min(devicePixelRatio, 1.5), shadow: 2048, ao: false, rain: 0.8, lights: 6, bloom: true },
  high: { dpr: Math.min(devicePixelRatio, 2), shadow: 2048, ao: true, rain: 1, lights: 9, bloom: true },
};

async function boot() {
  progress(0.08, 'Raising the fog');
  await frame();

  /* ---------------- Renderer ---------------- */
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // refreshed every other frame in the loop

  const scene = new THREE.Scene();
  scene.background = fogUniforms.uFogColor.value.clone();
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.42;
  // perspective view depth: the village is clear, the hills fade, the horizon is all fog
  fogUniforms.uFogNear.value = 16;
  fogUniforms.uFogFar.value = 118;

  const rig = new CameraRig(canvas);
  const camera = rig.camera;
  camera.far = 190; // past the fog wall nothing needs drawing

  progress(0.15, 'Unpacking the village');
  let kit = null, detGltf = null;
  const [kitRes, detRes] = await Promise.allSettled([
    Kit.load('/assets/village.glb', (p) => progress(0.15 + p * 0.3)),
    gltfLoader().loadAsync('/assets/detective.glb'),
  ]);
  if (kitRes.status === 'fulfilled') kit = kitRes.value;
  else console.warn('Village kit failed to load, using procedural houses', kitRes.reason);
  if (detRes.status === 'fulfilled') detGltf = detRes.value;
  else console.warn('Detective model failed to load, using procedural figure', detRes.reason);

  progress(0.5, 'Laying the cobbles');
  await frame();

  /* ---------------- World ---------------- */
  const village = buildVillage(kit);
  scene.add(village.root);

  progress(0.55, 'Lighting the lamps');
  await frame();

  // moonlight: the single shadow-casting key light
  const moon = new THREE.DirectionalLight('#a9bfe0', 2.1);
  moon.position.set(20, 34, -16);
  moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 110 });
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.035;
  moon.shadow.radius = 4;
  moon.shadow.blurSamples = 12;
  scene.add(moon, moon.target);
  const MOON_OFFSET = new THREE.Vector3(20, 34, -16);
  // the visible moon hangs low over the hills in the establishing shot (light direction stays separate)
  const sky = new Sky(fogUniforms.uFogColor.value, new THREE.Vector3(-0.3, 0.24, -1.05));
  scene.add(sky.mesh);

  const hemi = new THREE.HemisphereLight('#4f6688', '#1c1612', 1.05);
  scene.add(hemi);

  // street lamps + window spill
  const pointLights = [];
  for (const l of village.lamps) {
    const pl = new THREE.PointLight('#ffb468', l.broken ? 6 : 9, 10, 1.6);
    pl.position.copy(l.pos);
    pl.userData = { base: pl.intensity, broken: l.broken, seed: Math.random() * 100, priority: l.broken ? 1 : 0 };
    scene.add(pl);
    pointLights.push(pl);
  }
  const spill = [
    [new THREE.Vector3(5.6, 1.1, -3.3), '#ff9a48', 4.5], // bakery shop window
    [new THREE.Vector3(-2.6, 1.1, 3.6), '#ff9a48', 3.0], // lamplighter's window
  ];
  for (const [p, c, i] of spill) {
    const pl = new THREE.PointLight(c, i, 5.5, 1.8);
    pl.position.copy(p);
    pl.userData = { base: i, seed: Math.random() * 100, priority: 2, window: true };
    scene.add(pl);
    pointLights.push(pl);
  }

  /* ---------------- Detective ---------------- */
  let detective;
  try {
    detective = new Detective(detGltf);
  } catch (err) {
    console.warn('Rigged detective failed, using procedural figure', err);
    detective = new Detective();
  }
  detective.setPosition(1.5, 3.3, deg(40));
  if (detective.attachTo) detective.attachTo(scene);
  else scene.add(detective.root);

  progress(0.72, 'Calling the rain');
  await frame();

  /* ---------------- Atmosphere ---------------- */
  const rain = new Rain(isSmall ? 4000 : 9000, 26);
  rain.uniforms.uWidth.value = 0.028;
  rain.uniforms.uLen.value = 0.9;
  scene.add(rain.mesh);
  const ripples = new Ripples(village.terrain.puddles, roadField, isSmall ? 220 : 420);
  scene.add(ripples.mesh);
  const smoke = new Smoke(village.chimneys.filter((c) => c.active).map((c) => c.pos));
  scene.add(smoke.mesh);

  // ground cursor + click marker
  const ringMat = new THREE.MeshBasicMaterial({ color: '#f2c386', transparent: true, opacity: 0, depthWrite: false });
  const cursorRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 32).rotateX(-Math.PI / 2), ringMat);
  cursorRing.position.y = 0.13;
  cursorRing.renderOrder = 12;
  scene.add(cursorRing);
  const clickRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 32).rotateX(-Math.PI / 2), ringMat.clone());
  clickRing.position.y = 0.13;
  clickRing.renderOrder = 12;
  clickRing.userData.t = 1;
  scene.add(clickRing);

  /* ---------------- Post ---------------- */
  const post = new Post(renderer, scene, camera, { msaa: isSmall ? 2 : 4, ao: TIERS[settings.quality].ao });

  /* ---------------- Audio + UI ---------------- */
  const audio = new AudioEngine();
  audio.musicVol = settings.music;
  audio.sfxVol = settings.sfx;
  audio.muted = settings.muted;
  detective.stepCb = () => audio.footstep();

  let state = 'intro';
  let room = null; // the active crime-scene room, built on first use
  const ui = new UI({
    hover: () => audio.uiHover(),
    select: () => audio.uiSelect(),
    mute: (m) => {
      settings.muted = m;
      audio.setMuted(m);
      save();
    },
    getSettings: () => settings,
    setSetting: (k, v) => {
      settings[k] = v;
      if (k === 'quality') applyQuality();
      if (k === 'rain') applyRain();
      if (k === 'music') audio.setMusic(v);
      if (k === 'sfx') audio.setSfx(v);
      save();
    },
    startCase: (id) => startCase(id),
  });
  ui.setMuted(settings.muted);

  function save() {
    store.set('settings', settings);
  }

  /* ---------------- Quality ---------------- */
  let dpr = 1;
  function applyQuality() {
    const q = TIERS[settings.quality];
    dpr = q.dpr;
    renderer.setPixelRatio(dpr);
    onResize();
    post.ao = q.ao;
    if (moon.shadow.mapSize.x !== q.shadow) {
      moon.shadow.mapSize.set(q.shadow, q.shadow);
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
    }
    // keep the most important practical lights within the tier budget
    const sorted = [...pointLights].sort((a, b) => a.userData.priority - b.userData.priority);
    sorted.forEach((l, i) => (l.visible = i < q.lights - 1));
    applyRain();
  }
  function applyRain() {
    rain.setDensity(settings.rain * TIERS[settings.quality].rain);
    rain.uniforms.uOpacity.value = 0.18 + settings.rain * 0.14;
    audio.setRain(settings.rain);
  }

  /* ---------------- Resize ---------------- */
  function onResize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    rig.resize(w, h);
    post.setSize(w, h, dpr);
    room?.resize(w, h);
  }
  addEventListener('resize', onResize);
  applyQuality();

  /* ---------------- Collision ---------------- */
  const R = 0.28;
  const collide = (x, z) => {
    if (Math.abs(x) > village.bounds || Math.abs(z) > village.bounds) return true;
    for (const o of village.obstacles) {
      if (x > o.minX - R && x < o.maxX + R && z > o.minZ - R && z < o.maxZ + R) return true;
    }
    return false;
  };
  const nav = new NavGrid(collide, village.bounds + 0.6, 0.5);
  const gh = village.groundHeight;
  const walk = (x, z, onArrive, faceAfter) => {
    const p = detective.root.position;
    const path = nav.find(p.x, p.z, x, z);
    if (path) detective.follow(path, onArrive, faceAfter);
    else onArrive?.();
  };

  /* ---------------- Picking ---------------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = village.interactables.map((it) => {
    it.object.traverse((o) => (o.userData.interactable = it));
    return it.object;
  });
  const detectiveInteract = {
    object: detective.root,
    name: 'The Detective',
    lore: 'In your coat: a letter asking you to come to Hollowmere. It is signed by the mayor, who vanished three weeks before it was posted.',
    anchor: null,
    self: true,
  };
  if (detective.pickProxy) {
    detective.pickProxy.userData.interactable = detectiveInteract;
    pickables.push(detective.pickProxy);
  } else {
    detective.root.traverse((o) => (o.userData.interactable = detectiveInteract));
    pickables.push(detective.root);
  }

  let hovered = null;
  let lastPointer = { x: 0, y: 0 };
  const sceneActive = () => state === 'title' || state === 'explore';

  function pick(clientX, clientY) {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    if (hits.length) return { type: 'object', it: hits[0].object.userData.interactable, point: hits[0].point };
    const g = raycaster.intersectObject(village.terrain.walkPlane, false);
    if (g.length) return { type: 'ground', point: g[0].point };
    return null;
  }

  canvas.addEventListener('pointermove', (e) => {
    lastPointer = { x: e.clientX, y: e.clientY, type: e.pointerType };
  });
  // the pointer is over UI (menu, panels) or outside: stop picking the world
  canvas.addEventListener('pointerleave', () => (lastPointer = { x: 0, y: 0, type: 'none' }));

  function updateHover() {
    if (!sceneActive() || rig.dragging || lastPointer.type === 'touch' || lastPointer.type === 'none') {
      if (hovered) setHovered(null);
      ringMat.opacity = THREE.MathUtils.lerp(ringMat.opacity, 0, 0.2);
      return;
    }
    const p = pick(lastPointer.x, lastPointer.y);
    if (p?.type === 'object') {
      setHovered(p.it);
      ui.showTooltip(lastPointer.x, lastPointer.y, p.it.name, p.it.self ? 'You' : 'Inspect');
      ringMat.opacity = THREE.MathUtils.lerp(ringMat.opacity, 0, 0.3);
    } else {
      setHovered(null);
      if (p?.type === 'ground' && !collide(p.point.x, p.point.z)) {
        cursorRing.position.set(p.point.x, gh(p.point.x, p.point.z) + 0.13, p.point.z);
        ringMat.opacity = THREE.MathUtils.lerp(ringMat.opacity, 0.5, 0.25);
        canvas.style.cursor = 'pointer';
      } else {
        ringMat.opacity = THREE.MathUtils.lerp(ringMat.opacity, 0, 0.3);
        canvas.style.cursor = 'default';
      }
    }
  }

  function setHovered(it) {
    if (hovered === it) return;
    hovered = it;
    post.outline.selectedObjects = it ? [it.object] : [];
    post.outline.enabled = !!it; // the outline pass re-renders the scene: only run it when needed
    canvas.style.cursor = it ? 'pointer' : 'default';
    if (!it) ui.hideTooltip();
    else audio.uiHover();
  }

  canvas.addEventListener('pointerup', (e) => {
    if (!sceneActive() || rig.dragMoved > 6 || e.button !== 0) return;
    const p = pick(e.clientX, e.clientY);
    if (!p) return;
    if (p.type === 'object') {
      const it = p.it;
      if (it.self) {
        audio.page();
        ui.showNote(it.name, it.lore);
        return;
      }
      const go = () => {
        const op = new THREE.Vector3();
        it.object.getWorldPosition(op);
        const face = Math.atan2(op.x - detective.root.position.x, op.z - detective.root.position.z);
        detective.faceAfter = face;
        audio.page();
        ui.showNote(it.name, it.lore, it.chapter);
        if (it.raven) {
          audio.caw();
          it.raven.hop = 1;
        }
      };
      const [ax, az] = [it.anchor.x, it.anchor.y];
      if (Math.hypot(ax - detective.root.position.x, az - detective.root.position.z) < 0.3) go();
      else walk(ax, az, go);
      flashRing(ax, az);
    } else if (p.type === 'ground') {
      if (collide(p.point.x, p.point.z)) return;
      ui.hideNote();
      if (state === 'title') enterExplore();
      walk(p.point.x, p.point.z);
      flashRing(p.point.x, p.point.z);
    }
  });

  function flashRing(x, z) {
    clickRing.position.set(x, gh(x, z) + 0.13, z);
    clickRing.userData.t = 0;
  }

  /* ---------------- Lightning ---------------- */
  let nextFlash = 9 + Math.random() * 10;
  let flashT = -1;
  let flashStrength = 1;
  function flashCurve(t) {
    // two quick strikes and a long fade
    if (t < 0.06) return t / 0.06;
    if (t < 0.12) return 1 - (t - 0.06) / 0.06 * 0.85;
    if (t < 0.2) return 0.15 + (t - 0.12) / 0.08 * 0.85;
    return Math.max(0, Math.exp(-(t - 0.2) * 5));
  }

  /* ---------------- Story beats ---------------- */
  const narrow = () => innerWidth <= 760;
  const Z = (dist) => rig.BASE / dist; // camera distance -> rig zoom
  const V2 = (x, y) => new THREE.Vector2(x, y);
  // Menu: a wide establishing shot, the village against the hills, forest and fog
  const titleOffset = () => (narrow() ? V2(0, 0.26) : V2(innerWidth / innerHeight > 1.5 ? 0.15 : 0.1, -0.06));
  const POSE_TITLE = () => ({
    yaw: deg(40),
    pitch: deg(12.5),
    zoom: Z(narrow() ? 70 : innerWidth / innerHeight > 1.5 ? 42 : 50),
    target: new THREE.Vector3(-2, 5.2, -5),
    offset: titleOffset(),
  });
  // Exploring: over the shoulder at a comfortable height, free to orbit
  const POSE_EXPLORE = () => {
    const d = detective.root.position;
    return { pitch: deg(28), zoom: Z(narrow() ? 19 : 15), target: new THREE.Vector3(d.x, gh(d.x, d.z) + 1.2, d.z), offset: V2(0, 0) };
  };
  // opening shot: a little higher and wider than the menu pose, then it settles in
  const POSE_REVEAL = () => {
    const p = POSE_TITLE();
    return { ...p, yaw: p.yaw - deg(14), pitch: p.pitch + deg(7), zoom: p.zoom * 0.7 };
  };
  rig.snap(POSE_REVEAL());

  addEventListener('resize', () => {
    if (state === 'explore') rig.goal.zoom = POSE_EXPLORE().zoom;
    else if (state === 'title') {
      const p = POSE_TITLE();
      rig.goalOffset.copy(p.offset);
      rig.goal.zoom = p.zoom;
    }
  });
  const scrimTitle = document.getElementById('scrim-title');

  // the game opens straight on the menu: the camera drifts into the establishing shot
  function reveal() {
    rig.moveTo(POSE_TITLE(), 3.6, () => {
      if (state === 'intro') state = 'title';
      rig.interactive = true;
    });
    setTimeout(() => {
      if (state !== 'intro' && state !== 'title') return;
      ui.showTitle();
      scrimTitle.classList.add('is-on');
    }, 900);
  }

  // browsers only allow sound after a gesture: start it on the first click or key
  function unlockAudio() {
    if (audio.started) return;
    audio.start();
    audio.setMuted(settings.muted);
    applyRain();
    setTimeout(() => !document.hidden && audio.bell(0.12), 700);
  }
  addEventListener('pointerdown', unlockAudio, { once: true });
  addEventListener('keydown', unlockAudio, { once: true });

  /* ---------------- Camera vs. buildings ---------------- */
  // While exploring, pull the camera in front of any house between it and the detective.
  const occRay = new THREE.Ray();
  const occHit = new THREE.Vector3();
  let clearDist = Infinity;
  function keepCameraClear(dt) {
    const from = rig.target, to = camera.position;
    const full = from.distanceTo(to);
    occRay.origin.copy(from);
    occRay.direction.copy(to).sub(from).normalize();
    let near = full;
    for (const b of village.occluderBoxes) {
      if (b.containsPoint(from)) continue;
      if (occRay.intersectBox(b, occHit)) near = Math.min(near, from.distanceTo(occHit) - 0.5);
    }
    near = Math.max(near, 2.5);
    // snap in fast, ease back out slowly so the view never pops
    clearDist = near < clearDist ? near : THREE.MathUtils.lerp(clearDist, near, 1 - Math.exp(-1.5 * dt));
    if (clearDist < full - 0.01) {
      camera.position.copy(from).addScaledVector(occRay.direction, clearDist);
      camera.lookAt(from);
    }
  }

  /* ---------------- Explore mode ---------------- */
  const hintExplore = document.getElementById('hint-explore');
  function enterExplore() {
    if (state !== 'title') return;
    state = 'explore';
    ui.hideTitle();
    ui.hideTooltip();
    scrimTitle.classList.remove('is-on');
    hintExplore.hidden = false;
    ui.showCaseHud(activeCase);
    rig.orbitFree = true;
    rig.userZoom = 1;
    rig.moveTo(POSE_EXPLORE(), 1.8);
    audio.uiSelect();
  }
  function leaveExplore() {
    if (state !== 'explore') return;
    state = 'title';
    detective.steer = null;
    hintExplore.hidden = true;
    ui.showCaseHud(null);
    rig.orbitFree = false;
    rig.userYaw = 0;
    rig.userPitch = 0;
    rig.userZoom = 1;
    rig.moveTo(POSE_TITLE(), 2.4);
    setTimeout(() => {
      if (state !== 'title') return;
      ui.restoreTitle();
      scrimTitle.classList.add('is-on');
    }, 900);
  }
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' && state === 'explore') return leaveExplore();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      // arrow keys still drive the menu while it is open
      if (state === 'title' && k.startsWith('arrow')) return;
      keys.add(k);
      if (state === 'title' && 'wasd'.includes(k) && ui.panel.hidden) enterExplore();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  const steerVec = new THREE.Vector2();
  function readSteer() {
    if (state !== 'explore') return null;
    const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const r = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    if (!f && !r) return null;
    // relative to where the camera looks
    const fx = -Math.sin(rig.yaw), fz = -Math.cos(rig.yaw);
    steerVec.set(fx * f - fz * r, fz * f + fx * r).normalize();
    return steerVec;
  }

  /* ---------------- Cases ---------------- */
  // where each case opens: the detective's mark and the establishing shot
  const CASE_SPOTS = {
    P: { walk: [1.6, 2.6], face: deg(40), cam: { yaw: deg(28), pitch: deg(13), dist: 13, target: [0.6, 1.8, 1.2] } },
    I: { walk: [-1.9, 4.2], face: deg(-90), cam: { yaw: deg(64), pitch: deg(12), dist: 9.5, target: [-3.6, 2.0, 4.8] } },
  };
  let activeCase = null;

  /* ---------------- Crime-scene rooms ---------------- */
  const ROOM_CASES = { I: CASE_I };
  let roomReady = null;
  let roomFor = null; // which case the built room belongs to
  let assetsReady = null;
  let fadeVal = 1, fadeGoal = 1;
  const fadeTo = (v, ms = 600) => new Promise((r) => { fadeGoal = v; setTimeout(r, ms); });

  function prepareRoom(id) {
    if (roomReady && roomFor === id) return roomReady;
    // a different case: drop the old room, keep the loaded characters
    if (room) room.dispose();
    room = null;
    roomFor = id;
    assetsReady ||= Promise.all([gltfLoader().loadAsync('/assets/characters.glb'), gltfLoader().loadAsync('/assets/detective.glb')]);
    roomReady = assetsReady.then(([chars, det]) => {
      room = new RoomGame({
        renderer, canvas, kit, charGltf: chars, detGltf: det, environment: scene.environment, audio, ui, store,
        quality: () => TIERS[settings.quality],
        onExit: (res) => leaveRoom(res),
      });
      room.build(ROOM_CASES[id]);
      roomFor = id;
      room.resize(innerWidth, innerHeight);
      return room;
    });
    return roomReady;
  }

  async function enterRoom(id) {
    state = 'cinematic';
    await fadeTo(0, 700);
    const r = await prepareRoom(id);
    letterboxGoal = 0;
    letterbox = 0;
    ui.showCaseHud(null);
    hintExplore.hidden = true;
    r.enter();
    state = 'room';
    await fadeTo(1, 900);
  }

  async function leaveRoom({ solved }) {
    if (solved) {
      const list = store.get('solved', []);
      if (!list.includes(room.caseData.id)) list.push(room.caseData.id);
      store.set('solved', list);
    }
    await fadeTo(0, 700);
    room.exit();
    state = 'title';
    rig.snap(POSE_TITLE());
    rig.interactive = true;
    rig.orbitFree = false;
    ui.restoreTitle();
    scrimTitle.classList.add('is-on');
    await fadeTo(1, 900);
  }

  function startCase(id) {
    const c = CASES.find((x) => x.id === id);
    const spot = CASE_SPOTS[id];
    if (!c || !c.open && !store.get('solved', []).includes(CASES[CASES.indexOf(c) - 1]?.id)) return;
    if (!spot || !ROOM_CASES[id]) {
      ui.toast(`${c.label} is still being written`);
      return;
    }
    prepareRoom(id); // load suspects while the camera moves in
    if (state === 'explore') leaveExplore();
    if (state !== 'title' && state !== 'intro') return;
    state = 'cinematic';
    rig.interactive = false;
    ui.hideTitle();
    scrimTitle.classList.remove('is-on');
    ui.hideNote();
    ui.hideTooltip();
    ui.showCaseHud(null);
    setHovered(null);
    unlockAudio();
    audio.swell();
    store.set('save', { case: id, at: Date.now() });
    walk(spot.walk[0], spot.walk[1], null, spot.face);
    const [tx, ty, tz] = spot.cam.target;
    rig.moveTo({ yaw: spot.cam.yaw, pitch: spot.cam.pitch, zoom: Z(spot.cam.dist), target: new THREE.Vector3(tx, ty, tz), offset: V2(0, -0.04) }, 3.4);
    letterboxGoal = 0.085;
    setTimeout(() => {
      if (ROOM_CASES[id].letter) {
        // the case opens with the letter that calls the detective in
        audio.page?.();
        ui.showLetter(ROOM_CASES[id], () => {
          audio.uiSelect();
          activeCase = c;
          enterRoom(id);
        });
        return;
      }
      ui.showCard(
        { num: c.label, title: c.name, text: c.intro, meta: `Your lead: ${c.objective}` },
        () => {
          // through the door: the case is played inside the room
          audio.uiSelect();
          activeCase = c;
          enterRoom(id);
        },
        'Begin the investigation'
      );
    }, 2400);
  }

  /* ---------------- Loop ---------------- */
  let letterbox = 0;
  let letterboxGoal = 0;
  const timer = new THREE.Timer();
  timer.connect?.(document); // pauses delta while the tab is hidden
  let t = 0;
  let fpsAcc = 0, fpsFrames = 0, slowStreak = 0, frameNo = 0;
  const mat = paletteMaterial();
  const lampTmp = new THREE.Vector3();

  function tick(ts, forcedDt) {
    timer.update(ts);
    const dt = forcedDt ?? Math.min(timer.getDelta(), 0.05);
    t += dt;
    fadeVal = THREE.MathUtils.lerp(fadeVal, fadeGoal, 1 - Math.exp(-7 * dt));
    post.grade.uniforms.uFade.value = fadeVal;

    if (state === 'room' && room) {
      // inside a crime scene the village sleeps; only the room is simulated and drawn
      room.update(dt);
      room.post.grade.uniforms.uFade.value = fadeVal;
      room.render(dt);
      if (forcedDt === undefined) requestAnimationFrame(tick);
      return;
    }

    if (state === 'title' && !rig.script) rig.goal.yaw = deg(40) + Math.sin(t * 0.035) * deg(6);
    detective.steer = readSteer();
    detective.running = keys.has('shift');
    detective.update(dt, collide);
    {
      const dp = detective.root.position;
      dp.y = gh(dp.x, dp.z) + 0.06;
      if (state === 'explore' && !rig.script) rig.goalTarget.set(dp.x, dp.y + 1.15, dp.z);
    }
    rig.update(dt, gh);
    if (state === 'explore') keepCameraClear(dt);
    sky.update(camera, t);
    // the moon's shadow frustum travels with whatever the camera looks at
    moon.target.position.set(Math.round(rig.target.x), 0, Math.round(rig.target.z));
    moon.position.copy(moon.target.position).add(MOON_OFFSET);
    for (const r of village.ravens) r.update(dt);

    // atmosphere
    fogUniforms.uFogTime.value = t;
    rain.update(t);
    rain.uniforms.uCenter.value.set(rig.target.x, rig.target.y, rig.target.z);
    // wide shots see a lot more rain between camera and subject: thin it out
    rain.uniforms.uOpacity.value = (0.18 + settings.rain * 0.14) * THREE.MathUtils.clamp(17 / rig.dist, 0.4, 1);
    ripples.update(t);
    smoke.update(t, renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5]);

    // signs swing in the wind
    village.signs.forEach((s, i) => (s.rotation.z = Math.sin(t * 1.4 + i * 1.7) * 0.07 + Math.sin(t * 3.1 + i) * 0.02));

    // practical lights flicker; one lamp is failing
    for (const l of pointLights) {
      const u = l.userData;
      let k = 1 + Math.sin(t * 9 + u.seed) * 0.03 + Math.sin(t * 23 + u.seed * 2) * 0.02;
      if (u.broken) {
        const n = Math.sin(t * 3.1 + u.seed) + Math.sin(t * 7.7) * 0.6;
        k = n > 0.9 ? 0.08 : n > 0.7 ? 0.5 + Math.random() * 0.5 : 0.95;
      }
      l.intensity = u.base * k;
    }
    mat.emissiveIntensity = 2.4 + Math.sin(t * 6.3) * 0.08 + Math.sin(t * 17.1) * 0.05;

    // lightning
    let flash = 0;
    if (t > 5) {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flashT = 0;
        flashStrength = 0.6 + Math.random() * 0.6;
        nextFlash = 14 + Math.random() * 20;
        const delay = 500 + Math.random() * 1700;
        setTimeout(() => audio.thunder(flashStrength * (1.1 - delay / 2600)), delay);
      }
    }
    if (flashT >= 0) {
      flashT += dt;
      flash = flashCurve(flashT) * flashStrength;
      if (flashT > 1.4) flashT = -1;
    }
    moon.intensity = 2.1 + flash * 7;
    hemi.intensity = 1.05 + flash * 1.6;
    post.grade.uniforms.uFlash.value = flash;
    sky.uniforms.uFlash.value = flash;
    rain.uniforms.uFlash.value = flash;
    ripples.uniforms.uFlash.value = flash;

    // cinematic bars
    letterbox = THREE.MathUtils.lerp(letterbox, letterboxGoal, 1 - Math.exp(-3 * dt));
    post.grade.uniforms.uLetterbox.value = letterbox;
    post.grade.uniforms.uTime.value = t;

    // click marker
    if (clickRing.userData.t < 1) {
      clickRing.userData.t = Math.min(1, clickRing.userData.t + dt * 1.6);
      const k = clickRing.userData.t;
      clickRing.scale.setScalar(1 + k * 1.6);
      clickRing.material.opacity = (1 - k) * 0.8;
    }

    // hover picking raycasts large meshes: every third frame is plenty
    if (state === 'title' || state === 'explore') {
      if (frameNo % 3 === 0) updateHover();
    }
    else if (hovered) setHovered(null);

    if (frameNo % 2 === 0) renderer.shadowMap.needsUpdate = true;
    frameNo++;
    post.composer.render(dt);

    // frame-rate watchdog: step quality down if the device struggles
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 2) {
      const fps = Math.round(fpsFrames / fpsAcc);
      ui.setFps(fps);
      if ((state === 'title' || state === 'explore') && fps < 34 && settings.quality !== 'low') {
        slowStreak++;
        if (slowStreak >= 2) {
          settings.quality = settings.quality === 'high' ? 'medium' : 'low';
          applyQuality();
          save();
          ui.toast(`Graphics set to ${settings.quality} for smoother play`);
          slowStreak = 0;
        }
      } else slowStreak = 0;
      fpsAcc = 0;
      fpsFrames = 0;
    }
    if (forcedDt === undefined) requestAnimationFrame(tick);
  }

  progress(0.9, 'Waking the village');
  // compile shaders up front so the first frames don't hitch
  renderer.compile(scene, camera);
  await frame();
  progress(1, 'Ready');
  requestAnimationFrame(tick);

  setTimeout(() => {
    document.getElementById('loader').classList.add('is-done');
    reveal();
    setTimeout(() => document.getElementById('loader').remove(), 1300);
  }, 350);

  // debug hook for automated checks
  const previewScene = async (sceneDef) => {
    ROOM_CASES.preview = { ...CASE_I, id: 'preview', scene: sceneDef };
    roomFor = null; // always rebuild: each preview is a different scene
    ui.hideTitle();
    scrimTitle.classList.remove('is-on');
    await enterRoom('preview');
  };
  window.__hollowmere = { scene, camera, rig, detective, village, renderer, post, enter: () => {}, settings, enterExplore, leaveExplore, startCase, previewScene, get room() { return room; }, get state() { return state; },
    // advance the simulation by hand (for automated checks while the tab is hidden)
    step: (frames = 1, dt = 1 / 60) => { for (let i = 0; i < frames; i++) tick(performance.now(), dt); } };
}

boot().catch((err) => {
  console.error(err);
  loaderText.textContent = 'This browser could not start WebGL. Try a recent Chrome, Edge, Firefox or Safari.';
});

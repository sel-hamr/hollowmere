import * as THREE from 'three';
import { Builder, sphere, reseed, range, rand } from '../core/geo.js';
import { buildTerrain, buildWilds, setFlatZones, groundHeight, WALK } from './terrain.js';
import { house, chapel } from './buildings.js';
import {
  lampPost, well, bareTree, pine, fence, stoneWall, crate, barrel, cart,
  noticeBoard, gravestone, signpost, bench, rock,
} from './props.js';
import { Raven } from './detective.js';
import { kitHouse, kitChapel } from './kitHouse.js';
import { K, bake } from './kit.js';
import { Builder as B2, cyl, rbox } from '../core/geo.js';

/**
 * Hollowmere, prologue: the village square on a winter night.
 * Layout reads front (+x,+z, low props) to back (-x,-z, chapel tower),
 * so the orthographic camera at 45° sees every facade.
 */
export function buildVillage(kit = null) {
  reseed(20251123);
  const root = new THREE.Group();
  root.name = 'village';

  // houses beyond the square, along the four roads: [x, z, rotY, kit spec, meta]
  const OUTSKIRTS = [
    [19.5, -5.6, 0, { w: 2, d: 2, floors: 2, ground: 'brick', upper: 'plaster', front: ['door', 'window'], shutters: 'closed', chimney: 'left' }],
    [26.5, -6.3, 0, { w: 3, d: 3, floors: 2, ground: 'plaster', upper: 'grid', boarded: true, front: ['window', 'door', 'window'], chimney: 'right', vines: true }],
    [21.0, 6.0, Math.PI, { w: 2, d: 3, floors: 1, ground: 'plaster', front: ['window', 'door'], ajar: true, chimney: 'right' }],
    [31.0, 5.8, Math.PI, { w: 2, d: 2, floors: 2, ground: 'brick', upper: 'plaster', front: ['door', 'thin'], front2: ['thin', 'window'], chimney: 'left' }],
    [-19.5, 5.8, Math.PI, { w: 2, d: 2, floors: 2, ground: 'brick', upper: 'grid', front: ['window', 'door'], lit: new Set(['1:1']), chimney: 'right' },
      { name: 'A Light in the West House', lore: 'One window still burns at the edge of the village. The curtain moved as you looked up, and the snow on the step has not been touched.', anchor: [-19.5, 2.6] }],
    [-26.0, -6.2, 0, { w: 3, d: 3, floors: 2, ground: 'brick', upper: 'plaster', boarded: true, front: ['doorRound', 'window', 'window'], chimney: 'left' }],
    [-33.0, 5.8, Math.PI, { w: 2, d: 2, floors: 1, ground: 'plaster', front: ['door', 'window'], shutters: 'closed', chimney: 'right' }],
    [5.8, -19.5, -Math.PI / 2, { w: 2, d: 2, floors: 2, ground: 'plaster', upper: 'plaster', front: ['door', 'window'], chimney: 'right', vines: true }],
    [-6.0, -24.0, Math.PI / 2, { w: 2, d: 3, floors: 2, ground: 'brick', upper: 'grid', boarded: true, front: ['door', 'window'], chimney: 'left' }],
    [6.2, -29.5, -Math.PI / 2, { w: 3, d: 3, floors: 2, ground: 'brick', upper: 'plaster', front: ['window', 'doorRound', 'window'], shutters: 'closed', chimney: 'right' }],
    [5.8, 20.0, -Math.PI / 2, { w: 2, d: 2, floors: 2, ground: 'plaster', upper: 'grid', front: ['door', 'window'], chimney: 'left' }],
    [-6.0, 26.0, Math.PI / 2, { w: 2, d: 3, floors: 2, ground: 'brick', upper: 'plaster', front: ['window', 'door'], shutters: 'closed', chimney: 'right' }],
    [6.0, 33.5, -Math.PI / 2, { w: 2, d: 2, floors: 1, ground: 'plaster', front: ['door', 'window'], ajar: true, chimney: 'left' }],
  ];
  if (kit) setFlatZones(OUTSKIRTS.map(([x, z, , k]) => ({ x, z, r: Math.max(k.w, k.d) * 0.68 + 1.4 })));
  else setFlatZones([]);
  const terrain = buildTerrain();
  root.add(terrain.group);

  const obstacles = [];
  const occluders = []; // building groups the explore camera must not hide behind
  const interactables = [];
  const lamps = [];
  const chimneys = [];
  const signs = [];
  const ravens = [];

  const addBox = (x, z, w, d) => obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  function place(obj, x, z, rotY = 0, y = 0) {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    root.add(obj);
    obj.updateMatrixWorld(true);
    return obj;
  }

  function interact(object, name, lore, anchor, extra = {}) {
    interactables.push({ object, name, lore, anchor: new THREE.Vector2(anchor[0], anchor[1]), ...extra });
  }

  function addHouse(opts, x, z, rotY, meta, kspec) {
    const useKit = kit && kspec;
    const h = useKit ? kitHouse(kit, kspec) : house(opts);
    if (useKit && kspec.at) [x, z] = kspec.at;
    place(h.group, x, z, rotY);
    occluders.push(h.group);
    const quarter = Math.round(rotY / (Math.PI / 2)) % 2 !== 0;
    const fw = quarter ? h.footprint.d : h.footprint.w;
    const fd = quarter ? h.footprint.w : h.footprint.d;
    addBox(x, z, fw, fd);
    if (h.chimneyTop) chimneys.push({ pos: h.group.localToWorld(h.chimneyTop.clone()), active: !!(opts.smoke || kspec?.smoke) });
    if (h.sign) signs.push(h.sign);
    // snow drifts banked against the walls
    const drift = new Builder();
    for (let i = 0; i < 6; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const hw = useKit ? h.footprint.w / 2 - 0.25 : (opts.w ?? 4) / 2 + 0.1;
      drift.add(sphere(range(0.35, 0.65), 8, 5), 'snow', [side * hw, 0.02, range(-1.2, 1.2)], [0, 0, 0], [0.7, range(0.35, 0.55), 1.3]);
    }
    const dm = drift.build({ name: 'drift', cast: false });
    h.group.add(dm);
    if (meta) interact(h.group, meta.name, meta.lore, meta.anchor, { chapter: meta.chapter });
    return h;
  }

  /* ---------------- Chapel (back corner) ---------------- */
  let ch;
  if (kit) {
    ch = kitChapel(kit);
    place(ch.group, -9.4, -9.8, 0);
    addBox(-9.4, -9.8 + ch.nave.z, ch.nave.w, ch.nave.d);
    addBox(-9.4, -9.8 + ch.tower.z, ch.tower.w, ch.tower.d);
    for (const [i, cp] of ch.clock.entries()) {
      const face = clockFace();
      face.position.copy(cp);
      face.rotation.y = i === 0 ? 0 : Math.PI / 2;
      ch.group.add(face);
    }
    ch.group.updateMatrixWorld(true);
  } else {
    ch = chapel();
    place(ch.group, -9.4, -10.4, 0);
    addBox(-9.4, -10.4 + ch.footprintNave.z, ch.footprintNave.w, ch.footprintNave.d);
    addBox(-9.4, -10.4 + ch.footprintTower.z, ch.footprintTower.w, ch.footprintTower.d);
  }
  occluders.push(ch.group);
  interact(ch.group, 'Chapel of St. Aldric', 'The clock stopped at 3:13. The bell still rings every night, and nobody can say who pulls the rope.', [-9.4, -3.2], { chapter: 'III' });
  const bellWorld = ch.group.localToWorld(ch.bellPos.clone());

  // churchyard in front of the nave
  const graves = new Builder();
  [[-11.6, -3.4, 0], [-10.6, -2.6, 1], [-12.4, -2.4, 0], [-11.4, -1.9, 0]].forEach(([x, z, k], i) => {
    graves.addBuilder(gravestone(k), [x, 0, z], [0, range(-0.3, 0.3) + Math.PI / 2 * 0.15, 0]);
  });
  const gravesMesh = graves.build({ name: 'graves' });
  root.add(gravesMesh);
  addBox(-11.6, -2.7, 2.6, 2.2);
  interact(gravesMesh, 'Churchyard', 'The newest stone has no name on it, and the earth in front of it was turned this week.', [-9.6, -2.0]);
  const gw = stoneWall(3.6);
  place(gw, -11.4, -1.1, 0);
  addBox(-11.4, -1.1, 3.8, 0.6);

  /* ---------------- Back quadrant: the inn ---------------- */
  addHouse({
    w: 4.4, d: 3.4, h1: 2.1, h2: 1.8, rise: 2.2, wall: 'plaster', wall2: 'plasterShade', roof: 'slate',
    door: { x: -1.0, lamp: true },
    windows1: [{ x: 0.7, shutters: true }, { x: 1.6, lit: false, box: true }],
    windows2: [{ x: -1.3 }, { x: 0.1, lit: true }, { x: 1.4, shutters: true, askew: true }],
    sideWindows: [{ z: 0, floor: 2 }],
    chimney: { x: -1.4, z: -0.5 }, attic: 'dark',
    sign: { x: 1.9, icon: 'cup', color: 'clothRed' },
  }, -4.6, -6.7, 0, {
    name: 'The Drowned Lantern Inn',
    lore: 'Thirteen mugs stand on the bar, every one of them half full. The fire was banked for the night.',
    anchor: [-4.4, -3.6],
  }, { w: 3, d: 3, floors: 2, ground: 'brick', upper: 'plaster', front: ['window', 'doorRound', 'window'], front2: ['window', 'thin', 'window'], lit: new Set(['1:1', '0:0']), chimney: 'left', at: [-4.4, -7.1] });

  /* ---------------- Right quadrant: bakery + cottages ---------------- */
  addHouse({
    w: 4.6, d: 3.6, h1: 2.2, h2: 1.7, rise: 2.0, wall: 'plasterOchre', wall2: 'plaster', roof: 'roofRed',
    door: { x: -1.3 }, shopFront: 'lit',
    windows2: [{ x: -1.4, shutters: true }, { x: 0.2 }, { x: 1.6, dim: true }],
    sideWindows: [{ z: 0.4, floor: 1, lit: true }],
    chimney: { x: 1.4, z: -0.6 }, smoke: true, attic: 'dark',
    sign: { x: -2.3, icon: 'bread' },
  }, 5.1, -5.5, 0, {
    name: 'Marrow & Daughter, Bakers',
    lore: 'Smoke still rises from the oven chimney. The loaves on the rack are warm, and the shop has been empty for three weeks.',
    anchor: [4.0, -2.4], chapter: 'II',
  }, { w: 3, d: 3, floors: 2, ground: 'plaster', upper: 'grid', front: ['door', 'window', 'window'], front2: ['window', 'wall', 'window'], lit: new Set(['0:1', '0:2', '0:s0', '1:2']), chimney: 'right', smoke: true, vines: true, at: [5.2, -6.1] });

  addHouse({
    w: 3.2, d: 3.0, h1: 2.0, h2: 0, rise: 1.9, wall: 'plasterBlue', roof: 'slate', gableFront: true,
    door: { x: 0.6, ajar: true },
    windows1: [{ x: -0.7, boarded: true }],
    sideWindows: [{ z: -0.3, floor: 1, shutters: true, askew: true }],
    chimney: { x: -0.9, z: -0.6 },
  }, 10.6, -5.2, 0, {
    name: 'The Cooper\'s Cottage',
    lore: 'The door was left open. Inside, a table is set for two, and the chairs have been pushed back as if someone stood up quickly.',
    anchor: [11.0, -2.6],
  }, { w: 2, d: 2, floors: 1, ground: 'plaster', front: ['window', 'door'], ajar: true, shutters: 'closed', chimney: 'left', at: [10.5, -5.5] });

  addHouse({
    w: 4.2, d: 3.4, h1: 2.3, h2: 2.0, rise: 2.6, wall: 'stone', wall2: 'plasterShade', roof: 'slateDark',
    gableFront: true, door: { x: 1.0 },
    windows1: [{ x: -0.8, boarded: true }],
    windows2: [{ x: -1.0, boarded: true }, { x: 1.0 }],
    sideWindows: [{ z: 0.2, floor: 2, boarded: true }],
    chimney: { x: 1.0, z: -0.8 },
  }, 6.8, -11.2, 0, null, { w: 2, d: 3, floors: 2, ground: 'brick', upper: 'plaster', boarded: true, front: ['door', 'window'], front2: ['window', 'window'], chimney: 'right', at: [6.6, -11.3] });

  /* ---------------- Left quadrant: lamplighter's shop ---------------- */
  addHouse({
    w: 4.2, d: 3.6, h1: 2.2, h2: 1.8, rise: 2.3, wall: 'plaster', wall2: 'plaster', roof: 'slate',
    door: { x: -1.2, lamp: true }, shopFront: 'dim',
    windows2: [{ x: -1.3, lit: true, shutters: true }, { x: 0.3 }, { x: 1.5, dim: true, box: true }],
    sideWindows: [{ z: 0.5, floor: 2, lit: true }],
    chimney: { x: -1.2, z: -0.7 }, smoke: true, attic: 'lit',
    sign: { x: 2.2, icon: 'lamp' },
  }, -5.4, 5.1, Math.PI / 2, {
    name: 'The Lamplighter\'s Shop',
    lore: 'Every lamp in Hollowmere is still burning, and the lamplighter vanished with everyone else. Someone has been refilling the oil.',
    anchor: [-2.2, 4.4], chapter: 'I',
  }, { w: 3, d: 3, floors: 2, ground: 'plaster', upper: 'plaster', front: ['window', 'door', 'window'], front2: ['window', 'window', 'thin'], lit: new Set(['0:0', '1:0', '1:2', '1:s1']), balcony: 1, chimney: 'left', smoke: true, at: [-5.3, 5.2] });

  addHouse({
    w: 3.2, d: 3.2, h1: 2.0, h2: 1.4, rise: 1.9, wall: 'plasterShade', wall2: 'plaster', roof: 'roofRed', gableFront: true,
    door: { x: -0.6 },
    windows1: [{ x: 0.7, shutters: true, box: true }],
    windows2: [{ x: 0, dim: false }],
    chimney: { x: 0.8, z: -0.5 }, attic: 'dark',
  }, -5.6, 10.8, Math.PI / 2, null, { w: 2, d: 2, floors: 2, ground: 'brick', upper: 'grid', front: ['door', 'thin'], front2: ['thin', 'window'], chimney: 'right', vines: true, at: [-5.5, 10.8] });

  addHouse({
    w: 5.0, d: 3.6, h1: 2.4, h2: 2.1, rise: 2.8, wall: 'stone', wall2: 'plasterShade', roof: 'slateDark',
    door: { x: 1.6, ajar: true },
    windows1: [{ x: -1.2, boarded: true }, { x: 0.1, boarded: true }],
    windows2: [{ x: -1.6, boarded: true }, { x: 0, shutters: true, askew: true }, { x: 1.6 }],
    chimney: { x: 1.6, z: -0.6 }, attic: 'dark',
  }, -10.8, 6.4, Math.PI / 2, null, { w: 2, d: 3, floors: 2, ground: 'brick', upper: 'plaster', boarded: true, ajar: true, front: ['doorRound', 'window'], chimney: 'left', at: [-10.7, 6.6] });

  /* ---------------- The square ---------------- */
  const w = well();
  place(w, 0, 0, Math.PI / 4);
  addBox(0, 0, 2.4, 2.4);
  interact(w, 'The Village Well', 'The bucket is wet and the rope is still swinging. Somebody drew water tonight.', [1.6, 1.6]);

  const lampSpots = [[3.1, 3.1, false], [-3.1, 3.1, false], [3.1, -3.1, false], [-3.1, -3.1, true], [9.6, 2.0, false], [2.0, 9.6, false]];
  for (const [x, z, broken] of lampSpots) {
    const L = lampPost({ broken });
    place(L.mesh, x, z, rand() * Math.PI);
    addBox(x, z, 0.5, 0.5);
    lamps.push({ pos: new THREE.Vector3(x, L.lightPos.y, z), broken });
  }

  const nb = noticeBoard();
  place(nb, 4.6, 5.0, Math.PI / 4);
  addBox(4.6, 5.0, 1.4, 1.4);
  interact(nb, 'Notice Board', 'Two hundred and twelve "missing" notices. Every face has been crossed out in red ink, all by the same hand.', [3.5, 6.2]);

  const bn = bench();
  place(bn, 6.4, -2.35, 0);
  addBox(6.4, -2.35, 1.8, 0.7);
  interact(bn, 'A Bench', 'A cat\'s bowl, still full. There are no paw prints in the snow, and none leading away.', [6.4, -0.9]);

  /* ---------------- Front quadrant ---------------- */
  let ct;
  if (kit) {
    const wg = new THREE.Group();
    kit.place(wg, 'Prop_Wagon', 0, 0, 1.2, 0);
    kit.place(wg, 'Prop_Crate', 0.2, 0.62, 0.4, 0.3, { scale: 0.55 });
    ct = bake(wg);
    ct.scale.setScalar(K);
    const holder = new THREE.Group();
    holder.add(ct);
    ct = holder;
  } else ct = cart();
  place(ct, 8.2, 6.6, 0.55);
  addBox(8.2, 6.4, 3.4, 3.0);
  interact(ct, 'Abandoned Cart', 'Loaded for a long journey that never began. One wheel lies in the snow, and the harness was cut, not unbuckled.', [6.6, 4.6]);

  const pile = new Builder();
  pile.addBuilder(crate(0.62), [5.4, 0, 9.6], [0, 0.3, 0]);
  pile.addBuilder(crate(0.5), [5.5, 0.62, 9.6], [0, 0.9, 0]);
  pile.addBuilder(crate(0.55), [6.2, 0, 10.2], [0, -0.2, 0]);
  pile.addBuilder(barrel(), [4.6, 0, 10.2]);
  pile.addBuilder(barrel(), [4.9, 0, 9.0], [Math.PI / 2, 0.4, 0], [1, 1, 1]);
  pile.addBuilder(barrel(false), [-2.6, 0, -5.0]);
  pile.addBuilder(crate(0.5), [-2.5, 0, -5.8], [0, 0.4, 0]);
  pile.addBuilder(barrel(), [2.6, 0, -4.4]);
  root.add(pile.build({ name: 'crates' }));
  addBox(5.4, 9.7, 2.2, 1.9);
  addBox(-2.5, -5.4, 0.9, 1.6);
  addBox(2.6, -4.4, 0.7, 0.7);

  const sp = signpost();
  place(sp, 2.3, 12.4, -Math.PI / 4);
  addBox(2.3, 12.4, 0.6, 0.6);
  interact(sp, 'Hollowmere, pop. 212', 'Someone has scratched out the number with a knife. Underneath, freshly carved: "0".', [2.0, 11.0]);

  // fences along the front edges
  // kit fences read better next to kit houses; the procedural ones remain as a fallback
  const fenceRun = (len, opts) => {
    if (!kit) return fence(len, opts);
    const g = new THREE.Group();
    const seg = 2.04, n = Math.max(1, Math.round(len / (seg * K)));
    for (let i = 0; i < n; i++) {
      const lean = opts.broken && i === n - 1 ? 0.35 : 0;
      const p = kit.place(g, i % 2 ? 'Prop_WoodenFence_Extension1' : 'Prop_WoodenFence_Single', (i - (n - 1) / 2) * seg, 0, 0, 0);
      p.rotation.z = lean;
    }
    const baked = bake(g);
    baked.scale.setScalar(K);
    const h = new THREE.Group();
    h.add(baked);
    return h;
  };
  const f1 = fenceRun(4.6, {}); place(f1, 6.0, 13.1, 0); addBox(6.0, 13.1, 4.8, 0.4);
  const f2 = fenceRun(3.6, { broken: true }); place(f2, 10.8, 13.1, 0.05); addBox(10.8, 13.1, 3.8, 0.4);
  const f3 = fenceRun(4.6, {}); place(f3, 13.1, 6.4, Math.PI / 2); addBox(13.1, 6.4, 0.4, 4.8);
  const f4 = fenceRun(3.4, { broken: true }); place(f4, 13.1, 11.0, Math.PI / 2 + 0.06); addBox(13.1, 11.0, 0.4, 3.6);
  const f5 = fenceRun(4.0, {}); place(f5, 13.1, -9.0, Math.PI / 2); addBox(13.1, -9.0, 0.4, 4.2);
  if (kit) {
    // a wrought-iron gate in front of the churchyard
    const gate = new THREE.Group();
    kit.place(gate, 'Prop_MetalFence_Ornament', 0, 0, 0, 0, { scale: 0.62 });
    kit.place(gate, 'Prop_MetalFence_Simple', 2.0 * 0.62 * 0.98, 0, 0, 0, { scale: 0.62 });
    const gb = bake(gate);
    gb.scale.setScalar(K);
    const gh = new THREE.Group();
    gh.add(gb);
    place(gh, -12.6, -0.95, 0);
  }

  // stone walls along the back edges
  const w1 = stoneWall(5.0); place(w1, -13.1, 10.6, Math.PI / 2); addBox(-13.1, 10.6, 0.6, 5.2);
  const w2 = stoneWall(4.2); place(w2, 10.0, -13.1, 0); addBox(10.0, -13.1, 4.4, 0.6);
  const w3 = stoneWall(3.0); place(w3, -6.4, -13.1, 0); addBox(-6.4, -13.1, 3.2, 0.6);

  // trees
  const trees = [
    ['bare', 10.8, 10.0, 4.6], ['bare', 3.9, 12.6, 3.6], ['bare', -12.0, 2.6, 4.2], ['bare', 11.8, -1.0 - 1.6, 3.6],
    ['pine', 12.2, 3.2, 4.4], ['pine', -12.4, 12.6, 5.0], ['pine', -2.2, -12.4, 5.4], ['pine', 2.8, -12.6, 4.8],
    ['pine', 11.9, -12.0, 5.2], ['pine', -12.6, -6.6, 5.8], ['pine', -12.4, -13.0, 4.6], ['pine', 12.6, -7.0, 4.0],
    ['pine', -8.8, 12.8, 3.8], ['bare', -1.8, 12.8, 3.4],
  ];
  for (const [kind, x, z, h] of trees) {
    const t = kind === 'pine' ? pine(h) : bareTree(h);
    place(t, x, z, rand() * Math.PI * 2);
    addBox(x, z, 0.7, 0.7);
  }

  /* ---------------- Outskirts ---------------- */
  if (kit) {
    for (const [x, z, rot, spec, meta] of OUTSKIRTS) {
      addHouse({}, x, z, rot, meta || null, spec);
    }
    // dark lamp posts: the further from the square, the fewer that still burn
    for (const [x, z] of [[17, 2.3], [-17, -2.3], [2.3, -17], [-2.3, 17], [28, -2.3], [-28, 2.3], [2.3, 27], [-2.3, -32]]) {
      const L = lampPost({ broken: true });
      L.mesh.position.set(x, groundHeight(x, z), z);
      L.mesh.rotation.y = rand() * Math.PI;
      root.add(L.mesh);
      addBox(x, z, 0.5, 0.5);
    }
    // a second wagon, abandoned on the east road, and yard fences
    const wg2 = new THREE.Group();
    kit.place(wg2, 'Prop_Wagon', 0, 0, 1.2, 0);
    const wb2 = bake(wg2);
    wb2.scale.setScalar(K);
    const wh2 = new THREE.Group();
    wh2.add(wb2);
    place(wh2, 23.5, 2.7, -1.25);
    addBox(23.5, 2.7, 3.2, 1.8);
    for (const [x, z, r, len] of [[19.5, -9.2, 0, 4.2], [26.5, -10.8, 0, 5.4], [-26, -10.7, 0, 5.4], [9.4, -19.5, Math.PI / 2, 4.2], [-9.6, 26, Math.PI / 2, 5.0], [9.2, 20, Math.PI / 2, 4.0]]) {
      const f = fenceRun(len, {});
      place(f, x, z, r);
      const horiz = Math.abs(Math.sin(r)) < 0.5;
      addBox(x, z, horiz ? len + 0.2 : 0.4, horiz ? 0.4 : len + 0.2);
    }
  }

  // the forest ring and hills beyond the houses
  const nearBuilding = (x, z) => {
    for (const o of obstacles) if (x > o.minX - 2.2 && x < o.maxX + 2.2 && z > o.minZ - 2.2 && z < o.maxZ + 2.2) return true;
    return Math.hypot(x, z) < 15;
  };
  root.add(buildWilds(nearBuilding));

  // rocks
  const rocks = new Builder();
  [[12.6, 0.6, 0.5], [9.6, 12.2, 0.4], [-12.8, -0.8, 0.55], [-7.6, 13.0, 0.35], [7.6, 12.6, 0.3], [12.8, -4.6, 0.4], [-0.8, -13.0, 0.4]].forEach(([x, z, r]) => {
    rocks.addBuilder(rock(r), [x, 0, z]);
  });
  root.add(rocks.build({ name: 'rocks' }));

  /* ---------------- Ravens ---------------- */
  const r1 = new Raven();
  r1.root.position.set(0, 3.42, 0);
  r1.root.rotation.y = 0.8;
  r1.baseY = 3.42;
  root.add(r1.root);
  ravens.push(r1);
  interact(r1.root, 'A Raven', 'It has been watching you since you passed the gate, and it has not made a sound.', [1.6, 1.6], { raven: r1 });

  const r2 = new Raven();
  r2.root.position.set(13.1, 1.02, 5.0);
  r2.root.rotation.y = -2.2;
  r2.baseY = 1.02;
  r2.root.scale.setScalar(0.9);
  root.add(r2.root);
  ravens.push(r2);

  return {
    root,
    terrain,
    obstacles,
    interactables,
    lamps,
    chimneys,
    signs,
    ravens,
    bellWorld,
    bounds: WALK,
    occluderBoxes: occluders.map((g) => new THREE.Box3().setFromObject(g).expandByScalar(0.2)),
    groundHeight,
  };
}

/** Stopped clock face (3:13) for the kit chapel tower. */
function clockFace() {
  const b = new B2();
  b.add(cyl(0.5, 0.5, 0.08, 20), 'stoneDark', [0, 0, 0], [Math.PI / 2, 0, 0]);
  b.add(cyl(0.42, 0.42, 0.08, 20), 'clockFace', [0, 0, 0.03], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.add(rbox(0.03, 0.08, 0.02, 0.005), 'iron', [Math.sin(a) * 0.35, Math.cos(a) * 0.35, 0.08], [0, 0, -a]);
  }
  b.add(rbox(0.04, 0.24, 0.02, 0.008), 'iron', [0.12, -0.014, 0.09], [0, 0, -1.684]);
  b.add(rbox(0.03, 0.34, 0.02, 0.008), 'iron', [0.166, 0.035, 0.1], [0, 0, -1.361]);
  return b.build({ name: 'clock', cast: false });
}

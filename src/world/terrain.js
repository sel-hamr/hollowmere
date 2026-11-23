import * as THREE from 'three';
import { Builder, cone, sphere, range, rand } from '../core/geo.js';
import { paletteMaterial, paint, waterMaterial } from '../core/palette.js';
import { weatherize } from './kit.js';
import { pine, bareTree } from './props.js';

/**
 * Open world ground: a flat village core, cobbled roads that run out of the
 * village as sunken lanes, rolling snowy hills, a forest ring and mountains
 * that dissolve into fog at the horizon.
 */

export const WORLD = 130; // half size of the ground plane
export const WALK = 58; // how far the detective may wander
export const HALF = WALK; // kept for older callers
const ROAD = 1.45;
const SQUARE = 4.7;
const COBBLE_END = 36; // cobbles give way to a slush lane beyond this

/* ---------------- noise ---------------- */
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return v;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------------- height field ---------------- */
let flats = []; // [{x, z, r}] pads levelled for buildings

export function setFlatZones(list) {
  flats = list;
}

export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const core = smooth(17, 40, r);
  const lane = smooth(2.4, 9, Math.min(Math.abs(x), Math.abs(z)));
  let pad = 1;
  for (const f of flats) {
    const d = Math.hypot(x - f.x, z - f.z);
    pad = Math.min(pad, smooth(f.r, f.r + 5, d));
  }
  const hills = (fbm(x * 0.022, z * 0.022) - 0.42) * 11 + (fbm(x * 0.07 + 5, z * 0.07 - 3) - 0.5) * 2.2;
  const ridge = smooth(62, 118, r) * (fbm(x * 0.011 + 11, z * 0.011 - 7, 5) * 34 + 4);
  return core * pad * (hills * lane + ridge * Math.max(lane, 0.35));
}

/** Signed "road-ness": > 0 on the cobbles. */
export function roadField(x, z) {
  const wob = (vnoise(x * 0.35, z * 0.35) - 0.5) * 0.7;
  const a = (Math.abs(x) <= COBBLE_END ? ROAD + wob : -9) - Math.abs(z);
  const b = (Math.abs(z) <= COBBLE_END ? ROAD + wob : -9) - Math.abs(x);
  const c = SQUARE + wob - Math.hypot(x, z);
  return Math.max(a, b, c);
}

/** Lanes continue as slush beyond the cobbles. */
function laneField(x, z) {
  const wob = (vnoise(x * 0.2, z * 0.2) - 0.5) * 1.2;
  return Math.max(1.6 + wob - Math.abs(z), 1.6 + wob - Math.abs(x));
}

/* ---------------- ground material ---------------- */
function groundMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#4d4a44', roughness: 0.95, metalness: 0, vertexColors: true });
  return weatherize(m, { key: 'ground' });
}

export function buildTerrain() {
  const group = new THREE.Group();
  group.name = 'terrain';

  /* ---------------- ground mesh ---------------- */
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(WORLD * 2, WORLD * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const earth = new THREE.Color('#4d4a44'), mud = new THREE.Color('#3a3330'), grass = new THREE.Color('#545a45'), slush = new THREE.Color('#7f8792');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = groundHeight(x, z);
    pos.setY(i, y - 0.02);
    // ground tint under the snow: earth, mud along the lanes, dead grass on the hills
    c.copy(earth).lerp(grass, fbm(x * 0.08, z * 0.08) * 0.8);
    const lane = laneField(x, z);
    if (lane > 0) c.lerp(slush, Math.min(1, lane / 1.2));
    if (roadField(x, z) > -0.4) c.lerp(slush, 0.85);
    c.lerp(mud, Math.max(0, fbm(x * 0.21 + 3, z * 0.21) - 0.6) * 1.5);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // flatten normals in the village core so snow settles evenly there
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    if (Math.hypot(x, z) < 16) nrm.setXYZ(i, 0, 1, 0);
  }
  const ground = new THREE.Mesh(geo, groundMaterial());
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  /* ---------------- ground detail ---------------- */
  const detail = new Builder();
  for (let i = 0; i < 520; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 48;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (roadField(x, z) > -0.3 || laneField(x, z) > -0.5) continue;
    const y = groundHeight(x, z);
    const k = rand();
    if (k < 0.45) {
      detail.add(sphere(range(0.4, 1.2), 8, 5), rand() < 0.7 ? 'snow' : 'snowShade', [x, y - 0.08, z], [0, rand() * 3, 0], [1, range(0.16, 0.32), range(0.6, 1)]);
    } else if (k < 0.8) {
      for (let j = 0; j < 4; j++) detail.add(cone(0.04, range(0.2, 0.45), 3), 'grass', [x + range(-0.2, 0.2), y + 0.12, z + range(-0.2, 0.2)], [range(-0.4, 0.4), 0, range(-0.4, 0.4)]);
    } else {
      detail.add(sphere(range(0.35, 0.8), 7, 4), 'mud', [x, y - 0.06, z], [0, rand() * 3, 0], [1, 0.12, range(0.5, 1)]);
    }
  }
  // drifts banked along the road edges
  for (let i = 0; i < 260; i++) {
    const x = range(-COBBLE_END, COBBLE_END), z = range(-COBBLE_END, COBBLE_END);
    const f = roadField(x, z);
    if (f < -0.5 || f > 0.05) continue;
    detail.add(sphere(range(0.3, 0.6), 7, 4), 'snow', [x, groundHeight(x, z) - 0.02, z], [0, rand() * 3, 0], [1.4, 0.32, 0.8]);
  }
  group.add(detail.build({ name: 'ground-detail', cast: false }));

  /* ---------------- cobbles (one instanced draw) ---------------- */
  const stones = [];
  const step = 0.36;
  const lim = COBBLE_END + 1;
  for (let x = -lim; x < lim; x += step) {
    for (let z = -lim; z < lim; z += step) {
      if (Math.abs(x) > 6 && Math.abs(z) > 6) continue; // only the cross of lanes and the square
      const jx = x + range(-0.07, 0.07), jz = z + range(-0.07, 0.07);
      const f = roadField(jx, jz);
      if (f < 0) continue;
      if (f < 0.6 && rand() > f / 0.6) continue;
      if (vnoise(jx * 0.8, jz * 0.8) > 0.82) continue;
      // thin out toward the ends of the cobbled stretch
      const along = Math.max(Math.abs(jx), Math.abs(jz));
      if (along > 24 && rand() < (along - 24) / 14) continue;
      stones.push([jx, jz]);
    }
  }
  const cobGeo = new THREE.DodecahedronGeometry(1, 0);
  cobGeo.deleteAttribute('normal');
  cobGeo.computeVertexNormals();
  paint(cobGeo, 'cobble');
  const cobbles = new THREE.InstancedMesh(cobGeo, paletteMaterial(), stones.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), cc = new THREE.Color();
  stones.forEach(([x, z], i) => {
    q.setFromEuler(new THREE.Euler(range(-0.08, 0.08), rand() * Math.PI, range(-0.08, 0.08)));
    s.set(range(0.15, 0.19), range(0.055, 0.08), range(0.13, 0.17));
    p.set(x, groundHeight(x, z) + 0.02, z);
    m.compose(p, q, s);
    cobbles.setMatrixAt(i, m);
    const shade = range(0.62, 1.08);
    cc.setRGB(shade, shade, shade * range(0.98, 1.05));
    cobbles.setColorAt(i, cc);
  });
  cobbles.receiveShadow = true;
  cobbles.name = 'cobbles';
  group.add(cobbles);

  /* ---------------- puddles ---------------- */
  const puddleSpots = [
    [3.6, 0.5, 0.9], [-0.7, 6.2, 0.75], [0.4, -6.8, 0.8], [7.8, -0.5, 0.7], [-2.3, -2.6, 0.95],
    [9.8, 0.9, 0.55], [-7.5, 0.4, 0.8], [0.8, 10.5, 0.6], [2.4, 3.4, 0.5],
    [17.5, 0.6, 0.9], [-16, -0.8, 0.8], [0.6, -18, 0.7], [-0.4, 21, 0.9], [27, -0.3, 0.7], [-0.5, -30, 0.8],
  ];
  const water = waterMaterial();
  const puddles = [];
  for (const [x, z, r] of puddleSpots) {
    const seg = 18;
    const shape = new THREE.Shape();
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const rr = r * (0.75 + 0.45 * vnoise(Math.cos(a) * 1.6 + x, Math.sin(a) * 1.6 + z));
      const px = Math.cos(a) * rr * 1.35, pz = Math.sin(a) * rr;
      if (i === 0) shape.moveTo(px, pz);
      else shape.lineTo(px, pz);
    }
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, water);
    mesh.position.set(x, groundHeight(x, z) + 0.065, z);
    mesh.rotation.y = rand() * Math.PI;
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    group.add(mesh);
    puddles.push({ x, z, r: r * 1.1 });
  }

  /* ---------------- coarse pick mesh (cheap hover raycasts) ---------------- */
  const pg = new THREE.PlaneGeometry(WALK * 2 + 8, WALK * 2 + 8, 48, 48);
  pg.rotateX(-Math.PI / 2);
  const pp = pg.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setY(i, groundHeight(pp.getX(i), pp.getZ(i)) + 0.05);
  pg.computeBoundingSphere();
  const pick = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ visible: false }));
  pick.name = 'walk-plane';
  group.add(pick);

  return { group, puddles, walkPlane: pick, stoneCount: stones.length };
}

/* ---------------- the wilds: forest ring, rocks ---------------- */

function instanced(srcMesh, transforms, { cast = true } = {}) {
  const im = new THREE.InstancedMesh(srcMesh.geometry, srcMesh.material, transforms.length);
  transforms.forEach((mtx, i) => im.setMatrixAt(i, mtx));
  im.castShadow = cast;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}

/**
 * @param avoid (x, z) => boolean  true where nothing should grow (houses, roads)
 */
export function buildWilds(avoid) {
  const group = new THREE.Group();
  group.name = 'wilds';
  const pineSrc = [pine(4.6), pine(5.6), pine(3.8)];
  const bareSrc = [bareTree(4.2), bareTree(3.4)];
  // trees are bucketed per type AND per 32 m cell, so the camera and the shadow pass can cull them
  const CELL = 32;
  const cells = new Map();
  const bucketFor = (kind, idx, x, z) => {
    const key = `${kind}${idx}:${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!cells.has(key)) cells.set(key, { kind, idx, list: [] });
    return cells.get(key).list;
  };
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const place = (list, x, z, scale) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
    p.set(x, groundHeight(x, z) - 0.05, z);
    s.setScalar(scale);
    list.push(mtx.compose(p, q, s).clone());
  };
  let tries = 0, placed = 0;
  while (placed < 900 && tries < 9000) {
    tries++;
    const a = rand() * Math.PI * 2;
    const r = 16 + Math.pow(rand(), 0.7) * 100;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.min(Math.abs(x), Math.abs(z)) < 5.5) continue; // keep the lanes open
    if (avoid(x, z)) continue;
    // forest gets denser further out, clearings closer in
    const dens = smooth(18, 46, r) * (0.35 + 0.65 * fbm(x * 0.05 + 9, z * 0.05));
    if (rand() > dens) continue;
    const bare = rand() < 0.16;
    if (bare) place(bucketFor('bare', placed % 2, x, z), x, z, range(0.8, 1.35));
    else place(bucketFor('pine', placed % 3, x, z), x, z, range(0.75, 1.5));
    placed++;
  }
  for (const { kind, idx, list } of cells.values()) {
    const src = kind === 'bare' ? bareSrc[idx] : pineSrc[idx];
    const im = instanced(src, list);
    // only the nearer trees throw moon shadows; the far ones sit in fog anyway
    const c = new THREE.Vector3();
    im.boundingSphere.center && c.copy(im.boundingSphere.center);
    im.castShadow = Math.hypot(c.x, c.z) < 48;
    group.add(im);
  }

  // boulders on the hills
  const rockB = new Builder();
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2, r = 18 + rand() * 70;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.min(Math.abs(x), Math.abs(z)) < 4 || avoid(x, z)) continue;
    const y = groundHeight(x, z), rr = range(0.4, 1.6);
    rockB.add(new THREE.DodecahedronGeometry(rr, 0), rand() < 0.5 ? 'rock' : 'rockDark', [x, y + rr * 0.2, z], [rand() * 3, rand() * 3, rand() * 3], [1, range(0.55, 0.85), 1], true);
    rockB.add(sphere(rr * 0.75, 7, 4), 'snow', [x, y + rr * 0.55, z], [0, 0, 0], [1, 0.32, 1]);
  }
  group.add(rockB.build({ name: 'boulders' }));
  return group;
}

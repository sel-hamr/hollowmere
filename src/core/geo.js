import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, paletteMaterial, swatchColor, withHollowFog } from './palette.js';

/* Seeded random so the village is identical on every load. */
let seed = 1337;
export function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
export const range = (a, b) => a + (b - a) * rand();
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export function reseed(s) {
  seed = s;
}

/* Primitive shorthands (all low-poly). */
export const rbox = (w, h, d, r = 0.06, s = 2) =>
  new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 10, open = false) =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const sphere = (r, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h);
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const dodeca = (r) => new THREE.DodecahedronGeometry(r, 0);
export const torus = (r, t, rs = 6, ts = 12, arc = Math.PI * 2) =>
  new THREE.TorusGeometry(r, t, rs, ts, arc);

export function prism(span, rise, length) {
  const s = new THREE.Shape();
  s.moveTo(-span / 2, 0);
  s.lineTo(span / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  return g; // triangle in XY, extruded along Z
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function normalise(geo, key, flat) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  g.clearGroups();
  g.morphAttributes = {};
  if (flat || !g.attributes.normal) g.computeVertexNormals();
  paint(g, key);
  return g;
}

/**
 * Collects painted primitives and merges them into a single mesh that uses
 * the shared palette material: one draw call per object.
 */
export class Builder {
  constructor() {
    this.parts = [];
  }

  /**
   * @param geo   a THREE.BufferGeometry
   * @param key   palette swatch
   * @param pos   [x,y,z]
   * @param rot   [x,y,z] euler radians
   * @param scl   number | [x,y,z]
   * @param flat  faceted normals
   */
  add(geo, key, pos = [0, 0, 0], rot = [0, 0, 0], scl = 1, flat = false) {
    const g = normalise(geo, key, flat);
    const sc = typeof scl === 'number' ? [scl, scl, scl] : scl;
    _m.compose(
      _p.set(pos[0], pos[1], pos[2]),
      _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ')),
      _s.set(sc[0], sc[1], sc[2])
    );
    g.applyMatrix4(_m);
    g.userData.key = key;
    this.parts.push(g);
    geo.dispose();
    return this;
  }

  /** Merge another builder's parts under a transform (for reusable sub-assemblies). */
  addBuilder(other, pos = [0, 0, 0], rot = [0, 0, 0], scl = 1) {
    const sc = typeof scl === 'number' ? [scl, scl, scl] : scl;
    _m.compose(
      _p.set(pos[0], pos[1], pos[2]),
      _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ')),
      _s.set(sc[0], sc[1], sc[2])
    );
    for (const g of other.parts) this.parts.push(g.clone().applyMatrix4(_m));
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  geometry() {
    const merged = mergeGeometries(this.parts, false);
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }

  build({ cast = true, receive = true, name = '', textured = true } = {}) {
    if (texturedKit && textured) return this._buildTextured({ cast, receive, name });
    const mesh = new THREE.Mesh(this.geometry(), paletteMaterial());
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.name = name;
    for (const g of this.parts) g.dispose();
    this.parts = [];
    return mesh;
  }

  /** Wood and plaster parts get the kit's real textures; everything else keeps the palette. */
  _buildTextured({ cast, receive, name }) {
    const wood = [], plaster = [], rest = [];
    for (const g of this.parts) {
      const k = g.userData.key;
      if (WOOD[k]) wood.push(woodUV(g, WOOD[k]));
      else if (PLASTER[k]) plaster.push(plasterUV(g, PLASTER[k]));
      else rest.push(g);
    }
    const group = new THREE.Group();
    group.name = name;
    const add = (geos, mat) => {
      if (!geos.length) return;
      const merged = mergeGeometries(geos, false);
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      group.add(m);
    };
    add(wood, texturedMaterial('MI_WoodTrim'));
    add(plaster, texturedMaterial('MI_Plaster'));
    add(rest, paletteMaterial());
    for (const g of this.parts) g.dispose();
    this.parts = [];
    return group;
  }
}

/* ------------------------------------------------------------------ */
/* Textured building: real wood grain and plaster from the village kit  */
/* ------------------------------------------------------------------ */

let texturedKit = null;
/** Route Builder.build() through kit textures while a room is being built (null to stop). */
export function setTexturedKit(kit) {
  texturedKit = kit;
}

// the wood trim sheet: a light plank band at the top, a dark one below (glTF textures are not flipped)
const LIGHT = [0.02, 0.27], DARK = [0.33, 0.58];
const WOOD = {
  woodLight: { band: LIGHT, tint: 1.0 },
  wood: { band: DARK, tint: 1.05 },
  woodDark: { band: DARK, tint: 0.7 },
  timber: { band: DARK, tint: 0.55 },
  woodGrey: { band: LIGHT, tint: 0.62, grey: true },
};
const PLASTER = { plaster: 1, plasterShade: 0.82, plasterBlue: 0.8, plasterOchre: 0.92 };

const matCache = new Map();
function texturedMaterial(kitName) {
  if (matCache.has(kitName)) return matCache.get(kitName);
  const src = texturedKit.materials.get(kitName);
  const m = new THREE.MeshStandardMaterial({
    map: src?.map || null,
    normalMap: src?.normalMap || null,
    roughnessMap: src?.roughnessMap || null,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    envMapIntensity: 0.7,
  });
  for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  withHollowFog(m, { key: 'tex-' + kitName });
  matCache.set(kitName, m);
  return m;
}

function tintAttr(g, rgb) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(rgb, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

function woodUV(g, spec) {
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
  const min = [bb.min.x, bb.min.y, bb.min.z];
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const long = size.indexOf(Math.max(...size));
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nrm.getX(i)), Math.abs(nrm.getY(i)), Math.abs(nrm.getZ(i))];
    const d = n.indexOf(Math.max(...n));
    const inPlane = [0, 1, 2].filter((a) => a !== d);
    // grain runs along the piece's longest side; one plank band spans the other side
    const along = inPlane.includes(long) ? long : size[inPlane[0]] >= size[inPlane[1]] ? inPlane[0] : inPlane[1];
    const across = inPlane.find((a) => a !== along);
    uv[i * 2] = p[along] * 0.42;
    const f = (p[across] - min[across]) / Math.max(size[across], 1e-3);
    uv[i * 2 + 1] = spec.band[0] + f * (spec.band[1] - spec.band[0]);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const t = spec.tint;
  tintAttr(g, spec.grey ? [t * 0.95, t * 0.95, t * 0.95] : [t, t, t]);
  return g;
}

function plasterUV(g, shade) {
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nrm.getX(i)), Math.abs(nrm.getY(i)), Math.abs(nrm.getZ(i))];
    const d = n.indexOf(Math.max(...n));
    const [a, b] = [0, 1, 2].filter((k) => k !== d);
    uv[i * 2] = p[a] * 0.32;
    uv[i * 2 + 1] = p[b] * 0.32;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tintAttr(g, [shade, shade, shade]);
  return g;
}

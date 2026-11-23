import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { withHollowFog } from '../core/palette.js';

/** Kit units are metres; the island is authored in world units. */
export const K = 0.68;

let loader;
export function gltfLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

/* ------------------------------------------------------------------ */
/* Weather: snow settles on every upward face, everything else is wet. */
/* ------------------------------------------------------------------ */

export const weatherUniforms = {
  uSnow: { value: 1 },
  uWet: { value: 1 },
};

const SNOW_GLSL = /* glsl */ `
  uniform float uSnow;
  uniform float uWet;
`;

const SNOW_AFTER_NORMAL = /* glsl */ `
  {
    // world-space facing of the un-bumped surface
    vec3 hmGeoW = normalize((vec4(nonPerturbedNormal, 0.0) * viewMatrix).xyz);
    vec3 hmBumpW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float hmN = hmFbm(vFogWorld.xz * 3.1 + vFogWorld.y * 0.7);
    float hmN2 = hmNoise(vFogWorld.xz * 14.0);
    float hmUp = mix(hmGeoW.y, hmBumpW.y, 0.35);
    float hmSnow = smoothstep(0.26, 0.56, hmUp + (hmN - 0.5) * 0.4 + (hmN2 - 0.5) * 0.12) * uSnow;
    // rain darkens and polishes everything the snow has not covered
    float hmWet = uWet * (1.0 - hmSnow);
    diffuseColor.rgb *= mix(1.0, 0.8, hmWet);
    roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.62, hmWet);
    vec3 hmSnowCol = mix(vec3(0.80, 0.85, 0.91), vec3(0.93, 0.95, 0.98), hmN2);
    diffuseColor.rgb = mix(diffuseColor.rgb, hmSnowCol, hmSnow);
    roughnessFactor = mix(roughnessFactor, 0.78, hmSnow);
    metalnessFactor = mix(metalnessFactor, 0.0, hmSnow);
    normal = normalize(mix(normal, nonPerturbedNormal, hmSnow * 0.75));
  }
`;

export function weatherize(mat, { snow = true, key = '' } = {}) {
  return withHollowFog(mat, {
    key: (snow ? 'snow' : 'wet') + key,
    uniforms: weatherUniforms,
    fragmentDecl: SNOW_GLSL,
    afterNormal: snow ? SNOW_AFTER_NORMAL : SNOW_AFTER_NORMAL.replace('* uSnow;', '* 0.0;'),
  });
}

/* ------------------------------------------------------------------ */
/* Kit                                                                 */
/* ------------------------------------------------------------------ */

export class Kit {
  constructor(gltf) {
    this.pieces = new Map();
    this.materials = new Map();
    gltf.scene.updateMatrixWorld(true);
    for (const node of gltf.scene.children) this.pieces.set(node.name, node);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) this.materials.set(m.name, m);
    });
    for (const m of this.materials.values()) this._tune(m);
    this._variants();
  }

  static async load(url, onProgress) {
    const gltf = await gltfLoader().loadAsync(url, (e) => e.total && onProgress?.(e.loaded / e.total));
    return new Kit(gltf);
  }

  _tune(m) {
    m.envMapIntensity = 0.8;
    if (m.name === 'MI_Vine') {
      m.alphaTest = 0.5;
      m.transparent = false;
    }
    if (m.name === 'MI_WindowGlass') {
      m.color.set('#1d2633');
      m.roughness = 0.08;
      m.metalness = 0.6;
      m.envMapIntensity = 2.2;
    }
    weatherize(m, { snow: m.name !== 'MI_WindowGlass' && m.name !== 'MI_Vine' });
  }

  _variants() {
    const glass = this.materials.get('MI_WindowGlass');
    if (!glass) return;
    const lit = glass.clone();
    delete lit.userData.hollowFog;
    lit.name = 'MI_WindowGlass_Lit';
    lit.color.set('#ffb36b');
    lit.emissive = new THREE.Color('#ff9a40');
    lit.emissiveIntensity = 2.6;
    lit.roughness = 0.4;
    lit.metalness = 0;
    weatherize(lit, { snow: false, key: 'lit' });
    this.materials.set(lit.name, lit);
    const cold = glass.clone();
    delete cold.userData.hollowFog;
    cold.name = 'MI_WindowGlass_Cold';
    cold.color.set('#8fb0d6');
    cold.emissive = new THREE.Color('#3d6fae');
    cold.emissiveIntensity = 2.2;
    weatherize(cold, { snow: false, key: 'cold' });
    this.materials.set(cold.name, cold);
  }

  has(name) {
    return this.pieces.has(name);
  }

  /**
   * Add a piece to `parent` with a transform in kit metres.
   * `swap` maps material names to replacements (e.g. lit window glass).
   */
  place(parent, name, x = 0, y = 0, z = 0, rotY = 0, { swap = null, scale = 1 } = {}) {
    const src = this.pieces.get(name);
    if (!src) {
      console.warn('kit: missing piece', name);
      return null;
    }
    // the piece's own node transform carries mesh de-quantisation: keep it, place a wrapper
    const obj = new THREE.Group();
    obj.add(src.clone(true));
    obj.position.set(x, y, z);
    obj.rotation.set(0, rotY, 0);
    obj.scale.setScalar(scale);
    if (swap) {
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const map = (m) => (swap[m.name] ? this.materials.get(swap[m.name]) || m : m);
        o.material = Array.isArray(o.material) ? o.material.map(map) : map(o.material);
      });
    }
    parent.add(obj);
    return obj;
  }
}

/* ------------------------------------------------------------------ */
/* Baking: merge a group of kit pieces into one mesh per material.     */
/* ------------------------------------------------------------------ */

function toFloat(attr) {
  if (attr.array instanceof Float32Array && !attr.normalized && !attr.isInterleavedBufferAttribute) return attr.clone();
  const n = attr.count, size = attr.itemSize;
  const out = new Float32Array(n * size);
  for (let i = 0; i < n; i++) {
    out[i * size] = attr.getX(i);
    if (size > 1) out[i * size + 1] = attr.getY(i);
    if (size > 2) out[i * size + 2] = attr.getZ(i);
    if (size > 3) out[i * size + 3] = attr.getW(i);
  }
  return new THREE.BufferAttribute(out, size);
}

export function bake(group, { cast = true, receive = true } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map(); // material -> geometries
  const m = new THREE.Matrix4();
  group.traverse((o) => {
    if (!o.isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const src = o.geometry;
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.index ? src.index.count : src.attributes.position.count, materialIndex: 0 }];
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', toFloat(src.attributes.position));
      geo.setAttribute('normal', src.attributes.normal ? toFloat(src.attributes.normal) : null);
      if (!src.attributes.normal) geo.deleteAttribute('normal');
      geo.setAttribute('uv', src.attributes.uv ? toFloat(src.attributes.uv) : new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
      if (src.index) {
        const idx = src.index.array.slice(g.start, g.start + g.count);
        geo.setIndex(new THREE.BufferAttribute(idx instanceof Uint32Array ? idx : new Uint32Array(idx), 1));
      } else {
        const idx = new Uint32Array(g.count);
        for (let i = 0; i < g.count; i++) idx[i] = g.start + i;
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.applyMatrix4(m);
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(geo);
    }
  });
  const out = new THREE.Group();
  out.name = group.name;
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast && !mat.name.startsWith('MI_WindowGlass');
    mesh.receiveShadow = receive;
    out.add(mesh);
  }
  return out;
}

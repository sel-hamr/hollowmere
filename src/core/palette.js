import * as THREE from 'three';

/**
 * One shared palette texture drives every matte surface in the world.
 * Each swatch is [albedo, roughness, emissive]. Geometry UVs are collapsed
 * onto the centre of a swatch, so the whole village renders with one material.
 */
const SWATCHES = {
  // ground & stone
  snow: ['#e3e9f0', 0.9],
  snowShade: ['#b4c0cf', 0.9],
  slush: ['#8d96a3', 0.55],
  cobble: ['#6d6a70', 0.42],
  cobbleDark: ['#4b4950', 0.4],
  stone: ['#85868d', 0.85],
  stoneDark: ['#5c5e67', 0.85],
  rock: ['#4a4b54', 0.95],
  rockDark: ['#34353d', 0.95],
  earth: ['#4b3b34', 1.0],
  earthDark: ['#2f2526', 1.0],
  mud: ['#3d3431', 0.5],
  grass: ['#5c6248', 1.0],

  // timber & plaster
  plaster: ['#cbbba1', 0.95],
  plasterShade: ['#a8977f', 0.95],
  plasterBlue: ['#9aa7b4', 0.95],
  plasterOchre: ['#c49a62', 0.95],
  timber: ['#3b2b24', 0.85],
  wood: ['#6b4f3a', 0.8],
  woodLight: ['#8a6a4f', 0.8],
  woodDark: ['#47352a', 0.85],
  woodGrey: ['#6e6862', 0.9],

  // roofs
  slate: ['#424a5a', 0.6],
  slateDark: ['#323845', 0.6],
  roofRed: ['#6e3b33', 0.75],
  thatch: ['#7d6a4c', 1.0],

  // metal & misc
  iron: ['#2b2e35', 0.45],
  brass: ['#b08a4a', 0.35],
  rust: ['#7a4630', 0.8],
  glassDark: ['#1a212c', 0.15],
  void: ['#07090d', 1.0],
  paper: ['#e8dfc8', 0.95],
  paperOld: ['#c9b996', 0.95],
  cloth: ['#5d6b78', 1.0],
  clothRed: ['#7b3a36', 1.0],
  sack: ['#9b8565', 1.0],
  pine: ['#33443c', 0.95],
  pineDark: ['#25322d', 0.95],
  bark: ['#3a302b', 1.0],
  water: ['#151c26', 0.05],

  // characters
  coat: ['#9a8061', 0.95],
  coatDark: ['#6b5641', 0.95],
  trousers: ['#2e2f36', 1.0],
  hat: ['#2a2725', 0.9],
  skin: ['#e0b48f', 0.8],
  glove: ['#2b2320', 0.7],
  scarf: ['#8e3131', 1.0],
  raven: ['#1b1d24', 0.5],
  beak: ['#3b3a3c', 0.5],

  // emissive swatches
  windowWarm: ['#ffb062', 0.4, '#ff9a3c'],
  windowDim: ['#c9773a', 0.4, '#8a4416'],
  lampGlow: ['#ffe2a8', 0.4, '#ffc56b'],
  lantern: ['#ffd9a0', 0.4, '#ffb04a'],
  clockFace: ['#cfd8de', 0.6, '#5e7486'],
  roseWindow: ['#8fb0d6', 0.3, '#3d6fae'],
  ember: ['#ff7a3a', 0.6, '#ff5a1a'],
};

const KEYS = Object.keys(SWATCHES);
const COLS = 8;
const ROWS = Math.ceil(KEYS.length / COLS);
const CELL = 8;
const INDEX = Object.fromEntries(KEYS.map((k, i) => [k, i]));

function makeCanvasTexture(fill, colorSpace) {
  const c = document.createElement('canvas');
  c.width = COLS * CELL;
  c.height = ROWS * CELL;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  KEYS.forEach((k, i) => {
    const style = fill(SWATCHES[k]);
    if (!style) return;
    g.fillStyle = style;
    g.fillRect((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL);
  });
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = colorSpace;
  return t;
}

export function swatchUV(key) {
  const i = INDEX[key];
  if (i === undefined) throw new Error(`Unknown swatch "${key}"`);
  return [((i % COLS) + 0.5) / COLS, 1 - (Math.floor(i / COLS) + 0.5) / ROWS];
}

export function swatchColor(key) {
  return new THREE.Color(SWATCHES[key][0]);
}

/** Collapse all UVs of a geometry onto one palette swatch. */
export function paint(geo, key) {
  const [u, v] = swatchUV(key);
  const n = geo.attributes.position.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/* ------------------------------------------------------------------ */
/* Atmosphere: shared height-fog uniforms injected into every shader. */
/* ------------------------------------------------------------------ */

export const fogUniforms = {
  uFogColor: { value: new THREE.Color('#27313e') },
  uFogTime: { value: 0 },
  uFogNear: { value: 62 },
  uFogFar: { value: 120 },
  uFogHeight: { value: 1.6 }, // thickness of ground mist
  uFogGround: { value: 0.42 }, // max mist density at ground
  uFogAbyss: { value: -60 }, // below this, the slab dissolves into fog
};

export const FOG_GLSL = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogTime;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFogHeight;
  uniform float uFogGround;
  uniform float uFogAbyss;
  varying vec3 vFogWorld;
  varying float vFogViewDepth;

  float hmHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float hmNoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hmHash(i), b = hmHash(i+vec2(1,0)), c = hmHash(i+vec2(0,1)), d = hmHash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float hmFbm(vec2 p){
    float v = 0.0; float a = 0.55;
    for(int i=0;i<3;i++){ v += a*hmNoise(p); p = p*2.03 + 7.1; a *= 0.5; }
    return v;
  }
  float hollowFog(){
    vec2 drift = vec2(uFogTime*0.18, uFogTime*0.07);
    float n = hmFbm(vFogWorld.xz*0.16 + drift);
    float n2 = hmFbm(vFogWorld.xz*0.05 - drift*0.6);
    float mistTop = uFogHeight * (0.55 + 0.9*n2);
    float mist = uFogGround * (1.0 - smoothstep(0.0, mistTop, vFogWorld.y)) * (0.45 + 0.75*n);
    float dist = smoothstep(uFogNear, uFogFar, vFogViewDepth);
    float abyss = (1.0 - smoothstep(uFogAbyss - 3.2, uFogAbyss, vFogWorld.y));
    return clamp(max(max(mist, dist), abyss), 0.0, 1.0);
  }
`;

const FOG_VERT_DECL = /* glsl */ `
  varying vec3 vFogWorld;
  varying float vFogViewDepth;
`;

const FOG_VERT_BODY = /* glsl */ `
  {
    vec4 fogWp = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      fogWp = instanceMatrix * fogWp;
    #endif
    fogWp = modelMatrix * fogWp;
    vFogWorld = fogWp.xyz;
    vFogViewDepth = -(viewMatrix * fogWp).z;
  }
`;

/**
 * Patch a built-in material so it uses Hollowmere's rolling height fog.
 * `extra` can add more shader hooks on top (snow, wetness, clothing):
 *   { key, uniforms, vertexDecl, vertexBody, fragmentDecl, afterMap, afterNormal }
 */
const patched = new WeakSet();

export function withHollowFog(material, extra = {}) {
  if (patched.has(material)) return material; // shared materials get patched once
  patched.add(material);
  // clones copy the hook; always wrap the original, never one of our patches
  let prev = material.onBeforeCompile;
  while (prev && prev.__hollowBase !== undefined) prev = prev.__hollowBase;
  const hook = (shader, renderer) => {
    prev?.(shader, renderer);
    Object.assign(shader.uniforms, fogUniforms, extra.uniforms || {});
    if (shader.vertexShader.includes('vFogViewDepth')) return; // already patched this source
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${FOG_VERT_DECL}
${extra.vertexDecl || ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
${FOG_VERT_BODY}
${extra.vertexBody || ''}`);
    let fs = shader.fragmentShader
      .replace('#include <common>', `#include <common>
${FOG_GLSL}
${extra.fragmentDecl || ''}`)
      .replace('#include <fog_fragment>', `gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, hollowFog());`);
    if (extra.afterMap) fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
${extra.afterMap}`);
    if (extra.afterNormal) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${extra.afterNormal}`);
    shader.fragmentShader = fs;
  };
  hook.__hollowBase = prev || null;
  material.onBeforeCompile = hook;
  material.customProgramCacheKey = () => 'hollow-fog-' + material.type + '-' + (extra.key || '');
  return material;
}

/* ------------------------------------------------------------------ */

let shared = null;

/** The single matte material shared by every procedural mesh. */
export function paletteMaterial() {
  if (shared) return shared;
  const map = makeCanvasTexture((s) => s[0], THREE.SRGBColorSpace);
  const rough = makeCanvasTexture((s) => {
    const r = Math.round((s[1] ?? 0.9) * 255);
    return `rgb(${r},${r},${r})`;
  }, THREE.NoColorSpace);
  const emissive = makeCanvasTexture((s) => s[2] || '#000', THREE.SRGBColorSpace);

  shared = withHollowFog(
    new THREE.MeshStandardMaterial({
      map,
      roughnessMap: rough,
      roughness: 1,
      metalness: 0,
      emissiveMap: emissive,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 2.4,
      envMapIntensity: 1,
    })
  );
  shared.name = 'hollowmere-palette';
  return shared;
}

/** Wet, mirror-ish surface for puddles. */
export function waterMaterial() {
  return withHollowFog(
    new THREE.MeshStandardMaterial({
      color: '#5a6b80',
      roughness: 0.06,
      metalness: 0.7,
      envMapIntensity: 3.2,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
}

import * as THREE from 'three';
import { Builder, rbox, cyl, cone, sphere, prism, torus, range, rand } from '../core/geo.js';

/* ------------------------------------------------------------------ */
/* Sub-assemblies, all authored facing +Z at the origin.              */
/* ------------------------------------------------------------------ */

function windowAsm({ lit = false, dim = false, boarded = false, shutters = false, askew = false, box = false, w = 0.62, h = 0.8 } = {}) {
  const b = new Builder();
  const glass = boarded ? 'glassDark' : lit ? 'windowWarm' : dim ? 'windowDim' : 'glassDark';
  b.add(rbox(w, h, 0.08, 0.02), glass, [0, 0, -0.01]);
  // frame
  b.add(rbox(w + 0.16, 0.1, 0.14, 0.03), 'timber', [0, h / 2 + 0.04, 0.02]);
  b.add(rbox(w + 0.26, 0.09, 0.22, 0.03), 'woodLight', [0, -h / 2 - 0.04, 0.05]);
  b.add(rbox(0.1, h + 0.1, 0.14, 0.03), 'timber', [-w / 2 - 0.04, 0, 0.02]);
  b.add(rbox(0.1, h + 0.1, 0.14, 0.03), 'timber', [w / 2 + 0.04, 0, 0.02]);
  // mullions
  b.add(rbox(0.04, h, 0.1, 0.01), 'timber', [0, 0, 0.02]);
  b.add(rbox(w, 0.04, 0.1, 0.01), 'timber', [0, h * 0.08, 0.02]);
  // snow on the sill
  b.add(rbox(w + 0.2, 0.06, 0.18, 0.03), 'snow', [0, -h / 2 + 0.03, 0.07]);
  if (shutters) {
    const sw = w / 2 + 0.02;
    b.add(rbox(sw, h + 0.04, 0.05, 0.015), 'wood', [-w / 2 - sw / 2 - 0.1, 0, 0.06], [0, 0.25, 0]);
    if (askew) b.add(rbox(sw, h + 0.04, 0.05, 0.015), 'wood', [w / 2 + sw / 2 + 0.12, -0.12, 0.09], [0, -0.35, -0.32]);
    else b.add(rbox(sw, h + 0.04, 0.05, 0.015), 'wood', [w / 2 + sw / 2 + 0.1, 0, 0.06], [0, -0.25, 0]);
  }
  if (boarded) {
    b.add(rbox(w + 0.3, 0.12, 0.04, 0.015), 'woodGrey', [0, 0.12, 0.12], [0, 0, 0.32]);
    b.add(rbox(w + 0.3, 0.12, 0.04, 0.015), 'woodGrey', [0, -0.08, 0.14], [0, 0, -0.38]);
    b.add(sphere(0.018, 5, 4), 'iron', [-0.25, 0.04, 0.17]);
    b.add(sphere(0.018, 5, 4), 'iron', [0.25, 0.2, 0.17]);
  }
  if (box) {
    b.add(rbox(w + 0.1, 0.16, 0.2, 0.03), 'wood', [0, -h / 2 - 0.18, 0.12]);
    b.add(rbox(w + 0.06, 0.07, 0.17, 0.035), 'snow', [0, -h / 2 - 0.08, 0.12]);
    b.add(sphere(0.06, 6, 4), 'pineDark', [-0.15, -h / 2 - 0.1, 0.12], [0, 0, 0], [1, 0.7, 1]);
  }
  return b;
}

function doorAsm({ ajar = false, color = 'wood', lamp = false } = {}) {
  const b = new Builder();
  const W = 0.82, H = 1.5;
  b.add(rbox(W + 0.24, 0.16, 0.2, 0.04), 'timber', [0, H + 0.06, 0.03]);
  b.add(rbox(0.12, H + 0.1, 0.18, 0.03), 'timber', [-W / 2 - 0.06, H / 2, 0.02]);
  b.add(rbox(0.12, H + 0.1, 0.18, 0.03), 'timber', [W / 2 + 0.06, H / 2, 0.02]);
  b.add(rbox(W + 0.5, 0.12, 0.5, 0.04), 'stone', [0, 0.06, 0.24]);
  b.add(rbox(W + 0.3, 0.05, 0.42, 0.025), 'snowShade', [0.05, 0.14, 0.26]);
  if (ajar) {
    b.add(rbox(W, H, 0.04, 0.01), 'void', [0, H / 2, -0.01]);
    const a = -1.05;
    const hx = -W / 2;
    b.add(rbox(W, H - 0.02, 0.08, 0.02), color, [hx + Math.cos(a) * W / 2, H / 2, 0.02 - Math.sin(a) * W / 2], [0, a, 0]);
  } else {
    b.add(rbox(W, H - 0.02, 0.08, 0.02), color, [0, H / 2, 0.0]);
    for (let i = -1; i <= 1; i += 2) b.add(rbox(0.04, H - 0.2, 0.03, 0.01), 'woodDark', [i * 0.2, H / 2, 0.05]);
    b.add(rbox(W - 0.08, 0.06, 0.03, 0.01), 'iron', [0, H * 0.75, 0.05]);
    b.add(rbox(W - 0.08, 0.06, 0.03, 0.01), 'iron', [0, H * 0.25, 0.05]);
    b.add(torus(0.05, 0.012, 4, 8), 'brass', [0.24, H * 0.52, 0.07]);
  }
  if (lamp) {
    b.add(rbox(0.04, 0.04, 0.26, 0.01), 'iron', [W / 2 + 0.32, H + 0.1, 0.13]);
    b.add(rbox(0.16, 0.22, 0.16, 0.03), 'lampGlow', [W / 2 + 0.32, H - 0.08, 0.26]);
    b.add(cone(0.14, 0.1, 4), 'iron', [W / 2 + 0.32, H + 0.08, 0.26], [0, Math.PI / 4, 0]);
  }
  return b;
}

/** Gable roof with the ridge running along X. Returns the ridge height. */
function roofAsm(b, { span, length, rise, y0, key = 'slate', wallKey = 'plaster', snow = true, icicles = true, attic = null }) {
  const o = 0.38, e = 0.32, t = 0.16;
  const a = Math.atan2(rise, span / 2);
  const slope = Math.hypot(span / 2, rise);
  const L = slope + o;
  const R = new THREE.Vector3(0, y0 + rise, 0);
  // gable infill
  const g = prism(span, rise, length);
  g.rotateY(Math.PI / 2);
  b.add(g, wallKey, [0, y0, 0]);
  if (attic) {
    const aw = windowAsm({ lit: attic === 'lit', w: 0.42, h: 0.5 });
    b.addBuilder(aw, [length / 2 + 0.02, y0 + rise * 0.38, 0], [0, Math.PI / 2, 0]);
  }
  for (const s of [1, -1]) {
    const dir = new THREE.Vector3(0, -Math.sin(a), s * Math.cos(a));
    const nrm = new THREE.Vector3(0, Math.cos(a), s * Math.sin(a));
    const c = R.clone().addScaledVector(dir, L / 2 - 0.06).addScaledVector(nrm, t / 2);
    b.add(rbox(length + e * 2, t, L, 0.05), key, [c.x, c.y, c.z], [s * a, 0, 0]);
    // a darker row of slates near the eave for depth
    const ce = R.clone().addScaledVector(dir, L - 0.18).addScaledVector(nrm, t + 0.015);
    b.add(rbox(length + e * 2 - 0.04, 0.04, 0.3, 0.015), key === 'slate' ? 'slateDark' : 'woodDark', [ce.x, ce.y, ce.z], [s * a, 0, 0]);
    if (snow) {
      const sl = L * range(0.62, 0.86);
      const cs = R.clone().addScaledVector(dir, sl / 2 - 0.02).addScaledVector(nrm, t + 0.07);
      b.add(rbox(length + e * 2 - 0.14, 0.13, sl, 0.06), 'snow', [cs.x, cs.y, cs.z], [s * a, 0, 0]);
      if (icicles && s === 1) {
        const eave = R.clone().addScaledVector(dir, L - 0.02);
        const n = Math.floor(length * 3);
        for (let i = 0; i < n; i++) {
          if (rand() < 0.35) continue;
          const len = range(0.08, 0.34);
          b.add(cone(range(0.025, 0.045), len, 5), 'snowShade', [-length / 2 - e + 0.15 + (i + rand() * 0.6) * ((length + e * 2 - 0.3) / n), eave.y - len / 2 - 0.02, eave.z - 0.02], [Math.PI, 0, 0]);
        }
      }
    }
  }
  b.add(cyl(0.11, 0.11, length + e * 2 + 0.05, 6), key === 'slate' ? 'slateDark' : 'woodDark', [R.x, R.y + t * 0.9, 0], [0, 0, Math.PI / 2]);
  if (snow) b.add(cyl(0.12, 0.12, length + e * 2 - 0.2, 6), 'snow', [R.x, R.y + t + 0.08, 0], [0, 0, Math.PI / 2], [1, 1, 0.8]);
  return R.y;
}

function framing(b, width, height, y0, zFace, braces = true, skip = []) {
  const T = 0.11;
  const posts = Math.max(2, Math.round(width / 1.1) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -width / 2 + T / 2 + (i * (width - T)) / (posts - 1);
    b.add(rbox(T, height, 0.07, 0.02), 'timber', [x, y0 + height / 2, zFace]);
    if (braces && i < posts - 1 && !skip.includes(i)) {
      const x2 = -width / 2 + T / 2 + ((i + 1) * (width - T)) / (posts - 1);
      const dx = x2 - x, dy = height * 0.48;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx) * (i % 2 ? 1 : -1);
      b.add(rbox(len, T * 0.85, 0.06, 0.02), 'timber', [(x + x2) / 2, y0 + height * 0.28, zFace], [0, 0, ang]);
    }
  }
  b.add(rbox(width + 0.04, T, 0.08, 0.02), 'timber', [0, y0 + height - T / 2, zFace + 0.005]);
  b.add(rbox(width + 0.04, T * 0.8, 0.08, 0.02), 'timber', [0, y0 + height * 0.55, zFace + 0.004]);
}

/* ------------------------------------------------------------------ */
/* House                                                              */
/* ------------------------------------------------------------------ */

/**
 * A two-storey jettied village house, authored facing +Z.
 * Returns { group, sign, chimneyTop (local), footprint }.
 */
export function house(o = {}) {
  const {
    w = 4, d = 3.4, h1 = 2.1, h2 = 1.7, jetty = 0.2, rise = 2.1,
    wall = 'plaster', wall2 = wall, roof = 'slate', gableFront = false,
    door = { x: 0 }, windows1 = [], windows2 = [], sideWindows = [],
    chimney = { x: 1.0, z: -0.4 }, sign = null, attic = 'dark', shopFront = false,
  } = o;
  const b = new Builder();
  const W2 = w + jetty * 2, D2 = d + jetty * 2;
  const H = h1 + h2;

  // plinth + ground floor
  b.add(rbox(w + 0.2, 0.42, d + 0.2, 0.06), 'stoneDark', [0, 0.21, 0], [0, 0, 0], 1, false);
  b.add(rbox(w, h1, d, 0.05), wall === 'stone' ? 'stone' : wall, [0, h1 / 2, 0]);
  // corner quoins
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    b.add(rbox(0.26, 0.24, 0.26, 0.04), 'stone', [sx * (w / 2 - 0.08), 0.55 + k * 0.42, d / 2 - 0.08], [0, 0, 0], [1, 1, 1], true);
  }
  // jetty beam + upper floor
  if (h2 > 0) {
    b.add(rbox(W2 + 0.1, 0.18, D2 + 0.1, 0.04), 'timber', [0, h1 + 0.02, 0]);
    for (let i = 0; i < Math.round(w / 0.7); i++) {
      b.add(rbox(0.1, 0.12, jetty + 0.12, 0.02), 'timber', [-w / 2 + 0.35 + i * 0.7, h1 - 0.1, d / 2 + jetty / 2]);
    }
    b.add(rbox(W2, h2, D2, 0.05), wall2, [0, h1 + h2 / 2 + 0.06, 0]);
    framing(b, W2, h2, h1 + 0.06, D2 / 2 + 0.03, true, windows2.map((wn) => wn.panel ?? -1));
    // side framing (+x) is visible from the camera
    const side = new Builder();
    framing(side, D2, h2, h1 + 0.06, 0.03, false);
    b.addBuilder(side, [W2 / 2, 0, 0], [0, Math.PI / 2, 0]);
  }
  if (shopFront) {
    // wide display window with a small awning
    const sw = windowAsm({ lit: shopFront === 'lit', dim: shopFront === 'dim', boarded: shopFront === 'boarded', w: 1.3, h: 0.95 });
    b.addBuilder(sw, [w / 4 + 0.15, 1.1, d / 2 + 0.03]);
    b.add(rbox(1.9, 0.08, 0.7, 0.03), 'clothRed', [w / 4 + 0.15, 1.85, d / 2 + 0.3], [-0.35, 0, 0]);
    b.add(rbox(1.84, 0.05, 0.5, 0.025), 'snow', [w / 4 + 0.15, 1.92, d / 2 + 0.26], [-0.35, 0, 0]);
    b.add(rbox(1.9, 0.12, 0.05, 0.02), 'clothRed', [w / 4 + 0.15, 1.7, d / 2 + 0.64]);
  }

  b.addBuilder(doorAsm(door), [door.x ?? 0, 0.12, d / 2]);
  for (const wn of windows1) b.addBuilder(windowAsm(wn), [wn.x, wn.y ?? 1.25, d / 2 + 0.02]);
  for (const wn of windows2) b.addBuilder(windowAsm(wn), [wn.x, h1 + h2 / 2 + 0.08, D2 / 2 + 0.03]);
  for (const wn of sideWindows) {
    const onUpper = wn.floor === 2 && h2 > 0;
    b.addBuilder(windowAsm(wn), [(onUpper ? W2 : w) / 2 + 0.03, onUpper ? h1 + h2 / 2 + 0.08 : 1.25, wn.z], [0, Math.PI / 2, 0]);
  }

  // roof
  let ridgeY;
  const roofB = new Builder();
  if (gableFront) {
    ridgeY = roofAsm(roofB, { span: W2, length: D2, rise, y0: H + 0.06, key: roof, wallKey: wall2, attic: null, icicles: true });
    b.addBuilder(roofB, [0, 0, 0], [0, Math.PI / 2, 0]);
    // front gable attic window
    b.addBuilder(windowAsm({ lit: attic === 'lit', w: 0.42, h: 0.52 }), [0, H + 0.06 + rise * 0.36, D2 / 2 + 0.02]);
  } else {
    ridgeY = roofAsm(roofB, { span: D2, length: W2, rise, y0: H + 0.06, key: roof, wallKey: wall2, attic });
    b.addBuilder(roofB);
  }

  let chimneyTop = null;
  if (chimney) {
    const cx = chimney.x, cz = chimney.z;
    const top = ridgeY + 0.9;
    const bottom = H - 0.2;
    b.add(rbox(0.6, top - bottom, 0.6, 0.05), 'stone', [cx, (top + bottom) / 2, cz]);
    b.add(rbox(0.74, 0.14, 0.74, 0.04), 'stoneDark', [cx, top, cz]);
    b.add(rbox(0.6, 0.1, 0.6, 0.05), 'snow', [cx, top + 0.1, cz]);
    b.add(cyl(0.1, 0.12, 0.26, 7), 'rust', [cx + 0.12, top + 0.2, cz - 0.1]);
    chimneyTop = new THREE.Vector3(cx + 0.12, top + 0.36, cz - 0.1);
  }

  const group = new THREE.Group();
  group.add(b.build({ name: 'house' }));

  let signMesh = null;
  if (sign) {
    const arm = new Builder();
    const sx = sign.x ?? w / 2 - 0.3;
    const sy = sign.y ?? h1 + 0.25;
    arm.add(rbox(0.05, 0.05, 0.8, 0.01), 'iron', [sx, sy, d / 2 + jetty + 0.4]);
    arm.add(rbox(0.04, 0.3, 0.04, 0.01), 'iron', [sx, sy - 0.12, d / 2 + jetty + 0.06], [0.7, 0, 0]);
    group.add(arm.build({ name: 'sign-arm' }));
    const sb = new Builder();
    sb.add(rbox(0.04, 0.12, 0.04), 'iron', [0, -0.06, -0.18]);
    sb.add(rbox(0.04, 0.12, 0.04), 'iron', [0, -0.06, 0.18]);
    sb.add(rbox(0.06, 0.46, 0.62, 0.03), 'woodLight', [0, -0.34, 0]);
    sb.add(rbox(0.07, 0.38, 0.54, 0.02), sign.color ?? 'woodDark', [0, -0.34, 0]);
    sb.add(rbox(0.06, 0.04, 0.5, 0.02), 'snow', [0, -0.09, 0]);
    if (sign.icon === 'lamp') {
      sb.add(rbox(0.09, 0.14, 0.1, 0.02), 'brass', [0, -0.36, 0]);
      sb.add(cone(0.08, 0.08, 4), 'brass', [0, -0.25, 0], [0, Math.PI / 4, 0]);
    } else if (sign.icon === 'bread') {
      sb.add(sphere(0.12, 8, 5), 'plasterOchre', [0, -0.36, 0], [0, 0, 0], [0.7, 0.6, 1.3]);
    } else if (sign.icon === 'key') {
      sb.add(torus(0.07, 0.022, 4, 8), 'brass', [0.0, -0.32, -0.1], [0, Math.PI / 2, 0]);
      sb.add(rbox(0.04, 0.04, 0.26, 0.01), 'brass', [0, -0.32, 0.08]);
    } else if (sign.icon === 'cup') {
      sb.add(cyl(0.08, 0.06, 0.15, 8), 'paper', [0, -0.36, 0]);
    }
    signMesh = sb.build({ name: 'sign' });
    signMesh.position.set(sx, sy, d / 2 + jetty + 0.72);
    group.add(signMesh);
  }

  return { group, sign: signMesh, chimneyTop, footprint: { w: W2 + 0.4, d: D2 + 0.4 }, ridgeY };
}

/* ------------------------------------------------------------------ */
/* Chapel: nave + bell tower with a stopped clock.                    */
/* ------------------------------------------------------------------ */

export function chapel() {
  const group = new THREE.Group();
  const b = new Builder();

  // Nave (authored facing +Z), ridge along Z
  const nw = 3.8, nd = 6.0, nh = 3.0;
  const nz = 2.2; // nave sits in front of the tower
  b.add(rbox(nw + 0.24, 0.45, nd + 0.24, 0.06), 'stoneDark', [0, 0.22, nz]);
  b.add(rbox(nw, nh, nd, 0.05), 'stone', [0, nh / 2, nz]);
  // buttresses on +x side
  for (let i = 0; i < 3; i++) {
    b.add(rbox(0.4, nh * 0.8, 0.45, 0.06), 'stoneDark', [nw / 2 + 0.12, nh * 0.4, nz - nd / 2 + 1.0 + i * 2.0], [0, 0, 0], 1, true);
    b.add(rbox(0.42, 0.1, 0.5, 0.04), 'snow', [nw / 2 + 0.13, nh * 0.8 + 0.02, nz - nd / 2 + 1.0 + i * 2.0]);
  }
  // tall pointed windows on +x side
  for (let i = 0; i < 2; i++) {
    const wz = nz - nd / 2 + 2.0 + i * 2.0;
    const lit = i === 0;
    b.add(rbox(0.06, 1.3, 0.52, 0.02), lit ? 'roseWindow' : 'glassDark', [nw / 2 + 0.02, 1.7, wz]);
    b.add(cone(0.3, 0.38, 4), lit ? 'roseWindow' : 'glassDark', [nw / 2 + 0.02, 2.5, wz], [0, Math.PI / 4, 0], [0.2, 1, 1]);
    b.add(rbox(0.1, 0.08, 0.66, 0.02), 'snow', [nw / 2 + 0.05, 1.03, wz]);
  }
  // front gable with rose window and door
  const roofR = new Builder();
  roofAsm(roofR, { span: nw + 0.1, length: nd, rise: 2.4, y0: nh, key: 'slate', wallKey: 'stone', icicles: false });
  b.addBuilder(roofR, [0, 0, nz], [0, Math.PI / 2, 0]);
  b.add(cyl(0.48, 0.48, 0.1, 14), 'stoneDark', [0, nh + 0.75, nz + nd / 2 + 0.02], [Math.PI / 2, 0, 0]);
  b.add(cyl(0.38, 0.38, 0.1, 14), 'roseWindow', [0, nh + 0.75, nz + nd / 2 + 0.05], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 4; k++) b.add(rbox(0.04, 0.76, 0.06, 0.01), 'stoneDark', [0, nh + 0.75, nz + nd / 2 + 0.09], [0, 0, (k * Math.PI) / 4]);
  // arched doorway
  b.add(rbox(1.2, 1.9, 0.16, 0.04), 'stoneDark', [0, 0.95, nz + nd / 2 + 0.04]);
  b.add(rbox(0.9, 1.65, 0.1, 0.03), 'woodDark', [0, 0.85, nz + nd / 2 + 0.1]);
  b.add(cyl(0.6, 0.6, 0.16, 10, false), 'stoneDark', [0, 1.9, nz + nd / 2 + 0.04], [Math.PI / 2, 0, 0], [1, 1, 0.5]);
  b.add(rbox(0.04, 1.6, 0.04, 0.01), 'iron', [0, 0.85, nz + nd / 2 + 0.17]);
  for (let s = 0; s < 3; s++) b.add(rbox(1.8 - s * 0.3, 0.14, 0.45, 0.04), 'stone', [0, 0.07 + s * 0.14, nz + nd / 2 + 0.6 - s * 0.2]);
  b.add(rbox(1.6, 0.05, 0.4, 0.02), 'snowShade', [0, 0.47, nz + nd / 2 + 0.24]);

  // Bell tower behind the nave
  const tw = 2.9, th = 7.2;
  b.add(rbox(tw + 0.3, 0.6, tw + 0.3, 0.08), 'stoneDark', [0, 0.3, -1.4]);
  b.add(rbox(tw, th, tw, 0.06), 'stone', [0, th / 2, -1.4]);
  for (let k = 0; k < 9; k++) {
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1]]) {
      b.add(rbox(0.36, 0.3, 0.36, 0.04), k % 2 ? 'stone' : 'stoneDark', [sx * (tw / 2 - 0.1), 0.7 + k * 0.72, -1.4 + sz * (tw / 2 - 0.1)], [0, 0, 0], 1, true);
    }
  }
  // string course + belfry
  b.add(rbox(tw + 0.24, 0.18, tw + 0.24, 0.04), 'stoneDark', [0, th - 1.9, -1.4]);
  b.add(rbox(tw + 0.24, 0.12, tw + 0.24, 0.04), 'snow', [0, th - 1.78, -1.4]);
  for (const face of [0, 1]) {
    const rot = face === 0 ? [0, 0, 0] : [0, Math.PI / 2, 0];
    const pos = face === 0 ? [0, th - 0.85, -1.4 + tw / 2 + 0.01] : [tw / 2 + 0.01, th - 0.85, -1.4];
    const ab = new Builder();
    for (const ox of [-0.5, 0.5]) {
      ab.add(rbox(0.6, 1.2, 0.1, 0.03), 'void', [ox, 0, 0]);
      ab.add(cyl(0.3, 0.3, 0.1, 10), 'void', [ox, 0.6, 0], [Math.PI / 2, 0, 0]);
      ab.add(rbox(0.7, 0.08, 0.2, 0.03), 'snow', [ox, -0.62, 0.05]);
    }
    b.addBuilder(ab, pos, rot);
    // clock face below the belfry
    const cb = new Builder();
    cb.add(cyl(0.62, 0.62, 0.1, 18), 'stoneDark', [0, 0, 0], [Math.PI / 2, 0, 0]);
    cb.add(cyl(0.52, 0.52, 0.1, 18), 'clockFace', [0, 0, 0.03], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      cb.add(rbox(0.04, 0.1, 0.02), 'iron', [Math.sin(a) * 0.43, Math.cos(a) * 0.43, 0.09], [0, 0, -a]);
    }
    // stopped at 3:13
    cb.add(rbox(0.05, 0.3, 0.02), 'iron', [0.149, -0.017, 0.11], [0, 0, -1.684]);
    cb.add(rbox(0.035, 0.42, 0.02), 'iron', [0.205, 0.044, 0.12], [0, 0, -1.361]);
    cb.add(sphere(0.04, 6, 4), 'brass', [0, 0, 0.12]);
    const cpos = face === 0 ? [0, th - 2.7, -1.4 + tw / 2 + 0.02] : [tw / 2 + 0.02, th - 2.7, -1.4];
    b.addBuilder(cb, cpos, rot);
  }
  // bell
  b.add(cyl(0.18, 0.42, 0.6, 12, false), 'brass', [0, th - 0.95, -1.4]);
  b.add(rbox(tw - 0.4, 0.1, 0.1), 'woodDark', [0, th - 0.55, -1.4]);
  // cornice + spire
  b.add(rbox(tw + 0.4, 0.22, tw + 0.4, 0.05), 'stoneDark', [0, th + 0.1, -1.4]);
  b.add(rbox(tw + 0.36, 0.1, tw + 0.36, 0.05), 'snow', [0, th + 0.25, -1.4]);
  const spire = cone(tw * 0.74, 4.4, 4);
  b.add(spire, 'slate', [0, th + 2.4, -1.4], [0, Math.PI / 4, 0]);
  b.add(cone(tw * 0.62, 1.2, 4), 'snow', [0, th + 0.86, -1.4], [0, Math.PI / 4, 0], [1, 1, 1]);
  // weathervane
  b.add(cyl(0.03, 0.03, 0.9, 5), 'iron', [0, th + 4.95, -1.4]);
  b.add(rbox(0.5, 0.04, 0.04, 0.01), 'iron', [0, th + 5.1, -1.4]);
  b.add(rbox(0.04, 0.04, 0.32, 0.01), 'iron', [0, th + 5.2, -1.4]);
  b.add(cone(0.08, 0.2, 4), 'iron', [0.2, th + 5.38, -1.4], [0, 0, -Math.PI / 2]);
  b.add(rbox(0.2, 0.14, 0.02), 'iron', [-0.18, th + 5.38, -1.4]);

  group.add(b.build({ name: 'chapel' }));
  return { group, footprintNave: { w: nw + 0.6, d: nd + 1.4, z: nz + 0.3 }, footprintTower: { w: tw + 0.5, d: tw + 0.5, z: -1.4 }, bellPos: new THREE.Vector3(0, th - 0.9, -1.4) };
}

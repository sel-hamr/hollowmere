import * as THREE from 'three';
import { Builder, rbox, cyl, cone, sphere, ico, dodeca, torus, range, rand } from '../core/geo.js';

/** Iron street lamp. Returns { mesh, lightPos } (local). */
export function lampPost({ broken = false } = {}) {
  const b = new Builder();
  b.add(cyl(0.2, 0.26, 0.3, 8), 'stoneDark', [0, 0.15, 0], [0, 0, 0], 1, true);
  b.add(cyl(0.07, 0.09, 2.7, 8), 'iron', [0, 1.6, 0]);
  b.add(torus(0.1, 0.03, 4, 8), 'iron', [0, 0.6, 0], [Math.PI / 2, 0, 0]);
  b.add(torus(0.08, 0.025, 4, 8), 'iron', [0, 2.2, 0], [Math.PI / 2, 0, 0]);
  // lantern head
  b.add(cyl(0.16, 0.1, 0.12, 6), 'iron', [0, 2.98, 0]);
  b.add(cyl(0.15, 0.12, 0.42, 6), broken ? 'glassDark' : 'lampGlow', [0, 3.24, 0]);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    b.add(rbox(0.025, 0.46, 0.025, 0.008), 'iron', [Math.cos(a) * 0.15, 3.24, Math.sin(a) * 0.15]);
  }
  b.add(cone(0.26, 0.24, 6), 'iron', [0, 3.57, 0]);
  b.add(cone(0.22, 0.12, 6), 'snow', [0, 3.6, 0]);
  b.add(sphere(0.05, 6, 4), 'iron', [0, 3.74, 0]);
  // ladder bar
  b.add(rbox(0.5, 0.04, 0.04, 0.01), 'iron', [0, 2.8, 0]);
  // snow ring at the base
  b.add(cyl(0.34, 0.42, 0.08, 9), 'snow', [0, 0.04, 0]);
  return { mesh: b.build({ name: 'lamp' }), lightPos: new THREE.Vector3(0, 3.24, 0) };
}

export function well() {
  const b = new Builder();
  b.add(cyl(1.0, 1.08, 0.85, 14), 'stone', [0, 0.42, 0], [0, 0, 0], 1, true);
  b.add(cyl(1.08, 1.08, 0.14, 14), 'stoneDark', [0, 0.88, 0]);
  b.add(cyl(0.8, 0.8, 0.2, 14), 'void', [0, 0.86, 0]);
  b.add(cyl(0.78, 0.78, 0.02, 14), 'water', [0, 0.55, 0]);
  // snow on the rim
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rand() * 0.5;
    b.add(sphere(0.2, 7, 4), 'snow', [Math.cos(a) * 0.95, 0.95, Math.sin(a) * 0.95], [0, -a, 0], [1.4, 0.38, 0.75]);
  }
  // posts + roof
  for (const s of [-1, 1]) {
    b.add(rbox(0.16, 2.2, 0.16, 0.03), 'woodDark', [s * 0.95, 1.6, 0]);
  }
  b.add(cyl(0.07, 0.07, 2.1, 7), 'wood', [0, 2.1, 0], [0, 0, Math.PI / 2]);
  b.add(torus(0.2, 0.03, 4, 10), 'iron', [1.08, 2.1, 0], [0, Math.PI / 2, 0]);
  b.add(rbox(0.04, 0.04, 0.3, 0.01), 'iron', [1.12, 2.1, 0.15]);
  for (const s of [1, -1]) {
    b.add(rbox(2.5, 0.1, 1.05, 0.04), 'roofRed', [0, 2.95 - 0.02, s * 0.42], [s * 0.72, 0, 0]);
    b.add(rbox(2.4, 0.09, 0.75, 0.04), 'snow', [0, 3.03, s * 0.37], [s * 0.72, 0, 0]);
  }
  b.add(cyl(0.07, 0.07, 2.6, 6), 'woodDark', [0, 3.32, 0], [0, 0, Math.PI / 2]);
  // rope + bucket
  b.add(cyl(0.012, 0.012, 0.9, 4), 'sack', [0, 1.6, 0]);
  b.add(cyl(0.16, 0.13, 0.26, 9), 'wood', [0, 1.06, 0]);
  b.add(torus(0.15, 0.012, 3, 10, Math.PI), 'iron', [0, 1.2, 0]);
  return b.build({ name: 'well' });
}

export function bareTree(h = 4.2) {
  const b = new Builder();
  b.add(cyl(0.12, 0.24, h * 0.55, 7), 'bark', [0, h * 0.27, 0], [0, 0, 0], 1, true);
  const branch = (x, y, z, len, rad, dirY, dirA, depth) => {
    const tilt = 0.55 + rand() * 0.4;
    const dx = Math.sin(dirA) * Math.sin(tilt), dz = Math.cos(dirA) * Math.sin(tilt), dy = Math.cos(tilt);
    const cx = x + dx * len / 2, cy = y + dy * len / 2, cz = z + dz * len / 2;
    const geo = cyl(rad * 0.6, rad, len, 5);
    // orient cylinder from its Y axis to (dx,dy,dz)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz));
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    b.add(geo, 'bark', [cx, cy, cz], [e.x, e.y, e.z], 1, true);
    if (depth > 0) {
      const ex = x + dx * len, ey = y + dy * len, ez = z + dz * len;
      const n = depth > 1 ? 3 : 2;
      for (let i = 0; i < n; i++) branch(ex, ey, ez, len * range(0.55, 0.75), rad * 0.6, dirY, dirA + (i - (n - 1) / 2) * range(0.8, 1.3), depth - 1);
    } else if (rand() < 0.5) {
      b.add(sphere(0.07, 5, 3), 'snow', [x + dx * len, y + dy * len + 0.03, z + dz * len], [0, 0, 0], [1, 0.5, 1]);
    }
  };
  for (let i = 0; i < 4; i++) branch(0, h * 0.5, 0, h * 0.32, 0.12, 0, i * 1.6 + rand(), 2);
  b.add(cyl(0.5, 0.6, 0.06, 8), 'snow', [0, 0.02, 0]);
  return b.build({ name: 'tree' });
}

export function pine(h = 4.6) {
  const b = new Builder();
  b.add(cyl(0.1, 0.16, h * 0.3, 6), 'bark', [0, h * 0.15, 0]);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = (1 - t * 0.72) * h * 0.3;
    const y = h * 0.22 + t * h * 0.66;
    const th = h * 0.36;
    b.add(cone(r, th, 7), i % 2 ? 'pineDark' : 'pine', [0, y + th / 2, 0], [0, rand() * 2, 0], 1, true);
    b.add(cone(r * 0.82, th * 0.42, 7), 'snow', [0, y + th * 0.62, 0], [0, rand() * 2, 0], [1, 1, 1], true);
  }
  b.add(cyl(0.6, 0.7, 0.06, 8), 'snow', [0, 0.02, 0]);
  return b.build({ name: 'pine' });
}

export function fence(length = 3, { broken = false } = {}) {
  const b = new Builder();
  const n = Math.max(2, Math.round(length / 0.9) + 1);
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + (i * length) / (n - 1);
    const lean = broken && i === n - 1 ? 0.5 : range(-0.06, 0.06);
    b.add(rbox(0.12, 1.0, 0.12, 0.03), 'woodGrey', [x, 0.48, 0], [0, 0, lean]);
    b.add(rbox(0.13, 0.06, 0.13, 0.03), 'snow', [x + lean * -0.5, 1.0, 0]);
  }
  const rails = broken ? [0.35] : [0.35, 0.72];
  for (const y of rails) {
    b.add(rbox(length, 0.08, 0.05, 0.02), 'woodGrey', [0, y, 0.07], [0, 0, range(-0.02, 0.02)]);
    b.add(rbox(length - 0.1, 0.04, 0.05, 0.02), 'snow', [0, y + 0.06, 0.07]);
  }
  if (broken) b.add(rbox(length * 0.55, 0.08, 0.05, 0.02), 'woodGrey', [length * 0.2, 0.42, 0.1], [0, 0, -0.5]);
  return b.build({ name: 'fence' });
}

export function stoneWall(length = 4) {
  const b = new Builder();
  const n = Math.round(length / 0.42);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < n - row; i++) {
      const x = -length / 2 + 0.2 + i * 0.42 + row * 0.21 + range(-0.04, 0.04);
      b.add(dodeca(0.26), row === 1 ? 'stoneDark' : 'stone', [x, 0.16 + row * 0.26, range(-0.04, 0.04)], [rand(), rand(), rand()], [1, 0.62, 0.8], true);
    }
  }
  b.add(rbox(length - 0.6, 0.1, 0.32, 0.05), 'snow', [0.1, 0.78, 0]);
  return b.build({ name: 'wall' });
}

export function crate(s = 0.6, snow = true) {
  const b = new Builder();
  b.add(rbox(s, s, s, 0.04), 'wood', [0, s / 2, 0]);
  for (const y of [0.1, s - 0.1]) b.add(rbox(s + 0.02, 0.08, s + 0.02, 0.02), 'woodDark', [0, y, 0]);
  b.add(rbox(0.06, s * 1.2, s + 0.02, 0.02), 'woodDark', [0, s / 2, 0], [0, 0, 0.78]);
  if (snow) b.add(rbox(s - 0.04, 0.07, s - 0.04, 0.035), 'snow', [0, s + 0.02, 0]);
  return b;
}

export function barrel(snow = true) {
  const b = new Builder();
  b.add(cyl(0.3, 0.27, 0.8, 10), 'wood', [0, 0.4, 0]);
  b.add(cyl(0.34, 0.34, 0.14, 10), 'wood', [0, 0.4, 0]);
  for (const y of [0.12, 0.68]) b.add(cyl(0.31, 0.31, 0.05, 10), 'iron', [0, y, 0]);
  if (snow) b.add(cyl(0.28, 0.3, 0.06, 10), 'snow', [0, 0.82, 0]);
  return b;
}

export function cart() {
  const b = new Builder();
  // tilted bed on a broken wheel
  const bed = new Builder();
  bed.add(rbox(2.2, 0.12, 1.3, 0.03), 'woodGrey', [0, 0, 0]);
  bed.add(rbox(2.2, 0.38, 0.08, 0.02), 'woodGrey', [0, 0.22, 0.62]);
  bed.add(rbox(2.2, 0.38, 0.08, 0.02), 'woodGrey', [0, 0.22, -0.62]);
  bed.add(rbox(0.08, 0.38, 1.3, 0.02), 'woodGrey', [-1.08, 0.22, 0]);
  bed.add(rbox(2.0, 0.07, 1.1, 0.035), 'snow', [0, 0.1, 0]);
  bed.add(sphere(0.3, 7, 5), 'sack', [0.4, 0.3, 0.2], [0, 0.4, 0.2], [1, 0.75, 0.85]);
  bed.add(sphere(0.28, 7, 5), 'sack', [-0.2, 0.3, -0.25], [0, 1.2, 0], [1.1, 0.7, 0.8]);
  bed.add(rbox(0.5, 0.06, 0.4, 0.03), 'snow', [0.3, 0.52, 0.15], [0, 0.3, 0.15]);
  // shafts
  bed.add(rbox(1.6, 0.08, 0.08, 0.02), 'wood', [1.85, -0.05, 0.45]);
  bed.add(rbox(1.6, 0.08, 0.08, 0.02), 'wood', [1.85, -0.05, -0.45]);
  b.addBuilder(bed, [0, 0.62, 0], [0, 0, -0.16]);
  // wheels: one upright, one fallen
  b.add(torus(0.48, 0.06, 5, 14), 'woodDark', [0.0, 0.5, 0.75]);
  for (let k = 0; k < 4; k++) b.add(rbox(0.05, 0.9, 0.05, 0.01), 'woodDark', [0, 0.5, 0.75], [0, 0, (k * Math.PI) / 4]);
  b.add(cyl(0.09, 0.09, 0.14, 8), 'iron', [0, 0.5, 0.75], [Math.PI / 2, 0, 0]);
  b.add(torus(0.48, 0.06, 5, 14), 'woodDark', [-0.5, 0.06, -1.3], [Math.PI / 2, 0, 0.1]);
  for (let k = 0; k < 4; k++) b.add(rbox(0.05, 0.9, 0.05, 0.01), 'woodDark', [-0.5, 0.06, -1.3], [Math.PI / 2, (k * Math.PI) / 4, 0]);
  b.add(cyl(0.4, 0.42, 0.06, 10), 'snow', [-0.5, 0.06, -1.3]);
  return b.build({ name: 'cart' });
}

export function noticeBoard() {
  const b = new Builder();
  for (const s of [-1, 1]) b.add(rbox(0.12, 2.0, 0.12, 0.03), 'woodDark', [s * 0.75, 1.0, 0]);
  b.add(rbox(1.5, 1.0, 0.08, 0.03), 'wood', [0, 1.35, 0]);
  b.add(rbox(1.7, 0.1, 0.4, 0.03), 'woodDark', [0, 1.95, 0.05], [-0.25, 0, 0]);
  b.add(rbox(1.64, 0.06, 0.3, 0.03), 'snow', [0, 2.0, 0.06], [-0.25, 0, 0]);
  // missing posters, each with a crossed-out face
  const posters = [[-0.45, 1.5, 0.05], [0.0, 1.45, -0.06], [0.42, 1.52, 0.1], [-0.3, 1.1, -0.04], [0.2, 1.08, 0.08]];
  posters.forEach(([x, y, r], i) => {
    b.add(rbox(0.32, 0.4, 0.015, 0.005), i % 2 ? 'paperOld' : 'paper', [x, y, 0.05], [0, 0, r]);
    b.add(rbox(0.16, 0.16, 0.012, 0.004), 'stoneDark', [x, y + 0.05, 0.06], [0, 0, r]);
    b.add(rbox(0.22, 0.02, 0.01, 0.003), 'clothRed', [x, y + 0.05, 0.068], [0, 0, r + 0.75]);
    b.add(rbox(0.22, 0.02, 0.01, 0.003), 'clothRed', [x, y + 0.05, 0.068], [0, 0, r - 0.75]);
    b.add(rbox(0.2, 0.02, 0.01, 0.003), 'iron', [x, y - 0.12, 0.06], [0, 0, r]);
  });
  // a loose poster on the ground
  b.add(rbox(0.32, 0.01, 0.4, 0.004), 'paper', [0.5, 0.08, 0.5], [0, 0.6, 0]);
  return b.build({ name: 'notice' });
}

export function gravestone(kind = 0) {
  const b = new Builder();
  const lean = range(-0.18, 0.18);
  if (kind === 0) {
    b.add(rbox(0.5, 0.8, 0.14, 0.05), 'stone', [0, 0.38, 0], [lean * 0.5, 0, lean], 1, true);
    b.add(cyl(0.25, 0.25, 0.14, 8), 'stone', [Math.sin(-lean) * 0.0, 0.78, 0], [Math.PI / 2, 0, lean], 1, true);
  } else {
    b.add(rbox(0.1, 0.9, 0.1, 0.02), 'stoneDark', [0, 0.45, 0], [0, 0, lean]);
    b.add(rbox(0.5, 0.1, 0.1, 0.02), 'stoneDark', [0, 0.68, 0], [0, 0, lean]);
  }
  b.add(sphere(0.32, 7, 4), 'snow', [0, 0.0, 0.25], [0, 0, 0], [1.2, 0.35, 1.1]);
  return b;
}

export function signpost() {
  const b = new Builder();
  b.add(rbox(0.14, 2.2, 0.14, 0.03), 'woodGrey', [0, 1.1, 0], [0, 0, 0.05]);
  b.add(rbox(1.2, 0.3, 0.06, 0.03), 'woodLight', [0.45, 1.8, 0], [0, 0, 0.04]);
  b.add(cone(0.18, 0.22, 3), 'woodLight', [1.15, 1.82, 0], [0, 0, -Math.PI / 2], [1, 1, 0.33]);
  b.add(rbox(1.0, 0.26, 0.06, 0.03), 'woodLight', [-0.35, 1.35, 0.02], [0, 0.3, -0.12]);
  b.add(rbox(0.8, 0.04, 0.07, 0.01), 'woodDark', [0.4, 1.8, 0.035]);
  b.add(rbox(0.6, 0.04, 0.07, 0.01), 'woodDark', [-0.3, 1.36, 0.06], [0, 0.3, -0.12]);
  b.add(rbox(1.1, 0.05, 0.1, 0.02), 'snow', [0.4, 1.97, 0], [0, 0, 0.04]);
  b.add(sphere(0.3, 7, 4), 'snow', [0, 0.02, 0], [0, 0, 0], [1.3, 0.4, 1.2]);
  return b.build({ name: 'signpost' });
}

export function bench() {
  const b = new Builder();
  b.add(rbox(1.6, 0.08, 0.45, 0.03), 'wood', [0, 0.5, 0]);
  b.add(rbox(1.6, 0.36, 0.06, 0.03), 'wood', [0, 0.82, -0.22], [-0.15, 0, 0]);
  for (const s of [-0.65, 0.65]) b.add(rbox(0.08, 0.5, 0.4, 0.02), 'iron', [s, 0.25, 0]);
  b.add(rbox(1.5, 0.06, 0.38, 0.03), 'snow', [0, 0.57, 0.02]);
  // a forgotten bowl, still full
  b.add(cyl(0.12, 0.08, 0.07, 9), 'cloth', [0.4, 0.04, 0.45]);
  b.add(cyl(0.1, 0.1, 0.02, 9), 'paperOld', [0.4, 0.075, 0.45]);
  return b.build({ name: 'bench' });
}

export function rock(r = 0.5) {
  const b = new Builder();
  b.add(dodeca(r), 'rock', [0, r * 0.3, 0], [rand() * 3, rand() * 3, rand() * 3], [1, 0.7, 0.9], true);
  b.add(sphere(r * 0.7, 6, 4), 'snow', [0, r * 0.62, 0], [0, 0, 0], [1, 0.35, 1]);
  return b;
}

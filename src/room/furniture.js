import * as THREE from 'three';
import { Builder, rbox, cyl, cone, sphere, torus, ico, range, rand, reseed } from '../core/geo.js';
import { paletteMaterial as paletteMat } from '../core/palette.js';
import { barrel, crate } from '../world/props.js';

/**
 * Furniture for the lamplighter's shop, in room units (the detective is ~1.3 tall).
 * Every piece is authored at the origin; the room places it.
 */

export function counter() {
  const b = new Builder();
  b.add(rbox(3.4, 0.95, 0.75, 0.04), 'wood', [0, 0.475, 0]);
  b.add(rbox(3.55, 0.08, 0.88, 0.03), 'woodLight', [0, 0.99, 0]);
  for (let i = 0; i < 4; i++) b.add(rbox(0.72, 0.62, 0.04, 0.02), 'woodDark', [-1.2 + i * 0.8, 0.48, 0.39]);
  b.add(rbox(3.45, 0.08, 0.06, 0.02), 'woodDark', [0, 0.08, 0.38]);
  // scales, a lamp and a jar of wicks on top
  b.add(cyl(0.12, 0.14, 0.04, 12), 'brass', [-1.25, 1.05, 0.05]);
  b.add(cyl(0.015, 0.015, 0.32, 6), 'brass', [-1.25, 1.22, 0.05]);
  b.add(rbox(0.36, 0.02, 0.02, 0.005), 'brass', [-1.25, 1.38, 0.05]);
  b.add(cyl(0.07, 0.09, 0.02, 10), 'brass', [-1.42, 1.3, 0.05]);
  b.add(cyl(0.07, 0.09, 0.02, 10), 'brass', [-1.08, 1.26, 0.05]);
  b.add(cyl(0.07, 0.07, 0.18, 10), 'glassDark', [1.2, 1.12, -0.1]);
  b.add(cyl(0.05, 0.05, 0.03, 8), 'paperOld', [1.2, 1.2, -0.1]);
  return b.build({ name: 'counter' });
}

export function ledger() {
  const b = new Builder();
  b.add(rbox(0.5, 0.04, 0.36, 0.01), 'clothRed', [0, 0.02, 0], [0, 0.2, 0]);
  b.add(rbox(0.22, 0.03, 0.32, 0.008), 'paperOld', [-0.12, 0.05, 0], [0, 0.2, 0.06]);
  b.add(rbox(0.22, 0.03, 0.32, 0.008), 'paperOld', [0.12, 0.05, 0], [0, 0.2, -0.06]);
  b.add(cyl(0.008, 0.008, 0.2, 5), 'iron', [0.3, 0.05, 0.12], [0, 0.6, Math.PI / 2]);
  b.add(cyl(0.035, 0.035, 0.05, 8), 'void', [-0.34, 0.03, 0.14]);
  return b.build({ name: 'ledger' });
}

export function cashDrawer() {
  const b = new Builder();
  b.add(rbox(0.5, 0.18, 0.5, 0.02), 'woodDark', [0, 0.09, 0]);
  b.add(rbox(0.44, 0.03, 0.4, 0.01), 'void', [0, 0.17, 0]);
  for (let i = 0; i < 5; i++) b.add(cyl(0.03, 0.03, 0.01, 8), 'brass', [range(-0.15, 0.15), 0.19, range(-0.1, 0.12)]);
  b.add(rbox(0.12, 0.01, 0.08, 0.003), 'paper', [0.08, 0.2, 0.02], [0, 0.4, 0]);
  return b.build({ name: 'drawer' });
}

export function lampShelf() {
  const b = new Builder();
  const W = 3.0, H = 2.1;
  for (const s of [-1, 1]) b.add(rbox(0.08, H, 0.42, 0.02), 'woodDark', [s * (W / 2), H / 2, 0]);
  b.add(rbox(W, H, 0.05, 0.01), 'wood', [0, H / 2, -0.19]);
  const levels = [0.35, 0.95, 1.55, 2.08];
  for (const y of levels) b.add(rbox(W + 0.06, 0.05, 0.44, 0.015), 'woodLight', [0, y, 0]);
  // lamps and empty oil tins along the boards
  for (let l = 0; l < 3; l++) {
    const y = levels[l] + 0.03;
    for (let i = 0; i < 6; i++) {
      const x = -W / 2 + 0.3 + i * 0.48 + range(-0.04, 0.04);
      if ((i + l) % 3 === 0) {
        // oil tin
        b.add(rbox(0.16, 0.24, 0.14, 0.02), 'rust', [x, y + 0.12, range(-0.05, 0.05)], [0, range(-0.3, 0.3), 0]);
        b.add(cyl(0.02, 0.02, 0.05, 6), 'iron', [x + 0.04, y + 0.26, 0]);
      } else {
        // a small oil lamp
        b.add(cyl(0.07, 0.09, 0.04, 8), 'brass', [x, y + 0.02, 0]);
        b.add(sphere(0.06, 8, 6), 'glassDark', [x, y + 0.1, 0], [0, 0, 0], [1, 0.8, 1]);
        b.add(cyl(0.035, 0.045, 0.14, 8), l === 1 && i === 2 ? 'lampGlow' : 'glassDark', [x, y + 0.22, 0]);
      }
    }
  }
  return b.build({ name: 'shelf' });
}

export function workbench() {
  const b = new Builder();
  b.add(rbox(2.4, 0.08, 0.8, 0.02), 'woodLight', [0, 0.9, 0]);
  for (const sx of [-1.1, 1.1]) for (const sz of [-0.32, 0.32]) b.add(rbox(0.09, 0.9, 0.09, 0.02), 'woodDark', [sx, 0.45, sz]);
  b.add(rbox(2.3, 0.06, 0.7, 0.02), 'woodDark', [0, 0.25, 0]);
  // vise, tools, lamp parts
  b.add(rbox(0.2, 0.14, 0.18, 0.02), 'iron', [-0.9, 1.01, 0.2]);
  b.add(cyl(0.015, 0.015, 0.3, 6), 'iron', [-0.9, 1.02, 0.36], [Math.PI / 2, 0, 0]);
  b.add(rbox(0.36, 0.03, 0.06, 0.01), 'woodLight', [-0.2, 0.96, 0.15], [0, 0.4, 0]);
  b.add(rbox(0.12, 0.05, 0.05, 0.01), 'iron', [-0.04, 0.96, 0.2], [0, 0.4, 0]);
  b.add(cyl(0.06, 0.08, 0.12, 8), 'brass', [0.5, 1.0, -0.1]);
  b.add(cyl(0.05, 0.05, 0.16, 8), 'glassDark', [0.75, 1.02, 0.1], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 6; i++) b.add(cyl(0.01, 0.01, 0.18, 4), 'paperOld', [0.2 + i * 0.04, 0.95, 0.25], [0, 0, Math.PI / 2]);
  // tools hanging on the wall above
  b.add(rbox(1.8, 0.5, 0.04, 0.01), 'woodGrey', [0, 1.6, -0.38]);
  for (let i = 0; i < 5; i++) {
    b.add(rbox(0.04, 0.32, 0.02, 0.008), 'iron', [-0.7 + i * 0.35, 1.58, -0.34]);
    b.add(rbox(0.12, 0.05, 0.03, 0.01), i % 2 ? 'iron' : 'woodDark', [-0.7 + i * 0.35, 1.45, -0.33]);
  }
  return b.build({ name: 'workbench' });
}

export function lampIron() {
  const b = new Builder();
  b.add(cyl(0.02, 0.02, 1.3, 6), 'iron', [0, 0.03, 0], [0, 0, Math.PI / 2]);
  b.add(torus(0.07, 0.016, 5, 10, Math.PI * 1.3), 'iron', [0.68, 0.03, 0], [Math.PI / 2, 0, 0.6]);
  b.add(rbox(0.22, 0.05, 0.05, 0.02), 'woodDark', [-0.55, 0.03, 0]);
  b.add(rbox(0.06, 0.03, 0.04, 0.01), 'cloth', [-0.48, 0.06, 0]); // blue wax smear
  return b.build({ name: 'lampiron' });
}

export function stove() {
  const b = new Builder();
  b.add(rbox(0.85, 0.75, 0.75, 0.05), 'iron', [0, 0.5, 0]);
  for (const sx of [-0.35, 0.35]) for (const sz of [-0.3, 0.3]) b.add(cyl(0.04, 0.03, 0.14, 6), 'iron', [sx, 0.07, sz]);
  b.add(rbox(0.9, 0.06, 0.8, 0.02), 'iron', [0, 0.9, 0]);
  // open door with embers and a half-burnt letter
  b.add(rbox(0.42, 0.3, 0.04, 0.01), 'ember', [0.0, 0.5, 0.36]);
  b.add(rbox(0.42, 0.32, 0.03, 0.01), 'iron', [0.33, 0.5, 0.5], [0, -1.2, 0]);
  b.add(rbox(0.16, 0.01, 0.12, 0.003), 'paperOld', [-0.05, 0.42, 0.38], [0.3, 0.2, 0]);
  // stovepipe into the wall
  b.add(cyl(0.1, 0.1, 1.5, 10), 'iron', [0, 1.65, -0.15]);
  b.add(cyl(0.1, 0.1, 0.5, 10), 'iron', [0, 2.35, -0.35], [Math.PI / 2, 0, 0]);
  b.add(rbox(0.6, 0.04, 0.4, 0.02), 'stoneDark', [0, 0.01, 0.55]);
  return b.build({ name: 'stove' });
}

export function wardrobe() {
  const b = new Builder();
  b.add(rbox(1.0, 2.0, 0.6, 0.04), 'woodDark', [0, 1.0, 0]);
  b.add(rbox(0.46, 1.7, 0.04, 0.02), 'wood', [-0.24, 1.05, 0.31]);
  b.add(rbox(0.46, 1.7, 0.04, 0.02), 'wood', [0.26, 1.05, 0.38], [0, -0.35, 0]);
  b.add(sphere(0.025, 6, 4), 'brass', [-0.05, 1.05, 0.34]);
  b.add(rbox(1.06, 0.08, 0.66, 0.02), 'woodDark', [0, 2.02, 0]);
  return b.build({ name: 'wardrobe' });
}

export function crateStack() {
  const b = new Builder();
  b.addBuilder(crate(0.55, false), [0, 0, 0], [0, 0.2, 0]);
  b.addBuilder(crate(0.5, false), [0.62, 0, 0.08], [0, -0.3, 0]);
  b.addBuilder(crate(0.45, false), [0.25, 0.55, 0.02], [0, 0.6, 0]);
  b.add(rbox(0.3, 0.06, 0.2, 0.02), 'sack', [0.25, 1.03, 0]);
  return b.build({ name: 'crates' });
}

export function barrels() {
  const b = new Builder();
  b.addBuilder(barrel(false), [0, 0, 0]);
  b.addBuilder(barrel(false), [0.62, 0, 0.18]);
  return b.build({ name: 'barrels' });
}

export function rug() {
  const b = new Builder();
  b.add(rbox(3.0, 0.02, 2.0, 0.01), 'clothRed', [0, 0.012, 0]);
  b.add(rbox(2.6, 0.022, 1.6, 0.01), 'sack', [0, 0.013, 0]);
  b.add(rbox(2.3, 0.024, 1.3, 0.01), 'clothRed', [0, 0.014, 0]);
  return b.build({ name: 'rug', cast: false });
}

/** The victim under a sheet. No gore, just the shape and an overturned lamp. */
export function coveredBody() {
  const b = new Builder();
  b.add(sphere(0.3, 14, 8), 'paperOld', [0, 0.14, 0], [0, 0, 0], [2.6, 0.45, 0.95]);
  b.add(sphere(0.17, 12, 8), 'paperOld', [-0.9, 0.16, 0], [0, 0, 0], [1, 0.8, 1]);
  b.add(sphere(0.12, 10, 6), 'paperOld', [0.8, 0.1, 0.12], [0, 0, 0], [1.6, 0.6, 0.7]);
  b.add(sphere(0.12, 10, 6), 'paperOld', [0.8, 0.1, -0.14], [0, 0, 0], [1.6, 0.6, 0.7]);
  b.add(rbox(1.9, 0.01, 0.95, 0.005), 'paperOld', [0, 0.012, 0]);
  // a boot sticking out, and the lamp that fell with him
  b.add(rbox(0.12, 0.14, 0.24, 0.04), 'hat', [1.2, 0.07, 0.15]);
  b.add(cyl(0.07, 0.09, 0.16, 8), 'brass', [-0.4, 0.07, 0.62], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 6; i++) b.add(rbox(0.05, 0.005, 0.04, 0.002), 'glassDark', [-0.2 + range(-0.3, 0.3), 0.01, 0.7 + range(-0.2, 0.2)], [0, rand() * 3, 0]);
  return b.build({ name: 'body' });
}

export function bootPrints() {
  const b = new Builder();
  let x = 0, z = 0;
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    b.add(sphere(0.06, 8, 4), 'mud', [x + side * 0.07, 0.006, z], [0, 0.6, 0], [1, 0.08, 1.7]);
    b.add(sphere(0.045, 8, 4), 'mud', [x + side * 0.07 + 0.08, 0.006, z - 0.12], [0, 0.6, 0], [1, 0.08, 1.2]);
    x += 0.32;
    z -= 0.24;
  }
  return b.build({ name: 'prints', cast: false });
}

export function overturnedChair() {
  const b = new Builder();
  const c = new Builder();
  c.add(rbox(0.42, 0.05, 0.42, 0.015), 'wood', [0, 0.45, 0]);
  for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) c.add(rbox(0.04, 0.45, 0.04, 0.01), 'woodDark', [sx, 0.225, sz]);
  c.add(rbox(0.42, 0.5, 0.04, 0.015), 'wood', [0, 0.72, -0.19]);
  b.addBuilder(c, [0, 0.21, 0], [0, 0.5, Math.PI / 2]);
  return b.build({ name: 'chair' });
}

export function wallLamp() {
  const b = new Builder();
  b.add(rbox(0.06, 0.06, 0.3, 0.01), 'iron', [0, 0, 0.15]);
  b.add(cyl(0.08, 0.06, 0.2, 8), 'lampGlow', [0, -0.12, 0.3]);
  b.add(cone(0.12, 0.1, 8), 'iron', [0, 0.02, 0.3]);
  return b.build({ name: 'walllamp', cast: false });
}

/** Thick diorama base under the floor: planks, earth and stone, like a cut-away model. */
export function baseSlab(W, D) {
  const b = new Builder();
  b.add(rbox(W + 0.5, 0.16, D + 0.5, 0.05), 'woodDark', [0, -0.08, 0]);
  b.add(rbox(W + 0.4, 0.9, D + 0.4, 0.12), 'stoneDark', [0, -0.62, 0]);
  b.add(rbox(W + 0.2, 0.5, D + 0.2, 0.16), 'rockDark', [0, -1.25, 0]);
  return b.build({ name: 'slab', cast: false });
}

export { reseed };

/* ------------------------------------------------------------------ */
/* Set dressing for a lived-in interior                                 */
/* ------------------------------------------------------------------ */

/** Plaster ceiling with heavy timber beams. `w`/`d` in room units, `y` = ceiling height. */
export function ceiling(w, d, y) {
  const b = new Builder();
  b.add(rbox(w, 0.12, d, 0.02), 'plaster', [0, y + 0.06, 0]);
  const n = Math.round(w / 1.55);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + 0.25 + (i * (w - 0.5)) / n;
    b.add(rbox(0.24, 0.3, d, 0.03), 'timber', [x, y - 0.13, 0]);
  }
  b.add(rbox(w, 0.34, 0.3, 0.03), 'timber', [0, y - 0.2, -d * 0.12]);
  return b.build({ name: 'ceiling', cast: false });
}

export function hangingLamp(drop = 0.9) {
  const b = new Builder();
  for (let i = 0; i < 7; i++) b.add(torus(0.025, 0.007, 4, 8), 'iron', [0, -i * (drop / 7), 0], [0, (i % 2) * Math.PI / 2, 0]);
  b.add(cone(0.2, 0.12, 10), 'iron', [0, -drop - 0.02, 0]);
  b.add(cyl(0.09, 0.07, 0.24, 10), 'lampGlow', [0, -drop - 0.2, 0]);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    b.add(rbox(0.012, 0.26, 0.012, 0.004), 'iron', [Math.cos(a) * 0.09, -drop - 0.2, Math.sin(a) * 0.09]);
  }
  b.add(cyl(0.11, 0.1, 0.04, 10), 'brass', [0, -drop - 0.33, 0]);
  return b.build({ name: 'hanginglamp', cast: false });
}

export function bookcase() {
  const b = new Builder();
  const W = 1.4, H = 2.2;
  for (const s of [-1, 1]) b.add(rbox(0.06, H, 0.36, 0.015), 'woodDark', [s * W / 2, H / 2, 0]);
  b.add(rbox(W, H, 0.04, 0.01), 'woodDark', [0, H / 2, -0.17]);
  const shelves = [0.1, 0.62, 1.12, 1.62, 2.16];
  for (const y of shelves) b.add(rbox(W, 0.05, 0.38, 0.015), 'wood', [0, y, 0]);
  const spines = ['clothRed', 'cloth', 'woodDark', 'paperOld', 'pine', 'rust', 'hat', 'sack'];
  for (let l = 0; l < 4; l++) {
    let x = -W / 2 + 0.08;
    while (x < W / 2 - 0.12) {
      const t = range(0.05, 0.1), h = range(0.3, 0.44);
      if (rand() < 0.08) {
        x += 0.12;
        continue;
      }
      const lean = x > W / 2 - 0.3 && rand() < 0.4 ? 0.25 : 0;
      b.add(rbox(t, h, range(0.22, 0.28), 0.01), spines[Math.floor(rand() * spines.length)], [x + t / 2, shelves[l] + 0.025 + h / 2, 0.02], [0, 0, lean]);
      x += t + 0.006;
    }
  }
  return b.build({ name: 'bookcase' });
}

export function tableSet() {
  const b = new Builder();
  b.add(rbox(1.3, 0.06, 0.8, 0.02), 'wood', [0, 0.78, 0]);
  for (const sx of [-0.56, 0.56]) for (const sz of [-0.32, 0.32]) b.add(cyl(0.035, 0.03, 0.76, 8), 'woodDark', [sx, 0.38, sz]);
  // tea for two, abandoned mid-cup
  for (const [x, z] of [[-0.35, 0.12], [0.3, -0.15]]) {
    b.add(cyl(0.07, 0.07, 0.01, 12), 'paper', [x, 0.815, z]);
    b.add(cyl(0.045, 0.035, 0.07, 10), 'paper', [x, 0.855, z]);
    b.add(cyl(0.038, 0.038, 0.005, 10), 'woodDark', [x, 0.888, z]);
  }
  b.add(sphere(0.09, 10, 8), 'paperOld', [0.05, 0.88, 0.15], [0, 0, 0], [1, 0.9, 1]);
  b.add(cyl(0.02, 0.012, 0.1, 6), 'paperOld', [0.15, 0.9, 0.15], [0, 0, -1.1]);
  b.add(cyl(0.03, 0.03, 0.14, 8), 'paper', [-0.1, 0.88, -0.2]);
  b.add(cone(0.012, 0.03, 5), 'ember', [-0.1, 0.97, -0.2]);
  const chair = (x, z, ry) => {
    const c = new Builder();
    c.add(rbox(0.42, 0.05, 0.42, 0.015), 'wood', [0, 0.45, 0]);
    for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) c.add(rbox(0.04, 0.45, 0.04, 0.01), 'woodDark', [sx, 0.225, sz]);
    c.add(rbox(0.42, 0.5, 0.04, 0.015), 'wood', [0, 0.72, -0.19]);
    for (const sx of [-0.12, 0, 0.12]) c.add(rbox(0.03, 0.45, 0.03, 0.008), 'woodDark', [sx, 0.7, -0.19]);
    b.addBuilder(c, [x, 0, z], [0, ry, 0]);
  };
  chair(-0.95, 0.05, Math.PI / 2 + 0.2);
  chair(0.98, -0.1, -Math.PI / 2 - 0.35);
  return b.build({ name: 'table' });
}

export function coatRack() {
  const b = new Builder();
  b.add(cyl(0.03, 0.035, 1.8, 8), 'woodDark', [0, 0.9, 0]);
  for (let k = 0; k < 3; k++) b.add(rbox(0.36, 0.03, 0.03, 0.01), 'woodDark', [0, 0.02, 0], [0, (k * Math.PI) / 3, 0]);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    b.add(cyl(0.012, 0.012, 0.16, 5), 'brass', [Math.cos(a) * 0.07, 1.7, Math.sin(a) * 0.07], [0, -a, 0.8]);
  }
  // a long coat and a bowler hat, neither belonging to anyone here
  b.add(cyl(0.12, 0.2, 1.0, 12, true), 'coatDark', [0.04, 1.2, 0.08]);
  b.add(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'hat', [-0.05, 1.82, -0.02]);
  b.add(cyl(0.15, 0.15, 0.015, 14), 'hat', [-0.05, 1.82, -0.02]);
  return b.build({ name: 'coatrack' });
}

export function wallFrame(w = 0.6, h = 0.45, canvas = 'pine') {
  const b = new Builder();
  b.add(rbox(w, h, 0.04, 0.01), 'woodDark', [0, 0, 0]);
  b.add(rbox(w - 0.1, h - 0.1, 0.045, 0.005), canvas, [0, 0, 0.004]);
  b.add(rbox(w * 0.4, h * 0.3, 0.048, 0.005), 'paperOld', [w * 0.1, -h * 0.05, 0.006]);
  return b.build({ name: 'frame', cast: false });
}

export function wallClock() {
  const b = new Builder();
  b.add(rbox(0.36, 0.7, 0.14, 0.03), 'woodDark', [0, 0, 0]);
  b.add(cyl(0.14, 0.14, 0.02, 20), 'paper', [0, 0.14, 0.075], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.add(rbox(0.008, 0.025, 0.01, 0.002), 'iron', [Math.sin(a) * 0.115, 0.14 + Math.cos(a) * 0.115, 0.088], [0, 0, -a]);
  }
  // stopped at 3:13, like the chapel
  b.add(rbox(0.012, 0.07, 0.008, 0.002), 'iron', [0.035, 0.137, 0.092], [0, 0, -1.684]);
  b.add(rbox(0.008, 0.1, 0.008, 0.002), 'iron', [0.049, 0.15, 0.095], [0, 0, -1.361]);
  b.add(rbox(0.22, 0.26, 0.02, 0.01), 'glassDark', [0, -0.16, 0.075]);
  b.add(cyl(0.04, 0.04, 0.01, 10), 'brass', [0.02, -0.2, 0.08], [Math.PI / 2, 0, 0]);
  return b.build({ name: 'clock', cast: false });
}

export function ladder() {
  const b = new Builder();
  for (const s of [-0.2, 0.2]) b.add(rbox(0.05, 2.3, 0.05, 0.01), 'woodGrey', [s, 1.15, 0]);
  for (let i = 0; i < 7; i++) b.add(cyl(0.018, 0.018, 0.42, 6), 'woodGrey', [0, 0.25 + i * 0.3, 0], [0, 0, Math.PI / 2]);
  return b.build({ name: 'ladder' });
}

export function curtains(w = 1.5, h = 1.6) {
  const b = new Builder();
  b.add(cyl(0.02, 0.02, w + 0.3, 6), 'iron', [0, h + 0.05, 0], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) b.add(cyl(0.05, 0.07, h, 8, true), 'clothRed', [s * (w / 2 - 0.06 - k * 0.07), h / 2, k % 2 ? 0.02 : -0.02], [0, 0, 0], [1, 1, 0.5]);
  }
  return b.build({ name: 'curtains', cast: false });
}

export function papers(n = 7, spread = 1.2) {
  const b = new Builder();
  for (let i = 0; i < n; i++) b.add(rbox(0.21, 0.004, 0.29, 0.002), i % 3 ? 'paper' : 'paperOld', [range(-spread, spread), 0.012 + i * 0.001, range(-spread * 0.6, spread * 0.6)], [range(-0.05, 0.05), rand() * 3, 0]);
  return b.build({ name: 'papers', cast: false });
}

export function herbs(len = 1.6) {
  const b = new Builder();
  b.add(cyl(0.008, 0.008, len, 4), 'sack', [0, 0, 0], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 6; i++) {
    const x = -len / 2 + 0.15 + i * ((len - 0.3) / 5);
    b.add(cyl(0.004, 0.004, 0.14, 3), 'sack', [x, -0.07, 0]);
    b.add(cone(0.06, 0.26, 6), i % 2 ? 'grass' : 'pineDark', [x, -0.24, 0], [Math.PI, rand() * 3, 0]);
  }
  return b.build({ name: 'herbs', cast: false });
}

export function jarShelf(w = 1.2) {
  const b = new Builder();
  b.add(rbox(w, 0.04, 0.24, 0.01), 'wood', [0, 0, 0]);
  for (const s of [-1, 1]) b.add(rbox(0.04, 0.2, 0.2, 0.01), 'woodDark', [s * (w / 2 - 0.1), -0.1, -0.02]);
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.12 + i * ((w - 0.24) / 5);
    const h = range(0.14, 0.24);
    b.add(cyl(0.05, 0.055, h, 10), rand() < 0.5 ? 'glassDark' : 'paperOld', [x, 0.02 + h / 2, 0]);
    b.add(cyl(0.045, 0.045, 0.02, 10), 'woodDark', [x, 0.03 + h, 0]);
  }
  return b.build({ name: 'jars', cast: false });
}

/** A glossy pool of spilled lamp oil. */
export function oilSpill() {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = 0.5 + Math.sin(a * 3) * 0.08 + Math.sin(a * 5 + 1) * 0.05;
    const x = Math.cos(a) * r * 1.5, z = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#1a1208', roughness: 0.05, metalness: 0.2, envMapIntensity: 2.5, transparent: true, opacity: 0.85, depthWrite: false }));
  m.name = 'spill';
  m.renderOrder = 2;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* House, inn and chapel pieces                                         */
/* ------------------------------------------------------------------ */

/** Stone hearth against a wall: firebox with embers, mantel with clutter, chimney breast to the beams. */
export function fireplace(h = 3.2) {
  const b = new Builder();
  b.add(rbox(1.9, 1.25, 0.7, 0.04), 'stone', [0, 0.625, 0]);
  b.add(rbox(0.95, 0.78, 0.24, 0.02), 'void', [0, 0.45, 0.25]);
  b.add(rbox(1.15, 0.12, 0.16, 0.03), 'stoneDark', [0, 0.9, 0.31]);
  // coursed stones proud of the face, around the opening
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 4; k++) {
      const x = -0.86 + k * 0.57 + (r % 2) * 0.28 + range(-0.03, 0.03);
      if (Math.abs(x) < 0.55 && r < 4) continue;
      b.add(rbox(range(0.42, 0.52), 0.22, 0.04, 0.03), rand() < 0.5 ? 'stoneDark' : 'stone', [THREE.MathUtils.clamp(x, -0.72, 0.72), 0.13 + r * 0.24, 0.355]);
    }
  }
  // logs and embers
  b.add(cyl(0.06, 0.06, 0.62, 7), 'bark', [0, 0.12, 0.2], [0, 0.2, Math.PI / 2]);
  b.add(cyl(0.05, 0.05, 0.55, 7), 'bark', [0.05, 0.2, 0.16], [0, -0.3, Math.PI / 2]);
  b.add(rbox(0.6, 0.05, 0.3, 0.02), 'ember', [0, 0.08, 0.2]);
  b.add(cone(0.08, 0.2, 6), 'ember', [-0.1, 0.28, 0.18]);
  for (const s of [-1, 1]) b.add(rbox(0.04, 0.22, 0.32, 0.01), 'iron', [s * 0.3, 0.13, 0.22]);
  // kettle on a hook
  b.add(cyl(0.01, 0.01, 0.4, 4), 'iron', [0, 0.62, 0.18]);
  b.add(sphere(0.12, 10, 8), 'iron', [0, 0.36, 0.18], [0, 0, 0], [1, 0.8, 1]);
  // mantel and what sits on it
  b.add(rbox(2.1, 0.1, 0.34, 0.02), 'woodDark', [0, 1.3, 0.08]);
  for (const x of [-0.8, 0.8]) {
    b.add(cyl(0.035, 0.05, 0.16, 8), 'brass', [x, 1.43, 0.12]);
    b.add(cyl(0.02, 0.02, 0.16, 6), 'paper', [x, 1.59, 0.12]);
    b.add(cone(0.012, 0.035, 5), 'lampGlow', [x, 1.69, 0.12]);
  }
  b.add(cyl(0.06, 0.07, 0.18, 10), 'glassDark', [-0.35, 1.44, 0.1]);
  b.add(rbox(0.24, 0.18, 0.03, 0.01), 'woodDark', [0.25, 1.45, 0.0], [-0.12, 0, 0]);
  b.add(rbox(0.18, 0.12, 0.034, 0.005), 'paperOld', [0.25, 1.46, 0.01], [-0.12, 0, 0]);
  // chimney breast up to the ceiling
  b.add(rbox(1.45, h - 1.35, 0.5, 0.03), 'plasterShade', [0, 1.35 + (h - 1.35) / 2, -0.08]);
  b.add(rbox(1.5, 0.08, 0.54, 0.02), 'timber', [0, 2.2, -0.06]);
  // hearthstone, poker and a log pile
  b.add(rbox(2.2, 0.05, 0.6, 0.02), 'stoneDark', [0, 0.025, 0.62]);
  b.add(cyl(0.012, 0.012, 0.75, 5), 'iron', [1.05, 0.38, 0.42], [0, 0, 0.25]);
  for (let i = 0; i < 6; i++) b.add(cyl(0.07, 0.07, 0.5, 7), 'bark', [1.25 + (i % 3) * 0.15 - 0.15, 0.07 + Math.floor(i / 3) * 0.13, 0.25], [Math.PI / 2, 0, 0]);
  return b.build({ name: 'fireplace' });
}

/** A rope bed, slept in and left in a hurry. Head toward -z. */
export function bed() {
  const b = new Builder();
  for (const sx of [-0.62, 0.62]) for (const sz of [-0.98, 0.98]) b.add(rbox(0.08, sz < 0 ? 1.15 : 0.6, 0.08, 0.02), 'woodDark', [sx, sz < 0 ? 0.575 : 0.3, sz]);
  b.add(rbox(1.3, 0.55, 0.05, 0.02), 'wood', [0, 0.82, -0.98]);
  b.add(rbox(1.3, 0.28, 0.05, 0.02), 'wood', [0, 0.42, 0.98]);
  for (const s of [-1, 1]) b.add(rbox(0.06, 0.12, 1.96, 0.02), 'woodDark', [s * 0.62, 0.32, 0]);
  b.add(rbox(1.2, 0.18, 1.9, 0.06), 'sack', [0, 0.45, 0]);
  b.add(rbox(1.26, 0.07, 1.25, 0.05), 'clothRed', [0.02, 0.57, 0.28], [0, 0.04, 0]);
  b.add(rbox(1.24, 0.06, 0.3, 0.04), 'clothRed', [0.05, 0.6, -0.28], [0.25, 0.1, 0]);
  b.add(rbox(0.06, 0.4, 1.0, 0.03), 'clothRed', [0.66, 0.4, 0.4], [0, 0, 0.12]);
  b.add(sphere(0.2, 12, 8), 'paper', [-0.25, 0.6, -0.72], [0, 0.2, 0], [1.3, 0.45, 0.7]);
  b.add(sphere(0.18, 12, 8), 'paperOld', [0.3, 0.6, -0.75], [0, -0.1, 0], [1.3, 0.42, 0.7]);
  return b.build({ name: 'bed' });
}

/** Chest of drawers with a mirror; the top drawer pulled out. Back toward -z. */
export function dresser() {
  const b = new Builder();
  b.add(rbox(1.1, 0.92, 0.5, 0.03), 'woodDark', [0, 0.46, 0]);
  for (let i = 0; i < 3; i++) {
    const out = i === 2 ? 0.18 : 0;
    b.add(rbox(1.0, 0.24, 0.04, 0.015), 'wood', [0, 0.2 + i * 0.27, 0.26 + out]);
    for (const s of [-1, 1]) b.add(sphere(0.02, 6, 4), 'brass', [s * 0.28, 0.2 + i * 0.27, 0.29 + out]);
    if (out) {
      b.add(rbox(0.96, 0.18, 0.2, 0.01), 'woodDark', [0, 0.2 + i * 0.27, 0.16]);
      b.add(rbox(0.3, 0.02, 0.16, 0.005), 'paperOld', [-0.2, 0.3 + i * 0.27, 0.18], [0, 0.3, 0]);
      b.add(rbox(0.25, 0.04, 0.14, 0.01), 'cloth', [0.22, 0.3 + i * 0.27, 0.16]);
    }
  }
  b.add(rbox(1.16, 0.05, 0.54, 0.015), 'wood', [0, 0.94, 0]);
  b.add(rbox(0.62, 0.8, 0.04, 0.02), 'woodDark', [0, 1.38, -0.2], [-0.08, 0, 0]);
  b.add(rbox(0.52, 0.68, 0.045, 0.01), 'glassDark', [0, 1.38, -0.19], [-0.08, 0, 0]);
  b.add(rbox(0.16, 0.1, 0.12, 0.02), 'clothRed', [0.35, 1.02, 0.05]);
  b.add(rbox(0.2, 0.03, 0.06, 0.01), 'woodLight', [-0.32, 0.98, 0.1], [0, 0.4, 0]);
  b.add(cyl(0.03, 0.03, 0.14, 8), 'paper', [-0.42, 1.04, -0.08]);
  return b.build({ name: 'dresser' });
}

export function stool() {
  const b = new Builder();
  b.add(cyl(0.2, 0.19, 0.06, 12), 'wood', [0, 0.68, 0]);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    b.add(cyl(0.025, 0.03, 0.7, 6), 'woodDark', [Math.cos(a) * 0.12, 0.34, Math.sin(a) * 0.12], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]);
  }
  b.add(torus(0.13, 0.012, 4, 12), 'woodDark', [0, 0.25, 0], [Math.PI / 2, 0, 0]);
  return b.build({ name: 'stool' });
}

/** Pewter tankards and a jug, one knocked over. */
export function mugs() {
  const b = new Builder();
  for (const [x, z, tip] of [[-0.3, 0.05, 0], [-0.08, -0.08, 0], [0.18, 0.06, 0], [0.42, -0.02, 1]]) {
    if (tip) b.add(cyl(0.05, 0.05, 0.13, 10), 'stone', [x, 0.05, z], [0, 0.4, Math.PI / 2]);
    else {
      b.add(cyl(0.05, 0.055, 0.13, 10), 'stone', [x, 0.065, z]);
      b.add(torus(0.035, 0.01, 4, 8, Math.PI), 'stone', [x + 0.055, 0.07, z], [0, 0, -Math.PI / 2]);
    }
  }
  b.add(cyl(0.07, 0.09, 0.24, 10), 'woodLight', [-0.55, 0.12, -0.05]);
  b.add(rbox(0.4, 0.004, 0.2, 0.002), 'mud', [0.6, 0.003, 0.02], [0, 0.3, 0]);
  return b.build({ name: 'mugs', cast: false });
}

/** A chapel pew; whoever sits faces -z. */
export function pew(len = 2.2) {
  const b = new Builder();
  b.add(rbox(len, 0.06, 0.42, 0.015), 'wood', [0, 0.45, 0]);
  b.add(rbox(len, 0.55, 0.05, 0.015), 'wood', [0, 0.78, 0.2], [0.1, 0, 0]);
  b.add(rbox(len, 0.05, 0.08, 0.015), 'woodDark', [0, 1.06, 0.23]);
  for (const s of [-1, 1]) {
    b.add(rbox(0.07, 1.0, 0.5, 0.02), 'woodDark', [s * (len / 2), 0.5, 0.02]);
    b.add(cyl(0.25, 0.25, 0.07, 12), 'woodDark', [s * (len / 2), 1.0, 0.02], [0, 0, Math.PI / 2]);
  }
  b.add(rbox(len - 0.1, 0.06, 0.16, 0.015), 'clothRed', [0, 0.12, -0.36]);
  for (const s of [-1, 1]) b.add(rbox(0.04, 0.12, 0.04, 0.01), 'woodDark', [s * (len / 2 - 0.1), 0.06, -0.36]);
  b.add(rbox(0.16, 0.04, 0.22, 0.01), 'clothRed', [range(-0.6, 0.6), 0.5, 0.0], [0, range(-0.4, 0.4), 0]);
  return b.build({ name: 'pew' });
}

/** Stone altar on a step, dressed in linen, candles and a brass cross. Front toward +z. */
export function altar() {
  const b = new Builder();
  b.add(rbox(2.8, 0.15, 1.5, 0.03), 'stoneDark', [0, 0.075, 0]);
  b.add(rbox(1.9, 0.9, 0.75, 0.03), 'stone', [0, 0.6, -0.1]);
  b.add(rbox(2.0, 0.06, 0.82, 0.015), 'paperOld', [0, 1.07, -0.1]);
  b.add(rbox(2.0, 0.45, 0.02, 0.01), 'paperOld', [0, 0.85, 0.32]);
  b.add(rbox(0.3, 0.46, 0.025, 0.005), 'clothRed', [0, 0.85, 0.325]);
  for (const x of [-0.75, 0.75]) {
    b.add(cyl(0.05, 0.07, 0.3, 8), 'brass', [x, 1.25, -0.25]);
    b.add(cyl(0.025, 0.025, 0.24, 6), 'paper', [x, 1.52, -0.25]);
    b.add(cone(0.015, 0.045, 5), 'lampGlow', [x, 1.67, -0.25]);
  }
  b.add(rbox(0.05, 0.55, 0.04, 0.01), 'brass', [0, 1.38, -0.35]);
  b.add(rbox(0.3, 0.05, 0.04, 0.01), 'brass', [0, 1.5, -0.35]);
  b.add(rbox(0.32, 0.06, 0.24, 0.01), 'clothRed', [0.4, 1.13, -0.02], [0, -0.2, 0]);
  b.add(rbox(0.28, 0.065, 0.2, 0.005), 'paperOld', [0.4, 1.135, -0.02], [0, -0.2, 0]);
  return b.build({ name: 'altar' });
}

/** Votive stand: a tray of small candles, some guttered out. */
export function candleStand() {
  const b = new Builder();
  b.add(cyl(0.18, 0.22, 0.05, 10), 'iron', [0, 0.025, 0]);
  b.add(cyl(0.025, 0.025, 1.0, 6), 'iron', [0, 0.52, 0]);
  b.add(cyl(0.34, 0.3, 0.05, 14), 'iron', [0, 1.04, 0]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = i % 2 ? 0.22 : 0.12;
    const h = range(0.05, 0.14);
    b.add(cyl(0.018, 0.02, h, 6), 'paper', [Math.cos(a) * r, 1.07 + h / 2, Math.sin(a) * r]);
    if (i % 3) b.add(cone(0.01, 0.03, 5), 'lampGlow', [Math.cos(a) * r, 1.09 + h, Math.sin(a) * r]);
  }
  return b.build({ name: 'candles' });
}

export function lectern() {
  const b = new Builder();
  b.add(rbox(0.5, 0.06, 0.4, 0.02), 'woodDark', [0, 0.03, 0]);
  b.add(rbox(0.12, 1.0, 0.12, 0.02), 'woodDark', [0, 0.55, 0]);
  b.add(rbox(0.56, 0.05, 0.42, 0.015), 'wood', [0, 1.1, 0], [0.4, 0, 0]);
  b.add(rbox(0.44, 0.04, 0.3, 0.01), 'paperOld', [0, 1.14, 0.0], [0.4, 0, 0]);
  b.add(rbox(0.02, 0.05, 0.3, 0.005), 'clothRed', [0, 1.15, 0.0], [0.4, 0, 0]);
  return b.build({ name: 'lectern' });
}

export function runner(len = 7, w = 1.1) {
  const b = new Builder();
  b.add(rbox(w, 0.02, len, 0.005), 'clothRed', [0, 0.05, 0]);
  for (const s of [-1, 1]) b.add(rbox(0.08, 0.022, len, 0.004), 'sack', [s * (w / 2 - 0.08), 0.051, 0]);
  return b.build({ name: 'runner', cast: false });
}

/** Worn flagstones laid over the floor. */
export function flagstones(w, d) {
  const b = new Builder();
  // running bond: rows of worn slabs of different lengths, tight joints, mostly dark stone
  let z = -d / 2;
  while (z < d / 2 - 0.05) {
    const depth = Math.min(range(0.5, 0.72), d / 2 - z);
    let x = -w / 2 - range(0, 0.4);
    while (x < w / 2) {
      const len = range(0.6, 1.05);
      const x0 = Math.max(x, -w / 2), x1 = Math.min(x + len, w / 2);
      if (x1 - x0 > 0.08) {
        const r = rand();
        const key = r < 0.55 ? 'stoneDark' : r < 0.85 ? 'rock' : 'stone';
        b.add(rbox(x1 - x0 - 0.025, 0.04 + range(0, 0.01), depth - 0.025, 0.01, 1), key, [(x0 + x1) / 2, 0.02 + range(-0.004, 0.004), z + depth / 2], [range(-0.006, 0.006), 0, range(-0.006, 0.006)]);
      }
      x += len;
    }
    z += depth;
  }
  b.add(rbox(w, 0.01, d, 0.002), 'rockDark', [0, 0.004, 0]);
  return b.build({ name: 'flagstones', cast: false, textured: false });
}

/** A bell rope dropping through the ceiling, its striped grip, the tail coiled on the floor. */
export function bellRope(h = 3.2) {
  const b = new Builder();
  b.add(cyl(0.018, 0.018, h, 5), 'sack', [0, h / 2, 0]);
  b.add(cyl(0.04, 0.04, 0.5, 8), 'clothRed', [0, 1.3, 0]);
  for (let i = 0; i < 4; i++) b.add(cyl(0.042, 0.042, 0.04, 8), 'paper', [0, 1.1 + i * 0.13, 0]);
  for (let i = 0; i < 3; i++) b.add(torus(0.16 - i * 0.03, 0.02, 4, 12), 'sack', [0.05, 0.02 + i * 0.035, 0.05], [Math.PI / 2, 0, 0]);
  return b.build({ name: 'bellrope', cast: false });
}

/* ------------------------------------------------------------------ */
/* Street pieces                                                         */
/* ------------------------------------------------------------------ */

/** Instanced cobbles over a dark bed, wet between the stones. */
export function cobbles(w, d, step = 0.19) {
  const g = new THREE.Group();
  g.name = 'cobbles';
  const stone = (key) => {
    const b = new Builder();
    b.add(ico(0.098, 0), key, [0, 0, 0], [0, 0, 0], [1, 0.34, 0.85], true);
    return b.geometry();
  };
  const geoms = [stone('cobble'), stone('cobbleDark')];
  const nx = Math.ceil(w / step), nz = Math.ceil(d / step);
  const meshes = geoms.map((geo) => new THREE.InstancedMesh(geo, paletteMat(), nx * nz));
  const counts = [0, 0];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const k = rand() < 0.4 ? 1 : 0;
      p.set(-w / 2 + i * step + (j % 2) * step * 0.5 + range(-0.03, 0.03), 0.012, -d / 2 + j * step + range(-0.03, 0.03));
      q.setFromAxisAngle(up, rand() * Math.PI);
      const sc = range(0.85, 1.15);
      s.set(sc, range(0.8, 1.2), sc);
      meshes[k].setMatrixAt(counts[k]++, m.compose(p, q, s));
    }
  }
  meshes.forEach((mesh, k) => {
    mesh.count = counts[k];
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    g.add(mesh);
  });
  const bedB = new Builder();
  bedB.add(rbox(w, 0.04, d, 0.005), 'mud', [0, -0.01, 0]);
  g.add(bedB.build({ name: 'cobblebed', cast: false, textured: false }));
  return g;
}

/** Snow banked against a wall or kerb. */
export function snowDrift(len = 3) {
  const b = new Builder();
  const n = Math.max(3, Math.round(len / 0.5));
  for (let i = 0; i < n; i++) {
    b.add(sphere(0.38, 9, 6), i % 3 ? 'snow' : 'snowShade', [-len / 2 + (i + 0.5) * (len / n) + range(-0.1, 0.1), 0.02, range(-0.08, 0.08)], [0, rand() * 3, 0], [range(1.2, 1.7), range(0.28, 0.45), range(0.7, 1.0)]);
  }
  return b.build({ name: 'drift', cast: false, textured: false });
}

export function puddle(r = 0.6) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rr = r * (1 + Math.sin(a * 3 + r * 7) * 0.12 + Math.sin(a * 5) * 0.06);
    const x = Math.cos(a) * rr * 1.4, z = Math.sin(a) * rr;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0d131c', roughness: 0.04, metalness: 0.3, envMapIntensity: 3, transparent: true, opacity: 0.8, depthWrite: false }));
  m.name = 'puddle';
  m.renderOrder = 2;
  m.receiveShadow = true;
  return m;
}

/** An iron-bound chest, lid propped open on a chain. Front toward +z. */
export function chest() {
  const b = new Builder();
  b.add(rbox(1.0, 0.5, 0.55, 0.03), 'wood', [0, 0.25, 0]);
  for (const x of [-0.38, 0, 0.38]) b.add(rbox(0.05, 0.52, 0.57, 0.01), 'iron', [x, 0.25, 0]);
  b.add(rbox(0.12, 0.12, 0.02, 0.01), 'brass', [0, 0.38, 0.285]);
  b.add(rbox(1.02, 0.08, 0.57, 0.02), 'woodDark', [0, 0.52, -0.24], [-1.15, 0, 0]);
  b.add(rbox(0.94, 0.04, 0.47, 0.01), 'void', [0, 0.49, 0]);
  b.add(rbox(0.5, 0.06, 0.3, 0.02), 'clothRed', [-0.15, 0.47, 0.05], [0, 0.2, 0.05]);
  b.add(rbox(0.22, 0.02, 0.16, 0.005), 'paperOld', [0.25, 0.5, 0.0], [0, -0.4, 0]);
  return b.build({ name: 'chest' });
}

/** A wicker basket of split logs. */
export function logBasket() {
  const b = new Builder();
  b.add(cyl(0.3, 0.26, 0.4, 12, true), 'sack', [0, 0.2, 0]);
  b.add(cyl(0.26, 0.26, 0.02, 12), 'sack', [0, 0.01, 0]);
  for (let i = 0; i < 6; i++) b.add(cyl(0.05, 0.05, 0.62, 6), 'bark', [range(-0.14, 0.14), 0.4 + (i % 2) * 0.06, range(-0.14, 0.14)], [Math.PI / 2 + range(-0.2, 0.2), rand() * 3, 0]);
  return b.build({ name: 'logs' });
}

import * as THREE from 'three';
import { K, bake } from './kit.js';

/**
 * Assembles a house from the Medieval Village MegaKit on its 2 m grid.
 * Authored facing +Z in kit metres; the returned group is scaled to world units.
 *
 * spec = {
 *   w: 2|3 modules wide, d: 2..4 modules deep (d >= w), floors: 1|2,
 *   ground: 'brick'|'plaster', upper: 'plaster'|'grid',
 *   front:  ground-floor slots, left to right: 'door'|'doorRound'|'window'|'thin'|'arch'|'wall'
 *   front2: upper-floor slots, same tokens
 *   sides:  token used on the visible side walls (default 'window'),
 *   lit: Set of "floor:slot" keys whose windows glow (e.g. '1:0'), or 'all'
 *   shutters: true | 'closed' | false, ajar: door left open, chimney: 'left'|'right'|false,
 *   vines: true, balcony: slot index on the upper floor
 * }
 */
export function kitHouse(kit, spec) {
  const {
    w = 2, d = 2, floors = 2, ground = 'brick', upper = 'plaster',
    front = ['door', 'window'], front2 = null, sides = 'window', back = 'wall',
    lit = new Set(), shutters = true, ajar = false, chimney = 'right', vines = false, balcony = null,
    boarded = false,
  } = spec;
  const W = w * 2, D = d * 2, FH = 3.0;
  const g = new THREE.Group();
  const glassSwap = (key) => {
    const on = lit === 'all' || lit.has?.(key);
    return on ? { swap: { MI_WindowGlass: 'MI_WindowGlass_Lit' } } : undefined;
  };

  const style = (floor) => (floor === 0 ? ground : upper);
  const wallFor = (floor, token) => {
    const s = style(floor);
    if (s === 'brick') {
      return {
        wall: 'Wall_UnevenBrick_Straight', window: 'Wall_UnevenBrick_Window_Wide_Round', thin: 'Wall_UnevenBrick_Window_Thin_Round',
        door: 'Wall_UnevenBrick_Door_Flat', doorRound: 'Wall_UnevenBrick_Door_Round',
      }[token] || 'Wall_UnevenBrick_Straight';
    }
    if (token === 'wall' && s === 'grid') return 'Wall_Plaster_WoodGrid';
    return {
      wall: floor === 0 ? 'Wall_Plaster_Straight_Base' : 'Wall_Plaster_Straight', window: 'Wall_Plaster_Window_Wide_Flat',
      thin: 'Wall_Plaster_Window_Thin_Round', door: 'Wall_Plaster_Door_Flat', doorRound: 'Wall_Plaster_Door_Round',
    }[token] || 'Wall_Plaster_Straight';
  };
  const fill = (floor, token, slotKey, x, y, z, r) => {
    const s = style(floor);
    if (token === 'window') {
      const round = s === 'brick';
      kit.place(g, round ? 'Window_Wide_Round1' : 'Window_Wide_Flat1', x, y, z, r, glassSwap(slotKey));
      if (boarded) kit.place(g, round ? 'WindowShutters_Wide_Round_Closed' : 'WindowShutters_Wide_Flat_Closed', x, y, z, r);
      else if (shutters) kit.place(g, round ? 'WindowShutters_Wide_Round_Closed' : shutters === 'closed' ? 'WindowShutters_Wide_Flat_Closed' : 'WindowShutters_Wide_Flat_Open', x, y, z, r);
    } else if (token === 'thin') {
      kit.place(g, 'Window_Thin_Round1', x, y, z, r, glassSwap(slotKey));
      if (boarded || shutters === 'closed') kit.place(g, 'WindowShutters_Thin_Round_Closed', x, y, z, r);
      else if (shutters) kit.place(g, 'WindowShutters_Thin_Round_Open', x, y, z, r);
    } else if (token === 'door' || token === 'doorRound') {
      const round = token === 'doorRound';
      kit.place(g, round ? 'DoorFrame_Round_Brick' : 'DoorFrame_Flat_WoodDark', x, y, z, r);
      const door = kit.place(g, round ? 'Door_8_Round' : s === 'brick' ? 'Door_4_Flat' : 'Door_1_Flat', 0, y, 0, 0, glassSwap(slotKey));
      // hinge sits at the door's local origin: centre it in the opening, swing it open if ajar
      const hinge = new THREE.Vector3(-0.56, 0, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), r);
      door.position.set(x + hinge.x, y, z + hinge.z);
      door.rotation.y = r + (ajar ? -1.1 : 0);
    }
  };

  for (let f = 0; f < floors; f++) {
    const y = f * FH;
    const slots = f === 0 ? front : front2 || Array.from({ length: w }, (_, i) => (i % 2 ? 'thin' : 'window'));
    // front (+z) and back (-z)
    for (let i = 0; i < w; i++) {
      const x = -W / 2 + 1 + i * 2;
      const tok = slots[i] || 'wall';
      kit.place(g, wallFor(f, tok), x, y, D / 2, 0);
      fill(f, tok, `${f}:${i}`, x, y, D / 2, 0);
      kit.place(g, wallFor(f, back), x, y, -D / 2, Math.PI);
      if (balcony === i && f === 1) kit.place(g, 'Balcony_Simple_Straight', x, y, D / 2 - 0.9, 0);
    }
    // sides
    for (let j = 0; j < d; j++) {
      const z = -D / 2 + 1 + j * 2;
      const tok = (j + f) % 2 === 0 ? sides : 'wall';
      kit.place(g, wallFor(f, tok), W / 2, y, z, Math.PI / 2);
      fill(f, tok, `${f}:s${j}`, W / 2, y, z, Math.PI / 2);
      kit.place(g, wallFor(f, 'wall'), -W / 2, y, z, -Math.PI / 2);
    }
    // timber posts on the corners
    const corner = style(f) === 'brick' ? 'Corner_Exterior_Brick' : 'Corner_Exterior_Wood';
    kit.place(g, corner, W / 2, y, D / 2, 0);
    kit.place(g, corner, -W / 2, y, D / 2, -Math.PI / 2);
    kit.place(g, corner, W / 2, y, -D / 2, Math.PI / 2);
    kit.place(g, corner, -W / 2, y, -D / 2, Math.PI);
    // floor trim between storeys
    if (f > 0) {
      for (let i = 0; i < w; i++) {
        const x = -W / 2 + 1 + i * 2;
        kit.place(g, 'Wall_BottomCover', x, y, D / 2, 0);
        kit.place(g, 'Wall_BottomCover', x, y, -D / 2, Math.PI);
      }
      for (let j = 0; j < d; j++) {
        const z = -D / 2 + 1 + j * 2;
        kit.place(g, 'Wall_BottomCover', W / 2, y, z, Math.PI / 2);
        kit.place(g, 'Wall_BottomCover', -W / 2, y, z, -Math.PI / 2);
      }
    }
  }

  // roof: ridge runs front to back, gables face the street
  const top = floors * FH;
  const roofName = `Roof_RoundTiles_${W}x${Math.max(D, W)}`;
  kit.place(g, kit.has(roofName) ? roofName : `Roof_RoundTiles_${W}x${W}`, 0, top, 0, 0);
  const gable = W === 6 ? 'Roof_Front_Brick6' : 'Roof_Front_Brick4';
  kit.place(g, gable, 0, top, D / 2, 0);
  kit.place(g, gable, 0, top, -D / 2, Math.PI);

  let chimneyTop = null;
  if (chimney) {
    const cx = chimney === 'left' ? -W / 2 + 1.0 : W / 2 - 1.0;
    const cz = -D / 2 + 1.4;
    kit.place(g, 'Prop_Chimney', cx, top - 0.4, cz, 0);
    chimneyTop = new THREE.Vector3(cx, top + 2.85, cz).multiplyScalar(K);
  }
  if (vines) {
    kit.place(g, 'Prop_Vine1', W / 2 - 0.6, FH - 0.1, D / 2 + 0.12, 0);
    kit.place(g, 'Prop_Vine2', W / 2 + 0.12, FH * floors - 0.2, -0.4, Math.PI / 2);
  }
  // stone kerb around the base
  for (let i = 0; i < w; i++) kit.place(g, 'Prop_ExteriorBorder_Straight1', -W / 2 + 1 + i * 2, 0, D / 2 + 0.1, 0);

  const baked = bake(g);
  g.traverse(() => {});
  const holder = new THREE.Group();
  baked.scale.setScalar(K);
  holder.add(baked);
  return {
    group: holder,
    chimneyTop,
    footprint: { w: (W + 0.7) * K, d: (D + 0.7) * K },
    height: (top + 4) * K,
  };
}

/** Bell tower and nave, built from the same kit. */
export function kitChapel(kit) {
  const g = new THREE.Group();
  const FH = 3.0;
  // nave: 6 m wide, 8 m deep, brick, round door, cold-lit windows
  const nave = new THREE.Group();
  const W = 6, D = 8;
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + 1 + i * 2;
    const front = i === 1 ? 'Wall_UnevenBrick_Door_Round' : 'Wall_UnevenBrick_Straight';
    kit.place(nave, front, x, 0, D / 2, 0);
    kit.place(nave, 'Wall_UnevenBrick_Straight', x, 0, -D / 2, Math.PI);
  }
  kit.place(nave, 'DoorFrame_Round_Brick', 0, 0, D / 2, 0);
  const door = kit.place(nave, 'Door_8_Round', 0, 0, 0, 0);
  door.position.set(-0.56, 0, D / 2 + 0.02);
  for (let j = 0; j < 4; j++) {
    const z = -D / 2 + 1 + j * 2;
    kit.place(nave, 'Wall_UnevenBrick_Window_Thin_Round', W / 2, 0, z, Math.PI / 2);
    kit.place(nave, 'Window_Thin_Round1', W / 2, 0, z, Math.PI / 2, j % 2 === 0 ? { swap: { MI_WindowGlass: 'MI_WindowGlass_Cold' } } : undefined);
    kit.place(nave, 'Wall_UnevenBrick_Straight', -W / 2, 0, z, -Math.PI / 2);
  }
  kit.place(nave, 'Corner_Exterior_Brick', W / 2, 0, D / 2, 0);
  kit.place(nave, 'Corner_Exterior_Brick', -W / 2, 0, D / 2, -Math.PI / 2);
  kit.place(nave, 'Corner_Exterior_Brick', W / 2, 0, -D / 2, Math.PI / 2);
  kit.place(nave, 'Roof_RoundTiles_6x8', 0, FH, 0, 0);
  kit.place(nave, 'Roof_Front_Brick6', 0, FH, D / 2, 0);
  kit.place(nave, 'Roof_Front_Brick6', 0, FH, -D / 2, Math.PI);
  kit.place(nave, 'Stairs_Exterior_Straight', 0, 0, D / 2 + 1.1, 0);
  nave.position.set(0, 0, 3.6);
  g.add(nave);

  // tower: 4 m square, three storeys of brick
  const tower = new THREE.Group();
  const T = 4;
  for (let f = 0; f < 3; f++) {
    const y = f * FH;
    for (let i = 0; i < 2; i++) {
      const p = -T / 2 + 1 + i * 2;
      const tok = f === 2 ? 'Wall_UnevenBrick_Window_Thin_Round' : 'Wall_UnevenBrick_Straight';
      kit.place(tower, tok, p, y, T / 2, 0);
      kit.place(tower, tok, T / 2, y, p, Math.PI / 2);
      kit.place(tower, 'Wall_UnevenBrick_Straight', p, y, -T / 2, Math.PI);
      kit.place(tower, 'Wall_UnevenBrick_Straight', -T / 2, y, p, -Math.PI / 2);
      if (f === 2) {
        kit.place(tower, 'Window_Thin_Round1', p, y, T / 2, 0);
        kit.place(tower, 'Window_Thin_Round1', T / 2, y, p, Math.PI / 2);
      }
    }
    kit.place(tower, 'Corner_Exterior_Brick', T / 2, y, T / 2, 0);
    kit.place(tower, 'Corner_Exterior_Brick', -T / 2, y, T / 2, -Math.PI / 2);
    kit.place(tower, 'Corner_Exterior_Brick', T / 2, y, -T / 2, Math.PI / 2);
  }
  kit.place(tower, 'Roof_Tower_RoundTiles', 0, 3 * FH, 0, 0);
  tower.position.set(0, 0, -3.0);
  g.add(tower);

  const baked = bake(g);
  baked.scale.setScalar(K);
  const holder = new THREE.Group();
  holder.add(baked);
  return {
    group: holder,
    // world-unit footprints relative to the chapel origin
    nave: { x: 0, z: 3.6 * K, w: (W + 0.8) * K, d: (D + 2.4) * K },
    tower: { x: 0, z: -3.0 * K, w: (T + 0.8) * K, d: (T + 0.8) * K },
    clock: [new THREE.Vector3(0, 4.7 * K, (-3.0 + T / 2 + 0.14) * K), new THREE.Vector3((T / 2 + 0.14) * K, 4.7 * K, -3.0 * K)],
    bellPos: new THREE.Vector3(0, 8.2 * K, -3.0 * K),
  };
}

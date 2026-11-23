import * as THREE from 'three';
import * as F from './furniture.js';
import { Builder } from '../core/geo.js';
import { lampPost, well, cart, bench, noticeBoard, fence, signpost, barrel, crate } from '../world/props.js';

/**
 * Crime scenes, as data. A case picks a scene kind and may add or remove props:
 *
 *   scene: { type: 'room', kind: 'shop' | 'house' | 'inn' | 'chapel', add: [...], remove: ['id', ...] }
 *   scene: { type: 'street', add: [...], remove: [...] }
 *
 * A prop is { id, piece, at: [x, y, z], ry, rx, args, label, light, block }. `id` is what
 * evidence.object points at; `label` is the place name shown before it is searched.
 * Rooms share one shell size, so every layout below uses the same coordinates.
 */

export const RK = 0.82; // kit metres -> room units
export const W = 14, D = 12; // shell size in kit metres
export const CEIL = 4.0 * RK;
export const HW = (W * RK) / 2, HD = (D * RK) / 2;
const backZ = -HD + 0.27, frontZ = HD - 0.27, leftX = -HW + 0.27, rightX = HW - 0.27;
const PI = Math.PI;
/** Centre of a wall module: back/front run along x (0..6), left/right along z (0..5). */
export const slotX = (i) => (-W / 2 + 1 + i * 2) * RK;
export const slotZ = (j) => (-D / 2 + 1 + j * 2) * RK;

const built = (fn, name, opts) => () => {
  const b = new Builder();
  fn(b);
  return b.build({ name, ...opts });
};

/** Every piece a scene can use: how to make it, whether it blocks walking or the camera, its place name. */
export const PIECES = {
  // shop
  counter: { make: F.counter, block: 1, occlude: 1, label: 'The counter' },
  ledger: { make: F.ledger, label: 'The ledger' },
  cashDrawer: { make: F.cashDrawer, label: 'The cash box' },
  lampShelf: { make: F.lampShelf, block: 1, occlude: 1, label: 'The lamp shelf' },
  workbench: { make: F.workbench, block: 1, occlude: 1, label: 'The workbench' },
  lampIron: { make: F.lampIron, label: 'Something on the floor' },
  stove: { make: F.stove, block: 1, occlude: 1, label: 'The stove' },
  // any room
  wardrobe: { make: F.wardrobe, block: 1, occlude: 1, label: 'The wardrobe' },
  crateStack: { make: F.crateStack, block: 1, occlude: 1, label: 'The crates' },
  barrels: { make: F.barrels, block: 1, occlude: 1, label: 'The barrels' },
  rug: { make: F.rug },
  body: { make: F.coveredBody, block: 1, label: 'The body' },
  bootPrints: { make: F.bootPrints, label: 'Marks on the floor' },
  chair: { make: F.overturnedChair, block: 1, label: 'The fallen chair' },
  wallLamp: { make: F.wallLamp },
  hangingLamp: { make: F.hangingLamp, swing: 1 },
  bookcase: { make: F.bookcase, block: 1, occlude: 1, label: 'The bookcase' },
  table: { make: F.tableSet, block: 1, occlude: 1, label: 'The table' },
  coatRack: { make: F.coatRack, block: 1, occlude: 1, label: 'The coat rack' },
  frame: { make: F.wallFrame, occlude: 1, label: 'A picture on the wall' },
  clock: { make: F.wallClock, occlude: 1, label: 'The clock' },
  ladder: { make: F.ladder, block: 1, occlude: 1, label: 'The ladder' },
  curtains: { make: F.curtains, occlude: 1, label: 'The curtains' },
  papers: { make: F.papers, label: 'Scattered papers' },
  herbs: { make: F.herbs, occlude: 1 },
  jarShelf: { make: F.jarShelf, occlude: 1, label: 'The jars' },
  spill: { make: F.oilSpill, label: 'A spill on the floor' },
  chest: { make: F.chest, block: 1, label: 'The chest' },
  logBasket: { make: F.logBasket, block: 1, label: 'The log basket' },
  fireplace: { make: F.fireplace, block: 1, occlude: 1, label: 'The fireplace' },
  bed: { make: F.bed, block: 1, label: 'The bed' },
  dresser: { make: F.dresser, block: 1, occlude: 1, label: 'The dresser' },
  stool: { make: F.stool, block: 1, label: 'A stool' },
  mugs: { make: F.mugs, label: 'The tankards' },
  pew: { make: F.pew, block: 1, label: 'A pew' },
  altar: { make: F.altar, block: 1, occlude: 1, label: 'The altar' },
  candleStand: { make: F.candleStand, block: 1, label: 'The candles' },
  lectern: { make: F.lectern, block: 1, label: 'The lectern' },
  runner: { make: F.runner },
  flagstones: { make: F.flagstones },
  bellRope: { make: F.bellRope, label: 'The bell rope' },
  // street
  cobbles: { make: F.cobbles },
  drift: { make: F.snowDrift, label: 'A snowdrift' },
  puddle: { make: F.puddle, label: 'A puddle' },
  lampPost: { make: () => lampPost().mesh, block: 1, occlude: 1, label: 'The street lamp' },
  well: { make: well, block: 1, occlude: 1, label: 'The well' },
  cart: { make: cart, block: 1, occlude: 1, label: 'The cart' },
  bench: { make: bench, block: 1, label: 'The bench' },
  noticeBoard: { make: noticeBoard, block: 1, occlude: 1, label: 'The notice board' },
  fence: { make: fence, block: 1, label: 'The fence' },
  signpost: { make: signpost, block: 1, label: 'The signpost' },
  snowBarrels: { make: built((b) => { b.addBuilder(barrel(true)); b.addBuilder(barrel(true), [0.6, 0, 0.2]); }, 'barrels'), block: 1, occlude: 1, label: 'The barrels' },
  snowCrates: { make: built((b) => { b.addBuilder(crate(0.6, true)); b.addBuilder(crate(0.5, true), [0.66, 0, 0.1], [0, 0.4, 0]); b.addBuilder(crate(0.45, true), [0.3, 0.6, 0], [0, -0.3, 0]); }, 'crates'), block: 1, occlude: 1, label: 'The crates' },
  // an invisible box: for things that are part of a wall, like a window
  proxy: { make: (w = 1.2, h = 1.2, d = 0.3) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false })) },
};

const lamp = (color, i, at = [0, 0, 0]) => ({ at, color, i });
const P = (id, piece, x, y, z, ry = 0, rx = 0, extra = {}) => ({ id, piece, at: [x, y, z], ry, rx, ...extra });

/* ------------------------------------------------------------------ */
/* Room kinds                                                           */
/* ------------------------------------------------------------------ */

const SHOP = {
  shell: { walls: 'plaster', grid: true, windows: { back: [2], front: [5], right: [2] }, winType: 'wide' },
  moon: { x: slotX(2), w: 1.25, h: 1.2 },
  spot: { at: [0.6, CEIL - 1.35, -2.75], target: [0.5, 0, -2.0] },
  layout: [
    P('rug', 'rug', 0.0, 0, 0.9),
    P('counter', 'counter', 0.4, 0, -2.2),
    P('ledger', 'ledger', -0.2, 1.03, -2.22, 0.1, 0, { label: 'The counter ledger' }),
    P('drawer', 'cashDrawer', 1.75, 1.03, -2.18, -0.2),
    P('body', 'body', 0.6, 0, -3.4, 0.05, 0, { label: 'Edmund Crane' }),
    P('spill', 'spill', -0.55, 0.014, -3.55, 0.3),
    P('chair', 'chair', -1.4, 0, -3.3, 0.4),
    P('papers', 'papers', 0.5, 0, -1.25, 0, 0, { args: [8, 0.9] }),
    P('shelf', 'lampShelf', 3.65, 0, backZ + 0.22, 0, 0, { light: lamp('#ffb468', 2.4, [-0.05, 1.35, 0.23]) }),
    P('ladder', 'ladder', 2.2, 0, backZ + 0.55, 0.15, -0.28),
    P('jars', 'jarShelf', 0.9, 1.8, backZ + 0.13, 0, 0, { args: [1.3] }),
    P('frame1', 'frame', -0.35, 2.05, backZ + 0.03, 0, 0, { args: [0.7, 0.5, 'pine'] }),
    P('curtains1', 'curtains', slotX(2), 0.85, backZ + 0.07, 0, 0, { args: [1.5, 1.6] }),
    P('stove', 'stove', leftX + 0.45, 0, -HD + 0.85, 0, 0, { light: lamp('#ff6a2a', 4.0, [0.05, 0.55, 0.5]) }),
    P('wardrobe', 'wardrobe', leftX + 0.32, 0, -2.6, PI / 2),
    P('workbench', 'workbench', leftX + 0.42, 0, -0.1, PI / 2),
    P('clock', 'clock', leftX + 0.08, 2.15, 1.45, PI / 2),
    P('frame2', 'frame', leftX + 0.03, 2.2, -1.25, PI / 2, 0, { args: [0.5, 0.62, 'clothRed'] }),
    P('coatrack', 'coatRack', leftX + 0.45, 0, 2.55),
    P('walllamp', 'wallLamp', leftX - 0.02, 1.95, 3.1, PI / 2, 0, { light: lamp('#ffb468', 2.2, [0.37, -0.1, 0]) }),
    P('lampiron', 'lampIron', -4.35, 0, 0.75, 0.55, 0, { label: 'Under the workbench' }),
    P('prints', 'bootPrints', leftX + 0.35, 0, 3.95, 0, 0, { label: 'By the door' }),
    P('crates', 'crateStack', -2.7, 0, frontZ - 0.45, 0.2, 0, { label: 'Crates by the door' }),
    P('bookcase', 'bookcase', rightX - 0.2, 0, -2.3, -PI / 2),
    P('curtains2', 'curtains', rightX - 0.07, 0.85, slotZ(2), -PI / 2, 0, { args: [1.5, 1.6] }),
    P('table', 'table', 3.7, 0, 1.1, 0.1, 0, { light: lamp('#ffa050', 0.9, [-0.1, 1.0, -0.1]) }),
    P('barrels', 'barrels', 4.85, 0, -3.65),
    P('frame3', 'frame', rightX - 0.03, 2.05, 1.6, -PI / 2, 0, { args: [0.6, 0.45, 'cloth'] }),
    P('herbs1', 'herbs', -3.0, CEIL - 0.3, -2.0, 0, 0, { args: [1.6] }),
    P('herbs2', 'herbs', 3.4, CEIL - 0.3, -2.6, 0.3, 0, { args: [1.4] }),
    P('lampA', 'hangingLamp', 0.6, CEIL - 0.28, -2.75, 0, 0, { args: [0.85], light: lamp('#ffb468', 2.6, [0, -0.95, 0]) }),
    P('lampB', 'hangingLamp', -2.4, CEIL - 0.28, 1.9, 0, 0, { args: [0.7], light: lamp('#ffb468', 5.5, [0, -0.9, 0]) }),
    P('window', 'proxy', slotX(2), 1.55, backZ - 0.05, 0, 0, { args: [1.4, 1.4, 0.3], label: 'The window' }),
  ],
};

const HOUSE = {
  shell: { walls: 'plaster', grid: false, windows: { back: [1], front: [5], right: [2] }, winType: 'wide' },
  moon: { x: slotX(1), w: 1.25, h: 1.2 },
  spot: { at: [0.1, CEIL - 1.3, 0.8], target: [0.4, 0, -0.6] },
  layout: [
    P('rug', 'rug', 0.2, 0, 0.6, 0.05),
    P('fireplace', 'fireplace', 1.0, 0, backZ + 0.35, 0, 0, { args: [CEIL], light: lamp('#ff7a30', 6.0, [0, 0.45, 0.6]) }),
    P('clock', 'clock', 2.55, 2.1, backZ + 0.08),
    P('curtains1', 'curtains', slotX(1), 0.85, backZ + 0.07, 0, 0, { args: [1.5, 1.6] }),
    P('bookcase', 'bookcase', -1.3, 0, backZ + 0.2),
    P('dresser', 'dresser', 3.9, 0, backZ + 0.3, 0, 0, { light: lamp('#ffb468', 0.8, [-0.42, 1.2, 0.1]) }),
    P('bed', 'bed', rightX - 1.05, 0, -2.85, -PI / 2),
    P('curtains2', 'curtains', rightX - 0.07, 0.85, slotZ(2), -PI / 2, 0, { args: [1.5, 1.6] }),
    P('table', 'table', 0.0, 0, 0.9, 0.15, 0, { light: lamp('#ffa050', 0.9, [-0.1, 1.0, -0.2]) }),
    P('body', 'body', 0.3, 0, -2.55, 0.15, 0, { label: 'The body' }),
    P('chair', 'chair', -1.7, 0, -2.4, 0.4),
    P('papers', 'papers', 1.7, 0, -1.5, 0, 0, { args: [5, 0.6] }),
    P('wardrobe', 'wardrobe', leftX + 0.32, 0, -2.3, PI / 2),
    P('coatrack', 'coatRack', leftX + 0.45, 0, 2.55),
    P('walllamp', 'wallLamp', leftX - 0.02, 1.95, 3.1, PI / 2, 0, { light: lamp('#ffb468', 2.2, [0.37, -0.1, 0]) }),
    P('frame1', 'frame', leftX + 0.03, 2.1, -0.4, PI / 2, 0, { args: [0.55, 0.7, 'clothRed'] }),
    P('chest', 'chest', leftX + 0.42, 0, 0.5, PI / 2),
    P('stool', 'stool', 2.35, 0, -3.15),
    P('logs', 'logBasket', -0.35, 0, backZ + 0.75),
    P('rug2', 'rug', -2.6, 0, 2.2, 0.3, 0, { scale: 0.6 }),
    P('frame2', 'frame', -2.9, 2.05, backZ + 0.03, 0, 0, { args: [0.45, 0.35, 'pine'] }),
    P('barrels', 'barrels', -4.4, 0, -3.95),
    P('jars', 'jarShelf', -4.45, 1.85, backZ + 0.13, 0, 0, { args: [1.0] }),
    P('herbs1', 'herbs', -2.6, CEIL - 0.3, -2.0, 0, 0, { args: [1.6] }),
    P('herbs2', 'herbs', 2.8, CEIL - 0.3, 0.8, 0.4, 0, { args: [1.4] }),
    P('lampA', 'hangingLamp', 0.1, CEIL - 0.28, 0.8, 0, 0, { args: [0.85], light: lamp('#ffb468', 3.0, [0, -0.95, 0]) }),
    P('crates', 'crateStack', 3.0, 0, frontZ - 0.45, -0.2),
    P('ladder', 'ladder', rightX - 0.45, 0, 2.6, -PI / 2, -0.28),
    P('prints', 'bootPrints', leftX + 0.35, 0, 3.95, 0, 0, { label: 'By the door' }),
    P('window', 'proxy', slotX(1), 1.55, backZ - 0.05, 0, 0, { args: [1.4, 1.4, 0.3], label: 'The window' }),
  ],
};

const INN = {
  shell: { walls: 'plaster', grid: true, windows: { back: [2], front: [5], right: [4] }, winType: 'wide' },
  moon: { x: slotX(2), w: 1.25, h: 1.2 },
  spot: { at: [1.6, CEIL - 1.3, -1.2], target: [2.2, 0, -1.0] },
  layout: [
    P('counter', 'counter', 3.0, 0, -1.0, -PI / 2, 0, { label: 'The bar' }),
    P('mugs', 'mugs', 3.0, 1.03, -1.7, -PI / 2),
    P('drawer', 'cashDrawer', 3.0, 1.03, 0.15, -PI / 2, 0, { label: 'The till' }),
    P('kegs', 'barrels', rightX - 0.35, 0, -2.9, PI / 2, 0, { label: 'The kegs' }),
    P('barrels', 'barrels', rightX - 0.35, 0, -0.6, PI / 2),
    P('jars', 'jarShelf', rightX - 0.13, 1.65, -1.5, -PI / 2, 0, { args: [1.8], label: 'The bottles' }),
    P('jars2', 'jarShelf', rightX - 0.13, 2.2, -1.5, -PI / 2, 0, { args: [1.8] }),
    P('stool1', 'stool', 2.1, 0, -2.1),
    P('stool2', 'stool', 2.05, 0, -1.0),
    P('stool3', 'stool', 2.1, 0, 0.1),
    P('fireplace', 'fireplace', leftX + 0.35, 0, -1.6, PI / 2, 0, { args: [CEIL], light: lamp('#ff7a30', 6.0, [0.6, 0.45, 0]) }),
    P('rug', 'rug', -3.6, 0, -1.6, PI / 2),
    P('logs', 'logBasket', leftX + 0.45, 0, -0.1),
    P('stool4', 'stool', -3.4, 0, -0.4),
    P('table', 'table', -1.7, 0, -3.1, 0.25, 0, { light: lamp('#ffa050', 0.9, [-0.1, 1.0, -0.2]) }),
    P('table2', 'table', -0.6, 0, 1.6, -0.2, 0, { light: lamp('#ffa050', 0.9, [-0.1, 1.0, -0.2]) }),
    P('body', 'body', 0.6, 0, -2.2, -0.35, 0, { label: 'The body' }),
    P('chair', 'chair', 1.0, 0, -3.6, 0.9),
    P('papers', 'papers', -0.2, 0, -0.9, 0, 0, { args: [4, 0.5] }),
    P('clock', 'clock', 0.4, 2.1, backZ + 0.08),
    P('curtains1', 'curtains', slotX(2), 0.85, backZ + 0.07, 0, 0, { args: [1.5, 1.6] }),
    P('frame1', 'frame', -3.6, 2.05, backZ + 0.03, 0, 0, { args: [0.8, 0.5, 'pine'] }),
    P('frame2', 'frame', 1.9, 2.0, backZ + 0.03, 0, 0, { args: [0.5, 0.4, 'cloth'] }),
    P('coatrack', 'coatRack', leftX + 0.45, 0, 2.55),
    P('walllamp', 'wallLamp', leftX - 0.02, 1.95, 3.1, PI / 2, 0, { light: lamp('#ffb468', 2.2, [0.37, -0.1, 0]) }),
    P('crates', 'crateStack', 2.6, 0, frontZ - 0.45, 0.2),
    P('herbs1', 'herbs', -2.2, CEIL - 0.3, 0.6, 0, 0, { args: [1.6] }),
    P('lampA', 'hangingLamp', 1.6, CEIL - 0.28, -1.2, 0, 0, { args: [0.8], light: lamp('#ffb468', 3.0, [0, -0.9, 0]) }),
    P('lampB', 'hangingLamp', -1.7, CEIL - 0.28, -2.6, 0, 0, { args: [0.7], light: lamp('#ffb468', 4.0, [0, -0.85, 0]) }),
    P('lampC', 'hangingLamp', -0.6, CEIL - 0.28, 1.6, 0, 0, { args: [0.7], light: lamp('#ffb468', 4.0, [0, -0.85, 0]) }),
    P('prints', 'bootPrints', leftX + 0.35, 0, 3.95, 0, 0, { label: 'By the door' }),
    P('window', 'proxy', slotX(2), 1.55, backZ - 0.05, 0, 0, { args: [1.4, 1.4, 0.3], label: 'The window' }),
  ],
};

const CHAPEL = {
  shell: { walls: 'brick', grid: false, windows: { back: [1, 5], left: [1, 3], right: [1, 3] }, winType: 'thin', floor: 'stone' },
  moon: { x: slotX(1), w: 0.55, h: 1.25 },
  spot: { at: [0.2, CEIL - 1.2, -1.6], target: [0.2, 0, -2.3] },
  layout: [
    P('flagstones', 'flagstones', 0, 0, 0, 0, 0, { args: [W * RK - 0.1, D * RK - 0.1] }),
    P('runner', 'runner', 0.1, 0, 0.6, 0, 0, { args: [6.4, 1.1] }),
    P('altar', 'altar', 0.3, 0, backZ + 0.8, 0, 0, { light: lamp('#ffc070', 1.2, [0, 1.75, -0.2]) }),
    P('icon', 'frame', 0.3, 2.35, backZ + 0.04, 0, 0, { args: [0.9, 1.15, 'clothRed'], label: 'The painting' }),
    P('candles', 'candleStand', -1.6, 0, backZ + 0.65, 0, 0, { light: lamp('#ffb060', 2.4, [0, 1.25, 0]) }),
    P('candles2', 'candleStand', 2.2, 0, backZ + 0.65, 0, 0, { light: lamp('#ffb060', 2.4, [0, 1.25, 0]) }),
    P('lectern', 'lectern', -2.5, 0, -2.6, 0.5),
    P('body', 'body', 0.2, 0, -2.25, 0.1, 0, { label: 'The body' }),
    P('pew1', 'pew', -2.6, 0, -0.9),
    P('pew2', 'pew', 2.7, 0, -0.9),
    P('pew3', 'pew', -2.6, 0, 0.55),
    P('pew4', 'pew', 2.7, 0, 0.55),
    P('pew5', 'pew', -2.6, 0, 2.0),
    P('pew6', 'pew', 2.7, 0, 2.0),
    P('bookcase', 'bookcase', leftX + 0.2, 0, -0.8, PI / 2, 0, { label: 'The hymn books' }),
    P('bellrope', 'bellRope', 3.9, 0, -3.95, 0, 0, { args: [CEIL] }),
    P('ladder', 'ladder', 4.8, 0, backZ + 0.55, 0.12, -0.28),
    P('crates', 'crateStack', 4.2, 0, frontZ - 0.45, -0.2),
    P('frame1', 'frame', rightX - 0.03, 2.1, -0.8, -PI / 2, 0, { args: [0.5, 0.7, 'pine'] }),
    P('walllamp', 'wallLamp', leftX - 0.02, 1.95, 3.1, PI / 2, 0, { light: lamp('#ffb468', 2.2, [0.37, -0.1, 0]) }),
    P('lampA', 'hangingLamp', 0.2, CEIL - 0.28, -1.6, 0, 0, { args: [0.9], light: lamp('#ffb468', 2.0, [0, -1.0, 0]) }),
    P('lampB', 'hangingLamp', 0.1, CEIL - 0.28, 1.2, 0, 0, { args: [0.8], light: lamp('#ffb468', 4.5, [0, -0.9, 0]) }),
    P('prints', 'bootPrints', leftX + 0.35, 0, 3.95, 0, 0, { label: 'By the door' }),
    P('window', 'proxy', slotX(1), 1.7, backZ - 0.05, 0, 0, { args: [0.8, 1.5, 0.3], label: 'The window' }),
  ],
};

/* ------------------------------------------------------------------ */
/* Street                                                               */
/* ------------------------------------------------------------------ */

const lit = (...k) => new Set(k);
const STREET = {
  // house fronts line the far side of the lane; another row stands behind the camera
  houses: {
    back: [
      { w: 2, d: 2, floors: 2, ground: 'plaster', upper: 'grid', front: ['window', 'wall'], front2: ['window', 'window'], shutters: 'closed', boarded: true },
      { w: 3, d: 2, floors: 2, ground: 'brick', upper: 'plaster', front: ['door', 'window', 'window'], front2: ['window', 'window', 'window'], lit: lit('0:1', '1:0'), chimney: 'left' },
      { w: 2, d: 2, floors: 2, ground: 'plaster', upper: 'grid', front: ['window', 'door'], front2: ['window', 'window'], lit: lit('1:1'), shutters: 'closed' },
      { w: 3, d: 2, floors: 2, ground: 'brick', upper: 'grid', front: ['window', 'doorRound', 'window'], front2: ['window', 'thin', 'window'], lit: lit('0:0', '1:2'), vines: true },
      { w: 2, d: 2, floors: 2, ground: 'plaster', upper: 'plaster', front: ['wall', 'window'], front2: ['window', 'wall'], shutters: 'closed' },
    ],
    front: [
      { w: 3, d: 2, floors: 2, ground: 'brick', upper: 'plaster', front: ['window', 'door', 'window'], front2: ['window', 'window', 'window'], lit: lit('0:0') },
      { w: 2, d: 2, floors: 2, ground: 'plaster', upper: 'grid', front: ['door', 'window'], front2: ['window', 'window'], lit: lit('1:0') },
      { w: 3, d: 2, floors: 2, ground: 'brick', upper: 'grid', front: ['window', 'window', 'door'], front2: ['window', 'window', 'window'] },
    ],
    backZ: -HD, frontZ: HD + 4.4,
  },
  spot: { at: [-2.2, 3.15, -3.95], target: [-1.5, 0, -2.4] },
  layout: [
    P('cobbles', 'cobbles', 0, 0, 2.0, 0, 0, { args: [W * RK + 12, D * RK + 8] }),
    P('drift1', 'drift', -3.6, 0, -4.55, 0, 0, { args: [3.5] }),
    P('drift2', 'drift', 2.4, 0, -4.6, 0.05, 0, { args: [4.0] }),
    P('drift4', 'drift', 4.8, 0, 3.4, PI / 2, 0, { args: [2.5] }),
    P('lamp1', 'lampPost', -2.2, 0, -4.05, 0, 0, { light: lamp('#ffc070', 7.0, [0, 3.24, 0]) }),
    P('lamp2', 'lampPost', 3.8, 0, 4.1, 0, 0, { light: lamp('#ffc070', 6.0, [0, 3.24, 0]) }),
    P('well', 'well', 2.3, 0, -0.9, 0.3, 0, { scale: 0.8 }),
    P('cart', 'cart', 4.7, 0, -2.6, 1.3),
    P('fence', 'fence', 5.55, 0, 1.4, PI / 2, 0, { args: [3.2] }),
    P('barrels', 'snowBarrels', 4.3, 0, -4.2, 0.4),
    P('crates', 'snowCrates', -4.6, 0, -4.05, 0.2),
    P('notice', 'noticeBoard', -0.5, 0, -4.35),
    P('bench', 'bench', 0.9, 0, -4.25),
    P('signpost', 'signpost', -5.1, 0, -2.6, 1.2),
    P('body', 'body', 0.2, 0.02, -1.9, 0.35, 0, { label: 'The body' }),
    P('prints', 'bootPrints', -3.2, 0.02, 0.9, -0.4, 0, { label: 'Tracks in the snow' }),
    P('puddle1', 'puddle', -1.0, 0.03, 2.2),
    P('puddle2', 'puddle', 2.9, 0.03, 1.8, 0.6, 0, { args: [0.5] }),
  ],
};

export const KINDS = { shop: SHOP, house: HOUSE, inn: INN, chapel: CHAPEL, street: STREET };

/** The scene a case asks for, with its additions and removals applied. */
export function resolveScene(scene = {}) {
  const type = scene.type === 'street' ? 'street' : 'room';
  const kindName = type === 'street' ? 'street' : KINDS[scene.kind] ? scene.kind : 'shop';
  const kind = KINDS[kindName];
  const drop = new Set(scene.remove || []);
  const added = (scene.add || []).map((p) => ({ ry: 0, rx: 0, ...p }));
  const replaced = new Set(added.map((p) => p.id));
  const layout = [...kind.layout.filter((p) => !drop.has(p.id) && !replaced.has(p.id)), ...added];
  for (const p of layout) if (!PIECES[p.piece]) console.warn(`[scene] unknown piece "${p.piece}" for prop "${p.id}"`);
  return { type, kindName, ...kind, layout: layout.filter((p) => PIECES[p.piece]) };
}

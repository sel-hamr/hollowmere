import * as THREE from 'three';

/**
 * Grid navigation over the island: A* on a fine grid, then string-pulled
 * so the detective walks natural straight lines around wells and lamps.
 */
export class NavGrid {
  constructor(collide, half, cell = 0.35) {
    this.collide = collide;
    this.half = half;
    this.cell = cell;
    this.n = Math.ceil((half * 2) / cell);
    this.blocked = new Uint8Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const [x, z] = this.toWorld(i, j);
        this.blocked[j * this.n + i] = collide(x, z) ? 1 : 0;
      }
    }
  }

  toWorld(i, j) {
    return [-this.half + (i + 0.5) * this.cell, -this.half + (j + 0.5) * this.cell];
  }

  toCell(x, z) {
    const c = (v) => THREE.MathUtils.clamp(Math.floor((v + this.half) / this.cell), 0, this.n - 1);
    return [c(x), c(z)];
  }

  free(i, j) {
    return i >= 0 && j >= 0 && i < this.n && j < this.n && !this.blocked[j * this.n + i];
  }

  /** Nearest walkable cell to (i,j), searching outward in rings. */
  nearestFree(i, j) {
    if (this.free(i, j)) return [i, j];
    for (let r = 1; r < 12; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (this.free(i + di, j + dj)) {
            const d = di * di + dj * dj;
            if (d < bd) { bd = d; best = [i + di, j + dj]; }
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / 0.12);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (this.collide(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /** Returns an array of THREE.Vector2 waypoints (excluding the start), or null. */
  find(sx, sz, tx, tz) {
    if (this.lineClear(sx, sz, tx, tz) && !this.collide(tx, tz)) return [new THREE.Vector2(tx, tz)];
    const s = this.nearestFree(...this.toCell(sx, sz));
    const g = this.nearestFree(...this.toCell(tx, tz));
    if (!s || !g) return null;
    const N = this.n;
    const idx = (i, j) => j * N + i;
    const start = idx(...s), goal = idx(...g);
    const gScore = new Float32Array(N * N).fill(Infinity);
    const came = new Int32Array(N * N).fill(-1);
    const closed = new Uint8Array(N * N);
    const open = new MinHeap();
    const h = (k) => {
      const dx = Math.abs((k % N) - g[0]), dz = Math.abs(Math.floor(k / N) - g[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    gScore[start] = 0;
    open.push(start, h(start));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    while (open.size) {
      const k = open.pop();
      if (k === goal) { found = true; break; }
      if (closed[k]) continue;
      closed[k] = 1;
      const ci = k % N, cj = Math.floor(k / N);
      for (const [di, dj, cost] of dirs) {
        const ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue; // no corner cutting
        const nk = idx(ni, nj);
        const ng = gScore[k] + cost;
        if (ng < gScore[nk]) {
          gScore[nk] = ng;
          came[nk] = k;
          open.push(nk, ng + h(nk));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = goal; k !== -1; k = came[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => this.toWorld(k % N, Math.floor(k / N)));
    if (!this.collide(tx, tz)) pts[pts.length - 1] = [tx, tz];
    // string-pull
    const out = [];
    let ax = sx, az = sz, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(ax, az, pts[j][0], pts[j][1])) j--;
      out.push(new THREE.Vector2(pts[j][0], pts[j][1]));
      [ax, az] = pts[j];
      i = j + 1;
    }
    return out;
  }
}

class MinHeap {
  constructor() {
    this.k = [];
    this.p = [];
  }
  get size() {
    return this.k.length;
  }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key);
    p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[i], k[par]] = [k[par], k[i]];
      [p[i], p[par]] = [p[par], p[i]];
      i = par;
    }
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk;
      p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[i], k[m]] = [k[m], k[i]];
        [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
}

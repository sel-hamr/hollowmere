import * as THREE from 'three';
import { fogUniforms } from '../core/palette.js';

/* ------------------------------------------------------------------ */
/* Backdrop + environment                                             */
/* ------------------------------------------------------------------ */

export function makeBackdrop() {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0.0, '#070a10');
  grd.addColorStop(0.45, '#141c27');
  grd.addColorStop(0.8, '#222c39');
  grd.addColorStop(1.0, '#27313e');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  // moon halo, high on the right
  const mx = W * 0.82, my = H * 0.16;
  let r = g.createRadialGradient(mx, my, 0, mx, my, W * 0.42);
  r.addColorStop(0, 'rgba(160,185,215,0.30)');
  r.addColorStop(0.2, 'rgba(110,135,170,0.12)');
  r.addColorStop(1, 'rgba(60,80,110,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, W, H);
  r = g.createRadialGradient(mx, my, 0, mx, my, 26);
  r.addColorStop(0, 'rgba(235,240,245,0.85)');
  r.addColorStop(0.7, 'rgba(200,215,230,0.35)');
  r.addColorStop(1, 'rgba(200,215,230,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, W, H);

  // soft cloud banks drifting over the moon
  const cloud = (x, y, w, h, a) => {
    for (let i = 0; i < 26; i++) {
      const cx = x + (Math.random() - 0.5) * w, cy = y + (Math.random() - 0.5) * h;
      const rr = (0.25 + Math.random() * 0.5) * h;
      const cg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      cg.addColorStop(0, `rgba(30,38,50,${a})`);
      cg.addColorStop(1, 'rgba(30,38,50,0)');
      g.fillStyle = cg;
      g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
  };
  cloud(W * 0.78, H * 0.2, W * 0.5, H * 0.08, 0.5);
  cloud(W * 0.3, H * 0.12, W * 0.6, H * 0.1, 0.4);
  cloud(W * 0.6, H * 0.34, W * 0.9, H * 0.1, 0.25);

  // fine film noise to kill banding
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 5;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Dim night environment so wet surfaces pick up sky and lamp glints. */
export function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const col = [];
  const top = new THREE.Color('#121a26'), hor = new THREE.Color('#3a4a60'), bot = new THREE.Color('#0b0e14');
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50;
    const cc = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.pow(-y, 0.5));
    col.push(cc.r, cc.g, cc.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // moon + warm lamp glints
  const glow = (color, x, y, z, s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    env.add(m);
  };
  glow(new THREE.Color('#c8d6e8').multiplyScalar(3), 30, 30, -20, 3);
  glow(new THREE.Color('#ffb066').multiplyScalar(4), -30, 6, 20, 2.2);
  glow(new THREE.Color('#ffb066').multiplyScalar(4), 25, 5, 30, 1.8);
  glow(new THREE.Color('#ffb066').multiplyScalar(3), -10, 4, -40, 1.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  return rt.texture;
}

/* ------------------------------------------------------------------ */
/* Rain                                                               */
/* ------------------------------------------------------------------ */

export class Rain {
  constructor(max = 7000, half = 14) {
    this.max = max;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const drops = new Float32Array(max * 4);
    const span = half + 9;
    for (let i = 0; i < max; i++) {
      drops[i * 4] = (Math.random() * 2 - 1) * span;
      drops[i * 4 + 1] = (Math.random() * 2 - 1) * span;
      drops[i * 4 + 2] = Math.random();
      drops[i * 4 + 3] = Math.random();
    }
    geo.setAttribute('aDrop', new THREE.InstancedBufferAttribute(drops, 4));
    geo.instanceCount = max;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80);

    this.uniforms = {
      uTime: { value: 0 },
      uTop: { value: 20 },
      uHalf: { value: half },
      uSpeed: { value: 15 },
      uLen: { value: 0.95 },
      uWidth: { value: 0.045 },
      uWind: { value: new THREE.Vector2(0.16, 0.07) },
      uColor: { value: new THREE.Color('#aebfd4') },
      uOpacity: { value: 0.32 },
      uFlash: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec4 aDrop;
        uniform float uTime, uTop, uHalf, uSpeed, uLen, uWidth;
        uniform vec2 uWind;
        uniform vec3 uCenter;
        varying float vA;
        void main(){
          float speed = uSpeed * (0.8 + 0.45 * aDrop.w);
          float bottom = uCenter.y - 3.0;
          float top = uCenter.y + uTop;
          float H = top - bottom;
          float t = fract(aDrop.z - uTime * speed / H);
          float y = bottom + t * H;
          vec3 head = vec3(uCenter.x + aDrop.x + uWind.x * (top - y), y, uCenter.z + aDrop.y + uWind.y * (top - y));
          vec3 d = normalize(vec3(uWind.x, -1.0, uWind.y));
          vec3 dv = normalize(mat3(viewMatrix) * d);
          // screen-space perpendicular to the streak, wound so the quad faces the camera
          vec2 perp = vec2(-dv.y, dv.x);
          vec3 sideV = vec3(perp / max(length(perp), 1e-4), 0.0);
          vec4 mv = viewMatrix * vec4(head, 1.0);
          float len = uLen * (0.7 + 0.6 * aDrop.w);
          mv.xyz += -dv * position.y * len + sideV * position.x * uWidth;
          gl_Position = projectionMatrix * mv;
          float fadeTop = (1.0 - smoothstep(top - 3.0, top, y));
          float fadeLow = smoothstep(bottom, bottom + 1.5, y);
          float fadeFar = 1.0 - smoothstep(0.75, 1.0, length(aDrop.xy) / ${(half + 9).toFixed(1)});
          vA = (1.0 - position.y) * fadeTop * fadeLow * fadeFar;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity; uniform float uFlash;
        varying float vA;
        void main(){
          gl_FragColor = vec4(uColor * (1.0 + uFlash * 2.5), vA * uOpacity * (1.0 + uFlash));
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.geo = geo;
  }

  setDensity(fraction) {
    this.geo.instanceCount = Math.floor(this.max * THREE.MathUtils.clamp(fraction, 0, 1));
  }

  update(t) {
    this.uniforms.uTime.value = t;
  }
}

/* ------------------------------------------------------------------ */
/* Ripples in puddles and between cobbles                              */
/* ------------------------------------------------------------------ */

export class Ripples {
  constructor(puddles, roadField, count = 420, half = 14) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const data = new Float32Array(count * 4);
    const ys = new Float32Array(count);
    let i = 0;
    while (i < count) {
      let x, z, y, s;
      if (i < count * 0.55 && puddles.length) {
        const p = puddles[i % puddles.length];
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * p.r * 0.85;
        x = p.x + Math.cos(a) * r * 1.2;
        z = p.z + Math.sin(a) * r;
        y = 0.08;
        s = 0.12 + Math.random() * 0.14;
      } else {
        x = (Math.random() * 2 - 1) * (half - 1);
        z = (Math.random() * 2 - 1) * (half - 1);
        if (roadField(x, z) < 0.1) continue;
        y = 0.105;
        s = 0.06 + Math.random() * 0.08;
      }
      data.set([x, z, Math.random(), s], i * 4);
      ys[i] = y;
      i++;
    }
    geo.setAttribute('aR', new THREE.InstancedBufferAttribute(data, 4));
    geo.setAttribute('aY', new THREE.InstancedBufferAttribute(ys, 1));
    geo.instanceCount = count;
    this.uniforms = { uTime: { value: 0 }, uFlash: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec4 aR; attribute float aY;
        uniform float uTime;
        varying vec2 vUv; varying float vT;
        void main(){
          float rate = 0.9 + fract(aR.z * 17.0) * 0.8;
          vT = fract(uTime * rate + aR.z * 13.0);
          vec3 p = vec3(aR.x + position.x * aR.w, aY, aR.y + position.y * aR.w);
          vUv = position.xy;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vT;
        uniform float uFlash;
        void main(){
          float r = length(vUv);
          float ring = (1.0 - smoothstep(0.0, 0.11, abs(r - vT))) * (1.0 - vT) * (1.0 - vT);
          float ring2 = (1.0 - smoothstep(0.0, 0.08, abs(r - vT * 0.55))) * (1.0 - vT) * 0.5;
          float a = (ring + ring2) * 0.55;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.72, 0.8, 0.9) * (1.0 + uFlash * 2.0), a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  update(t) {
    this.uniforms.uTime.value = t;
  }
}

/* ------------------------------------------------------------------ */
/* Chimney smoke                                                      */
/* ------------------------------------------------------------------ */

export class Smoke {
  constructor(sources) {
    const per = 34;
    const n = sources.length * per;
    const base = new Float32Array(n * 3);
    const seed = new Float32Array(n * 2);
    sources.forEach((s, si) => {
      for (let k = 0; k < per; k++) {
        const i = si * per + k;
        base.set([s.x, s.y, s.z], i * 3);
        seed.set([k / per, Math.random()], i * 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80);
    this.uniforms = {
      uTime: { value: 0 },
      uPx: { value: 30 },
      uTex: { value: puffTexture() },
      uColor: { value: new THREE.Color('#8592a3') },
      uWind: { value: new THREE.Vector2(0.55, 0.22) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 aSeed;
        uniform float uTime, uPx; uniform vec2 uWind;
        varying float vA; varying float vRot;
        void main(){
          float t = fract(uTime * 0.07 + aSeed.x);
          vec3 p = position;
          p.y += t * 5.5;
          p.x += uWind.x * t * t * 5.0 + sin(t * 7.0 + aSeed.y * 6.28) * 0.25 * t;
          p.z += uWind.y * t * t * 5.0 + cos(t * 5.0 + aSeed.y * 6.28) * 0.25 * t;
          vA = smoothstep(0.0, 0.08, t) * (1.0 - t) * 0.5;
          vRot = aSeed.y * 6.28 + t * 1.5;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (0.45 + t * 2.4) / max(-mv.z, 0.5);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex; uniform vec3 uColor;
        varying float vA; varying float vRot;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          uv = mat2(c, -s, s, c) * uv + 0.5;
          float a = texture2D(uTex, uv).a * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    this.mesh = new THREE.Points(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  update(t, pxPerUnit) {
    this.uniforms.uTime.value = t;
    this.uniforms.uPx.value = pxPerUnit;
  }
}

let _puff;
export function puffTexture() {
  if (_puff) return _puff;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50;
    const r = 18 + Math.random() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  // fade to the edge so no sprite ever shows a square
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m;
  g.fillRect(0, 0, 128, 128);
  _puff = new THREE.CanvasTexture(c);
  return _puff;
}

/* ------------------------------------------------------------------ */
/* Fog banks: the island floats on a sea of mist                       */
/* ------------------------------------------------------------------ */

export class FogBanks {
  constructor(half = 14) {
    this.group = new THREE.Group();
    this.items = [];
    const tex = puffTexture();
    const fogCol = fogUniforms.uFogColor.value;
    for (let i = 0; i < 64; i++) {
      const low = i < 40;
      const a = Math.random() * Math.PI * 2;
      const r = low ? half * (0.2 + Math.random() * 1.3) : half * (1.0 + Math.random() * 0.35);
      const y = low ? -3.5 - Math.random() * 6 : -1.2 + Math.random() * 1.6;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: fogCol.clone().lerp(new THREE.Color('#5b6a7e'), low ? 0.35 : 0.5),
        transparent: true,
        depthWrite: false,
        opacity: low ? 0.8 : 0.55,
        fog: false,
      });
      const s = new THREE.Sprite(mat);
      const sc = low ? 14 + Math.random() * 14 : 6 + Math.random() * 6;
      s.scale.set(sc, sc * 0.55, 1);
      s.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      s.renderOrder = low ? -1 : 8;
      mat.rotation = Math.random() * Math.PI;
      this.group.add(s);
      this.items.push({ s, a, r, y, speed: (Math.random() * 0.5 + 0.2) * 0.012 * (Math.random() < 0.5 ? -1 : 1), bob: Math.random() * 6 });
    }
  }

  update(t, dt) {
    for (const it of this.items) {
      it.a += it.speed * dt;
      it.s.position.set(Math.cos(it.a) * it.r, it.y + Math.sin(t * 0.2 + it.bob) * 0.25, Math.sin(it.a) * it.r);
      it.s.material.rotation += it.speed * dt * 2;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sky dome: horizon colour equals the fog, so hills melt into the sky */
/* ------------------------------------------------------------------ */

export class Sky {
  constructor(fogColor, moonDir) {
    this.uniforms = {
      uFog: { value: fogColor },
      uMoon: { value: moonDir.clone().normalize() },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFog; uniform vec3 uMoon; uniform float uTime; uniform float uFlash;
        varying vec3 vDir;
        float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
        float fb(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.02 + 3.1; a *= 0.5; } return v; }
        void main(){
          vec3 d = normalize(vDir);
          float e = d.y;
          vec3 zenith = vec3(0.022, 0.032, 0.052);
          vec3 col = mix(uFog, zenith, smoothstep(-0.02, 0.6, e));
          // moon, halo and the glow it casts through the haze
          float m = max(dot(d, uMoon), 0.0);
          vec3 moonCol = vec3(0.75, 0.82, 0.92);
          float halo = pow(m, 90.0) * 0.5 + pow(m, 12.0) * 0.1 + pow(m, 3.0) * 0.035;
          float disc = smoothstep(0.99935, 0.9996, m);
          // slow cloud banks, thicker near the horizon
          vec2 cp = d.xz / (e + 0.18) * 1.4 + vec2(uTime * 0.012, uTime * 0.004);
          float c = smoothstep(0.42, 0.78, fb(cp)) * smoothstep(-0.05, 0.25, e);
          vec3 cloudCol = mix(uFog * 0.9, vec3(0.11, 0.13, 0.17), 0.5) + moonCol * pow(m, 6.0) * 0.12;
          col += moonCol * (halo + disc * 1.6) * (1.0 - c * 0.85);
          col = mix(col, cloudCol, c * 0.75);
          col += vec3(0.5, 0.6, 0.78) * uFlash * 0.45 * (1.0 - 0.4 * e);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    this.mesh.userData.noAO = true;
  }

  update(camera, t) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = t;
  }
}

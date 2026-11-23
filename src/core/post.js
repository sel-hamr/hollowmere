import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/** Final cinematic grade, applied in display space after tone mapping. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.85 },
    uGrain: { value: 0.035 },
    uFlash: { value: 0 },
    uAberration: { value: 0.0022 },
    uLetterbox: { value: 0 },
    uFade: { value: 1 },
    uTint: { value: new THREE.Vector3(0.93, 0.98, 1.07) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uFlash, uAberration, uLetterbox, uFade;
    uniform vec2 uRes; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float d = length(c * vec2(uRes.x / uRes.y, 1.0)) / 0.9;
      vec2 off = c * uAberration * (0.4 + d * 1.6);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      // cold shadows, faintly warm highlights
      vec3 shadowTint = col * uTint + vec3(0.004, 0.009, 0.016);
      vec3 highTint = col * vec3(1.03, 1.0, 0.96);
      col = mix(shadowTint, highTint, smoothstep(0.25, 0.85, l));
      col *= mix(1.0, (1.0 - smoothstep(0.2, 1.05, d)), uVignette);
      col += vec3(0.55, 0.65, 0.8) * uFlash * 0.28;
      col += (hash(vUv * uRes + fract(uTime * 7.13) * 100.0) - 0.5) * uGrain;
      col *= uFade;
      float bars = step(vUv.y, uLetterbox) + step(1.0 - uLetterbox, vUv.y);
      col = mix(col, vec3(0.0), clamp(bars, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Post {
  constructor(renderer, scene, camera, { msaa = 4, ao = true } = {}) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: msaa });
    this.composer = new EffectComposer(renderer, rt);

    this.render = new RenderPass(scene, camera);
    this.composer.addPass(this.render);

    this.gtao = new GTAOPass(scene, camera, size.x, size.y);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.gtao.enabled = ao;
    // GTAO's depth/normal prepass must only see solid geometry: hide sprites,
    // transparent FX (rain, ripples, puddles) and helper meshes from it.
    const baseOverride = this.gtao._overrideVisibility.bind(this.gtao);
    this.gtao._overrideVisibility = () => {
      baseOverride();
      const cache = this.gtao._visibilityCache;
      scene.traverse((o) => {
        if (!o.visible) return;
        const m = o.material;
        if (o.isSprite || o.userData.noAO || (m && (m.transparent || m.visible === false))) {
          o.visible = false;
          cache.push(o);
        }
      });
    };
    this.composer.addPass(this.gtao);

    this.outline = new OutlinePass(new THREE.Vector2(size.x, size.y), scene, camera);
    this.outline.visibleEdgeColor.set('#ffcf86');
    this.outline.hiddenEdgeColor.set('#5a3a1a');
    this.outline.edgeStrength = 4.5;
    this.outline.edgeGlow = 0.6;
    this.outline.edgeThickness = 1.6;
    this.outline.pulsePeriod = 2.6;
    this.outline.enabled = false;
    this.composer.addPass(this.outline);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.65, 0.92);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  setSize(w, h, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.grade.uniforms.uRes.value.set(w * dpr, h * dpr);
  }

  set ao(v) {
    this.gtao.enabled = v;
  }
}

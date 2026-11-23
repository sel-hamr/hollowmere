import * as THREE from 'three';
import { withHollowFog } from '../core/palette.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Skeletal detective built on Quaternius' Universal Base Character.
 * The base mesh ships unclothed and without animations, so this module:
 *  - dresses it per vertex (coat, trousers, gloves, shoes; skin stays on the face),
 *  - attaches rigid accessories to bones (fedora, coat skirt, collar, scarf),
 *  - poses the rig procedurally by aiming bones (idle + walk), axis-agnostic.
 */

export const BODY_SCALE = 0.72; // 1.81 m base mesh -> ~1.3 world units

const DEFAULT_LOOK = {
  coat: '#3f3b36',
  trousers: '#25262a',
  glove: '#2a211c',
  shoe: '#1b1613',
  scarf: '#8b2e2e',
  hair: '#3a2c22',
  hat: 'fedora', // 'fedora' | 'cap' | 'none'
  skirt: 'coat', // 'coat' (open) | 'dress' | 'robe' | 'apron' | 'none'
  slim: 1, // torso girth
};

/**
 * GLTFLoader keeps node names unique per file by appending _1, _2 ... ("pelvis_1", "spine_01_1").
 * Map every bone back to its skeleton name so bodies and hair from one file line up.
 */
const canonBone = (n) => n.replace(/^(.*?(?:_[lr]|_0\d|root|pelvis|Head))_\d+$/, '$1');

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();

function fogMat(params) {
  return withHollowFog(new THREE.MeshStandardMaterial(params), { key: 'char' });
}

/**
 * Per-vertex clothing weights from the bind pose (T-pose, facing +Z).
 * Measured in fractions of body height so quantised/scaled meshes classify the same.
 */
function paintClothing(mesh) {
  const geo = mesh.geometry;
  const n = geo.attributes.position.count;
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  const pts = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  const box = new THREE.Box3();
  for (let i = 0; i < n; i++) {
    mesh.getVertexPosition(i, p);
    p.applyMatrix4(mesh.matrixWorld);
    pts.set([p.x, p.y, p.z], i * 3);
    box.expandByPoint(p);
  }
  const H = box.max.y - box.min.y || 1;
  const cx = (box.max.x + box.min.x) / 2;
  const w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const y = (pts[i * 3 + 1] - box.min.y) / H;
    const ax = Math.abs(pts[i * 3] - cx) / H;
    let k; // 0 skin, 1 coat, 2 trousers, 3 glove, 4 shoe
    if (ax > 0.355) k = 3; // hands, beyond the wrists in T-pose
    else if (y < 0.06) k = 4;
    else if (y < 0.54 && ax < 0.17) k = 2;
    else if (y > 0.835 && ax < 0.09) k = 0; // head and neck
    else k = 1;
    if (k > 0) w[i * 4 + (k - 1)] = 1;
  }
  geo.setAttribute('aCloth', new THREE.BufferAttribute(w, 4));
  return { H, box };
}

function dressMaterial(src, CLOTH) {
  const m = src.clone();
  delete m.userData.hollowFog;
  m.roughness = 1;
  m.envMapIntensity = 0.7;
  return withHollowFog(m, {
    key: 'cloth',
    uniforms: {
      uCoat: { value: CLOTH.coat },
      uTrousers: { value: CLOTH.trousers },
      uGlove: { value: CLOTH.glove },
      uShoe: { value: CLOTH.shoe },
    },
    vertexDecl: 'attribute vec4 aCloth; varying vec4 vCloth;',
    vertexBody: 'vCloth = aCloth;',
    fragmentDecl: 'uniform vec3 uCoat, uTrousers, uGlove, uShoe; varying vec4 vCloth;',
    afterMap: /* glsl */ `
      float hmCloth = clamp(vCloth.x + vCloth.y + vCloth.z + vCloth.w, 0.0, 1.0);
      vec3 hmClothCol = (uCoat * vCloth.x + uTrousers * vCloth.y + uGlove * vCloth.z + uShoe * vCloth.w) / max(hmCloth, 1e-3);
      #ifdef USE_MAP
        float hmWeave = hmNoise(vMapUv * 420.0) * 0.5 + hmNoise(vMapUv * 90.0) * 0.5;
      #else
        float hmWeave = 0.5;
      #endif
      diffuseColor.rgb = mix(diffuseColor.rgb, hmClothCol * (0.82 + 0.32 * hmWeave), hmCloth);
    `,
    afterNormal: /* glsl */ `
      normal = normalize(mix(normal, nonPerturbedNormal, hmCloth * 0.88));
      roughnessFactor = mix(roughnessFactor, mix(0.92, 0.45, vCloth.w + vCloth.z * 0.4), hmCloth);
    `,
  });
}

function flatCap(color) {
  // a postman's cap: soft crown that covers the whole skull, a band, a stiff peak over the brow
  const g = new THREE.Group();
  const cloth = fogMat({ color, roughness: 0.9 });
  const dark = fogMat({ color: color.clone().multiplyScalar(0.55), roughness: 0.6 });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.125, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), cloth);
  crown.scale.set(1.05, 0.66, 1.14);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.131, 0.034, 22, 1, true), dark);
  band.scale.z = 1.12;
  band.position.y = 0.014;
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 20, 1, false, -Math.PI / 2.3, Math.PI / 1.15), dark);
  peak.position.set(0, 0.004, 0.075);
  peak.rotation.x = 0.16;
  peak.scale.set(1, 1, 0.8);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dark);
  button.position.y = 0.082;
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.006), fogMat({ color: '#b08a4a', roughness: 0.35, metalness: 0.6 }));
  badge.position.set(0, 0.03, 0.142);
  g.add(crown, band, peak, button, badge);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

function fedora() {
  const g = new THREE.Group();
  const felt = fogMat({ color: '#25211e', roughness: 0.86 });
  const band = fogMat({ color: '#4a3a2c', roughness: 0.7 });
  // brim: a lathe with a gentle curl
  const brimPts = [];
  for (let i = 0; i <= 10; i++) {
    const r = 0.095 + (i / 10) * 0.12;
    const t = i / 10;
    brimPts.push(new THREE.Vector2(r, 0.012 * Math.sin(t * Math.PI) + (t > 0.7 ? (t - 0.7) * 0.06 : 0)));
  }
  const brim = new THREE.Mesh(new THREE.LatheGeometry(brimPts, 28), felt);
  brim.material.side = THREE.DoubleSide;
  const crownPts = [new THREE.Vector2(0.105, 0), new THREE.Vector2(0.108, 0.06), new THREE.Vector2(0.1, 0.11), new THREE.Vector2(0.07, 0.135), new THREE.Vector2(0.0, 0.122)];
  const crown = new THREE.Mesh(new THREE.LatheGeometry(crownPts, 24), felt);
  crown.scale.set(1, 1, 1.12);
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.109, 0.107, 0.028, 24, 1, true), band);
  ribbon.position.y = 0.018;
  ribbon.scale.set(1, 1, 1.12);
  g.add(brim, crown, ribbon);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

function coatSkirt(color, kind = 'coat') {
  // a coat is open at the front so the legs can stride through it; a dress or robe is closed
  const open = kind === 'coat';
  const geo = open
    ? new THREE.CylinderGeometry(0.175, 0.29, 0.58, 28, 4, true, Math.PI * 0.16, Math.PI * 1.68)
    : new THREE.CylinderGeometry(0.17, kind === 'robe' ? 0.27 : 0.31, 0.58, 28, 4, true);
  // three's cylinder puts theta=0 on +Z, so the gap between 0.16π and -0.16π faces forward
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // slight flare and a ripple in the hem
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const k = (0.29 - y) * 0.0 + (y < -0.2 ? Math.sin(a * 7) * 0.008 : 0);
    pos.setX(i, pos.getX(i) * (1 + k));
    pos.setZ(i, pos.getZ(i) * 0.82 * (1 + k));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, fogMat({ color, roughness: 0.93, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

function apronPanel(h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, h), fogMat({ color: '#d9cfb8', roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

function collarAndScarf(coatColor, scarfColor) {
  const g = new THREE.Group();
  const coat = fogMat({ color: coatColor.clone().multiplyScalar(0.85), roughness: 0.93, side: THREE.DoubleSide });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.13, 0.11, 20, 1, true), coat);
  collar.scale.z = 0.9;
  g.add(collar);
  if (scarfColor) {
    const scarfMat = fogMat({ color: scarfColor, roughness: 0.95 });
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.03, 8, 20), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.03;
    scarf.scale.set(1, 0.9, 1);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.022), scarfMat);
    tail.position.set(0.05, -0.12, 0.1);
    tail.rotation.set(0.15, 0, 0.12);
    g.add(scarf, tail);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

/** Tailored coat body: hides the base mesh's sculpted torso. Sized from the rig. */
function coatTorso(h, color, slim = 1, lapels = true) {
  // profile from waist (0) to collar (h), radius in metres
  const prof = [
    [0.0, 0.158], [0.12, 0.162], [0.3, 0.178], [0.5, 0.19], [0.68, 0.198], [0.8, 0.192], [0.9, 0.165], [0.97, 0.12], [1.0, 0.085],
  ];
  const pts = prof.map(([y, r]) => new THREE.Vector2(r * (y < 0.9 ? slim : 1), y * h));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.scale(1, 1, 0.74);
  const mat = fogMat({ color, roughness: 0.93 });
  const g = new THREE.Group();
  const shell = new THREE.Mesh(geo, mat);
  g.add(shell);
  // lapels, a belt and two buttons
  const lapelMat = fogMat({ color: color.clone().multiplyScalar(0.72), roughness: 0.9, side: THREE.DoubleSide });
  for (const s of lapels ? [-1, 1] : []) {
    const lapel = new THREE.Mesh(new THREE.PlaneGeometry(0.075, h * 0.42), lapelMat);
    lapel.position.set(s * 0.045, h * 0.74, 0.145);
    lapel.rotation.set(-0.12, s * 0.32, s * 0.38);
    g.add(lapel);
  }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.163, 0.162, 0.045, 28, 1, true), fogMat({ color: '#221d19', roughness: 0.6 }));
  belt.scale.z = 0.76;
  belt.position.y = h * 0.1;
  g.add(belt);
  const btn = fogMat({ color: '#15110f', roughness: 0.4 });
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), btn);
    b.position.set(0.035, h * (0.32 + i * 0.16), 0.143);
    g.add(b);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

/** A tapered tube from world point a to b (bind pose), used for sleeves and trouser legs. */
function limbTube(a, b, r1, r2, mat, cap = true) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r2, r1, len, 16, 2, !cap);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

export class SkeletalBody {
  /**
   * @param gltf  a loaded glTF whose scenes are a body and hair pieces
   * @param opts  { body, hair: [scene names], clone, look: {coat, trousers, glove, shoe, scarf, hair, hat, skirt, slim} }
   */
  constructor(gltf, opts = {}) {
    const look = { ...DEFAULT_LOOK, ...(opts.look || {}) };
    const CLOTH = {
      coat: new THREE.Color(look.coat),
      trousers: new THREE.Color(look.trousers),
      glove: new THREE.Color(look.glove),
      shoe: new THREE.Color(look.shoe),
    };
    this.look = look;
    const bodyName = opts.body || 'Superhero_Male_FullBody';
    const srcBody = gltf.scenes.find((s) => s.name === bodyName) || gltf.scenes[0];
    const hairNames = opts.hair || gltf.scenes.filter((s) => s !== srcBody).map((s) => s.name);
    // several characters share one file: clone skinned scenes so each gets its own skeleton
    const take = (sc) => (opts.clone ? cloneSkinned(sc) : sc);
    const bodyScene = take(srcBody);
    const scenes = [bodyScene, ...hairNames.map((n) => gltf.scenes.find((s) => s.name === n)).filter(Boolean).map(take)];
    this.model = bodyScene;
    this.model.updateMatrixWorld(true);

    this.bones = {};
    this.model.traverse((o) => o.isBone && (this.bones[canonBone(o.name)] = o));
    let bodyMesh = null;
    this.model.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      if (/^MI_Superhero/.test(o.material.name)) bodyMesh = o;
    });

    // bring hair and beard onto the body's skeleton
    for (const s of scenes) {
      if (s === bodyScene) continue;
      const meshes = [];
      s.traverse((o) => o.isSkinnedMesh && meshes.push(o));
      for (const o of meshes) {
        const bones = o.skeleton.bones.map((b) => this.bones[canonBone(b.name)] || b);
        o.bind(new THREE.Skeleton(bones, o.skeleton.boneInverses), o.bindMatrix);
        (bodyMesh?.parent || this.model).add(o);
      }
    }

    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (o === bodyMesh) return;
      const src = o.material;
      // rebuild from the textures so no loader-side state rides along
      const hair = /Hair/.test(src.name);
      const m = new THREE.MeshStandardMaterial({
        name: src.name,
        map: src.map,
        normalMap: src.normalMap,
        color: hair ? new THREE.Color(look.hair) : src.color,
        roughness: hair ? 0.75 : src.roughness,
        metalness: 0,
        alphaTest: hair ? 0.45 : 0,
        side: hair ? THREE.DoubleSide : THREE.FrontSide,
        envMapIntensity: 0.6,
      });
      o.material = withHollowFog(m, { key: hair ? 'hair' : 'eyes' });
      // alpha-tested hair would make the shadow pass derive a second, double-patched program
      if (hair || src.name === 'MI_Eyes') o.castShadow = false;
    });
    let fit = null;
    if (bodyMesh) {
      fit = paintClothing(bodyMesh);
      bodyMesh.material = dressMaterial(bodyMesh.material, CLOTH);
    }

    // accessories, authored in bind-pose metres and re-parented to bones
    const head = this.bones.Head, pelvis = this.bones.pelvis, neck = this.bones.neck_01 || this.bones.spine_03;
    // measure the rig so the clothes fit whatever proportions the base mesh has
    this.model.updateMatrixWorld(true);
    const Y = (bone) => bone.getWorldPosition(new THREE.Vector3()).y;
    const yPelvis = Y(pelvis), yNeck = Y(neck), yKnee = Y(this.bones.calf_l), yHead = Y(head);
    const waist = yPelvis + 0.06;
    const hatTop = yHead + (yHead - yNeck) * 1.25;
    const hat = look.hat === 'fedora' ? fedora() : look.hat === 'cap' ? flatCap(CLOTH.coat.clone().multiplyScalar(0.8)) : null;
    if (hat) {
      const headTop = fit ? fit.box.max.y : yHead + 0.22;
      if (look.hat === 'cap') {
        hat.position.set(0, headTop - 0.072, 0.0);
        hat.rotation.x = 0.05;
      } else {
        hat.position.set(0, hatTop, -0.012);
        hat.rotation.x = -0.06;
      }
      this.model.add(hat);
    }
    const torso = coatTorso(yNeck - waist + 0.02, CLOTH.coat, look.slim, look.skirt === 'coat');
    torso.position.set(0, waist, -0.012);
    this.model.add(torso);
    let skirt = null;
    if (look.skirt !== 'none') {
      const long = look.skirt === 'dress' || look.skirt === 'robe';
      skirt = coatSkirt(CLOTH.coat, look.skirt === 'apron' ? 'dress' : look.skirt);
      const skirtLen = waist - (long ? 0.1 : yKnee - 0.04);
      skirt.scale.y = skirtLen / 0.58;
      skirt.scale.x = skirt.scale.z = look.slim;
      skirt.position.set(0, waist - skirtLen / 2, -0.012);
      this.model.add(skirt);
      if (look.skirt === 'apron') {
        const ap = apronPanel(skirtLen * 0.85);
        ap.position.set(0, waist - skirtLen * 0.42, 0.2 * look.slim + 0.02);
        ap.rotation.x = -0.12;
        skirt.attach(ap);
      }
    }
    const cs = collarAndScarf(CLOTH.coat, look.scarf);
    cs.position.set(0, yNeck + 0.01, -0.01);
    this.model.add(cs);
    // sleeves and trouser legs, one rigid tube per bone, so the sculpted base never shows
    const coatMat = fogMat({ color: CLOTH.coat, roughness: 0.93 });
    const cuffMat = fogMat({ color: CLOTH.coat.clone().multiplyScalar(0.75), roughness: 0.9 });
    const trouserMat = fogMat({ color: CLOTH.trousers, roughness: 0.9 });
    const P = (n) => this.bones[n].getWorldPosition(new THREE.Vector3());
    const limbs = [];
    for (const sfx of ['_l', '_r']) {
      const sh = P('upperarm' + sfx), el = P('lowerarm' + sfx), wr = P('hand' + sfx);
      const hip = P('thigh' + sfx), kn = P('calf' + sfx), an = P('foot' + sfx);
      const dirArm = wr.clone().sub(el).normalize();
      limbs.push(['upperarm' + sfx, limbTube(sh.clone().addScaledVector(dirArm, -0.04), el, 0.066, 0.056, coatMat)]);
      limbs.push(['lowerarm' + sfx, limbTube(el, wr.clone().addScaledVector(dirArm, -0.015), 0.056, 0.05, coatMat)]);
      const cuff = limbTube(wr.clone().addScaledVector(dirArm, -0.06), wr.clone().addScaledVector(dirArm, -0.015), 0.054, 0.054, cuffMat);
      limbs.push(['lowerarm' + sfx, cuff]);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.057, 12, 8), coatMat);
      elbow.position.copy(el);
      limbs.push(['lowerarm' + sfx, elbow]);
      limbs.push(['thigh' + sfx, limbTube(hip.clone().add(new THREE.Vector3(0, 0.06, 0)), kn, 0.092, 0.066, trouserMat)]);
      limbs.push(['calf' + sfx, limbTube(kn, an.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.064, 0.056, trouserMat)]);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 8), trouserMat);
      knee.position.copy(kn);
      limbs.push(['calf' + sfx, knee]);
    }
    for (const [, m] of limbs) this.model.add(m);
    // shoulders: rounded caps where the sleeves meet the coat body
    for (const sfx of ['_l', '_r']) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), coatMat);
      cap.position.copy(P('upperarm' + sfx));
      cap.scale.set(1.1, 0.9, 0.95);
      this.model.add(cap);
      limbs.push(['clavicle' + sfx, cap]);
    }
    // leather boots from heel to toe
    const bootMat = fogMat({ color: CLOTH.shoe, roughness: 0.42 });
    for (const sfx of ['_l', '_r']) {
      const foot = P('foot' + sfx), toe = P(this.bones['ball_leaf' + sfx] ? 'ball_leaf' + sfx : 'ball' + sfx);
      const heel = foot.clone().setY(0.0);
      const tip = toe.clone().setY(0.0);
      const fwd = tip.clone().sub(heel).setY(0).normalize();
      heel.addScaledVector(fwd, -0.05);
      tip.addScaledVector(fwd, 0.035);
      const len = heel.distanceTo(tip);
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, len - 0.1, 6, 14), bootMat);
      boot.scale.set(1, 1, 0.82);
      boot.position.copy(heel).add(tip).multiplyScalar(0.5).setY(0.05);
      boot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fwd);
      boot.castShadow = true;
      this.model.add(boot);
      limbs.push(['foot' + sfx, boot]);
      const shaft = limbTube(foot.clone().setY(0.04), foot.clone().setY(0.16), 0.058, 0.06, bootMat);
      this.model.add(shaft);
      limbs.push(['foot' + sfx, shaft]);
    }
    // the trousers' seat between the legs
    const seat = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), trouserMat);
    seat.position.copy(P('pelvis')).add(new THREE.Vector3(0, -0.04, -0.01));
    seat.scale.set(1.25, 0.8, 0.9);
    this.model.add(seat);
    limbs.push(['pelvis', seat]);
    this.model.updateMatrixWorld(true);
    for (const [bone, m] of limbs) this.bones[bone]?.attach(m);

    // role props: what this person carries says who they are
    const props = look.props || [];
    const sideOf = (n) => Math.sign(P(n).x) || 1;
    if (props.includes('satchel')) {
      const leather = fogMat({ color: '#4a3020', roughness: 0.55 });
      const sL = sideOf('clavicle_l');
      const a = P('clavicle_l').add(new THREE.Vector3(0, 0.03, 0.135));
      const b = P('thigh_r').add(new THREE.Vector3(0, 0.12, 0.16));
      const strapF = limbTube(a, b, 0.016, 0.016, leather);
      const a2 = P('clavicle_l').add(new THREE.Vector3(0, 0.03, -0.12));
      const b2 = P('thigh_r').add(new THREE.Vector3(0, 0.12, -0.13));
      const strapB = limbTube(a2, b2, 0.016, 0.016, leather);
      const bag = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.28), leather);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.285), fogMat({ color: '#3a2618', roughness: 0.5 }));
      flap.position.set(0.004, 0.06, 0);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.04), fogMat({ color: '#b08a4a', roughness: 0.3, metalness: 0.7 }));
      buckle.position.set(0.04, 0.02, 0);
      bag.add(body, flap, buckle);
      bag.position.copy(P('thigh_r')).add(new THREE.Vector3(-sL * 0.21, 0.12, 0.02));
      for (const m of [strapF, strapB, bag]) {
        m.traverse((o) => o.isMesh && (o.castShadow = true));
        this.model.add(m);
      }
      this.model.updateMatrixWorld(true);
      (this.bones.spine_02 || pelvis).attach(strapF);
      (this.bones.spine_02 || pelvis).attach(strapB);
      pelvis.attach(bag);
    }
    if (props.includes('letters')) {
      const g = new THREE.Group();
      const paper = fogMat({ color: '#e6dcc6', roughness: 0.95 });
      const twine = fogMat({ color: '#7a5a3a', roughness: 0.9 });
      for (let i = 0; i < 5; i++) {
        const env = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.007, 0.1), paper);
        env.position.set((Math.random() - 0.5) * 0.012, i * 0.008, (Math.random() - 0.5) * 0.012);
        env.rotation.y = (Math.random() - 0.5) * 0.15;
        g.add(env);
      }
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.045, 0.008), twine);
      tie.position.y = 0.02;
      g.add(tie);
      const sL = sideOf('hand_l');
      g.position.copy(P('hand_l')).add(new THREE.Vector3(sL * 0.07, -0.035, 0.02));
      g.traverse((o) => o.isMesh && (o.castShadow = true));
      this.model.add(g);
      this.model.updateMatrixWorld(true);
      this.bones.hand_l.attach(g);
    }
    if (props.includes('rag')) {
      const rag = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), fogMat({ color: '#d8cbb0', roughness: 1 }));
      rag.scale.set(1.3, 0.55, 1);
      const sR = sideOf('hand_r');
      rag.position.copy(P('hand_r')).add(new THREE.Vector3(sR * 0.06, -0.04, 0.02));
      this.model.add(rag);
      this.model.updateMatrixWorld(true);
      this.bones.hand_r.attach(rag);
    }
    if (hat) head?.attach(hat);
    (this.bones.spine_02 || pelvis)?.attach(torso);
    if (skirt) pelvis?.attach(skirt);
    neck?.attach(cs);

    // which side is "_l"?
    this.model.updateMatrixWorld(true);
    const lx = this.bones.upperarm_l.getWorldPosition(v1).x;
    this.sideL = Math.sign(lx) || 1;

    this.bind = new Map();
    for (const b of Object.values(this.bones)) this.bind.set(b, b.quaternion.clone());
    this.model.scale.setScalar(BODY_SCALE);
  }

  reset() {
    for (const [b, q] of this.bind) b.quaternion.copy(q);
  }

  /** Rotate `bone` so the direction to `child` points along `dirW` (world). */
  aim(bone, child, dirW, weight = 1) {
    if (!bone || !child) return;
    bone.updateWorldMatrix(true, false);
    child.updateWorldMatrix(false, false);
    const from = child.getWorldPosition(v1).sub(bone.getWorldPosition(v2)).normalize();
    const delta = q1.setFromUnitVectors(from, v3.copy(dirW).normalize());
    if (weight < 1) delta.slerp(q3.identity(), 1 - weight);
    const bw = bone.getWorldQuaternion(q2);
    const pw = bone.parent.getWorldQuaternion(q3).invert();
    bone.quaternion.copy(pw.multiply(delta.multiply(bw)));
    bone.updateMatrixWorld(true);
  }

  /** Rotate `bone` by `angle` around a world axis. */
  turn(bone, axisW, angle) {
    if (!bone || !angle) return;
    bone.updateWorldMatrix(true, false);
    const r = q1.setFromAxisAngle(axisW, angle);
    const bw = bone.getWorldQuaternion(q2);
    const pw = bone.parent.getWorldQuaternion(q3).invert();
    bone.quaternion.copy(pw.multiply(r.multiply(bw)));
    bone.updateMatrixWorld(true);
  }

  /**
   * @param root   the detective's root (for character-space axes)
   * @param phase  walk phase (radians), w: walk blend 0..1, t: time, look: head yaw
   */
  pose(root, phase, w, t, look, lookPitch) {
    const b = this.bones;
    this.reset();
    root.updateMatrixWorld(true);
    const rq = root.getWorldQuaternion(new THREE.Quaternion());
    const C = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(rq); // character -> world
    const up = C(0, 1, 0), right = C(-1, 0, 0);
    const L = this.sideL, R = -this.sideL;

    const s = Math.sin(phase), c = Math.cos(phase);
    const breathe = Math.sin(t * 1.6) * 0.018 * (1 - w);

    // torso: a forward lean while walking, breathing at rest, counter-twist to the stride
    this.turn(b.spine_01, right, 0.06 * w + breathe * 0.5);
    this.turn(b.spine_02, up, s * 0.07 * w);
    this.turn(b.spine_03, right, breathe);

    // legs
    for (const [side, ph] of [[L, 0], [R, Math.PI]]) {
      const sfx = side === L ? '_l' : '_r';
      const sw = Math.sin(phase + ph) * 0.4 * w;
      const knee = (0.06 + 0.7 * Math.max(0, Math.cos(phase + ph))) * w + 0.04;
      this.aim(b['thigh' + sfx], b['calf' + sfx], C(side * 0.05, -1, Math.tan(sw)));
      this.aim(b['calf' + sfx], b['foot' + sfx], C(side * 0.02, -1, Math.tan(sw - knee)));
      this.aim(b['foot' + sfx], b['ball' + sfx], C(0, -0.42 + Math.max(0, -Math.sin(phase + ph)) * 0.3 * w, 1));
    }

    // left arm swings opposite the left leg; the right hand carries the lantern
    const swL = -s * 0.42 * w;
    this.aim(b.upperarm_l, b.lowerarm_l, C(L * 0.2, -1, Math.tan(swL)));
    this.aim(b.lowerarm_l, b.hand_l, C(L * 0.1, -1, Math.tan(swL + 0.18 + 0.25 * w)));
    this.aim(b.upperarm_r, b.lowerarm_r, C(R * 0.24, -1, 0.12 + s * 0.12 * w));
    this.aim(b.lowerarm_r, b.hand_r, C(R * 0.06, -1, 0.75));
    // curl the fingers around the lantern handle and relax the left hand
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      for (let k = 1; k <= 3; k++) {
        this.turn(b[`${f}_0${k}_r`], right, -0.55);
        this.turn(b[`${f}_0${k}_l`], right, -0.22);
      }
    }

    // head and neck look around
    this.turn(b.neck_01, up, look * 0.4);
    this.turn(b.Head, up, look * 0.6);
    this.turn(b.Head, right, lookPitch);
  }

  /**
   * Suspect idles. kind: 'polish' | 'pray' | 'letters' | 'crossed' | 'talk' | 'break'
   * `face` turns the head toward the detective (radians, character space).
   */
  idle(root, t, kind, face = 0, k = 1) {
    const b = this.bones;
    this.reset();
    root.updateMatrixWorld(true);
    const rq = root.getWorldQuaternion(new THREE.Quaternion());
    const C = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(rq);
    const up = C(0, 1, 0), right = C(-1, 0, 0);
    const L = this.sideL, R = -this.sideL;
    const breathe = Math.sin(t * 1.5) * 0.02;
    const sway = Math.sin(t * 0.6) * 0.03;
    this.turn(b.spine_01, up, sway);
    this.turn(b.spine_03, right, breathe);
    // legs: stand, weight shifting
    for (const [side, sfx] of [[L, '_l'], [R, '_r']]) {
      const shift = kind === 'crossed' && side === L ? Math.max(0, Math.sin(t * 2.4)) * 0.12 : 0;
      this.aim(b['thigh' + sfx], b['calf' + sfx], C(side * 0.07, -1, 0.02 + shift));
      this.aim(b['calf' + sfx], b['foot' + sfx], C(side * 0.03, -1, -0.04));
      this.aim(b['foot' + sfx], b['ball' + sfx], C(side * 0.15, -0.4 + shift * 2, 1));
    }
    const arm = (sfx, side, upper, lower) => {
      this.aim(b['upperarm' + sfx], b['lowerarm' + sfx], C(upper[0] * side, upper[1], upper[2]));
      this.aim(b['lowerarm' + sfx], b['hand' + sfx], C(lower[0] * side, lower[1], lower[2]));
    };
    let pitch = 0;
    if (kind === 'pray') {
      const r = Math.sin(t * 0.9) * 0.05;
      arm('_l', L, [0.2, -1, 0.42], [-0.62, 0.95 + r, 0.42]);
      arm('_r', R, [0.2, -1, 0.42], [-0.62, 0.95 + r, 0.42]);
      pitch = 0.32 + r;
      this.turn(b.spine_02, right, 0.12);
    } else if (kind === 'polish') {
      const cx = Math.cos(t * 4.2) * 0.12, cy = Math.sin(t * 4.2) * 0.08;
      arm('_l', L, [0.12, -1, 0.42], [-0.5, -0.05, 1]);
      arm('_r', R, [0.12, -1, 0.42], [-0.5 + cx, -0.05 + cy, 1]);
      pitch = 0.42;
      this.turn(b.spine_02, right, 0.1);
    } else if (kind === 'letters') {
      const flick = Math.max(0, Math.sin(t * 2.0)) * 0.25;
      arm('_l', L, [0.15, -1, 0.3], [-0.35, 0.28, 1]);
      arm('_r', R, [0.18, -1, 0.3 + flick * 0.3], [-0.25 + flick, 0.35, 1]);
      pitch = 0.3;
    } else if (kind === 'crossed') {
      arm('_l', L, [0.28, -1, 0.38], [-1, 0.12, 0.28]);
      arm('_r', R, [0.28, -1, 0.45], [-1, 0.22, 0.2]);
      pitch = -0.06 + Math.sin(t * 0.5) * 0.04;
    } else if (kind === 'talk') {
      const g = Math.sin(t * 3.1) * 0.25, g2 = Math.sin(t * 2.3 + 1) * 0.2;
      arm('_l', L, [0.2, -1, 0.35 + g * 0.3], [0.1, -0.1 + g, 1]);
      arm('_r', R, [0.18, -1, 0.15], [0.05, -1, 0.35 + g2]);
      pitch = Math.sin(t * 2.0) * 0.05;
    } else if (kind === 'break') {
      // the act drops: shoulders fall, head bows, hands hang
      arm('_l', L, [0.06, -1, 0.12], [0.02, -1, 0.06]);
      arm('_r', R, [0.06, -1, 0.12], [0.02, -1, 0.06]);
      this.turn(b.spine_02, right, 0.28 * k);
      this.turn(b.spine_03, right, 0.2 * k);
      pitch = 0.5 * k;
    } else {
      arm('_l', L, [0.18, -1, 0.05], [0.1, -1, 0.15]);
      arm('_r', R, [0.18, -1, 0.05], [0.1, -1, 0.15]);
    }
    if (kind !== 'break') {
      this.turn(b.neck_01, up, face * 0.4);
      this.turn(b.Head, up, face * 0.6);
    }
    this.turn(b.Head, right, pitch);
  }

  handWorld(target) {
    return this.bones.hand_r.getWorldPosition(target);
  }
}

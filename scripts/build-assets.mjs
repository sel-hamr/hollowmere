/**
 * Asset pipeline: packs the Quaternius CC0 kits into two web-ready GLBs.
 *
 *   assets-src/village/*.gltf     -> public/assets/village.glb
 *   assets-src/characters/*.gltf  -> public/assets/detective.glb
 *
 * Only the pieces the game uses are kept. Textures are resized and re-encoded
 * as WebP, geometry is welded, deduplicated and meshopt-compressed.
 *
 * Usage: node scripts/build-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, meshopt, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(OUT, { recursive: true });

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

export const VILLAGE_PIECES = [
  // walls
  'Wall_Plaster_Straight', 'Wall_Plaster_Straight_Base', 'Wall_Plaster_Window_Wide_Flat', 'Wall_Plaster_Window_Thin_Round',
  'Wall_Plaster_Window_Wide_Round', 'Wall_Plaster_Door_Flat', 'Wall_Plaster_Door_Round', 'Wall_Plaster_WoodGrid',
  'Wall_UnevenBrick_Straight', 'Wall_UnevenBrick_Window_Wide_Round', 'Wall_UnevenBrick_Window_Thin_Round',
  'Wall_UnevenBrick_Door_Round', 'Wall_UnevenBrick_Door_Flat', 'Wall_BottomCover',
  'Corner_Exterior_Wood', 'Corner_Exterior_Brick',
  // openings
  'Window_Wide_Flat1', 'Window_Thin_Round1', 'Window_Wide_Round1',
  'WindowShutters_Wide_Flat_Open', 'WindowShutters_Wide_Flat_Closed', 'WindowShutters_Thin_Round_Closed',
  'WindowShutters_Thin_Round_Open', 'WindowShutters_Wide_Round_Closed',
  'Door_1_Flat', 'Door_2_Round', 'Door_4_Flat', 'Door_8_Round', 'DoorFrame_Flat_WoodDark', 'DoorFrame_Round_Brick',
  // roofs
  'Roof_RoundTiles_4x4', 'Roof_RoundTiles_4x6', 'Roof_RoundTiles_4x8', 'Roof_RoundTiles_6x6', 'Roof_RoundTiles_6x8',
  'Roof_Front_Brick4', 'Roof_Front_Brick6', 'Roof_Tower_RoundTiles', 'Roof_Dormer_RoundTile',
  // floors and overhangs
  'Floor_WoodDark', 'Overhang_Plaster_Long', 'Balcony_Simple_Straight', 'Stairs_Exterior_Straight',
  // props
  'Prop_Chimney', 'Prop_Chimney2', 'Prop_Crate', 'Prop_Wagon', 'Prop_WoodenFence_Single', 'Prop_WoodenFence_Extension1',
  'Prop_MetalFence_Ornament', 'Prop_MetalFence_Simple', 'Prop_Vine1', 'Prop_Vine2', 'Prop_Vine5', 'Prop_Vine6',
  'Prop_ExteriorBorder_Straight1', 'Prop_ExteriorBorder_Corner', 'Prop_Support',
  'Prop_Brick1', 'Prop_Brick2', 'Prop_Brick3', 'Prop_Brick4',
];

/** Read a .gltf, repairing image URIs that point at files with a stray "_png" suffix. */
async function readGltf(file) {
  const dir = path.dirname(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const img of json.images || []) {
    if (img.uri && !fs.existsSync(path.join(dir, img.uri))) {
      const fixed = img.uri.replace(/_png(\.png)$/, '$1');
      if (fs.existsSync(path.join(dir, fixed))) img.uri = fixed;
      else console.warn('  missing image', img.uri, 'in', path.basename(file));
    }
  }
  const resources = {};
  for (const b of json.buffers || []) resources[b.uri] = new Uint8Array(fs.readFileSync(path.join(dir, b.uri)));
  for (const i of json.images || []) if (i.uri) resources[i.uri] = new Uint8Array(fs.readFileSync(path.join(dir, i.uri)));
  return io.readJSON({ json, resources });
}

async function finish(doc, outFile, { maxTex = 1024 } = {}) {
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    unpartition(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxTex, maxTex], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' })
  );
  await io.write(outFile, doc);
  const kb = Math.round(fs.statSync(outFile).size / 1024);
  console.log(`  -> ${path.relative(ROOT, outFile)} (${kb} KB)`);
}

async function buildVillage() {
  console.log('Village kit');
  const doc = new Document();
  for (const name of VILLAGE_PIECES) {
    const file = path.join(SRC, 'village', `${name}.gltf`);
    if (!fs.existsSync(file)) {
      console.warn('  skip missing', name);
      continue;
    }
    mergeDocuments(doc, await readGltf(file));
  }
  // one scene, every piece a named root node
  const root = doc.getRoot();
  const main = root.listScenes()[0];
  for (const scene of root.listScenes().slice(1)) {
    for (const n of scene.listChildren()) main.addChild(n);
    scene.dispose();
  }
  root.setDefaultScene(main);
  await finish(doc, path.join(OUT, 'village.glb'));
}

async function buildDetective() {
  console.log('Detective');
  const doc = new Document();
  for (const f of ['Superhero_Male_FullBody', 'Hair_SimpleParted', 'Hair_Beard']) {
    const sub = await readGltf(path.join(SRC, 'characters', `${f}.gltf`));
    // tag each scene so the runtime can tell body from hair
    sub.getRoot().listScenes()[0].setName(f);
    mergeDocuments(doc, sub);
  }
  await finish(doc, path.join(OUT, 'detective.glb'), { maxTex: 1024 });
}

async function buildCharacters() {
  console.log('Suspects');
  const doc = new Document();
  const parts = ['Superhero_Female_FullBody', 'Superhero_Male_FullBody', 'Hair_Long', 'Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_SimpleParted', 'Hair_Beard'];
  for (const f of parts) {
    const file = path.join(SRC, 'characters', `${f}.gltf`);
    if (!fs.existsSync(file)) {
      console.warn('  skip missing', f);
      continue;
    }
    const sub = await readGltf(file);
    sub.getRoot().listScenes()[0].setName(f);
    mergeDocuments(doc, sub);
  }
  await finish(doc, path.join(OUT, 'characters.glb'), { maxTex: 1024 });
}

await buildVillage();
await buildDetective();
await buildCharacters();
console.log('done');

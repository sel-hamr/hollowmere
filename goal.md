# HOLLOWMERE — Game Vision & Goal

> *Two hundred and twelve souls. One night of fog. Not a single footprint.*

A browser detective mystery, built with Three.js and WebGL. Each chapter is a
small hand-built diorama room that the player looks into from above, as if the
room were a museum model kept under glass. The goal is a game that looks like
someone spent years on it: every surface, light, sound and transition chosen
on purpose, and nothing left at its default setting.

---

## 1. The premise

**Hollowmere** is an old village in a valley where fog never fully lifts. It
has narrow cobbled lanes, timber-framed houses with steep slate roofs, a
chapel whose bell tower clock stopped at 3:13, shops with their doors still
unlocked and bread still in the ovens.

On the night of the first winter rain, the fog rolled down from the hills and
**every inhabitant vanished**. There were no signs of struggle, no tracks in
the snow, and no bodies. Lamps were left burning. A single chimney still smokes.

Weeks later, a detective arrives with a letter in their pocket. It asks them to
come to Hollowmere, and it is signed by the village mayor: one of the 212 who
disappeared.

Not everyone is gone. A handful of people still move through the fog: a
postman who keeps delivering letters to empty houses, a priest who rings the
bell every night, a peddler who arrived the same week as the fog, a child who
will not say her name. Every one of them knows something. Every one of them
lies.

### Tone
- **Cozy-eerie.** The rooms are warm, tactile and handmade, but the silence
  around them is wrong. Think of a snow globe that holds something sad.
- **Strange silence.** The world sounds empty: rain, wind, a distant bell, a
  dripping gutter. Music is sparse and only rises when something matters.
- **No gore, no jump scares.** The tension comes from detail, contradiction
  and what is missing.

---

## 2. Core gameplay loop

Each chapter is one crime-scene room with one mystery.

1. **Enter the room.** A short establishing shot, then the chapter title card.
2. **Investigate with limited actions.** The detective has a fixed budget of
   actions (for example 8) shown by a counter on screen. Each action costs 1:
   - **Search** an object (click it). Objects that hide a clue glow with a
     soft lantern-gold outline on hover.
   - **Question** a suspect (click them). Answers may contain lies or
     contradictions.
3. **Notebook.** Every found clue and every statement is written into the
   detective's notebook. The player can place two entries side by side to
   compare them, and a contradiction is marked when found.
4. **Confront.** Presenting a clue to a suspect *costs an action* and can
   unlock a new line of dialogue or break a lie.
5. **Accuse.** When the actions run out (or the player decides early), the
   player must name the culprit and pick up to three supporting pieces of
   evidence.
   - **Wrong:** the chapter is lost with a short fail vignette, and it can be
     replayed. Clue positions stay the same; some dialogue varies.
   - **Right:** a **dramatic reveal scene** plays in the diorama (the camera
     pushes in, the light shifts, the culprit's idle animation breaks).
6. **Unlock** the next chapter. Each solved chapter adds a page to the larger
   mystery of the disappearance, building toward the **final twist**.

### Design rules
- Every action must be a real choice. A full playthrough of a room should be
  impossible within the budget, so the player has to reason, not sweep.
- Every lie must be **provable** from evidence inside that room. No guessing.
- Suspects have **3–4 per room**, each with a distinct silhouette, personality,
  a secret that is *not* the crime (a red herring with emotional weight) and
  an idle animation that hints at character (fidgeting, praying, polishing).

---

## 3. Chapters

| # | Chapter | Room | Mood | Palette mood |
|---|---------|------|------|--------------|
| Prologue | **The Fog Gate** | The village square at night, in winter rain | Arrival | Cold moonlight, warm lamp pools |
| I | **The Lamplighter's Shop** | A cluttered workshop of oil lamps and wicks | Investigation | Warm amber |
| II | **The Bakery Left Warm** | A bakery with bread still in the oven | Investigation | Rose and ochre |
| III | **The Chapel of Thirteen Bells** | The bell tower, clock stopped at 3:13 | Tension | **Midnight** deep blue |
| IV | **The Ferryman's House** | A stilt house over the black mere | Unease | Fog green-grey |
| V | **The Mayor's Archive** | The town hall records room | Finale | **Midnight** crimson |

### The final twist (proposed, open to change)
The letter that summoned the detective is written in the detective's own
handwriting, dated thirty years ago. The detective is the one child who walked
out of Hollowmere's *first* disappearance and has no memory of it. The fog has
come back for the last name on the register.

Each chapter quietly plants one piece of this: a child's drawing of a
detective's hat in Chapter I, a missing page in the baptism book in Chapter
III, a name scratched off the ferry ledger in Chapter IV.

---

## 4. Art direction: *Isometric Diorama*

### The look in one sentence
A miniature world under soft light, floating on a plain fog-coloured
background, built from rounded low-poly shapes painted in flat matte colours.

### Rules
- **Diorama framing.** Each room is two walls, a floor and a **thick base
  slab** showing earth and stone strata, like a cut-away model. The prologue
  village sits on an island slab whose edges crumble into fog.
- **Camera.** Orthographic, looking down at about 33° and turned 45°. It can
  be panned within limits (drag), zoomed a little (wheel or pinch), and drifts
  very slightly with the cursor so the room feels alive.
- **Models.** Low-poly with **rounded bevels** on boxy shapes. Rocks and
  cobbles are faceted. Nothing is perfectly straight: shutters hang crooked,
  fences lean, roofs sag a few degrees.
- **Materials.** Matte, with no textures except **one shared palette
  texture**. Every mesh's UVs point at a colour swatch. Matching emissive and
  roughness palettes let windows glow and wet stone shine from the same
  swatch grid. One material, very few draw calls.
- **Lighting.** Soft and atmospheric: one key light (moon or window) with
  **blurred shadows**, a dim sky fill, warm practical lights (lamps, lanterns,
  windows), **ambient occlusion** for gentle dark corners, and a light bloom
  on anything that glows.
- **Atmosphere.** Height fog that rolls slowly over the ground, rain streaks,
  ripples in puddles, chimney smoke, drifting mist under the slab.
- **Detail density.** Small things carry the story: missing-person notices,
  a door left ajar, a cart with a broken wheel, a cat bowl still full,
  icicles, footprints that stop.

### Base palette (night, winter)
| Role | Hex |
|------|-----|
| Snow | `#dfe6ee` / shade `#b4c0cf` |
| Cobble (wet) | `#6a676c` / `#4b4950` |
| Plaster | `#cbbba1` / `#a8977f` |
| Timber | `#3b2b24` |
| Wood | `#6b4f3a` / `#8a6a4f` |
| Slate roof | `#424a5a` |
| Moss / pine | `#3a4a40` / `#2a3833` |
| Iron | `#2b2e35` |
| Brass | `#b08a4a` |
| Window glow | `#ffae57` (emissive) |
| Lamp glow | `#ffd28a` (emissive) |
| Detective coat | `#6a5844` |
| Scarf | `#8e3131` |
| Fog / background | `#26303d` → `#0b0f17` |

Each chapter adds a **mood grade** on top: a colour shift on the key light,
fog and UI accent. Warm amber for investigation rooms, Midnight for tension.

---

## 5. UI direction

- **Clean, elegant, quiet.** Old serif display type (Cormorant Garamond) for
  titles and a condensed sans (Barlow Condensed) for controls. Paper-white ink
  on translucent dark panels, with one lantern-gold accent.
- **Title screen.** The title is set large on the left over the live 3D
  village, with a vertical menu below it: *Continue · New Case · Chapters ·
  Settings · Credits*. The selected item gets a thin framed box. Version tag
  in the lower-right corner.
- **In-game HUD.** Action counter as a row of small lantern icons that go out
  one by one. Notebook as a leather-bound side panel. Dialogue as a
  bottom card with the suspect's name and portrait silhouette.
- UI colour follows the chapter mood.
- Full keyboard support, readable at phone width, reduced-motion respected.

---

## 6. Audio direction

- **Ambience:** rain (near and far layers), gusts of wind, dripping gutters, a
  distant chapel bell, a raven.
- **Music:** sparse and suspenseful. A low drone in D minor, a music-box
  motif that plays a few notes and stops, and a swell for reveals.
- **SFX:** soft UI ticks, page turns for the notebook, a lantern clink on
  footsteps, thunder.
- Everything is synthesised in the browser with the Web Audio API for the first
  builds, so the download stays tiny. Recorded audio can replace it later.

---

## 7. Technology

| Area | Choice | Why |
|------|--------|-----|
| Build | **Vite** | Instant dev server, small optimised production bundles |
| 3D | **Three.js** (WebGL 2) | Mature, flexible, runs everywhere |
| Post FX | Three.js `EffectComposer`: GTAO, outline, bloom, custom grade (vignette, grain, flash) | Soft AO, hover glow, cinematic finish |
| Geometry | Kit houses assembled on the 2 m grid and baked to one mesh per material; terrain, props and FX procedural | Few draw calls, real PBR materials where it matters |
| Weather shader | Snow settles on every upward-facing surface of the kit, everything else turns rain-wet | Winter look without hand-painting a single texture |
| Characters | Base mesh dressed per vertex plus bone-attached coat, sleeves, boots, fedora and scarf; procedural aim-based walk and idle | The free pack has no clothes or animations |
| Assets | Quaternius **Medieval Village MegaKit** (houses, chapel, fences, wagon) and **Universal Base Characters** (the detective), CC0 | Packed by `npm run assets` (glTF-Transform: only used pieces, 1K WebP textures, meshopt) into `public/assets/*.glb`, about 2.2 MB |
| Audio | Web Audio API, synthesised | No audio downloads |
| State | Plain ES modules; `localStorage` for settings and save | No framework overhead |

### Performance targets
- First meaningful frame in **under 2 s** on a mid-range phone over 4G.
- **60 fps** on desktop and **30+ fps** on mid-range mobile.
- Quality tiers (Low, Medium, High) that change pixel ratio, shadow resolution,
  AO and rain density, with automatic step-down if the frame rate drops.
- Fewer than 80 draw calls per room.

---

## 8. Goals, non-goals, anti-goals

**Goals**
- A title scene that makes people stop and look before they click anything.
- Rooms that feel physically real at a miniature scale.
- Mysteries that are fair, solvable and satisfying.

**Non-goals (for now)**
- Free movement between rooms, combat, inventory crafting, multiplayer.

**Anti-goals (fail even if it works)**
- Anything that looks like a default Three.js demo: grey lighting, hard
  shadows, flat untextured cubes, stock UI.
- Clutter that has no story reason to be there.
- Puzzles that need guessing or pixel hunting.

---

## 9. Roadmap

1. **Prologue title scene** *(this build)*: winter-night village in the rain,
   the detective, interactive camera, click-to-walk, hover outlines with lore,
   title and menu, synthesised audio, quality settings.
2. Core systems: action counter, search, question, notebook, confront, accuse.
3. Chapter I room and its 3–4 suspects, with idle animations and dialogue.
4. Reveal scenes, fail and replay flow, save and unlock.
5. Chapters II–V, mood grades, final twist.
6. ~~Swap in Quaternius glTF village and character~~ (done in the prologue).
   Next: suspects from the same base characters (female and male bodies,
   20 hairstyles), retargeted clip animations from the Universal Animation
   Library, polish, audio pass, mobile tuning.

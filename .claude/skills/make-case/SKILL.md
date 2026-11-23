---
name: make-case
description: Create a new Hollowmere murder case from a theme, a story idea and a difficulty, all optional. Use when the user asks for a new case.
---

Input (all optional): theme, story, difficulty (easy | normal | hard).
- No theme: use the next unwritten chapter in `goal.md` (e.g. II, The Bakery Left Warm).
- No story, or "your own": invent one that fits the theme, the village and the fog mystery.
- No difficulty: follow the case order (I–II easy, III normal, IV–V hard).
Never ask. Say what you picked in one line, then build.

1. Write `src/room/case<Name>.js` with the same fields as `caseLamplighter.js`, plus `scene`.
2. Choose the scene the story needs. Scenes are data in `src/room/scenes.js`. Never build a new room:
   - `scene: { type: 'room', kind: 'shop' | 'house' | 'inn' | 'chapel', add: [...], remove: ['id'] }`
   - `scene: { type: 'street', add: [...], remove: ['id'] }`: a snowy lane between kit houses.
   - Each kind comes furnished. Read its `layout` for prop ids. `add` takes `{ id, piece, at: [x, y, z], ry, args, label, light }` with pieces from `PIECES`. Reusing an id replaces that prop.
   - Suspect `pos` must be on open floor; the engine nudges anyone placed inside furniture.
   - Preview any scene in the browser with `__hollowmere.previewScene({ type, kind })`.
3. Build the scene as an expert 3D designer: highly detailed, realistic, every detail perfect, made to impress.
   - The scene fills the screen from every camera angle, with no empty floor or bare walls.
   - Every object tells the story: who lives or works here, and what happened tonight.
   - Lived-in wear: crooked frames, scuffs, spills, half-done tasks, things left mid-use.
   - Light shapes the mood: one key light, warm practical lamps, soft shadows, a dark corner or two.
   - Correct scale against the characters, and nothing floats or clips.
   - Clue props are placed naturally, never highlighted by where they sit.
   - If a needed piece is missing, add it to `furniture.js` at the same quality, so later cases can reuse it.
4. Plan the truth first: the victim, the killer, the motive, and a minute-by-minute timeline.
5. Rules:
   - Each innocent suspect tells one lie, has a sad secret that is not the murder, and is near the scene for their own reason.
   - Every lie is broken by one clue in the scene. Nothing is guessed.
   - The killer is caught by two clues tied to their job or life. `proof` lists them.
   - One pair of clues clears an innocent through the timeline.
   - Each lie gets a pair in `contradictions`, and each clue that concerns a suspect gets a line in `confront`.
   - Each wrong suspect gets a `failures` ending. The `reveal` hints at the fog mystery.
   - Looks, props and idle animation match each person's job.
   - The `letter` uses easy English: victim, place, time, the people inside, number of actions, a warning.
6. Each `evidence.object` names a prop id in this scene, and each prop holds one clue at most. Use `place` on an evidence entry to change the name shown before it is searched.
7. Difficulty:
   | | suspects | actions | empty searches | extra |
   |---|---|---|---|---|
   | easy | 3 | 10 | 1 | clues are obvious |
   | normal | 4 | 8 | 3 | — |
   | hard | 4 | 7 | 4 | one fake clue points at an innocent |
8. Register the case in `ROOM_CASES` and `CASE_SPOTS` (`main.js`) and in `CASES` (`ui.js`).
9. Check it in the browser from the follow, talk and search cameras: no empty space, nothing floating, and every clue can be found. Then play the right accusation and a wrong one.

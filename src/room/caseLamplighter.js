/**
 * Case I: The Lamplighter's Shop.
 *
 * Edmund Crane, the oil merchant, lies dead behind the counter of the
 * lamplighter's shop. Four people were near the shop tonight. Every lie
 * below can be proven with evidence found in this room; the killer is
 * Jonah Pike, the postman.
 *
 * Fair-play map
 *  - Marta lies about never coming at night      -> boot prints by the door (e4)
 *  - Anselm lies about staying in the chapel      -> oil ledger entry at 11:40 (e1)
 *  - Crane was alive after Anselm left            -> stopped pocket watch, 12:04 (e6)
 *  - Jonah lies about not coming here             -> burnt letter signed "J" (e3), blue wax on the lamp-iron (e2)
 *  - Ida is honest but hides that she owed Crane  -> debt slip in the cash drawer (e7)
 */
export const CASE_I = {
  id: 'I',
  title: 'The Lamplighter\'s Shop',
  label: 'Case I',
  actions: 8,
  victim: 'Edmund Crane, the oil merchant',
  opening:
    'Edmund Crane, the man who sold oil to every lamp in Hollowmere, lies dead behind the lamplighter\'s counter. The fire is still warm. Four people were near the shop tonight, and one of them killed him.',
  goal: 'Find out who killed Edmund Crane',
  scene: { type: 'room', kind: 'shop' },

  // the letter that invites the detective to the case: plain, easy English
  letter: {
    date: 'Hollowmere, the night of the first frost',
    to: 'To the Detective,',
    intro: [
      'Please come to the Lamplighter\'s Shop right away. A man has been killed.',
      'His name is Edmund Crane. He sold the oil for every lamp in the village. He was found dead behind the shop counter, late last night, after eleven o\'clock. The fire was still warm.',
    ],
    peopleLabel: 'Four people were near the shop. They are waiting inside.',
    people: [
      ['Marta Vell', 'Works in the shop. She found the body.'],
      ['Father Anselm', 'The village priest.'],
      ['Jonah Pike', 'The postman.'],
      ['Ida Morrow', 'Runs the village inn.'],
    ],
    after: 'All four say they did nothing. One of them killed him.',
    rules: 'Talking to a person or searching a place uses 1 action. When you are ready, say who did it and show the proof.',
    warn: 'Be careful. Some of them will lie to you.',
    from: 'The Constable of Hollowmere',
  },

  suspects: [
    {
      id: 'marta',
      name: 'Marta Vell',
      role: 'The lamplighter\'s apprentice',
      body: 'Superhero_Female_FullBody',
      hair: ['Hair_Buns'],
      look: { coat: '#3d4a3a', trousers: '#2a2a26', glove: '#4a3428', shoe: '#2a1d16', scarf: null, hair: '#5a3a22', hat: 'none', skirt: 'apron', slim: 0.86, props: ['rag'] },
      idle: 'polish',
      pos: [2.3, -0.7],
      face: -2.3,
      statement:
        'I came in at first light to fill the lamps and found him like that. I never come to the shop at night. Nobody does, not since the fog.',
      secret: 'She has been lighting every lamp in Hollowmere alone each night, so the village would not look dead.',
      confront: {
        e4: 'Those are mine. All right. I come every night, through the back, and I light the lamps so the place does not look like a grave. I came in at half past twelve and he was already on the floor. I saw the postman\'s lantern going down the lane.',
        e5: 'Of course the tin is empty. Someone has to keep the lamps burning. That doesn\'t make me a killer.',
      },
    },
    {
      id: 'anselm',
      name: 'Father Anselm',
      role: 'Priest of St. Aldric\'s',
      body: 'Superhero_Male_FullBody',
      hair: ['Hair_Buzzed', 'Hair_Beard'],
      look: { coat: '#1f1d22', trousers: '#1a191c', glove: '#2a2523', shoe: '#141212', scarf: null, hair: '#8a8580', hat: 'none', skirt: 'robe', slim: 1.02 },
      idle: 'pray',
      pos: [-2.1, -0.5],
      face: -0.4,
      statement:
        'I was in the chapel all night, ringing the bell for the lost, as I do every night. I only came when I heard Marta scream.',
      secret: 'He came for lamp oil for the bell tower, and has been buying it on credit he cannot repay.',
      confront: {
        e1: 'Yes. Forgive me, I came for oil at twenty to midnight, for the tower lamp. Crane was alive, and in a foul temper. He said he was waiting for someone and wanted me gone. I left at once.',
        e6: 'A quarter past midnight... I was back at my rope by then. You can ask the bell.',
      },
    },
    {
      id: 'jonah',
      name: 'Jonah Pike',
      role: 'The postman',
      body: 'Superhero_Male_FullBody',
      hair: ['Hair_SimpleParted'],
      look: { coat: '#24324a', trousers: '#1d2330', glove: '#2a2420', shoe: '#18140f', scarf: '#6a5a3a', hair: '#4a3626', hat: 'cap', skirt: 'coat', slim: 0.95, props: ['satchel', 'letters'] },
      idle: 'letters',
      pos: [1.5, 2.0],
      face: -2.0,
      statement:
        'I finished my round at ten, same as always. I haven\'t set foot in this shop for weeks. Crane never had any post worth carrying.',
      secret: null,
      culprit: true,
      confront: {
        e3: 'Anyone can sign a letter with a J. Half the people who went missing had a J somewhere in their name. You\'ll need more than ashes.',
        e2: 'That wax... that\'s... He laughed at me. He said nobody would believe a postman over a merchant. I only meant to frighten him.',
      },
    },
    {
      id: 'ida',
      name: 'Ida Morrow',
      role: 'Keeper of the Drowned Lantern Inn',
      body: 'Superhero_Female_FullBody',
      hair: ['Hair_Long'],
      look: { coat: '#5c2630', trousers: '#2e1a1e', glove: '#3a2622', shoe: '#1e1412', scarf: null, hair: '#2a1d18', hat: 'none', skirt: 'dress', slim: 0.88 },
      idle: 'crossed',
      pos: [-0.9, 2.3],
      face: -1.2,
      statement:
        'Crane owed money to half the village, and the other half owed money to him. I was behind my own bar until one, ask anyone. Well, anyone who is left.',
      secret: 'She owed Crane more than the inn is worth, and is glad he is dead.',
      confront: {
        e7: 'So I owed him. So did half of Hollowmere. If being glad were a crime you could hang me twice. But I didn\'t touch him.',
        e1: 'Not my hand. That A is Anselm\'s, he signs everything like a sermon.',
      },
    },
  ],

  // searchable objects: `object` names a furniture piece built by the room
  evidence: [
    {
      id: 'e1',
      object: 'ledger',
      name: 'The oil ledger',
      found: 'Crane\'s ledger, open on the counter. The last entry reads "11:40, two gallons, on credit, A." The ink is still glossy.',
      clue: true,
    },
    {
      id: 'e2',
      object: 'lampiron',
      name: 'A bent lamp-iron',
      found: 'Under the workbench, a lamp-iron bent at the hook. On the grip, a thumb-sized smear of blue sealing wax, the kind the post office uses.',
      clue: true,
    },
    {
      id: 'e3',
      object: 'stove',
      name: 'A half-burnt letter',
      found: 'In the stove, a letter only half burnt: "...I know what you did the night the fog came. Be at the shop at midnight. J." The paper is post office stock.',
      clue: true,
    },
    {
      id: 'e4',
      object: 'prints',
      name: 'Wet boot prints',
      found: 'Small boot prints by the door, still wet with melted snow. Someone came in tonight, not at first light. They lead toward the shelves, then stop.',
      clue: true,
    },
    {
      id: 'e5',
      object: 'shelf',
      name: 'Empty oil tins',
      found: 'Every oil tin on the shelf has been emptied, and wicks have been trimmed recently. Someone has been filling a great many lamps.',
      clue: true,
    },
    {
      id: 'e6',
      object: 'body',
      name: 'Crane\'s pocket watch',
      found: 'Under the sheet, Crane\'s pocket watch, cracked when he fell. The hands stopped at four minutes past midnight.',
      clue: true,
    },
    {
      id: 'e7',
      object: 'drawer',
      name: 'A debt slip',
      found: 'In the cash drawer, a slip in Crane\'s hand: "I. Morrow owes forty crowns, due at the new moon." The new moon was yesterday.',
      clue: true,
    },
    { id: 'x1', object: 'wardrobe', name: 'The wardrobe', found: 'Coats, a moth-eaten scarf, and a smell of lamp smoke. Nothing that matters.', clue: false },
    { id: 'x2', object: 'crates', name: 'Crates by the door', found: 'Wicks, glass chimneys and straw. Nobody has opened these in weeks.', clue: false },
    { id: 'x3', object: 'window', name: 'The window', found: 'Fog presses on the glass. Beyond it the lane is empty, and the lamps are lit all the way down.', clue: false },
  ],

  // pairs that contradict each other when compared in the notebook
  contradictions: [
    { a: 's:marta', b: 'e4', text: 'Marta said she never comes at night, but her wet prints say she was here tonight.' },
    { a: 's:anselm', b: 'e1', text: 'Father Anselm said he never left the chapel, but the ledger puts him here at 11:40.' },
    { a: 'e1', b: 'e6', text: 'Crane was alive at 11:40 and died at 12:04. Whoever was here at 11:40 left before he was killed.' },
    { a: 's:jonah', b: 'e3', text: 'Jonah said he hasn\'t been here in weeks, but someone signing "J" on post office paper arranged to meet Crane here at midnight.' },
    { a: 's:jonah', b: 'e2', text: 'Jonah said he never came here, yet the weapon carries post office sealing wax.' },
    { a: 's:ida', b: 'e7', text: 'Ida talked about other people\'s debts and left out her own.' },
  ],

  culprit: 'jonah',
  proof: ['e2', 'e3'], // at least one must be presented to make the accusation stick

  reveal: {
    title: 'The postman\'s round',
    text:
      'Jonah Pike read the post before he carried it. When the fog took the village he found Crane\'s letters, and learned what Crane had done the night it came. He wrote to him, signed it J, and met him here at midnight. Crane laughed. The lamp-iron was the nearest thing to hand. What Crane did that night, Jonah will not say. Not yet.',
  },
  failures: {
    marta: 'Marta is taken away in tears, still smelling of lamp oil. Down the lane, the lamps begin to go out one by one, and the real killer finishes his round.',
    anselm: 'The priest goes quietly. That night nobody rings the bell, and in the silence someone walks home whistling.',
    ida: 'Ida laughs when they take her. "You found the debt and stopped looking," she says. She is right.',
    jonah: 'You name the postman, but without proof the charge falls apart by morning. Jonah tips his cap on his way out.',
  },
};

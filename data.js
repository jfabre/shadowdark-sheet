// ══════════════════════════════════════════════════════
//  GAME DATA — Shadowdark RPG reference tables
//  Loaded before script.js via <script> tag.
// ══════════════════════════════════════════════════════

const ABILITY_STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const CORE_CLASS_ICONS = {
  fighter: '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75l.063-.062c21.827 21.93 44.04 43.923 66.405 66.25c-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53l68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938l-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593c-43.852-43.8-86.462-85.842-130.125-125.47c-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562l56.81-56.812l13.22 13.187l-56.438 56.44l24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906l200.56 200.53a403 403 0 0 1-13.405 13.032L148.875 153.53zm-76.69 113.28l-28.5 28.532l68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717l28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313c17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655l-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844l-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594c-15.068-18.587-28.38-38.758-39.5-60.625z"/></svg>',
  priest:  '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="m256 21.938l-4.025 2.01c-96 48-93.455 47.175-189.455 63.175l-8.592 1.432l1.15 8.634c16.125 120.934 48.338 217.868 85.022 285.12c18.34 33.627 37.776 59.85 57.263 78.022C216.85 478.502 236.625 489 256 489s39.15-10.497 58.637-28.668s38.922-44.395 57.263-78.02c36.684-67.254 68.897-164.188 85.022-285.123l1.15-8.635l-8.592-1.432c-96-16-93.455-15.174-189.455-63.174zM224 64c16 0 16 0 32 16c16-16 16-16 32-16c-16 16-16 16-16 32l2.666 48h109.158S400 144 416 128c0 16 0 16-16 32c16 16 16 16 16 32c-16-16-32.176-16-32.176-16h-107.38L288 384s0 32 16 64c-16 0-48 0-48-16c0 16-32 16-48 16c16-32 16-64 16-64l11.555-208H128.13S112 176 96 192c0-16 0-16 16-32c-16-16-16-16-16-32c16 16 32.13 16 32.13 16h109.204L240 96c0-16 0-16-16-32"/></svg>',
  thief:   '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M254.07 19.707c-56.303 28.998-106.297 107.317-122.64 168.707c32.445 2.11 58.63 12.963 78.638 30.848l9.334-10.198c-13.336-13.056-30.596-23.9-52.994-34.707c12.68-31.542 32.01-79.29 56.598-82.07c9.62-1.088 19.92 4.722 31.13 21.068c35.08-58.334 68.394 18.705 87.727 61.002c-21.94 11.897-39.132 22.82-52.63 36.024l8.68 9.76c19.68-17.732 45.72-29.358 78.55-31.673C358.24 127.335 311.515 50.14 254.07 19.707M219.617 144.57c-8.894 0-16.103 3.952-16.103 8.826s7.21 8.827 16.103 8.827s16.106-3.95 16.106-8.827c0-4.874-7.212-8.826-16.106-8.826m68.965 0c-8.894 0-16.105 3.952-16.105 8.826s7.21 8.827 16.105 8.827s16.106-3.95 16.106-8.827c0-4.874-7.212-8.826-16.106-8.826m-118.894 70.88a233 233 0 0 0-6.444 11.52c-25.587 48.98-43.26 123.643-43.896 223.48c32.776 18.89 64.322 31.324 95.707 36.988c-35.5-24.36-60.375-80.893-60.375-146.754c0-45.97 12.12-87.39 31.51-116.506a96 96 0 0 0-16.502-8.727zm168.933.35a98.5 98.5 0 0 0-16.298 8.764c19.24 29.095 31.254 70.354 31.254 116.12c0 65.82-24.844 122.322-60.306 146.707c30.88-5.598 62.44-17.812 95.656-36.947c-.638-99.57-18.31-174.163-43.9-223.177a234 234 0 0 0-6.405-11.467zm-97.665 23.61c7.026 22.543 9.128 45.086.98 67.63h-41.552v18.513c10.057-3.24 20.25-5.39 30.502-6.594c.066 50.215 1.313 96.574 19.82 145.435l4.193 11.074l4.485-10.962c19.48-47.615 18.045-95.297 17.933-145.024c10.257 1.333 20.463 3.4 30.545 6.07v-18.515h-41.374c-6.888-22.544-5.932-45.087.803-67.63h-26.335z"/></svg>',
  wizard:  '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M319.61 20.654c13.145 33.114 13.144 33.115-5.46 63.5c33.114-13.145 33.116-13.146 63.5 5.457c-13.145-33.114-13.146-33.113 5.457-63.498c-33.114 13.146-33.113 13.145-63.498-5.459zM113.024 38.021c-11.808 21.04-11.808 21.04-35.724 24.217c21.04 11.809 21.04 11.808 24.217 35.725c11.808-21.04 11.808-21.04 35.724-24.217c-21.04-11.808-21.04-11.808-24.217-35.725m76.55 56.184c-.952 50.588-.95 50.588-41.991 80.18c50.587.95 50.588.95 80.18 41.99c.95-50.588.95-50.588 41.99-80.18c-50.588-.95-50.588-.95-80.18-41.99zm191.177 55.885c-.046 24.127-.048 24.125-19.377 38.564c24.127.047 24.127.046 38.566 19.375c.047-24.126.046-24.125 19.375-38.564c-24.126-.047-24.125-.046-38.564-19.375m-184.086 83.88a96 96 0 0 0-3.492.134c-18.591 1.064-41.868 8.416-77.445 22.556L76.012 433.582c78.487-20.734 132.97-21.909 170.99-4.615V247.71c-18.076-8.813-31.79-13.399-46.707-13.737a91 91 0 0 0-3.629-.002zm122.686 11.42a209 209 0 0 0-8.514.098c-12.81.417-27.638 2.215-45.84 4.522v177.135c43.565-7.825 106.85-4.2 171.244 7.566l-39.78-177.197c-35.904-8.37-56.589-11.91-77.11-12.123zm2.289 16.95c18.889.204 36.852 2.768 53.707 5.02l4.437 16.523c-23.78-3.75-65.966-4.906-92.467-.98l-.636-17.805c11.959-2.154 23.625-2.88 34.959-2.758m-250.483 4.658L60.54 313.002h24.094l10.326-46.004H71.158zm345.881 0l39.742 177.031l2.239 9.973l22.591-.152l-40.855-186.852zm-78.857 57.82c16.993.026 33.67.791 49.146 2.223l3.524 17.174c-32.645-3.08-72.58-2.889-102.995 0l-.709-17.174c16.733-1.533 34.04-2.248 51.034-2.223m-281.793 6.18l-6.924 30.004h24.394l6.735-30.004H56.389zm274.418 27.244c4.656.021 9.487.085 14.716.203l2.555 17.498c-19.97-.471-47.115.56-59.728 1.05l-.7-17.985c16.803-.493 29.189-.828 43.157-.766m41.476.447c8.268.042 16.697.334 24.121.069l2.58 17.74c-8.653-.312-24.87-.83-32.064-.502l-2.807-17.234a257 257 0 0 1 8.17-.073m-326.97 20.309l-17.985 77.928l25.035-.17l17.455-77.758H45.313zm303.164 11.848c19.608-.01 38.66.774 56.449 2.572l2.996 20.787c-34.305-4.244-85.755-7.697-119.1-3.244l-.14-17.922c20.02-1.379 40.186-2.183 59.795-2.193m-166.606 44.05c-30.112.09-67.916 6.25-115.408 19.76l-7.22 2.053l187.759-1.27v-6.347c-16.236-9.206-37.42-14.278-65.13-14.196zm134.41 6.174c-19.63.067-37.112 1.439-51.283 4.182v10.064l177.594-1.203c-44.322-8.634-89.137-13.17-126.31-13.043zM26 475v18h460v-18z"/></svg>',
};

const INVENTORY_ITEMS = [
  'Arrows (20)', 'Backpack', 'Caltrops (one bag)', 'Coin', 'Crossbow bolts (20)',
  'Crowbar', 'Flask or bottle', 'Flint and steel', 'Gem', 'Grappling hook',
  'Iron spikes (10)', 'Lantern', 'Mirror', 'Oil (flask)', 'Pole',
  'Rations (3)', 'Rope (60\')', 'Torch',
  'Bastard sword', 'Club', 'Crossbow', 'Dagger', 'Greataxe', 'Greatsword',
  'Javelin', 'Longbow', 'Longsword', 'Mace', 'Shortbow', 'Shortsword',
  'Spear', 'Staff', 'Warhammer'
];

const SPELL_DB = [
  { name: 'Cure Wounds', tier: 1, classes: ['Priest'], duration: 'Instant', range: 'Close', desc: 'Touch restores ebbing life. Roll d6s equal to 1 + half level (rounded down). Target regains that many HP.' },
  { name: 'Holy Weapon', tier: 1, classes: ['Priest'], duration: '5 rounds', range: 'Close', desc: 'Weapon becomes magical, +1 to attack and damage rolls.' },
  { name: 'Light', tier: 1, classes: ['Priest', 'Wizard'], duration: '1 hour real time', range: 'Close', desc: 'Object glows with bright heatless light, illuminating near distance.' },
  { name: 'Protection From Evil', tier: 1, classes: ['Priest', 'Wizard'], duration: 'Focus', range: 'Close', desc: 'Chaotic beings have disadv on attacks/spellcasting vs target. Can\'t possess/compel/beguile. On possessed target, entity makes CHA check vs spellcasting check.' },
  { name: 'Shield of Faith', tier: 1, classes: ['Priest'], duration: '5 rounds', range: 'Self', desc: '+2 bonus to AC.' },
  { name: 'Turn Undead', tier: 1, classes: ['Priest'], duration: 'Instant', range: 'Near', desc: 'Undead must make CHA check vs spellcasting check. Fail by 10+ and <= your level = destroyed. Otherwise flees 5 rounds.' },
  { name: 'Augury', tier: 2, classes: ['Priest'], duration: 'Instant', range: 'Self', desc: 'Ask GM one question about course of action. GM says weal or woe.' },
  { name: 'Bless', tier: 2, classes: ['Priest'], duration: 'Instant', range: 'Close', desc: 'One creature gains a luck token.' },
  { name: 'Blind/Deafen', tier: 2, classes: ['Priest'], duration: 'Focus', range: 'Near', desc: 'Blind or deafen one creature. Disadvantage on tasks requiring lost sense.' },
  { name: 'Cleansing Weapon', tier: 2, classes: ['Priest'], duration: '5 rounds', range: 'Close', desc: 'Weapon wreathed in purifying flames. +1d4 damage (1d6 vs undead).' },
  { name: 'Smite', tier: 2, classes: ['Priest'], duration: 'Instant', range: 'Near', desc: 'Punishing flames on creature you can see. 1d6 damage.' },
  { name: 'Zone of Truth', tier: 2, classes: ['Priest'], duration: 'Focus', range: 'Near', desc: 'Creature can\'t utter a deliberate lie while in range.' },
  { name: 'Alarm', tier: 1, classes: ['Wizard'], duration: '1 day', range: 'Close', desc: 'Set magical alarm on object. Bell sounds in head if unauthorized creature touches it.' },
  { name: 'Burning Hands', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Close', desc: 'Circle of flame in close area. 1d6 damage. Flammable objects ignite.' },
  { name: 'Charm Person', tier: 1, classes: ['Wizard'], duration: '1d8 days', range: 'Near', desc: 'Beguile one humanoid LV 2 or less. Regards you as friend.' },
  { name: 'Detect Magic', tier: 1, classes: ['Wizard'], duration: 'Focus', range: 'Near', desc: 'Sense magic within near range. Focus 2 rounds for properties.' },
  { name: 'Feather Fall', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Self', desc: 'Cast when falling. Land safely.' },
  { name: 'Floating Disk', tier: 1, classes: ['Wizard'], duration: '10 rounds', range: 'Near', desc: 'Carries up to 20 gear slots. Hovers at waist level, stays within near.' },
  { name: 'Hold Portal', tier: 1, classes: ['Wizard'], duration: '10 rounds', range: 'Near', desc: 'Hold portal closed. STR check vs spellcasting to open. Knock ends it.' },
  { name: 'Mage Armor', tier: 1, classes: ['Wizard'], duration: '10 rounds', range: 'Self', desc: 'AC becomes 14 (18 on crit spellcasting check).' },
  { name: 'Magic Missile', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Far', desc: 'Advantage on cast check. 1d4 damage to one target.' },
  { name: 'Sleep', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Near', desc: 'Near-sized cube. Living creatures LV 2 or less fall asleep.' },
  { name: 'Acid Arrow', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Far', desc: 'Corrosive bolt, 1d6 damage/round while focusing.' },
  { name: 'Alter Self', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Self', desc: 'Change physical form, gain one anatomical feature.' },
  { name: 'Detect Thoughts', tier: 2, classes: ['Priest', 'Wizard'], duration: 'Focus', range: 'Near', desc: 'Learn target\'s thoughts each round. Target WIS check vs spellcasting to notice.' },
  { name: 'Fixed Object', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Close', desc: 'Object <= 5 lbs fixed in place. Supports up to 5000 lbs.' },
  { name: 'Hold Person', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Near', desc: 'Paralyze one humanoid LV 4 or less.' },
  { name: 'Invisibility', tier: 2, classes: ['Wizard'], duration: '10 rounds', range: 'Close', desc: 'Target invisible. Ends if target attacks or casts.' },
  { name: 'Knock', tier: 2, classes: ['Wizard'], duration: 'Instant', range: 'Near', desc: 'Door/window/gate/chest opens. Defeats mundane locks. Loud knock audible.' },
  { name: 'Levitate', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Self', desc: 'Float near distance vertically per round. Push objects to move horizontally.' },
  { name: 'Mirror Image', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Self', desc: 'Illusory duplicates = half level (min 1). Attacks miss, destroy one duplicate.' },
  { name: 'Misty Step', tier: 2, classes: ['Wizard'], duration: 'Instant', range: 'Self', desc: 'Teleport near distance to area you can see.' },
  { name: 'Silence', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Far', desc: 'Mute sound in near cube. Creatures deafened, sounds can\'t be heard.' },
  { name: 'Web', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Far', desc: 'Near-sized cube of sticky web. STR check vs spellcasting to free.' },
];

const TALENT_LEVELS = [1, 3, 5, 7, 9];

const CLASS_TALENTS = {
  fighter: [
    { roll: '2',     text: 'Gain Weapon Mastery with one additional weapon type' },
    { roll: '3–6',   text: '+1 to melee and ranged attacks' },
    { roll: '7–9',   text: '+2 to Strength, Dexterity, or Constitution stat' },
    { roll: '10–11', text: '+1 AC from a chosen armor type' },
    { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
  ],
  priest: [
    { roll: '2',     text: 'Gain advantage on casting one spell you know' },
    { roll: '3–6',   text: '+1 to melee or ranged attacks' },
    { roll: '7–9',   text: '+1 to priest spellcasting checks' },
    { roll: '10–11', text: '+2 to Strength or Wisdom stat' },
    { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
  ],
  thief: [
    { roll: '2',     text: 'Gain advantage on initiative rolls' },
    { roll: '3–5',   text: 'Backstab deals +1 dice of damage' },
    { roll: '6–9',   text: '+2 to Strength, Dexterity, or Charisma stat' },
    { roll: '10–11', text: '+1 to melee and ranged attacks' },
    { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
  ],
  wizard: [
    { roll: '2',     text: 'Make one random magic item' },
    { roll: '3–7',   text: '+2 to Intelligence stat or +1 to wizard spellcasting checks' },
    { roll: '8–9',   text: 'Gain advantage on casting one spell you know' },
    { roll: '10–11', text: 'Learn one additional wizard spell of any tier you know' },
    { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
  ],
};

const ANCESTRY_FEATURES = {
  dwarf:    { languages: 'Common, Dwarvish', traits: [{ name: 'Stout', desc: 'Start with +2 HP. Roll hit points per level with advantage.' }] },
  elf:      { languages: 'Common, Elvish, Sylvan', traits: [{ name: 'Farsight', desc: 'You get a +1 bonus to attack rolls with ranged weapons or a +1 bonus to spellcasting checks.' }] },
  goblin:   { languages: 'Common, Goblin', traits: [{ name: 'Keen Senses', desc: "You can't be surprised." }] },
  halfling: { languages: 'Common', traits: [{ name: 'Stealthy', desc: 'Once per day, you can become invisible for 3 rounds.' }] },
  'half-orc': { languages: 'Common, Orcish', traits: [{ name: 'Mighty', desc: 'You have a +1 bonus to attack and damage rolls with melee weapons.' }] },
  human:    { languages: 'Common + one additional common language', traits: [{ name: 'Ambitious', desc: 'You gain one additional talent roll at 1st level.' }] },
};

const CLASS_FEATURES = {
  fighter: [
    { name: 'Hauler', desc: 'Add your Constitution modifier, if positive, to your gear slots.' },
    { name: 'Weapon Mastery', desc: 'Choose one type of weapon. You gain +1 to attack and damage with that weapon type. Add half your level to these rolls (round down).' },
    { name: 'Grit', desc: 'Choose Strength or Dexterity. You have advantage on checks of that type to overcome an opposing force, such as kicking open a stuck door (STR) or slipping free of rusty chains (DEX).' },
  ],
  thief: [
    { name: 'Backstab', desc: 'If you hit a creature who is unaware of your attack, you deal an extra weapon die of damage. Add additional weapon dice equal to half your level (round down).' },
    { name: 'Thievery', desc: 'You carry thieving tools (no gear slots). Advantage on checks for:', list: ['Climbing', 'Sneaking & hiding', 'Applying disguises', 'Finding & disabling traps', 'Picking pockets & opening locks'] },
  ],
  wizard: [
    { name: 'Languages', desc: 'You know two additional common languages and two rare languages.' },
    { name: 'Learning Spells', desc: 'You can permanently learn a wizard spell from a spell scroll by studying it for a day and succeeding on a DC 15 Intelligence check. The scroll is expended whether you succeed or fail. Spells learned this way don\'t count toward your known spells.' },
    { name: 'Spellcasting', desc: 'You can cast wizard spells you know. You know three tier 1 spells at level 1. To cast, roll 1d20 + INT mod vs. DC 10 + spell tier. On failure, you can\'t cast that spell again until you rest. Natural 1: roll on the Wizard Mishap table.' },
  ],
  priest: [
    { name: 'Languages', desc: 'You know either Celestial, Diabolic, or Primordial.' },
    { name: 'Turn Undead', desc: 'You know the turn undead spell. It doesn\'t count toward your number of known spells.' },
    { name: 'Deity', desc: 'Choose a god to serve who matches your alignment. You have a holy symbol for your god (takes up no gear slots).' },
    { name: 'Spellcasting', desc: 'You can cast priest spells you know. You know two tier 1 spells at level 1. To cast, roll 1d20 + WIS mod vs. DC 10 + spell tier. On failure, you can\'t cast that spell again until you rest. Natural 1: your deity revokes the spell until penance and a rest.' },
  ],
};

const WEAPONS = [
  { name: 'Bastard sword', damage: '1d8',  stat: 'STR', info: 'M · C · V, 2 slots' },
  { name: 'Club',          damage: '1d4',  stat: 'STR', info: 'M · C' },
  { name: 'Crossbow',      damage: '1d6',  stat: 'DEX', info: 'R · F · 2H, L' },
  { name: 'Dagger',        damage: '1d4',  stat: 'STR', info: 'M/R · C/N · F, Th' },
  { name: 'Greataxe',      damage: '1d8',  stat: 'STR', info: 'M · C · V, 2 slots' },
  { name: 'Greatsword',    damage: '1d12', stat: 'STR', info: 'M · C · 2H, 2 slots' },
  { name: 'Javelin',       damage: '1d4',  stat: 'STR', info: 'M/R · C/F · Th' },
  { name: 'Longbow',       damage: '1d8',  stat: 'DEX', info: 'R · F · 2H' },
  { name: 'Longsword',     damage: '1d8',  stat: 'STR', info: 'M · C' },
  { name: 'Mace',          damage: '1d6',  stat: 'STR', info: 'M · C' },
  { name: 'Shortbow',      damage: '1d4',  stat: 'DEX', info: 'R · F · 2H' },
  { name: 'Shortsword',    damage: '1d6',  stat: 'STR', info: 'M · C' },
  { name: 'Spear',         damage: '1d6',  stat: 'STR', info: 'M/R · C/N · Th' },
  { name: 'Staff',         damage: '1d4',  stat: 'STR', info: 'M · C · 2H' },
  { name: 'Warhammer',     damage: '1d10', stat: 'STR', info: 'M · C · 2H' },
];

// Armor definitions used by both the armor selector dropdown and AC calculation.
const ARMOR_TABLE = {
  none:      { ac: 10, name: 'No armor',   suffix: 'AC 10+DEX · 0 slots', usesDex: true,  slots: 0 },
  leather:   { ac: 11, name: 'Leather',    suffix: 'AC 11+DEX · 1 slot',  usesDex: true,  slots: 1 },
  chainmail: { ac: 13, name: 'Chainmail',  suffix: 'AC 13+DEX · 2 slots', usesDex: true,  slots: 2 },
  plate:     { ac: 15, name: 'Plate',      suffix: 'AC 15 · 3 slots',     usesDex: false, slots: 3 },
};

// ══════════════════════════════════════════════════════
//  SVG ICONS — reusable icon strings for template literals
// ══════════════════════════════════════════════════════

const ICON_SWORD = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="3"/><line x1="5" y1="14" x2="10" y2="19"/><circle cx="2.5" cy="21.5" r="1.5" fill="currentColor" stroke="none"/></svg>';

const ICON_WAND = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>';

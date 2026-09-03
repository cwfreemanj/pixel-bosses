export const ELEMENTS = [
  { key: 'nature', name: 'Nature', icon: '✦', color: '#48f07d', beats: ['void', 'frost'] },
  { key: 'void', name: 'Void', icon: '◈', color: '#9c6cff', beats: ['arcane', 'radiant'] },
  { key: 'arcane', name: 'Arcane', icon: '✧', color: '#37d8ff', beats: ['inferno', 'frost'] },
  { key: 'inferno', name: 'Inferno', icon: '◆', color: '#ff5b45', beats: ['nature', 'blood'] },
  { key: 'frost', name: 'Frost', icon: '❉', color: '#89efff', beats: ['inferno', 'blood'] },
  { key: 'radiant', name: 'Radiant', icon: '☼', color: '#ffe468', beats: ['void', 'blood'] },
  { key: 'blood', name: 'Blood', icon: '♦', color: '#ff347d', beats: ['nature', 'arcane'] }
];

export const RARITIES = [
  { key: 'common', name: 'COMMON', weight: 46, mult: 1, color: '#a7afbf' },
  { key: 'uncommon', name: 'UNCOMMON', weight: 26, mult: 1.1, color: '#37ef79' },
  { key: 'rare', name: 'RARE', weight: 14, mult: 1.25, color: '#39aeff' },
  { key: 'epic', name: 'EPIC', weight: 8, mult: 1.45, color: '#bd73ff' },
  { key: 'legendary', name: 'LEGENDARY', weight: 4, mult: 1.7, color: '#ffd43b' },
  { key: 'mythic', name: 'MYTHIC', weight: 2, mult: 2.05, color: '#ff3e7f' }
];

export const GENESIS_TYPES = [
  { key: 'orc_warlord', name: 'Orc Warlord', element: 'inferno', body: '#348c4a', accent: '#dfff64' },
  { key: 'dragonkin', name: 'Dragonkin', element: 'inferno', body: '#b9533c', accent: '#ffb13b' },
  { key: 'fallen_angel', name: 'Fallen Angel', element: 'radiant', body: '#e3e9f5', accent: '#ffe46a' },
  { key: 'forest_fairy', name: 'Forest Fairy', element: 'nature', body: '#62d995', accent: '#ff7be5' },
  { key: 'high_elf_champion', name: 'High Elf Champion', element: 'radiant', body: '#c9b0ff', accent: '#48f5dc' },
  { key: 'demon_knight', name: 'Demon Knight', element: 'blood', body: '#8b1735', accent: '#ff476c' },
  { key: 'skeleton_lich', name: 'Skeleton Lich', element: 'arcane', body: '#c5cad4', accent: '#4df4e9' },
  { key: 'stone_golem', name: 'Stone Golem', element: 'nature', body: '#777b89', accent: '#ffbd3b' },
  { key: 'cyber_samurai', name: 'Cyber Samurai', element: 'arcane', body: '#242b39', accent: '#32d8ff' },
  { key: 'void_assassin', name: 'Void Assassin', element: 'void', body: '#251940', accent: '#b66cff' },
  { key: 'neon_witch', name: 'Neon Witch', element: 'arcane', body: '#30203e', accent: '#ff5ee7' },
  { key: 'storm_titan', name: 'Storm Titan', element: 'void', body: '#33405c', accent: '#57caff' },
  { key: 'crystal_seraph', name: 'Crystal Seraph', element: 'radiant', body: '#dbefff', accent: '#56f5dc' },
  { key: 'toxic_alchemist', name: 'Toxic Alchemist', element: 'blood', body: '#183923', accent: '#53ff65' },
  { key: 'frost_revenant', name: 'Frost Revenant', element: 'frost', body: '#b8edff', accent: '#5d8cff' }
];

export const COSMOS_TYPES = [
  { key: 'stellar_archon', name: 'Stellar Archon', element: 'radiant', body: '#f0f5ff', accent: '#72eaff' },
  { key: 'nebula_leviathan', name: 'Nebula Leviathan', element: 'void', body: '#49256f', accent: '#ff72dc' },
  { key: 'comet_rider', name: 'Comet Rider', element: 'inferno', body: '#6f3047', accent: '#ffb24b' },
  { key: 'orbit_magus', name: 'Orbit Magus', element: 'arcane', body: '#243d74', accent: '#68f6ff' },
  { key: 'solar_phoenix', name: 'Solar Phoenix', element: 'inferno', body: '#d84836', accent: '#fff06b' },
  { key: 'lunar_colossus', name: 'Lunar Colossus', element: 'frost', body: '#8295c5', accent: '#e1f5ff' },
  { key: 'quantum_harrier', name: 'Quantum Harrier', element: 'arcane', body: '#183d51', accent: '#45ffd2' },
  { key: 'gravity_warden', name: 'Gravity Warden', element: 'nature', body: '#304d58', accent: '#9cff79' },
  { key: 'plasma_nomad', name: 'Plasma Nomad', element: 'blood', body: '#6b1d53', accent: '#ff5fbd' },
  { key: 'astral_hydra', name: 'Astral Hydra', element: 'void', body: '#3b2a78', accent: '#a884ff' },
  { key: 'dark_matter_sage', name: 'Dark Matter Sage', element: 'void', body: '#171526', accent: '#8d69ff' },
  { key: 'constellation_fae', name: 'Constellation Fae', element: 'nature', body: '#396c62', accent: '#b8ffdd' },
  { key: 'meteor_knight', name: 'Meteor Knight', element: 'blood', body: '#632b35', accent: '#ff795f' },
  { key: 'cosmic_dragon', name: 'Cosmic Dragon', element: 'radiant', body: '#6154a4', accent: '#f7d8ff' },
  { key: 'time_weaver', name: 'Time Weaver', element: 'frost', body: '#345f83', accent: '#8ffff4' },
  { key: 'galaxy_core', name: 'Galaxy Core', element: 'arcane', body: '#272659', accent: '#ff77e8' }
];

export const BOSS_TYPES = [...GENESIS_TYPES, ...COSMOS_TYPES];

export const COLLECTIONS = {
  GENESIS: { key: 'GENESIS', name: 'Genesis', universe: 1, color: '#35e1ff', types: GENESIS_TYPES },
  COSMOS: { key: 'COSMOS', name: 'Cosmos', universe: 2, color: '#ff63d8', types: COSMOS_TYPES }
};

export const GENERATOR_OFFERS = [
  { pixels: 50, label: 'Glitch Spark', note: 'Common-focused • Lv 1–4', boost: 0, level: [1, 4] },
  { pixels: 150, label: 'Neon Cache', note: 'Better uncommon odds • Lv 3–8', boost: 1, level: [3, 8] },
  { pixels: 500, label: 'Boss Signal', note: 'Rare+ favored • Lv 7–16', boost: 2, level: [7, 16] },
  { pixels: 1500, label: 'Genesis Rift', note: 'Epic/Mythic chance • Lv 14–30', boost: 3, level: [14, 30] }
];

export const COSMOS_GENERATOR_OFFERS = [
  { pixels: 300, label: 'Stardust Pulse', note: 'Cosmos Common+ • Lv 12–20', boost: 1, level: [12, 20] },
  { pixels: 750, label: 'Orbital Cache', note: 'Cosmos Rare odds • Lv 18–30', boost: 2, level: [18, 30] },
  { pixels: 1800, label: 'Nebula Breach', note: 'Epic favored • Lv 26–42', boost: 3, level: [26, 42] },
  { pixels: 4200, label: 'Cosmic Singularity', note: 'Legendary/Mythic chance • Lv 38–60', boost: 4, level: [38, 60] }
];

export const GENESIS_ZONES = [
  { element: 'nature', name: 'Rootlight Wilds', subtitle: 'The forest remembers every duel.', color: '#42ef7e' },
  { element: 'arcane', name: 'Cipher Spires', subtitle: 'Spells compile beneath neon moons.', color: '#39d8ff' },
  { element: 'inferno', name: 'Ashveil Furnace', subtitle: 'Only sharpened decks cross the flame.', color: '#ff644d' },
  { element: 'frost', name: 'Permafrost Archive', subtitle: 'Ancient cards sleep beneath the ice.', color: '#8cecff' },
  { element: 'void', name: 'Edgenet Abyss', subtitle: 'The gaps between blocks stare back.', color: '#a26cff' },
  { element: 'radiant', name: 'Auric Consensus', subtitle: 'Light judges every unverified soul.', color: '#ffe25c' },
  { element: 'blood', name: 'Crimson Ledger', subtitle: 'Every victory has a price.', color: '#ff3f7f' }
];

export const COSMOS_ZONES = [
  { element: 'radiant', name: 'Starwake Threshold', subtitle: 'A second chain ignites beyond the Genesis rim.', story: 'The first shard opens a passage into an ocean of newborn stars. Genesis scouts vanish inside the light.', color: '#f6e66b' },
  { element: 'arcane', name: 'Orbiting Cipher', subtitle: 'Living equations circle a silent blue sun.', story: 'The Orbit Magi reveal that the Unraveling was heard far beyond the first universe—and something answered.', color: '#55dcff' },
  { element: 'void', name: 'Nebula Maw', subtitle: 'Leviathans feed on abandoned timelines.', story: 'Void assassins join Cosmos wardens to cross a storm where discarded histories have grown teeth.', color: '#a673ff' },
  { element: 'inferno', name: 'Helios Foundry', subtitle: 'Solar fire reforges cards and constellations.', story: 'A solar phoenix carries a warning: the Genesis Chain was only the lock. The Cosmos Chain was the door.', color: '#ff7651' },
  { element: 'frost', name: 'Lunar Reliquary', subtitle: 'Frozen moons preserve memories of the first world.', story: 'Inside the lunar ice, the bosses find records describing both universes as halves of one broken engine.', color: '#9eeeff' },
  { element: 'nature', name: 'Worldseed Expanse', subtitle: 'Planets germinate from radiant code.', story: 'Rootlight and constellation fae awaken the Worldseed, restoring pathways erased during the Unraveling.', color: '#73f296' },
  { element: 'blood', name: 'Redshift Crown', subtitle: 'Every orbit bends toward the final ledger.', story: 'At the edge of observable code, the Crimson Ledger meets its author—and learns the debt belongs to reality itself.', color: '#ff528d' }
];

export const CAMPAIGN_ZONES = GENESIS_ZONES;

export const PREFIXES = ['Neon', 'Iron', 'Wild', 'Astral', 'Cipher', 'Storm', 'Shard', 'Night', 'Crown', 'Prime', 'Rift', 'Ghost'];
export const TITLES = ['Breaker', 'Warden', 'Oracle', 'Sovereign', 'Runner', 'Reaver', 'Sentinel', 'Keeper', 'Champion', 'Herald'];
export const COSMOS_PREFIXES = ['Nova', 'Quasar', 'Zenith', 'Aether', 'Solar', 'Lunar', 'Orbit', 'Pulsar', 'Eclipse', 'Quantum', 'Helix', 'Celestial', 'Eventide', 'Redshift'];
export const COSMOS_TITLES = ['Starbinder', 'Worldeater', 'Navigator', 'Paradox', 'Ascendant', 'Voyager', 'Singularity', 'Chronarch', 'Lightkeeper', 'Voidcaller', 'Cosmancer', 'Horizon'];

export const LORE_ITEMS = [
  { id: 'genesis-root-memory', universe: 1, rarity: 'uncommon', name: 'Root Memory', icon: '❖', text: 'A living block remembers the forest that existed before the Chain learned its own name.' },
  { id: 'genesis-null-key', universe: 1, rarity: 'rare', name: 'Null Consortium Key', icon: '⌬', text: 'It opens no physical door. When held near corrupted data, the corruption briefly becomes honest.' },
  { id: 'genesis-auric-feather', universe: 1, rarity: 'epic', name: 'Auric Feather', icon: '✧', text: 'A feather from the Consensus choir, carrying one note that survived the Unraveling.' },
  { id: 'genesis-ledger-fragment', universe: 1, rarity: 'rare', name: 'Crimson Ledger Fragment', icon: '♦', text: 'The debt written here has no debtor—only a date that has not happened yet.' },
  { id: 'genesis-first-block', universe: 1, rarity: 'mythic', name: 'Echo of the First Block', icon: '▣', text: 'A verified echo of the instant the Genesis Chain compiled reality for the first time.' },
  { id: 'genesis-frost-record', universe: 1, rarity: 'uncommon', name: 'Permafrost Record', icon: '❉', text: 'Frozen testimony claims the Chain did not shatter. It divided itself to hide.' },
  { id: 'genesis-ash-oath', universe: 1, rarity: 'common', name: 'Ashveil Oath', icon: '◆', text: 'A soldier promised to keep fighting until the last ember forgot how to burn.' },
  { id: 'genesis-edgenet-map', universe: 1, rarity: 'epic', name: 'Edgenet Starless Map', icon: '◈', text: 'The map marks a border beyond Genesis. The oldest ink calls it Cosmos.' },
  { id: 'cosmos-starwake-shard', universe: 2, rarity: 'uncommon', name: 'Starwake Shard', icon: '✦', text: 'It pulses in rhythm with a universe still deciding which laws of physics to keep.' },
  { id: 'cosmos-orbit-equation', universe: 2, rarity: 'rare', name: 'Orbit Equation', icon: '◎', text: 'A spell written as a planetary path. Completing it would move a moon—or a memory.' },
  { id: 'cosmos-leviathan-scale', universe: 2, rarity: 'epic', name: 'Leviathan Scale', icon: '◉', text: 'Its surface reflects worlds that could have existed if one duel had ended differently.' },
  { id: 'cosmos-helios-ember', universe: 2, rarity: 'rare', name: 'Helios Ember', icon: '☀', text: 'Solar fire that burns counterfeit histories while leaving true names untouched.' },
  { id: 'cosmos-lunar-memory', universe: 2, rarity: 'uncommon', name: 'Lunar Memory Prism', icon: '◇', text: 'Moonlight reveals a recording of the Genesis architects building a second escape route.' },
  { id: 'cosmos-worldseed', universe: 2, rarity: 'legendary', name: 'Sleeping Worldseed', icon: '❈', text: 'A complete planet waits inside, compressed into a seed smaller than a card pixel.' },
  { id: 'cosmos-redshift-crown', universe: 2, rarity: 'legendary', name: 'Redshift Crown Tooth', icon: '♢', text: 'One broken point from the crown at the end of observable code.' },
  { id: 'cosmos-second-chain', universe: 2, rarity: 'mythic', name: 'Cosmos Chain Link', icon: '∞', text: 'Proof that Genesis was never alone. The two chains are reaching for one another.' }
];

export const CASH_PACKAGES = [
  { id: 'spark', name: 'Spark Pack', pixels: 500, price: '$0.99', accent: '#35e1ff' },
  { id: 'boss', name: 'Boss Pack', pixels: 2800, price: '$4.99', accent: '#7f78ff' },
  { id: 'rift', name: 'Rift Pack', pixels: 6500, price: '$9.99', accent: '#ff55b8' },
  { id: 'cosmos', name: 'Cosmos Vault', pixels: 15000, price: '$19.99', accent: '#ffd45b' }
];

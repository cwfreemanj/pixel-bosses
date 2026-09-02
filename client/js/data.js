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

export const BOSS_TYPES = [
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

export const GENERATOR_OFFERS = [
  { pixels: 50, label: 'Glitch Spark', note: 'Common-focused • Lv 1–4', boost: 0, level: [1, 4] },
  { pixels: 150, label: 'Neon Cache', note: 'Better uncommon odds • Lv 3–8', boost: 1, level: [3, 8] },
  { pixels: 500, label: 'Boss Signal', note: 'Rare+ favored • Lv 7–16', boost: 2, level: [7, 16] },
  { pixels: 1500, label: 'Genesis Rift', note: 'Epic/Mythic chance • Lv 14–30', boost: 3, level: [14, 30] }
];

export const CAMPAIGN_ZONES = [
  { element: 'nature', name: 'Rootlight Wilds', subtitle: 'The forest remembers every duel.', color: '#42ef7e' },
  { element: 'arcane', name: 'Cipher Spires', subtitle: 'Spells compile beneath neon moons.', color: '#39d8ff' },
  { element: 'inferno', name: 'Ashveil Furnace', subtitle: 'Only sharpened decks cross the flame.', color: '#ff644d' },
  { element: 'frost', name: 'Permafrost Archive', subtitle: 'Ancient cards sleep beneath the ice.', color: '#8cecff' },
  { element: 'void', name: 'Edgenet Abyss', subtitle: 'The gaps between blocks stare back.', color: '#a26cff' },
  { element: 'radiant', name: 'Auric Consensus', subtitle: 'Light judges every unverified soul.', color: '#ffe25c' },
  { element: 'blood', name: 'Crimson Ledger', subtitle: 'Every victory has a price.', color: '#ff3f7f' }
];

export const PREFIXES = ['Neon', 'Iron', 'Wild', 'Astral', 'Cipher', 'Storm', 'Shard', 'Night', 'Crown', 'Prime', 'Rift', 'Ghost'];
export const TITLES = ['Breaker', 'Warden', 'Oracle', 'Sovereign', 'Runner', 'Reaver', 'Sentinel', 'Keeper', 'Champion', 'Herald'];

import { BOSS_TYPES, ELEMENTS, PREFIXES, RARITIES, TITLES } from './data.js';

export function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < String(value).length; i++) {
    h ^= String(value).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function rngFrom(seed) {
  let state = parseInt(hashString(seed), 16) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const int = (min, max, rng) => Math.floor(rng() * (max - min + 1)) + min;

export function pickRarity(rng, boost = 0, forcedMaxIndex = null) {
  const adjusted = RARITIES.map((r, index) => ({ ...r, w: r.weight * Math.pow(1.65, boost * index / 2) }));
  const allowed = forcedMaxIndex == null ? adjusted : adjusted.slice(0, forcedMaxIndex + 1);
  let roll = rng() * allowed.reduce((sum, r) => sum + r.w, 0);
  for (const rarity of allowed) {
    roll -= rarity.w;
    if (roll <= 0) return rarity;
  }
  return allowed[0];
}

export function makeCard(options = {}) {
  const seed = options.seed || `${Date.now()}-${Math.random()}`;
  const rng = rngFrom(seed);
  let typePool = BOSS_TYPES;
  if (options.element && rng() < (options.primaryChance ?? 1)) {
    typePool = BOSS_TYPES.filter((type) => type.element === options.element);
  }
  const type = pick(typePool.length ? typePool : BOSS_TYPES, rng);
  const element = options.element && options.forceElement ? options.element : type.element;
  const rarity = options.rarityKey ? RARITIES.find((r) => r.key === options.rarityKey) : pickRarity(rng, options.rarityBoost || 0, options.maxRarityIndex);
  const range = options.levelRange || [1, 10];
  const level = options.level || int(range[0], range[1], rng);
  const mult = rarity.mult * (1 + level * 0.055);
  const base = () => Math.round(int(18, 62, rng) * mult);
  const stats = {
    level,
    hp: base() + (['nature', 'frost'].includes(element) ? 12 : 0),
    atk: base() + (['inferno', 'blood'].includes(element) ? 12 : 0),
    def: base() + (['nature', 'radiant'].includes(element) ? 10 : 0),
    mag: base() + (['arcane', 'void'].includes(element) ? 14 : 0),
    spd: base() + (['void', 'frost'].includes(element) ? 9 : 0),
    affix: pick(['Rugged', 'Spry', 'Blessed', 'Arc-Forged', 'Void-Touched', 'Starwrought', 'Worldbreaker'], rng)
  };
  const name = `${pick(PREFIXES, rng)} ${type.name.split(' ')[0]} ${pick(TITLES, rng)}`;
  const variantKey = rng() < 0.08 ? 'neon_variant' : 'base';
  const cardHash = `PB-${hashString(JSON.stringify({ seed, type: type.key, rarity: rarity.key, level, stats }))}-${hashString(seed + name)}`;
  return {
    schemaVersion: 2,
    set: 'GENESIS',
    id: cardHash,
    cardHash,
    seed,
    name,
    type: type.key,
    typeName: type.name,
    element,
    rarityKey: rarity.key,
    rarityPower: RARITIES.findIndex((r) => r.key === rarity.key) + 1,
    level,
    variantKey,
    colors: { body: type.body, accent: type.accent, glow: ELEMENTS.find((e) => e.key === element)?.color || '#fff' },
    stats,
    powerScore: computePowerScore(stats),
    backstory: `${name}, a ${stats.affix.toLowerCase()} ${type.name.toLowerCase()}, emerged after the Genesis Chain shattered. Their ${element} signature still pulses through every verified block.`,
    createdAt: Date.now(),
    mintStatus: 'UNMINTED'
  };
}

export function computePowerScore(stats = {}) {
  return Math.round((stats.hp || 0) * .22 + (stats.atk || 0) * .25 + (stats.def || 0) * .2 + (stats.mag || 0) * .2 + (stats.spd || 0) * .13);
}

export function elementOutcome(a, b) {
  if (!a || !b || a === b) return 'TIE';
  if (ELEMENTS.find((e) => e.key === a)?.beats.includes(b)) return 'A';
  if (ELEMENTS.find((e) => e.key === b)?.beats.includes(a)) return 'B';
  return 'TIE';
}

export function resolveDuel(cardA, cardB, seed = `${cardA.cardHash}:${cardB.cardHash}`) {
  const reasons = [];
  let aWins = 0;
  let bWins = 0;
  const element = elementOutcome(cardA.element, cardB.element);
  if (element !== 'TIE') return { winner: element, aWins: element === 'A' ? 2 : 0, bWins: element === 'B' ? 2 : 0, reasons: [`CANCEL_WILD:element:${element}`] };
  reasons.push('element:TIE');
  if (cardA.rarityPower > cardB.rarityPower) { aWins++; reasons.push('rarity:A'); }
  else if (cardB.rarityPower > cardA.rarityPower) { bWins++; reasons.push('rarity:B'); }
  else reasons.push('rarity:TIE');
  if (cardA.level > cardB.level) { aWins++; reasons.push('level:A'); }
  else if (cardB.level > cardA.level) { bWins++; reasons.push('level:B'); }
  else reasons.push('level:TIE');
  if (aWins >= 2 || bWins >= 2) return { winner: aWins >= 2 ? 'A' : 'B', aWins, bWins, reasons };
  const aScore = cardA.rarityPower * 100 + cardA.level;
  const bScore = cardB.rarityPower * 100 + cardB.level;
  if (aScore !== bScore) return { winner: aScore > bScore ? 'A' : 'B', aWins, bWins, reasons: [...reasons, `tiebreak:${aScore > bScore ? 'A' : 'B'}`] };
  const aPower = cardA.powerScore ?? computePowerScore(cardA.stats);
  const bPower = cardB.powerScore ?? computePowerScore(cardB.stats);
  if (aPower !== bPower) return { winner: aPower > bPower ? 'A' : 'B', aWins, bWins, reasons: [...reasons, `power:${aPower > bPower ? 'A' : 'B'}`] };
  return { winner: rngFrom(seed)() < .5 ? 'A' : 'B', aWins, bWins, reasons: [...reasons, 'coinflip'] };
}

export function seededShuffle(cards, seed) {
  const rng = rngFrom(seed);
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function simulateMatch(deckA, deckB, seed = String(Date.now())) {
  const a = seededShuffle(deckA, seed + ':a');
  const b = seededShuffle(deckB, seed + ':b');
  const rounds = [];
  let aWins = 0;
  let bWins = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const duel = resolveDuel(a[i], b[i], `${seed}:${i}`);
    duel.winner === 'A' ? aWins++ : bWins++;
    rounds.push({ cardA: a[i], cardB: b[i], duel, score: [aWins, bWins] });
  }
  return { rounds, score: [aWins, bWins], winner: aWins === bWins ? 'DRAW' : aWins > bWins ? 'A' : 'B' };
}

export function validateDeck(cards) {
  const ids = cards.map((c) => c.cardHash || c.id);
  return { valid: cards.length >= 5 && cards.length <= 20 && new Set(ids).size === ids.length, duplicate: new Set(ids).size !== ids.length };
}

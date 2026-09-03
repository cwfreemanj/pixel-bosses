import { COSMOS_ZONES, ELEMENTS, GENESIS_TYPES, GENESIS_ZONES, LORE_ITEMS, RARITIES } from './data.js';
import { makeCard, rngFrom } from './engine.js';

export const UNIVERSES = [
  { id: 1, set: 'GENESIS', name: 'Universe 1: Genesis', stages: [1, 70], tagline: 'The Chain shatters, and its first bosses awaken.' },
  { id: 2, set: 'COSMOS', name: 'Universe 2: Cosmos', stages: [71, 140], tagline: 'A second Chain answers from beyond the Starwake Threshold.' }
];

export function getStage(stageNumber) {
  const stage = Math.max(1, Number(stageNumber) || 1);
  const universe = stage <= 70 ? 1 : 2;
  const normalized = universe === 1 ? stage : ((stage - 71) % 70) + 1;
  const ascension = stage <= 140 ? 0 : Math.floor((stage - 71) / 70);
  const zoneIndex = Math.floor((normalized - 1) / 10) % 7;
  const within = (normalized - 1) % 10 + 1;
  const zone = (universe === 1 ? GENESIS_ZONES : COSMOS_ZONES)[zoneIndex];
  const recommendedLevel = universe === 1 ? Math.max(1, Math.round(stage * .94)) : Math.round(72 + normalized * 1.18 + ascension * 16);
  return {
    stage, within, ascension, universe, zoneIndex, zone,
    set: universe === 1 ? 'GENESIS' : 'COSMOS',
    name: `${zone.name} ${within}`,
    reward: universe === 1 ? 90 + stage * 12 : 900 + normalized * 24 + ascension * 300,
    deckSize: Math.min(20, universe === 1 ? 8 + Math.floor(stage / 5) : 14 + Math.floor(normalized / 12)),
    recommendedLevel,
    story: zone.story || zone.subtitle
  };
}

export function makeCampaignDeck(stageNumber) {
  const info = getStage(stageNumber);
  const maxRarityIndex = Math.min(RARITIES.length - 1, info.universe === 1 ? Math.floor((info.stage - 1) / 8) : 3 + Math.floor(((info.zoneIndex * 10) + info.within) / 24));
  const deck = [];
  const stageRng = rngFrom(`campaign-types:${info.stage}`);
  const genesisTypeCount = 2 + Math.floor(stageRng() * 3);
  const genesisTypes = [...GENESIS_TYPES]
    .sort((a, b) => rngFrom(`${info.stage}:${a.key}`)() - rngFrom(`${info.stage}:${b.key}`)())
    .slice(0, genesisTypeCount)
    .map((type) => type.key);
  for (let i = 0; i < info.deckSize; i++) {
    const primary = i / info.deckSize < (info.universe === 1 ? .72 : .58);
    const useGenesisGuest = info.universe === 2 && i / info.deckSize >= .70;
    const fallback = ELEMENTS[(info.zoneIndex + i + 2) % ELEMENTS.length].key;
    const guestStart = Math.ceil(info.deckSize * .70);
    const guestType = useGenesisGuest ? genesisTypes[(i - guestStart) % genesisTypes.length] : null;
    deck.push(makeCard({
      seed: `campaign:${info.stage}:${i}`,
      collection: useGenesisGuest ? 'GENESIS' : info.set,
      typeKeys: useGenesisGuest ? [guestType] : undefined,
      element: primary && !useGenesisGuest ? info.zone.element : fallback,
      forceElement: !useGenesisGuest,
      maxRarityIndex,
      rarityBoost: info.universe === 1 ? Math.min(3, Math.floor(info.stage / 20)) : 2 + Math.min(3, Math.floor((info.stage - 71) / 20)),
      levelRange: [Math.max(1, info.recommendedLevel - 4), info.recommendedLevel + 3]
    }));
  }
  return deck;
}

export function stagePage(unlockedStage, page = 0, completed = []) {
  const start = page * 10 + 1;
  return Array.from({ length: 10 }, (_, i) => {
    const info = getStage(start + i);
    return { ...info, unlocked: info.stage <= unlockedStage, complete: completed.includes(info.stage) };
  });
}

export function rollLoreReward(stageNumber, ownedIds = [], random = Math.random) {
  const info = getStage(stageNumber);
  if (random() >= (info.universe === 2 ? .24 : .13)) return null;
  const available = LORE_ITEMS.filter((item) => item.universe === info.universe && !ownedIds.includes(item.id));
  return available.length ? available[Math.floor(random() * available.length)] : null;
}

import { CAMPAIGN_ZONES, ELEMENTS, RARITIES } from './data.js';
import { makeCard } from './engine.js';

export function getStage(stageNumber) {
  const stage = Math.max(1, Number(stageNumber) || 1);
  const zoneIndex = Math.floor((stage - 1) / 10) % CAMPAIGN_ZONES.length;
  const cycle = Math.floor((stage - 1) / (CAMPAIGN_ZONES.length * 10));
  const within = (stage - 1) % 10 + 1;
  const zone = CAMPAIGN_ZONES[zoneIndex];
  return {
    stage,
    within,
    cycle,
    zoneIndex,
    zone,
    name: `${zone.name} ${within}`,
    reward: 90 + stage * 12,
    deckSize: Math.min(20, 8 + Math.floor(stage / 5)),
    recommendedLevel: stage + cycle * 4
  };
}

export function makeCampaignDeck(stageNumber) {
  const info = getStage(stageNumber);
  const maxRarityIndex = Math.min(RARITIES.length - 1, Math.floor((info.stage - 1) / 8));
  const deck = [];
  for (let i = 0; i < info.deckSize; i++) {
    // 72% primary gives an identity without making Cancel Wild an instant full-deck sweep.
    const primary = (i / info.deckSize) < .72;
    const fallback = ELEMENTS[(info.zoneIndex + i + 2) % ELEMENTS.length].key;
    deck.push(makeCard({
      seed: `campaign:${info.stage}:${i}`,
      element: primary ? info.zone.element : fallback,
      forceElement: true,
      maxRarityIndex,
      rarityBoost: Math.min(3, Math.floor(info.stage / 20)),
      levelRange: [Math.max(1, info.recommendedLevel - 3), info.recommendedLevel + 2]
    }));
  }
  return deck;
}

export function stagePage(unlockedStage, page = 0) {
  const start = page * 10 + 1;
  return Array.from({ length: 10 }, (_, i) => {
    const info = getStage(start + i);
    return { ...info, unlocked: info.stage <= unlockedStage, complete: info.stage < unlockedStage };
  });
}

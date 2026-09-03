import test from 'node:test';
import assert from 'node:assert/strict';
import { elementOutcome, makeCard, resolveDuel, simulateMatch, validateDeck } from '../client/js/engine.js';
import { getStage, makeCampaignDeck, rollLoreReward, stagePage } from '../client/js/campaign.js';

test('cards are deterministic and uniquely hashed by seed', () => {
  const a = makeCard({ seed: 'test-card', levelRange: [4, 4] });
  const b = makeCard({ seed: 'test-card', levelRange: [4, 4] });
  assert.deepEqual(a, b);
  assert.equal(a.level, 4);
  assert.match(a.cardHash, /^PB-/);
});

test('original Cancel Wild element chart is preserved', () => {
  assert.equal(elementOutcome('nature', 'void'), 'A');
  assert.equal(elementOutcome('void', 'arcane'), 'A');
  assert.equal(elementOutcome('radiant', 'blood'), 'A');
  assert.equal(elementOutcome('nature', 'arcane'), 'TIE');
});

test('Cancel Wild resolves before rarity and stats', () => {
  const nature = makeCard({ seed: 'weak', element: 'nature', forceElement: true, rarityKey: 'common', level: 1 });
  const frost = makeCard({ seed: 'strong', element: 'frost', forceElement: true, rarityKey: 'mythic', level: 99 });
  const duel = resolveDuel(nature, frost);
  assert.equal(duel.winner, 'A');
  assert.match(duel.reasons[0], /CANCEL_WILD/);
});

test('deck validation rejects duplicates and invalid sizes', () => {
  const card = makeCard({ seed: 'one' });
  assert.equal(validateDeck([card, card, card, card, card]).valid, false);
  assert.equal(validateDeck(Array.from({ length: 5 }, (_, i) => makeCard({ seed: `ok-${i}` }))).valid, true);
  assert.equal(validateDeck(Array.from({ length: 21 }, (_, i) => makeCard({ seed: `big-${i}` }))).valid, false);
});

test('Genesis campaign changes element every ten stages and mixes counters', () => {
  assert.equal(getStage(1).zone.element, 'nature');
  assert.equal(getStage(11).zone.element, 'arcane');
  const deck = makeCampaignDeck(1);
  const natureCount = deck.filter((c) => c.element === 'nature').length;
  assert.ok(natureCount > deck.length / 2);
  assert.ok(natureCount < deck.length);
});

test('Cosmos adds stages 71–140 at higher difficulty with mixed collections', () => {
  const firstCosmos = getStage(71);
  const lastCosmos = getStage(140);
  assert.equal(firstCosmos.universe, 2);
  assert.equal(firstCosmos.zone.element, 'radiant');
  assert.ok(firstCosmos.recommendedLevel > getStage(70).recommendedLevel);
  assert.ok(lastCosmos.recommendedLevel > firstCosmos.recommendedLevel);
  const deck = makeCampaignDeck(71);
  assert.ok(deck.some((card) => card.set === 'COSMOS'));
  assert.ok(deck.some((card) => card.set === 'GENESIS'));
  assert.ok(new Set(deck.filter((card) => card.set === 'GENESIS').map((card) => card.type)).size >= 2);
});

test('campaign pages use the completed-stage set and lore cannot duplicate', () => {
  const stages = stagePage(72, 7, [71]);
  assert.equal(stages[0].stage, 71);
  assert.equal(stages[0].complete, true);
  assert.equal(stages[1].complete, false);
  const first = rollLoreReward(71, [], () => 0);
  assert.ok(first);
  assert.notEqual(rollLoreReward(71, [first.id], () => 0)?.id, first.id);
});

test('match simulation is deterministic for a fixed seed', () => {
  const a = Array.from({ length: 8 }, (_, i) => makeCard({ seed: `a-${i}` }));
  const b = Array.from({ length: 8 }, (_, i) => makeCard({ seed: `b-${i}` }));
  assert.deepEqual(simulateMatch(a, b, 'fixed'), simulateMatch(a, b, 'fixed'));
});

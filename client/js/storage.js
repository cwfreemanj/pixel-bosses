import { makeCard } from './engine.js';

const KEY = 'PIXEL_BOSSES_MOBILE_V2';

function starterState() {
  const binder = Array.from({ length: 20 }, (_, i) => makeCard({ seed: `starter:${i}`, levelRange: [1, 6], rarityBoost: i > 15 ? 1 : 0 }));
  return {
    schemaVersion: 2,
    playerId: crypto.randomUUID(),
    playerToken: [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join(''),
    playerName: 'Pixel Pilot',
    pixels: 1200,
    binder,
    decks: [{ id: crypto.randomUUID(), name: 'Genesis Crew', cardIds: binder.slice(0, 12).map((c) => c.cardHash), createdAt: Date.now() }],
    selectedDeckId: null,
    campaignUnlocked: 1,
    campaignWins: [],
    stats: { wins: 0, losses: 0, draws: 0, aiWins: 0, pvpWins: 0, campaignWins: 0, cardsGenerated: 0, pixelsEarned: 0, pixelsSpent: 0 },
    settings: { serverUrl: '', effects: true, vibration: true, autoSync: true },
    updatedAt: Date.now()
  };
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.schemaVersion === 2) {
      if (!saved.selectedDeckId) saved.selectedDeckId = saved.decks?.[0]?.id || null;
      return saved;
    }
  } catch {}
  const state = starterState();
  state.selectedDeckId = state.decks[0].id;
  saveState(state);
  return state;
}

export function saveState(state) {
  state.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function exportSave(state) {
  return { kind: 'pixel-bosses-save', schemaVersion: 2, exportedAt: new Date().toISOString(), state };
}

export function importSave(payload) {
  if (payload?.kind !== 'pixel-bosses-save' || payload?.state?.schemaVersion !== 2) throw new Error('This is not a Pixel Bosses v2 save file.');
  saveState(payload.state);
  return payload.state;
}

export function exportBinder(state) {
  return { kind: 'pixel-bosses-binder', schemaVersion: 2, exportedAt: new Date().toISOString(), cards: state.binder };
}

export function importBinder(payload, state) {
  if (payload?.kind === 'pixel-bosses-card' && payload.card) payload = { kind: 'pixel-bosses-binder', cards: [payload.card] };
  if (payload?.kind !== 'pixel-bosses-binder' || !Array.isArray(payload.cards)) throw new Error('Invalid binder or card JSON.');
  const existing = new Set(state.binder.map((c) => c.cardHash));
  let added = 0;
  for (const card of payload.cards) if (card.cardHash && !existing.has(card.cardHash)) { state.binder.push(card); existing.add(card.cardHash); added++; }
  saveState(state);
  return added;
}

export function exportDeck(deck, state) {
  const byId = new Map(state.binder.map((c) => [c.cardHash, c]));
  return { kind: 'pixel-bosses-deck', schemaVersion: 2, deckName: deck.name, cards: deck.cardIds.map((id) => byId.get(id)).filter(Boolean) };
}

export function importDeck(payload, state) {
  if (payload?.kind !== 'pixel-bosses-deck' || !Array.isArray(payload.cards)) throw new Error('Invalid deck JSON.');
  const unique = [...new Map(payload.cards.map((c) => [c.cardHash, c])).values()].slice(0, 20);
  if (unique.length < 5) throw new Error('A deck needs at least five unique cards.');
  const existing = new Set(state.binder.map((c) => c.cardHash));
  unique.forEach((card) => { if (!existing.has(card.cardHash)) state.binder.push(card); });
  const deck = { id: crypto.randomUUID(), name: String(payload.deckName || 'Imported Deck').slice(0, 30), cardIds: unique.map((c) => c.cardHash), createdAt: Date.now() };
  state.decks.push(deck);
  state.selectedDeckId = deck.id;
  saveState(state);
  return deck;
}

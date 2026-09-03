import { makeCard } from './engine.js';

const KEY = 'PIXEL_BOSSES_MOBILE_V3';
const LEGACY_KEY = 'PIXEL_BOSSES_MOBILE_V2';

const STAT_DEFAULTS = {
  wins: 0, losses: 0, draws: 0, aiWins: 0, aiLosses: 0, pvpWins: 0, pvpLosses: 0,
  campaignWins: 0, campaignLosses: 0, cardsGenerated: 0, pixelsEarned: 0, pixelsSpent: 0,
  pixelsPurchased: 0, scoreEarned: 0, highestScore: 0, tradesCompleted: 0, marketSales: 0,
  cardsMinted: 0, loreFound: 0, winStreak: 0, bestWinStreak: 0, matchesPlayed: 0
};

function starterState() {
  const binder = Array.from({ length: 20 }, (_, i) => makeCard({ seed: `starter:${i}`, levelRange: [1, 6], rarityBoost: i > 15 ? 1 : 0 }));
  return {
    schemaVersion: 3,
    playerId: crypto.randomUUID(),
    playerToken: [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join(''),
    playerName: 'Pixel Pilot',
    profile: { icon: '☠', tag: `PILOT-${Math.floor(Math.random() * 9000 + 1000)}`, bio: '', gfpConnected: false, gfpMemberId: null, walletAddress: null },
    pixels: 1200,
    binder,
    decks: [{ id: crypto.randomUUID(), name: 'Genesis Crew', cardIds: binder.slice(0, 12).map((c) => c.cardHash), createdAt: Date.now() }],
    selectedDeckId: null,
    campaignUnlocked: 1,
    campaignWins: [],
    items: [],
    stats: { ...STAT_DEFAULTS },
    social: { friends: [], friendRequests: [], communities: ['genesis'], activeCommunity: 'genesis' },
    settings: { effects: true, vibration: true, autoSync: true },
    updatedAt: Date.now()
  };
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY));
    if (saved?.schemaVersion === 2 || saved?.schemaVersion === 3) return normalizeState(saved);
  } catch {}
  const state = starterState();
  state.selectedDeckId = state.decks[0].id;
  saveState(state);
  return state;
}

export function saveState(state) {
  state.schemaVersion = 3;
  state.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function normalizeState(input) {
  const state = input;
  state.schemaVersion = 3;
  state.binder = Array.isArray(state.binder) ? state.binder : [];
  state.binder.forEach((card) => {
    card.schemaVersion = card.schemaVersion || 2;
    card.set = card.set || 'GENESIS';
    card.universe = card.universe || (card.set === 'COSMOS' ? 2 : 1);
    card.mintStatus = card.mintStatus || 'UNMINTED';
    card.tradeLocked = Boolean(card.tradeLocked);
  });
  state.decks = Array.isArray(state.decks) ? state.decks : [];
  if (!state.selectedDeckId) state.selectedDeckId = state.decks?.[0]?.id || null;
  state.campaignWins = Array.isArray(state.campaignWins) ? [...new Set(state.campaignWins.map(Number).filter(Number.isFinite))] : [];
  state.campaignUnlocked = Math.max(1, Number(state.campaignUnlocked) || 1);
  state.profile = { icon: '☠', tag: `PILOT-${String(state.playerId || '').slice(0, 4).toUpperCase() || '0000'}`, bio: '', gfpConnected: false, gfpMemberId: null, walletAddress: null, ...(state.profile || {}) };
  state.items = Array.isArray(state.items) ? [...new Map(state.items.map((item) => [item.id, item])).values()] : [];
  state.stats = { ...STAT_DEFAULTS, ...(state.stats || {}) };
  state.stats.campaignWins = Math.max(Number(state.stats.campaignWins) || 0, state.campaignWins.length);
  state.stats.loreFound = Math.max(Number(state.stats.loreFound) || 0, state.items.length);
  state.social = { friends: [], friendRequests: [], communities: ['genesis'], activeCommunity: 'genesis', ...(state.social || {}) };
  state.settings = { effects: true, vibration: true, autoSync: true, ...(state.settings || {}) };
  delete state.settings.serverUrl;
  return state;
}

export function exportSave(state) {
  return { kind: 'pixel-bosses-save', schemaVersion: 3, exportedAt: new Date().toISOString(), state };
}

export function importSave(payload) {
  if (payload?.kind !== 'pixel-bosses-save' || ![2, 3].includes(payload?.state?.schemaVersion)) throw new Error('This is not a compatible Pixel Bosses save file.');
  const state = normalizeState(payload.state);
  saveState(state);
  return state;
}

export function exportBinder(state) {
  return { kind: 'pixel-bosses-binder', schemaVersion: 3, exportedAt: new Date().toISOString(), cards: state.binder };
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
  return { kind: 'pixel-bosses-deck', schemaVersion: 3, deckName: deck.name, cards: deck.cardIds.map((id) => byId.get(id)).filter(Boolean) };
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

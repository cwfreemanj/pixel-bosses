import {
  BOSS_TYPES, CASH_PACKAGES, COLLECTIONS, COSMOS_GENERATOR_OFFERS,
  ELEMENTS, GENERATOR_OFFERS, RARITIES
} from './data.js';
import { makeCard, seededShuffle, simulateMatch, validateDeck } from './engine.js';
import { getStage, makeCampaignDeck, rollLoreReward, stagePage, UNIVERSES } from './campaign.js';
import {
  exportBinder, exportDeck, exportSave, importBinder, importDeck, importSave,
  loadState, normalizeState, saveState
} from './storage.js';
import { PixelNetwork } from './network.js';

let state = loadState();
let currentScreen = 'home';
let screenHistory = [];
let campaignPage = Math.floor((state.campaignUnlocked - 1) / 10);
let elementFilter = '';
let collectionFilter = '';
let itemUniverse = 0;
let advancedFilter = { rarity: '', minted: '', minPower: 0, minLevel: 0 };
let editingDeckId = null;
let battle = null;
let battleTimer = null;
let pickerAction = null;
let socialTab = 'market';
let statsTab = 'mine';
let marketListings = [];
let friendData = { friends: [], requests: [] };
let chatSocket = null;
let chatConnected = false;
let chatRoom = 'global';
let chatMessages = [];
const transientCards = new Map();
const network = new PixelNetwork(() => state);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]);
const rarity = (card) => RARITIES.find((r) => r.key === card.rarityKey) || RARITIES[0];
const element = (card) => ELEMENTS.find((e) => e.key === card.element) || ELEMENTS[0];
const selectedDeck = () => state.decks.find((d) => d.id === state.selectedDeckId) || state.decks[0];
const cardsForDeck = (deck) => deck?.cardIds.map((id) => state.binder.find((card) => card.cardHash === id && !card.tradeLocked)).filter(Boolean) || [];
const fmt = (value) => Math.max(0, Number(value) || 0).toLocaleString();
const nowLabel = (value) => new Date(value || Date.now()).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function vibrate(pattern = 18) { if (state.settings.vibration) navigator.vibrate?.(pattern); }
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
}
function commit(message, sync = true) {
  saveState(state);
  updateChrome();
  if (message) toast(message);
  clearTimeout(commit.syncTimer);
  if (sync && state.settings.autoSync) commit.syncTimer = setTimeout(() => syncCloud(true), 450);
}
function adoptState(next) {
  if (!next) return;
  state = normalizeState(next);
  saveState(state);
  updateChrome();
}
function updateChrome() {
  $('#pixelBalance').textContent = fmt(state.pixels);
  $('#campaignProgress').textContent = `Stage ${state.campaignUnlocked} unlocked`;
  $('#deckSummary').textContent = `${state.decks.length} saved deck${state.decks.length === 1 ? '' : 's'}`;
  $('#itemSummary').textContent = `${state.items.length} unique discover${state.items.length === 1 ? 'y' : 'ies'}`;
  $('#homeStats').innerHTML = `<div><b>${fmt(state.stats.wins)}</b><small>Wins</small></div><div><b>${fmt(state.binder.length)}</b><small>Cards</small></div><div><b>${fmt(state.campaignWins.length)}</b><small>Stages</small></div>`;
}

const labels = {
  home: 'GENESIS + COSMOS', campaign: 'CAMPAIGN MAP', quick: 'QUICK BATTLE', cards: 'CARD STUDIO',
  decks: 'DECK BUILDER', battle: 'LIVE DUEL', stats: 'PLAYER RECORDS', items: 'LORE VAULT',
  social: 'SOCIAL NETWORK', shop: 'PIXEL SHOP', rules: 'FIELD MANUAL', settings: 'SETTINGS'
};
function showScreen(name, push = true) {
  if (push && currentScreen !== name) screenHistory.push(currentScreen);
  currentScreen = name;
  $$('.screen').forEach((screen) => screen.classList.toggle('active', screen.dataset.screen === name));
  $$('.bottom-nav button').forEach((button) => button.classList.toggle('active', button.dataset.go === name));
  $('#screenLabel').textContent = labels[name] || 'PIXEL BOSSES';
  $('#backBtn').classList.toggle('hidden', name === 'home');
  if (name === 'campaign') renderCampaign();
  if (name === 'quick') renderDeckSelects();
  if (name === 'cards') renderBinder();
  if (name === 'decks') renderDecks();
  if (name === 'stats') renderStats();
  if (name === 'items') renderItems();
  if (name === 'social') renderSocial();
  if (name === 'shop') renderShop();
  if (name === 'rules') renderRules();
  if (name === 'settings') renderSettings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goBack() {
  if (currentScreen === 'battle' && battle && !battle.finished && !confirm('Leave this battle? Progress from it will be lost.')) return;
  stopBattle();
  showScreen(screenHistory.pop() || 'home', false);
}

function registerCards(cards) { cards.forEach((card) => transientCards.set(card.cardHash, card)); }
function cardMarkup(card) {
  transientCards.set(card.cardHash, card);
  const r = rarity(card), e = element(card), set = card.set || 'GENESIS';
  const variant = card.variantKey === 'prismatic_variant' ? 'PRISM' : card.variantKey === 'neon_variant' ? 'NEON' : '';
  return `<button class="boss-card" data-card-id="${card.cardHash}" style="--rarity:${r.color};--element:${e.color}" aria-label="${escapeHtml(card.name)}">
    <span class="collection-badge">${escapeHtml(set)}</span>${variant ? `<span class="variant-badge">${variant}</span>` : ''}${card.tradeLocked ? '<span class="lock-badge">LISTED</span>' : ''}
    <canvas width="160" height="128"></canvas>
    <span class="boss-card-copy"><small>${r.name} • ${e.name.toUpperCase()}</small><b>${escapeHtml(card.name)}</b><span class="boss-card-footer"><span>LV ${card.level}</span><span>⚡ ${card.powerScore}</span></span></span>
  </button>`;
}
function paintCard(canvas, card) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  let seed = parseInt(String(card.cardHash).replace(/\D/g, '').slice(0, 8), 10) || parseInt(String(card.cardHash).slice(3, 11), 16) || 7;
  const rng = () => ((seed = Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5) >>> 0) / 4294967296;
  const glow = card.colors?.glow || element(card).color;
  const body = card.colors?.body || '#65708a';
  const accent = card.colors?.accent || glow;
  const art = card.art || {};
  ctx.imageSmoothingEnabled = false;
  const bg = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 80);
  bg.addColorStop(0, `${glow}66`); bg.addColorStop(1, '#080a1800');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = `${glow}77`; ctx.lineWidth = 1;
  const rings = art.aura === 'rings' ? 3 : 1;
  for (let i = 0; i < rings; i++) { ctx.beginPath(); ctx.ellipse(80, 65, 29 + i * 13, 14 + i * 7, 0, 0, Math.PI * 2); ctx.stroke(); }
  const satellites = art.satellites ?? (card.set === 'COSMOS' ? 3 : 1);
  for (let i = 0; i < satellites; i++) { const a = rng() * Math.PI * 2; ctx.fillStyle = i % 2 ? accent : glow; ctx.fillRect(78 + Math.cos(a) * (45 + i * 3), 60 + Math.sin(a) * 30, 4, 4); }
  const px = 6, ox = 32, oy = 4;
  const grid = Array.from({ length: 19 }, () => Array(16).fill(0));
  const widthBias = art.width || 5;
  for (let y = 2; y < 18; y++) for (let x = 2; x < 8; x++) {
    const half = Math.max(1, Math.round(widthBias - Math.abs(y - 10) * .26));
    if (Math.abs(x - 6) <= half && rng() < (art.density || .82)) { grid[y][x] = rng() > .74 ? 2 : 1; grid[y][15 - x] = grid[y][x]; }
  }
  const crown = art.head === 'halo' ? [[5,1],[6,0],[7,0],[8,0],[9,0],[10,1]] : [[4,1],[11,1],[3,2],[12,2]];
  for (const [x, y] of crown) grid[y][x] = 3;
  if (art.eyes === 'single') grid[7][8] = 3; else { grid[7][5] = 3; grid[7][10] = 3; }
  grid[13][6] = grid[13][9] = 2;
  const colors = ['transparent', body, accent, glow];
  grid.forEach((row, y) => row.forEach((value, x) => {
    if (!value) return;
    ctx.fillStyle = colors[value]; ctx.shadowColor = value === 3 ? glow : 'transparent'; ctx.shadowBlur = value === 3 ? 8 : 0;
    ctx.fillRect(ox + x * px, oy + y * px, px, px);
  }));
  ctx.shadowBlur = 0; ctx.globalAlpha = .55; ctx.strokeStyle = rarity(card).color; ctx.strokeRect(5.5, 5.5, w - 11, h - 11); ctx.globalAlpha = 1;
}
function paintCards(root = document) {
  $$('canvas', root).forEach((canvas) => {
    const id = canvas.closest('.boss-card')?.dataset.cardId;
    const card = transientCards.get(id) || state.binder.find((entry) => entry.cardHash === id);
    if (card) paintCard(canvas, card);
  });
}

function renderCampaign() {
  campaignPage = Math.max(0, campaignPage);
  const pageCount = Math.max(14, campaignPage + 1, Math.floor((state.campaignUnlocked - 1) / 10) + 2);
  $('#campaignPage').innerHTML = Array.from({ length: pageCount }, (_, page) => {
    const universe = page < 7 ? 'Genesis' : page < 14 ? 'Cosmos' : `Cosmos Ascension ${Math.floor((page - 7) / 7) + 1}`;
    return `<option value="${page}" ${page === campaignPage ? 'selected' : ''}>${universe} • ${page * 10 + 1}–${page * 10 + 10}</option>`;
  }).join('');
  const activeUniverse = campaignPage < 7 ? 1 : 2;
  $$('#universeTabs [data-universe]').forEach((button) => button.classList.toggle('active', Number(button.dataset.universe) === activeUniverse));
  const universe = UNIVERSES.find((entry) => entry.id === activeUniverse);
  $('#universeIntro').innerHTML = `<b>${escapeHtml(universe.name)}</b><p>${escapeHtml(universe.tagline)} ${activeUniverse === 2 ? 'Cosmos battles begin at higher difficulty and blend Cosmos challengers with two to four Genesis lineages.' : 'Clear each stage to unlock the next signal.'}</p>`;
  const stages = stagePage(state.campaignUnlocked, campaignPage, state.campaignWins);
  const zone = stages[0].zone;
  $('#campaignZone').style.setProperty('--zone', zone.color);
  $('#campaignZone').innerHTML = `<span class="eyebrow">${activeUniverse === 1 ? 'GENESIS' : 'COSMOS'} AREA ${(campaignPage % 7) + 1}</span><h3>${escapeHtml(zone.name)}</h3><p>${escapeHtml(zone.story || zone.subtitle)} Primary signal: ${element({ element: zone.element }).name}.</p>`;
  $('#stageMap').style.setProperty('--zone', zone.color);
  $('#stageMap').innerHTML = stages.map((stage) => `<button class="stage-node ${stage.unlocked ? 'unlocked' : 'locked'} ${stage.complete ? 'complete' : ''}" data-stage="${stage.stage}" ${stage.unlocked ? '' : 'disabled'}><span class="stage-status">${stage.complete ? '✓' : stage.unlocked ? '⚔' : '▣'}</span><b>${stage.stage}</b><small>Lv ${stage.recommendedLevel} • ${stage.deckSize} cards</small><small>+${fmt(stage.reward)} Pixels</small></button>`).join('');
}

function renderDeckSelects() {
  const options = state.decks.map((deck) => `<option value="${deck.id}" ${deck.id === state.selectedDeckId ? 'selected' : ''}>${escapeHtml(deck.name)} (${cardsForDeck(deck).length})</option>`).join('');
  $('#quickDeck').innerHTML = options || '<option>Create a deck first</option>';
}
function renderBinder() {
  $('#elementFilters').innerHTML = `<button class="chip ${!elementFilter ? 'active' : ''}" data-element="">All</button>` + ELEMENTS.map((entry) => `<button class="chip ${elementFilter === entry.key ? 'active' : ''}" data-element="${entry.key}">${entry.icon} ${entry.name}</button>`).join('');
  $$('#collectionFilters [data-collection]').forEach((button) => button.classList.toggle('active', button.dataset.collection === collectionFilter));
  const query = $('#cardSearch').value.trim().toLowerCase();
  let cards = state.binder.filter((card) => (!elementFilter || card.element === elementFilter)
    && (!collectionFilter || (card.set || 'GENESIS') === collectionFilter)
    && (!advancedFilter.rarity || card.rarityKey === advancedFilter.rarity)
    && (!advancedFilter.minted || (advancedFilter.minted === 'minted' ? card.mintStatus !== 'UNMINTED' : card.mintStatus === 'UNMINTED'))
    && card.powerScore >= Number(advancedFilter.minPower || 0) && card.level >= Number(advancedFilter.minLevel || 0)
    && (!query || `${card.name} ${card.typeName} ${card.element} ${card.rarityKey} ${card.stats?.affix} ${card.set}`.toLowerCase().includes(query)));
  const sort = $('#cardSort').value;
  cards.sort(sort === 'power' ? (a, b) => b.powerScore - a.powerScore
    : sort === 'rarity' ? (a, b) => b.rarityPower - a.rarityPower
      : sort === 'level' ? (a, b) => b.level - a.level
        : sort === 'name' ? (a, b) => a.name.localeCompare(b.name)
          : (a, b) => b.createdAt - a.createdAt);
  $('#binderCount').textContent = fmt(state.binder.length);
  $('#binderGrid').innerHTML = cards.length ? cards.map(cardMarkup).join('') : '<div class="empty-state">No cards match this filter.</div>';
  paintCards($('#binderGrid'));
}

function renderDecks() {
  $('#deckList').innerHTML = state.decks.length ? state.decks.map((deck) => `<div class="deck-row"><div><b>${escapeHtml(deck.name)}</b><small>${cardsForDeck(deck).length} available unique cards${deck.id === state.selectedDeckId ? ' • SELECTED' : ''}</small></div><button data-select-deck="${deck.id}">${deck.id === state.selectedDeckId ? '✓' : 'Use'}</button><button data-edit-deck="${deck.id}">Edit</button></div>`).join('') : '<div class="empty-state">No decks yet. Make your first deck.</div>';
  if (editingDeckId) renderDeckEditor(); else $('#deckEditor').classList.add('hidden');
}
function renderDeckEditor() {
  const deck = state.decks.find((entry) => entry.id === editingDeckId);
  if (!deck) { editingDeckId = null; return renderDecks(); }
  $('#deckEditor').classList.remove('hidden'); $('#deckName').value = deck.name; $('#deckCount').textContent = `${deck.cardIds.length} / 20`;
  $('#deckCards').innerHTML = deck.cardIds.map((id) => state.binder.find((card) => card.cardHash === id)).filter(Boolean).map((card) => miniCard(card, '−', 'remove-card')).join('') || '<p class="muted">Add at least five cards.</p>';
  const inDeck = new Set(deck.cardIds);
  $('#deckBinder').innerHTML = state.binder.filter((card) => !card.tradeLocked && !inDeck.has(card.cardHash)).map((card) => miniCard(card, '+', 'add-card')).join('') || '<p class="muted">No unlocked binder cards remain.</p>';
}
function miniCard(card, symbol, action) {
  const r = rarity(card), e = element(card);
  return `<div class="mini-card" style="--rarity:${r.color};--element:${e.color}"><span class="swatch"></span><div><b>${escapeHtml(card.name)}</b><small>${card.set || 'GENESIS'} • ${r.name} • ${e.name} • LV ${card.level}${card.tradeLocked ? ' • LISTED' : ''}</small></div><button data-${action}="${card.cardHash}">${symbol}</button></div>`;
}

function openModal(title, body) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = body; $('#modal').showModal(); paintCards($('#modalBody')); }
function closeModal() { $('#modal').close(); }
function showCard(card) {
  const stats = card.stats || {}, r = rarity(card), e = element(card);
  const statPairs = [['HP', stats.hp], ['ATK', stats.atk], ['DEF', stats.def], ['MAG', stats.mag], ['SPD', stats.spd], ['CRIT', `${stats.crit || 0}%`], ['LUCK', stats.luck || 0], ['RESONANCE', stats.resonance || 0], ['ARMOR PEN', `${stats.armorPen || 0}%`], ['POWER', card.powerScore]];
  openModal(card.name, `<div class="card-detail">${cardMarkup(card)}<div><span class="eyebrow">${escapeHtml(card.set || 'GENESIS')} • ${r.name} • ${e.name.toUpperCase()}</span><h3>${escapeHtml(card.typeName)}</h3><div class="detail-stats">${statPairs.map(([key, value]) => `<div>${key} <b>${value}</b></div>`).join('')}</div><p class="detail-story">${escapeHtml(card.backstory)}</p><small class="muted">Hash: ${escapeHtml(card.cardHash)}<br>Mint status: ${escapeHtml(card.mintStatus || 'UNMINTED')}${card.txHash ? `<br>Transaction: ${escapeHtml(card.txHash)}` : ''}</small></div></div><div class="modal-actions"><button id="exportOne">Export Card JSON</button><button id="mintCard" ${card.tradeLocked || card.mintStatus === 'MINTED' ? 'disabled' : ''}>${card.mintStatus === 'MINTED' ? 'Minted' : 'Mint to Wallet'}</button></div>`);
  $('#exportOne').onclick = () => downloadJson(`${slug(card.name)}.pixelcard.json`, { kind: 'pixel-bosses-card', schemaVersion: 3, card });
  $('#mintCard').onclick = () => mintCard(card);
}
function openGenerator() {
  const offers = (set, list) => `<div class="offer-grid">${list.map((offer, index) => `<button class="offer" data-offer="${index}" data-generation-set="${set}" ${state.pixels < offer.pixels ? 'disabled' : ''}><span class="pixel-gem"></span><div><b>${escapeHtml(offer.label)}</b><small>${escapeHtml(offer.note)}</small></div><strong>${fmt(offer.pixels)} ◇</strong></button>`).join('')}</div>`;
  openModal('Generate a Boss', `<p class="muted">Choose a collection and offer. Higher offers improve rarity odds and level range; every pull creates one permanent unique card.</p><h3>Universe 1 • Genesis</h3>${offers('GENESIS', GENERATOR_OFFERS)}<h3>Universe 2 • Cosmos</h3>${offers('COSMOS', COSMOS_GENERATOR_OFFERS)}`);
}
function generateFromOffer(index, set) {
  const offers = set === 'COSMOS' ? COSMOS_GENERATOR_OFFERS : GENERATOR_OFFERS;
  const offer = offers[index];
  if (!offer || state.pixels < offer.pixels) return toast('Not enough Pixels.');
  state.pixels -= offer.pixels; state.stats.pixelsSpent += offer.pixels;
  let card;
  do { card = makeCard({ collection: set, rarityBoost: offer.boost, levelRange: offer.level }); } while (state.binder.some((entry) => entry.cardHash === card.cardHash));
  state.binder.push(card); state.stats.cardsGenerated++; commit(); vibrate([20, 25, 35]); showCard(card); toast(`${rarity(card).name} ${set} card generated!`);
}
function openBinderTools() {
  openModal('Binder Import / Export', `<p class="muted">Binder and single-card imports merge unique hashes. Opponent and AI decks are never exposed or saved.</p><div class="modal-actions"><button id="exportBinderBtn">Export Binder</button><button id="importBinderBtn">Import Binder / Card</button><button id="clearBinderBtn" class="danger">Clear Binder & Decks</button></div>`);
  $('#exportBinderBtn').onclick = () => downloadJson('pixel-bosses-binder.json', exportBinder(state));
  $('#importBinderBtn').onclick = () => chooseJson('binder');
  $('#clearBinderBtn').onclick = () => {
    if (!confirm('Clear every local binder card and deck? Export a complete save first if you may need them.')) return;
    if (state.binder.some((card) => card.tradeLocked)) return toast('Cancel active listings before clearing your binder.');
    state.binder = []; state.decks = []; state.selectedDeckId = null; commit('Binder and decks cleared.'); closeModal(); renderBinder();
  };
}
function openAdvancedFilters() {
  openModal('Advanced Binder Filters', `<label class="field"><span>Rarity</span><select id="filterRarity"><option value="">Any rarity</option>${RARITIES.map((entry) => `<option value="${entry.key}" ${advancedFilter.rarity === entry.key ? 'selected' : ''}>${entry.name}</option>`).join('')}</select></label><label class="field"><span>Mint status</span><select id="filterMinted"><option value="">Any status</option><option value="unminted" ${advancedFilter.minted === 'unminted' ? 'selected' : ''}>Unminted</option><option value="minted" ${advancedFilter.minted === 'minted' ? 'selected' : ''}>Mint requested / minted</option></select></label><label class="field"><span>Minimum power</span><input id="filterPower" type="number" min="0" value="${advancedFilter.minPower || ''}"></label><label class="field"><span>Minimum level</span><input id="filterLevel" type="number" min="0" value="${advancedFilter.minLevel || ''}"></label><div class="modal-actions"><button id="clearFilters">Clear</button><button id="applyFilters" class="primary">Apply</button></div>`);
  $('#clearFilters').onclick = () => { advancedFilter = { rarity: '', minted: '', minPower: 0, minLevel: 0 }; closeModal(); renderBinder(); };
  $('#applyFilters').onclick = () => { advancedFilter = { rarity: $('#filterRarity').value, minted: $('#filterMinted').value, minPower: Number($('#filterPower').value || 0), minLevel: Number($('#filterLevel').value || 0) }; closeModal(); renderBinder(); };
}

function askDeckForStage(stageNumber) {
  const info = getStage(stageNumber);
  openModal(`Stage ${stageNumber}: ${info.zone.name}`, `<p>${escapeHtml(info.story)}</p><p class="muted">Select a legal deck. Opponents use a mixed-element construction so a single Cancel Wild cannot sweep an entire deck.</p><div class="offer-grid">${state.decks.map((deck) => { const cards = cardsForDeck(deck), valid = validateDeck(cards).valid; return `<button class="offer" data-stage-deck="${deck.id}" ${valid ? '' : 'disabled'}><div><b>${escapeHtml(deck.name)}</b><small>${cards.length} available cards${valid ? '' : ' • needs 5–20 unique unlocked cards'}</small></div><span>›</span></button>`; }).join('')}</div>`);
  $$('#modalBody [data-stage-deck]').forEach((button) => button.onclick = () => { state.selectedDeckId = button.dataset.stageDeck; closeModal(); startLocalBattle({ stage: stageNumber }); });
}
function startLocalBattle({ stage = null } = {}) {
  const deck = cardsForDeck(selectedDeck()); const check = validateDeck(deck);
  if (!check.valid) return toast(check.duplicate ? 'Decks cannot contain duplicate cards.' : 'Choose a deck with 5–20 unlocked cards.');
  const info = stage ? getStage(stage) : null;
  const average = Math.max(1, Math.round(deck.reduce((sum, card) => sum + card.level, 0) / deck.length));
  const cosmosChance = state.campaignUnlocked > 70 ? .35 : 0;
  const enemy = stage ? makeCampaignDeck(stage) : Array.from({ length: deck.length }, (_, index) => makeCard({ seed: `ai:${Date.now()}:${index}`, collection: Math.random() < cosmosChance ? 'COSMOS' : 'GENESIS', rarityBoost: 1, levelRange: [Math.max(1, average - 3), average + 4] }));
  const result = simulateMatch(deck, enemy, `${stage || 'ai'}:${Date.now()}`);
  battle = { kind: stage ? 'campaign' : 'ai', stage, info, playerDeck: deck, enemyDeck: enemy, result, index: 0, score: [0, 0], finished: false, auto: false, rewarded: false };
  registerCards([...deck, ...enemy]); showScreen('battle'); renderBattleShell();
}
function renderBattleShell() {
  clearTimeout(battleTimer);
  $('#battleMode').textContent = battle.kind === 'pvp' ? 'ONLINE AUTO BATTLE' : battle.kind === 'campaign' ? `CAMPAIGN • STAGE ${battle.stage}` : 'AI BATTLE SIMULATOR';
  $('#battleTitle').textContent = battle.info?.zone.name || (battle.kind === 'pvp' ? battle.opponent || 'Finding challenger…' : 'Chain Simulation');
  $('#opponentLabel').textContent = battle.kind === 'pvp' ? battle.opponent || 'CHALLENGER' : 'AI BOSS';
  $('#roundScore').textContent = '0 — 0'; $('#roundLabel').textContent = 'ROUND 0'; $('#battleProgressBar').style.width = '0%';
  $('#battleReason').textContent = battle.kind === 'pvp' ? 'Connecting to the global duel queue…' : 'Ready to breach the Chain.'; $('#battleLog').innerHTML = '';
  $('#battleCardA').innerHTML = '<div class="muted">DECK READY</div>'; $('#battleCardB').innerHTML = '<div class="muted">SIGNAL HIDDEN</div>';
  $('#battleControls').innerHTML = battle.kind === 'pvp' ? '<button id="cancelQueue" class="danger">Cancel Queue</button>' : '<button id="nextRound" class="primary">Play Next Card</button><button id="autoBattle">Auto Battle</button><button id="shuffleBattle">Shuffle Both • 25 ◇</button>';
}
function showRound(round, index, total) {
  registerCards([round.cardA, round.cardB]); $('#battleCardA').innerHTML = cardMarkup(round.cardA); $('#battleCardB').innerHTML = cardMarkup(round.cardB); paintCards($('#battleArena'));
  battle.score = round.score; $('#roundScore').textContent = `${round.score[0]} — ${round.score[1]}`; $('#roundLabel').textContent = `ROUND ${index + 1} / ${total}`; $('#battleProgressBar').style.width = `${((index + 1) / total) * 100}%`;
  const cancel = round.duel.reasons[0]?.startsWith('CANCEL_WILD');
  const winningCard = round.duel.winner === 'A' ? round.cardA : round.cardB;
  $('#battleReason').textContent = cancel ? `${element(winningCard).name} triggered CANCEL WILD!` : `${winningCard.name} wins the comparison.`;
  if (state.settings.effects) { const arena = $('#battleArena'); arena.style.setProperty('--burst', element(winningCard).color); arena.classList.remove('clash'); void arena.offsetWidth; arena.classList.add('clash'); }
  $('#fighterA').className = `fighter ${round.duel.winner === 'A' ? 'winner' : 'loser'}`; $('#fighterB').className = `fighter ${round.duel.winner === 'B' ? 'winner' : 'loser'}`;
  $('#battleLog').insertAdjacentHTML('afterbegin', `<div>R${index + 1}: ${escapeHtml(round.cardA.name)} vs ${escapeHtml(round.cardB.name)} — ${round.duel.winner === 'A' ? 'YOU' : 'OPPONENT'}${cancel ? ' • CANCEL WILD' : ''}</div>`); vibrate(round.duel.winner === 'A' ? 25 : [12, 25, 12]);
}
function nextLocalRound() {
  if (!battle || battle.finished) return;
  if (battle.index >= battle.result.rounds.length) return finishLocalBattle();
  showRound(battle.result.rounds[battle.index], battle.index, battle.result.rounds.length); battle.index++;
  if (battle.index >= battle.result.rounds.length) { $('#nextRound').textContent = 'View Result'; if (battle.auto) battleTimer = setTimeout(finishLocalBattle, 900); }
  else if (battle.auto) battleTimer = setTimeout(nextLocalRound, 850);
}
function toggleAutoBattle() {
  if (battle.finished) return; battle.auto = !battle.auto; $('#autoBattle').textContent = battle.auto ? 'Pause Auto' : 'Auto Battle'; if (battle.auto) nextLocalRound(); else clearTimeout(battleTimer);
}
function shuffleBattle() {
  if (state.pixels < 25) return toast('You need 25 Pixels to reshuffle.');
  state.pixels -= 25; state.stats.pixelsSpent += 25; const seed = `reshuffle:${Date.now()}`;
  battle.result = simulateMatch(seededShuffle(battle.playerDeck, seed), seededShuffle(battle.enemyDeck, `${seed}:enemy`), seed); battle.index = 0; battle.score = [0, 0]; commit('Both decks reshuffled for 25 Pixels.'); renderBattleShell();
}
function recordMatch(result, kind, reward, score) {
  const win = result === 'A', draw = result === 'DRAW';
  state.stats.matchesPlayed++; state.stats.pixelsEarned += reward; state.stats.scoreEarned += score; state.stats.highestScore = Math.max(state.stats.highestScore, score);
  if (win) { state.stats.wins++; state.stats.winStreak++; state.stats.bestWinStreak = Math.max(state.stats.bestWinStreak, state.stats.winStreak); }
  else if (draw) { state.stats.draws++; state.stats.winStreak = 0; }
  else { state.stats.losses++; state.stats.winStreak = 0; }
  if (kind === 'ai') win ? state.stats.aiWins++ : !draw && state.stats.aiLosses++;
  if (kind === 'campaign') win ? state.stats.campaignWins++ : !draw && state.stats.campaignLosses++;
  if (kind === 'pvp') win ? state.stats.pvpWins++ : !draw && state.stats.pvpLosses++;
}
function finishLocalBattle() {
  if (battle.finished) return showResultModal();
  battle.finished = true; clearTimeout(battleTimer);
  const result = battle.result.winner, win = result === 'A', draw = result === 'DRAW';
  if (!battle.rewarded) {
    const reward = win ? (battle.info?.reward || 100) : draw ? 35 : 15;
    const score = battle.score[0] * 100 + (win ? 250 : draw ? 80 : 20) + (battle.info?.recommendedLevel || 1);
    state.pixels += reward; recordMatch(result, battle.kind, reward, score);
    if (win && battle.kind === 'campaign') {
      if (!state.campaignWins.includes(battle.stage)) state.campaignWins.push(battle.stage);
      if (battle.stage === state.campaignUnlocked) state.campaignUnlocked++;
      const lore = rollLoreReward(battle.stage, state.items.map((item) => item.id));
      if (lore) { const found = { ...lore, foundAt: Date.now(), foundStage: battle.stage }; state.items.push(found); state.stats.loreFound++; battle.lore = found; }
    }
    battle.reward = reward; battle.scoreEarned = score; battle.rewarded = true; commit();
  }
  showResultModal();
}
function showResultModal() {
  const result = battle.kind === 'pvp' ? battle.pvpWinner : battle.result.winner;
  const win = result === 'A', draw = result === 'DRAW';
  openModal(win ? 'CHAIN BROKEN!' : draw ? 'SIGNAL DRAW' : 'BOSS PREVAILS', `<div style="text-align:center"><div class="boss-orb" style="margin:18px auto;width:100px;height:100px;font-size:38px">${win ? '★' : draw ? '◆' : '×'}</div><h3>${win ? 'Victory' : draw ? 'Draw' : 'Defeat'}</h3><p class="muted">Final score: ${battle.score[0]} — ${battle.score[1]}</p><h2 style="color:var(--cyan)">+${fmt(battle.reward || 0)} Pixels</h2>${battle.lore ? `<div class="lore-card" style="--lore-color:${rarity({ rarityKey: battle.lore.rarity }).color}"><span class="eyebrow">LORE DISCOVERED</span><h3>${battle.lore.icon} ${escapeHtml(battle.lore.name)}</h3><p>${escapeHtml(battle.lore.text)}</p></div>` : ''}</div><div class="modal-actions"><button id="resultHome">Main Menu</button>${battle.kind !== 'pvp' ? '<button id="resultAgain" class="primary">Battle Again</button>' : ''}</div>`);
  $('#resultHome').onclick = () => { closeModal(); stopBattle(); showScreen('home'); };
  if ($('#resultAgain')) $('#resultAgain').onclick = () => { const stage = battle.stage; closeModal(); startLocalBattle({ stage }); };
}
function stopBattle() { clearTimeout(battleTimer); if (battle?.kind === 'pvp') { try { network.send({ type: 'queue_leave' }); } catch {} network.close(); } battle = null; }
async function startPvp() {
  const deck = cardsForDeck(selectedDeck()); if (!validateDeck(deck).valid) return toast('Choose a legal 5–20 card unlocked deck first.');
  battle = { kind: 'pvp', score: [0, 0], index: 0, finished: false, opponent: 'Searching…', reward: 0 };
  showScreen('battle'); renderBattleShell();
  try { await network.connect(); network.send({ type: 'queue_join', playerId: state.playerId, token: state.playerToken, name: state.playerName, deckId: selectedDeck().id, deck }); }
  catch (error) { toast(error.message); $('#battleReason').textContent = error.message; }
}
network.addEventListener('message', ({ detail: message }) => {
  if (!battle || battle.kind !== 'pvp') return;
  if (message.type === 'queued') $('#battleReason').textContent = `Waiting for a challenger • Queue position ${message.position}`;
  if (message.type === 'match_start') { battle.opponent = message.opponent; battle.index = 0; $('#opponentLabel').textContent = message.opponent; $('#battleTitle').textContent = `You vs ${message.opponent}`; $('#battleReason').textContent = 'Opponent found. The server controls this auto-battle.'; }
  if (message.type === 'match_round') { showRound(message, battle.index, Number(message.total || cardsForDeck(selectedDeck()).length)); battle.index++; }
  if (message.type === 'match_end') {
    battle.finished = true; battle.pvpWinner = message.winner; battle.score = message.score; battle.reward = message.reward;
    state.pixels += message.reward; recordMatch(message.winner, 'pvp', message.reward, message.score[0] * 150 + (message.winner === 'A' ? 400 : 50)); commit(); showResultModal(); network.close();
  }
  if (message.type === 'error') { toast(message.message); $('#battleReason').textContent = message.message; }
});

const LEADER_STATS = [
  ['scoreEarned', 'Score earned'], ['wins', 'Matches won'], ['losses', 'Matches lost'], ['pvpWins', 'PvP wins'], ['pvpLosses', 'PvP losses'],
  ['campaignWins', 'Campaign wins'], ['cardsCollected', 'Cards collected'], ['cardTypes', 'Card types'], ['pixelsEarned', 'Pixels earned'],
  ['cardsGenerated', 'Cards generated'], ['tradesCompleted', 'Trades completed'], ['cardsMinted', 'Cards minted'], ['loreFound', 'Lore discovered'], ['bestWinStreak', 'Best win streak']
];
function renderStats() {
  $$('#statsTabs [data-stats-tab]').forEach((button) => button.classList.toggle('active', button.dataset.statsTab === statsTab));
  $('#myStatsPanel').classList.toggle('hidden', statsTab !== 'mine'); $('#leaderPanel').classList.toggle('hidden', statsTab !== 'leaders');
  const profile = state.profile;
  $('#profileSummary').innerHTML = `<div class="profile-avatar">${escapeHtml(profile.icon)}</div><div><b>${escapeHtml(state.playerName)}</b><span>@${escapeHtml(profile.tag)}</span><p>${escapeHtml(profile.bio || 'No bio yet. Customize your profile in Settings.')}</p></div>`;
  const types = new Set(state.binder.map((card) => card.type)).size;
  const values = [
    ['Cards collected', state.binder.length], ['Card types', types], ['Matches', state.stats.matchesPlayed], ['Wins', state.stats.wins],
    ['Losses', state.stats.losses], ['Draws', state.stats.draws], ['PvP record', `${state.stats.pvpWins}–${state.stats.pvpLosses}`], ['Campaign clears', state.campaignWins.length],
    ['Pixels earned', state.stats.pixelsEarned], ['Pixels purchased', state.stats.pixelsPurchased], ['Score earned', state.stats.scoreEarned], ['Best streak', state.stats.bestWinStreak],
    ['Generated', state.stats.cardsGenerated], ['Trades', state.stats.tradesCompleted], ['Minted', state.stats.cardsMinted], ['Lore', state.items.length]
  ];
  $('#statsGrid').innerHTML = values.map(([label, value]) => `<div class="stat-tile"><b>${typeof value === 'number' ? fmt(value) : value}</b><small>${label}</small></div>`).join('');
  const counts = ELEMENTS.map((entry) => ({ ...entry, count: state.binder.filter((card) => card.element === entry.key).length }));
  const max = Math.max(1, ...counts.map((entry) => entry.count));
  $('#typeStats').innerHTML = `<h3>Card elements</h3><div class="type-chart">${counts.map((entry) => `<div class="type-row"><span>${entry.icon} ${entry.name}</span><i style="--type-color:${entry.color};--type-width:${(entry.count / max) * 100}%"></i><b>${entry.count}</b></div>`).join('')}</div>`;
  $('#leaderStat').innerHTML = LEADER_STATS.map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
  if (statsTab === 'leaders') loadLeaderboard();
}
async function loadLeaderboard() {
  $('#leaderboard').innerHTML = '<div class="empty-state">Loading global rankings…</div>';
  try {
    const data = await network.request(`/api/leaderboard?stat=${encodeURIComponent($('#leaderStat').value)}&limit=100`);
    const rows = data.leaders || [];
    $('#leaderboard').innerHTML = rows.length ? rows.map((row, index) => `<div class="leader-row ${row.playerId === state.playerId ? 'me' : ''}"><span class="leader-rank">#${index + 1}</span><span class="leader-avatar">${escapeHtml(row.icon || '☠')}</span><span class="leader-name"><b>${escapeHtml(row.name)}</b><small>@${escapeHtml(row.tag || row.playerId.slice(0, 8))}</small></span><span class="leader-value">${fmt(row.value)}</span></div>`).join('') : '<div class="empty-state">No ranked profiles yet. Sync a save to enter the board.</div>';
  } catch (error) { $('#leaderboard').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}
function renderItems() {
  $('#itemCount').textContent = fmt(state.items.length); $$('#itemFilters [data-item-universe]').forEach((button) => button.classList.toggle('active', Number(button.dataset.itemUniverse) === itemUniverse));
  const items = state.items.filter((item) => !itemUniverse || item.universe === itemUniverse);
  $('#itemGrid').innerHTML = items.length ? items.map((item) => `<article class="lore-card" style="--lore-color:${rarity({ rarityKey: item.rarity }).color}"><span class="eyebrow">UNIVERSE ${item.universe} • ${String(item.rarity).toUpperCase()}</span><h3>${item.icon} ${escapeHtml(item.name)}</h3><p>${escapeHtml(item.text)}</p><small>Recovered at Stage ${item.foundStage || '?'} • ${nowLabel(item.foundAt)}</small></article>`).join('') : '<div class="empty-state">Win campaign battles to discover unique lore. Every item can be collected once.</div>';
}

function renderSocial() {
  $$('#socialTabs [data-social-tab]').forEach((button) => button.classList.toggle('active', button.dataset.socialTab === socialTab));
  $('#marketPanel').classList.toggle('hidden', socialTab !== 'market'); $('#chatPanel').classList.toggle('hidden', socialTab !== 'chat'); $('#friendsPanel').classList.toggle('hidden', socialTab !== 'friends');
  if (socialTab === 'market') loadMarket();
  if (socialTab === 'chat') renderChatMessages();
  if (socialTab === 'friends') loadFriends();
}
async function loadMarket() {
  $('#marketList').innerHTML = '<div class="empty-state">Loading listings…</div>';
  const params = new URLSearchParams({ search: $('#marketSearch').value.trim(), mode: $('#marketFilter').value });
  try { const data = await network.request(`/api/market/listings?${params}`); marketListings = data.listings || []; renderMarketList(); }
  catch (error) { $('#marketList').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}
function renderMarketList() {
  $('#marketList').innerHTML = marketListings.length ? marketListings.map((listing) => {
    const card = listing.card, r = rarity(card), e = element(card), mine = listing.sellerId === state.playerId, remaining = Math.max(0, Math.ceil((listing.expiresAt - Date.now()) / 3600000));
    const price = listing.mode === 'fixed' ? `${fmt(listing.price)} Pixels` : listing.mode === 'auction' ? `${fmt(listing.highestBid?.amount || listing.minBid)} Pixel bid` : 'Card-for-card';
    const action = mine ? `<button data-cancel-listing="${listing.id}" class="danger">Cancel</button>${listing.offers?.length ? `<button data-view-offers="${listing.id}">Offers (${listing.offers.length})</button>` : ''}`
      : listing.mode === 'fixed' ? `<button data-buy-listing="${listing.id}" class="primary">Buy</button>`
        : listing.mode === 'auction' ? `<button data-bid-listing="${listing.id}" class="primary">Bid</button>`
          : `<button data-offer-trade="${listing.id}" class="primary">Offer Card</button>`;
    return `<article class="market-row"><div class="market-thumb" style="--rarity:${r.color};--element:${e.color}">${e.icon}</div><div class="market-copy"><b>${escapeHtml(card.name)}</b><small>${card.set || 'GENESIS'} • ${r.name} • ${e.name} • LV ${card.level}</small><small>Seller: @${escapeHtml(listing.sellerTag || listing.sellerName)}</small><div class="market-price">${price}</div><small>${remaining}h remaining</small></div><div class="market-actions">${action}</div></article>`;
  }).join('') : '<div class="empty-state">No active cards match these filters.</div>';
}
async function ensureCloudProfile() { const data = await network.sync(state); adoptState(data.state); }
function openListingComposer() {
  const cards = state.binder.filter((card) => !card.tradeLocked);
  if (!cards.length) return toast('No unlocked cards are available to list.');
  openModal('List a Card', `<p class="muted">Listed cards are locked and removed from battle decks until the listing completes or is cancelled.</p><div class="listing-fields"><label class="field"><span>Card</span><select id="listingCard">${cards.map((card) => `<option value="${card.cardHash}">${escapeHtml(card.name)} • ${rarity(card).name} • LV ${card.level}</option>`).join('')}</select></label><label class="field"><span>Listing type</span><select id="listingMode"><option value="fixed">Fixed price</option><option value="auction">Timed auction</option><option value="trade">Card for card</option></select></label><label class="field"><span>Price / minimum bid</span><input id="listingPrice" type="number" min="1" value="100"></label><label class="field"><span>Duration</span><select id="listingDuration"><option value="1">1 hour</option><option value="6">6 hours</option><option value="24" selected>24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label><label class="field"><span>Trade request (optional)</span><input id="listingRequest" maxlength="120" placeholder="e.g. Cosmos Rare, Nature…"></label></div><div class="modal-actions"><button id="submitListing" class="primary">Publish Listing</button></div>`);
  $('#listingMode').onchange = () => { $('#listingPrice').disabled = $('#listingMode').value === 'trade'; };
  $('#submitListing').onclick = submitListing;
}
async function submitListing() {
  try {
    await ensureCloudProfile();
    const data = await network.request('/api/market/listings', { method: 'POST', body: JSON.stringify({ cardHash: $('#listingCard').value, mode: $('#listingMode').value, price: Number($('#listingPrice').value), durationHours: Number($('#listingDuration').value), tradeRequest: $('#listingRequest').value.trim() }) });
    adoptState(data.state); closeModal(); toast('Card listed on the market.'); loadMarket();
  } catch (error) { toast(error.message); }
}
async function marketAction(path, body = {}, method = 'POST') {
  try { const data = await network.request(path, { method, body: method === 'DELETE' ? undefined : JSON.stringify(body) }); adoptState(data.state); toast(data.message || 'Market updated.'); closeModal(); await loadMarket(); }
  catch (error) { toast(error.message); }
}
function offerTrade(listing) {
  const cards = state.binder.filter((card) => !card.tradeLocked && card.cardHash !== listing.card.cardHash);
  if (!cards.length) return toast('You need an unlocked card to make an offer.');
  openModal('Offer a Card', `<p>Offer for <b>${escapeHtml(listing.card.name)}</b></p><label class="field"><span>Your card</span><select id="tradeCard">${cards.map((card) => `<option value="${card.cardHash}">${escapeHtml(card.name)} • ${rarity(card).name} • LV ${card.level}</option>`).join('')}</select></label><label class="field"><span>Optional Pixels added</span><input id="tradePixels" type="number" min="0" value="0"></label><div class="modal-actions"><button id="sendTradeOffer" class="primary">Lock & Send Offer</button></div>`);
  $('#sendTradeOffer').onclick = () => marketAction(`/api/market/listings/${listing.id}/offer`, { cardHash: $('#tradeCard').value, pixels: Number($('#tradePixels').value) });
}
function viewOffers(listing) {
  openModal('Listing Offers', `<p><b>${escapeHtml(listing.card.name)}</b></p><div class="offer-grid">${listing.offers.map((offer) => `<button class="offer" data-accept-offer="${offer.id}" data-listing-id="${listing.id}"><div><b>${escapeHtml(offer.card?.name || `${fmt(offer.amount)} Pixels`)}</b><small>@${escapeHtml(offer.bidderTag || offer.bidderName)}${offer.pixels ? ` • +${fmt(offer.pixels)} Pixels` : ''}</small></div><span>Accept ›</span></button>`).join('')}</div>`);
}

function connectSocialChat() {
  if (chatSocket?.readyState === WebSocket.OPEN) { chatSocket.send(JSON.stringify({ type: 'chat_join', room: chatRoom })); return; }
  try {
    const url = new URL(network.baseUrl); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = '/multiplayer';
    chatSocket = new WebSocket(url);
    chatSocket.onopen = () => { chatSocket.send(JSON.stringify({ type: 'social_auth', playerId: state.playerId, token: state.playerToken })); chatSocket.send(JSON.stringify({ type: 'chat_join', room: chatRoom })); };
    chatSocket.onmessage = (event) => handleChatMessage(JSON.parse(event.data));
    chatSocket.onerror = () => toast('Could not reach chat server.');
    chatSocket.onclose = () => { chatConnected = false; $('#connectChat').textContent = 'Connect'; };
  } catch (error) { toast(error.message); }
}
function handleChatMessage(message) {
  if (message.type === 'social_ready') { chatConnected = true; $('#connectChat').textContent = 'Connected'; }
  if (message.type === 'chat_history') { chatMessages = message.messages || []; renderChatMessages(); }
  if (message.type === 'chat_message') { chatMessages.push(message.message); chatMessages = chatMessages.slice(-150); renderChatMessages(true); }
  if (message.type === 'error' && currentScreen === 'social') toast(message.message);
}
function renderChatMessages(scroll = false) {
  $('#connectChat').textContent = chatConnected ? 'Connected' : 'Connect';
  $('#chatMessages').innerHTML = chatMessages.length ? chatMessages.map((message) => `<div class="chat-message ${message.playerId === state.playerId ? 'mine' : ''}"><b>${escapeHtml(message.name)} • @${escapeHtml(message.tag || 'pilot')}</b><p>${escapeHtml(message.text)}</p><small>${nowLabel(message.createdAt)}</small></div>`).join('') : '<div class="empty-state">Connect to load this room. Be kind; server moderation hooks are ready for production.</div>';
  if (scroll) $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}
async function loadFriends() {
  try { const data = await network.request('/api/social/friends'); friendData = { friends: data.friends || [], requests: data.requests || [] }; renderFriends(); }
  catch (error) { $('#friendList').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}
function renderFriends() {
  const row = (profile, actions) => `<div class="friend-row"><span class="friend-avatar">${escapeHtml(profile.icon || '☠')}</span><div><b>${escapeHtml(profile.name)}</b><small>@${escapeHtml(profile.tag || profile.playerId.slice(0, 8))}</small></div><div class="friend-actions">${actions}</div></div>`;
  $('#friendRequests').innerHTML = friendData.requests.length ? friendData.requests.map((profile) => row(profile, `<button data-friend-accept="${profile.playerId}">Accept</button><button data-friend-decline="${profile.playerId}">Decline</button>`)).join('') : '<p class="muted">No pending requests.</p>';
  $('#friendList').innerHTML = friendData.friends.length ? friendData.friends.map((profile) => row(profile, `<button data-message-friend="${profile.playerId}" data-friend-name="${escapeHtml(profile.name)}">Message</button><button data-remove-friend="${profile.playerId}" class="danger">Remove</button>`)).join('') : '<p class="muted">No friends added yet.</p>';
}
async function friendAction(path, body = {}, method = 'POST') {
  try { await network.request(path, { method, body: method === 'DELETE' ? undefined : JSON.stringify(body) }); toast('Friends updated.'); loadFriends(); }
  catch (error) { toast(error.message); }
}

function renderShop() {
  $('#cashPackages').innerHTML = CASH_PACKAGES.map((pack) => `<button class="shop-card" data-buy-pack="${pack.id}" style="--pack:${pack.accent}"><span class="pixel-gem"></span><b>${fmt(pack.pixels)} ◇</b><span>${escapeHtml(pack.name)}</span><small>Server-verified Pixel credit</small><strong>${pack.price}</strong></button>`).join('');
}
async function buyPack(id) {
  try { await ensureCloudProfile(); const data = await network.request('/api/shop/checkout', { method: 'POST', body: JSON.stringify({ packageId: id }) }); if (!data.url) throw new Error('Checkout is not configured.'); location.href = data.url; }
  catch (error) { toast(error.message); }
}

function renderRules() {
  const counters = ELEMENTS.flatMap((entry) => entry.beats.map((target) => `<div class="counter-chip"><b style="color:${entry.color}">${entry.icon} ${entry.name}</b> cancels ${ELEMENTS.find((other) => other.key === target)?.name}</div>`)).join('');
  $('#rulesContent').innerHTML = `<article class="rule-card"><h3>How a match is won</h3><ol><li>Both decks are shuffled from a shared match seed.</li><li>One card from each deck duels each round. Every round awards one point.</li><li>After the shorter deck is exhausted, the player with more round points wins. Equal points produce a match draw.</li></ol><p>Legal decks contain <b>5–20 unique, unlocked cards</b>. Duplicate card hashes are rejected.</p></article>
    <article class="rule-card"><h3>Cancel Wilds</h3><p>Element counters resolve first and immediately win that card duel. Rarity, level, and power are skipped. A mixed deck is therefore safer than a single-element deck.</p><div class="counter-grid">${counters}</div><p>If neither element cancels the other—or both cards share an element—the normal comparison begins.</p></article>
    <article class="rule-card"><h3>Normal comparison</h3><ol><li><b>Rarity:</b> Common &lt; Uncommon &lt; Rare &lt; Epic &lt; Legendary &lt; Mythic.</li><li><b>Level:</b> the higher level earns the second comparison point.</li><li>If one card wins both rarity and level, it wins immediately.</li><li>If those checks split or tie, compare <code>rarity rank × 100 + level</code>, then total power. A deterministic seeded coin flip is the final fallback.</li></ol></article>
    <article class="rule-card"><h3>Power formula</h3><p>Power is a weighted summary used only after element, rarity, level, and the rarity-level tiebreak.</p><code class="formula">round(HP×0.20 + ATK×0.22 + DEF×0.18 + MAG×0.18 + SPD×0.12 + CRIT×0.18 + LUCK×0.08 + RESONANCE×0.09 + ARMOR PEN×0.12)</code><p>Collection, variant, affix, and artwork do not independently override the duel order; they influence generated identity and stats.</p></article>
    <article class="rule-card"><h3>Battle modes & rewards</h3><ul><li><b>Campaign:</b> choose a deck, play manually or autoplay, and unlock the next stage only by winning the current stage.</li><li><b>AI simulator:</b> choose a deck and play manually or autoplay. Shuffle Both costs 25 Pixels and restarts the match order.</li><li><b>Online PvP:</b> choose a legal deck, enter matchmaking, and let the server auto-resolve every round.</li><li>Victory, draw, and defeat rewards differ. Campaign stage rewards are shown on the map and rise with difficulty.</li></ul></article>`;
}

function renderSettings() {
  $('#playerName').value = state.playerName; $('#playerTag').value = state.profile.tag; $('#playerBio').value = state.profile.bio;
  $('#profileIcons').innerHTML = ['☠', '⚔', '✦', '◈', '◆', '❉', '☼', '♦', '∞', '◎'].map((icon) => `<button data-profile-icon="${icon}" class="${state.profile.icon === icon ? 'active' : ''}">${icon}</button>`).join('');
  $('#effectsToggle').checked = state.settings.effects; $('#vibrationToggle').checked = state.settings.vibration; $('#syncToggle').checked = state.settings.autoSync;
  $('#gfpStatus').classList.toggle('connected', state.profile.gfpConnected); $('#gfpStatus').innerHTML = state.profile.gfpConnected ? `<b>✓ GetFirstPage.com connected</b><small>Member ID: ${escapeHtml(state.profile.gfpMemberId || 'verified')}</small>` : '<b>GetFirstPage.com not connected</b><small>Enter a one-time link code after the Railway verification endpoint is configured.</small>';
  $('#walletStatus').textContent = state.profile.walletAddress ? `Wallet: ${state.profile.walletAddress}` : 'No wallet connected. Add a Polygon-compatible address before requesting a mint.';
}
async function connectGfp() {
  const code = prompt('Enter the one-time link code from your GetFirstPage.com account:'); if (!code) return;
  try { await ensureCloudProfile(); const data = await network.request('/api/integrations/getfirstpage/connect', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }); adoptState(data.state); renderSettings(); toast('GetFirstPage.com account connected.'); }
  catch (error) { toast(error.message); }
}
function saveWallet() {
  const address = prompt('Enter your Polygon wallet address:', state.profile.walletAddress || ''); if (address == null) return;
  if (address && !/^0x[a-fA-F0-9]{40}$/.test(address.trim())) return toast('Enter a valid 0x wallet address.');
  state.profile.walletAddress = address.trim() || null; commit('Wallet address saved.'); renderSettings();
}
async function mintCard(card) {
  if (!state.profile.walletAddress) { closeModal(); showScreen('settings'); return toast('Add a wallet address in Settings first.'); }
  const tokenUri = prompt('Enter the pinned IPFS metadata URI for this card (ipfs://…):');
  if (!tokenUri) return;
  if (!tokenUri.startsWith('ipfs://')) return toast('Metadata must use an ipfs:// URI.');
  try { await ensureCloudProfile(); const data = await network.request('/api/mint/request', { method: 'POST', body: JSON.stringify({ cardHash: card.cardHash, tokenUri }) }); adoptState(data.state); closeModal(); renderBinder(); toast(`Mint submitted: ${String(data.txHash).slice(0, 12)}…`); }
  catch (error) { toast(error.message); }
}
async function syncCloud(silent = false) {
  try { const result = await network.sync(state); if (result.source === 'server') adoptState(result.state); if (!silent) toast(result.source === 'server' ? 'Newer cloud save restored.' : 'Cloud save is up to date.'); }
  catch (error) { if (!silent) toast(error.message); }
}

function slug(text) { return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pixel-bosses'; }
function downloadJson(name, payload) { const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const anchor = Object.assign(document.createElement('a'), { href: url, download: name }); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function chooseJson(action) { pickerAction = action; $('#filePicker').value = ''; $('#filePicker').click(); }

document.addEventListener('click', (event) => {
  const go = event.target.closest('[data-go]'); if (go) return showScreen(go.dataset.go);
  const universe = event.target.closest('[data-universe]'); if (universe) { campaignPage = Number(universe.dataset.universe) === 1 ? 0 : 7; return renderCampaign(); }
  const stage = event.target.closest('[data-stage]'); if (stage) return askDeckForStage(Number(stage.dataset.stage));
  const cardElement = event.target.closest('.boss-card'); if (cardElement && currentScreen !== 'battle') { const card = transientCards.get(cardElement.dataset.cardId) || state.binder.find((entry) => entry.cardHash === cardElement.dataset.cardId); if (card) showCard(card); return; }
  const offer = event.target.closest('[data-offer]'); if (offer) return generateFromOffer(Number(offer.dataset.offer), offer.dataset.generationSet);
  const select = event.target.closest('[data-select-deck]'); if (select) { state.selectedDeckId = select.dataset.selectDeck; commit('Battle deck selected.'); return renderDecks(); }
  const edit = event.target.closest('[data-edit-deck]'); if (edit) { editingDeckId = edit.dataset.editDeck; return renderDecks(); }
  const add = event.target.closest('[data-add-card]'); if (add) { const deck = state.decks.find((entry) => entry.id === editingDeckId); const card = state.binder.find((entry) => entry.cardHash === add.dataset.addCard); if (card?.tradeLocked) return toast('Listed cards cannot be added to decks.'); if (deck.cardIds.length >= 20) return toast('A deck can hold at most 20 cards.'); if (!deck.cardIds.includes(add.dataset.addCard)) deck.cardIds.push(add.dataset.addCard); return renderDeckEditor(); }
  const remove = event.target.closest('[data-remove-card]'); if (remove) { const deck = state.decks.find((entry) => entry.id === editingDeckId); deck.cardIds = deck.cardIds.filter((id) => id !== remove.dataset.removeCard); return renderDeckEditor(); }
  const collection = event.target.closest('[data-collection]'); if (collection) { collectionFilter = collection.dataset.collection; return renderBinder(); }
  const statTab = event.target.closest('[data-stats-tab]'); if (statTab) { statsTab = statTab.dataset.statsTab; return renderStats(); }
  const itemTab = event.target.closest('[data-item-universe]'); if (itemTab) { itemUniverse = Number(itemTab.dataset.itemUniverse); return renderItems(); }
  const sTab = event.target.closest('[data-social-tab]'); if (sTab) { socialTab = sTab.dataset.socialTab; return renderSocial(); }
  const profileIcon = event.target.closest('[data-profile-icon]'); if (profileIcon) { state.profile.icon = profileIcon.dataset.profileIcon; return renderSettings(); }
  const pack = event.target.closest('[data-buy-pack]'); if (pack) return buyPack(pack.dataset.buyPack);
  const cancelListing = event.target.closest('[data-cancel-listing]'); if (cancelListing) return confirm('Cancel this listing and refund every active bid or offer?') && marketAction(`/api/market/listings/${cancelListing.dataset.cancelListing}`, {}, 'DELETE');
  const buy = event.target.closest('[data-buy-listing]'); if (buy) return confirm('Buy this card at its fixed Pixel price?') && marketAction(`/api/market/listings/${buy.dataset.buyListing}/buy`);
  const bid = event.target.closest('[data-bid-listing]'); if (bid) { const listing = marketListings.find((entry) => entry.id === bid.dataset.bidListing); const minimum = Math.max(listing.minBid, (listing.highestBid?.amount || 0) + 1); const amount = Number(prompt(`Bid at least ${minimum} Pixels:`, minimum)); if (amount) marketAction(`/api/market/listings/${listing.id}/bid`, { amount }); return; }
  const trade = event.target.closest('[data-offer-trade]'); if (trade) return offerTrade(marketListings.find((entry) => entry.id === trade.dataset.offerTrade));
  const view = event.target.closest('[data-view-offers]'); if (view) return viewOffers(marketListings.find((entry) => entry.id === view.dataset.viewOffers));
  const accept = event.target.closest('[data-accept-offer]'); if (accept) return confirm('Accept this offer? Other bids and offers will be refunded.') && marketAction(`/api/market/listings/${accept.dataset.listingId}/accept`, { offerId: accept.dataset.acceptOffer });
  const friendAccept = event.target.closest('[data-friend-accept]'); if (friendAccept) return friendAction('/api/social/friends/respond', { playerId: friendAccept.dataset.friendAccept, accept: true });
  const friendDecline = event.target.closest('[data-friend-decline]'); if (friendDecline) return friendAction('/api/social/friends/respond', { playerId: friendDecline.dataset.friendDecline, accept: false });
  const removeFriend = event.target.closest('[data-remove-friend]'); if (removeFriend) return confirm('Remove this friend?') && friendAction(`/api/social/friends/${removeFriend.dataset.removeFriend}`, {}, 'DELETE');
  const messageFriend = event.target.closest('[data-message-friend]'); if (messageFriend) {
    socialTab = 'chat'; chatRoom = `private:${messageFriend.dataset.messageFriend}`;
    const selectRoom = $('#chatRoom'); let option = [...selectRoom.options].find((entry) => entry.value === chatRoom); if (!option) { option = new Option(`Private • ${messageFriend.dataset.friendName}`, chatRoom); selectRoom.add(option); } selectRoom.value = chatRoom; chatMessages = []; renderSocial(); connectSocialChat();
  }
});

$('#backBtn').onclick = goBack; $('#closeModal').onclick = closeModal; $('#walletBtn').onclick = () => showScreen('cards');
$('#campaignPage').onchange = (event) => { campaignPage = Number(event.target.value); renderCampaign(); };
$('#quickDeck').onchange = (event) => { state.selectedDeckId = event.target.value; commit(); };
$('#aiMode').onclick = () => startLocalBattle({}); $('#pvpMode').onclick = startPvp;
$('#openGenerator').onclick = openGenerator; $('#binderTools').onclick = openBinderTools; $('#advancedFilters').onclick = openAdvancedFilters;
$('#cardSearch').oninput = renderBinder; $('#cardSort').onchange = renderBinder;
$('#elementFilters').onclick = (event) => { const chip = event.target.closest('[data-element]'); if (chip) { elementFilter = chip.dataset.element; renderBinder(); } };
$('#newDeck').onclick = () => { const deck = { id: crypto.randomUUID(), name: `Deck ${state.decks.length + 1}`, cardIds: [], createdAt: Date.now() }; state.decks.push(deck); editingDeckId = deck.id; renderDecks(); };
$('#saveDeck').onclick = () => { const deck = state.decks.find((entry) => entry.id === editingDeckId); deck.name = $('#deckName').value.trim() || 'Untitled Deck'; const check = validateDeck(cardsForDeck(deck)); if (!check.valid || cardsForDeck(deck).length !== deck.cardIds.length) return toast('Save 5–20 unique unlocked cards in this deck.'); state.selectedDeckId = deck.id; commit('Deck saved and selected.'); renderDecks(); };
$('#deleteDeck').onclick = () => { if (state.decks.length <= 1) return toast('Keep at least one deck.'); if (!confirm('Delete this deck? Your binder cards will stay.')) return; state.decks = state.decks.filter((deck) => deck.id !== editingDeckId); if (state.selectedDeckId === editingDeckId) state.selectedDeckId = state.decks[0].id; editingDeckId = null; commit('Deck deleted.'); renderDecks(); };
$('#exportDeck').onclick = () => { const deck = state.decks.find((entry) => entry.id === editingDeckId); downloadJson(`${slug(deck.name)}.pixeldeck.json`, exportDeck(deck, state)); };
$('#battleControls').onclick = (event) => { if (event.target.id === 'nextRound') nextLocalRound(); if (event.target.id === 'autoBattle') toggleAutoBattle(); if (event.target.id === 'shuffleBattle') shuffleBattle(); if (event.target.id === 'cancelQueue') { stopBattle(); showScreen('quick'); } };
$('#leaderStat').onchange = loadLeaderboard;
$('#marketSearch').oninput = () => { clearTimeout(loadMarket.timer); loadMarket.timer = setTimeout(loadMarket, 300); }; $('#marketFilter').onchange = loadMarket; $('#createListing').onclick = openListingComposer;
$('#connectChat').onclick = connectSocialChat; $('#chatRoom').onchange = (event) => { chatRoom = event.target.value; chatMessages = []; renderChatMessages(); connectSocialChat(); };
$('#chatForm').onsubmit = (event) => { event.preventDefault(); const text = $('#chatInput').value.trim(); if (!text) return; if (!chatConnected || chatSocket?.readyState !== WebSocket.OPEN) return toast('Connect to chat first.'); chatSocket.send(JSON.stringify({ type: 'chat_send', room: chatRoom, text })); $('#chatInput').value = ''; };
$('#friendForm').onsubmit = (event) => { event.preventDefault(); const target = $('#friendTag').value.trim(); if (!target) return; friendAction('/api/social/friends/request', { target }); $('#friendTag').value = ''; };
$('#saveSettings').onclick = () => { state.playerName = $('#playerName').value.trim() || 'Pixel Pilot'; state.profile.tag = $('#playerTag').value.trim().replace(/^@/, '').slice(0, 30) || `PILOT-${state.playerId.slice(0, 4).toUpperCase()}`; state.profile.bio = $('#playerBio').value.trim().slice(0, 240); state.settings.effects = $('#effectsToggle').checked; state.settings.vibration = $('#vibrationToggle').checked; state.settings.autoSync = $('#syncToggle').checked; commit('Profile and settings saved.'); renderSettings(); };
$('#connectGfp').onclick = connectGfp; $('#saveWallet').onclick = saveWallet;
$('#syncNow').onclick = () => syncCloud(); $('#exportSave').onclick = () => downloadJson('pixel-bosses-complete-save.json', exportSave(state)); $('#importSaveBtn').onclick = () => chooseJson('save');
$('#filePicker').onchange = async (event) => {
  try {
    const file = event.target.files[0]; if (!file) return;
    const payload = JSON.parse(await file.text());
    if (pickerAction === 'binder') { const count = importBinder(payload, state); state = normalizeState(state); commit(`${count} new cards imported.`); closeModal(); renderBinder(); }
    else if (pickerAction === 'save') { state = importSave(payload); updateChrome(); renderSettings(); toast('Complete save restored.'); }
    else if (pickerAction === 'deck') { const deck = importDeck(payload, state); editingDeckId = deck.id; commit('Deck imported.'); renderDecks(); }
  } catch (error) { toast(error.message); }
};

const importDeckButton = document.createElement('button'); importDeckButton.textContent = 'Import Deck'; importDeckButton.onclick = () => chooseJson('deck'); $('#newDeck').after(importDeckButton);
updateChrome(); showScreen('home', false);
if (new URLSearchParams(location.search).get('payment') === 'success') { history.replaceState({}, '', location.pathname); syncCloud().then(() => toast('Payment received. Pixels will appear after webhook verification.')); }
else if (state.settings.autoSync) setTimeout(() => syncCloud(true), 700);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(() => {});

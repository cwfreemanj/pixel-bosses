import { BOSS_TYPES, CAMPAIGN_ZONES, ELEMENTS, GENERATOR_OFFERS, RARITIES } from './data.js';
import { makeCard, seededShuffle, simulateMatch, validateDeck } from './engine.js';
import { getStage, makeCampaignDeck, stagePage } from './campaign.js';
import { exportBinder, exportDeck, exportSave, importBinder, importDeck, importSave, loadState, saveState } from './storage.js';
import { PixelNetwork } from './network.js';

let state = loadState();
let currentScreen = 'home';
let screenHistory = [];
let campaignPage = Math.floor((state.campaignUnlocked - 1) / 10);
let elementFilter = '';
let advancedFilter = { rarity: '', minted: '', minPower: 0, minLevel: 0 };
let editingDeckId = null;
let battle = null;
let battleTimer = null;
let pickerAction = null;
const transientCards = new Map();
const network = new PixelNetwork(() => state);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]);
const rarity = (card) => RARITIES.find((r) => r.key === card.rarityKey) || RARITIES[0];
const element = (card) => ELEMENTS.find((e) => e.key === card.element) || ELEMENTS[0];
const selectedDeck = () => state.decks.find((d) => d.id === state.selectedDeckId) || state.decks[0];
const cardsForDeck = (deck) => deck?.cardIds.map((id) => state.binder.find((c) => c.cardHash === id)).filter(Boolean) || [];

function vibrate(pattern = 18) { if (state.settings.vibration) navigator.vibrate?.(pattern); }
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}
function commit(message) {
  saveState(state);
  updateChrome();
  if (message) toast(message);
  if (state.settings.autoSync && state.settings.serverUrl) setTimeout(() => syncCloud(true), 120);
}
function updateChrome() {
  $('#pixelBalance').textContent = state.pixels.toLocaleString();
  $('#campaignProgress').textContent = `Stage ${state.campaignUnlocked} unlocked`;
  $('#deckSummary').textContent = `${state.decks.length} saved deck${state.decks.length === 1 ? '' : 's'}`;
  $('#homeStats').innerHTML = `<div><b>${state.stats.wins}</b><small>Wins</small></div><div><b>${state.binder.length}</b><small>Cards</small></div><div><b>${state.campaignWins}</b><small>Stages</small></div>`;
}

const labels = { home: 'GENESIS CHAIN', campaign: 'CAMPAIGN MAP', quick: 'QUICK BATTLE', cards: 'CARD STUDIO', decks: 'DECK BUILDER', battle: 'LIVE DUEL', settings: 'SETTINGS' };
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
  if (name === 'settings') renderSettings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goBack() {
  if (currentScreen === 'battle' && battle && !battle.finished && !confirm('Leave this battle? Progress from it will be lost.')) return;
  stopBattle();
  showScreen(screenHistory.pop() || 'home', false);
}

function registerCards(cards) { cards.forEach((card) => transientCards.set(card.cardHash, card)); }
function cardMarkup(card, compact = false) {
  transientCards.set(card.cardHash, card);
  const r = rarity(card), e = element(card);
  return `<button class="boss-card" data-card-id="${card.cardHash}" style="--rarity:${r.color};--element:${e.color}" aria-label="${escapeHtml(card.name)}">
    ${card.variantKey === 'neon_variant' ? '<span class="variant-badge">NEON</span>' : ''}<canvas width="160" height="128"></canvas>
    <span class="boss-card-copy"><small>${r.name} • ${e.name.toUpperCase()}</small><b>${escapeHtml(card.name)}</b><span class="boss-card-footer"><span>LV ${card.level}</span><span>⚡ ${card.powerScore}</span></span></span>
  </button>`;
}
function paintCard(canvas, card) {
  const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; const rng = (() => { let s = parseInt(card.cardHash.slice(3, 11), 16); return () => ((s = Math.imul(s ^ s >>> 15, 1 | s) + 0x6d2b79f5) >>> 0) / 4294967296; })();
  ctx.imageSmoothingEnabled = false;
  const glow = card.colors?.glow || element(card).color, body = card.colors?.body || '#65708a', accent = card.colors?.accent || glow;
  const grad = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, 75); grad.addColorStop(0, glow + '66'); grad.addColorStop(1, '#080a1800'); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  const px = 6, ox = 32, oy = 5; const grid = Array.from({ length: 19 }, () => Array(16).fill(0));
  for (let y = 2; y < 18; y++) for (let x = 3; x < 8; x++) {
    const halfWidth = Math.max(1, Math.round(5 - Math.abs(y - 10) * .25));
    if (Math.abs(x - 6) <= halfWidth && rng() > .18) { grid[y][x] = rng() > .73 ? 2 : 1; grid[y][15 - x] = grid[y][x]; }
  }
  for (const [x, y] of [[4,1],[11,1],[3,2],[12,2],[5,7],[10,7]]) if (y < 19) grid[y][x] = 3;
  grid[7][5] = grid[7][10] = 3; grid[13][6] = grid[13][9] = 2;
  const colors = ['transparent', body, accent, glow];
  grid.forEach((row, y) => row.forEach((v, x) => { if (v) { ctx.fillStyle = colors[v]; ctx.shadowColor = v === 3 ? glow : 'transparent'; ctx.shadowBlur = v === 3 ? 8 : 0; ctx.fillRect(ox + x * px, oy + y * px, px, px); } }));
  ctx.shadowBlur = 0; ctx.strokeStyle = rarity(card).color; ctx.globalAlpha = .5; ctx.strokeRect(5.5, 5.5, w - 11, h - 11); ctx.globalAlpha = 1;
}
function paintCards(root = document) { $$('canvas', root).forEach((canvas) => { const id = canvas.closest('.boss-card')?.dataset.cardId; const card = transientCards.get(id) || state.binder.find((c) => c.cardHash === id); if (card) paintCard(canvas, card); }); }

function renderCampaign() {
  const maxPage = Math.max(campaignPage + 2, Math.floor((state.campaignUnlocked - 1) / 10) + 2, 6);
  $('#campaignPage').innerHTML = Array.from({ length: maxPage + 1 }, (_, page) => `<option value="${page}" ${page === campaignPage ? 'selected' : ''}>Stages ${page * 10 + 1}–${page * 10 + 10}</option>`).join('');
  const stages = stagePage(state.campaignUnlocked, campaignPage); const zone = stages[0].zone;
  $('#campaignZone').style.setProperty('--zone', zone.color);
  $('#campaignZone').innerHTML = `<span class="eyebrow">AREA ${campaignPage + 1}</span><h3>${escapeHtml(zone.name)}</h3><p>${escapeHtml(zone.subtitle)} Primary element: ${element({ element: zone.element }).name}.</p>`;
  $('#stageMap').style.setProperty('--zone', zone.color);
  $('#stageMap').innerHTML = stages.map((s) => `<button class="stage-node ${s.unlocked ? 'unlocked' : 'locked'} ${s.complete ? 'complete' : ''}" data-stage="${s.stage}" ${s.unlocked ? '' : 'disabled'}><span class="stage-status">${s.complete ? '✓' : s.unlocked ? '⚔' : '▣'}</span><b>${s.stage}</b><small>Lv ${s.recommendedLevel} • ${s.deckSize} cards</small><small>+${s.reward} Pixels</small></button>`).join('');
}

function renderDeckSelects() {
  const options = state.decks.map((d) => `<option value="${d.id}" ${d.id === state.selectedDeckId ? 'selected' : ''}>${escapeHtml(d.name)} (${cardsForDeck(d).length})</option>`).join('');
  $('#quickDeck').innerHTML = options || '<option>Create a deck first</option>';
}

function renderBinder() {
  $('#elementFilters').innerHTML = `<button class="chip ${!elementFilter ? 'active' : ''}" data-element="">All</button>` + ELEMENTS.map((e) => `<button class="chip ${elementFilter === e.key ? 'active' : ''}" data-element="${e.key}">${e.icon} ${e.name}</button>`).join('');
  const query = $('#cardSearch').value.trim().toLowerCase();
  let cards = state.binder.filter((c) => (!elementFilter || c.element === elementFilter)
    && (!advancedFilter.rarity || c.rarityKey === advancedFilter.rarity)
    && (!advancedFilter.minted || (advancedFilter.minted === 'minted' ? c.mintStatus !== 'UNMINTED' : c.mintStatus === 'UNMINTED'))
    && c.powerScore >= Number(advancedFilter.minPower || 0) && c.level >= Number(advancedFilter.minLevel || 0)
    && (!query || `${c.name} ${c.typeName} ${c.element} ${c.rarityKey} ${c.stats.affix}`.toLowerCase().includes(query)));
  const sort = $('#cardSort').value;
  cards.sort(sort === 'power' ? (a,b) => b.powerScore-a.powerScore : sort === 'rarity' ? (a,b) => b.rarityPower-a.rarityPower : sort === 'level' ? (a,b) => b.level-a.level : sort === 'name' ? (a,b) => a.name.localeCompare(b.name) : (a,b) => b.createdAt-a.createdAt);
  $('#binderCount').textContent = state.binder.length;
  $('#binderGrid').innerHTML = cards.length ? cards.map((c) => cardMarkup(c)).join('') : '<p class="muted">No cards match this filter.</p>';
  paintCards($('#binderGrid'));
}

function renderDecks() {
  $('#deckList').innerHTML = state.decks.length ? state.decks.map((d) => `<div class="deck-row"><div><b>${escapeHtml(d.name)}</b><small>${cardsForDeck(d).length} unique cards${d.id === state.selectedDeckId ? ' • SELECTED' : ''}</small></div><button data-select-deck="${d.id}">${d.id === state.selectedDeckId ? '✓' : 'Use'}</button><button data-edit-deck="${d.id}">Edit</button></div>`).join('') : '<p class="muted">No decks yet. Make your first deck.</p>';
  if (editingDeckId) renderDeckEditor(); else $('#deckEditor').classList.add('hidden');
}
function renderDeckEditor() {
  const deck = state.decks.find((d) => d.id === editingDeckId); if (!deck) { editingDeckId = null; return renderDecks(); }
  $('#deckEditor').classList.remove('hidden'); $('#deckName').value = deck.name; $('#deckCount').textContent = `${deck.cardIds.length} / 20`;
  $('#deckCards').innerHTML = deck.cardIds.map((id) => state.binder.find((c) => c.cardHash === id)).filter(Boolean).map((c) => miniCard(c, '−', 'remove-card')).join('') || '<p class="muted">Add at least five cards.</p>';
  const inDeck = new Set(deck.cardIds); $('#deckBinder').innerHTML = state.binder.filter((c) => !inDeck.has(c.cardHash)).map((c) => miniCard(c, '+', 'add-card')).join('') || '<p class="muted">Every binder card is already in this deck.</p>';
}
function miniCard(card, symbol, action) { const r = rarity(card), e = element(card); return `<div class="mini-card" style="--rarity:${r.color};--element:${e.color}"><span class="swatch"></span><div><b>${escapeHtml(card.name)}</b><small>${r.name} • ${e.name} • LV ${card.level}</small></div><button data-${action}="${card.cardHash}">${symbol}</button></div>`; }

function openModal(title, body) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = body; $('#modal').showModal(); paintCards($('#modalBody')); }
function closeModal() { $('#modal').close(); }
function showCard(card) {
  const s = card.stats, r = rarity(card), e = element(card);
  openModal(card.name, `<div class="card-detail">${cardMarkup(card)}<div><span class="eyebrow">${r.name} • ${e.name.toUpperCase()}</span><h3>${escapeHtml(card.typeName)}</h3><div class="detail-stats"><div>HP <b>${s.hp}</b></div><div>ATK <b>${s.atk}</b></div><div>DEF <b>${s.def}</b></div><div>MAG <b>${s.mag}</b></div><div>SPD <b>${s.spd}</b></div><div>POWER <b>${card.powerScore}</b></div></div><p class="detail-story">${escapeHtml(card.backstory)}</p><small class="muted">Hash: ${card.cardHash}<br>Mint status: ${card.mintStatus}</small></div></div><div class="modal-actions"><button id="exportOne">Export Card JSON</button><button disabled title="Minting adapter intentionally reserved">Mint (Soon)</button></div>`);
  $('#exportOne').onclick = () => downloadJson(`${slug(card.name)}.pixelcard.json`, { kind: 'pixel-bosses-card', schemaVersion: 2, card });
}

function openGenerator() {
  openModal('Generate a Boss', `<p class="muted">Your offer changes rarity odds and level range. Every pull creates one permanent, unique card.</p><div class="offer-grid">${GENERATOR_OFFERS.map((o,i) => `<button class="offer" data-offer="${i}" ${state.pixels < o.pixels ? 'disabled' : ''}><span class="pixel-gem"></span><div><b>${o.label}</b><small>${o.note}</small></div><strong>${o.pixels.toLocaleString()} ◇</strong></button>`).join('')}</div>`);
}
function generateFromOffer(index) {
  const offer = GENERATOR_OFFERS[index]; if (!offer || state.pixels < offer.pixels) return toast('Not enough Pixels.');
  state.pixels -= offer.pixels; state.stats.pixelsSpent += offer.pixels;
  let card; do { card = makeCard({ rarityBoost: offer.boost, levelRange: offer.level }); } while (state.binder.some((c) => c.cardHash === card.cardHash));
  state.binder.push(card); state.stats.cardsGenerated++; commit(); vibrate([20,25,35]); showCard(card); toast(`${rarity(card).name} card generated!`);
}

function openBinderTools() {
  openModal('Binder Import / Export', `<p class="muted">Binder or single-card imports merge unique hashes. Opponent and AI decks are never exposed or saved.</p><div class="modal-actions"><button id="exportBinderBtn">Export Binder</button><button id="importBinderBtn">Import Binder / Card</button><button id="clearBinderBtn" class="danger">Clear Binder & Decks</button></div>`);
  $('#exportBinderBtn').onclick = () => downloadJson('pixel-bosses-binder.json', exportBinder(state));
  $('#importBinderBtn').onclick = () => chooseJson('binder');
  $('#clearBinderBtn').onclick = () => { if (!confirm('Clear every local binder card and deck? Export a complete save first if you may need them.')) return; state.binder = []; state.decks = []; state.selectedDeckId = null; commit('Binder and decks cleared.'); closeModal(); renderBinder(); };
}

function openAdvancedFilters() {
  openModal('Advanced Binder Filters', `<label class="field"><span>Rarity</span><select id="filterRarity"><option value="">Any rarity</option>${RARITIES.map((r) => `<option value="${r.key}" ${advancedFilter.rarity === r.key ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label><label class="field"><span>Mint status</span><select id="filterMinted"><option value="">Any status</option><option value="unminted" ${advancedFilter.minted === 'unminted' ? 'selected' : ''}>Unminted</option><option value="minted" ${advancedFilter.minted === 'minted' ? 'selected' : ''}>Mint ready / minted</option></select></label><label class="field"><span>Minimum power</span><input id="filterPower" type="number" min="0" value="${advancedFilter.minPower || ''}"></label><label class="field"><span>Minimum level</span><input id="filterLevel" type="number" min="0" value="${advancedFilter.minLevel || ''}"></label><div class="modal-actions"><button id="clearFilters">Clear</button><button id="applyFilters" class="primary">Apply</button></div>`);
  $('#clearFilters').onclick = () => { advancedFilter = { rarity: '', minted: '', minPower: 0, minLevel: 0 }; closeModal(); renderBinder(); };
  $('#applyFilters').onclick = () => { advancedFilter = { rarity: $('#filterRarity').value, minted: $('#filterMinted').value, minPower: Number($('#filterPower').value || 0), minLevel: Number($('#filterLevel').value || 0) }; closeModal(); renderBinder(); };
}

function askDeckForStage(stage) {
  openModal(`Stage ${stage}: ${getStage(stage).zone.name}`, `<p>Select a legal deck. Campaign opponents use a 72% primary-element mix so one Cancel Wild card cannot sweep the whole deck.</p><div class="offer-grid">${state.decks.map((d) => { const cards = cardsForDeck(d), valid = validateDeck(cards).valid; return `<button class="offer" data-stage-deck="${d.id}" ${valid ? '' : 'disabled'}><div><b>${escapeHtml(d.name)}</b><small>${cards.length} cards${valid ? '' : ' • needs 5–20 unique cards'}</small></div><span>›</span></button>`; }).join('')}</div>`);
  $$('#modalBody [data-stage-deck]').forEach((btn) => btn.onclick = () => { state.selectedDeckId = btn.dataset.stageDeck; closeModal(); startLocalBattle({ stage }); });
}

function startLocalBattle({ stage = null } = {}) {
  const deck = cardsForDeck(selectedDeck()); const check = validateDeck(deck);
  if (!check.valid) return toast(check.duplicate ? 'Decks cannot contain duplicate cards.' : 'Choose a deck with 5–20 cards.');
  const info = stage ? getStage(stage) : null;
  const enemy = stage ? makeCampaignDeck(stage) : Array.from({ length: deck.length }, (_, i) => makeCard({ seed: `ai:${Date.now()}:${i}`, rarityBoost: 1, levelRange: [Math.max(1, Math.round(deck.reduce((s,c)=>s+c.level,0)/deck.length)-3), Math.round(deck.reduce((s,c)=>s+c.level,0)/deck.length)+4] }));
  const result = simulateMatch(deck, enemy, `${stage || 'ai'}:${Date.now()}`);
  battle = { kind: stage ? 'campaign' : 'ai', stage, info, playerDeck: deck, enemyDeck: enemy, result, index: 0, score: [0,0], finished: false, auto: false, rewarded: false };
  registerCards([...deck, ...enemy]); showScreen('battle'); renderBattleShell();
}

function renderBattleShell() {
  clearTimeout(battleTimer); $('#battleMode').textContent = battle.kind === 'pvp' ? 'ONLINE AUTO BATTLE' : battle.kind === 'campaign' ? `CAMPAIGN • STAGE ${battle.stage}` : 'AI BATTLE SIMULATOR';
  $('#battleTitle').textContent = battle.info?.zone.name || (battle.kind === 'pvp' ? battle.opponent || 'Finding challenger…' : 'Genesis Simulation');
  $('#opponentLabel').textContent = battle.kind === 'pvp' ? battle.opponent || 'CHALLENGER' : 'AI BOSS';
  $('#roundScore').textContent = '0 — 0'; $('#roundLabel').textContent = 'ROUND 0'; $('#battleProgressBar').style.width = '0%'; $('#battleReason').textContent = battle.kind === 'pvp' ? 'Connecting to the global duel queue…' : 'Ready to breach the Chain.'; $('#battleLog').innerHTML = '';
  $('#battleCardA').innerHTML = '<div class="muted">DECK READY</div>'; $('#battleCardB').innerHTML = '<div class="muted">SIGNAL HIDDEN</div>';
  if (battle.kind === 'pvp') $('#battleControls').innerHTML = '<button id="cancelQueue" class="danger">Cancel Queue</button>';
  else $('#battleControls').innerHTML = '<button id="nextRound" class="primary">Play Next Card</button><button id="autoBattle">Auto Battle</button><button id="shuffleBattle">Shuffle Both • 25 ◇</button>';
}
function showRound(round, index, total) {
  registerCards([round.cardA, round.cardB]); $('#battleCardA').innerHTML = cardMarkup(round.cardA); $('#battleCardB').innerHTML = cardMarkup(round.cardB); paintCards($('#battleArena'));
  battle.score = round.score; $('#roundScore').textContent = `${round.score[0]} — ${round.score[1]}`; $('#roundLabel').textContent = `ROUND ${index + 1} / ${total}`; $('#battleProgressBar').style.width = `${((index + 1) / total) * 100}%`;
  const cancel = round.duel.reasons[0]?.startsWith('CANCEL_WILD'); $('#battleReason').textContent = cancel ? `${round.duel.winner === 'A' ? round.cardA.element : round.cardB.element} triggered CANCEL WILD!` : `${round.duel.winner === 'A' ? round.cardA.name : round.cardB.name} wins on rarity, level, or power.`;
  if (state.settings.effects) { const arena = $('#battleArena'); arena.style.setProperty('--burst', element(round.duel.winner === 'A' ? round.cardA : round.cardB).color); arena.classList.remove('clash'); void arena.offsetWidth; arena.classList.add('clash'); }
  $('#fighterA').className = `fighter ${round.duel.winner === 'A' ? 'winner' : 'loser'}`; $('#fighterB').className = `fighter ${round.duel.winner === 'B' ? 'winner' : 'loser'}`;
  $('#battleLog').insertAdjacentHTML('afterbegin', `<div>R${index + 1}: ${escapeHtml(round.cardA.name)} vs ${escapeHtml(round.cardB.name)} — ${round.duel.winner === 'A' ? 'YOU' : 'OPPONENT'}</div>`); vibrate(round.duel.winner === 'A' ? 25 : [12,25,12]);
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
  battle.result = simulateMatch(seededShuffle(battle.playerDeck, seed), seededShuffle(battle.enemyDeck, seed + ':enemy'), seed); battle.index = 0; battle.score = [0,0]; commit('Both decks reshuffled for 25 Pixels.'); renderBattleShell();
}
function finishLocalBattle() {
  if (battle.finished) return showResultModal(); battle.finished = true; clearTimeout(battleTimer);
  const win = battle.result.winner === 'A', draw = battle.result.winner === 'DRAW';
  if (!battle.rewarded) {
    const reward = win ? (battle.info?.reward || 100) : draw ? 35 : 15; state.pixels += reward; state.stats.pixelsEarned += reward;
    if (win) { state.stats.wins++; if (battle.kind === 'ai') state.stats.aiWins++; if (battle.kind === 'campaign') { state.stats.campaignWins++; if (!state.campaignWins.includes(battle.stage)) state.campaignWins.push(battle.stage); if (battle.stage === state.campaignUnlocked) state.campaignUnlocked++; } }
    else if (draw) state.stats.draws++; else state.stats.losses++;
    battle.reward = reward; battle.rewarded = true; commit();
  }
  showResultModal();
}
function showResultModal() {
  const win = battle.kind === 'pvp' ? battle.pvpWinner === 'A' : battle.result.winner === 'A'; const draw = battle.kind === 'pvp' ? battle.pvpWinner === 'DRAW' : battle.result.winner === 'DRAW';
  openModal(win ? 'CHAIN BROKEN!' : draw ? 'SIGNAL DRAW' : 'BOSS PREVAILS', `<div style="text-align:center"><div class="boss-orb" style="margin:18px auto;width:100px;height:100px;font-size:38px">${win ? '★' : draw ? '◆' : '×'}</div><h3>${win ? 'Victory' : draw ? 'Draw' : 'Defeat'}</h3><p class="muted">Final score: ${battle.score[0]} — ${battle.score[1]}</p><h2 style="color:var(--cyan)">+${battle.reward || 0} Pixels</h2></div><div class="modal-actions"><button id="resultHome">Main Menu</button>${battle.kind !== 'pvp' ? '<button id="resultAgain" class="primary">Battle Again</button>' : ''}</div>`);
  $('#resultHome').onclick = () => { closeModal(); stopBattle(); showScreen('home'); };
  if ($('#resultAgain')) $('#resultAgain').onclick = () => { const stage = battle.stage; closeModal(); startLocalBattle({ stage }); };
}
function stopBattle() { clearTimeout(battleTimer); if (battle?.kind === 'pvp') { try { network.send({ type: 'queue_leave' }); } catch {} network.close(); } battle = null; }

async function startPvp() {
  const deck = cardsForDeck(selectedDeck()); if (!validateDeck(deck).valid) return toast('Choose a legal 5–20 card deck first.');
  battle = { kind: 'pvp', score: [0,0], index: 0, finished: false, opponent: 'Searching…', reward: 0 };
  showScreen('battle'); renderBattleShell();
  try { await network.connect(); network.send({ type: 'queue_join', playerId: state.playerId, name: state.playerName, deckId: selectedDeck().id, deck }); }
  catch (error) { toast(error.message); $('#battleReason').textContent = error.message; }
}
network.addEventListener('message', ({ detail: msg }) => {
  if (!battle || battle.kind !== 'pvp') return;
  if (msg.type === 'queued') $('#battleReason').textContent = `Waiting for a challenger • Queue position ${msg.position}`;
  if (msg.type === 'match_start') { battle.opponent = msg.opponent; battle.index = 0; $('#opponentLabel').textContent = msg.opponent; $('#battleTitle').textContent = `You vs ${msg.opponent}`; $('#battleReason').textContent = 'Opponent found. The server controls this auto-battle.'; }
  if (msg.type === 'match_round') { showRound(msg, battle.index, Math.max(1, cardsForDeck(selectedDeck()).length)); battle.index++; }
  if (msg.type === 'match_end') { battle.finished = true; battle.pvpWinner = msg.winner; battle.score = msg.score; battle.reward = msg.reward; state.pixels += msg.reward; state.stats.pixelsEarned += msg.reward; if (msg.winner === 'A') { state.stats.wins++; state.stats.pvpWins++; } else if (msg.winner === 'DRAW') state.stats.draws++; else state.stats.losses++; commit(); showResultModal(); network.close(); }
  if (msg.type === 'error') { toast(msg.message); $('#battleReason').textContent = msg.message; }
});

function renderSettings() { $('#playerName').value = state.playerName; $('#serverUrl').value = state.settings.serverUrl; $('#effectsToggle').checked = state.settings.effects; $('#vibrationToggle').checked = state.settings.vibration; $('#syncToggle').checked = state.settings.autoSync; }
async function syncCloud(silent = false) {
  try { const result = await network.sync(state); if (result.source === 'server') { state = result.state; saveState(state); updateChrome(); } if (!silent) toast(result.source === 'server' ? 'Newer cloud save restored.' : 'Cloud save is up to date.'); }
  catch (error) { if (!silent) toast(error.message); }
}

function slug(text) { return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pixel-bosses'; }
function downloadJson(name, payload) { const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function chooseJson(action) { pickerAction = action; $('#filePicker').value = ''; $('#filePicker').click(); }

document.addEventListener('click', (event) => {
  const go = event.target.closest('[data-go]'); if (go) return showScreen(go.dataset.go);
  const stage = event.target.closest('[data-stage]'); if (stage) return askDeckForStage(Number(stage.dataset.stage));
  const cardEl = event.target.closest('.boss-card'); if (cardEl && currentScreen !== 'battle') { const card = transientCards.get(cardEl.dataset.cardId) || state.binder.find((c) => c.cardHash === cardEl.dataset.cardId); if (card) showCard(card); return; }
  const offer = event.target.closest('[data-offer]'); if (offer) return generateFromOffer(Number(offer.dataset.offer));
  const select = event.target.closest('[data-select-deck]'); if (select) { state.selectedDeckId = select.dataset.selectDeck; commit('Battle deck selected.'); return renderDecks(); }
  const edit = event.target.closest('[data-edit-deck]'); if (edit) { editingDeckId = edit.dataset.editDeck; return renderDecks(); }
  const add = event.target.closest('[data-add-card]'); if (add) { const d = state.decks.find((x) => x.id === editingDeckId); if (d.cardIds.length >= 20) return toast('A deck can hold at most 20 cards.'); if (!d.cardIds.includes(add.dataset.addCard)) d.cardIds.push(add.dataset.addCard); return renderDeckEditor(); }
  const remove = event.target.closest('[data-remove-card]'); if (remove) { const d = state.decks.find((x) => x.id === editingDeckId); d.cardIds = d.cardIds.filter((id) => id !== remove.dataset.removeCard); return renderDeckEditor(); }
});

$('#backBtn').onclick = goBack; $('#closeModal').onclick = closeModal; $('#walletBtn').onclick = () => showScreen('cards');
$('#campaignPage').onchange = (e) => { campaignPage = Number(e.target.value); renderCampaign(); };
$('#quickDeck').onchange = (e) => { state.selectedDeckId = e.target.value; commit(); };
$('#aiMode').onclick = () => startLocalBattle({}); $('#pvpMode').onclick = startPvp;
$('#openGenerator').onclick = openGenerator; $('#binderTools').onclick = openBinderTools;
$('#advancedFilters').onclick = openAdvancedFilters;
$('#cardSearch').oninput = renderBinder; $('#cardSort').onchange = renderBinder;
$('#elementFilters').onclick = (e) => { const chip = e.target.closest('[data-element]'); if (chip) { elementFilter = chip.dataset.element; renderBinder(); } };
$('#newDeck').onclick = () => { const d = { id: crypto.randomUUID(), name: `Deck ${state.decks.length + 1}`, cardIds: [], createdAt: Date.now() }; state.decks.push(d); editingDeckId = d.id; renderDecks(); };
$('#saveDeck').onclick = () => { const d = state.decks.find((x) => x.id === editingDeckId); d.name = $('#deckName').value.trim() || 'Untitled Deck'; const check = validateDeck(cardsForDeck(d)); if (!check.valid) return toast('Save 5–20 unique cards in this deck.'); state.selectedDeckId = d.id; commit('Deck saved and selected.'); renderDecks(); };
$('#deleteDeck').onclick = () => { if (state.decks.length <= 1) return toast('Keep at least one deck.'); if (!confirm('Delete this deck? Your binder cards will stay.')) return; state.decks = state.decks.filter((d) => d.id !== editingDeckId); if (state.selectedDeckId === editingDeckId) state.selectedDeckId = state.decks[0].id; editingDeckId = null; commit('Deck deleted.'); renderDecks(); };
$('#exportDeck').onclick = () => { const d = state.decks.find((x) => x.id === editingDeckId); downloadJson(`${slug(d.name)}.pixeldeck.json`, exportDeck(d, state)); };
$('#battleControls').onclick = (e) => { if (e.target.id === 'nextRound') nextLocalRound(); if (e.target.id === 'autoBattle') toggleAutoBattle(); if (e.target.id === 'shuffleBattle') shuffleBattle(); if (e.target.id === 'cancelQueue') { stopBattle(); showScreen('quick'); } };
$('#saveSettings').onclick = () => { state.playerName = $('#playerName').value.trim() || 'Pixel Pilot'; state.settings.serverUrl = $('#serverUrl').value.trim().replace(/\/$/, ''); state.settings.effects = $('#effectsToggle').checked; state.settings.vibration = $('#vibrationToggle').checked; state.settings.autoSync = $('#syncToggle').checked; commit('Settings saved.'); };
$('#syncNow').onclick = () => syncCloud(); $('#exportSave').onclick = () => downloadJson('pixel-bosses-complete-save.json', exportSave(state)); $('#importSaveBtn').onclick = () => chooseJson('save');
$('#filePicker').onchange = async (e) => { try { const payload = JSON.parse(await e.target.files[0].text()); if (pickerAction === 'binder') { const count = importBinder(payload, state); commit(`${count} new cards imported.`); closeModal(); renderBinder(); } else if (pickerAction === 'save') { state = importSave(payload); updateChrome(); renderSettings(); toast('Complete save restored.'); } else if (pickerAction === 'deck') { const d = importDeck(payload, state); editingDeckId = d.id; commit('Deck imported.'); renderDecks(); } } catch (error) { toast(error.message); } };

// Deck-file import is intentionally exposed only inside Deck Builder; opponent decks never enter the binder.
const importDeckButton = document.createElement('button'); importDeckButton.textContent = 'Import Deck'; importDeckButton.onclick = () => chooseJson('deck'); $('#newDeck').after(importDeckButton);

updateChrome(); showScreen('home', false);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(() => {});

import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import pg from 'pg';
import Stripe from 'stripe';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { resolveDuel, seededShuffle } from '../client/js/engine.js';

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 3000);
const publicUrl = (process.env.PUBLIC_SERVER_URL || 'https://web-production-efaa4b.up.railway.app').replace(/\/$/, '');
const origins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((value) => value.trim()).filter(Boolean);
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const stripePackages = {
  spark: { pixels: 500, priceId: process.env.STRIPE_PRICE_SPARK },
  boss: { pixels: 2800, priceId: process.env.STRIPE_PRICE_BOSS },
  rift: { pixels: 6500, priceId: process.env.STRIPE_PRICE_RIFT },
  cosmos: { pixels: 15000, priceId: process.env.STRIPE_PRICE_COSMOS }
};

app.use(cors({ origin: origins.includes('*') ? true : origins }));

const memoryProfiles = new Map();
const memoryListings = new Map();
const memoryMessages = [];
const memoryReceipts = new Map();
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } });
  await pool.query(`CREATE TABLE IF NOT EXISTS pixel_profiles (
    player_id TEXT PRIMARY KEY, token TEXT NOT NULL, state JSONB NOT NULL, updated_at BIGINT NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pixel_listings (
    listing_id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at BIGINT NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pixel_messages (
    message_id TEXT PRIMARY KEY, room TEXT NOT NULL, data JSONB NOT NULL, created_at BIGINT NOT NULL
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS pixel_messages_room_time ON pixel_messages(room, created_at DESC)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pixel_receipts (
    receipt_id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at BIGINT NOT NULL
  )`);
}

async function getProfile(playerId) {
  if (!pool) return memoryProfiles.get(playerId) || null;
  const result = await pool.query('SELECT token, state, updated_at FROM pixel_profiles WHERE player_id=$1', [playerId]);
  return result.rows[0] || null;
}
async function putProfile(playerId, token, state, updatedAt = Date.now()) {
  const record = { token, state, updated_at: updatedAt };
  if (!pool) { memoryProfiles.set(playerId, record); return record; }
  await pool.query(`INSERT INTO pixel_profiles(player_id, token, state, updated_at) VALUES($1,$2,$3,$4)
    ON CONFLICT(player_id) DO UPDATE SET state=$3, updated_at=$4 WHERE pixel_profiles.token=$2`, [playerId, token, state, updatedAt]);
  return record;
}
async function allProfiles() {
  if (!pool) return [...memoryProfiles.entries()].map(([player_id, record]) => ({ player_id, ...record }));
  return (await pool.query('SELECT player_id, token, state, updated_at FROM pixel_profiles')).rows;
}
async function findProfile(target) {
  const needle = String(target || '').trim().replace(/^@/, '').toLowerCase();
  return (await allProfiles()).find((record) => record.player_id.toLowerCase() === needle || String(record.state?.profile?.tag || '').toLowerCase() === needle) || null;
}
async function getListing(id) {
  if (!pool) return memoryListings.get(id) || null;
  return (await pool.query('SELECT data FROM pixel_listings WHERE listing_id=$1', [id])).rows[0]?.data || null;
}
async function putListing(listing) {
  listing.updatedAt = Date.now();
  if (!pool) { memoryListings.set(listing.id, listing); return listing; }
  await pool.query(`INSERT INTO pixel_listings(listing_id, data, updated_at) VALUES($1,$2,$3)
    ON CONFLICT(listing_id) DO UPDATE SET data=$2, updated_at=$3`, [listing.id, listing, listing.updatedAt]);
  return listing;
}
async function allListings() {
  if (!pool) return [...memoryListings.values()];
  return (await pool.query('SELECT data FROM pixel_listings ORDER BY updated_at DESC')).rows.map((row) => row.data);
}
async function putMessage(message) {
  if (!pool) { memoryMessages.push(message); if (memoryMessages.length > 4000) memoryMessages.splice(0, memoryMessages.length - 4000); return; }
  await pool.query('INSERT INTO pixel_messages(message_id, room, data, created_at) VALUES($1,$2,$3,$4)', [message.id, message.room, message, message.createdAt]);
}
async function listMessages(room, limit = 100) {
  if (!pool) return memoryMessages.filter((message) => message.room === room).slice(-limit);
  const rows = (await pool.query('SELECT data FROM pixel_messages WHERE room=$1 ORDER BY created_at DESC LIMIT $2', [room, limit])).rows;
  return rows.map((row) => row.data).reverse();
}
async function hasReceipt(id) {
  if (!pool) return memoryReceipts.has(id);
  return Boolean((await pool.query('SELECT 1 FROM pixel_receipts WHERE receipt_id=$1', [id])).rowCount);
}
async function putReceipt(id, data) {
  if (!pool) { memoryReceipts.set(id, data); return; }
  await pool.query('INSERT INTO pixel_receipts(receipt_id, data, created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [id, data, Date.now()]);
}

function cleanState(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid state');
  const state = structuredClone(input);
  state.schemaVersion = 3;
  state.pixels = Math.max(0, Math.min(1_000_000_000, Number(state.pixels) || 0));
  state.binder = Array.isArray(state.binder) ? state.binder.filter((card) => card?.cardHash).slice(0, 5000) : [];
  state.decks = Array.isArray(state.decks) ? state.decks.slice(0, 200) : [];
  state.campaignWins = Array.isArray(state.campaignWins) ? [...new Set(state.campaignWins.map(Number).filter(Number.isFinite))] : [];
  state.items = Array.isArray(state.items) ? [...new Map(state.items.map((item) => [item.id, item])).values()] : [];
  state.profile = { icon: '☠', tag: `PILOT-${String(state.playerId || '').slice(0, 4)}`, bio: '', walletAddress: null, gfpConnected: false, ...(state.profile || {}) };
  state.stats = { ...(state.stats || {}) };
  state.social = { friends: [], friendRequests: [], communities: ['genesis'], ...(state.social || {}) };
  state.social.friends = [...new Set(state.social.friends || [])];
  state.social.friendRequests = [...new Set(state.social.friendRequests || [])];
  delete state.settings?.serverUrl;
  delete state.activeBattle;
  return state;
}
function removeCardFromDecks(state, cardHash) { state.decks.forEach((deck) => { deck.cardIds = deck.cardIds.filter((id) => id !== cardHash); }); }
function publicProfile(playerId, state) { return { playerId, name: state.playerName || 'Pixel Pilot', tag: state.profile?.tag, icon: state.profile?.icon || '☠', bio: state.profile?.bio || '' }; }
function getAuth(req) { return { playerId: String(req.headers['x-player-id'] || req.body?.playerId || ''), token: String(req.headers['x-player-token'] || req.body?.token || '') }; }
async function authenticate(req) {
  const { playerId, token } = getAuth(req);
  if (!playerId || !token) throw Object.assign(new Error('Player authentication is required.'), { status: 401 });
  const record = await getProfile(playerId);
  if (!record || record.token !== token) throw Object.assign(new Error('Sync this profile before using online features.'), { status: 403 });
  return { playerId, token, record, state: cleanState(record.state) };
}
function route(handler) {
  return async (req, res) => { try { await handler(req, res); } catch (error) { console.error(error); res.status(error.status || 500).json({ error: error.message || 'Server error' }); } };
}
let operation = Promise.resolve();
function locked(task) { const next = operation.then(task, task); operation = next.catch(() => {}); return next; }

// Stripe must receive the exact raw request body for signature verification.
app.post('/api/shop/webhook', express.raw({ type: 'application/json' }), route(async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe webhook is not configured.' });
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  if (event.type === 'checkout.session.completed' && !await hasReceipt(event.id)) {
    const session = event.data.object; const packageId = session.metadata?.packageId; const playerId = session.metadata?.playerId; const pack = stripePackages[packageId];
    if (pack && playerId && session.payment_status === 'paid') {
      const record = await getProfile(playerId);
      if (record) { const state = cleanState(record.state); state.pixels += pack.pixels; state.stats.pixelsPurchased = Number(state.stats.pixelsPurchased || 0) + pack.pixels; await putProfile(playerId, record.token, state); }
    }
    await putReceipt(event.id, { type: event.type, playerId, packageId, sessionId: session.id });
  }
  res.json({ received: true });
}));

app.use(express.json({ limit: '5mb' }));
const queue = [];
app.get('/health', (_req, res) => res.json({ ok: true, service: 'pixel-bosses', version: '2.0.0', queue: queue.length, database: Boolean(pool), market: true, chat: true, minting: Boolean(process.env.MINT_CONTRACT_ADDRESS) }));
app.post('/api/profile/sync', route(async (req, res) => {
  const { playerId, token, state, updatedAt = Date.now() } = req.body || {};
  if (!playerId || !token || !state) return res.status(400).json({ error: 'playerId, token, and state are required' });
  const current = await getProfile(playerId);
  if (current && current.token !== token) return res.status(403).json({ error: 'Profile token mismatch' });
  if (current && Number(current.updated_at) > Number(updatedAt)) return res.json({ state: current.state, updatedAt: Number(current.updated_at), source: 'server' });
  const safe = cleanState(state); await putProfile(playerId, token, safe, Number(updatedAt));
  res.json({ state: safe, updatedAt: Number(updatedAt), source: 'client' });
}));

const leaderboardStats = {
  scoreEarned: (state) => state.stats?.scoreEarned,
  wins: (state) => state.stats?.wins,
  losses: (state) => state.stats?.losses,
  pvpWins: (state) => state.stats?.pvpWins,
  pvpLosses: (state) => state.stats?.pvpLosses,
  campaignWins: (state) => state.campaignWins?.length,
  cardsCollected: (state) => state.binder?.length,
  cardTypes: (state) => new Set((state.binder || []).map((card) => card.type)).size,
  pixelsEarned: (state) => state.stats?.pixelsEarned,
  cardsGenerated: (state) => state.stats?.cardsGenerated,
  tradesCompleted: (state) => state.stats?.tradesCompleted,
  cardsMinted: (state) => state.stats?.cardsMinted,
  loreFound: (state) => state.items?.length,
  bestWinStreak: (state) => state.stats?.bestWinStreak
};
app.get('/api/leaderboard', route(async (req, res) => {
  const key = String(req.query.stat || 'scoreEarned'); const metric = leaderboardStats[key];
  if (!metric) return res.status(400).json({ error: 'Unknown leaderboard category.' });
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 100));
  const leaders = (await allProfiles()).map((record) => ({ ...publicProfile(record.player_id, record.state), value: Math.max(0, Number(metric(record.state)) || 0) })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, limit);
  res.json({ stat: key, leaders });
}));

async function saveAuth(auth) { auth.state.updatedAt = Date.now(); await putProfile(auth.playerId, auth.token, auth.state, auth.state.updatedAt); }
async function refundOffer(offer) {
  const bidder = await getProfile(offer.bidderId); if (!bidder) return;
  const state = cleanState(bidder.state);
  if (offer.amount) state.pixels += Number(offer.amount);
  if (offer.pixels) state.pixels += Number(offer.pixels);
  if (offer.cardHash) { const card = state.binder.find((entry) => entry.cardHash === offer.cardHash); if (card) card.tradeLocked = false; }
  await putProfile(offer.bidderId, bidder.token, state);
}
async function transferListing(listing, buyerId, payment = 0, offeredCardHash = null) {
  const sellerRecord = await getProfile(listing.sellerId); const buyerRecord = await getProfile(buyerId);
  if (!sellerRecord || !buyerRecord) throw new Error('Trade profile is unavailable.');
  const seller = cleanState(sellerRecord.state), buyer = cleanState(buyerRecord.state);
  const cardIndex = seller.binder.findIndex((card) => card.cardHash === listing.card.cardHash);
  if (cardIndex < 0) throw new Error('The listed card is no longer available.');
  const [card] = seller.binder.splice(cardIndex, 1); removeCardFromDecks(seller, card.cardHash); card.tradeLocked = false;
  if (buyer.binder.some((entry) => entry.cardHash === card.cardHash)) throw new Error('Buyer already owns this unique card.');
  buyer.binder.push(card); seller.pixels += Number(payment || 0);
  if (offeredCardHash) {
    const offerIndex = buyer.binder.findIndex((entry) => entry.cardHash === offeredCardHash);
    if (offerIndex < 0) throw new Error('Offered card is unavailable.');
    const [offered] = buyer.binder.splice(offerIndex, 1); removeCardFromDecks(buyer, offered.cardHash); offered.tradeLocked = false; seller.binder.push(offered);
  }
  seller.stats.tradesCompleted = Number(seller.stats.tradesCompleted || 0) + 1; seller.stats.marketSales = Number(seller.stats.marketSales || 0) + 1;
  buyer.stats.tradesCompleted = Number(buyer.stats.tradesCompleted || 0) + 1;
  await putProfile(listing.sellerId, sellerRecord.token, seller); await putProfile(buyerId, buyerRecord.token, buyer);
  return { seller, buyer };
}
async function closeListing(listing, status, acceptedOfferId = null) {
  for (const offer of listing.offers || []) if (offer.id !== acceptedOfferId) await refundOffer(offer);
  if (listing.highestBid && listing.highestBid.id !== acceptedOfferId) await refundOffer(listing.highestBid);
  listing.status = status; listing.closedAt = Date.now(); await putListing(listing);
}
async function settleExpired() {
  for (const listing of await allListings()) {
    if (listing.status !== 'active' || listing.expiresAt > Date.now()) continue;
    await locked(async () => {
      const fresh = await getListing(listing.id); if (!fresh || fresh.status !== 'active' || fresh.expiresAt > Date.now()) return;
      if (fresh.mode === 'auction' && fresh.highestBid) { await transferListing(fresh, fresh.highestBid.bidderId, fresh.highestBid.amount); fresh.status = 'sold'; fresh.closedAt = Date.now(); await putListing(fresh); }
      else {
        const seller = await getProfile(fresh.sellerId); if (seller) { const sellerState = cleanState(seller.state); const card = sellerState.binder.find((entry) => entry.cardHash === fresh.card.cardHash); if (card) card.tradeLocked = false; await putProfile(fresh.sellerId, seller.token, sellerState); }
        await closeListing(fresh, 'expired');
      }
    });
  }
}
app.get('/api/market/listings', route(async (req, res) => {
  await settleExpired(); const mode = String(req.query.mode || ''); const search = String(req.query.search || '').trim().toLowerCase();
  const listings = (await allListings()).filter((listing) => listing.status === 'active' && (!mode || listing.mode === mode) && (!search || `${listing.card?.name} ${listing.card?.typeName} ${listing.card?.element} ${listing.sellerTag} ${listing.sellerName}`.toLowerCase().includes(search))).sort((a, b) => a.expiresAt - b.expiresAt).slice(0, 250);
  res.json({ listings });
}));
app.post('/api/market/listings', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const { cardHash, mode, tradeRequest = '' } = req.body || {};
  if (!['fixed', 'auction', 'trade'].includes(mode)) return res.status(400).json({ error: 'Choose fixed, auction, or card trade.' });
  const card = auth.state.binder.find((entry) => entry.cardHash === cardHash); if (!card || card.tradeLocked) return res.status(409).json({ error: 'Card is unavailable or already listed.' });
  const durationHours = Math.max(1, Math.min(168, Number(req.body.durationHours) || 24)); const price = Math.max(1, Math.floor(Number(req.body.price) || 0));
  if (mode !== 'trade' && !price) return res.status(400).json({ error: 'A positive price or minimum bid is required.' });
  card.tradeLocked = true; removeCardFromDecks(auth.state, cardHash); await saveAuth(auth);
  const listing = { id: randomUUID(), sellerId: auth.playerId, sellerName: auth.state.playerName, sellerTag: auth.state.profile.tag, card: structuredClone(card), mode, price: mode === 'fixed' ? price : 0, minBid: mode === 'auction' ? price : 0, tradeRequest: String(tradeRequest).slice(0, 120), offers: [], highestBid: null, status: 'active', createdAt: Date.now(), expiresAt: Date.now() + durationHours * 3600000 };
  await putListing(listing); res.status(201).json({ listing, state: auth.state, message: 'Card listed.' });
})));
app.delete('/api/market/listings/:id', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const listing = await getListing(req.params.id); if (!listing || listing.status !== 'active') return res.status(404).json({ error: 'Listing not found.' }); if (listing.sellerId !== auth.playerId) return res.status(403).json({ error: 'Only the seller can cancel this listing.' });
  const card = auth.state.binder.find((entry) => entry.cardHash === listing.card.cardHash); if (card) card.tradeLocked = false; await saveAuth(auth); await closeListing(listing, 'cancelled'); res.json({ state: auth.state, message: 'Listing cancelled and active bids refunded.' });
})));
app.post('/api/market/listings/:id/buy', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const listing = await getListing(req.params.id); if (!listing || listing.status !== 'active' || listing.mode !== 'fixed' || listing.expiresAt <= Date.now()) return res.status(404).json({ error: 'Fixed listing is no longer active.' }); if (listing.sellerId === auth.playerId) return res.status(400).json({ error: 'You cannot buy your own listing.' }); if (auth.state.pixels < listing.price) return res.status(400).json({ error: 'Not enough Pixels.' });
  auth.state.pixels -= listing.price; await putProfile(auth.playerId, auth.token, auth.state); const result = await transferListing(listing, auth.playerId, listing.price); listing.status = 'sold'; listing.closedAt = Date.now(); await putListing(listing); res.json({ state: result.buyer, message: 'Card purchased.' });
})));
app.post('/api/market/listings/:id/bid', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const listing = await getListing(req.params.id); if (!listing || listing.status !== 'active' || listing.mode !== 'auction' || listing.expiresAt <= Date.now()) return res.status(404).json({ error: 'Auction is no longer active.' }); if (listing.sellerId === auth.playerId) return res.status(400).json({ error: 'You cannot bid on your own listing.' });
  const amount = Math.floor(Number(req.body.amount)); const minimum = Math.max(listing.minBid, Number(listing.highestBid?.amount || 0) + 1); if (amount < minimum) return res.status(400).json({ error: `Bid must be at least ${minimum} Pixels.` });
  const reclaimable = listing.highestBid?.bidderId === auth.playerId ? Number(listing.highestBid.amount) : 0; if (auth.state.pixels + reclaimable < amount) return res.status(400).json({ error: 'Not enough Pixels.' });
  if (listing.highestBid) await refundOffer(listing.highestBid); const refreshed = await getProfile(auth.playerId); auth.state = cleanState(refreshed.state);
  auth.state.pixels -= amount; await saveAuth(auth); listing.highestBid = { id: randomUUID(), bidderId: auth.playerId, bidderName: auth.state.playerName, bidderTag: auth.state.profile.tag, amount, createdAt: Date.now() }; await putListing(listing); res.json({ state: auth.state, message: 'Bid placed. The prior highest bid was refunded.' });
})));
app.post('/api/market/listings/:id/offer', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const listing = await getListing(req.params.id); if (!listing || listing.status !== 'active' || listing.mode !== 'trade' || listing.expiresAt <= Date.now()) return res.status(404).json({ error: 'Trade listing is no longer active.' }); if (listing.sellerId === auth.playerId) return res.status(400).json({ error: 'You cannot offer on your own listing.' });
  const card = auth.state.binder.find((entry) => entry.cardHash === req.body.cardHash); const pixels = Math.max(0, Math.floor(Number(req.body.pixels) || 0)); if (!card || card.tradeLocked) return res.status(409).json({ error: 'Offered card is unavailable.' }); if (auth.state.pixels < pixels) return res.status(400).json({ error: 'Not enough Pixels for this offer.' });
  card.tradeLocked = true; removeCardFromDecks(auth.state, card.cardHash); auth.state.pixels -= pixels; await saveAuth(auth);
  listing.offers.push({ id: randomUUID(), bidderId: auth.playerId, bidderName: auth.state.playerName, bidderTag: auth.state.profile.tag, cardHash: card.cardHash, card: structuredClone(card), pixels, createdAt: Date.now() }); await putListing(listing); res.json({ state: auth.state, message: 'Trade offer sent and escrowed.' });
})));
app.post('/api/market/listings/:id/accept', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const listing = await getListing(req.params.id); if (!listing || listing.status !== 'active' || listing.sellerId !== auth.playerId) return res.status(404).json({ error: 'Seller listing not found.' }); const offer = (listing.offers || []).find((entry) => entry.id === req.body.offerId); if (!offer) return res.status(404).json({ error: 'Offer not found.' });
  const result = await transferListing(listing, offer.bidderId, offer.pixels, offer.cardHash); await closeListing(listing, 'traded', offer.id); res.json({ state: result.seller, message: 'Trade completed; all other offers were refunded.' });
})));

app.get('/api/social/friends', route(async (req, res) => {
  const auth = await authenticate(req); const records = await allProfiles(); const byId = new Map(records.map((record) => [record.player_id, record.state]));
  res.json({ friends: auth.state.social.friends.map((id) => byId.has(id) ? publicProfile(id, byId.get(id)) : null).filter(Boolean), requests: auth.state.social.friendRequests.map((id) => byId.has(id) ? publicProfile(id, byId.get(id)) : null).filter(Boolean) });
}));
app.post('/api/social/friends/request', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const target = await findProfile(req.body.target); if (!target) return res.status(404).json({ error: 'Player tag or ID was not found.' }); if (target.player_id === auth.playerId) return res.status(400).json({ error: 'You cannot add yourself.' });
  const targetState = cleanState(target.state); if (!targetState.social.friendRequests.includes(auth.playerId) && !targetState.social.friends.includes(auth.playerId)) targetState.social.friendRequests.push(auth.playerId); await putProfile(target.player_id, target.token, targetState); res.json({ message: 'Friend request sent.' });
})));
app.post('/api/social/friends/respond', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const otherId = String(req.body.playerId); if (!auth.state.social.friendRequests.includes(otherId)) return res.status(404).json({ error: 'Friend request not found.' }); auth.state.social.friendRequests = auth.state.social.friendRequests.filter((id) => id !== otherId);
  if (req.body.accept) { const other = await getProfile(otherId); if (!other) return res.status(404).json({ error: 'Player no longer exists.' }); const otherState = cleanState(other.state); auth.state.social.friends = [...new Set([...auth.state.social.friends, otherId])]; otherState.social.friends = [...new Set([...otherState.social.friends, auth.playerId])]; await putProfile(otherId, other.token, otherState); }
  await saveAuth(auth); res.json({ state: auth.state, message: req.body.accept ? 'Friend added.' : 'Request declined.' });
})));
app.delete('/api/social/friends/:id', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const otherId = String(req.params.id); auth.state.social.friends = auth.state.social.friends.filter((id) => id !== otherId); await saveAuth(auth); const other = await getProfile(otherId); if (other) { const otherState = cleanState(other.state); otherState.social.friends = otherState.social.friends.filter((id) => id !== auth.playerId); await putProfile(otherId, other.token, otherState); } res.json({ state: auth.state, message: 'Friend removed.' });
})));

app.post('/api/integrations/getfirstpage/connect', route(async (req, res) => {
  const auth = await authenticate(req); if (!process.env.GFP_VERIFY_URL) return res.status(503).json({ error: 'GetFirstPage verification is not configured on Railway yet.' });
  const response = await fetch(process.env.GFP_VERIFY_URL, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.GFP_API_TOKEN ? { authorization: `Bearer ${process.env.GFP_API_TOKEN}` } : {}) }, body: JSON.stringify({ code: String(req.body.code || ''), pixelBossesPlayerId: auth.playerId }) });
  const result = await response.json().catch(() => ({})); if (!response.ok || result.ok === false) return res.status(400).json({ error: result.error || 'GetFirstPage code could not be verified.' });
  auth.state.profile.gfpConnected = true; auth.state.profile.gfpMemberId = String(result.memberId || result.id || 'verified'); await saveAuth(auth); res.json({ state: auth.state });
}));
app.post('/api/shop/checkout', route(async (req, res) => {
  const auth = await authenticate(req); const pack = stripePackages[req.body.packageId]; if (!pack) return res.status(400).json({ error: 'Unknown Pixel package.' }); if (!stripe || !pack.priceId) return res.status(503).json({ error: 'Stripe Checkout is not configured on Railway yet.' });
  const session = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ price: pack.priceId, quantity: 1 }], success_url: `${publicUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${publicUrl}/?payment=cancelled`, metadata: { playerId: auth.playerId, packageId: req.body.packageId }, client_reference_id: auth.playerId });
  res.json({ url: session.url });
}));
app.post('/api/mint/request', route(async (req, res) => locked(async () => {
  const auth = await authenticate(req); const card = auth.state.binder.find((entry) => entry.cardHash === req.body.cardHash); if (!card || card.tradeLocked) return res.status(409).json({ error: 'Card is unavailable for minting.' }); if (card.mintStatus === 'MINTED') return res.status(409).json({ error: 'Card is already minted.' }); if (!/^0x[a-fA-F0-9]{40}$/.test(auth.state.profile.walletAddress || '')) return res.status(400).json({ error: 'Add a valid Polygon wallet address first.' }); if (!String(req.body.tokenUri || '').startsWith('ipfs://')) return res.status(400).json({ error: 'A pinned ipfs:// metadata URI is required.' });
  const required = ['MINT_RPC_URL', 'MINT_PRIVATE_KEY', 'MINT_CONTRACT_ADDRESS']; if (required.some((key) => !process.env[key])) return res.status(503).json({ error: 'Minting is not configured on Railway yet.' });
  const provider = new JsonRpcProvider(process.env.MINT_RPC_URL); const wallet = new Wallet(process.env.MINT_PRIVATE_KEY, provider); const contract = new Contract(process.env.MINT_CONTRACT_ADDRESS, ['function nextTokenId() view returns (uint256)', 'function mintCard(address to,string cardHash,string tokenURI) returns (uint256)'], wallet);
  const tokenId = await contract.nextTokenId(); const transaction = await contract.mintCard(auth.state.profile.walletAddress, card.cardHash, req.body.tokenUri); await transaction.wait(Number(process.env.MINT_CONFIRMATIONS || 1));
  card.mintStatus = 'MINTED'; card.txHash = transaction.hash; card.tokenId = tokenId.toString(); card.tokenUri = req.body.tokenUri; auth.state.stats.cardsMinted = Number(auth.state.stats.cardsMinted || 0) + 1; await saveAuth(auth); res.json({ state: auth.state, txHash: transaction.hash, tokenId: tokenId.toString() });
})));

function validDeck(deck) {
  if (!Array.isArray(deck) || deck.length < 5 || deck.length > 20) return false;
  const ids = deck.map((card) => card.cardHash || card.id); return ids.every(Boolean) && new Set(ids).size === ids.length && deck.every((card) => !card.tradeLocked);
}
const wss = new WebSocketServer({ server, path: '/multiplayer' });
const sockets = new Set();
const send = (ws, payload) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(payload));
const removeQueued = (ws) => { const index = queue.findIndex((item) => item.ws === ws); if (index >= 0) queue.splice(index, 1); };
function runMatch(a, b) {
  const matchId = randomUUID(); const seed = `${matchId}:${Date.now()}`; const deckA = seededShuffle(a.deck, `${seed}:a`); const deckB = seededShuffle(b.deck, `${seed}:b`); const rounds = []; let winsA = 0, winsB = 0; const total = Math.min(deckA.length, deckB.length);
  for (let index = 0; index < total; index++) { const duel = resolveDuel(deckA[index], deckB[index], `${seed}:${index}`); if (duel.winner === 'A') winsA++; else winsB++; rounds.push({ index: index + 1, total, cardA: deckA[index], cardB: deckB[index], duel, score: [winsA, winsB] }); }
  const winner = winsA === winsB ? 'DRAW' : winsA > winsB ? 'A' : 'B'; send(a.ws, { type: 'match_start', matchId, seed, opponent: b.name }); send(b.ws, { type: 'match_start', matchId, seed, opponent: a.name });
  rounds.forEach((round, index) => setTimeout(() => { send(a.ws, { type: 'match_round', matchId, ...round }); send(b.ws, { type: 'match_round', matchId, ...round, cardA: round.cardB, cardB: round.cardA, duel: { ...round.duel, winner: round.duel.winner === 'A' ? 'B' : 'A' }, score: [round.score[1], round.score[0]] }); }, 700 * (index + 1)));
  setTimeout(() => { send(a.ws, { type: 'match_end', matchId, winner, score: [winsA, winsB], reward: winner === 'A' ? 225 : winner === 'DRAW' ? 100 : 50 }); send(b.ws, { type: 'match_end', matchId, winner: winner === 'A' ? 'B' : winner === 'B' ? 'A' : 'DRAW', score: [winsB, winsA], reward: winner === 'B' ? 225 : winner === 'DRAW' ? 100 : 50 }); }, 700 * (rounds.length + 1));
}
async function canonicalRoom(ws, requested) {
  const room = String(requested || 'global').slice(0, 100); if (room === 'global') return room; if (['community:genesis', 'community:cosmos'].includes(room)) return room;
  if (room.startsWith('private:')) { const targetId = room.slice(8); const record = await getProfile(ws.playerId); if (!record?.state?.social?.friends?.includes(targetId)) throw new Error('Private chat is available to friends only.'); return `private:${[ws.playerId, targetId].sort().join(':')}`; }
  throw new Error('Unknown chat room.');
}
wss.on('connection', (ws) => {
  sockets.add(ws); ws.id = randomUUID(); ws.lastChatAt = 0; send(ws, { type: 'connected', socketId: ws.id });
  ws.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'social_auth') {
        ws.authPromise = (async () => { const record = await getProfile(String(message.playerId)); if (!record || record.token !== String(message.token)) throw new Error('Chat authentication failed.'); ws.playerId = String(message.playerId); ws.profile = publicProfile(ws.playerId, record.state); send(ws, { type: 'social_ready' }); })(); await ws.authPromise; return;
      }
      if (message.type === 'chat_join') { await ws.authPromise; if (!ws.playerId) throw new Error('Authenticate before joining chat.'); ws.socialRoom = await canonicalRoom(ws, message.room); const history = await listMessages(ws.socialRoom); return send(ws, { type: 'chat_history', messages: history }); }
      if (message.type === 'chat_send') {
        await ws.authPromise; if (!ws.playerId) throw new Error('Authenticate before chatting.'); const room = await canonicalRoom(ws, message.room); if (room !== ws.socialRoom) throw new Error('Join this room before sending.'); if (Date.now() - ws.lastChatAt < 900) throw new Error('Please wait before sending another message.'); const text = String(message.text || '').trim().slice(0, 500); if (!text) return; ws.lastChatAt = Date.now();
        const entry = { id: randomUUID(), room, playerId: ws.playerId, name: ws.profile.name, tag: ws.profile.tag, icon: ws.profile.icon, text, createdAt: Date.now() }; await putMessage(entry); for (const socket of sockets) if (socket.socialRoom === room) send(socket, { type: 'chat_message', message: entry }); return;
      }
      if (message.type === 'queue_leave') { removeQueued(ws); return send(ws, { type: 'queue_left' }); }
      if (message.type !== 'queue_join') return;
      if (!validDeck(message.deck)) return send(ws, { type: 'error', message: 'Deck must contain 5–20 unique unlocked cards.' });
      const profile = await getProfile(String(message.playerId)); if (!profile || profile.token !== String(message.token)) return send(ws, { type: 'error', message: 'Sync your profile before entering PvP.' });
      removeQueued(ws); const entry = { ws, deck: message.deck, name: String(message.name || 'Challenger').slice(0, 24), playerId: message.playerId }; const opponentIndex = queue.findIndex((queued) => queued.playerId !== entry.playerId); if (opponentIndex >= 0) runMatch(queue.splice(opponentIndex, 1)[0], entry); else { queue.push(entry); send(ws, { type: 'queued', position: queue.length }); }
    } catch (error) { send(ws, { type: 'error', message: error.message || 'Invalid multiplayer message.' }); }
  });
  ws.on('close', () => { removeQueued(ws); sockets.delete(ws); });
});

const staticPath = fileURLToPath(new URL('../www', import.meta.url));
app.use(express.static(staticPath));
app.get('/{*splat}', (_req, res) => res.sendFile(`${staticPath}/index.html`));
server.listen(port, '0.0.0.0', () => console.log(`Pixel Bosses 2.0 listening on ${port}`));

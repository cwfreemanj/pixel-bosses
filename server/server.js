import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import pg from 'pg';
import { resolveDuel, seededShuffle } from '../client/js/engine.js';

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 3000);
const origins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((x) => x.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '3mb' }));
app.use(express.static(new URL('../www', import.meta.url).pathname));

const memoryProfiles = new Map();
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(`CREATE TABLE IF NOT EXISTS pixel_profiles (
    player_id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    state JSONB NOT NULL,
    updated_at BIGINT NOT NULL
  )`);
}

async function getProfile(playerId) {
  if (!pool) return memoryProfiles.get(playerId) || null;
  const result = await pool.query('SELECT token, state, updated_at FROM pixel_profiles WHERE player_id=$1', [playerId]);
  return result.rows[0] || null;
}

async function putProfile(playerId, token, state, updatedAt) {
  const record = { token, state, updated_at: updatedAt };
  if (!pool) return memoryProfiles.set(playerId, record);
  await pool.query(
    `INSERT INTO pixel_profiles(player_id, token, state, updated_at) VALUES($1,$2,$3,$4)
     ON CONFLICT(player_id) DO UPDATE SET state=$3, updated_at=$4 WHERE pixel_profiles.token=$2`,
    [playerId, token, state, updatedAt]
  );
}

function cleanState(state) {
  if (!state || typeof state !== 'object') throw new Error('Invalid state');
  const copy = structuredClone(state);
  copy.pixels = Math.max(0, Math.min(1_000_000_000, Number(copy.pixels) || 0));
  copy.binder = Array.isArray(copy.binder) ? copy.binder.slice(0, 2000) : [];
  copy.decks = Array.isArray(copy.decks) ? copy.decks.slice(0, 100) : [];
  delete copy.activeBattle;
  return copy;
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'pixel-bosses', queue: queue.length, database: Boolean(pool) }));
app.post('/api/profile/sync', async (req, res) => {
  try {
    const { playerId, token, state, updatedAt = Date.now() } = req.body || {};
    if (!playerId || !token || !state) return res.status(400).json({ error: 'playerId, token, and state are required' });
    const current = await getProfile(playerId);
    if (current && current.token !== token) return res.status(403).json({ error: 'Profile token mismatch' });
    if (current && Number(current.updated_at) > Number(updatedAt)) {
      return res.json({ state: current.state, updatedAt: Number(current.updated_at), source: 'server' });
    }
    const safe = cleanState(state);
    await putProfile(playerId, token, safe, Number(updatedAt));
    res.json({ state: safe, updatedAt: Number(updatedAt), source: 'client' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function validDeck(deck) {
  if (!Array.isArray(deck) || deck.length < 5 || deck.length > 20) return false;
  const ids = deck.map((c) => c.cardHash || c.id);
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}

const wss = new WebSocketServer({ server, path: '/multiplayer' });
const queue = [];
const sockets = new Map();
const send = (ws, payload) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(payload));
const removeQueued = (ws) => {
  const index = queue.findIndex((item) => item.ws === ws);
  if (index >= 0) queue.splice(index, 1);
};

function runMatch(a, b) {
  const matchId = randomUUID();
  const seed = `${matchId}:${Date.now()}`;
  const deckA = seededShuffle(a.deck, seed + ':a');
  const deckB = seededShuffle(b.deck, seed + ':b');
  const rounds = [];
  let winsA = 0;
  let winsB = 0;
  const total = Math.min(deckA.length, deckB.length);
  for (let i = 0; i < total; i++) {
    const duel = resolveDuel(deckA[i], deckB[i], seed + ':' + i);
    if (duel.winner === 'A') winsA++; else winsB++;
    rounds.push({ index: i + 1, cardA: deckA[i], cardB: deckB[i], duel, score: [winsA, winsB] });
  }
  const winner = winsA === winsB ? 'DRAW' : winsA > winsB ? 'A' : 'B';
  const start = { type: 'match_start', matchId, seed, opponent: b.name };
  send(a.ws, start);
  send(b.ws, { ...start, opponent: a.name });
  rounds.forEach((round, i) => setTimeout(() => {
    send(a.ws, { type: 'match_round', matchId, ...round });
    send(b.ws, { type: 'match_round', matchId, ...round, cardA: round.cardB, cardB: round.cardA, duel: { ...round.duel, winner: round.duel.winner === 'A' ? 'B' : 'A' }, score: [round.score[1], round.score[0]] });
  }, 700 * (i + 1)));
  setTimeout(() => {
    send(a.ws, { type: 'match_end', matchId, winner, score: [winsA, winsB], reward: winner === 'A' ? 225 : winner === 'DRAW' ? 100 : 50 });
    send(b.ws, { type: 'match_end', matchId, winner: winner === 'A' ? 'B' : winner === 'B' ? 'A' : 'DRAW', score: [winsB, winsA], reward: winner === 'B' ? 225 : winner === 'DRAW' ? 100 : 50 });
  }, 700 * (rounds.length + 1));
}

wss.on('connection', (ws) => {
  ws.id = randomUUID();
  sockets.set(ws.id, ws);
  send(ws, { type: 'connected', socketId: ws.id });
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'queue_leave') {
        removeQueued(ws);
        return send(ws, { type: 'queue_left' });
      }
      if (msg.type !== 'queue_join') return;
      if (!validDeck(msg.deck)) return send(ws, { type: 'error', message: 'Deck must contain 5–20 unique cards.' });
      removeQueued(ws);
      const entry = { ws, deck: msg.deck, name: String(msg.name || 'Challenger').slice(0, 24), playerId: msg.playerId };
      const opponentIndex = queue.findIndex((q) => q.playerId !== entry.playerId);
      if (opponentIndex >= 0) runMatch(queue.splice(opponentIndex, 1)[0], entry);
      else {
        queue.push(entry);
        send(ws, { type: 'queued', position: queue.length });
      }
    } catch {
      send(ws, { type: 'error', message: 'Invalid multiplayer message.' });
    }
  });
  ws.on('close', () => { removeQueued(ws); sockets.delete(ws.id); });
});

server.listen(port, '0.0.0.0', () => console.log(`Pixel Bosses listening on ${port}`));

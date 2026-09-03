import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { makeCard } from '../client/js/engine.js';

const port = 3499;
const base = `http://127.0.0.1:${port}`;
const processHandle = spawn(process.execPath, ['server/server.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
processHandle.stdout.on('data', (chunk) => { logs += chunk; });
processHandle.stderr.on('data', (chunk) => { logs += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try { const response = await fetch(`${base}/health`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${logs}`);
}
function makeState(playerId, token, name, tag) {
  const binder = Array.from({ length: 6 }, (_, index) => makeCard({ seed: `${playerId}:${index}` }));
  return {
    schemaVersion: 3, playerId, playerToken: token, playerName: name,
    profile: { icon: '☠', tag, bio: '' }, pixels: 1000, binder,
    decks: [], campaignWins: [], items: [], stats: {}, social: { friends: [], friendRequests: [] },
    settings: { autoSync: true }, updatedAt: Date.now()
  };
}
async function sync(state, updatedAt = state.updatedAt) {
  const response = await fetch(`${base}/api/profile/sync`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: state.playerId, token: state.playerToken, state, updatedAt }) });
  const data = await response.json();
  assert.equal(response.ok, true, JSON.stringify(data));
  return data;
}
async function request(player, path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-player-id': player.playerId, 'x-player-token': player.playerToken }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); assert.equal(response.ok, true, JSON.stringify(data)); return data;
}
async function chatSmoke(player) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/multiplayer`);
  await once(socket, 'open');
  const messages = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  socket.send(JSON.stringify({ type: 'social_auth', playerId: player.playerId, token: player.playerToken }));
  for (let attempt = 0; attempt < 30 && !messages.some((message) => message.type === 'social_ready'); attempt++) await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(messages.some((message) => message.type === 'social_ready'));
  socket.send(JSON.stringify({ type: 'chat_join', room: 'global' }));
  await new Promise((resolve) => setTimeout(resolve, 60));
  socket.send(JSON.stringify({ type: 'chat_send', room: 'global', text: 'smoke signal' }));
  for (let attempt = 0; attempt < 30 && !messages.some((message) => message.type === 'chat_message'); attempt++) await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(messages.some((message) => message.message?.text === 'smoke signal'));
  socket.close();
}

try {
  await waitForServer();
  const seller = makeState('smoke-seller', 'seller-token', 'Seller', 'SELLER');
  const buyer = makeState('smoke-buyer', 'buyer-token', 'Buyer', 'BUYER');
  await sync(seller); await sync(buyer);
  const listed = await request(seller, '/api/market/listings', 'POST', { cardHash: seller.binder[0].cardHash, mode: 'fixed', price: 125, durationHours: 1 });
  assert.equal(listed.state.binder[0].tradeLocked, true);
  const purchase = await request(buyer, `/api/market/listings/${listed.listing.id}/buy`, 'POST', {});
  assert.equal(purchase.state.pixels, 875); assert.equal(purchase.state.binder.length, 7);
  await request(seller, '/api/social/friends/request', 'POST', { target: 'BUYER' });
  await request(buyer, '/api/social/friends/respond', 'POST', { playerId: seller.playerId, accept: true });
  const friends = await request(seller, '/api/social/friends'); assert.equal(friends.friends.length, 1);
  const leaders = await request(seller, '/api/leaderboard?stat=cardsCollected&limit=100'); assert.equal(leaders.leaders.length, 2);
  await chatSmoke(seller);
  console.log('Server smoke test passed: sync, market, friends, leaderboard, and chat.');
} finally {
  processHandle.kill('SIGTERM');
}

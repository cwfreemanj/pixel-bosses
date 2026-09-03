# Pixel Bosses Mobile

An Android-ready, mobile-first rebuild of the supplied Pixel Bosses HTML game. Version 2 expands Genesis with the Cosmos collection, a second 70-stage campaign, unique lore, social trading, profiles, rankings, chat, payment adapters, and a Polygon minting service while keeping the original Cancel Wild rules and JSON portability.

## Included game flows

- Home menu with Campaign, Quick Battle, Card Studio, Deck Builder, Stats, Lore Vault, Social & Trade, Pixel Shop, Battle Rules, and Settings.
- Universe 1 Genesis stages 1–70 plus Universe 2 Cosmos stages 71–140. Cosmos starts above the Genesis finale and mixes Cosmos cards with two to four Genesis lineages.
- Campaign decks are approximately 72% their featured element and 28% mixed elements so a single counter cannot sweep every card.
- Unique, non-duplicating lore discoveries with higher drop odds in Cosmos.
- Multiple named decks containing 5–20 unique cards. Duplicate card hashes are rejected locally and by the multiplayer server.
- AI battle simulator with card-by-card play, autoplay, effects, result screens, rewards, and a 25-Pixel dual-deck reshuffle.
- Server-authoritative PvP queue and auto-battle over WebSockets.
- Pixel currency generation offers: larger offers increase level ranges and high-rarity odds.
- Local persistence plus automatic Railway/PostgreSQL profile synchronization to the fixed production connector.
- Per-player stats and server-generated top-100 leaderboards across score, wins, PvP, collection, Pixel, trade, mint, lore, and streak metrics.
- Timed fixed-price, auction, and card-for-card market listings with card locks, bid escrow, losing-bid refunds, search, and filters.
- Global, Genesis/Cosmos community, and friend-only private chat; friend requests, removal, and direct messaging.
- GetFirstPage.com profile-link adapter, icon/tag/bio profiles, Stripe Checkout adapter, and server-side Polygon mint endpoint.
- Binder, deck, single-card, and full-save JSON exports. Binder/deck imports merge unique cards. AI and opponent decks cannot be saved.
- Stable `schemaVersion`, `cardHash`, `set`, and `mintStatus` fields reserved for later wallet, minting, and microtransaction adapters.
- Installable PWA fallback and offline cache.

## Quick local test

Install [Node.js 20+](https://nodejs.org/), then run:

```bash
npm install
npm test
npm run build
npm start
```

Open `http://localhost:3000`. Two browser windows can test matchmaking. For a phone on the same Wi-Fi, use your computer's LAN IP and allow port 3000 through the firewall.

## Project map

| Path | Purpose |
| --- | --- |
| `client/` | Mobile/PWA game client |
| `client/js/engine.js` | Card generation, Cancel Wild rules, duel resolver |
| `client/js/campaign.js` | Infinite themed campaign algorithm |
| `client/js/storage.js` | Local persistence and JSON formats |
| `client/js/network.js` | Cloud-save and multiplayer client |
| `server/server.js` | Sync, rankings, market escrow, social/chat, checkout, minting, PvP |
| `blockchain/` | OpenZeppelin ERC-721 contract and Hardhat deployment project |
| `capacitor.config.json` | Android application identity and web directory |
| `railway.json` | Railway build/start/health configuration |
| `ANDROID_STUDIO.md` | Exact APK/AAB build steps |
| `DEPLOYMENT.md` | GitHub and Railway deployment steps |
| `BLOCKCHAIN_MINTING.md` | Exact Amoy-to-Polygon minting setup and security checklist |
| `ORIGINAL_FEATURE_MAP.md` | Migration notes from the supplied source |

## Important production notes

- PostgreSQL is strongly recommended. Without `DATABASE_URL`, profile sync uses server memory and resets on redeploy; battles still function.
- The locally stored random profile token is lightweight guest authentication. Before real-money purchases or minting, replace it with signed account authentication and validate rewards/ownership entirely server-side.
- PvP duel order and outcomes are calculated server-side. The current client awards the signed-in guest's result locally; production economy hardening should add a server transaction ledger and authenticated reward claims.
- Do not put wallet private keys, mint keys, or payment secrets in `client/` or in the APK.

## License / ownership

This project was generated specifically as a migration scaffold for the supplied Pixel Bosses source. Review third-party package licenses before commercial release.

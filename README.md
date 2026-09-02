# Pixel Bosses Mobile

An Android-ready, mobile-first rebuild of the supplied Pixel Bosses HTML game. It keeps the Genesis procedural-card identity, six rarities, seven-element Cancel Wild chart, level/rarity/power duel resolution, deterministic card DNA and hashes, binder and JSON portability, while splitting the original desktop panel wall into focused touch screens.

## Included game flows

- Home menu with Campaign, Quick Battle, Card Studio, Deck Builder, and Settings.
- Infinite campaign progression in themed ten-stage areas. The first 70 stages cover Nature, Arcane, Inferno, Frost, Void, Radiant, and Blood before ascending into a harder cycle.
- Campaign decks are approximately 72% their featured element and 28% mixed elements so a single counter cannot sweep every card.
- Multiple named decks containing 5–20 unique cards. Duplicate card hashes are rejected locally and by the multiplayer server.
- AI battle simulator with card-by-card play, autoplay, effects, result screens, rewards, and a 25-Pixel dual-deck reshuffle.
- Server-authoritative PvP queue and auto-battle over WebSockets.
- Pixel currency generation offers: larger offers increase level ranges and high-rarity odds.
- Local persistence plus optional Railway/PostgreSQL profile synchronization.
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
| `server/server.js` | Profile sync, matchmaking, authoritative PvP |
| `capacitor.config.json` | Android application identity and web directory |
| `railway.json` | Railway build/start/health configuration |
| `ANDROID_STUDIO.md` | Exact APK/AAB build steps |
| `DEPLOYMENT.md` | GitHub and Railway deployment steps |
| `ORIGINAL_FEATURE_MAP.md` | Migration notes from the supplied source |

## Important production notes

- PostgreSQL is strongly recommended. Without `DATABASE_URL`, profile sync uses server memory and resets on redeploy; battles still function.
- The locally stored random profile token is lightweight guest authentication. Before real-money purchases or minting, replace it with signed account authentication and validate rewards/ownership entirely server-side.
- PvP duel order and outcomes are calculated server-side. The current client awards the signed-in guest's result locally; production economy hardening should add a server transaction ledger and authenticated reward claims.
- Do not put wallet private keys, mint keys, or payment secrets in `client/` or in the APK.

## License / ownership

This project was generated specifically as a migration scaffold for the supplied Pixel Bosses source. Review third-party package licenses before commercial release.

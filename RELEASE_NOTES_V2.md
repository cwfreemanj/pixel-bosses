# Pixel Bosses Mobile 2.0 — Cosmos Chain

## Delivered in this update

- Removed the editable Railway URL and fixed all online connections to `https://web-production-efaa4b.up.railway.app`.
- Corrected the home stage stat to render the completed-stage count instead of the whole stage array; added mobile overflow guards.
- Added profile stats and top-100 global leaderboards across 14 categories.
- Added the Cosmos procedural collection with 16 types, new name pools, four additional combat-generation stats, variants, visual DNA, affixes, and expanded art parameters.
- Added Universe 2 stages 71–140, seven themed areas, rising difficulty, mixed Cosmos/Genesis opponent decks, and continuing story text.
- Added unique Genesis/Cosmos lore drops and a persistent Lore Vault with duplicate prevention.
- Increased card and battle-card text padding and added two-line mobile-safe titles.
- Added icon, tag, bio, GetFirstPage link-code adapter, and Polygon wallet fields.
- Added fixed-price sales, auctions, card-plus-Pixel offers, listing durations, card locks, escrow, refunds, search, and filters.
- Added global/community chat, friend-only private chat, requests, removal, and direct-message navigation.
- Added a Stripe Checkout/webhook adapter for Pixel packages and storefront guidance for Google Play Billing.
- Added a Battle Rules field manual with the exact Cancel Wild table, match requirements, comparison order, and current power formula.
- Added an OpenZeppelin ERC-721 contract, Hardhat deployment project, and Railway mint service.

## External configuration still required

- Railway PostgreSQL for durable network state.
- A GetFirstPage verification endpoint before account linking can verify real members.
- Stripe products, Price IDs, webhook secret, and allowed distribution model before real purchases.
- IPFS pinning, a funded Polygon minter, deployed contract, and Railway mint secrets before on-chain minting.
- Google Play Billing plus backend purchase-token validation for a Play Store build that sells digital Pixels.

## Verification completed

- Eight deterministic card, duel, campaign, Cosmos, and lore tests pass.
- Server smoke test passes profile sync, market transfer, friends, leaderboards, and WebSocket chat.
- Client web build passes and is synced into the checked-in Capacitor Android project.
- The ERC-721 contract compiles successfully with Solidity 0.8.24 and OpenZeppelin Contracts 5.2.0.
- Root production dependency audit reports zero known vulnerabilities.

The Gradle wrapper could not download Gradle inside the packaging environment because that external host was blocked. Android Studio can complete that standard first-time download; the web assets and native project have already been synchronized.

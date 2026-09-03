# Pixel Bosses blockchain minting setup

The app now has a working mint request path, but it remains safely disabled until a contract and Railway secrets are configured. Start on Polygon Amoy. Do not start with real funds or mainnet.

## 1. Decide what the NFT represents

Each generated card already has a unique `cardHash`. The included `PixelBossCards.sol` contract permanently maps that hash to one ERC-721 token, preventing a second mint of the same card. The token URI should point to immutable JSON metadata on IPFS.

Recommended metadata shape:

```json
{
  "name": "Nova Stellar Starbinder",
  "description": "A unique Cosmos card from Pixel Bosses.",
  "image": "ipfs://IMAGE_CID/card.png",
  "external_url": "https://getfirstpage.com/play-pixel-bosses",
  "attributes": [
    { "trait_type": "Collection", "value": "COSMOS" },
    { "trait_type": "Element", "value": "Radiant" },
    { "trait_type": "Rarity", "value": "Epic" },
    { "trait_type": "Level", "value": 73 },
    { "trait_type": "Card Hash", "value": "PB-..." }
  ]
}
```

Pin both the rendered card image and metadata JSON through an IPFS provider. The final value entered in the app must be `ipfs://METADATA_CID/filename.json`.

## 2. Create a dedicated deployer/minter wallet

1. Create a brand-new wallet used only by the Pixel Bosses mint service.
2. Back up its recovery material offline.
3. Never add its private key to GitHub, the client, Capacitor, or the APK.
4. Get test POL for that address from the Polygon Amoy faucet.
5. Keep only enough mainnet POL for expected gas once production begins.

The included contract makes the deployer the owner. Only that address can call `mintCard`. The project pins OpenZeppelin Contracts 5.2.0 and Solidity 0.8.24 so a future dependency update cannot silently change deployed bytecode.

## 3. Deploy the contract to Amoy

From the project root:

```bash
cd blockchain
cp .env.example .env
npm install
```

Edit `blockchain/.env`:

```text
DEPLOYER_PRIVATE_KEY=0xYOUR_DEDICATED_PRIVATE_KEY
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

Then compile and deploy:

```bash
npm run compile
npm run deploy:amoy
```

Copy the printed `PixelBossCards address`. Verify the deployment in the Amoy PolygonScan explorer and keep the address with your release records.

## 4. Configure Railway test minting

In the Pixel Bosses Railway service, add:

```text
MINT_RPC_URL=https://rpc-amoy.polygon.technology
MINT_PRIVATE_KEY=0xTHE_SAME_DEDICATED_MINTER_KEY
MINT_CONTRACT_ADDRESS=0xTHE_DEPLOYED_AMOY_CONTRACT
MINT_CONFIRMATIONS=1
PUBLIC_SERVER_URL=https://web-production-efaa4b.up.railway.app
```

Redeploy. Open `/health` and confirm `"minting": true`.

In the game:

1. Open **Settings → Wallet & Minting** and save a Polygon-compatible player address.
2. Open an unlisted, unminted binder card.
3. Tap **Mint to Wallet**.
4. Paste the pinned `ipfs://` metadata URI.
5. Wait for Railway to submit and confirm the transaction.
6. Confirm the NFT appears at the player address on the Amoy explorer.

The server records `mintStatus`, transaction hash, token ID, and token URI only after the transaction is confirmed.

## 5. Test failure cases

Before mainnet, verify all of these:

- The same `cardHash` cannot be minted twice.
- A listed/trade-locked card cannot be minted.
- An invalid wallet or non-IPFS URI is rejected.
- A wrong profile token cannot request a mint.
- A failed/reverted transaction does not mark the card minted.
- A restarted Railway deployment keeps state because PostgreSQL is connected.

## 6. Production hardening before real cards

The current guest token and client-originated game state are suitable for testing, not a valuable real-money economy. Before mainnet:

1. Replace guest tokens with real account login and short-lived signed sessions.
2. Move card generation, rewards, Pixel spending, inventory ownership, and trade settlement to an authoritative server ledger.
3. Put the minter key in managed signing infrastructure or a tightly scoped relayer; rotate away from the deployment key.
4. Add per-player mint limits, request idempotency, rate limiting, audit logs, and an operator pause switch.
5. Have the Solidity contract and backend reviewed before accepting money.
6. Publish marketplace terms, privacy disclosures, refund rules, NFT risk disclosures, and supported-chain/network notices.

## 7. Move from Amoy to Polygon mainnet

1. Fund the dedicated wallet with a small amount of mainnet POL.
2. Set `POLYGON_RPC_URL` in `blockchain/.env`.
3. Run `npm run deploy:polygon`.
4. Verify the new contract on PolygonScan.
5. Change Railway `MINT_RPC_URL` to your Polygon mainnet RPC and `MINT_CONTRACT_ADDRESS` to the new mainnet contract.
6. Keep Amoy and production environments separate. Never reuse test contract addresses in production.

## Cash-shop note

The included Stripe Checkout/webhook adapter can be used for the hosted web build and direct-distribution APKs where permitted. For a Google Play-distributed app selling digital Pixels, implement Google Play Billing and server-side purchase-token verification before release; do not route that Play build through the Stripe buttons.

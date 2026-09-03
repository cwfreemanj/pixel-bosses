# GitHub + Railway deployment

## Push to GitHub

Create an empty GitHub repository. From this project folder:

```bash
git init
git add .
git commit -m "Pixel Bosses mobile foundation"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/pixel-bosses-mobile.git
git push -u origin main
```

The included GitHub Actions workflow runs the rule tests and web build on pushes and pull requests.

## Deploy on Railway

1. In Railway, create a **New Project → Deploy from GitHub repo** and choose this repository.
2. Add a PostgreSQL service to the same Railway project.
3. Railway should supply `DATABASE_URL` to the application service. If not, reference the PostgreSQL service variable manually.
4. Add `PUBLIC_SERVER_URL=https://web-production-efaa4b.up.railway.app`.
5. Add `ALLOWED_ORIGINS=*` while testing. For production web hosting, use a comma-separated allowlist of your actual HTTPS origins.
6. Generate the public domain `web-production-efaa4b.up.railway.app` for the application service.
7. Open `https://web-production-efaa4b.up.railway.app/health`. A healthy result includes `"ok": true` and `"database": true`.

The Android and web clients use that HTTPS address automatically; there is no editable Railway field in Settings. Railway uses `railway.json`, runs `npm run build`, starts `npm start`, and checks `/health`.

## Optional production services

Add only the variables for services you are ready to enable:

- **GetFirstPage link:** `GFP_VERIFY_URL` and optional `GFP_API_TOKEN`. The verifier receives `POST` JSON `{ "code": "...", "pixelBossesPlayerId": "..." }` and should return `{ "ok": true, "memberId": "..." }`.
- **Stripe Checkout:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the four `STRIPE_PRICE_*` IDs shown in `.env.example`. Register `https://web-production-efaa4b.up.railway.app/api/shop/webhook` in Stripe.
- **Polygon minting:** `MINT_RPC_URL`, `MINT_PRIVATE_KEY`, `MINT_CONTRACT_ADDRESS`, and `MINT_CONFIRMATIONS`. Follow `BLOCKCHAIN_MINTING.md` first.

## Multiplayer test

1. Open the deployed game on two browsers/devices.
2. Give each profile a different player name.
3. Select a valid 5–20 card deck.
4. On both clients choose **Quick Battle → Online Challenger**.
5. The server pairs different player IDs, shuffles both decks, resolves all rounds authoritatively, and streams the same match from each player's perspective.

## Production hardening before payments or minting

- Add a real account system and signed access tokens.
- Store Pixel awards/spends in an append-only PostgreSQL transaction ledger.
- Move paid card generation and inventory ownership validation to the server.
- Rate-limit sync and queue endpoints.
- Add reconnection and abandoned-match rules.
- Use a wallet adapter and server-held minting service; never ship private keys in the client.
- Lock CORS to your production web origin and Android app strategy.
- Run only one Railway replica while using the included in-process market lock. Before horizontal scaling, move market settlement into PostgreSQL transactions/advisory locks.

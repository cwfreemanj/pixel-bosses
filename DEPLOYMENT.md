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
4. Add `ALLOWED_ORIGINS=*` while testing. For production web hosting, use a comma-separated allowlist of your actual HTTPS origins.
5. Generate a public domain for the application service.
6. Open `https://YOUR-DOMAIN/health`. A healthy result includes `"ok": true` and `"database": true`.
7. Paste that base domain into Pixel Bosses **Settings → Railway server URL** on every test device.

Railway uses `railway.json`, runs `npm ci && npm run build`, starts `npm start`, and checks `/health`.

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

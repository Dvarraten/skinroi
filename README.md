# SkinROI

A personal profit/loss tracker for buying and selling **Counter-Strike 2** skins across third-party markets (CSFloat, Buff163, YouPin, CSMoney, DMarket and others).

Sign in with Steam, pair the SkinROI browser extension, and your Steam trades show up in **Handle Items** so you can add or sell them with one click. Analytics show realised profit by day, week and month.

---

## Features

- **Item tracker** — log every purchase with platform, price (USD or CNY) and notes. Mark items as sold and the app computes profit after platform fees.
- **Trade sync via browser extension** — the extension reads your accepted Steam trades from your own browser session and pushes them to SkinROI. No Steam Web API key, and the server never talks to Steam.
- **CSFloat price prefill** — trades made on CSFloat get their price filled in, and exact copies are added or marked sold automatically.
- **Sell prices on Home** — each unsold item shows the lowest YouPin and CSFloat listing, with a dot on the market that pays more after fees.
- **Snipes** — listings on CSFloat and DMarket priced below YouPin / Buff163 / CSFloat, with fee, ROI and liquidity filters.
- **Tag-based skin autocomplete** — type "but dop fn" → *Butterfly Knife · Doppler · Factory New*. Backed by the [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) dataset.
- **Currency converter** — live USD ⇄ CNY (and other currencies) in the header and in the price inputs.
- **Analytics** — profit over time, weekly and monthly summaries, and a daily P&L heatmap.
- **CSV import/export** and **themes** (Dark is the default).
- **Persistence** — logged-in users are stored in Upstash Redis; guests use `localStorage`.

---

## Architecture

```
┌────────────────────┐   /api    ┌──────────────────────┐    ┌───────────────┐
│ React frontend     │ ────────▶ │ Vercel functions     │ ─▶ │ Upstash Redis │
│ (CRA + Tailwind)   │           │ (api/*)              │    └───────────────┘
└────────────────────┘           └──────────▲───────────┘
                                            │ Bearer secret
                                 ┌──────────┴───────────┐
                                 │ Chrome extension     │ ─▶ Steam, CSFloat
                                 │ (extension/)         │    (user's session)
                                 └──────────────────────┘
```

See [`CLAUDE.md`](CLAUDE.md) for the detailed data flows, Redis keys and project rules.

---

## Tech stack

- **React 19** with Create React App (`react-scripts 5`)
- **Tailwind CSS 3**
- **Recharts** for charts, **Lucide** icons
- **Vercel** functions + hosting
- **Upstash Redis** via `@upstash/redis`
- **Chrome extension** (Manifest V3)

---

## Local setup

```bash
npm i -g vercel
vercel link                 # first time only — connect to the Vercel project
vercel env pull .env.local  # SESSION_SECRET, UPSTASH_REDIS_*, etc.

npm install
npm run items:update        # pull the CS2 skin list into public/items.json
vercel dev                  # frontend + api/ functions on http://localhost:3000
```

Local dev uses the same Redis as production, so be careful when editing items while signed in.

### Extension

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select `extension/`.
2. In the popup's Advanced section, set the base URL to `http://localhost:3000` for local dev.
3. Sign in on the site, go to **Handle Items → Generate pairing code**, paste the code into the popup and click **Pair**.

---

## Deploy

Pushing to `main` deploys to Vercel production automatically. Environment variables (Redis, session secret, API keys) live in the Vercel project settings and are never committed.

The Vercel Hobby plan allows at most 12 functions (files under `api/` outside `_lib/`), so new routes are added as methods on existing functions.

---

## Useful endpoints

| Method | Path                                  | Purpose                                               |
|--------|---------------------------------------|-------------------------------------------------------|
| GET    | `/api/inventory/state`                | Pending trades + extension status                     |
| POST   | `/api/inventory/dismiss`              | Remove pending items and tombstone their assetids     |
| POST   | `/api/inventory/reset?confirm=yes`    | Wipe pending list, tombstones and trade dedup         |
| GET/POST | `/api/items`                        | Load / save the portfolio (`?sellPrices=1` for sell prices) |
| GET/POST/DELETE | `/api/extension/pair`        | Create a pairing code, check status, revoke extension |
| POST   | `/api/extension/claim`                | Extension exchanges a code for its secret             |
| POST   | `/api/extension/trades`               | Extension pushes detected trades                      |
| GET/POST | `/api/snipes`                       | Snipe deals / extension pushes CSFloat listings       |

---

## Scripts

| Command                | Purpose                                            |
|------------------------|----------------------------------------------------|
| `vercel dev`           | Frontend + API locally on http://localhost:3000    |
| `npm start`            | Frontend only (CRA dev server)                     |
| `npm run build`        | Production build to `build/`                       |
| `npm test`             | Unit tests                                         |
| `npm run items:update` | Refresh `public/items.json` from ByMykel/CSGO-API  |

---

## Credits

- Skin metadata via [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API)
- Icons via [Lucide](https://lucide.dev)
- Item images served from Steam's CDN

This is a personal project. Counter-Strike, CS2 and Steam are trademarks of Valve Corporation; this app is not affiliated with or endorsed by Valve.

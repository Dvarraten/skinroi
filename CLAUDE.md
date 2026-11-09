# SkinROI — Claude Code Guide

Personal CS2 skin investment tracker. React CRA frontend deployed on Vercel
with file-based serverless API functions and Upstash Redis for persistence.
Trade detection is done by a browser extension that pushes changes to the
backend — the server never talks to Steam.

## Architecture

```
skinroi/
├── api/                  Vercel serverless functions (production backend)
│   ├── _lib/             Shared server-side utilities (not exposed as routes)
│   │   ├── auth.js             HMAC session cookie for logged-in SkinROI users
│   │   ├── profile.js          Steam display name + avatar (Redis-cached 24h)
│   │   ├── redis.js            Shared Upstash Redis client factory
│   │   ├── state.js            Read/write per-user pending list + tombstones
│   │   ├── extension-store.js  Pairing codes + long-lived extension secrets
│   │   └── snipes/             Snipes scanner: csfloat.js, dmarket.js (listings),
│   │                           reference.js (YouPin/Buff163 prices), scan.js
│   ├── auth/             Steam OpenID login + session
│   │   ├── steam.js       Initiates OpenID redirect
│   │   ├── callback.js    Validates OpenID response, sets session cookie
│   │   ├── me.js          Returns current session user
│   │   └── logout.js      Clears session cookie
│   ├── extension/        Extension pairing + trade ingestion
│   │   ├── pair.js        GET/POST/DELETE — logged-in user manages pairing
│   │   ├── claim.js       POST — extension exchanges code for Bearer secret
│   │   └── trades.js      POST — extension pushes detected trades
│   ├── inventory/        Pending-list endpoints
│   │   ├── state.js       GET — returns pending list + extension status
│   │   ├── dismiss.js     POST — removes a pending item + tombstones its assetid
│   │   └── reset.js       POST — wipes pending state
│   ├── items/
│   │   └── index.js       GET/POST — load and save the tracked item portfolio
│   └── snipes/
│       └── index.js       GET — deals below YouPin/Buff163 (rescans lazily, ~45s);
│                          POST — extension pushes raw CSFloat listings (Bearer secret)
├── extension/            Chrome extension (Manifest V3, load unpacked)
│   ├── manifest.json
│   └── src/
│       ├── background.js  Service worker — polls GetTradeOffers every 2 min
│       ├── popup/         Popup UI: pairing, connection status, activity log
│       └── lib/
│           ├── config.js  Endpoints, storage keys
│           ├── storage.js chrome.storage.local wrapper (pairing, desc cache)
│           ├── skinroi.js SkinROI API client (uses Bearer secret)
│           └── steam.js   Session token + GetTradeOffers + normalizer
├── src/                  React CRA frontend
│   ├── App.js            Root component
│   ├── pages/            Pages: AddItem, HandleItems, Analytics, Snipes,
│   │                     Transactions, About
│   ├── components/       UI components
│   │   └── ExtensionPairPanel.jsx  Pairing / connection status UI
│   ├── hooks/            Custom React hooks
│   │   ├── useAuth.js         Steam session state + login/logout
│   │   ├── useItems.js        Portfolio CRUD + form state + persistence
│   │   ├── useExchangeRate.js Live USD/CNY rate + linked input handlers
│   │   ├── useChartData.js    Derives chart series from sold items
│   │   └── useSteamSync.js    Reads pending list + extension status (read-only)
│   ├── utils/            Helpers (itemImages, fees, CSV import/export, etc.)
│   └── themes/themes.js  All visual theme definitions
└── scripts/
    └── fetch-items.js    Pulls latest CS2 skin list → public/items.json
```

## Key Data Flows

**Steam login (SkinROI)**: `GET /api/auth/steam` → Steam OpenID → `GET /api/auth/callback`
→ sets `cs2-session` HMAC cookie containing steamId.

**Extension pairing**:
1. Logged-in user hits Handle Items → clicks "Generate pairing code"
2. Frontend `POST /api/extension/pair` → returns 8-char code (10 min TTL)
3. User pastes code into the extension popup
4. Extension `POST /api/extension/claim` → returns long-lived Bearer secret
5. Extension stores secret in `chrome.storage.local`; frontend detects claim via poll

**Trade detection (extension → server)**:
- Extension pulls a session-derived WebAPI token from
  `steamcommunity.com/pointssummary/ajaxgetasyncconfig` (falls back to the
  `data-loyalty_webapi_token` embedded in `/my/home/` HTML)
- Every 2 minutes calls `IEconService/GetTradeOffers/v1/` across three filter
  modes to catch all state 3 (Accepted) trades, plus
  `IEconService/GetTradeHistory/v1/` — merged and deduped by `tradeofferid`
- The extension sends every accepted trade; the backend applies the cutoff:
  trades accepted before `pairedAt` (minus 60 s grace) are only recorded in
  `processedTradeIds` and never surface in Handle Items. `time_updated` is
  unreliable because Steam bumps it when trade holds expire
- Item descriptions are sparse in offer responses, so the worker also pulls
  the user's inventory (ctx 2 + ctx 16) and keeps a persistent
  `classid_instanceid → { market_hash_name, icon_url }` cache in
  `chrome.storage.local`; still-missing ones fall back to
  `GetAssetClassInfo` / `GetTradeStatus`
- Pushes `{ offers: [{tradeofferid, items[]}], extVersion }` to
  `POST /api/extension/trades` authenticated by `Authorization: Bearer {secret}`
- Backend dedupes by `tradeofferid` in `processedTradeIds`; respects
  `dismissedAssetIds` tombstones for user-dismissed items

**CSFloat prices (server → CSFloat)**: `GET /api/inventory/state` fetches the
user's CSFloat trades (undocumented `GET csfloat.com/api/v1/me/trades`, auth with
`CSFLOAT_API_KEY`, cached 5 min in Redis; a failed fetch pauses it 5 min, a 429 15 min) and adds `csfloatPrice` (USD) to pending
items whose `tradeid` equals the trade's `steam_offer.id`. Handle Items prefills
the buy/sell price from it. See `api/_lib/csfloat-trades.js`.
`useCsfloatAutoSync` (wired in `App.js`, runs once the portfolio has loaded from
the API) then resolves those entries on its own: incoming ones are added at the
CSFloat price, outgoing ones mark an item sold only when exactly one unsold item
is the same copy (same `assetid`, or for items without one: same name, exact
float and paint seed). Everything else stays in Handle Items for the user.
Items added via Handle Items store the Steam `assetid` for this matching.

**Snipes**: `GET /api/snipes` (logged-in only) rescans server-fetched sources
(DMarket) when the last scan is older than 45s, guarded by a Redis lock.
CSFloat listings come from the extension instead: every poll (2 min) it fetches
`csfloat.com/api/v1/listings?sort_by=most_recent` with the browser session (no
API key) and POSTs the raw rows to `POST /api/snipes`. CSFloat answers 429
"too many IPs" when Vercel fetches them, because functions call out from many
IPs. Both paths price listings against YouPin, Buff163 and CSFloat and store
every listing at least 2% under the best of them for 30 min. CSFloat's price is
its cheapest listing of the same item (never CSFloat's appraisal), excluding
the listing being priced (`snipes/csfloat-lowest.js`). The server can't look
it up, so each listings push answers with up to 2 `csfloatLookups` (items with
no known price, ranked by appraisal or YouPin/Buff price over the buy price);
the extension (`lib/snipelookups.js`) fetches each one's 3 cheapest listings and POSTs `{ market: 'csfloat', lowest: [{ name, rows }] }`. Results
are cached 30 min, the listings that waited on them are priced again, and a
cheaper listing in the feed updates the cache straight away. "Item deals" add an
item's lowest YouPin / Buff163 ask when another market pays more; the page
picks buy and sell markets and the best net sell price, and scores liquidity
0–100 on the sell market (buy orders, spread and listings on YouPin / Buff163;
CSFloat sales and Steam volume on CSFloat). Fees, ROI and liquidity filters
run in the browser (`src/utils/snipes.js`). DMarket is read from
`/marketplace-api/v2/offers`, which needs `DMARKET_PUBLIC_KEY`/
`DMARKET_SECRET_KEY` (requests are Ed25519-signed). Other env vars:
`STEAMDT_API_KEY` (free SteamDT key: YouPin + Buff163 with listing counts;
the batch endpoint allows one call a minute, so names are cached 30 min and
uncovered ones fall back to csgotrader), `CSPRICEAPI_KEY` (paid, wins if set;
with neither, the free csgotrader.app Buff163 dump is used) and
`SNIPES_MIN_PRICE_CENTS` (default 200). A source that answers 429 pauses 15 min. Dopplers without a known phase
are skipped so phases never get mixed.

**Liquidity prefilter** (`snipes/liquidity.js`): before any listing is priced,
Souvenir, Well-Worn and Battle-Scarred skins, stickers/graffiti/patches/music
kits/charms, and items with a Steam daily volume under 3 (from CSFloat's feed)
are dropped, so they never cost a SteamDT batch slot or a CSFloat lookup.
CSFloat lookups also skip items with under 20 YouPin/Buff163 listings and items
that can't sell above their buy price. Tune with `SNIPES_SKIP_WEARS`
(comma list), `SNIPES_KEEP_SOUVENIRS=1` and `SNIPES_MIN_STEAM_VOLUME`.
SteamDT batch calls are 75 s apart; an answer like 当前接口请求已达到上限
(limit reached) or 429 pauses SteamDT 5 min, doubling to 60 min; names SteamDT
has no price for are cached 6 h.

**CSFloat rate limit**: CSFloat publishes no numbers; community notes put
`/v1/listings` at about 5 requests a minute (it sends `X-RateLimit-*`
headers). Every extension call to it goes through `extension/src/lib/csfloat.js`:
one queue, 18 s apart (at most 3 a minute, leaving room for the user's own
csfloat.com browsing), and after a 429 every CSFloat call pauses
until `Retry-After`/`X-RateLimit-Reset`, else 10 min doubling to 60 min. Per
2-min poll that is at most 1 feed + 2 lookups + 3 sell-price calls. CSFloat
inspect (`api.csfloat.com`, `lib/inspect.js`) only looks at items from trades
since pairing, at most 5 per poll, and caches failures for 24 h. Never add a
CSFloat call that bypasses `csfloatFetch`.

**Sell prices on Home**: each unsold item shows the lowest YouPin and
CSFloat listing, at most 1 hour old, with a dot on the one that pays more after
fees. YouPin comes from SteamDT on the server (`loadSteamDtRows` in
`snipes/reference.js`, same 30 min cache and 1-call-a-minute gate as Snipes),
added on each site `GET /api/items?sellPrices=1`; never use the user's own
YouPin session. CSFloat is fetched by the extension (`lib/sellprices.js`):
`api/v1/listings?market_hash_name=…&sort_by=lowest_price`, at most 4 calls per
poll for names that are 30+ min old, POSTed to the same URL. The site hides prices older
than 1 hour. Prices are keyed per Doppler phase (`api/_lib/doppler-phase.js`,
mirrored in `src/utils/sellPrices.js`): phase from the item name ("Doppler
Phase 2") or its paint index; CSFloat filters by `paint_index`. When the
phase is unknown (or CSFloat has nothing for it), and always for YouPin
(SteamDT has no per-phase prices), the price is the lowest of any phase,
flagged `anyPhase` and shown with a `*`; no "best" dot then.

**Item persistence**: Logged-in users → `GET/POST /api/items` backed by Redis.
Guest users → `localStorage` key `cs2-trading-items`. Demo mode → nothing is
saved anywhere (see below).

**Landing, demo and guest**: logged-out visitors get `LandingPage` (screenshots
in `public/landing/`). "Try the demo" sets `sessionStorage['skinroi-demo']`;
`useItems(steamId, { demo })` then loads `utils/demoPortfolio.js` and never
writes to localStorage or `/api/items` (production Redis is shared with local
dev). Logged-out Snipes reads `GET /api/snipes?demo=1`: deals first seen 15+
min ago, without buy links, CDN-cached 60 s, never rescans
(`api/_lib/snipes/demo.js`). "Continue without an account" is guest mode
(`localStorage['cs2-auth-dismissed']`).

**Onboarding + Steam import**: `OnboardingChecklist` on Home (install, pair,
first item) for signed-in users until done or closed
(`skinroi-onboarding-done-{steamId}`). Set `REACT_APP_EXTENSION_URL` to the
Chrome Web Store link once published. "Import from Steam" (Add item page and
checklist) reads `GET /api/inventory/state?steamInventory=1`: Steam's public
inventory endpoint (inventory must be public), marketable items only, cached
10 min per user (`api/_lib/steam-inventory.js`).

## Development

Install Vercel CLI once (needed for `vercel dev` to serve `api/` functions):

```bash
npm i -g vercel
vercel link                 # first time only — connect to the Vercel project
vercel env pull .env.local  # pulls SESSION_SECRET, UPSTASH_REDIS_*, etc.
```

Then:

```bash
npm install
vercel dev                  # serves CRA frontend + api/ functions on :3000
npm run items:update        # refresh public/items.json from ByMykel/CSGO-API
```

Load the extension: open `chrome://extensions`, enable Developer mode, click
**Load unpacked**, and select the `extension/` directory. Open the popup and
use the Advanced section to set the base URL to `http://localhost:3000` during
development.

## Common Operations

**Pair the extension with your account:**

1. Sign in on the site via Steam
2. Go to Handle Items → **Generate pairing code**
3. Click the extension icon → paste the code → **Pair**

**Reset the pending list** (wipes tombstones + processed-trade dedup):

```
POST /api/inventory/reset?confirm=yes
```

**Revoke the extension** (frontend does this via the Disconnect button):

```
DELETE /api/extension/pair
```

**Update the skin autocomplete list:**

```bash
npm run items:update
```

## Redis Key Namespace

| Key                              | Contents                                          |
| -------------------------------- | ------------------------------------------------- |
| `skinroi:items:{steamId}`        | Portfolio item array                              |
| `skinroi:sync:{steamId}:state`   | Pending list, tombstones, processed-trade dedup   |
| `skinroi:profile:{steamId}`      | Cached Steam display name + avatar (24h TTL)      |
| `skinroi:ext-pair:{code}`        | Short-lived pairing code (10 min TTL)             |
| `skinroi:ext-secret:{secret}`    | Reverse lookup: Bearer secret → steamId           |
| `skinroi:ext-info:{steamId}`     | Extension version, pairedAt, lastSeen             |
| `skinroi:sellprices:{steamId}`   | CSFloat sell prices for owned items (from extension) |
| `skinroi:csfloat:trades:{steamId}` | Slim CSFloat trades for price prefill (5 min TTL) |
| `skinroi:csfloat:trades-fail:{steamId}` | /me/trades failed: don't retry (5 min, 15 after 429) |
| `skinroi:steaminv:{steamId}`     | Public Steam inventory for import (10 min TTL)   |
| `skinroi:snipes:deals`           | Current snipe candidates (30 min window)          |
| `skinroi:snipes:meta`            | Last scan time + per-source status                |
| `skinroi:snipes:lock`            | Scan lock (25s TTL)                               |
| `skinroi:snipes:ref:{name}`      | Cached CSPriceAPI row per item (5 min TTL)        |
| `skinroi:snipes:sdt:{name}`      | Cached SteamDT YouPin/Buff163 row (30 min TTL)    |
| `skinroi:snipes:steamdt:gate`    | SteamDT call gate (75s, longer after a limit answer) |
| `skinroi:snipes:steamdt:strikes` | SteamDT limit answers in a row (backoff)          |
| `skinroi:snipes:csfl:{key}`      | Cheapest CSFloat listings per item (30 min TTL)   |
| `skinroi:snipes:csfwant`         | Items waiting for an extension CSFloat lookup     |

## Hard Project Rules

Never commit secrets. Always pass linting before committing or pushing. Run:

```bash
npx eslint src/ --max-warnings=0
```

Fix every error and warning before proceeding. CI treats warnings as errors
(`CI=true`), so a clean local lint means a clean Vercel build.

Never hardcode color hex strings in components. Use the exported constants
from `src/themes/themes.js` instead:

- `PROFIT_COLOR` — green (`#22c55e`), matches Tailwind `text-profit`
- `LOSS_COLOR`   — red (`#ef4444`), matches Tailwind `text-loss`
- `WARN_COLOR`   — amber (`#f59e0b`), matches Tailwind `text-warn`
- `theme.dotColor` — the active theme's accent hex (use for inline `style={{ backgroundColor }}`)
- `SAP_CHART_COLORS` — named chart palette (use for chart series, not UI chrome)

## Known Caveats & Gotchas

### 1. Tailwind JIT — never use dynamic theme class strings for colors
Dynamic template literals like `` className={`${theme.dot}`} `` are not reliably
picked up by the Tailwind JIT compiler; the CSS class may never be generated.

**Wrong:**
```jsx
<span className={`h-2 w-2 rounded-full ${theme.dot}`} />
```

**Right — use inline style with the hex value:**
```jsx
<span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.dotColor }} />
```

This applies to any color-bearing theme token used dynamically (backgrounds,
borders, text). Static strings like `className="bg-blue-500"` are fine.

### 2. Theme system — two color fields per theme
Every theme in `src/themes/themes.js` has two representations of its accent color:

- `dot` — a Tailwind bg-class string (e.g. `"bg-amber-500"`). Only safe to use
  in static/predictable class positions where Tailwind will detect it at build time.
- `dotColor` — the raw hex string (e.g. `"#f59e0b"`). Use this for all dynamic
  or conditional color application via `style={{ backgroundColor: dotColor }}`.

When adding a new theme, always set both fields.

### 3. Deployment
The Vercel Hobby plan allows at most 12 serverless functions (every file under
`api/` outside `_lib/`). A 13th fails the deploy, so add new routes as methods
on an existing function instead of new files.

Pushing to `main` triggers an automatic Vercel production deploy — no manual
step required. To deploy manually:

```bash
vercel --prod
```

Environment variables (Redis, session secret) live in the Vercel project
settings and are never committed. Pull them locally with `vercel env pull`.

### 4. Extension trade detection reads Steam's trade offers
The extension reads accepted trades from `GetTradeOffers` and `GetTradeHistory`
with the session-derived token (no API key). There is no inventory diff or
baseline seed: the backend uses `pairedAt` to keep trades from before pairing
out of Handle Items, and `processedTradeIds` so a trade is only added once.
Re-installing or re-pairing the extension therefore doesn't lose or duplicate
trades.

### 5. Steam ID mismatch guard
The extension refuses to push if the Steam ID in the current browser session
(`steamLoginSecure` cookie) doesn't match the SkinROI-paired Steam ID. This
prevents pushing another user's inventory into the account if the user is
signed in to two Steam accounts across profiles.

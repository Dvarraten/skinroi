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
│   │   └── extension-store.js  Pairing codes + long-lived extension secrets
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
│   └── items/
│       └── index.js       GET/POST — load and save the tracked item portfolio
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
  modes to catch all state 3 (Accepted) trades — merged and deduped by
  `tradeofferid`
- Offers with `time_created < pairedAt` are filtered client-side; `time_updated`
  is unreliable because Steam bumps it when trade holds expire
- Item descriptions are sparse in offer responses, so the worker also pulls
  the user's inventory (ctx 2 + ctx 16) and keeps a persistent
  `classid_instanceid → { market_hash_name, icon_url }` cache in
  `chrome.storage.local`
- Pushes `{ offers: [{tradeofferid, items[]}], baseline }` to
  `POST /api/extension/trades` authenticated by `Authorization: Bearer {secret}`
- Backend dedupes by `tradeofferid` in `processedTradeIds`; respects
  `dismissedAssetIds` tombstones for user-dismissed items

**Item persistence**: Logged-in users → `GET/POST /api/items` backed by Redis.
Guest users → `localStorage` key `cs2-trading-items`.

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

### 1. CRLF line endings in HandleItemsModal.jsx
`src/components/HandleItemsModal.jsx` has Windows CRLF line endings. The Edit
tool fails silently or produces broken diffs on this file. Always use a Bash
Python one-liner instead:

```bash
python -c "
import re, pathlib
p = pathlib.Path('src/components/HandleItemsModal.jsx')
src = p.read_text(encoding='utf-8')
src = src.replace('OLD', 'NEW')
p.write_text(src, encoding='utf-8')
"
```

### 2. Tailwind JIT — never use dynamic theme class strings for colors
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

### 3. Theme system — two color fields per theme
Every theme in `src/themes/themes.js` has two representations of its accent color:

- `dot` — a Tailwind bg-class string (e.g. `"bg-amber-500"`). Only safe to use
  in static/predictable class positions where Tailwind will detect it at build time.
- `dotColor` — the raw hex string (e.g. `"#f59e0b"`). Use this for all dynamic
  or conditional color application via `style={{ backgroundColor: dotColor }}`.

When adding a new theme, always set both fields.

### 4. Deployment
Pushing to `main` triggers an automatic Vercel production deploy — no manual
step required. To deploy manually:

```bash
vercel --prod
```

Environment variables (Redis, session secret) live in the Vercel project
settings and are never committed. Pull them locally with `vercel env pull`.

### 5. Extension trade detection is inventory-diff based
The extension does not read Steam's trade offer history (which has an 8-day
cutoff and requires an API key). It compares full-inventory snapshots stored
in `chrome.storage.local` — new assetids become `incoming`, missing assetids
become `outgoing`. The first sync after install seeds the baseline silently
(no items emitted) so the user's existing inventory doesn't flood pending.

If a user re-installs the extension the baseline resets — the next Steam trade
will surface correctly, but any items received between install runs are lost
until they touch the inventory again.

### 6. Steam ID mismatch guard
The extension refuses to push if the Steam ID in the current browser session
(`steamLoginSecure` cookie) doesn't match the SkinROI-paired Steam ID. This
prevents pushing another user's inventory into the account if the user is
signed in to two Steam accounts across profiles.

# SkinROI Sync Extension

Browser extension that detects completed CS2 trades and pushes them to your
SkinROI portfolio's Handle Items queue.

## How it works

- **Background poll**: every 2 minutes the service worker calls Steam's
  `IEconService/GetTradeOffers/v1/` using a session-derived WebAPI token,
  extracts every accepted offer, and pushes new ones to SkinROI.
- **Dedup by tradeofferid**: Steam's canonical trade identifier is the
  dedup key, so a trade can never surface twice — no more "item reappears
  when its 7-day hold expires" bug.
- **Only post-pairing trades**: offers with `time_created < pairedAt` are
  filtered out client-side, so pairing the extension doesn't flood Handle
  Items with years of past trades.
- **Description resolution**: Steam's trade-offer API rarely ships
  descriptions, so the worker also fetches the user's inventory (ctx 2 +
  ctx 16) and maintains a persistent classid → name cache in
  `chrome.storage.local`. Outgoing items still get real names.

Auth to SkinROI is a per-user secret from a one-time pairing flow (see below).
No Steam credentials leave your browser — the extension uses your existing
Steam session cookies.

## Load unpacked (development)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select this `extension/` directory
4. The SkinROI icon appears in your toolbar

## Pair with your SkinROI account

1. Open your SkinROI site (default `https://skinroi.vercel.app`, or your
   dev URL via the popup's Advanced section)
2. Sign in via Steam
3. Open **Connect Extension** and copy the 8-character code
4. Click the extension icon, paste the code, hit **Pair**
5. The popup switches to "Active" and starts polling on the next tick

## Icons

Icon files are not included in the repo — before publishing to the Chrome
Web Store, drop `16.png`, `48.png`, and `128.png` into `extension/icons/`.
For local development Chrome shows a default puzzle-piece icon.

## Directory layout

```
extension/
├── manifest.json         Manifest V3
├── src/
│   ├── background.js     Service worker — polls Steam every 2 min
│   ├── popup/            Extension popup UI (pairing + activity log)
│   └── lib/
│       ├── config.js     Endpoints, storage keys
│       ├── skinroi.js    SkinROI API client (Bearer secret auth)
│       ├── steam.js      Session token + GetTradeOffers + normalizer
│       └── storage.js    chrome.storage.local wrapper (pairing, desc cache)
```

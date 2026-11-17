// Example Steam trades for demo mode, so visitors can try the Trades page:
// add an incoming item to the portfolio, or match an outgoing one to an item
// they hold and mark it sold. Same shape as the pending list from
// /api/inventory/state. Demo trades only live in React state (useSteamSync
// never sends a demo dismiss to the server).
import { demoIconPath } from './demoImages';

const MIN = 60 * 1000;

// [type, name, minutes ago, float, paint seed, CSFloat price (USD) or null, stickers]
const TRADES = [
  ['incoming', '★ M9 Bayonet | Lore (Field-Tested)', 18, 0.2214, 412, 498.6, []],
  ['incoming', 'M4A4 | The Emperor (Field-Tested)', 42, 0.1873, 77, null,
    ['Natus Vincere | Katowice 2019', 'Crown (Foil)']],
  ['incoming', 'AWP | Atheris (Field-Tested)', 95, null, null, null, []],
  ['incoming', 'AWP | Atheris (Field-Tested)', 95, null, null, null, []],
  ['incoming', 'AK-47 | Neon Rider (Minimal Wear)', 260, 0.0912, 655, 62.4, []],
  // These match items in the demo portfolio, so "Tracked match" finds them.
  ['outgoing', 'AWP | Asiimov (Field-Tested)', 25, 0.2861, 318, 121.9, []],
  ['outgoing', 'AK-47 | Vulcan (Minimal Wear)', 130, 0.1107, 902, null, []],
  ['outgoing', 'USP-S | Kill Confirmed (Minimal Wear)', 300, 0.0874, 140, null, []],
];

export function buildDemoTrades(now = Date.now()) {
  return TRADES.map(([type, marketHashName, minutesAgo, floatValue, paintSeed, csfloatPrice, stickers], i) => ({
    assetid: `demo-${i + 1}`,
    type,
    marketHashName,
    iconUrl: demoIconPath(marketHashName),
    detectedAt: new Date(now - minutesAgo * MIN).toISOString(),
    tradeid: `demo-trade-${i + 1}`,
    ...(floatValue != null ? { floatValue } : {}),
    ...(paintSeed != null ? { paintSeed } : {}),
    ...(csfloatPrice != null ? { csfloatPrice } : {}),
    ...(stickers.length ? { stickers: stickers.map((name, j) => ({ stickerId: 9000 + j, name })) } : {}),
    demo: true,
  }));
}

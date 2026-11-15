// Example deals for the logged-out Snipes preview. They show the moment the
// page opens, so the first look is never an empty list or a spinner, and stay
// until the server's delayed demo feed (GET /api/snipes?demo=1) has real deals.
// Prices are made up but realistic; the page does the fee and ROI math on
// them like on real deals.
import { demoImage } from './demoImages';

const MIN = 60 * 1000;

// [name, buy market, buy price USD, float, minutes ago, YouPin ask, Buff163 ask, CSFloat lowest]
const DEALS = [
  ['★ Butterfly Knife | Doppler (Factory New)', 'csfloat', 1342.0, 0.0071, 17, 1489.5, 1462.0, 1455.0],
  ['AK-47 | Asiimov (Field-Tested)', 'dmarket', 41.2, 0.2533, 19, 46.9, 45.8, 47.5],
  ['★ Specialist Gloves | Fade (Field-Tested)', 'csfloat', 489.0, 0.2911, 21, 541.0, 535.5, 552.0],
  ['M4A1-S | Printstream (Minimal Wear)', 'csfloat', 152.4, 0.0815, 23, 168.9, 166.2, 171.0],
  ['AWP | Hyper Beast (Field-Tested)', 'dmarket', 27.9, 0.2304, 24, 31.4, 30.9, 31.8],
  ['AK-47 | Redline (Field-Tested)', 'csfloat', 31.0, 0.2712, 26, 35.2, 34.6, 35.8],
  ['★ Skeleton Knife | Case Hardened (Field-Tested)', 'csfloat', 612.0, 0.2196, 28, 668.0, 659.0, 681.0],
  ['M4A4 | Neo-Noir (Field-Tested)', 'dmarket', 14.3, 0.2689, 31, 15.9, 15.7, 16.2],
  ['Desert Eagle | Code Red (Field-Tested)', 'csfloat', 21.6, 0.3012, 33, 23.9, 23.4, 24.1],
  ['AK-47 | Fuel Injector (Field-Tested)', 'csfloat', 38.5, 0.2401, 36, 42.6, 41.9, 43.0],
  ['USP-S | Neo-Noir (Field-Tested)', 'dmarket', 11.2, 0.2245, 38, 12.5, 12.3, 12.7],
  ['M4A1-S | Player Two (Field-Tested)', 'csfloat', 19.8, 0.1987, 41, 22.1, 21.6, 22.4],
];

// Busy YouPin / Buff163 market: lots of buy orders close to the lowest ask,
// so the liquidity score clears the page's 75 minimum.
const askRef = (priceUsd, i, now) => ({
  priceUsd,
  askUsd: priceUsd,
  bidUsd: Math.round(priceUsd * 0.965 * 100) / 100,
  bidCount: 140 + i * 23,
  count: 260 + i * 31,
  change7d: 2.4 - (i % 5),
  updatedAt: now - (4 + (i % 6)) * MIN,
});

export function buildDemoSnipes(now = Date.now()) {
  return DEALS.map(([name, market, priceUsd, float, minutesAgo, youpin, buff, csfloat], i) => ({
    id: `demo-${i + 1}`,
    name,
    market,
    priceUsd,
    float,
    image: demoImage(name),
    seenAt: now - minutesAgo * MIN,
    refs: {
      youpin: askRef(youpin, i, now),
      buff163: askRef(buff, i + 2, now),
      csfloat: { priceUsd: csfloat, sales: 60 + i * 7, steamVolume: 70 + i * 11, updatedAt: now - 9 * MIN },
    },
    example: true,
  }));
}

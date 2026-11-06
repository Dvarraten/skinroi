// Example portfolio for demo mode (logged-out visitors trying the app).
// Built fresh on every call with dates relative to today so the charts and
// "Recent sales" always look current. Demo items only ever live in React
// state: useItems never saves them to localStorage or /api/items.
import { getPlatformFee } from './platformFees';

const DAY = 24 * 60 * 60 * 1000;

// [name, buy USD, buy platform, days ago bought, float, sale USD, sell platform, days ago sold]
const ACTIVE = [
  ['★ Karambit | Doppler (Factory New)', 812.4, 'buff163', 4, 0.0123],
  ['AWP | Asiimov (Field-Tested)', 104.9, 'csfloat', 9, 0.2861],
  ['M4A1-S | Printstream (Minimal Wear)', 168.25, 'youpin', 12, 0.0942],
  ['AK-47 | Vulcan (Minimal Wear)', 231.0, 'csfloat', 16, 0.1107],
  ['Desert Eagle | Blaze (Factory New)', 412.75, 'buff163', 21, 0.0281],
  ['USP-S | Kill Confirmed (Minimal Wear)', 61.3, 'dmarket', 27, 0.0874],
  ['★ Sport Gloves | Vice (Field-Tested)', 1188.0, 'youpin', 33, 0.2245],
  ['AK-47 | Slate (Field-Tested)', 4.12, 'csfloat', 2, 0.2511],
];

const SOLD = [
  ['AK-47 | Redline (Field-Tested)', 31.8, 'csfloat', 58, 0.2398, 38.9, 'csfloat', 41],
  ['AWP | Neo-Noir (Field-Tested)', 42.1, 'buff163', 55, 0.1829, 49.5, 'csfloat', 37],
  ['Glock-18 | Fade (Factory New)', 1420.0, 'youpin', 52, 0.0144, 1585.0, 'csfloat', 30],
  ['M4A1-S | Hyper Beast (Field-Tested)', 18.4, 'dmarket', 48, 0.2077, 17.1, 'buff163', 26],
  ['AK-47 | Bloodsport (Minimal Wear)', 92.6, 'buff163', 40, 0.1032, 109.0, 'youpin', 19],
  ['Desert Eagle | Printstream (Field-Tested)', 58.9, 'csfloat', 35, 0.1856, 66.2, 'csfloat', 14],
  ['AWP | Chromatic Aberration (Field-Tested)', 14.75, 'youpin', 29, 0.1934, 17.9, 'csfloat', 9],
  ['StatTrak™ AK-47 | Redline (Field-Tested)', 88.0, 'csfloat', 24, 0.2214, 84.5, 'buff163', 6],
  ['USP-S | Printstream (Minimal Wear)', 121.5, 'buff163', 18, 0.0811, 139.0, 'csfloat', 3],
  ['★ Butterfly Knife | Fade (Factory New)', 2310.0, 'youpin', 15, 0.0098, 2549.0, 'csfloat', 1],
];

const isoDay = (ms) => new Date(ms).toISOString().split('T')[0];

export function buildDemoPortfolio(now = Date.now()) {
  let id = 1;
  const active = ACTIVE.map(([itemName, purchasePrice, platform, boughtAgo, floatValue]) => {
    const acquiredAt = now - boughtAgo * DAY;
    return {
      id: id++,
      itemName,
      purchasePrice,
      notes: '',
      datePurchased: isoDay(acquiredAt),
      acquiredAt,
      sold: false,
      salePrice: null,
      platform,
      profit: null,
      profitPercent: null,
      pending: false,
      expectedDelivery: null,
      iconUrl: null,
      floatValue,
      demo: true,
    };
  });

  // One item still on trade hold, so the hold badge shows up too.
  active[7] = { ...active[7], pending: true, expectedDelivery: now + 5 * DAY };

  const sold = SOLD.map(([itemName, purchasePrice, platform, boughtAgo, floatValue, salePrice, soldPlatform, soldAgo]) => {
    const acquiredAt = now - boughtAgo * DAY;
    const soldAt = now - soldAgo * DAY;
    const profit = salePrice * (1 - getPlatformFee(soldPlatform)) - purchasePrice;
    return {
      id: id++,
      itemName,
      purchasePrice,
      notes: '',
      datePurchased: isoDay(acquiredAt),
      acquiredAt,
      sold: true,
      salePrice,
      soldPlatform,
      profit,
      profitPercent: (profit / purchasePrice) * 100,
      dateSold: isoDay(soldAt),
      soldAt,
      platform,
      pending: false,
      expectedDelivery: null,
      iconUrl: null,
      floatValue,
      demo: true,
    };
  });

  return [...active, ...sold];
}

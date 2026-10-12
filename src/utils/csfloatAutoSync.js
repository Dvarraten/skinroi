// Decides which pending Handle Items entries can be resolved automatically
// from CSFloat trade data (`csfloatPrice`, attached by /api/inventory/state).
//
//   incoming + csfloatPrice → add to the portfolio at the CSFloat price
//   outgoing + csfloatPrice → mark the matching portfolio item sold, but only
//                             when exactly one unsold item is the same copy
//
// "Same copy" means the same Steam assetid (stored on items added through
// Handle Items), or for older items without an assetid: same name, same exact
// float and same paint seed. Anything less certain is left in Handle Items
// for the user, so an overpaid pattern never gets sold as a different copy.

export const STEAM_IMG_BASE = 'https://community.akamai.steamstatic.com/economy/image/';

const hasPrice = (e) => typeof e?.csfloatPrice === 'number' && e.csfloatPrice > 0;

const isOpenItem = (it) => it && !it.sold && !it.isTransaction;

function sameCopy(item, entry) {
  if (item.assetid != null) return String(item.assetid) === String(entry.assetid);
  if (typeof entry.floatValue !== 'number' || typeof item.floatValue !== 'number') return false;
  return (
    item.itemName === entry.marketHashName &&
    item.floatValue === entry.floatValue &&
    (item.paintSeed ?? null) === (entry.paintSeed ?? null)
  );
}

// Returns { adds: entry[], sells: { entry, itemId }[] }. `skip` is a Set of
// `${type}:${assetid}` keys already handled this session.
export function planCsfloatAutoSync(pending, items, skip = new Set()) {
  const adds = [];
  const sells = [];
  if (!Array.isArray(pending) || !Array.isArray(items)) return { adds, sells };

  const knownAssetIds = new Set(
    items.filter((it) => it?.assetid != null).map((it) => String(it.assetid))
  );
  const claimed = new Set();

  for (const entry of pending) {
    if (!hasPrice(entry) || entry.assetid == null) continue;
    if (skip.has(`${entry.type}:${entry.assetid}`)) continue;

    if (entry.type === 'incoming') {
      // Already in the portfolio (e.g. a dismiss that didn't reach the server
      // before a reload): don't add it twice.
      if (knownAssetIds.has(String(entry.assetid))) continue;
      adds.push(entry);
    } else if (entry.type === 'outgoing') {
      const matches = items.filter(
        (it) => isOpenItem(it) && !claimed.has(it.id) && sameCopy(it, entry)
      );
      if (matches.length !== 1) continue;
      claimed.add(matches[0].id);
      sells.push({ entry, itemId: matches[0].id });
    }
  }
  return { adds, sells };
}

const detectedMs = (e) => {
  const t = e?.detectedAt ? new Date(e.detectedAt).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
};

// Portfolio payload for addItemDirect, mirroring a manual add in Handle Items.
export function addPayloadFor(entry) {
  return {
    itemName: entry.marketHashName,
    purchasePrice: entry.csfloatPrice,
    acquiredAt: detectedMs(entry) || null,
    platform: 'csfloat',
    notes: '',
    iconUrl: entry.iconUrl ? `${STEAM_IMG_BASE}${entry.iconUrl}/96fx96f` : null,
    floatValue: entry.floatValue,
    paintSeed: entry.paintSeed,
    paintIndex: entry.paintIndex,
    defIndex: entry.defIndex,
    stickers: entry.stickers,
    keychains: entry.keychains,
    assetid: entry.assetid,
  };
}

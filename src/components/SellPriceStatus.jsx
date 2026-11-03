// One-line note next to "Active items" when YouPin / CSFloat sell prices can't
// be shown: a market that failed (e.g. SteamDT key missing, CSFloat 429), or
// no fresh prices at all. Silent when all is well.
import React from "react";
import { SELL_PRICE_MARKETS, SELL_PRICE_MAX_AGE_MS } from "../utils/sellPrices";

export default function SellPriceStatus({ sellPrices, hasItems }) {
  if (!sellPrices || !hasItems) return null;
  const now = Date.now();
  const { prices = {}, status = {} } = sellPrices;

  const problems = SELL_PRICE_MARKETS
    .map((m) => ({ ...m, s: status[m.id] }))
    .filter(({ s }) => s && s.ok === false && now - s.at < SELL_PRICE_MAX_AGE_MS)
    .map(({ label, s }) => `${label}: ${s.error}`);

  const anyFresh = Object.values(prices).some((entry) =>
    SELL_PRICE_MARKETS.some((m) => entry?.[m.id]?.at && now - entry[m.id].at <= SELL_PRICE_MAX_AGE_MS)
  );
  if (!problems.length && !anyFresh) {
    problems.push("Sell prices: none yet (CSFloat needs the SkinROI extension running)");
  }
  if (!problems.length) return null;

  const text = problems.join(" · ");
  return (
    <span title={text} className="text-xs text-warn truncate min-w-0">
      · {text}
    </span>
  );
}

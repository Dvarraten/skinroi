// One-line note next to "Active items" when Buff / CSFloat sell prices can't
// be shown: a market the extension failed on (e.g. not signed in to Buff), or
// no fresh prices at all (extension not running). Silent when all is well.
import React from "react";
import { SELL_PRICE_MARKETS, SELL_PRICE_MAX_AGE_MS } from "../utils/sellPrices";

export default function SellPriceStatus({ sellPrices, hasItems }) {
  if (!sellPrices || !hasItems) return null;
  const now = Date.now();
  const { prices = {}, status = {} } = sellPrices;

  const problems = SELL_PRICE_MARKETS
    .map((m) => ({ ...m, s: status[m.id] }))
    .filter(({ s }) => s && !s.ok && now - s.at < SELL_PRICE_MAX_AGE_MS)
    .map(({ label, s }) => `${label}: ${s.error}`);

  const anyFresh = Object.values(prices).some((entry) =>
    SELL_PRICE_MARKETS.some((m) => entry?.[m.id]?.at && now - entry[m.id].at <= SELL_PRICE_MAX_AGE_MS)
  );
  if (!problems.length && !anyFresh) {
    problems.push("Sell prices: waiting for the SkinROI extension (is Chrome open?)");
  }
  if (!problems.length) return null;

  const text = problems.join(" · ");
  return (
    <span title={text} className="text-[11px] text-warn truncate min-w-0">
      · {text}
    </span>
  );
}

// PROTOTYPE — Analytics: did the snipes you bought actually pay off?
// Items bought through Snipes carry `snipe` (expected sell price, profit,
// ROI); here they're compared with what they really sold for.
import React, { useMemo } from "react";
import { PlatformBadge } from "./PlatformBadge";

const money = (n) => Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n) => `${n >= 0 ? "+" : "−"}$${money(n)}`;
const tone = (n) => (n >= 0 ? "text-profit" : "text-loss");

export default function SnipeOutcomes({ items, theme }) {
  const snipes = useMemo(
    () => items.filter((i) => i.snipe).sort((a, b) => (b.snipe.boughtAt || 0) - (a.snipe.boughtAt || 0)),
    [items]
  );
  if (!snipes.length) {
    return (
      <div className={`py-8 text-center text-sm rounded-xl border border-dashed ${theme.cardBorder} ${theme.subtext}`}>
        Click Buy on a snipe and answer "Yes, track it" to see here whether it paid off.
      </div>
    );
  }
  const sold = snipes.filter((i) => i.sold);
  const realised = sold.reduce((s, i) => s + (i.profit ?? 0), 0);
  const expected = sold.reduce((s, i) => s + (i.snipe.expectedProfitUsd ?? 0), 0);
  const hits = sold.filter((i) => (i.profit ?? 0) > 0).length;
  const openExpected = snipes.filter((i) => !i.sold).reduce((s, i) => s + (i.snipe.expectedProfitUsd ?? 0), 0);

  const fig = (label, value, sub, cls = theme.text) => (
    <div className={`py-3 pr-4 sm:pl-5 sm:first:pl-0 sm:border-l sm:first:border-l-0 ${theme.cardBorder}`}>
      <p className={`text-xs ${theme.subtext}`}>{label}</p>
      <p className={`mt-1 text-lg font-mono font-medium leading-tight ${cls}`}>{value}</p>
      <p className={`mt-0.5 text-[11px] ${theme.subtext}`}>{sub}</p>
    </div>
  );

  return (
    <div>
      <div className={`grid grid-cols-2 sm:grid-cols-4 border-y ${theme.cardBorder}`}>
        {fig("Snipes bought", snipes.length, `${sold.length} sold · ${snipes.length - sold.length} holding`)}
        {fig("Realised", signed(realised), `expected ${signed(expected)}`, tone(realised))}
        {fig("Hit rate", sold.length ? `${Math.round((hits / sold.length) * 100)}%` : "—", "sold at a profit")}
        {fig("Still to come", signed(openExpected), "expected on held snipes", theme.textSecondary)}
      </div>

      <div className="mt-4">
        <div className={`hidden md:flex items-center gap-4 px-1 pb-2 text-[11px] ${theme.subtext}`}>
          <span className="flex-1">Item</span>
          <span className="w-24 text-right">Paid</span>
          <span className="w-28 text-right">Expected</span>
          <span className="w-28 text-right">Actual</span>
          <span className="w-20 text-right">vs plan</span>
        </div>
        {snipes.slice(0, 8).map((i) => {
          const exp = i.snipe.expectedProfitUsd ?? 0;
          const diff = i.sold ? (i.profit ?? 0) - exp : null;
          return (
            <div key={i.id} className={`flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-1 px-1 py-2.5 border-t ${theme.cardBorder}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] truncate ${theme.text}`}>{i.itemName}</p>
                <p className={`text-[11px] ${theme.subtext} flex items-center gap-1.5`}>
                  <PlatformBadge platform={i.platform} size="xs" /> → <PlatformBadge platform={i.snipe.sellMarket} size="xs" />
                  <span>{new Date(i.snipe.boughtAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </p>
              </div>
              <span className={`w-24 text-right text-[13px] font-mono ${theme.textSecondary}`}>${money(i.purchasePrice)}</span>
              <span className={`w-28 text-right text-[13px] font-mono ${theme.subtext}`}>{signed(exp)}</span>
              <span className={`w-28 text-right text-[13px] font-mono ${i.sold ? tone(i.profit ?? 0) : theme.subtext}`}>
                {i.sold ? signed(i.profit ?? 0) : i.pending ? "On hold" : "Holding"}
              </span>
              <span className={`w-20 text-right text-[12px] font-mono ${diff == null ? theme.subtext : tone(diff)}`}>
                {diff == null ? "—" : signed(diff)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

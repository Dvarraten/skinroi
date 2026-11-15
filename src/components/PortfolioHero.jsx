// Top of the Portfolio page: the holding value as the one big number, the
// all-time profit curve beside it, and a ruled row of secondary figures.
import React, { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { PROFIT_COLOR, LOSS_COLOR } from "../themes/themes";
import { Bone } from "./Skeleton";

const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n) => `${n >= 0 ? "+" : "−"}$${money(Math.abs(n))}`;

function Stat({ theme, label, value, sub, tone = "", loading }) {
  return (
    <div className={`py-3 pr-4 sm:pl-5 sm:first:pl-0 sm:border-l sm:first:border-l-0 ${theme.cardBorder}`}>
      <p className={`text-xs ${theme.subtext}`}>{label}</p>
      {loading ? (
        <span className="motion-safe:animate-pulse block mt-1.5 mb-0.5"><Bone theme={theme} className="h-5 w-20" /></span>
      ) : (
        <p className={`mt-1 text-lg font-mono font-medium leading-tight ${tone || theme.text}`}>{value}</p>
      )}
      <p className={`mt-0.5 text-[11px] ${theme.subtext}`}>{sub}</p>
    </div>
  );
}

export default function PortfolioHero({ stats, profitChartData, theme, loading = false }) {
  const profit = stats.totalProfit;
  const roi = stats.totalInvested > 0 ? (profit / stats.totalInvested) * 100 : 0;

  const cumulativeData = useMemo(() =>
    profitChartData.reduce((acc, d) => {
      const prev = acc[acc.length - 1]?.cumulative ?? 0;
      return [...acc, { ...d, cumulative: Math.round((prev + d.profit) * 100) / 100 }];
    }, []),
  [profitChartData]);

  // Colour follows the curve's end value, so line and fill agree with it.
  const lastCumulative = cumulativeData.length > 0
    ? cumulativeData[cumulativeData.length - 1].cumulative
    : profit;
  const chartColor = lastCumulative >= 0 ? PROFIT_COLOR : LOSS_COLOR;
  const [whole, cents] = money(stats.totalActive).split(".");

  return (
    <section aria-label="Portfolio summary">
      <div className="flex flex-col lg:flex-row lg:items-end gap-x-10 gap-y-4">
        <div className="shrink-0">
          <p className={`text-[13px] ${theme.subtext}`}>Holding value</p>
          {loading ? (
            <div className="motion-safe:animate-pulse mt-3 space-y-3">
              <Bone theme={theme} className="h-11 w-56" />
              <Bone theme={theme} className="h-4 w-40" />
            </div>
          ) : (<>
            <p className={`mt-2 font-mono font-medium tracking-tight leading-none text-[44px] md:text-[56px] ${theme.text}`}>
              ${whole}<span className={`text-[0.5em] ${theme.subtext}`}>.{cents}</span>
            </p>
            <p className={`mt-3 text-[13px] ${theme.subtext}`}>
              <span className={`font-mono font-medium ${profit >= 0 ? "text-profit" : "text-loss"}`}>
                {signed(profit)}
              </span>{" "}
              realised
              <span className="mx-2 opacity-40">·</span>
              <span className={`font-mono font-medium ${roi >= 0 ? "text-profit" : "text-loss"}`}>
                {roi >= 0 ? "+" : "−"}{Math.abs(roi).toFixed(1)}%
              </span>{" "}
              return
            </p>
          </>)}
        </div>

        <div className="w-full lg:w-auto lg:flex-1 min-w-0 shrink-0 h-[96px] md:h-[116px]">
          {loading ? null : cumulativeData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%" style={{ pointerEvents: "none" }}>
              <AreaChart data={cumulativeData} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={chartColor}
                  strokeWidth={1.75}
                  fill="url(#heroGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={`h-full flex items-center lg:justify-end text-xs ${theme.subtext}`}>
              Your profit curve appears here after the first sale.
            </div>
          )}
        </div>
      </div>

      <div className={`mt-6 grid grid-cols-2 sm:grid-cols-4 border-y ${theme.cardBorder}`}>
        <Stat theme={theme} loading={loading} label="Invested" value={`$${money(stats.totalInvested)}`} sub="all time" />
        <Stat theme={theme} loading={loading} label="Sold for" value={`$${money(stats.totalSold)}`} sub={loading ? "sales" : `${stats.totalSoldCount} sales`} />
        <Stat theme={theme} loading={loading} label="Holding" value={stats.totalActiveCount} sub="items" />
        <Stat
          theme={theme} loading={loading} label="On trade hold" value={stats.totalPending}
          tone={stats.totalPending > 0 ? "text-warn" : ""} sub="incoming"
        />
      </div>
    </section>
  );
}

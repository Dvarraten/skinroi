// Portfolio summary at the top of Home: the headline value with its return,
// the P&L sparkline, and three supporting numbers.
import React, { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PROFIT_COLOR, LOSS_COLOR } from "../themes/themes";
import { Bone } from "./Skeleton";
import { formatUsd, formatSignedUsd, formatSignedPercent } from "../utils/format";

function Metric({ label, value, hint, tone, loading, theme }) {
  return (
    <div className={`px-3 md:px-5 py-3 flex flex-col justify-center gap-1 min-w-0 border-l first:border-l-0 md:first:border-l ${theme.cardBorder}`}>
      <p className={`text-xs font-medium ${theme.subtext}`}>{label}</p>
      {loading ? (
        <span className="motion-safe:animate-pulse block py-0.5"><Bone theme={theme} className="h-4 w-14" /></span>
      ) : (
        <p className={`text-base md:text-lg font-mono font-semibold tabular-nums leading-none truncate ${tone === 'warn' ? 'text-warn' : theme.text}`}>
          {value}
        </p>
      )}
      <p className={`text-xs ${theme.subtext} truncate`}>{hint}</p>
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

  // Derive color from the chart's actual end value so the gradient matches
  // what the line shows, not the overall portfolio total.
  const lastCumulative = cumulativeData.length > 0
    ? cumulativeData[cumulativeData.length - 1].cumulative
    : profit;
  const isGain = lastCumulative >= 0;
  const chartColor = isGain ? PROFIT_COLOR : LOSS_COLOR;

  return (
    <section
      aria-label="Portfolio summary"
      className={`w-full rounded-xl border ${theme.cardBorder} ${theme.card} flex flex-col md:flex-row md:items-stretch overflow-hidden`}
    >
      <div className="flex items-stretch flex-1 min-w-0">
        {/* Lead — headline value + realised return */}
        <div className="px-4 md:px-5 py-4 flex flex-col justify-center gap-2 shrink-0">
          <p className={`text-xs font-medium ${theme.subtext}`}>Holding value</p>
          {loading ? (
            <div className="motion-safe:animate-pulse space-y-2 py-0.5">
              <Bone theme={theme} className="h-7 w-32" />
              <Bone theme={theme} className="h-4 w-24 rounded-full" />
            </div>
          ) : (<>
          <p className={`text-[28px] font-semibold font-mono tracking-tight ${theme.text} tabular-nums leading-none`}>
            {formatUsd(stats.totalActive)}
          </p>
          <div
            title="Realised profit on everything sold so far"
            className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-1 rounded-full w-fit ${
              isGain ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
            }`}
          >
            {isGain ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {formatSignedUsd(profit)}
            <span className="opacity-50">·</span>
            {formatSignedPercent(roi)}
            <span className={`font-sans font-medium ${theme.subtext}`}>realised</span>
          </div>
          </>)}
        </div>

        {/* Chart — cumulative realised P&L, fills the space in between */}
        <div className="flex-1 min-w-[80px] flex items-center">
          {loading ? (
            <div className="w-full h-[88px]" />
          ) : cumulativeData.length > 1 ? (
            <ResponsiveContainer width="100%" height={88} style={{ pointerEvents: 'none' }}>
              <AreaChart data={cumulativeData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={chartColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill="url(#heroGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-[88px] flex items-center justify-center px-4">
              <p className={`text-xs text-center ${theme.subtext}`}>Sell items to see P&L history</p>
            </div>
          )}
        </div>
      </div>

      {/* Supporting numbers */}
      <div className={`grid grid-cols-3 shrink-0 border-t md:border-t-0 ${theme.cardBorder}`}>
        <Metric theme={theme} loading={loading} label="Sold for" value={formatUsd(stats.totalSold)} hint={loading ? "items sold" : `${stats.totalSoldCount} items sold`} />
        <Metric theme={theme} loading={loading} label="On trade hold" value={stats.totalPending} tone={stats.totalPending > 0 ? 'warn' : null} hint="not tradeable yet" />
        <Metric theme={theme} loading={loading} label="Active" value={stats.totalActiveCount} hint="items held" />
      </div>
    </section>
  );
}

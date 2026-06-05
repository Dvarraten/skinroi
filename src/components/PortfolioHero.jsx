// Full-width portfolio hero band: lead value + P&L area chart + secondary metrics.
import React, { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PROFIT_COLOR, LOSS_COLOR } from "../themes/themes";

export default function PortfolioHero({ stats, profitChartData, theme }) {
  const profit = stats.totalProfit;
  const roi = stats.totalInvested > 0 ? (profit / stats.totalInvested) * 100 : 0;
  const isGain = profit >= 0;
  const chartColor = isGain ? PROFIT_COLOR : LOSS_COLOR;

  const cumulativeData = useMemo(() =>
    profitChartData.reduce((acc, d) => {
      const prev = acc[acc.length - 1]?.cumulative ?? 0;
      return [...acc, { ...d, cumulative: Math.round((prev + d.profit) * 100) / 100 }];
    }, []),
  [profitChartData]);

  return (
    <section className={`rounded-xl border ${theme.cardBorder} ${theme.card} flex items-stretch overflow-hidden`}>

      {/* Lead — headline value + delta chip */}
      <div className="px-4 py-3 flex flex-col justify-center gap-1.5 shrink-0 min-w-[170px]">
        <p className={`text-[9px] font-semibold uppercase tracking-widest ${theme.subtext}`}>
          Holding value
        </p>
        <p className={`text-2xl font-bold font-mono ${theme.text} tabular-nums leading-none`}>
          ${stats.totalActive.toFixed(2)}
        </p>
        <div className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-full w-fit ${
          isGain ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
        }`}>
          {isGain ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {isGain ? '+' : ''}{roi.toFixed(1)}%
          <span className="opacity-40 mx-0.5">·</span>
          {isGain ? '+' : ''}${Math.abs(profit).toFixed(2)}
        </div>
      </div>

      {/* Chart — centrepiece, takes all remaining width */}
      <div className="flex-1 min-w-0 flex items-center">
        {cumulativeData.length > 1 ? (
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={cumulativeData} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
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
          <div className="w-full h-[80px] flex items-center justify-center">
            <p className={`text-xs ${theme.subtext}`}>Sell items to see P&L history</p>
          </div>
        )}
      </div>

      {/* Secondary metrics — separated by hairline dividers */}
      <div className="flex items-stretch shrink-0">
        <div className={`border-l ${theme.cardBorder} px-4 py-3 flex flex-col justify-center gap-0.5 min-w-[100px]`}>
          <p className={`text-[9px] font-semibold uppercase tracking-wide ${theme.subtext}`}>Realised</p>
          <p className={`text-base font-mono font-semibold ${theme.text} tabular-nums leading-none`}>
            ${stats.totalSold.toFixed(2)}
          </p>
          <p className={`text-[11px] ${theme.subtext}`}>{stats.totalSoldCount} sold</p>
        </div>
        <div className={`border-l ${theme.cardBorder} px-4 py-3 flex flex-col justify-center gap-0.5 min-w-[80px]`}>
          <p className={`text-[9px] font-semibold uppercase tracking-wide ${theme.subtext}`}>Pending</p>
          <p className="text-base font-mono font-semibold text-warn tabular-nums leading-none">
            {stats.totalPending}
          </p>
          <p className={`text-[11px] ${theme.subtext}`}>incoming</p>
        </div>
        <div className={`border-l ${theme.cardBorder} px-4 py-3 flex flex-col justify-center gap-0.5 min-w-[80px]`}>
          <p className={`text-[9px] font-semibold uppercase tracking-wide ${theme.subtext}`}>Active</p>
          <p className={`text-base font-mono font-semibold ${theme.text} tabular-nums leading-none`}>
            {stats.totalActiveCount}
          </p>
          <p className={`text-[11px] ${theme.subtext}`}>items held</p>
        </div>
      </div>
    </section>
  );
}

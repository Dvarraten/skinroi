// Analytics page — cumulative P&L line chart (7d / 30d / all-time),
// weekly and monthly profit summaries, and a 30-day sale heatmap.
import React, { useMemo } from "react";
import { PROFIT_COLOR, LOSS_COLOR } from "../themes/themes";
import { Page, PageHeader, StatCard } from "../components/ui/Page";
import Segmented from "../components/ui/Segmented";
import { formatUsd, formatSignedUsd } from "../utils/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AnalyticsPage({
  profitChartData,
  chartPeriod,
  setChartPeriod,
  stats = {},
  theme,
  items = [],
}) {
  const totalInvested = stats?.totalInvested ?? 0;
  const totalProfit = stats?.totalProfit ?? 0;
  // Cumulative profit over the filtered period
  const cumulativeData = useMemo(
    () =>
      profitChartData.reduce((acc, d) => {
        const prev = acc[acc.length - 1]?.cumulative ?? 0;
        return [
          ...acc,
          { ...d, cumulative: Math.round((prev + d.profit) * 100) / 100 },
        ];
      }, []),
    [profitChartData],
  );

  const totalInPeriod = profitChartData.reduce((s, d) => s + d.profit, 0);

  // Win rate
  const soldItems = items.filter((i) => i.sold);
  const winRate =
    soldItems.length > 0
      ? `${Math.round((soldItems.filter((i) => i.profit > 0).length / soldItems.length) * 100)}%`
      : "—";

  // Heatmap — last 90 days from items directly
  const heatmapDays = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!it.sold || !it.dateSold) continue;
      const key = it.dateSold.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + (it.profit ?? 0));
    }
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split("T")[0];
      return { date: key, profit: map.get(key) ?? 0 };
    });
  }, [items]);

  const maxAbs = Math.max(...heatmapDays.map((d) => Math.abs(d.profit)), 0.01);

  const PERIODS = [
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "all", label: "All time" },
  ];
  const periodLabel = PERIODS.find((p) => p.key === chartPeriod)?.label.toLowerCase() || '';

  return (
    <Page width="max-w-5xl">
      <PageHeader
        title="Analytics"
        description="Profit on everything you have sold, after platform fees."
      />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Invested" value={formatUsd(totalInvested)} hint="all purchases" />
        <StatCard label="Total profit" value={formatSignedUsd(totalProfit)} tone={totalProfit >= 0 ? 'profit' : 'loss'} hint={`${soldItems.length} sold`} />
        <StatCard label="Profitable sales" value={winRate} hint="share of sales with a profit" />
      </div>

      <section className={`${theme.panel} border ${theme.panelBorder} rounded-2xl`}>
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 border-b ${theme.panelBorder}`}>
          <h2 className={`text-[15px] font-semibold ${theme.text}`}>Profit over time</h2>
          <span
            className={`text-sm font-mono font-semibold ${totalInPeriod >= 0 ? "text-profit" : "text-loss"}`}
            title={`Profit, ${periodLabel}`}
          >
            {formatSignedUsd(totalInPeriod)}
          </span>
          <Segmented
            label="Period"
            className="ml-auto"
            items={PERIODS.map((p) => ({ key: p.key, label: p.label, active: chartPeriod === p.key, onClick: () => setChartPeriod(p.key) }))}
          />
        </div>

        <div className="p-5 space-y-6">
          {/* Cumulative line chart */}
          <div className="h-60">
            {cumulativeData.length === 0 ? (
              <div className={`h-full flex items-center justify-center text-sm ${theme.subtext}`}>
                No sales in this period yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid stroke={theme.chartGrid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: theme.chartAxis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: theme.chartAxis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatUsd(Math.round(v)).slice(0, -3)}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      background: theme.chartTooltipBg,
                      border: `1px solid ${theme.chartTooltipBorder}`,
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: theme.chartAxis, fontSize: 12 }}
                    formatter={(v) => [
                      formatSignedUsd(parseFloat(v)),
                      "Cumulative profit",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke={theme.chartLine}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: theme.chartLine }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Daily P&L heatmap */}
          <div>
            <p className={`text-[13px] font-medium ${theme.textSecondary} mb-1`}>Daily profit, last 30 days</p>
            <p className={`text-xs ${theme.subtext} mb-3`}>One square per day. Brighter green means more profit, red is a loss. Hover for the amount.</p>
            <div className="flex flex-wrap gap-1.5">
              {heatmapDays.map((d) => {
                const intensity =
                  d.profit === 0 ? 0 : Math.min(Math.abs(d.profit) / maxAbs, 1);
                const toRgba = (hex, a) => {
                  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
                  return `rgba(${r},${g},${b},${a})`;
                };
                const bg =
                  d.profit === 0
                    ? theme.chartGrid
                    : d.profit > 0
                      ? toRgba(PROFIT_COLOR, 0.15 + intensity * 0.85)
                      : toRgba(LOSS_COLOR,   0.15 + intensity * 0.85);
                return (
                  <div key={d.date} className="relative group">
                    <div
                      className="w-5 h-5 rounded cursor-default transition duration-150 group-hover:scale-[1.5] group-hover:ring-1 group-hover:ring-white/20 group-hover:z-10"
                      style={{ backgroundColor: bg }}
                    />
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 rounded-lg text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 ${theme.panel} border ${theme.cardBorder} shadow-lg`}>
                      <div className={`${theme.subtext} mb-0.5`}>{d.date}</div>
                      <div className={`font-mono font-semibold ${d.profit === 0 ? theme.subtext : d.profit > 0 ? 'text-profit' : 'text-loss'}`}>
                        {d.profit === 0 ? 'No sales' : formatSignedUsd(d.profit)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

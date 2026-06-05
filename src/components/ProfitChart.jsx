// Analytics page — cumulative P&L line chart (7d / 30d / all-time),
// weekly and monthly profit summaries, and a 30-day sale heatmap.
import React, { useMemo } from "react";
import { PROFIT_COLOR, LOSS_COLOR } from "../themes/themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ProfitChart({
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

  const summaryCards = [
    {
      label: "Invested",
      value: `$${totalInvested.toFixed(2)}`,
      colored: false,
    },
    {
      label: "Total Profit",
      value: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`,
      colored: true,
      val: totalProfit,
    },
    {
      label: "Profit Rate",
      value: winRate,
      colored: false,
    },
  ];

  const PERIODS = [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "all", label: "All time" },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className={`max-w-3xl mx-auto ${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-lg overflow-hidden`}>
        <div className={`flex items-center px-6 py-4 border-b ${theme.panelBorder}`}>
          <h2 className={`font-semibold ${theme.text}`}>Profit Analytics</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Period selector + total in period */}
          <div className="flex items-center gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setChartPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  chartPeriod === p.key
                    ? `${theme.accentBg} text-white`
                    : `${theme.subtext} hover:text-slate-300 bg-white/5`
                }`}
              >
                {p.label}
              </button>
            ))}
            <span
              className={`ml-auto text-sm font-mono font-semibold ${totalInPeriod >= 0 ? "text-profit" : "text-loss"}`}
            >
              {totalInPeriod >= 0 ? "+" : ""}${totalInPeriod.toFixed(2)}
            </span>
          </div>

          {/* Cumulative line chart */}
          <div className="h-52">
            {cumulativeData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.chartGrid}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{
                      background: theme.chartTooltipBg,
                      border: `1px solid ${theme.chartTooltipBorder}`,
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#94a3b8", fontSize: 12 }}
                    formatter={(v) => [
                      `$${parseFloat(v).toFixed(2)}`,
                      "Cumulative",
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

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`${theme.card} border ${theme.cardBorder} rounded-xl p-4 text-center`}
              >
                <p className="text-xs text-slate-600 mb-1.5">{card.label}</p>
                <p
                  className={`text-base font-mono font-semibold ${
                    card.colored
                      ? (card.val ?? 0) >= 0
                        ? "text-profit"
                        : "text-loss"
                      : theme.textSecondary
                  }`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Daily P&L heatmap */}
          <div>
            <p className="text-xs text-slate-600 mb-3 uppercase tracking-wide">
              Daily P&L — Last 30 days
            </p>
            <div className="flex flex-wrap gap-1">
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
                      className="w-4 h-4 rounded-sm cursor-default transition-all duration-150 group-hover:scale-[1.5] group-hover:ring-1 group-hover:ring-white/20 group-hover:z-10"
                      style={{ backgroundColor: bg }}
                    />
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 rounded-lg text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 ${theme.panel} border ${theme.cardBorder} shadow-lg`}>
                      <div className="text-slate-500 mb-0.5">{d.date}</div>
                      <div className={`font-mono font-semibold ${d.profit === 0 ? theme.subtext : d.profit > 0 ? 'text-profit' : 'text-loss'}`}>
                        {d.profit === 0 ? '—' : `${d.profit > 0 ? '+' : ''}$${d.profit.toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

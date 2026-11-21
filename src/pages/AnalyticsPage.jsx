// Analytics page: headline figures, the cumulative profit curve (7d / 30d /
// all time), a 30-day daily heatmap, six months of buy/sell activity and the
// latest sales.
import React, { useMemo } from "react";
import { PROFIT_COLOR, LOSS_COLOR } from "../themes/themes";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import PageHeader, { Page } from "../components/PageHeader";
import RecentSales from "../components/RecentSales";
import SnipeOutcomes from "../components/SnipeOutcomes";

const PERIODS = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n) => `${n >= 0 ? "+" : "−"}$${money(Math.abs(n))}`;
const toRgba = (hex, a) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
};

function Figure({ theme, label, value, tone = "" }) {
  return (
    <div className={`py-3 pr-4 sm:pl-5 sm:first:pl-0 sm:border-l sm:first:border-l-0 ${theme.cardBorder}`}>
      <p className={`text-xs ${theme.subtext}`}>{label}</p>
      <p className={`mt-1 text-lg font-mono font-medium leading-tight ${tone || theme.text}`}>{value}</p>
    </div>
  );
}

function Section({ theme, title, aside, children, className = "" }) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className={`text-sm font-semibold ${theme.text}`}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

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
  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const cumulativeData = useMemo(
    () =>
      profitChartData.reduce((acc, d) => {
        const prev = acc[acc.length - 1]?.cumulative ?? 0;
        return [...acc, { ...d, cumulative: Math.round((prev + d.profit) * 100) / 100 }];
      }, []),
    [profitChartData],
  );
  const totalInPeriod = profitChartData.reduce((s, d) => s + d.profit, 0);
  const lineColor = totalInPeriod >= 0 ? PROFIT_COLOR : LOSS_COLOR;

  const sales = useMemo(() => items.filter((i) => i.sold && !i.isTransaction), [items]);
  const winRate = sales.length > 0
    ? `${Math.round((sales.filter((i) => i.profit > 0).length / sales.length) * 100)}%`
    : "—";
  const avgProfit = sales.length > 0
    ? signed(sales.reduce((s, i) => s + (i.profit ?? 0), 0) / sales.length)
    : "—";

  // Profit per day for the last 30 days.
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

  // Items bought and sold per month, last six months.
  const activity = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        bought: 0,
        sold: 0,
      });
    }
    for (const it of items) {
      if (it.isTransaction) continue;
      const bought = months.find((m) => m.key === `${it.datePurchased || ""}`.slice(0, 7));
      if (bought) bought.bought += 1;
      const sold = it.sold && months.find((m) => m.key === `${it.dateSold || ""}`.slice(0, 7));
      if (sold) sold.sold += 1;
    }
    return months;
  }, [items]);

  const tooltipStyle = {
    background: theme.chartTooltipBg,
    border: `1px solid ${theme.chartTooltipBorder}`,
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <Page>
      <PageHeader theme={theme} title="Analytics" hint="What your trading has returned, after fees.">
        <div className={`flex rounded-lg border p-0.5 ${theme.cardBorder}`}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setChartPeriod(p.key)}
              aria-pressed={chartPeriod === p.key}
              className={`px-3 h-8 rounded-md text-[13px] font-medium transition-colors ${
                chartPeriod === p.key ? theme.navActive : `${theme.subtext} ${theme.textHover}`
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Profit in the chosen period */}
      <div>
        <p className={`text-[13px] ${theme.subtext}`}>
          Profit, {PERIODS.find((p) => p.key === chartPeriod)?.label.toLowerCase()}
        </p>
        <p className={`mt-2 font-mono font-medium tracking-tight leading-none text-[40px] ${totalInPeriod >= 0 ? "text-profit" : "text-loss"}`}>
          {signed(totalInPeriod)}
        </p>
      </div>

      <div className="h-64 mt-6">
        {cumulativeData.length === 0 ? (
          <div className={`h-full flex items-center justify-center text-sm rounded-xl border border-dashed ${theme.cardBorder} ${theme.subtext}`}>
            No sales in this period yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={theme.chartGrid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: theme.chartAxis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: theme.chartAxis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
                width={52}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: theme.chartAxis, fontSize: 12 }}
                itemStyle={{ color: lineColor }}
                formatter={(v) => [`$${parseFloat(v).toFixed(2)}`, "Cumulative"]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={lineColor}
                strokeWidth={1.75}
                fill="url(#analyticsGrad)"
                dot={false}
                activeDot={{ r: 4, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* All-time figures */}
      <div className={`mt-6 grid grid-cols-2 sm:grid-cols-5 border-y ${theme.cardBorder}`}>
        <Figure theme={theme} label="Invested" value={`$${money(totalInvested)}`} />
        <Figure theme={theme} label="Total profit" value={signed(totalProfit)} tone={totalProfit >= 0 ? "text-profit" : "text-loss"} />
        <Figure theme={theme} label="Return" value={`${roi >= 0 ? "+" : "−"}${Math.abs(roi).toFixed(1)}%`} tone={roi >= 0 ? "text-profit" : "text-loss"} />
        <Figure theme={theme} label="Profitable sales" value={winRate} />
        <Figure theme={theme} label="Average per sale" value={avgProfit} />
      </div>

      <Section theme={theme} className="mt-10" title="Snipe outcomes" aside={<span className={`text-xs ${theme.subtext}`}>did the deals pay off?</span>}>
        <SnipeOutcomes items={items} theme={theme} />
      </Section>

      <div className="mt-10 grid lg:grid-cols-[1fr_340px] gap-x-12 gap-y-10">
        <div className="space-y-10 min-w-0">
          <Section theme={theme} title="Daily profit" aside={<span className={`text-xs ${theme.subtext}`}>last 30 days</span>}>
            <div className="flex flex-wrap gap-1.5">
              {heatmapDays.map((d) => {
                const intensity = d.profit === 0 ? 0 : Math.min(Math.abs(d.profit) / maxAbs, 1);
                const bg = d.profit === 0
                  ? theme.chartGrid
                  : toRgba(d.profit > 0 ? PROFIT_COLOR : LOSS_COLOR, 0.2 + intensity * 0.8);
                return (
                  <div key={d.date} className="relative group">
                    <div className="w-5 h-5 rounded cursor-default" style={{ backgroundColor: bg }} />
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 rounded-lg text-[10px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 ${theme.panel} border ${theme.cardBorder} shadow-lg`}>
                      <div className={`${theme.subtext} mb-0.5`}>{d.date}</div>
                      <div className={`font-mono font-semibold ${d.profit === 0 ? theme.subtext : d.profit > 0 ? "text-profit" : "text-loss"}`}>
                        {d.profit === 0 ? "—" : signed(d.profit)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            theme={theme}
            title="Activity"
            aside={
              <span className={`flex items-center gap-3 text-xs ${theme.subtext}`}>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.chartLine }} />Bought</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: theme.chartMuted }} />Sold</span>
              </span>
            }
          >
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={3}>
                  <CartesianGrid stroke={theme.chartGrid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.chartAxis }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.chartAxis }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: theme.chartAxis, fontSize: 12 }}
                    cursor={{ fill: toRgba(theme.chartAxis, 0.12) }}
                  />
                  <Bar dataKey="bought" name="Bought" fill={theme.chartLine} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="sold" name="Sold" fill={theme.chartMuted} radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <Section theme={theme} title="Latest sales">
          <RecentSales items={items} theme={theme} />
        </Section>
      </div>
    </Page>
  );
}

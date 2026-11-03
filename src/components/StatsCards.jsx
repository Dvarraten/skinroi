// Summary statistics row — Holding, Realised, ROI, and Profit.
// Values animate via requestAnimationFrame on change.
import React, { useEffect, useRef, useState } from "react";
import { Package, TrendingUp, TrendingDown } from "lucide-react";

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) return;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
        setDisplay(end);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  const formatted = decimals > 0
    ? (typeof display === "number" ? display.toFixed(decimals) : "0.00")
    : Math.round(display);
  return <>{prefix}{formatted}{suffix}</>;
}

export default function StatsCards({ stats, theme }) {
  const profit = stats.totalProfit;
  const isGain = profit >= 0;
  const roi = stats.totalInvested > 0 ? (profit / stats.totalInvested) * 100 : 0;
  const isRoiGain = roi >= 0;

  const cards = [
    {
      label: "Holding",
      value: <AnimatedNumber value={stats.totalActive} prefix="$" decimals={2} />,
      sub: `· ${stats.totalActiveCount} item${stats.totalActiveCount !== 1 ? 's' : ''}`,
      icon: Package,
      iconColor: "text-slate-400",
      iconBg: "bg-slate-500/10",
      valueColor: theme.text,
    },
    {
      label: "Realised",
      value: <AnimatedNumber value={stats.totalSold} prefix="$" decimals={2} />,
      sub: `· ${stats.totalSoldCount} sold`,
      icon: isGain ? TrendingUp : TrendingDown,
      iconColor: isGain ? "text-profit" : "text-loss",
      iconBg: isGain ? "bg-profit/10" : "bg-loss/10",
      valueColor: theme.text,
    },
    {
      label: "ROI",
      value: <>{isRoiGain ? "+" : ""}<AnimatedNumber value={roi} decimals={1} suffix="%" /></>,
      sub: `· ${isGain ? '+' : ''}$${Math.abs(profit).toFixed(0)} profit`,
      icon: isRoiGain ? TrendingUp : TrendingDown,
      iconColor: isRoiGain ? "text-profit" : "text-loss",
      iconBg: isRoiGain ? "bg-profit/10" : "bg-loss/10",
      valueColor: isRoiGain ? "text-profit" : "text-loss",
    },
    {
      label: "Profit",
      value: <>{isGain ? "+" : ""}<AnimatedNumber value={profit} prefix="$" decimals={2} /></>,
      sub: null,
      icon: isGain ? TrendingUp : TrendingDown,
      iconColor: isGain ? "text-profit" : "text-loss",
      iconBg: isGain ? "bg-profit/10" : "bg-loss/10",
      valueColor: isGain ? "text-profit" : "text-loss",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(({ label, value, sub, icon: Icon, iconColor, iconBg, valueColor }) => (
        <div key={label} className={`${theme.card} border ${theme.cardBorder} rounded-xl p-3`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">{label}</span>
            <div className={`p-1.5 rounded-lg ${iconBg}`}>
              <Icon size={13} className={iconColor} />
            </div>
          </div>
          <div className={`text-base font-semibold font-mono leading-none ${valueColor}`}>{value}</div>
          {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

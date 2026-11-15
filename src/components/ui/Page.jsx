// Shared page frame: every page scrolls the same way, has the same side
// padding and maximum width, and opens with the same title row.
import React from 'react';
import { useTheme } from '../../themes/ThemeContext';

export function Page({ children, width = 'max-w-6xl', className = '' }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pt-5 pb-8">
      <div className={`${width} mx-auto space-y-5 ${className}`}>{children}</div>
    </div>
  );
}

// Title on the left, the page's actions on the right (the primary one last).
export function PageHeader({ title, description, actions = null, children = null }) {
  const theme = useTheme();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className={`text-xl font-semibold tracking-tight ${theme.text}`}>{title}</h1>
        {description && <p className={`text-sm mt-1 max-w-2xl ${theme.subtext}`}>{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Small label + big number, used for the stat rows on several pages.
export function StatCard({ label, value, hint, tone = null, icon = null }) {
  const theme = useTheme();
  const valueColor = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : tone === 'warn' ? 'text-warn' : theme.text;
  return (
    <div className={`${theme.card} border ${theme.cardBorder} rounded-xl px-4 py-3 min-w-0`}>
      <p className={`flex items-center gap-1.5 text-xs font-medium ${theme.subtext}`}>{icon}{label}</p>
      <p className={`mt-1 text-xl font-mono font-semibold tabular-nums truncate ${valueColor}`}>{value}</p>
      {hint && <p className={`text-xs mt-0.5 ${theme.subtext}`}>{hint}</p>}
    </div>
  );
}

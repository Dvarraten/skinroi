// SAP Fiori Morning Horizon chart palette (SAP/theming-base-content)
export const SAP_CHART_COLORS = {
  1:  "#168eff", // blue
  2:  "#c87b00", // orange
  3:  "#75980b", // olive green
  4:  "#df1278", // magenta
  5:  "#8b47d7", // purple
  6:  "#049f9a", // teal
  7:  "#0070f2", // royal blue
  8:  "#cc00dc", // violet
  9:  "#798c77", // muted sage
  10: "#da6c6c", // salmon
  11: "#5d36ff", // indigo
  12: "#a68a5b", // warm tan
  good:     "#30914c",
  bad:      "#f53232",
  critical: "#e26300",
  neutral:  "#758ca4",
};

// Shared semantic color constants — match tailwind.config.js custom colors.
// Use these everywhere instead of hardcoded hex strings.
export const PROFIT_COLOR = '#22c55e';
export const LOSS_COLOR   = '#ef4444';
export const WARN_COLOR   = '#f59e0b';

export const themes = {
  // ── 1. Original (default — finance terminal, amber accent) ──────────────
  bloomberg: {
    name: "Original",
    dot: "bg-amber-500",
    dotColor: "#f59e0b",
    accentColor: WARN_COLOR,
    bg: "bg-[#0a0800]",
    card: "bg-[#111008]",
    cardHover: "hover:border-amber-700/40",
    cardBorder: "border-[#2a2010]",
    panel: "bg-[#0d0c08]",
    panelBorder: "border-[#2a2010]",
    input: "bg-[#1a1600] border-[#3a3010]",
    inputSell: "bg-[#1a1600] border-[#3a3010]",
    tabActive: "bg-amber-500 text-black font-semibold",
    tabInactive: "bg-[#111008] text-amber-400/70 hover:bg-[#1a1600] border border-[#2a2010]",
    accent: "text-amber-400",
    accentBg: "bg-amber-500 hover:bg-amber-400",
    subtext: "text-slate-400",
    text: "text-white",
    textSecondary: "text-slate-300",
    textHover: "hover:text-white",
    itemHoverBg: "hover:bg-amber-900/25",
    soldCard: "bg-[#1a1600] border-[#2a2010]",
    sidebarItem: "bg-amber-950/40 hover:bg-amber-900/30 border-[#2a2010]",
    header: "bg-gradient-to-b from-[#181200] to-[#0a0800] border border-[#2a2010]",
    chartGrid: "#251d08",
    chartAxis: "#a37820",
    chartTooltipBg: "#111008",
    chartTooltipBorder: "#f59e0b40",
    chartLine: WARN_COLOR,
    chartColors: [WARN_COLOR, SAP_CHART_COLORS[10], SAP_CHART_COLORS[3], SAP_CHART_COLORS[1], SAP_CHART_COLORS[6], SAP_CHART_COLORS[5]],
  },

  // ── 2. Dark ─────────────────────────────────────────────────────────────
  dark: {
    name: "Dark",
    dot: "bg-[#09090b]",
    dotColor: "#09090b",
    accentColor: WARN_COLOR,
    bg: "bg-[#0a0b0f]",
    card: "bg-[#111318]",
    cardHover: "hover:border-[#1e2028]/80",
    cardBorder: "border-[#1e2028]",
    panel: "bg-[#0d1117]",
    panelBorder: "border-[#1e2028]",
    input: "bg-[#1a1f2e] border-[#1e2028]",
    inputSell: "bg-[#1a1f2e] border-[#1e2028]",
    tabActive: "bg-[#3b82f6] text-white",
    tabInactive: "bg-[#111318] text-slate-300 hover:bg-[#1e2330] border border-[#1e2028]",
    accent: "text-[#3b82f6]",
    accentBg: "bg-[#3b82f6] hover:bg-[#2563eb]",
    subtext: "text-slate-400",
    text: "text-white",
    textSecondary: "text-slate-300",
    textHover: "hover:text-white",
    soldCard: "bg-[#1a1f2e] border-[#1e2028]",
    sidebarItem: "bg-[#1e2330] hover:bg-[#252b3a] border-[#1e2028]",
    header: "bg-gradient-to-b from-[#181c24] to-[#0d1117] border border-[#1e2028]",
    chartGrid: "#1e2028",
    chartAxis: SAP_CHART_COLORS.neutral,
    chartTooltipBg: "#111318",
    chartTooltipBorder: "#3b82f650",
    chartLine: "#3b82f6",
    chartColors: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"],
  },

  // ── 3. Light ─────────────────────────────────────────────────────────────
  light: {
    name: "Light",
    dot: "bg-blue-500",
    dotColor: "#dce0e6",
    accentColor: WARN_COLOR,
    bg: "bg-[#d0d4da]",
    card: "bg-[#dce0e6]",
    cardHover: "hover:border-slate-500",
    cardBorder: "border-slate-400",
    panel: "bg-[#dce0e6]",
    panelBorder: "border-slate-400",
    input: "bg-[#c8ccd3] border-slate-400 text-slate-900 placeholder-slate-500",
    inputSell: "bg-[#c8ccd3] border-slate-400 text-slate-900 placeholder-slate-500",
    tabActive: "bg-blue-600 text-white",
    tabInactive: "bg-[#dce0e6] text-slate-700 hover:bg-slate-300 border border-slate-400",
    accent: "text-blue-600",
    accentBg: "bg-blue-600 hover:bg-blue-500",
    subtext: "text-slate-600",
    text: "text-slate-900",
    textSecondary: "text-slate-700",
    textHover: "hover:text-slate-900",
    itemHoverBg: "hover:bg-black/5",
    soldCard: "bg-[#c8ccd3] border-slate-400",
    sidebarItem: "bg-[#c8ccd3] hover:bg-slate-300 border-slate-400",
    header: "bg-[#dce0e6] border-b border-slate-400",
    chartGrid: "#b0b7c0",
    chartAxis: "#475569",
    chartTooltipBg: "#dce0e6",
    chartTooltipBorder: "#b0b7c0",
    chartLine: SAP_CHART_COLORS[1],
    chartColors: [SAP_CHART_COLORS[1], SAP_CHART_COLORS[6], SAP_CHART_COLORS[3], SAP_CHART_COLORS[5], SAP_CHART_COLORS[2], SAP_CHART_COLORS[4]],
  },

  // ── 4. Midnight Blue ────────────────────────────────────────────────────
  default: {
    name: "Midnight Blue",
    dot: "bg-blue-500",
    dotColor: "#3b82f6",
    accentColor: "#3b82f6",
    bg: "bg-[#0c1120]",
    card: "bg-[#151f35]",
    cardHover: "hover:border-slate-500/50",
    cardBorder: "border-slate-600/40",
    panel: "bg-[#111827]",
    panelBorder: "border-slate-600/40",
    input: "bg-[#1a2540] border-slate-600/50",
    inputSell: "bg-[#1a2540] border-slate-600/50",
    tabActive: "bg-blue-600 text-white",
    tabInactive: "bg-[#151f35] text-slate-300 hover:bg-slate-700/50 border border-slate-600/40",
    accent: "text-blue-400",
    accentBg: "bg-blue-600 hover:bg-blue-500",
    subtext: "text-slate-400",
    text: "text-white",
    textSecondary: "text-slate-300",
    textHover: "hover:text-white",
    itemHoverBg: "hover:bg-white/8",
    soldCard: "bg-[#1a2540] border-slate-600/30",
    sidebarItem: "bg-slate-700/50 hover:bg-slate-600/50 border-slate-600/50",
    header: "bg-gradient-to-b from-[#1e2d4a] to-[#0f1929] border border-slate-700/40",
    chartGrid: "#334155",
    chartAxis: SAP_CHART_COLORS.neutral,
    chartTooltipBg: "#1e293b",
    chartTooltipBorder: "#475569",
    chartLine: SAP_CHART_COLORS[1],
    chartColors: [SAP_CHART_COLORS[1], SAP_CHART_COLORS[6], SAP_CHART_COLORS[3], SAP_CHART_COLORS[5], SAP_CHART_COLORS[2], SAP_CHART_COLORS[4]],
  },

  // ── 5. Quartz (SAP Quartz Dark — deep indigo on near-black) ───────────
  quartz: {
    name: "Quartz",
    dot: "bg-[#5d36ff]",
    dotColor: "#5d36ff",
    accentColor: "#5d36ff",
    bg: "bg-[#0e0e1a]",
    card: "bg-[#14142b]",
    cardHover: "hover:border-[#5d36ff]/35",
    cardBorder: "border-[#1e1e3a]",
    panel: "bg-[#111124]",
    panelBorder: "border-[#1e1e3a]",
    input: "bg-[#1a1a35] border-[#1e1e3a]",
    inputSell: "bg-[#1a1a35] border-[#1e1e3a]",
    tabActive: "bg-[#5d36ff] text-white",
    tabInactive: "bg-[#14142b] text-slate-300 hover:bg-[#1a1a35] border border-[#1e1e3a]",
    accent: "text-[#7c5cff]",
    accentBg: "bg-[#5d36ff] hover:bg-[#7c5cff]",
    subtext: "text-slate-500",
    text: "text-white",
    textSecondary: "text-slate-300",
    textHover: "hover:text-white",
    itemHoverBg: "hover:bg-[#5d36ff]/8",
    soldCard: "bg-[#1a1a35] border-[#1e1e3a]",
    sidebarItem: "bg-[#1a1a35]/60 hover:bg-[#1e1e40] border-[#1e1e3a]",
    header: "bg-gradient-to-b from-[#1a1a35] to-[#0e0e1a] border border-[#1e1e3a]",
    chartGrid: "#1e1e3a",
    chartAxis: SAP_CHART_COLORS.neutral,
    chartTooltipBg: "#14142b",
    chartTooltipBorder: "#5d36ff50",
    chartLine: SAP_CHART_COLORS[11],
    chartColors: [SAP_CHART_COLORS[11], SAP_CHART_COLORS[1], SAP_CHART_COLORS[5], SAP_CHART_COLORS[6], SAP_CHART_COLORS[2], SAP_CHART_COLORS[4]],
  },

};

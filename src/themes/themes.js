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

// Two monochrome themes. Colour is kept for data (profit, loss, warnings) and
// for the skins themselves; chrome, selection and primary buttons are neutral.
export const themes = {
  // ── Dark (default) ───────────────────────────────────────────────────────
  dark: {
    name: "Dark",
    dot: "bg-[#09090b]",
    dotColor: "#09090b",
    accentColor: "#fafafa",
    bg: "bg-[#09090b]",
    card: "bg-[#111113]",
    cardHover: "hover:border-[#34343b]",
    cardBorder: "border-[#1f1f23]",
    panel: "bg-[#0d0d0f]",
    panelBorder: "border-[#1f1f23]",
    input: "bg-[#151518] border-[#26262b]",
    inputSell: "bg-[#151518] border-[#26262b]",
    tabActive: "bg-white text-black",
    tabInactive: "bg-[#111113] text-zinc-300 hover:bg-[#1b1b1f] border border-[#1f1f23]",
    accent: "text-white",
    accentBg: "bg-[#3f3f46] hover:bg-[#52525b]",
    // Primary button: the one filled control on a page.
    primary: "bg-white text-black hover:bg-zinc-200",
    // The Steam logo is a white PNG: flip it where it sits on a light surface.
    iconOnPrimary: "invert",
    iconOnSurface: "",
    navActive: "bg-white/[0.07] text-white",
    subtext: "text-zinc-400",
    text: "text-white",
    textSecondary: "text-zinc-300",
    textHover: "hover:text-white",
    itemHoverBg: "hover:bg-white/[0.05]",
    soldCard: "bg-[#151518] border-[#1f1f23]",
    sidebarItem: "bg-[#151518] hover:bg-[#1b1b1f] border-[#1f1f23]",
    header: "bg-[#09090b] border-b border-[#1f1f23]",
    chartGrid: "#1f1f23",
    chartAxis: "#71717a",
    chartTooltipBg: "#111113",
    chartTooltipBorder: "#34343b",
    chartLine: "#e4e4e7",
    chartMuted: "#52525b",
    chartColors: ["#e4e4e7", PROFIT_COLOR, WARN_COLOR, LOSS_COLOR, SAP_CHART_COLORS[5], SAP_CHART_COLORS[6]],
  },

  // ── Light ────────────────────────────────────────────────────────────────
  light: {
    name: "Light",
    dot: "bg-white",
    dotColor: "#ffffff",
    accentColor: "#18181b",
    bg: "bg-[#fafafa]",
    card: "bg-white",
    cardHover: "hover:border-zinc-400",
    cardBorder: "border-zinc-200",
    panel: "bg-white",
    panelBorder: "border-zinc-200",
    input: "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400",
    inputSell: "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400",
    tabActive: "bg-zinc-900 text-white",
    tabInactive: "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200",
    accent: "text-zinc-900",
    accentBg: "bg-zinc-600 hover:bg-zinc-500",
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    iconOnPrimary: "",
    iconOnSurface: "invert",
    navActive: "bg-black/[0.06] text-zinc-900",
    subtext: "text-zinc-500",
    text: "text-zinc-900",
    textSecondary: "text-zinc-700",
    textHover: "hover:text-zinc-900",
    itemHoverBg: "hover:bg-black/[0.04]",
    soldCard: "bg-zinc-100 border-zinc-200",
    sidebarItem: "bg-zinc-100 hover:bg-zinc-200 border-zinc-200",
    header: "bg-[#fafafa] border-b border-zinc-200",
    chartGrid: "#e4e4e7",
    chartAxis: "#71717a",
    chartTooltipBg: "#ffffff",
    chartTooltipBorder: "#d4d4d8",
    chartLine: "#18181b",
    chartMuted: "#a1a1aa",
    chartColors: ["#18181b", PROFIT_COLOR, WARN_COLOR, LOSS_COLOR, SAP_CHART_COLORS[5], SAP_CHART_COLORS[6]],
  },
};

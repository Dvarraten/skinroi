// App navigation. On desktop a fixed left sidebar: logo, the Add button, the
// four pages, then tools (currency converter, theme, About) and the account.
// On phones the same component is a slim top bar (logo, tools, account) and
// MobileTabBar carries the pages along the bottom edge.
import React, { useRef, useState, useEffect } from "react";
import {
  BarChart3, LogOut, ExternalLink, Download, Upload, User, Plus, Inbox, Info,
  AlertTriangle, ArrowLeftRight, Wallet, Crosshair, Sun, Moon,
} from "lucide-react";
import steamLogo from "../assets/platforms/steam.png";
import Logo from "./Logo";
import CurrencyConverter from "./CurrencyConverter";
import ExtensionPairPanel from "./ExtensionPairPanel";
import { PROFIT_COLOR, WARN_COLOR, LOSS_COLOR } from "../themes/themes";

// null = Portfolio (the start page).
export const NAV_ITEMS = [
  { key: null,          label: "Portfolio", icon: Wallet },
  { key: "handleItems", label: "Trades",    icon: Inbox },
  { key: "snipes",      label: "Snipes",    icon: Crosshair },
  { key: "analytics",   label: "Analytics", icon: BarChart3 },
];

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-loss text-white text-[10px] font-semibold leading-none tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Closes a popover on a click outside `ref`. The currency picker's list is
// portaled to <body>, so clicks inside it must not count as outside.
function useClickOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.target.closest?.("[data-currency-menu]")) return;
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, open, close]);
}

// Popovers drop down from the top bar on phones and open upward from the
// bottom of the sidebar on desktop.
const POPOVER_POS =
  "absolute z-[60] right-0 top-full mt-2 origin-top-right md:right-auto md:left-0 md:top-auto md:mt-0 md:bottom-full md:mb-2 md:origin-bottom-left";

export default function Sidebar({
  theme,
  activePage = null,
  onNavigate,
  pendingCount = 0,
  user,
  onLogin,
  onLogout,
  onExportCSV,
  onImportCSV,
  // Extension status, shown as the colour of the ring around the avatar:
  // green = connected, orange = not paired yet, red = sync/backend error.
  extension = null,
  syncError = null,
  onExtensionChange,
  isDark,
  onToggleTheme,
  converter,
  lastUpdated,
}) {
  const importInputRef = useRef(null);
  const extStatus = syncError ? "error" : extension?.connected ? "connected" : "disconnected";
  const ringColor = { connected: PROFIT_COLOR, disconnected: WARN_COLOR, error: LOSS_COLOR }[extStatus];
  const ringTitle = {
    connected: "Extension connected",
    disconnected: "Extension not connected",
    error: `Extension sync problem: ${syncError}`,
  }[extStatus];

  const [accountOpen, setAccountOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  // A broken Steam avatar URL falls back to the placeholder icon.
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => { setAvatarFailed(false); }, [user?.avatarUrl]);
  const accountRef = useRef(null);
  const currencyRef = useRef(null);
  useClickOutside(accountRef, accountOpen, () => setAccountOpen(false));
  useClickOutside(currencyRef, currencyOpen, () => setCurrencyOpen(false));

  const quiet = `${theme.subtext} ${theme.textHover} ${theme.itemHoverBg}`;
  const toolBtn = (active) =>
    `p-2 rounded-lg transition-colors ${active ? theme.navActive : quiet}`;
  const menuRow = `w-full flex items-center gap-3 px-4 py-2 text-[13px] ${theme.textSecondary} ${theme.textHover} ${theme.itemHoverBg} transition-colors`;

  const avatar = user?.avatarUrl && !avatarFailed ? (
    <img
      src={user.avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setAvatarFailed(true)}
      className="w-7 h-7 rounded-full shrink-0"
      style={{ boxShadow: `0 0 0 2px ${ringColor}` }}
    />
  ) : (
    <span
      className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${theme.card}`}
      style={{ boxShadow: `0 0 0 2px ${ringColor}` }}
    >
      <User size={14} className={theme.subtext} />
    </span>
  );

  return (
    <aside
      className={`relative z-40 shrink-0 flex items-center gap-2 h-14 px-3 border-b md:h-auto md:w-[224px] md:flex-col md:items-stretch md:gap-0 md:px-3 md:py-4 md:border-b-0 md:border-r ${theme.bg} ${theme.panelBorder}`}
    >
      <button
        type="button"
        onClick={() => onNavigate(null)}
        title="Portfolio"
        className="flex items-center h-9 md:px-1.5 md:mb-5 hover:opacity-80 transition-opacity"
      >
        <Logo theme={theme} />
      </button>

      {/* Add: the one filled button in the app chrome. */}
      <button
        type="button"
        onClick={() => onNavigate("add")}
        aria-current={activePage === "add" ? "page" : undefined}
        className={`hidden md:flex items-center justify-center gap-1.5 h-9 mb-5 rounded-lg text-[13px] font-medium transition-colors ${theme.primary}`}
      >
        <Plus size={15} strokeWidth={2.25} /> Add
      </button>

      <nav aria-label="Main" className="hidden md:flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = (activePage || null) === key;
          return (
            <button
              key={label}
              onClick={() => onNavigate(key)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] font-medium transition-colors ${active ? theme.navActive : quiet}`}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span className="flex-1 text-left">{label}</span>
              {key === "handleItems" && <Badge count={pendingCount} />}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Tools */}
      <div className="flex items-center gap-0.5 md:mb-2 md:px-0.5">
        <div className="relative" ref={currencyRef}>
          <button
            onClick={() => setCurrencyOpen((o) => !o)}
            title="Currency converter"
            aria-label="Currency converter"
            className={toolBtn(currencyOpen)}
          >
            <ArrowLeftRight size={16} strokeWidth={1.75} />
          </button>
          {currencyOpen && (
            <div className={`pop-in ${POPOVER_POS} w-72 rounded-xl border ${theme.panelBorder} ${theme.panel} shadow-2xl p-4`}>
              <p className={`text-xs font-medium ${theme.subtext} mb-3`}>Currency converter</p>
              <CurrencyConverter theme={theme} {...converter} />
              {lastUpdated && (
                <p className={`text-[10px] ${theme.subtext} mt-2 text-center`}>Rate from: {lastUpdated}</p>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to light" : "Switch to dark"}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className={toolBtn(false)}
        >
          {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>
        <button
          onClick={() => onNavigate("about")}
          title="About SkinROI"
          aria-label="About SkinROI"
          aria-current={activePage === "about" ? "page" : undefined}
          className={toolBtn(activePage === "about")}
        >
          <Info size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Account */}
      {user ? (
        <div className="relative" ref={accountRef}>
          <button
            onClick={() => setAccountOpen((o) => !o)}
            title={ringTitle}
            className={`flex items-center gap-2.5 p-1.5 rounded-lg md:w-full transition-colors ${accountOpen ? theme.navActive : quiet}`}
          >
            {avatar}
            <span className={`hidden md:block flex-1 min-w-0 text-left text-[13px] font-medium truncate ${theme.text}`}>
              {user.personaName || "Account"}
            </span>
          </button>

          {accountOpen && (
            <div className={`pop-in ${POPOVER_POS} w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border ${theme.panelBorder} ${theme.panel} shadow-2xl overflow-hidden`}>
              {/* Extension status + pairing */}
              <div className={`p-3 border-b ${theme.panelBorder} space-y-2`}>
                {syncError && (
                  <div className="px-3 py-2 rounded-lg border border-loss/30 bg-loss/5 text-[11px] text-loss flex items-start gap-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{syncError}</span>
                  </div>
                )}
                <ExtensionPairPanel theme={theme} extension={extension} onChange={onExtensionChange} />
              </div>
              <div className="py-1">
                <a
                  href={`https://steamcommunity.com/profiles/${user.steamId}`}
                  target="_blank" rel="noreferrer"
                  className={menuRow}
                  onClick={() => setAccountOpen(false)}
                >
                  <ExternalLink size={14} /> Steam profile
                </a>
                <a
                  href={`https://steamcommunity.com/profiles/${user.steamId}/inventory/#730`}
                  target="_blank" rel="noreferrer"
                  className={menuRow}
                  onClick={() => setAccountOpen(false)}
                >
                  <ExternalLink size={14} /> CS2 inventory
                </a>
                <button onClick={() => { onExportCSV(); setAccountOpen(false); }} className={menuRow}>
                  <Download size={14} /> Export CSV
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    onImportCSV(e.target.files?.[0]);
                    e.target.value = "";
                    setAccountOpen(false);
                  }}
                />
                <button onClick={() => importInputRef.current?.click()} className={menuRow}>
                  <Upload size={14} /> Import CSV
                </button>
                <div className={`border-t ${theme.panelBorder} mt-1 pt-1`}>
                  <button
                    onClick={() => { onLogout(); setAccountOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] text-loss ${theme.itemHoverBg} transition-colors`}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onLogin}
          className={`flex items-center justify-center gap-2 h-9 px-3 rounded-lg border text-[13px] font-medium transition-colors ${theme.cardBorder} ${theme.text} ${theme.itemHoverBg}`}
        >
          <img src={steamLogo} alt="" className={`h-4 w-4 ${theme.iconOnSurface}`} />
          <span>Sign in<span className="hidden md:inline"> with Steam</span></span>
        </button>
      )}
    </aside>
  );
}

// Bottom tab bar on phones: the four pages with Add in the middle.
export function MobileTabBar({ theme, activePage = null, onNavigate, pendingCount = 0 }) {
  const tab = (key, label, Icon, extra = null) => {
    const active = (activePage || null) === key;
    return (
      <button
        key={label}
        onClick={() => onNavigate(key)}
        aria-current={active ? "page" : undefined}
        className={`relative flex-1 flex flex-col items-center justify-center gap-1 h-14 text-[10px] font-medium transition-colors ${active ? theme.text : theme.subtext}`}
      >
        <Icon size={18} strokeWidth={1.75} />
        {label}
        {extra}
      </button>
    );
  };
  const [portfolio, trades, snipes, analytics] = NAV_ITEMS;
  return (
    <nav aria-label="Main" className={`md:hidden shrink-0 flex items-stretch border-t ${theme.bg} ${theme.panelBorder}`}>
      {tab(portfolio.key, portfolio.label, portfolio.icon)}
      {tab(trades.key, trades.label, trades.icon, pendingCount > 0 && (
        <span className="absolute top-1.5 left-1/2 ml-1.5"><Badge count={pendingCount} /></span>
      ))}
      <button
        onClick={() => onNavigate("add")}
        aria-label="Add"
        aria-current={activePage === "add" ? "page" : undefined}
        className="flex-1 flex items-center justify-center"
      >
        <span className={`w-10 h-10 rounded-full flex items-center justify-center ${theme.primary}`}>
          <Plus size={18} strokeWidth={2.25} />
        </span>
      </button>
      {tab(snipes.key, snipes.label, snipes.icon)}
      {tab(analytics.key, analytics.label, analytics.icon)}
    </nav>
  );
}

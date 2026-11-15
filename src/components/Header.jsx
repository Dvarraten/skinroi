// Sticky app header. Left: logo and the main destinations. Right: the one
// primary action (Add item), the currency converter and the account menu,
// which also holds extension status, theme, CSV import / export and About.
// On phones the destinations move to BottomNav.
import React, { useRef, useState, useEffect } from "react";
import {
  LogOut,
  ExternalLink,
  Download,
  Upload,
  User,
  Info,
  AlertTriangle,
  ArrowLeftRight,
  Plus,
  Menu,
} from "lucide-react";
import steamLogo from "../assets/platforms/steam.png";
import logoSrc from "../utils/skinroi-logo.svg";
import logoLightSrc from "../utils/skinroi-logo-light.svg";
import CurrencyConverter from "./CurrencyConverter";
import ExtensionPairPanel from "./ExtensionPairPanel";
import ThemePicker from "./ThemePicker";
import { Button, IconButton } from "./ui/Button";
import { NAV_ITEMS } from "./nav";
import { PROFIT_COLOR, WARN_COLOR, LOSS_COLOR, themes } from "../themes/themes";

function SteamIcon({ className }) {
  return <img src={steamLogo} alt="" className={className} />;
}

// Closes a popover when the user clicks outside `ref` or presses Escape.
function useDismiss(open, ref, onClose, ignoreSelector) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ignoreSelector && e.target.closest?.(ignoreSelector)) return;
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onClose, ignoreSelector]);
}

export default function Header({
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
  themeKey,
  setTheme,
  // Currency converter props (for the popover)
  usdAmount,
  rmbAmount,
  sidebarRate,
  lastUpdated,
  handleUsdChange,
  handleRmbChange,
  currency1,
  setCurrency1,
  currency1Symbol,
  displayCurrency,
  setDisplayCurrency,
  currencySymbol,
}) {
  const importInputRef = useRef(null);
  const extStatus = syncError ? 'error' : extension?.connected ? 'connected' : 'disconnected';
  const ringColor = { connected: PROFIT_COLOR, disconnected: WARN_COLOR, error: LOSS_COLOR }[extStatus];
  const ringTitle = {
    connected: 'Account menu · extension connected',
    disconnected: 'Account menu · extension not connected',
    error: `Account menu · extension sync problem: ${syncError}`,
  }[extStatus];
  const [menuOpen, setMenuOpen] = useState(false);
  // A broken Steam avatar URL falls back to the placeholder icon instead of
  // leaving an empty circle.
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => { setAvatarFailed(false); }, [user?.avatarUrl]);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const menuRef = useRef(null);
  const currencyRef = useRef(null);

  useDismiss(menuOpen, menuRef, () => setMenuOpen(false));
  // The currency picker's list is portaled to <body>, so it sits outside
  // currencyRef; closing on it would unmount the list before the click lands.
  useDismiss(currencyOpen, currencyRef, () => setCurrencyOpen(false), '[data-currency-menu]');

  const accent = theme.accentColor || theme.dotColor;
  const go = (key) => { setMenuOpen(false); onNavigate(key); };

  const menuRow = `w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-left ${theme.textSecondary} ${theme.textHover} ${theme.itemHoverBg} transition-colors`;
  const menuDivider = `border-t ${theme.panelBorder}`;

  return (
    <header className={`w-full sticky top-0 z-50 px-3 md:px-4 pt-3 pb-1 ${theme.bg}`}>
      <div className={`pl-3 pr-3 md:pl-5 md:pr-4 h-14 flex items-center justify-between gap-3 rounded-2xl shadow-lg ${theme.header}`}>
        {/* LEFT: logo + destinations */}
        <div className="flex items-center gap-6 lg:gap-8 min-w-0">
          <button
            type="button"
            onClick={() => go(null)}
            title="Home"
            className="flex items-center shrink-0 hover:opacity-80 transition-opacity"
          >
            <img
              src={theme.name === 'Light' ? logoLightSrc : logoSrc}
              alt="SkinROI"
              className="h-11 md:h-[52px] w-auto"
            />
          </button>
          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const active = (activePage || null) === key;
              const badge = key === 'handleItems' ? pendingCount : 0;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => go(key)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative group flex items-center gap-2 h-14 px-2.5 lg:px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? theme.text : `${theme.subtext} ${theme.textHover}`
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} className="hidden lg:block" />
                  <span>{label}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-loss text-white text-[11px] font-semibold leading-none tabular-nums">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {/* 2px accent line under the active page; hover previews it */}
                  <span
                    className={`absolute bottom-2.5 left-2.5 right-2.5 lg:left-3 lg:right-3 h-[2px] rounded-full origin-left transition-transform duration-200 ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
                    style={{ backgroundColor: accent }}
                  />
                </button>
              );
            })}
          </nav>
        </div>

        {/* RIGHT: primary action, tools, account */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} strokeWidth={2.5} />}
            onClick={() => go('addItem')}
            aria-current={activePage === 'addItem' ? 'page' : undefined}
            className="mr-1"
          >
            Add item
          </Button>

          {/* Currency converter popover */}
          <div className="relative" ref={currencyRef}>
            <IconButton
              label="Currency converter"
              size="md"
              pressed={currencyOpen}
              onClick={() => setCurrencyOpen(o => !o)}
            >
              <ArrowLeftRight size={17} />
            </IconButton>

            {currencyOpen && (
              <div className={`pop-in origin-top-right absolute right-0 top-12 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border ${theme.panelBorder} ${theme.panel} shadow-xl p-4 z-[60]`}>
                <p className={`text-xs font-medium ${theme.subtext} mb-3`}>Currency converter</p>
                <CurrencyConverter
                  usdAmount={usdAmount}
                  rmbAmount={rmbAmount}
                  sidebarRate={sidebarRate}
                  handleUsdChange={handleUsdChange}
                  handleRmbChange={handleRmbChange}
                  theme={theme}
                  currency1={currency1}
                  setCurrency1={setCurrency1}
                  currency1Symbol={currency1Symbol}
                  displayCurrency={displayCurrency}
                  setDisplayCurrency={setDisplayCurrency}
                  currencySymbol={currencySymbol}
                />
                {lastUpdated && (
                  <p className={`text-[11px] ${theme.subtext} mt-2 text-center`}>
                    Rate from: {lastUpdated}
                  </p>
                )}
              </div>
            )}
          </div>

          {!user && (
            <Button
              size="sm"
              icon={<SteamIcon className="h-3.5 w-3.5" />}
              onClick={onLogin}
              className="hidden sm:inline-flex"
            >
              Sign in
            </Button>
          )}

          {/* Account menu: avatar when signed in, a menu icon otherwise */}
          <div className="relative" ref={menuRef}>
            {user ? (
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                title={ringTitle}
                aria-label={ringTitle}
                aria-expanded={menuOpen}
                className="rounded-full p-0.5 ml-1 block"
              >
                {user.avatarUrl && !avatarFailed ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-9 h-9 rounded-full"
                    style={{ boxShadow: `0 0 0 2px ${ringColor}` }}
                  />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${theme.card}`}
                    style={{ boxShadow: `0 0 0 2px ${ringColor}` }}
                  >
                    <User size={17} className={theme.subtext} />
                  </div>
                )}
              </button>
            ) : (
              <IconButton label="Menu" size="md" pressed={menuOpen} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                <Menu size={18} />
              </IconButton>
            )}

            {menuOpen && (
              <div className={`pop-in origin-top-right absolute right-0 top-12 w-80 max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-xl border ${theme.panelBorder} ${theme.panel} shadow-xl z-50`}>
                {user ? (
                  <>
                    <div className={`px-4 py-3 border-b ${theme.panelBorder}`}>
                      <p className={`${theme.text} text-sm font-semibold truncate`}>{user.personaName || 'Signed in'}</p>
                      <p className={`text-xs ${theme.subtext}`}>Signed in with Steam</p>
                    </div>
                    {/* Extension status + pairing */}
                    <div className={`p-3 border-b ${theme.panelBorder} space-y-2`}>
                      {syncError && (
                        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-300 flex items-start gap-1.5">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                          <span>{syncError}</span>
                        </div>
                      )}
                      <ExtensionPairPanel theme={theme} extension={extension} onChange={onExtensionChange} />
                    </div>
                  </>
                ) : (
                  <div className={`p-3 border-b ${theme.panelBorder}`}>
                    <Button variant="primary" block icon={<SteamIcon className="h-4 w-4" />} onClick={() => { setMenuOpen(false); onLogin(); }}>
                      Sign in with Steam
                    </Button>
                    <p className={`text-xs mt-2 ${theme.subtext}`}>
                      Saves your portfolio to your account and syncs trades with the extension.
                    </p>
                  </div>
                )}

                <ThemePicker themeStyles={theme} themes={themes} theme={themeKey} setTheme={setTheme} />

                <div className={`${menuDivider} py-1`}>
                  {user && (
                    <>
                      <a
                        href={`https://steamcommunity.com/profiles/${user.steamId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={menuRow}
                        onClick={() => setMenuOpen(false)}
                      >
                        <ExternalLink size={15} />
                        Steam profile
                      </a>
                      <a
                        href={`https://steamcommunity.com/profiles/${user.steamId}/inventory/#730`}
                        target="_blank"
                        rel="noreferrer"
                        className={menuRow}
                        onClick={() => setMenuOpen(false)}
                      >
                        <ExternalLink size={15} />
                        CS2 inventory
                      </a>
                    </>
                  )}
                  {onExportCSV && (
                    <button type="button" onClick={() => { onExportCSV(); setMenuOpen(false); }} className={menuRow}>
                      <Download size={15} />
                      Export CSV
                    </button>
                  )}
                  {onImportCSV && (
                    <>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          onImportCSV(e.target.files?.[0]);
                          e.target.value = "";
                          setMenuOpen(false);
                        }}
                      />
                      <button type="button" onClick={() => importInputRef.current?.click()} className={menuRow}>
                        <Upload size={15} />
                        Import CSV
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => go('about')} className={menuRow}>
                    <Info size={15} />
                    About SkinROI
                  </button>
                </div>

                {user && (
                  <div className={`${menuDivider} py-1`}>
                    <button
                      type="button"
                      onClick={() => { onLogout(); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-400 hover:text-red-300 ${theme.itemHoverBg} transition-colors`}
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

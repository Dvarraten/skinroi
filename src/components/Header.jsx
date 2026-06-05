// Sticky app header — logo, nav buttons, currency popover, theme picker,
// pending-item badge, and user account dropdown.
import React, { useRef, useState, useEffect } from "react";
import {
  BarChart3,
  LogOut,
  ExternalLink,
  Download,
  Upload,
  User,
  PackagePlus,
  Inbox,
  Info,
  CheckCircle,
  ArrowLeftRight,
  ArrowDownUp,
  Home,
  ShieldCheck,
  PanelLeft,
} from "lucide-react";
import steamLogo from "../assets/platforms/steam.png";
import logoSrc from "../utils/skinroi-logo.svg";
import logoLightSrc from "../utils/skinroi-logo-light.svg";
import CurrencyConverter from "./Sidebar/CurrencyConverter";

function SteamIcon({ className }) {
  return <img src={steamLogo} alt="" className={className} />;
}

export default function Header({
  theme,
  onAnalyticsClick,
  onAddItemClick,
  onHandleItemsClick,
  onTransactionClick,
  showTransactions = false,
  onAboutClick,
  onHomeClick,
  showAddItem = false,
  showHandleItems = false,
  pendingCount = 0,
  user,
  onLogin,
  onLogout,
  onExportCSV,
  onImportCSV,
  hasRefreshToken = false,
  tradeHoldDismissed = false,
  onEnableTradeHold,
  // Currency converter props (for popover)
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
  converterPinned,
  setConverterPinned,
  children,
}) {
  const importInputRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const dropdownRef = useRef(null);
  const currencyRef = useRef(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!currencyOpen) return;
    const handler = (e) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target)) {
        setCurrencyOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [currencyOpen]);

  const navBtn = (active) =>
    `relative px-1 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-colors group ${
      active ? (theme?.text || "text-white") : `text-slate-400 ${theme?.textHover || "hover:text-white"}`
    }`;

  const dotColor = theme?.accentColor || theme?.dotColor || '#3b82f6';

  return (
    <header className={`w-full sticky top-0 z-50 px-4 pt-3 pb-1 ${theme?.bg || 'bg-[#0c1120]'}`}>
      <div className={`px-5 h-14 flex items-center justify-between rounded-2xl shadow-lg ${theme?.header || "bg-gradient-to-b from-[#0e1a32] to-[#070c16]"}`}>
        {/* LEFT: Logo + Nav */}
        <div className="flex items-center gap-8">
          <img
            src={theme?.name === 'Light' ? logoLightSrc : logoSrc}
            alt="SkinROI"
            style={{ height: "52px", width: "auto" }}
          />
          <nav className="hidden md:flex items-center gap-6">
            {/* Home — always active since we're always on the main view */}
            <button onClick={onHomeClick} className={`flex items-center gap-1.5 ${navBtn(true)}`}>
              <Home size={15} />
              Home
              <span className="absolute bottom-0 left-0 h-[2px] rounded-full transition-all duration-200 w-full" style={{ backgroundColor: dotColor }} />
            </button>
            <button onClick={onAddItemClick} className={`flex items-center gap-1.5 ${navBtn(showAddItem)}`}>
              <PackagePlus size={15} />
              Add Item
              <span className={`absolute bottom-0 left-0 h-[2px] rounded-full transition-all duration-200 ${showAddItem ? "w-full" : "w-0 group-hover:w-full"}`} style={{ backgroundColor: dotColor }} />
            </button>
            <button
              onClick={onHandleItemsClick}
              className={`flex items-center gap-1.5 ${navBtn(showHandleItems)}`}
            >
              <Inbox size={15} />
              <span>Handle Items</span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
              <span className={`absolute bottom-0 left-0 h-[2px] rounded-full transition-all duration-200 ${showHandleItems ? "w-full" : "w-0 group-hover:w-full"}`} style={{ backgroundColor: dotColor }} />
            </button>
            <button onClick={onTransactionClick} className={`flex items-center gap-1.5 ${navBtn(showTransactions)}`}>
              <ArrowDownUp size={15} />
              Transactions
              <span className={`absolute bottom-0 left-0 h-[2px] rounded-full transition-all duration-200 ${showTransactions ? "w-full" : "w-0 group-hover:w-full"}`} style={{ backgroundColor: dotColor }} />
            </button>
            <button onClick={onAnalyticsClick} className={`flex items-center gap-1.5 ${navBtn(false)}`}>
              <BarChart3 size={15} />
              Analytics
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-200 group-hover:w-full" style={{ backgroundColor: dotColor }} />
            </button>
            <button onClick={onAboutClick} className={`flex items-center gap-1.5 ${navBtn(false)}`}>
              <Info size={15} />
              About
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-200 group-hover:w-full" style={{ backgroundColor: dotColor }} />
            </button>
          </nav>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          {/* Currency converter popover */}
          <div className="relative" ref={currencyRef}>
            <button
              onClick={() => setCurrencyOpen(o => !o)}
              title="Currency converter"
              className={`p-2 rounded-lg transition-all ${
                currencyOpen
                  ? `${theme?.text || 'text-white'} bg-white/8`
                  : 'text-slate-400 hover:text-white hover:bg-white/8'
              }`}
            >
              <ArrowLeftRight size={18} />
            </button>

            {currencyOpen && (
              <div className={`absolute right-0 top-12 w-72 rounded-xl border ${theme?.panelBorder || 'border-white/10'} ${theme?.panel || 'bg-[#151f35]'} shadow-xl p-4 z-[60]`}>
                <p className={`text-xs font-semibold ${theme?.subtext || 'text-slate-400'} uppercase tracking-wide mb-3`}>Currency Converter</p>
                <CurrencyConverter
                  usdAmount={usdAmount}
                  rmbAmount={rmbAmount}
                  sidebarRate={sidebarRate}
                  lastUpdated={lastUpdated}
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
                  <p className={`text-[10px] ${theme?.subtext || 'text-slate-500'} mt-2 text-center`}>
                    Last Updated: {lastUpdated}
                  </p>
                )}
                {setConverterPinned && (
                  <button
                    onClick={() => setConverterPinned(p => !p)}
                    className={`mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                      converterPinned
                        ? `${theme?.accent || 'text-blue-400'} bg-white/8`
                        : `text-slate-500 hover:text-slate-300 hover:bg-white/5`
                    }`}
                  >
                    <PanelLeft size={12} />
                    {converterPinned ? 'Pinned to sidebar' : 'Pin to sidebar'}
                  </button>
                )}
              </div>
            )}
          </div>

          {children}

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="rounded-full p-0.5 transition-all"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.personaName || ""}
                    className={`w-10 h-10 rounded-full ring-2 transition-all ${dropdownOpen ? "ring-white/70" : "ring-white/20 hover:ring-white/55"}`}
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full ring-2 transition-all flex items-center justify-center ${theme?.card || 'bg-white/10'} ${dropdownOpen ? "ring-white/70" : "ring-white/20 hover:ring-white/55"}`}>
                    <User size={18} className="text-slate-400" />
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <div className={`absolute right-0 top-12 w-52 rounded-xl border ${theme?.panelBorder || 'border-white/10'} ${theme?.panel || 'bg-[#151f35]'} shadow-xl overflow-hidden z-50`}>
                  {user.personaName && (
                    <div className={`px-4 py-3 border-b ${theme?.panelBorder || 'border-white/10'}`}>
                      <p className={`${theme?.text || 'text-white'} text-sm font-medium truncate`}>
                        {user.personaName}
                      </p>
                    </div>
                  )}
                  <div className="py-1">
                    <a
                      href={`https://steamcommunity.com/profiles/${user.steamId}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${theme?.textSecondary || 'text-slate-300'} ${theme?.textHover || 'hover:text-white'} ${theme?.itemHoverBg || 'hover:bg-white/8'} transition-all`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      <ExternalLink size={15} />
                      Steam Profile
                    </a>
                    <a
                      href={`https://steamcommunity.com/profiles/${user.steamId}/inventory/#730`}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${theme?.textSecondary || 'text-slate-300'} ${theme?.textHover || 'hover:text-white'} ${theme?.itemHoverBg || 'hover:bg-white/8'} transition-all`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      <ExternalLink size={15} />
                      CS2 Inventory
                    </a>
                    {onExportCSV && (
                      <button
                        onClick={() => { onExportCSV(); setDropdownOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${theme?.textSecondary || 'text-slate-300'} ${theme?.textHover || 'hover:text-white'} ${theme?.itemHoverBg || 'hover:bg-white/8'} transition-all`}
                      >
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
                            setDropdownOpen(false);
                          }}
                        />
                        <button
                          onClick={() => importInputRef.current?.click()}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${theme?.textSecondary || 'text-slate-300'} ${theme?.textHover || 'hover:text-white'} ${theme?.itemHoverBg || 'hover:bg-white/8'} transition-all`}
                        >
                          <Upload size={15} />
                          Import CSV
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { onAnalyticsClick(); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${theme?.textSecondary || 'text-slate-300'} ${theme?.textHover || 'hover:text-white'} ${theme?.itemHoverBg || 'hover:bg-white/8'} transition-all`}
                    >
                      <BarChart3 size={15} />
                      Analytics
                    </button>
                    <div className={`border-t ${theme?.panelBorder || 'border-white/10'} mt-1 pt-1`}>
                      {hasRefreshToken && (
                        <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-400">
                          <CheckCircle size={15} />
                          Trade sync active
                        </div>
                      )}
                      {!hasRefreshToken && tradeHoldDismissed && onEnableTradeHold && (
                        <button
                          onClick={() => { onEnableTradeHold(); setDropdownOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-400 hover:text-blue-300 ${theme?.itemHoverBg || 'hover:bg-white/8'} transition-all`}
                        >
                          <ShieldCheck size={15} />
                          Enable trade-hold detection
                        </button>
                      )}
                      <button
                        onClick={() => { onLogout(); setDropdownOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 ${theme?.itemHoverBg || 'hover:bg-white/8'} transition-all`}
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onLogin}
              className={`relative flex items-center gap-1.5 px-1 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-colors group text-slate-400 ${theme?.textHover || "hover:text-white"}`}
            >
              <SteamIcon className="h-3.5 w-3.5" />
              Sign in
              <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-200 group-hover:w-full" style={{ backgroundColor: dotColor }} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { themes } from './themes/themes';
import './index.css';

import { useAuth } from './hooks/useAuth';
import { useItems } from './hooks/useItems';
import { useExchangeRate } from './hooks/useExchangeRate';
import { useChartData } from './hooks/useChartData';
import { useSteamSync } from './hooks/useSteamSync';
import { useCsfloatAutoSync } from './hooks/useCsfloatAutoSync';
import { useSellPrices } from './hooks/useSellPrices';
import { freshnessRows } from './utils/freshness';
import { useValueHistory } from './hooks/useValueHistory';
import { portfolioSnapshot } from './utils/portfolioValue';
import { exportToCSV } from './utils/exportCSV';
import { importFromCSV } from './utils/importCSV';
import { portfolioStats } from './utils/portfolioStats';

import Sidebar, { MobileTabBar } from './components/Sidebar';
import SaveStatusChip from './components/SaveStatusChip';
import HandleItemsPage from './pages/HandleItemsPage';
import PortfolioPage from './pages/PortfolioPage';
import AboutPage from './pages/AboutPage';
import ConnectionsPage from './pages/ConnectionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AddPage from './pages/AddPage';
import SnipesPage from './pages/SnipesPage';
import LandingPage from './pages/LandingPage';
import DemoBanner from './components/DemoBanner';
import SteamImportModal from './components/SteamImportModal';

// Demo mode lasts for the browser tab, so a reload keeps the visitor in it.
const DEMO_KEY = 'skinroi-demo';
const readDemo = () => { try { return sessionStorage.getItem(DEMO_KEY) === '1'; } catch { return false; } };

export default function CS2TradingTracker() {
  const { user, loading: authLoading, login, logout } = useAuth();
  // Guest mode: the visitor chose to use the app without an account (data in
  // localStorage). Kept from the old welcome modal's key.
  const [authDismissed, setAuthDismissed] = useState(
    () => !!localStorage.getItem('cs2-auth-dismissed')
  );
  const [demoState, setDemoState] = useState(readDemo);
  // A signed-in user is never in demo mode, whatever the tab remembers.
  const demo = demoState && !user;
  const showLanding = !authLoading && !user && !authDismissed && !demo;
  const setDemo = (on) => {
    try { on ? sessionStorage.setItem(DEMO_KEY, '1') : sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    setDemoState(on);
  };
  // Leaving for Steam ends the demo, so the user doesn't come back to it.
  const signIn = () => { setDemo(false); login(); };
  const continueAsGuest = () => {
    localStorage.setItem('cs2-auth-dismissed', '1');
    setAuthDismissed(true);
    setDemo(false);
  };
  const [importOpen, setImportOpen] = useState(false);

  const {
    items, setItems, portfolioReady, itemsLoading, formData, setFormData, sellData, setSellData,
    sellPlatform, setSellPlatform, handleAddItem, handleSellItem, handleDeleteItem,
    addItemDirect, sellItemDirect, promotePendingItem, handleAddTransaction,
    saveStatus, retrySave, dismissConflict,
  } = useItems(user?.steamId, { demo });

  const handleImportCSV = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const imported = importFromCSV(e.target.result);
      if (imported.length === 0) return;
      setItems(prev => [...imported, ...prev]);
    };
    reader.readAsText(file);
  };

  const steamSync = useSteamSync();
  useCsfloatAutoSync({
    enabled: portfolioReady,
    pending: steamSync.pending,
    items,
    addItemDirect,
    sellItemDirect,
    dismiss: steamSync.dismiss,
  });

  const {
    usdAmount, rmbAmount,
    exchangeRate, sidebarRate, lastUpdated, allRates, handleUsdChange, handleRmbChange,
    currency1, setCurrency1, currency1Symbol,
    displayCurrency, setDisplayCurrency, currencySymbol,
  } = useExchangeRate();

  // Portfolio lists what the user holds and, on its second tab, what they sold.
  // Trades are handled on the Trades page; manual sell / mark received / delete
  // sit in the ⋯ menu on each card.
  const [portfolioTab, setPortfolioTab] = useState('active'); // 'active' | 'sold'
  const [activePage, setActivePage] = useState(null); // null = Portfolio | 'add' | 'handleItems' | 'snipes' | 'analytics' | 'about' | 'connections'
  const [chartPeriod, setChartPeriod] = useState('30d');
  // Dark is the default; a theme the user picked is kept in localStorage.
  // (Older saved themes that no longer exist fall back to Dark.)
  const [theme, setTheme] = useState(() => (localStorage.getItem('cs2-theme') === 'light' ? 'light' : 'dark'));

  const isHome             = !activePage;
  const sellPrices = useSellPrices(!!user && isHome);
  // Last sell prices seen this session, so the sidebar's data status still
  // knows them on other pages (they are only fetched on Portfolio).
  const [lastSellPrices, setLastSellPrices] = useState(null);
  useEffect(() => { if (sellPrices) setLastSellPrices(sellPrices); }, [sellPrices]);
  useEffect(() => { setLastSellPrices(null); }, [user?.steamId]);
  // Today's holding cost vs. market value, from the sell prices Portfolio
  // shows; stored once a day for the Analytics value chart.
  const valueSnapshot = useMemo(
    () => (portfolioReady && sellPrices ? portfolioSnapshot(items, sellPrices.prices) : null),
    [portfolioReady, sellPrices, items]
  );
  const valueHistory = useValueHistory(user?.steamId, valueSnapshot);
  // Auth or portfolio still on its way: Home shows skeletons, not empty states.
  const homeLoading = authLoading || itemsLoading;
  const isAnalyticsPage    = activePage === 'analytics';
  const isAddPage          = activePage === 'add';
  const isHandleItemsPage  = activePage === 'handleItems';
  const isAboutPage        = activePage === 'about';
  const isConnectionsPage  = activePage === 'connections';
  const isSnipesPage       = activePage === 'snipes';
  const openPage = (name) => setActivePage(name || null);

  const themeStyles = themes[theme];
  const { profitChartData, allTimeProfitChartData } = useChartData(items, chartPeriod);

  useEffect(() => {
    localStorage.setItem('cs2-theme', theme);
    // Selection, caret and focus rings in index.css read the theme accent.
    document.documentElement.style.setProperty('--accent', themes[theme].accentColor);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (isHandleItemsPage) steamSync.refreshState();
  }, [isHandleItemsPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const now = Date.now();
    items
      .filter(i => i.pending && !i.sold && i.expectedDelivery)
      .forEach(i => {
        const ts = typeof i.expectedDelivery === 'string'
          ? new Date(i.expectedDelivery).getTime()
          : i.expectedDelivery;
        if (!isNaN(ts) && ts <= now) promotePendingItem(i.id);
      });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => portfolioStats(items), [items]);

  return (
    <div className={`flex flex-col md:flex-row h-[100dvh] overflow-hidden ${themeStyles.bg} ${themeStyles.text}`}>
      {showLanding && (
        <LandingPage
          theme={themeStyles}
          isDark={theme === 'dark'}
          onLogin={signIn}
          onDemo={() => { setDemo(true); setActivePage(null); }}
          onGuest={continueAsGuest}
        />
      )}

      {!showLanding && (<>
      <Sidebar
        theme={themeStyles}
        activePage={activePage}
        onNavigate={openPage}
        pendingCount={steamSync.pendingCount}
        user={user}
        onLogin={signIn}
        onLogout={logout}
        onExportCSV={() => exportToCSV(items)}
        onImportCSV={handleImportCSV}
        extension={steamSync.extension}
        syncError={
          steamSync.reachable === false ? 'Backend unreachable. Check your connection or try again.'
          : steamSync.lastSyncOk === false ? `Last push failed: ${steamSync.lastError || 'unknown error'}`
          : null
        }
        onExtensionChange={steamSync.refreshState}
        isDark={theme === 'dark'}
        onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        lastUpdated={lastUpdated}
        freshness={user ? freshnessRows({
          extension: steamSync.extension,
          sellPrices: lastSellPrices,
          saveStatus,
          reachable: steamSync.reachable,
          lastSyncOk: steamSync.lastSyncOk,
          lastError: steamSync.lastError,
        }) : null}
        converter={{
          usdAmount, rmbAmount, sidebarRate, handleUsdChange, handleRmbChange,
          currency1, setCurrency1, currency1Symbol,
          displayCurrency, setDisplayCurrency, currencySymbol,
        }}
      />

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
      {demo && (
        <DemoBanner
          theme={themeStyles}
          onLogin={signIn}
          onExit={() => { setDemo(false); setActivePage(null); }}
        />
      )}

      {/* ── Portfolio ─────────────────────────────────────────────────────── */}
      {isHome && (
        <PortfolioPage
          theme={themeStyles}
          user={user}
          loading={homeLoading}
          items={items}
          stats={stats}
          profitChartData={allTimeProfitChartData}
          marketValue={valueSnapshot}
          sellPrices={sellPrices}
          extension={steamSync.extension}
          onExtensionChange={steamSync.refreshState}
          onImportSteam={() => setImportOpen(true)}
          onAddManually={() => openPage('add')}
          portfolioTab={portfolioTab}
          setPortfolioTab={setPortfolioTab}
          itemActions={{
            sellData, setSellData, sellPlatform, setSellPlatform,
            handleSellItem, handleDeleteItem, promotePendingItem,
          }}
          exchangeRate={exchangeRate}
          currencySymbol={currencySymbol}
          displayCurrency={displayCurrency}
        />
      )}

      {/* ── Add (item or deposit / withdrawal) ────────────────────────────── */}
      {isAddPage && (
        <AddPage
          formData={formData} setFormData={setFormData}
          handleAddItem={handleAddItem} theme={themeStyles}
          exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency}
          items={items}
          canImport={!!user}
          onImportSteam={() => setImportOpen(true)}
          onLogin={signIn}
          demo={demo}
          onAddTransaction={handleAddTransaction}
        />
      )}

      {isAboutPage && <AboutPage theme={themeStyles} />}

      {isConnectionsPage && <ConnectionsPage theme={themeStyles} signedIn={!!user} onLogin={signIn} />}

      {isSnipesPage && (
        <SnipesPage key={user ? 'live' : 'demo'} theme={themeStyles} rates={allRates} demo={!user} onLogin={signIn} />
      )}

      {isAnalyticsPage && (
        <AnalyticsPage
          profitChartData={profitChartData}
          chartPeriod={chartPeriod}
          setChartPeriod={setChartPeriod}
          stats={stats}
          theme={themeStyles}
          items={items}
          valueHistory={valueHistory}
        />
      )}

      {/* ── Trades (pending Steam trades) ─────────────────────────────────── */}
      {isHandleItemsPage && (
        <HandleItemsPage
          theme={themeStyles}
          items={items}
          addItemDirect={addItemDirect}
          sellItemDirect={sellItemDirect}
          promotePendingItem={promotePendingItem}
          exchangeRate={exchangeRate}
          currencySymbol={currencySymbol}
          displayCurrency={displayCurrency}
          usdAmount={usdAmount}
          rmbAmount={rmbAmount}
          handleUsdChange={handleUsdChange}
          handleRmbChange={handleRmbChange}
          {...steamSync}
          onDismiss={steamSync.dismiss}
        />
      )}
      </main>

      <MobileTabBar
        theme={themeStyles}
        activePage={activePage}
        onNavigate={openPage}
        pendingCount={steamSync.pendingCount}
      />
      <SaveStatusChip theme={themeStyles} status={saveStatus} onRetry={retrySave} onDismiss={dismissConflict} />
      </>)}

      {importOpen && user && (
        <SteamImportModal
          theme={themeStyles}
          items={items}
          addItemDirect={addItemDirect}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}

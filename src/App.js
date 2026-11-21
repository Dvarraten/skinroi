import React, { useState, useEffect, useMemo } from 'react';
import { themes } from './themes/themes';
import './index.css';

import { useAuth } from './hooks/useAuth';
import { useItems } from './hooks/useItems';
import { useExchangeRate } from './hooks/useExchangeRate';
import { useChartData } from './hooks/useChartData';
import { useSteamSync } from './hooks/useSteamSync';
import { useCsfloatAutoSync } from './hooks/useCsfloatAutoSync';
import { usePortfolioView } from './hooks/usePortfolioView';
import { useSellPrices } from './hooks/useSellPrices';
import { useValueHistory } from './hooks/useValueHistory';
import { portfolioSnapshot } from './utils/portfolioValue';
import { exportToCSV } from './utils/exportCSV';
import { importFromCSV } from './utils/importCSV';

import Sidebar, { MobileTabBar } from './components/Sidebar';
import { Page } from './components/PageHeader';
import ItemGrid from './components/ItemGrid';
import TabsAndSearchbar, { TabButton } from './components/TabsAndSearchbar';
import PortfolioHero from './components/PortfolioHero';
import SellPriceStatus from './components/SellPriceStatus';
import { ItemGridSkeleton } from './components/Skeleton';
import HandleItemsPage from './pages/HandleItemsPage';
import AboutPage from './pages/AboutPage';
import ConnectionsPage from './pages/ConnectionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AddPage from './pages/AddPage';
import SnipesPage from './pages/SnipesPage';
import LandingPage from './pages/LandingPage';
import DemoBanner from './components/DemoBanner';
import OnboardingChecklist from './components/OnboardingChecklist';
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
  const { searchTerm, setSearchTerm, sortBy, setSortBy, sortedItems } = usePortfolioView(items, portfolioTab);
  const [activePage, setActivePage] = useState(null); // null = Portfolio | 'add' | 'handleItems' | 'snipes' | 'analytics' | 'about' | 'connections'
  const [chartPeriod, setChartPeriod] = useState('30d');
  // Dark is the default; a theme the user picked is kept in localStorage.
  // (Older saved themes that no longer exist fall back to Dark.)
  const [theme, setTheme] = useState(() => (localStorage.getItem('cs2-theme') === 'light' ? 'light' : 'dark'));
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('skinroi-view-mode');
    return saved === 'list' ? 'list' : 'grid';
  });

  const isHome             = !activePage;
  const sellPrices = useSellPrices(!!user && isHome);
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
  useEffect(() => { localStorage.setItem('skinroi-view-mode', viewMode); }, [viewMode]);

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

  const stats = {
    totalActive:      items.filter(i => !i.sold).reduce((sum, i) => sum + i.purchasePrice, 0),
    totalActiveCount: items.filter(i => !i.sold).length,
    totalPending:     items.filter(i => !i.sold && i.pending).length,
    totalSold:        items.filter(i => i.sold).reduce((sum, i) => sum + i.purchasePrice + i.profit, 0),
    totalSoldCount:   items.filter(i => i.sold).length,
    totalProfit:      items.filter(i => i.sold).reduce((sum, i) => sum + i.profit, 0),
    totalInvested:    items.reduce((sum, i) => sum + i.purchasePrice, 0),
  };

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
      <Page>
        {user && !homeLoading && steamSync.extension && (
          <div className="mb-8 empty:hidden">
            <OnboardingChecklist
              theme={themeStyles}
              steamId={user.steamId}
              extension={steamSync.extension}
              items={items}
              onExtensionChange={steamSync.refreshState}
              onImportSteam={() => setImportOpen(true)}
              onAddManually={() => openPage('add')}
            />
          </div>
        )}

        <PortfolioHero
          stats={stats}
          profitChartData={allTimeProfitChartData}
          theme={themeStyles}
          loading={homeLoading}
          marketValue={valueSnapshot}
        />

        <div className={`mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b ${themeStyles.cardBorder}`}>
          <TabButton
            label="Holding" count={homeLoading ? '' : stats.totalActiveCount}
            isActive={portfolioTab === 'active'} onClick={() => setPortfolioTab('active')}
            theme={themeStyles} accentColor={themeStyles.accentColor}
            badgeClass={themeStyles.subtext}
          />
          <TabButton
            label="Sold" count={homeLoading ? '' : stats.totalSoldCount}
            isActive={portfolioTab === 'sold'} onClick={() => setPortfolioTab('sold')}
            theme={themeStyles} accentColor={themeStyles.accentColor}
            badgeClass={themeStyles.subtext}
          />
          {!homeLoading && portfolioTab === 'active' && (
            <SellPriceStatus sellPrices={sellPrices} hasItems={stats.totalActiveCount > 0} />
          )}
        </div>

        <div className="mt-4">
          <TabsAndSearchbar
            theme={themeStyles}
            activeTab={portfolioTab}
            showTabs={false}
            allowSelect={false}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            sortBy={sortBy} setSortBy={setSortBy}
            viewMode={viewMode} setViewMode={setViewMode}
          />
        </div>

        <div className="mt-4">
          {homeLoading ? (
            <ItemGridSkeleton theme={themeStyles} viewMode={viewMode} />
          ) : (
            <ItemGrid
              menuActions={portfolioTab === 'active'}
              sellPlatform={sellPlatform} setSellData={setSellData}
              sellData={sellData} setSellPlatform={setSellPlatform}
              handleSellItem={handleSellItem} handleDeleteItem={handleDeleteItem}
              promotePendingItem={promotePendingItem}
              exchangeRate={exchangeRate}
              currencySymbol={currencySymbol}
              displayCurrency={displayCurrency}
              theme={themeStyles} sortedItems={sortedItems}
              searchTerm={searchTerm} activeTab={portfolioTab}
              viewMode={viewMode}
              sellPrices={portfolioTab === 'active' ? sellPrices : null}
            />
          )}
        </div>
      </Page>
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

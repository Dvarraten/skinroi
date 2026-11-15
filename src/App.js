import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { themes } from './themes/themes';
import { ThemeContext } from './themes/ThemeContext';
import './index.css';

import { useAuth } from './hooks/useAuth';
import { useItems } from './hooks/useItems';
import { useExchangeRate } from './hooks/useExchangeRate';
import { useChartData } from './hooks/useChartData';
import { useSteamSync } from './hooks/useSteamSync';
import { useCsfloatAutoSync } from './hooks/useCsfloatAutoSync';
import { usePortfolioView } from './hooks/usePortfolioView';
import { usePageRoute } from './hooks/usePageRoute';
import { useSellPrices } from './hooks/useSellPrices';
import { exportToCSV } from './utils/exportCSV';
import { importFromCSV } from './utils/importCSV';

import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ItemGrid from './components/ItemGrid';
import ListToolbar from './components/ListToolbar';
import { Button } from './components/ui/Button';
import PortfolioHero from './components/PortfolioHero';
import RecentSales from './components/RecentSales';
import SellPriceStatus from './components/SellPriceStatus';
import { ItemGridSkeleton, RecentSalesSkeleton } from './components/Skeleton';
import CurrencyConverter from './components/CurrencyConverter';
import HandleItemsPage from './pages/HandleItemsPage';
import AboutPage from './pages/AboutPage';
import TransactionPage from './pages/TransactionPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AddItemPage from './pages/AddItemPage';
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

  // Home shows active items only. Trades are handled in Handle Items; manual
  // sell / mark received / delete sit in the ⋯ menu on each Home card.
  const { searchTerm, setSearchTerm, sortBy, setSortBy, sortedItems } = usePortfolioView(items, 'active');
  // null = Home | 'addItem' | 'handleItems' | 'transactions' | 'snipes' | 'analytics' | 'about'
  const [activePage, setActivePage] = usePageRoute();
  const [chartPeriod, setChartPeriod] = useState('30d');
  // Dark is the default; a theme the user picked is kept in localStorage.
  const [theme, setTheme] = useState(() => { const t = localStorage.getItem('cs2-theme'); const r = t === 'v2' ? 'dark' : (t || 'dark'); return themes[r] ? r : 'dark'; });
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('skinroi-view-mode');
    return saved === 'list' ? 'list' : 'grid';
  });

  const isHome             = !activePage;
  const sellPrices = useSellPrices(!!user && isHome);
  // Auth or portfolio still on its way: Home shows skeletons, not empty states.
  const homeLoading = authLoading || itemsLoading;
  const isAnalyticsPage    = activePage === 'analytics';
  const isAddItemPage      = activePage === 'addItem';
  const isHandleItemsPage  = activePage === 'handleItems';
  const isTransactionsPage = activePage === 'transactions';
  const isAboutPage        = activePage === 'about';
  const isSnipesPage       = activePage === 'snipes';
  const openPage = (name) => setActivePage(name);

  const themeStyles = themes[theme];
  const { profitChartData, allTimeProfitChartData } = useChartData(items, chartPeriod);

  useEffect(() => {
    localStorage.setItem('cs2-theme', theme);
    // Selection, caret and focus rings in index.css read the theme accent.
    document.documentElement.style.setProperty('--accent', themes[theme].accentColor || themes[theme].dotColor);
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
    <ThemeContext.Provider value={themeStyles}>
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-dvh overflow-hidden">
      <div className={`fixed inset-0 -z-10 pointer-events-none ${themeStyles.bg}`} />

      {showLanding && (
        <LandingPage
          theme={themeStyles}
          onLogin={signIn}
          onDemo={() => { setDemo(true); setActivePage(null); }}
          onGuest={continueAsGuest}
        />
      )}

      {!showLanding && (<>
      {/* ── Top header ────────────────────────────────────────────────────── */}
      <Header
        theme={themeStyles}
        activePage={activePage}
        onNavigate={setActivePage}
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
        themeKey={theme}
        setTheme={setTheme}
        usdAmount={usdAmount}
        rmbAmount={rmbAmount}
        sidebarRate={sidebarRate}
        lastUpdated={lastUpdated}
        handleUsdChange={handleUsdChange}
        handleRmbChange={handleRmbChange}
        currency1={currency1}
        setCurrency1={setCurrency1}
        currency1Symbol={currency1Symbol}
        displayCurrency={displayCurrency}
        setDisplayCurrency={setDisplayCurrency}
        currencySymbol={currencySymbol}
      />

      {demo && (
        <DemoBanner
          theme={themeStyles}
          onLogin={signIn}
          onExit={() => { setDemo(false); setActivePage(null); }}
        />
      )}

      {/* ── Home view ─────────────────────────────────────────────────────── */}
      {/* One main column (summary, toolbar, items) and a side rail on wide
          screens. On phones the whole page scrolls; from md up only the item
          list does, so the summary and toolbar stay in view. */}
      {isHome && (
      <div className="flex flex-1 min-h-0 gap-6 px-4 md:px-6 pt-4 overflow-y-auto md:overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col gap-4 md:min-h-0">

          {user && !homeLoading && steamSync.extension && (
            <div className="shrink-0">
              <OnboardingChecklist
                theme={themeStyles}
                steamId={user.steamId}
                extension={steamSync.extension}
                items={items}
                onExtensionChange={steamSync.refreshState}
                onImportSteam={() => setImportOpen(true)}
                onAddManually={() => openPage('addItem')}
              />
            </div>
          )}

          <div className="shrink-0">
            <PortfolioHero
              stats={stats}
              profitChartData={allTimeProfitChartData}
              theme={themeStyles}
              loading={homeLoading}
            />
          </div>

          <div className="shrink-0 space-y-2.5 md:pr-[18px]">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className={`text-base font-semibold ${themeStyles.text}`}>Active items</h2>
              {!homeLoading && (
                <span className={`text-sm font-mono ${themeStyles.subtext}`}>{stats.totalActiveCount}</span>
              )}
              {!homeLoading && stats.totalPending > 0 && (
                <span className="text-[13px] text-warn whitespace-nowrap">· {stats.totalPending} on trade hold</span>
              )}
              {!homeLoading && (
                <SellPriceStatus sellPrices={sellPrices} hasItems={stats.totalActiveCount > 0} />
              )}
            </div>
            <ListToolbar
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              sortBy={sortBy} setSortBy={setSortBy}
              viewMode={viewMode} setViewMode={setViewMode}
              actions={steamSync.pendingCount > 0 && (
                <Button size="sm" onClick={() => openPage('handleItems')} iconRight={<ChevronRight size={14} />}>
                  {steamSync.pendingCount} {steamSync.pendingCount === 1 ? 'trade' : 'trades'} to handle
                </Button>
              )}
            />
          </div>

          <div className="pb-6 md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-3 md:[scrollbar-gutter:stable]">
            {homeLoading ? (
              <ItemGridSkeleton theme={themeStyles} viewMode={viewMode} />
            ) : (
            <ItemGrid
              menuActions
              sellPlatform={sellPlatform} setSellData={setSellData}
              sellData={sellData} setSellPlatform={setSellPlatform}
              handleSellItem={handleSellItem} handleDeleteItem={handleDeleteItem}
              promotePendingItem={promotePendingItem}
              exchangeRate={exchangeRate}
              currencySymbol={currencySymbol}
              displayCurrency={displayCurrency}
              theme={themeStyles} sortedItems={sortedItems}
              searchTerm={searchTerm} activeTab="active"
              viewMode={viewMode}
              sellPrices={sellPrices}
              onAddItem={() => openPage('addItem')}
            />
            )}
          </div>
        </div>

        {/* Side rail — converter and recent sales */}
        <aside className="hidden lg:flex w-[300px] shrink-0 flex-col gap-6 pb-6 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section>
            <h2 className={`text-[13px] font-medium ${themeStyles.subtext} mb-2`}>Currency converter</h2>
            <CurrencyConverter
              usdAmount={usdAmount}
              rmbAmount={rmbAmount}
              sidebarRate={sidebarRate}
              handleUsdChange={handleUsdChange}
              handleRmbChange={handleRmbChange}
              theme={themeStyles}
              currency1={currency1}
              setCurrency1={setCurrency1}
              currency1Symbol={currency1Symbol}
              displayCurrency={displayCurrency}
              setDisplayCurrency={setDisplayCurrency}
              currencySymbol={currencySymbol}
            />
          </section>
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className={`text-[13px] font-medium ${themeStyles.subtext}`}>Recent sales</h2>
              <button
                type="button"
                onClick={() => openPage('analytics')}
                className={`text-xs ${themeStyles.subtext} ${themeStyles.textHover} transition-colors`}
              >
                Analytics →
              </button>
            </div>
            {homeLoading
              ? <RecentSalesSkeleton theme={themeStyles} />
              : <RecentSales items={items} theme={themeStyles} />}
          </section>
        </aside>
      </div>
      )}

      {/* ── Add Item page ─────────────────────────────────────────────────── */}
      {isAddItemPage && (
        <AddItemPage
          formData={formData} setFormData={setFormData}
          handleAddItem={handleAddItem} theme={themeStyles}
          exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency}
          items={items}
          canImport={!!user}
          onImportSteam={() => setImportOpen(true)}
          onLogin={signIn}
          demo={demo}
        />
      )}

      {/* ── About page ───────────────────────────────────────────────────── */}
      {isAboutPage && <AboutPage theme={themeStyles} />}

      {/* ── Transactions page ────────────────────────────────────────────── */}
      {isTransactionsPage && (
        <TransactionPage
          onAdd={(tx) => { handleAddTransaction(tx); }}
          theme={themeStyles}
          items={items}
        />
      )}

      {/* ── Snipes page ──────────────────────────────────────────────────── */}
      {isSnipesPage && (
        <SnipesPage key={user ? 'live' : 'demo'} theme={themeStyles} rates={allRates} demo={!user} onLogin={signIn} />
      )}

      {/* ── Analytics page ───────────────────────────────────────────────── */}
      {isAnalyticsPage && (
        <AnalyticsPage
          profitChartData={profitChartData}
          chartPeriod={chartPeriod}
          setChartPeriod={setChartPeriod}
          stats={stats}
          theme={themeStyles}
          items={items}
        />
      )}

      {/* ── Handle Items page ────────────────────────────────────────────── */}
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
      <BottomNav
        theme={themeStyles}
        activePage={activePage}
        onNavigate={setActivePage}
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
    </ThemeContext.Provider>
  );
}

import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { themes } from './themes/themes';
import './index.css';

import { useAuth } from './hooks/useAuth';
import WelcomeModal from './components/WelcomeModal';
import { useItems } from './hooks/useItems';
import { useExchangeRate } from './hooks/useExchangeRate';
import { useChartData } from './hooks/useChartData';
import { useSteamSync } from './hooks/useSteamSync';
import { usePortfolioView } from './hooks/usePortfolioView';
import { exportToCSV } from './utils/exportCSV';
import { importFromCSV } from './utils/importCSV';

import Header from './components/Header';
import ThemePicker from './components/ThemePicker';
import ItemGrid from './components/ItemGrid';
import TabsAndSearchbar from './components/TabsAndSearchbar';
import PortfolioHero from './components/PortfolioHero';
import RecentSales from './components/RecentSales';
import CurrencyConverter from './components/CurrencyConverter';
import HandleItemsPage from './pages/HandleItemsPage';
import AboutPage from './pages/AboutPage';
import TransactionPage from './pages/TransactionPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AddItemPage from './pages/AddItemPage';
import SnipesPage from './pages/SnipesPage';

export default function CS2TradingTracker() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const [authDismissed, setAuthDismissed] = useState(
    () => !!localStorage.getItem('cs2-auth-dismissed')
  );
  const showWelcome = !authLoading && !user && !authDismissed;

  const {
    items, setItems, formData, setFormData, sellData, setSellData,
    sellPlatform, setSellPlatform, handleAddItem, handleSellItem, handleDeleteItem,
    addItemDirect, sellItemDirect, promotePendingItem, handleBulkDelete, handleAddTransaction,
  } = useItems(user?.steamId);

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

  const {
    usdAmount, rmbAmount,
    exchangeRate, sidebarRate, lastUpdated, handleUsdChange, handleRmbChange,
    currency1, setCurrency1, currency1Symbol,
    displayCurrency, setDisplayCurrency, currencySymbol,
  } = useExchangeRate();

  // Home shows active items only; selling and managing happens in Handle Items.
  const { searchTerm, setSearchTerm, sortBy, setSortBy, sortedItems } = usePortfolioView(items, 'active');
  const [activePage, setActivePage] = useState(null); // null = Home | 'addItem' | 'handleItems' | 'transactions' | 'snipes' | 'analytics' | 'about'
  const [chartPeriod, setChartPeriod] = useState('30d');
  const [theme, setTheme] = useState(() => { const t = localStorage.getItem('cs2-theme'); const r = t === 'v2' ? 'dark' : (t || 'bloomberg'); return themes[r] ? r : 'bloomberg'; });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [converterPinned, setConverterPinned] = useState(() => !!localStorage.getItem('skinroi-converter-pinned'));
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('skinroi-view-mode');
    return saved === 'list' ? 'list' : 'grid';
  });

  const isHome             = !activePage;
  const isAnalyticsPage    = activePage === 'analytics';
  const isAddItemPage      = activePage === 'addItem';
  const isHandleItemsPage  = activePage === 'handleItems';
  const isTransactionsPage = activePage === 'transactions';
  const isAboutPage        = activePage === 'about';
  const isSnipesPage       = activePage === 'snipes';
  const openPage  = (name) => setActivePage(prev => prev === name ? null : name);
  const closePage = () => setActivePage(null);

  const themeStyles = themes[theme];
  const { profitChartData, allTimeProfitChartData } = useChartData(items, chartPeriod);

  useEffect(() => { localStorage.setItem('cs2-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('skinroi-view-mode', viewMode); }, [viewMode]);
  useEffect(() => {
    if (converterPinned) localStorage.setItem('skinroi-converter-pinned', '1');
    else localStorage.removeItem('skinroi-converter-pinned');
  }, [converterPinned]);

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
    <div
      className="flex flex-col h-screen overflow-hidden"
      onClick={() => showThemePicker && setShowThemePicker(false)}
    >
      <div className={`fixed inset-0 -z-10 pointer-events-none ${themeStyles.bg}`} />

      {showWelcome && (
        <WelcomeModal
          onLogin={login}
          onContinue={() => {
            localStorage.setItem('cs2-auth-dismissed', '1');
            setAuthDismissed(true);
          }}
          theme={themeStyles}
        />
      )}

      {/* ── Top header ────────────────────────────────────────────────────── */}
      <Header
        theme={themeStyles}
        activePage={activePage}
        onAnalyticsClick={() => openPage('analytics')}
        onSnipesClick={() => openPage('snipes')}
        onAddItemClick={() => openPage('addItem')}
        onHandleItemsClick={() => openPage('handleItems')}
        onTransactionClick={() => openPage('transactions')}
        onAboutClick={() => openPage('about')}
        onHomeClick={closePage}
        pendingCount={steamSync.pendingCount}
        user={user}
        onLogin={login}
        onLogout={logout}
        onExportCSV={() => exportToCSV(items)}
        onImportCSV={handleImportCSV}
        extensionConnected={!!steamSync.extension?.connected}
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
        converterPinned={converterPinned}
        setConverterPinned={setConverterPinned}
      >
        <div onClick={e => e.stopPropagation()}>
          <ThemePicker
            themeStyles={themeStyles}
            setShowThemePicker={setShowThemePicker}
            showThemePicker={showThemePicker}
            setTheme={setTheme}
            theme={theme}
            themes={themes}
          />
        </div>
      </Header>

      {/* ── Home view ─────────────────────────────────────────────────────── */}
      {isHome && (
      <div className="flex flex-1 min-h-0 flex-col gap-3 px-6 pt-3 pb-4 overflow-hidden">

        {/* Row 1 — hero (centered) + currency converter (right, same height) */}
        <div className="shrink-0 flex items-stretch gap-6">
          <div className="flex-1 min-w-0">
            <PortfolioHero
              stats={stats}
              profitChartData={allTimeProfitChartData}
              theme={themeStyles}
            />
          </div>
          <div className="hidden lg:flex w-[280px] shrink-0 flex-col justify-center gap-3">
            <p className={`text-[9px] font-semibold uppercase tracking-widest ${themeStyles.subtext}`}>Currency Converter</p>
            <CurrencyConverter
              usdAmount={usdAmount}
              rmbAmount={rmbAmount}
              sidebarRate={sidebarRate}
              lastUpdated={lastUpdated}
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
          </div>
        </div>

        {/* Row 2+3 — tabs + grid (left) and recent sales (right) */}
        <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden px-10">
            <div className="shrink-0 space-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className={`text-xs font-semibold uppercase tracking-widest ${themeStyles.text}`}>Active items</h2>
                <span className={`text-[11px] font-mono ${themeStyles.subtext}`}>{stats.totalActiveCount}</span>
                {stats.totalPending > 0 && (
                  <span className="text-[11px] text-warn">· {stats.totalPending} on trade hold</span>
                )}
              </div>
              <TabsAndSearchbar
                theme={themeStyles}
                activeTab="active"
                showTabs={false}
                allowSelect={false}
                actions={
                  <button
                    onClick={() => openPage('handleItems')}
                    className={`flex items-center gap-1.5 text-xs px-3 py-[7px] rounded-lg border ${themeStyles.cardBorder} ${themeStyles.subtext} ${themeStyles.textHover} transition-colors`}
                  >
                    Manage items
                    <ChevronRight size={12} />
                  </button>
                }
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                sortBy={sortBy} setSortBy={setSortBy}
                viewMode={viewMode} setViewMode={setViewMode}
              />
            </div>
            <div className="flex-1 overflow-y-auto pb-2">
              <ItemGrid
                readOnly
                theme={themeStyles} sortedItems={sortedItems}
                searchTerm={searchTerm} activeTab="active"
                viewMode={viewMode}
              />
            </div>
          </div>
          <div className="hidden lg:flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${themeStyles.subtext} mb-2 px-1`}>
                Recent Sales
              </p>
              <RecentSales items={items} theme={themeStyles} />
            </div>
          </div>
        </div>

      </div>
      )}

      {/* ── Add Item page ─────────────────────────────────────────────────── */}
      {isAddItemPage && (
        <AddItemPage
          formData={formData} setFormData={setFormData}
          handleAddItem={handleAddItem} theme={themeStyles}
          exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency}
          items={items}
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
        <SnipesPage
          theme={themeStyles}
          exchangeRate={exchangeRate}
          currencySymbol={currencySymbol}
        />
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
          sellData={sellData} setSellData={setSellData}
          sellPlatform={sellPlatform} setSellPlatform={setSellPlatform}
          handleSellItem={handleSellItem}
          handleDeleteItem={handleDeleteItem}
          handleBulkDelete={handleBulkDelete}
          viewMode={viewMode} setViewMode={setViewMode}
          onAddItem={() => openPage('addItem')}
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
    </div>
  );
}

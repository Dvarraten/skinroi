import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { themes } from './themes/themes';
import './index.css';

import { useAuth } from './hooks/useAuth';
import WelcomeModal from './components/WelcomeModal';
import { useItems } from './hooks/useItems';
import { useExchangeRate } from './hooks/useExchangeRate';
import { useChartData } from './hooks/useChartData';
import { useSteamSync } from './hooks/useSteamSync';
import { exportToCSV } from './utils/exportCSV';
import { importFromCSV } from './utils/importCSV';

import Header from './components/Header';
import ThemePicker from './components/ThemePicker';
import ItemGrid from './components/ItemGrid';
import AddItemForm from './components/AddItemForm';
import ProfitChart from './components/ProfitChart';
import TabsAndSearchbar from './components/TabsAndSearchbar';
import PortfolioHero from './components/PortfolioHero';
import RecentSales from './components/RecentSales';
import CurrencyConverter from './components/Sidebar/CurrencyConverter';
import HandleItemsModal from './components/HandleItemsModal';
import AboutModal from './components/AboutModal';
import TransactionModal from './components/TransactionModal';

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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const {
    usdAmount, rmbAmount,
    exchangeRate, sidebarRate, lastUpdated, handleUsdChange, handleRmbChange,
    currency1, setCurrency1, currency1Symbol,
    displayCurrency, setDisplayCurrency, currencySymbol,
  } = useExchangeRate();

  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [tradeHoldDismissed, setTradeHoldDismissed] = useState(() => !!localStorage.getItem('skinroi-tradehold-dismissed'));
  const [activeModal, setActiveModal] = useState(null); // null | 'analytics' | 'addItem' | 'handleItems' | 'about'
  const [chartPeriod, setChartPeriod] = useState('30d');
  const [theme, setTheme] = useState(() => { const t = localStorage.getItem('cs2-theme'); const r = t === 'v2' ? 'dark' : (t || 'bloomberg'); return themes[r] ? r : 'bloomberg'; });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [converterPinned, setConverterPinned] = useState(() => !!localStorage.getItem('skinroi-converter-pinned'));
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('skinroi-view-mode');
    return saved === 'list' ? 'list' : 'grid';
  });

  const showAnalytics    = activeModal === 'analytics';
  const showAddItem      = activeModal === 'addItem';
  const showHandleItems  = activeModal === 'handleItems';
  const showTransactions = activeModal === 'transactions';
  const showAbout        = activeModal === 'about';
  const openModal  = (name) => setActiveModal(prev => prev === name ? null : name);
  const closeModal = () => setActiveModal(null);

  const themeStyles = themes[theme];
  const { profitChartData } = useChartData(items, chartPeriod);

  useEffect(() => { localStorage.setItem('cs2-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('skinroi-view-mode', viewMode); }, [viewMode]);
  useEffect(() => {
    if (converterPinned) localStorage.setItem('skinroi-converter-pinned', '1');
    else localStorage.removeItem('skinroi-converter-pinned');
  }, [converterPinned]);

  const dismissTradeHold = () => { localStorage.setItem('skinroi-tradehold-dismissed', '1'); setTradeHoldDismissed(true); };
  const enableTradeHold  = () => { localStorage.removeItem('skinroi-tradehold-dismissed'); setTradeHoldDismissed(false); };

  useEffect(() => {
    if (
      activeTab === 'active' &&
      (sortBy === 'profit-high' || sortBy === 'profit-low' ||
        sortBy === 'profit-dollar-high' || sortBy === 'profit-dollar-low')
    ) {
      setSortBy('newest');
    }
  }, [activeTab, sortBy]);

  useEffect(() => {
    document.body.style.overflow = showAnalytics ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showAnalytics]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const filteredItems = items.filter(item => {
    const matchesTab =
      activeTab === 'active'  ? !item.sold
      : activeTab === 'pending' ? (!item.sold && !!item.pending)
      : item.sold;
    const matchesSearch =
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const soldTime = (it) =>
    it.soldAt ?? (it.dateSold ? new Date(it.dateSold).getTime() : 0);

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'newest')             return activeTab === 'sold' ? soldTime(b) - soldTime(a) || (b.id - a.id) : b.id - a.id;
    if (sortBy === 'oldest')             return activeTab === 'sold' ? soldTime(a) - soldTime(b) || (a.id - b.id) : a.id - b.id;
    if (sortBy === 'price-high')         return b.purchasePrice - a.purchasePrice;
    if (sortBy === 'price-low')          return a.purchasePrice - b.purchasePrice;
    if (sortBy === 'profit-high')        return (b.profitPercent ?? -Infinity) - (a.profitPercent ?? -Infinity);
    if (sortBy === 'profit-low')         return (a.profitPercent ?? Infinity)  - (b.profitPercent ?? Infinity);
    if (sortBy === 'profit-dollar-high') return (b.profit ?? -Infinity) - (a.profit ?? -Infinity);
    if (sortBy === 'profit-dollar-low')  return (a.profit ?? Infinity)  - (b.profit ?? Infinity);
    if (sortBy === 'delivery-soon')      return (a.expectedDelivery ?? Infinity)  - (b.expectedDelivery ?? Infinity);
    if (sortBy === 'delivery-late')      return (b.expectedDelivery ?? -Infinity) - (a.expectedDelivery ?? -Infinity);
    return 0;
  });

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection  = () => setSelectedIds(new Set());
  const exitSelectMode  = () => { setSelectMode(false); clearSelection(); };
  const confirmBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    handleBulkDelete([...selectedIds]);
    exitSelectMode();
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

      {showAnalytics && (
        <ProfitChart
          profitChartData={profitChartData}
          chartPeriod={chartPeriod}
          setChartPeriod={setChartPeriod}
          stats={stats}
          theme={themeStyles}
          items={items}
          onClose={closeModal}
        />
      )}

      {/* ── Top header ────────────────────────────────────────────────────── */}
      <Header
        theme={themeStyles}
        onAnalyticsClick={() => openModal('analytics')}
        onAddItemClick={() => openModal('addItem')}
        onHandleItemsClick={() => openModal('handleItems')}
        onTransactionClick={() => openModal('transactions')}
        showTransactions={showTransactions}
        onAboutClick={() => openModal('about')}
        onHomeClick={closeModal}
        showAddItem={showAddItem}
        showHandleItems={showHandleItems}
        pendingCount={steamSync.pendingCount}
        user={user}
        onLogin={login}
        onLogout={logout}
        onExportCSV={() => exportToCSV(items)}
        onImportCSV={handleImportCSV}
        hasRefreshToken={steamSync.hasRefreshToken}
        tradeHoldDismissed={tradeHoldDismissed}
        onEnableTradeHold={enableTradeHold}
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

      {/* ── Portfolio hero band ───────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-3 pb-0">
        <PortfolioHero
          stats={stats}
          profitChartData={profitChartData}
          theme={themeStyles}
        />
      </div>

      {/* ── Main content row ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-6 px-6 py-4">

        {/* Item list — fills remaining width */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

          <div className="shrink-0 pb-2">
            <TabsAndSearchbar
              theme={themeStyles}
              setActiveTab={setActiveTab} activeTab={activeTab}
              stats={stats}
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              sortBy={sortBy} setSortBy={setSortBy}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onEnterSelectMode={() => setSelectMode(true)}
              onCancelSelectMode={exitSelectMode}
              onConfirmBulkDelete={confirmBulkDelete}
              viewMode={viewMode} setViewMode={setViewMode}
            />
          </div>

          <div className="flex-1 overflow-y-auto pb-2">
            <ItemGrid
              sellPlatform={sellPlatform} setSellData={setSellData}
              sellData={sellData} setSellPlatform={setSellPlatform}
              handleSellItem={handleSellItem} handleDeleteItem={handleDeleteItem}
              promotePendingItem={promotePendingItem}
              theme={themeStyles} items={items} sortedItems={sortedItems}
              searchTerm={searchTerm} activeTab={activeTab}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              exchangeRate={exchangeRate}
              currencySymbol={currencySymbol}
              displayCurrency={displayCurrency}
              viewMode={viewMode}
            />
          </div>
        </main>

        {/* Right aside — movers + currency (hidden below lg) */}
        <aside className="hidden lg:flex w-[300px] shrink-0 flex-col gap-5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${themeStyles.subtext} mb-2 px-1`}>
              Recent Sales
            </p>
            <RecentSales items={items} theme={themeStyles} />
          </div>

          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${themeStyles.subtext} mb-2 px-1`}>
              Currency
            </p>
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

        </aside>
      </div>

      {/* ── Add Item modal ────────────────────────────────────────────────── */}
      {showAddItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onMouseDown={(e) => { e.currentTarget.dataset.closeIntent = e.target === e.currentTarget ? '1' : '0'; }}
          onClick={(e) => { if (e.currentTarget.dataset.closeIntent === '1') closeModal(); }}
        >
          <div
            className={`relative w-full max-w-xl max-h-[85vh] flex flex-col ${themeStyles.panel} border ${themeStyles.panelBorder} rounded-2xl shadow-2xl overflow-hidden`}
          >
            <div className={`flex items-center justify-between px-5 py-4 border-b ${themeStyles.panelBorder} shrink-0`}>
              <h2 className={`font-semibold ${themeStyles.text}`}>Add New Item</h2>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <AddItemForm
                formData={formData} setFormData={setFormData}
                handleAddItem={handleAddItem} theme={themeStyles}
                exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency} bare
              />
            </div>
          </div>
        </div>
      )}

      {showAbout && <AboutModal onClose={closeModal} theme={themeStyles} />}

      {/* ── Transactions modal ───────────────────────────────────────────── */}
      {showTransactions && (
        <TransactionModal
          onClose={closeModal}
          onAdd={(tx) => { handleAddTransaction(tx); }}
          theme={themeStyles}
        />
      )}

      {/* ── Handle Items modal ────────────────────────────────────────────── */}
      {showHandleItems && (
        <HandleItemsModal
          open={showHandleItems}
          onClose={closeModal}
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
          onSync={steamSync.sync}
          onDismiss={steamSync.dismiss}
          tradeHoldDismissed={tradeHoldDismissed}
          onDismissTradeHold={dismissTradeHold}
        />
      )}
    </div>
  );
}

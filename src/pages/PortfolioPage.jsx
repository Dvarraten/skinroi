// Portfolio, the start page: onboarding checklist, the summary hero, the
// Holding / Sold tabs and the item grid with sell prices.
import React, { useEffect, useState } from 'react';
import { Page } from '../components/PageHeader';
import ItemGrid from '../components/ItemGrid';
import TabsAndSearchbar, { TabButton } from '../components/TabsAndSearchbar';
import PortfolioHero from '../components/PortfolioHero';
import SellPriceStatus from '../components/SellPriceStatus';
import { ItemGridSkeleton } from '../components/Skeleton';
import OnboardingChecklist from '../components/OnboardingChecklist';
import { usePortfolioView } from '../hooks/usePortfolioView';

export default function PortfolioPage({
  theme, user, loading, items, stats, profitChartData, marketValue, sellPrices,
  extension, onExtensionChange, onImportSteam, onAddManually,
  portfolioTab, setPortfolioTab, itemActions,
  exchangeRate, currencySymbol, displayCurrency,
}) {
  const { searchTerm, setSearchTerm, sortBy, setSortBy, sortedItems } = usePortfolioView(items, portfolioTab);
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('skinroi-view-mode') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  useEffect(() => {
    try { localStorage.setItem('skinroi-view-mode', viewMode); } catch { /* ignore */ }
  }, [viewMode]);
  const {
    sellData, setSellData, sellPlatform, setSellPlatform,
    handleSellItem, handleDeleteItem, promotePendingItem,
  } = itemActions;

  return (
    <Page>
      {user && !loading && extension && (
        <div className="mb-8 empty:hidden">
          <OnboardingChecklist
            theme={theme}
            steamId={user.steamId}
            extension={extension}
            items={items}
            onExtensionChange={onExtensionChange}
            onImportSteam={onImportSteam}
            onAddManually={onAddManually}
          />
        </div>
      )}

      <PortfolioHero
        stats={stats}
        profitChartData={profitChartData}
        theme={theme}
        loading={loading}
        marketValue={marketValue}
      />

      <div className={`mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b ${theme.cardBorder}`}>
        <TabButton
          label="Holding" count={loading ? '' : stats.totalActiveCount}
          isActive={portfolioTab === 'active'} onClick={() => setPortfolioTab('active')}
          theme={theme} accentColor={theme.accentColor}
          badgeClass={theme.subtext}
        />
        <TabButton
          label="Sold" count={loading ? '' : stats.totalSoldCount}
          isActive={portfolioTab === 'sold'} onClick={() => setPortfolioTab('sold')}
          theme={theme} accentColor={theme.accentColor}
          badgeClass={theme.subtext}
        />
        {!loading && portfolioTab === 'active' && (
          <SellPriceStatus sellPrices={sellPrices} hasItems={stats.totalActiveCount > 0} />
        )}
      </div>

      <div className="mt-4">
        <TabsAndSearchbar
          theme={theme}
          activeTab={portfolioTab}
          showTabs={false}
          allowSelect={false}
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          sortBy={sortBy} setSortBy={setSortBy}
          viewMode={viewMode} setViewMode={setViewMode}
        />
      </div>

      <div className="mt-4">
        {loading ? (
          <ItemGridSkeleton theme={theme} viewMode={viewMode} />
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
            theme={theme} sortedItems={sortedItems}
            searchTerm={searchTerm} activeTab={portfolioTab}
            viewMode={viewMode}
            sellPrices={portfolioTab === 'active' ? sellPrices : null}
          />
        )}
      </div>
    </Page>
  );
}

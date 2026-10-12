// Portfolio tabs inside Handle Items (Active / Pending / Sold): search, sort,
// view toggle, bulk-delete select mode, and the full ItemGrid with sell,
// mark-received and cancel actions. The tab buttons live on the page itself.
import React, { useEffect, useState } from 'react';
import TabsAndSearchbar from './TabsAndSearchbar';
import ItemGrid from './ItemGrid';
import { usePortfolioView } from '../hooks/usePortfolioView';

export default function PortfolioManager({
  theme, items, activeTab,
  sellData, setSellData, sellPlatform, setSellPlatform,
  handleSellItem, handleDeleteItem, handleBulkDelete, promotePendingItem,
  exchangeRate, currencySymbol, displayCurrency,
  viewMode, setViewMode,
}) {
  const { searchTerm, setSearchTerm, sortBy, setSortBy, sortedItems } = usePortfolioView(items, activeTab);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  useEffect(() => { setSelectMode(false); setSelectedIds(new Set()); }, [activeTab]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const confirmBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    handleBulkDelete([...selectedIds]);
    exitSelectMode();
  };

  return (
    <div className="space-y-3">
      <TabsAndSearchbar
        theme={theme}
        activeTab={activeTab}
        showTabs={false}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        sortBy={sortBy} setSortBy={setSortBy}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onEnterSelectMode={() => setSelectMode(true)}
        onCancelSelectMode={exitSelectMode}
        onConfirmBulkDelete={confirmBulkDelete}
        viewMode={viewMode} setViewMode={setViewMode}
      />
      <ItemGrid
        sellPlatform={sellPlatform} setSellData={setSellData}
        sellData={sellData} setSellPlatform={setSellPlatform}
        handleSellItem={handleSellItem} handleDeleteItem={handleDeleteItem}
        promotePendingItem={promotePendingItem}
        theme={theme} sortedItems={sortedItems}
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
  );
}

// Search + sort state for a list of portfolio items on one tab
// ('active' | 'pending' | 'sold'). Used by the Home grid (active only) and the
// portfolio tabs in Handle Items. Switching tab resets the sort to newest.
import { useEffect, useMemo, useState } from 'react';

const soldTime = (it) =>
  it.soldAt ?? (it.dateSold ? new Date(it.dateSold).getTime() : 0);

export function usePortfolioView(items, activeTab) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => { setSortBy('newest'); }, [activeTab]);

  const sortedItems = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const filtered = items.filter(item => {
      const matchesTab =
        activeTab === 'active'  ? !item.sold
        : activeTab === 'pending' ? (!item.sold && !!item.pending)
        : item.sold;
      const matchesSearch =
        item.itemName.toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });

    return filtered.sort((a, b) => {
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
  }, [items, activeTab, searchTerm, sortBy]);

  return { searchTerm, setSearchTerm, sortBy, setSortBy, sortedItems };
}

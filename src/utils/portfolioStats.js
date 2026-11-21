// Headline figures for Portfolio and Analytics, from the item list.
export function portfolioStats(items) {
  const held = items.filter((i) => !i.sold);
  const sold = items.filter((i) => i.sold);
  return {
    totalActive: held.reduce((sum, i) => sum + i.purchasePrice, 0),
    totalActiveCount: held.length,
    totalPending: held.filter((i) => i.pending).length,
    totalSold: sold.reduce((sum, i) => sum + i.purchasePrice + i.profit, 0),
    totalSoldCount: sold.length,
    totalProfit: sold.reduce((sum, i) => sum + i.profit, 0),
    totalInvested: items.reduce((sum, i) => sum + i.purchasePrice, 0),
  };
}

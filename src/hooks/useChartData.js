// Derives chart-ready data from the sold-items list: cumulative P&L series
// for the selected period, weekly/monthly profit totals, and a 90-day
// sale-frequency heatmap. Pure computation — no side effects.
export const useChartData = (items, chartPeriod) => {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const soldItems = items.filter(i => i.sold);

  const weeklyProfit = soldItems
    .filter(i => {
      const saleDate = i.dateSold ? new Date(i.dateSold) : new Date(i.datePurchased);
      return saleDate >= oneWeekAgo;
    })
    .reduce((sum, i) => sum + i.profit, 0);

  const monthlyProfit = soldItems
    .filter(i => {
      const saleDate = i.dateSold ? new Date(i.dateSold) : new Date(i.datePurchased);
      return saleDate >= oneMonthAgo;
    })
    .reduce((sum, i) => sum + i.profit, 0);

  const chartCutoff =
    chartPeriod === '7d'
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : chartPeriod === '30d'
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : null;

  const chartData = soldItems
    .filter(item => {
      if (!chartCutoff) return true;
      const d = item.dateSold ? new Date(item.dateSold) : new Date(item.datePurchased);
      return d >= chartCutoff;
    })
    .reduce((acc, item) => {
      const date = item.dateSold || item.datePurchased;
      if (!acc[date]) {
        acc[date] = { date, profit: 0, count: 0 };
      }
      acc[date].profit += item.profit;
      acc[date].count += 1;
      return acc;
    }, {});

  const profitChartData = Object.values(chartData)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      profit: parseFloat(item.profit.toFixed(2)),
      count: item.count
    }));

  // All-time aggregation — used by the hero chart regardless of chartPeriod
  const allTimeData = soldItems.reduce((acc, item) => {
    const date = item.dateSold || item.datePurchased;
    if (!acc[date]) acc[date] = { date, profit: 0, count: 0 };
    acc[date].profit += item.profit;
    acc[date].count += 1;
    return acc;
  }, {});

  const allTimeProfitChartData = Object.values(allTimeData)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      profit: parseFloat(item.profit.toFixed(2)),
      count: item.count
    }));

  return { weeklyProfit, monthlyProfit, profitChartData, allTimeProfitChartData };
};
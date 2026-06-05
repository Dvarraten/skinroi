// Sidebar panel listing the most-recently sold items with purchase→sale
// price and profit/loss indicator.
import React from "react";
import { ArrowDownUp } from "lucide-react";
import { useItemImage } from "../utils/itemImages";

function SaleRow({ item, theme }) {
  const imgUrl = useItemImage({ directIconUrl: item.iconUrl, name: item.itemName });
  const profit = item.profit ?? 0;
  const isGain = profit >= 0;
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${theme.card} border ${theme.cardBorder} transition-colors`}>
      <div className={`w-0.5 self-stretch rounded-full shrink-0 ${isGain ? "bg-profit" : "bg-loss"}`} />
      {item.isTransaction ? (
        <div className="w-8 h-8 rounded shrink-0 bg-white/5 flex items-center justify-center">
          <ArrowDownUp size={14} className={item.transactionType === 'deposit' ? 'text-profit/60' : 'text-loss/60'} />
        </div>
      ) : imgUrl ? (
        <img src={imgUrl} alt={item.itemName} className="w-8 h-8 object-contain shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded shrink-0 bg-white/5" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${theme.textSecondary} truncate font-medium`}>{item.itemName}</p>
        {item.isTransaction ? (
          <p className="text-xs text-slate-600 mt-0.5 font-mono capitalize">
            ${item.transactionAmount?.toFixed(2)} · fee {item.transactionFeePercent}%
          </p>
        ) : (
          <p className="text-xs text-slate-600 mt-0.5 font-mono">
            ${item.purchasePrice.toFixed(2)} → ${(item.salePrice ?? 0).toFixed(2)}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-mono font-semibold ${isGain ? "text-profit" : "text-loss"}`}>
          {isGain ? "+" : ""}${profit.toFixed(2)}
        </p>
        <p className={`text-xs font-mono ${isGain ? "text-profit/70" : "text-loss/70"}`}>
          {isGain ? "+" : ""}{(item.profitPercent ?? 0).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

export default function RecentSales({ items, theme }) {
  const sold = [...items]
    .filter(i => i.sold)
    .sort((a, b) => {
      const aTime = a.soldAt ?? (a.dateSold ? new Date(a.dateSold).getTime() : 0);
      const bTime = b.soldAt ?? (b.dateSold ? new Date(b.dateSold).getTime() : 0);
      return bTime - aTime || (b.id - a.id);
    })
    .slice(0, 6);

  if (!sold.length) {
    return <div className="text-center py-6 text-slate-600 text-sm">No sales yet</div>;
  }

  return (
    <div className="space-y-2">
      {sold.map(item => <SaleRow key={item.id} item={item} theme={theme} />)}
    </div>
  );
}

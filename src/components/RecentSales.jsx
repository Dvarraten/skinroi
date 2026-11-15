// Sidebar panel listing the most-recently sold items with purchase→sale
// price and profit/loss indicator.
import React from "react";
import { ArrowDownUp } from "lucide-react";
import { useItemImage } from "../utils/itemImages";
import { formatUsd, formatSignedUsd, formatSignedPercent } from "../utils/format";

function SaleRow({ item, theme }) {
  const imgUrl = useItemImage({ directIconUrl: item.iconUrl, name: item.itemName });
  const profit = item.profit ?? 0;
  const isGain = profit >= 0;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 ${theme.cardBorder}`}>
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
        <p title={item.itemName} className={`text-[13px] ${theme.text} truncate font-medium`}>{item.itemName}</p>
        {item.isTransaction ? (
          <p className={`text-xs ${theme.subtext} mt-0.5 font-mono capitalize`}>
            {formatUsd(item.transactionAmount)} · fee {item.transactionFeePercent}%
          </p>
        ) : (
          <p className={`text-xs ${theme.subtext} mt-0.5 font-mono`}>
            {formatUsd(item.purchasePrice)} → {formatUsd(item.salePrice ?? 0)}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-[13px] font-mono font-semibold ${isGain ? "text-profit" : "text-loss"}`}>
          {formatSignedUsd(profit)}
        </p>
        <p className={`text-xs font-mono mt-0.5 ${theme.subtext}`}>
          {formatSignedPercent(item.profitPercent ?? 0)}
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
    return (
      <div className={`rounded-xl border ${theme.cardBorder} px-4 py-6 text-center text-[13px] ${theme.subtext}`}>
        No sales yet. Items you mark sold show up here.
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${theme.cardBorder} ${theme.card}`}>
      {sold.map(item => <SaleRow key={item.id} item={item} theme={theme} />)}
    </div>
  );
}

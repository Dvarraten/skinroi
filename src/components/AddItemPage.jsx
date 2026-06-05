import React, { useMemo } from "react";
import { PackagePlus, Package, CheckCircle2, Clock } from "lucide-react";
import AddItemForm from "./AddItemForm";
import { PlatformBadge } from "./PlatformBadge";
import { useItemImage } from "../utils/itemImages";

function HistoryThumb({ item }) {
  const url = useItemImage({ directIconUrl: item.iconUrl, name: item.itemName });
  if (!url) return <div className="w-7 h-7 rounded-md bg-white/5 flex-shrink-0" />;
  return (
    <img src={url} alt="" loading="lazy" className="w-7 h-7 object-contain flex-shrink-0" />
  );
}

function StatusPill({ item, theme }) {
  if (item.sold) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-md px-1.5 py-0.5 bg-loss/10 text-loss">
        <CheckCircle2 size={10} />
        Sold
      </span>
    );
  }
  if (item.pending) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-md px-1.5 py-0.5 bg-warn/10 text-warn">
        <Clock size={10} />
        Hold
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-md px-1.5 py-0.5 bg-profit/10 text-profit`}>
      <Package size={10} />
      Active
    </span>
  );
}

export default function AddItemPage({
  formData, setFormData, handleAddItem, theme,
  exchangeRate, currencySymbol, displayCurrency,
  items,
}) {
  const trackedItems = useMemo(
    () => items.filter(i => !i.isTransaction),
    [items]
  );

  const stats = useMemo(() => {
    const total = trackedItems.length;
    const active = trackedItems.filter(i => !i.sold).length;
    const sold = trackedItems.filter(i => i.sold).length;
    return { total, active, sold };
  }, [trackedItems]);

  const recent = useMemo(
    () => [...trackedItems].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 30),
    [trackedItems]
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <PackagePlus size={12} className={theme.accent} />
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${theme.subtext}`}>Total items</p>
            </div>
            <p className={`text-lg font-mono font-semibold ${theme.text} tabular-nums`}>
              {stats.total}
            </p>
            <p className={`text-xs ${theme.subtext}`}>tracked so far</p>
          </div>
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <Package size={12} className="text-profit" />
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${theme.subtext}`}>Active</p>
            </div>
            <p className={`text-lg font-mono font-semibold ${theme.text} tabular-nums`}>
              {stats.active}
            </p>
            <p className={`text-xs ${theme.subtext}`}>currently held</p>
          </div>
          <div className={`${theme.card} border ${theme.cardBorder} rounded-xl px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={12} className="text-loss" />
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${theme.subtext}`}>Sold</p>
            </div>
            <p className={`text-lg font-mono font-semibold ${theme.text} tabular-nums`}>
              {stats.sold}
            </p>
            <p className={`text-xs ${theme.subtext}`}>realised</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">

          {/* Form */}
          <div className={`md:col-span-2 ${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-lg overflow-hidden`}>
            <div className={`flex items-center gap-2 px-5 py-4 border-b ${theme.panelBorder}`}>
              <PackagePlus size={15} className="text-slate-400" />
              <h2 className={`font-semibold ${theme.text}`}>Add new item</h2>
            </div>
            <div className="p-5">
              <AddItemForm
                formData={formData} setFormData={setFormData}
                handleAddItem={handleAddItem} theme={theme}
                exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency} bare
              />
            </div>
          </div>

          {/* History */}
          <div className={`md:col-span-3 ${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-lg overflow-hidden flex flex-col`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.panelBorder}`}>
              <h2 className={`font-semibold ${theme.text}`}>Recently added</h2>
              <span className={`text-xs ${theme.subtext}`}>last {recent.length} of {stats.total}</span>
            </div>

            {recent.length === 0 ? (
              <div className={`flex-1 flex items-center justify-center py-10 text-sm ${theme.subtext}`}>
                Nothing tracked yet — add your first item on the left.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[520px]">
                <table className="w-full">
                  <thead className={`text-[10px] uppercase tracking-wide font-semibold ${theme.subtext}`}>
                    <tr className={`border-b ${theme.cardBorder}`}>
                      <th className="text-left px-4 py-2">Item</th>
                      <th className="text-right px-3 py-2">Cost</th>
                      <th className="text-left px-3 py-2">Platform</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-4 py-2">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(item => (
                      <tr key={item.id} className={`border-b ${theme.cardBorder} hover:bg-white/[0.02] transition-colors`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <HistoryThumb item={item} />
                            <p className={`text-xs font-medium ${theme.textSecondary} truncate leading-tight`}>
                              {item.itemName}
                            </p>
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-mono text-xs ${theme.text} whitespace-nowrap`}>
                          ${item.purchasePrice?.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {item.platform && <PlatformBadge platform={item.platform} size="xs" />}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill item={item} theme={theme} />
                        </td>
                        <td className={`px-4 py-2 text-right text-xs font-mono ${theme.subtext} whitespace-nowrap`}>
                          {item.datePurchased
                            ? new Date(item.datePurchased).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

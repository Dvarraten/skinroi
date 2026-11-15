// Manual item entry: Steam import shortcut, the form and what was added
// lately. Rendered as a tab of the Add page.
import React, { useMemo, useState } from "react";
import { Package, CheckCircle2, Clock, Download } from "lucide-react";
import AddItemForm from "../components/AddItemForm";
import { PlatformBadge } from "../components/PlatformBadge";
import { useItemImage } from "../utils/itemImages";

function HistoryThumb({ item }) {
  const url = useItemImage({ directIconUrl: item.iconUrl, name: item.itemName });
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <div className="w-7 h-7 rounded-md bg-white/5 flex-shrink-0" />;
  return (
    <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="w-7 h-7 object-contain flex-shrink-0" />
  );
}

function StatusPill({ item }) {
  if (item.sold) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-md px-1.5 py-0.5 bg-white/5 text-slate-400">
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
  canImport = false, onImportSteam, onLogin, demo = false,
}) {
  const trackedItems = useMemo(
    () => items.filter(i => !i.isTransaction),
    [items]
  );

  const recent = useMemo(
    () => [...trackedItems].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 30),
    [trackedItems]
  );

  return (
      <div className="space-y-4">

        {/* Steam inventory import */}
        <div className={`${theme.panel} border ${theme.panelBorder} rounded-xl px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3`}>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${theme.text}`}>Import your Steam inventory</p>
            <p className={`text-xs mt-0.5 ${theme.subtext}`}>
              {canImport
                ? "Pick items from your CS2 inventory and add them all at once. Your inventory needs to be public on Steam."
                : demo
                  ? "Not available in the demo. Sign in with Steam to import your own inventory in one click."
                  : "Sign in with Steam to import your whole CS2 inventory in one click."}
            </p>
          </div>
          <button
            onClick={canImport ? onImportSteam : onLogin}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${theme.cardBorder} ${theme.text} hover:bg-white/5 active:scale-[0.97]`}
          >
            <Download size={14} />
            {canImport ? "Import from Steam" : "Sign in with Steam"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">

          {/* Form */}
          <div className={`md:col-span-2 ${theme.panel} border ${theme.panelBorder} rounded-xl overflow-hidden`}>
            <div className="p-5">
              <AddItemForm
                formData={formData} setFormData={setFormData}
                handleAddItem={handleAddItem} theme={theme}
                exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency} bare
              />
            </div>
          </div>

          {/* History */}
          <div className={`md:col-span-3 ${theme.panel} border ${theme.panelBorder} rounded-xl overflow-hidden flex flex-col`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.panelBorder}`}>
              <h2 className={`text-sm font-semibold ${theme.text}`}>Recently added</h2>
              <span className={`text-xs ${theme.subtext}`}>last {recent.length} of {trackedItems.length}</span>
            </div>

            {recent.length === 0 ? (
              <div className={`flex-1 flex items-center justify-center py-10 text-sm ${theme.subtext}`}>
                Nothing tracked yet — add your first item on the left.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[520px]">
                <table className="w-full">
                  <thead className={`text-xs font-medium ${theme.subtext}`}>
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
                          <StatusPill item={item} />
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
  );
}

// Manual item entry: the form, the Steam import shortcut and what was added
// lately. Rendered as a tab of the Add page.
import React, { useMemo, useState } from "react";
import { Download } from "lucide-react";
import AddItemForm from "../components/AddItemForm";
import { PlatformBadge } from "../components/PlatformBadge";
import { useItemImage } from "../utils/itemImages";
import { PROFIT_COLOR, WARN_COLOR } from "../themes/themes";

function HistoryThumb({ item }) {
  const url = useItemImage({ directIconUrl: item.iconUrl, name: item.itemName });
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <div className="w-10 h-8 shrink-0" />;
  return (
    <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="w-10 h-8 object-contain shrink-0" />
  );
}

// Holding, on hold or sold: a dot and a word, colour only on the dot.
function Status({ item, theme }) {
  const [text, color] = item.sold
    ? ["Sold", null]
    : item.pending ? ["On hold", WARN_COLOR] : ["Holding", PROFIT_COLOR];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${theme.subtext}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color ? "" : "bg-zinc-500"}`} style={color ? { backgroundColor: color } : undefined} />
      {text}
    </span>
  );
}

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

export default function AddItemPage({
  formData, setFormData, handleAddItem, theme,
  exchangeRate, currencySymbol, displayCurrency,
  items,
  canImport = false, onImportSteam, onLogin, demo = false,
}) {
  const trackedItems = useMemo(() => items.filter(i => !i.isTransaction), [items]);
  const recent = useMemo(
    () => [...trackedItems].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 30),
    [trackedItems]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
      <div className="md:col-span-2 space-y-4">
        <div className={`${theme.panel} border ${theme.panelBorder} rounded-xl p-5`}>
          <AddItemForm
            formData={formData} setFormData={setFormData}
            handleAddItem={handleAddItem} theme={theme}
            exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency}
          />
        </div>

        {/* Steam inventory import */}
        <div className={`border ${theme.panelBorder} rounded-xl p-5`}>
          <p className={`text-[13px] font-medium ${theme.text}`}>Have many items already?</p>
          <p className={`text-xs mt-1 ${theme.subtext}`}>
            {canImport
              ? "Pick items from your CS2 inventory and add them all at once. Your inventory needs to be public on Steam."
              : demo
                ? "Not available in the demo. Sign in with Steam to import your own inventory."
                : "Sign in with Steam to import your whole CS2 inventory at once."}
          </p>
          <button
            onClick={canImport ? onImportSteam : onLogin}
            className={`mt-3 flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium border ${theme.cardBorder} ${theme.text} ${theme.itemHoverBg}`}
          >
            <Download size={14} />
            {canImport ? "Import from Steam" : "Sign in with Steam"}
          </button>
        </div>
      </div>

      {/* Recently added */}
      <div className={`md:col-span-3 ${theme.panel} border ${theme.panelBorder} rounded-xl overflow-hidden`}>
        <div className={`flex items-baseline justify-between px-5 py-4 border-b ${theme.panelBorder}`}>
          <h2 className={`text-sm font-semibold ${theme.text}`}>Recently added</h2>
          {trackedItems.length > 0 && (
            <span className={`text-xs ${theme.subtext}`}>{recent.length} of {trackedItems.length}</span>
          )}
        </div>

        {recent.length === 0 ? (
          <p className={`px-5 py-10 text-center text-[13px] ${theme.subtext}`}>
            Nothing here yet. Items you add show up in this list.
          </p>
        ) : (
          <ul className="overflow-y-auto max-h-[560px]">
            {recent.map(item => (
              <li key={item.id} className={`flex items-center gap-3 px-5 py-2.5 border-b last:border-b-0 ${theme.panelBorder}`}>
                <HistoryThumb item={item} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-medium truncate ${theme.text}`} title={item.itemName}>{item.itemName}</p>
                  <div className={`flex items-center gap-2 text-xs ${theme.subtext}`}>
                    <Status item={item} theme={theme} />
                    {item.datePurchased && <span>{shortDate(item.datePurchased)}</span>}
                  </div>
                </div>
                {item.platform && (
                  <span className={`hidden sm:block ${theme.textSecondary}`}><PlatformBadge platform={item.platform} size="xs" /></span>
                )}
                <span className={`w-20 text-right font-mono text-[13px] ${theme.text}`}>
                  ${item.purchasePrice?.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

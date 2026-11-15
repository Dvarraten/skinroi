import React, { useMemo } from "react";
import { Package, CheckCircle2, Clock, Download } from "lucide-react";
import AddItemForm from "../components/AddItemForm";
import { PlatformBadge } from "../components/PlatformBadge";
import { Page, PageHeader } from "../components/ui/Page";
import { Button } from "../components/ui/Button";
import steamLogo from "../assets/platforms/steam.png";
import { useItemImage } from "../utils/itemImages";
import { formatUsd } from "../utils/format";

function HistoryThumb({ item }) {
  const url = useItemImage({ directIconUrl: item.iconUrl, name: item.itemName });
  if (!url) return <div className="w-8 h-8 rounded-md bg-white/5 flex-shrink-0" />;
  return (
    <img src={url} alt="" loading="lazy" className="w-8 h-8 object-contain flex-shrink-0" />
  );
}

function StatusPill({ item }) {
  const base = "inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-1.5 py-0.5";
  if (item.sold) {
    return <span className={`${base} bg-white/5 text-slate-400`}><CheckCircle2 size={11} />Sold</span>;
  }
  if (item.pending) {
    return <span className={`${base} bg-warn/10 text-warn`}><Clock size={11} />Hold</span>;
  }
  return <span className={`${base} bg-profit/10 text-profit`}><Package size={11} />Active</span>;
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

  const importHint = canImport
    ? "Your inventory needs to be public on Steam."
    : demo
      ? "Not available in the demo. Sign in with Steam to import your own inventory."
      : "Sign in with Steam to import your whole CS2 inventory in one go.";

  return (
    <Page width="max-w-5xl">
      <PageHeader
        title="Add item"
        description="Log a purchase by hand, or import everything in your Steam inventory at once."
        actions={
          <Button
            onClick={canImport ? onImportSteam : onLogin}
            title={importHint}
            icon={canImport ? <Download size={15} /> : <img src={steamLogo} alt="" className="h-4 w-4" />}
          >
            {canImport ? "Import from Steam" : "Sign in to import from Steam"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">

        {/* Form */}
        <section className={`md:col-span-2 ${theme.panel} border ${theme.panelBorder} rounded-2xl p-5`}>
          <h2 className={`text-[15px] font-semibold mb-4 ${theme.text}`}>New item</h2>
          <AddItemForm
            formData={formData} setFormData={setFormData}
            handleAddItem={handleAddItem} theme={theme}
            exchangeRate={exchangeRate} currencySymbol={currencySymbol} displayCurrency={displayCurrency} bare
          />
        </section>

        {/* History */}
        <section className={`md:col-span-3 ${theme.panel} border ${theme.panelBorder} rounded-2xl overflow-hidden flex flex-col`}>
          <div className={`flex items-baseline justify-between gap-3 px-5 py-4 border-b ${theme.panelBorder}`}>
            <h2 className={`text-[15px] font-semibold ${theme.text}`}>Recently added</h2>
            <span className={`text-xs ${theme.subtext}`}>
              {recent.length < trackedItems.length ? `Latest ${recent.length} of ${trackedItems.length}` : `${trackedItems.length} items`}
            </span>
          </div>

          {recent.length === 0 ? (
            <div className={`flex-1 flex items-center justify-center px-5 py-12 text-sm text-center ${theme.subtext}`}>
              Nothing tracked yet. Add your first item with the form.
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[560px]">
              {/* Fixed layout so a long name truncates instead of pushing
                  the last columns out of the panel. */}
              <table className="w-full table-fixed">
                <thead className={`text-xs font-medium ${theme.subtext}`}>
                  <tr className={`border-b ${theme.cardBorder}`}>
                    <th className="text-left font-medium px-5 py-2.5">Item</th>
                    <th className="text-right font-medium px-3 py-2.5 w-[92px]">Cost</th>
                    <th className="text-left font-medium px-3 py-2.5 w-[104px] hidden sm:table-cell">Bought on</th>
                    <th className="text-left font-medium px-3 py-2.5 w-[76px]">Status</th>
                    <th className="text-right font-medium pl-3 pr-5 py-2.5 w-[76px] hidden sm:table-cell">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(item => (
                    <tr key={item.id} className={`border-b last:border-b-0 ${theme.cardBorder} ${theme.itemHoverBg} transition-colors`}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <HistoryThumb item={item} />
                          <p title={item.itemName} className={`text-[13px] font-medium ${theme.text} truncate`}>
                            {item.itemName}
                          </p>
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-[13px] ${theme.text} whitespace-nowrap`}>
                        {formatUsd(item.purchasePrice)}
                      </td>
                      <td className={`px-1.5 py-2.5 hidden sm:table-cell ${theme.textSecondary}`}>
                        {item.platform && <PlatformBadge platform={item.platform} size="xs" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill item={item} />
                      </td>
                      <td className={`pl-3 pr-5 py-2.5 text-right text-xs ${theme.subtext} whitespace-nowrap hidden sm:table-cell`}>
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
        </section>
      </div>
    </Page>
  );
}

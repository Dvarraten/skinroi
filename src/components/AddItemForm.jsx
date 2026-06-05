// Slide-in panel for adding a new tracked item. Manages its own form state
// (name autocomplete, price, platform, quantity, pending toggle, delivery
// date) and calls back into useItems on submit.
import React, { useState, useEffect } from "react";
import { CheckCircle, Clock, PackagePlus } from "lucide-react";
import ItemAutoComplete from "./ItemAutoComplete";
import PlatformPicker from "./PlatformPicker";
import PricePair from "./PricePair";
import { useItemImage } from "../utils/itemImages";

import { PLATFORMS } from "../utils/platforms";

const label =
  "block text-xs text-slate-500 font-medium uppercase tracking-wide mb-2";
const inputH = "h-9";

export default function AddItemForm({
  formData,
  setFormData,
  handleAddItem,
  theme,
  exchangeRate = null,
  currencySymbol = '¥',
  displayCurrency = 'CNY',
  bare = false,
}) {
  const [success, setSuccess] = useState(false);
  const [cnyPrice, setCnyPrice] = useState('');

  const resolvedIcon = useItemImage({ name: formData.itemName });
  useEffect(() => {
    if (resolvedIcon && resolvedIcon !== formData.iconUrl) {
      setFormData((prev) => ({ ...prev, iconUrl: resolvedIcon }));
    }
    if (!resolvedIcon && formData.iconUrl && !formData.itemName) {
      setFormData((prev) => ({ ...prev, iconUrl: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedIcon, formData.itemName]);

  const onAdd = () => {
    if (!formData.itemName || !formData.purchasePrice) return;
    handleAddItem();
    setCnyPrice('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const defaultDeliveryISO = (() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  })();

  return (
    <div
      className={
        bare ? "" : `${theme.panel} ${theme.panelBorder} rounded-xl p-5 border`
      }
    >
      {/* Header — hidden in bare/modal mode, modal provides its own */}
      {!bare && (
        <div className="flex items-center gap-2 mb-5">
          <PackagePlus size={16} className="text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Add New Item
          </h3>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Item Name + Quantity row */}
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className={label}>Item Name</label>
            <ItemAutoComplete
              value={formData.itemName}
              onChange={(val) => setFormData({ ...formData, itemName: val })}
              placeholder="Search…"
              theme={theme}
            />
          </div>
          <div className="shrink-0 w-[112px]">
            <label className={label}>
              Qty
              {formData.quantity > 1 && formData.purchasePrice && (
                <span className="ml-1.5 text-profit normal-case font-mono tracking-normal text-[10px]">
                  ${(parseFloat(formData.purchasePrice) * formData.quantity).toFixed(2)}
                </span>
              )}
            </label>
            <div className={`flex items-center ${inputH} rounded-lg border ${theme.input} overflow-hidden`}>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    quantity: Math.max(1, (parseInt(formData.quantity) || 1) - 1),
                  })
                }
                className={`h-full w-8 flex items-center justify-center text-sm ${theme.subtext} ${theme.textHover} hover:bg-white/5 transition-colors`}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max="999"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className={`flex-1 h-full min-w-0 bg-transparent text-center text-sm font-mono ${theme.text} focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    quantity: (parseInt(formData.quantity) || 1) + 1,
                  })
                }
                className={`h-full w-8 flex items-center justify-center text-sm ${theme.subtext} ${theme.textHover} hover:bg-white/5 transition-colors`}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Purchase Price — USD + CNY linked pair */}
        <div>
          <label className={label}>Purchase Price</label>
          <PricePair
            usdValue={formData.purchasePrice}
            cnyValue={cnyPrice}
            onChange={({ usd, cny }) => {
              setFormData({ ...formData, purchasePrice: usd });
              setCnyPrice(cny);
            }}
            onCnyTyped={() => setFormData(prev => ({ ...prev, platform: 'youpin' }))}
            exchangeRate={exchangeRate}
            theme={theme}
            currencySymbol={currencySymbol}
            displayCurrency={displayCurrency}
          />
        </div>

        {/* Platform — full width so long names fit */}
        <div>
          <label className={label}>Platform</label>
          <PlatformPicker
            value={formData.platform}
            onChange={(val) => setFormData({ ...formData, platform: val, customFee: val === 'other' ? '0' : '' })}
            theme={theme}
            platforms={PLATFORMS}
          />
          {formData.platform === 'other' && (
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="number" min="0" max="100" step="0.1"
                value={formData.customFee || ''}
                onChange={(e) => setFormData({ ...formData, customFee: e.target.value })}
                placeholder="Fee %"
                className={`w-full ${inputH} ${theme.input} rounded-lg px-3 text-sm font-mono ${theme.text} focus:outline-none border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
              <span className={`text-sm ${theme.subtext} shrink-0`}>%</span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className={label}>Notes</label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            className={`w-full ${inputH} ${theme.input} rounded-lg px-3 text-sm ${theme.text} placeholder-slate-600 focus:outline-none transition-colors border`}
            placeholder="Float, pattern, stickers"
          />
        </div>
      </div>

      {/* Action row */}
      <div
        className={`flex flex-wrap gap-3 mt-5 pt-4 border-t ${theme.cardBorder} items-center`}
      >
        <button
          onClick={onAdd}
          className={`relative group flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium border transition-all duration-200
            ${theme.card} ${theme.cardBorder} ${success ? "text-profit" : theme.text}`}
        >
          {success ? (
            <><CheckCircle size={15} /> Added!</>
          ) : formData.pending ? (
            <><Clock size={15} />{formData.quantity > 1 ? `Add ${formData.quantity} Pending` : "Add Pending"}</>
          ) : formData.quantity > 1 ? (
            `Add ${formData.quantity} Items`
          ) : (
            "Add Item"
          )}
          <span className={`absolute bottom-0 left-0 h-[2px] rounded-full transition-all duration-200 ${success ? `w-full bg-profit` : `w-0 group-hover:w-full ${theme.dot}`}`} />
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !formData.pending;
            setFormData({
              ...formData,
              pending: next,
              expectedDelivery: next
                ? formData.expectedDelivery || defaultDeliveryISO
                : "",
            });
          }}
          title="Item is Steam trade-protected (not yet received)"
          className={`relative group flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium border transition-all
            ${theme.card} ${theme.cardBorder}
            ${formData.pending ? "text-warn" : `${theme.subtext} ${theme.textHover}`}`}
        >
          <Clock size={15} />
          Protected
          <span className={`absolute bottom-0 left-0 h-[2px] rounded-full transition-all duration-200 bg-warn ${formData.pending ? "w-full" : "w-0 group-hover:w-full"}`} />
        </button>

        {formData.pending && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${theme.subtext}`}>Delivery:</span>
            <input
              type="date"
              value={formData.expectedDelivery || defaultDeliveryISO}
              onChange={(e) =>
                setFormData({ ...formData, expectedDelivery: e.target.value })
              }
              className={`${theme.input} rounded-md px-2 py-1.5 ${theme.text} text-xs focus:outline-none border`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

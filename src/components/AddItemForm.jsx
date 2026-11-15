// Slide-in panel for adding a new tracked item. Manages its own form state
// (name autocomplete, price, platform, quantity, pending toggle, delivery
// date) and calls back into useItems on submit.
import React, { useState, useEffect } from "react";
import { CheckCircle, Clock, PackagePlus, Plus } from "lucide-react";
import ItemAutoComplete from "./ItemAutoComplete";
import PlatformPicker from "./PlatformPicker";
import PricePair from "./PricePair";
import { useItemImage } from "../utils/itemImages";

import { PLATFORMS } from "../utils/platforms";
import { Button } from "./ui/Button";
import { formatUsd } from "../utils/format";

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
  const label = `block text-xs font-medium mb-1.5 ${theme.subtext}`;
  const canAdd = !!formData.itemName && !!formData.purchasePrice;

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
          <h3 className="text-xs font-medium text-slate-500">
            Add New Item
          </h3>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Item Name + Quantity row */}
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className={label}>Item name</label>
            <ItemAutoComplete
              value={formData.itemName}
              onChange={(val) => setFormData({ ...formData, itemName: val })}
              placeholder="Search…"
              theme={theme}
            />
          </div>
          <div className="shrink-0 w-[112px]">
            <label className={label}>
              Quantity
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
          <label className={label}>
            Purchase price{formData.quantity > 1 ? ' each' : ''}
            {formData.quantity > 1 && formData.purchasePrice && (
              <span className={`ml-2 font-mono ${theme.textSecondary}`}>
                {formatUsd(parseFloat(formData.purchasePrice) * formData.quantity)} total
              </span>
            )}
          </label>
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
          <label className={label}>Bought on</label>
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
          <label className={label}>Notes <span className="font-normal opacity-70">(optional)</span></label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            className={`w-full ${inputH} ${theme.input} rounded-lg px-3 text-sm ${theme.text} placeholder-slate-500 focus:outline-none transition-colors border`}
            placeholder="Float, pattern, stickers"
          />
        </div>
      </div>

      {/* Action row — one primary action; the trade-hold switch is a toggle */}
      <div
        className={`flex flex-wrap gap-2 mt-5 pt-4 border-t ${theme.cardBorder} items-center`}
      >
        <Button
          variant={success ? "success" : "primary"}
          onClick={onAdd}
          disabled={!canAdd && !success}
          icon={success ? <CheckCircle size={15} /> : <Plus size={15} strokeWidth={2.5} />}
        >
          {success
            ? "Added"
            : formData.quantity > 1
              ? `Add ${formData.quantity} items`
              : "Add item"}
        </Button>

        <Button
          pressed={!!formData.pending}
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
          title="The item is still under Steam trade protection (not received yet)"
          icon={<Clock size={15} className={formData.pending ? "text-warn" : ""} />}
        >
          On trade hold
        </Button>

        {formData.pending && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${theme.subtext}`}>Tradeable on</span>
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

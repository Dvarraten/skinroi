// Form for adding an item by hand: name autocomplete, price, quantity,
// platform, notes and the trade-hold switch. Calls back into useItems on
// submit. Rendered inside a card on the Add page.
import React, { useState, useEffect } from "react";
import { Check, Minus, Plus } from "lucide-react";
import ItemAutoComplete from "./ItemAutoComplete";
import PlatformPicker from "./PlatformPicker";
import PricePair from "./PricePair";
import { Field, Input, Switch } from "./ui";
import { useItemImage } from "../utils/itemImages";
import { PLATFORMS } from "../utils/platforms";

export default function AddItemForm({
  formData,
  setFormData,
  handleAddItem,
  theme,
  exchangeRate = null,
  currencySymbol = '¥',
  displayCurrency = 'CNY',
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

  const ready = !!formData.itemName && !!formData.purchasePrice;
  const quantity = parseInt(formData.quantity) || 1;
  const setQuantity = (n) => setFormData({ ...formData, quantity: Math.max(1, Math.min(999, n)) });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!ready) return;
    handleAddItem();
    setCnyPrice('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const defaultDeliveryISO = (() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  })();

  const stepBtn = `h-full w-8 flex items-center justify-center ${theme.subtext} ${theme.textHover} ${theme.itemHoverBg}`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field theme={theme} label="Item">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <ItemAutoComplete
              value={formData.itemName}
              onChange={(val) => setFormData({ ...formData, itemName: val })}
              placeholder="Search, e.g. ak redline ft"
              theme={theme}
            />
          </div>
          {resolvedIcon && (
            <img src={resolvedIcon} alt="" className="w-12 h-9 object-contain shrink-0" />
          )}
        </div>
      </Field>

      <Field theme={theme} label="Price each">
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
      </Field>

      <div className="flex items-start gap-3">
        <Field theme={theme} label="Quantity" className="w-[112px] shrink-0">
          <div className={`field flex items-center h-9 rounded-lg border overflow-hidden ${theme.input}`}>
            <button type="button" onClick={() => setQuantity(quantity - 1)} disabled={quantity <= 1} className={`${stepBtn} disabled:opacity-30`} aria-label="Decrease quantity">
              <Minus size={13} />
            </button>
            <input
              type="number"
              min="1"
              max="999"
              value={formData.quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              aria-label="Quantity"
              className={`no-spin flex-1 h-full min-w-0 bg-transparent text-center text-sm font-mono ${theme.text} focus:outline-none`}
            />
            <button type="button" onClick={() => setQuantity(quantity + 1)} className={stepBtn} aria-label="Increase quantity">
              <Plus size={13} />
            </button>
          </div>
        </Field>
        <Field theme={theme} label="Bought on" className="flex-1 min-w-0">
          <PlatformPicker
            value={formData.platform}
            onChange={(val) => setFormData({ ...formData, platform: val, customFee: val === 'other' ? '0' : '' })}
            theme={theme}
            platforms={PLATFORMS}
          />
        </Field>
      </div>

      {formData.platform === 'other' && (
        <Field theme={theme} label="Sell fee on that platform">
          <Input
            theme={theme} type="number" min="0" max="100" step="0.1" suffix="%"
            value={formData.customFee || ''}
            onChange={(e) => setFormData({ ...formData, customFee: e.target.value })}
            placeholder="0"
          />
        </Field>
      )}

      <Field theme={theme} label="Notes">
        <Input
          theme={theme}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Float, pattern, stickers (optional)"
        />
      </Field>

      <div className={`border-t pt-3 ${theme.panelBorder}`}>
        <Switch
          theme={theme}
          label="On trade hold"
          hint="Bought but not in your inventory yet."
          checked={!!formData.pending}
          onChange={(next) => setFormData({
            ...formData,
            pending: next,
            expectedDelivery: next ? formData.expectedDelivery || defaultDeliveryISO : "",
          })}
        />
        {formData.pending && (
          <Field theme={theme} label="Arrives on" className="mt-2">
            <Input
              theme={theme}
              type="date"
              value={formData.expectedDelivery || defaultDeliveryISO}
              onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
            />
          </Field>
        )}
      </div>

      {quantity > 1 && formData.purchasePrice && (
        <div className={`flex items-center justify-between text-[13px] ${theme.subtext}`}>
          <span>Total for {quantity}</span>
          <span className={`font-mono ${theme.text}`}>${(parseFloat(formData.purchasePrice) * quantity).toFixed(2)}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!ready && !success}
        className={`w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium border disabled:opacity-40 disabled:cursor-not-allowed
          ${success ? `${theme.cardBorder} text-profit` : `border-transparent ${theme.primary}`}`}
      >
        {success ? (
          <><Check size={15} /> Added</>
        ) : (
          `Add ${quantity > 1 ? `${quantity} items` : "item"}${formData.pending ? " on hold" : ""}`
        )}
      </button>
    </form>
  );
}

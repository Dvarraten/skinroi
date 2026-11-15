// Linked USD ↔ [displayCurrency] price input pair. USD is the source of
// truth; both fields stay in sync via the live exchange rate.
import React from 'react';
import { Input } from './ui';

export default function PricePair({ usdValue, cnyValue, onChange, onCnyTyped, exchangeRate, theme, currencySymbol = '¥', displayCurrency = 'CNY' }) {
  const handleUsd = (raw) => {
    const num = parseFloat(raw);
    const cny = isNaN(num) || !exchangeRate ? '' : (num * exchangeRate).toFixed(2);
    onChange({ usd: raw, cny });
  };
  const handleCny = (raw) => {
    const num = parseFloat(raw);
    const usd = isNaN(num) || !exchangeRate ? '' : (num / exchangeRate).toFixed(2);
    onChange({ usd, cny: raw });
    if (raw && onCnyTyped) onCnyTyped();
  };
  return (
    <div className="flex items-center gap-2 w-full">
      <Input
        theme={theme} type="number" step="0.01" prefix="$" className="flex-1"
        value={usdValue} onChange={(e) => handleUsd(e.target.value)}
        placeholder="USD" aria-label="Price in USD"
      />
      <Input
        theme={theme} type="number" step="0.01" prefix={currencySymbol} className="flex-1"
        value={cnyValue} onChange={(e) => handleCny(e.target.value)}
        placeholder={exchangeRate ? displayCurrency : 'loading…'}
        disabled={!exchangeRate} aria-label={`Price in ${displayCurrency}`}
      />
    </div>
  );
}

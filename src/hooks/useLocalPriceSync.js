// Keeps a local-currency price field in step with its USD value when the
// display currency (and so the exchange rate) changes in the currency
// converter. USD is the source of truth. Only reacts to rate changes, so it
// never overwrites what the user is typing or a prefilled value.
import { useEffect, useRef } from 'react';

export function useLocalPriceSync(usdValue, exchangeRate, setLocal) {
  const prevRate = useRef(exchangeRate);
  useEffect(() => {
    if (prevRate.current === exchangeRate) return;
    prevRate.current = exchangeRate;
    const usd = parseFloat(usdValue);
    setLocal(exchangeRate && usd > 0 ? (usd * exchangeRate).toFixed(2) : '');
  }, [exchangeRate, usdValue, setLocal]);
}

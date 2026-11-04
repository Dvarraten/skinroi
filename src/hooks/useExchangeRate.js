// Fetches all USD exchange rates on mount. Exposes displayCurrency (price
// pairs, persisted) and currency1 (sidebar left field, persisted) so the
// sidebar converter works between any two currencies while price pairs
// always stay USD ↔ displayCurrency.
import { useState, useEffect, useCallback, useMemo } from 'react';

export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'CNY', symbol: '¥' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'SEK', symbol: 'kr' },
  { code: 'NOK', symbol: 'kr' },
  { code: 'RUB', symbol: '₽' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'PLN', symbol: 'zł' },
  { code: 'TRY', symbol: '₺' },
  { code: 'KRW', symbol: '₩' },
  { code: 'JPY', symbol: '¥' },
];

const FALLBACK_RATES = {
  USD: 1, CNY: 6.6609, EUR: 0.8961, GBP: 0.7469, SEK: 9.8226, NOK: 9.2130,
  RUB: 80.62, BRL: 5.4370, AUD: 1.4227, CAD: 1.3968, PLN: 3.9512, TRY: 49.94,
  KRW: 1332.8, JPY: 157.53,
};

const getSymbol = (code) => CURRENCIES.find(c => c.code === code)?.symbol || code;

export const useExchangeRate = () => {
  const [currency1, setCurrency1State] = useState(
    () => localStorage.getItem('skinroi-currency1') || 'USD'
  );
  const [displayCurrency, setDisplayCurrencyState] = useState(
    () => localStorage.getItem('skinroi-currency') || 'EUR'
  );
  const [usdAmount, setUsdAmount] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [allRates, setAllRates] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  const setCurrency1 = useCallback((code) => {
    setCurrency1State(code);
    localStorage.setItem('skinroi-currency1', code);
  }, []);

  const setDisplayCurrency = useCallback((code) => {
    setDisplayCurrencyState(code);
    localStorage.setItem('skinroi-currency', code);
  }, []);

  useEffect(() => {
    // open.er-api.com is the free, keyless tier of ExchangeRate-API. Unlike
    // the old /v4 endpoint it returns full precision (6.660856, not 6.66).
    // Rates refresh once a day; lastUpdated shows when the provider published
    // them, not when we fetched.
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data?.result !== 'success' || !data.rates?.CNY) throw new Error('bad fx response');
        setAllRates({ USD: 1, ...data.rates });
        const at = new Date(data.time_last_update_unix * 1000);
        const month = at.toLocaleString('en-US', { month: 'short' });
        const hh = String(at.getHours()).padStart(2, '0');
        const mm = String(at.getMinutes()).padStart(2, '0');
        setLastUpdated(`${month} ${at.getDate()} ${hh}:${mm}`);
      })
      .catch(() => {
        // Snapshot from 2026-11-02. Only used when the fetch fails.
        setAllRates(FALLBACK_RATES);
        setLastUpdated('offline, approximate');
      });
  }, []);

  // Rate for price pairs: always USD → displayCurrency
  const exchangeRate = useMemo(() => allRates[displayCurrency] || null, [allRates, displayCurrency]);

  // Rate for sidebar converter: currency1 → displayCurrency
  const sidebarRate = useMemo(() => {
    const r1 = allRates[currency1];
    const r2 = allRates[displayCurrency];
    if (!r1 || !r2) return null;
    return r2 / r1;
  }, [allRates, currency1, displayCurrency]);

  // Recalculate sidebar amounts when currencies change
  useEffect(() => {
    if (!sidebarRate) return;
    if (usdAmount && !isNaN(parseFloat(usdAmount))) {
      setLocalAmount((parseFloat(usdAmount) * sidebarRate).toFixed(2));
    }
  }, [sidebarRate]); // eslint-disable-line react-hooks/exhaustive-deps

  const currencySymbol = getSymbol(displayCurrency);
  const currency1Symbol = getSymbol(currency1);

  const handleUsdChange = useCallback((value) => {
    setUsdAmount(value);
    setLocalAmount(sidebarRate && value && !isNaN(value)
      ? (parseFloat(value) * sidebarRate).toFixed(2) : '');
  }, [sidebarRate]);

  const handleRmbChange = useCallback((value) => {
    setLocalAmount(value);
    setUsdAmount(sidebarRate && value && !isNaN(value)
      ? (parseFloat(value) / sidebarRate).toFixed(2) : '');
  }, [sidebarRate]);

  return {
    usdAmount, rmbAmount: localAmount,
    setUsdAmount, setRmbAmount: setLocalAmount,
    exchangeRate, sidebarRate, lastUpdated, allRates,
    currency1, setCurrency1, currency1Symbol,
    displayCurrency, setDisplayCurrency, currencySymbol,
    handleUsdChange, handleRmbChange,
  };
};

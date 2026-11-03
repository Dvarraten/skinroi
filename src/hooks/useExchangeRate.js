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
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(data => {
        setAllRates({ USD: 1, ...data.rates });
        const now = new Date();
        const month = now.toLocaleString('en-US', { month: 'short' });
        const day = now.getDate();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        setLastUpdated(`${month} ${day} ${hh}:${mm}`);
      })
      .catch(() => {
        setAllRates({ USD: 1, CNY: 7.15, EUR: 0.92, GBP: 0.79, SEK: 10.5,
          NOK: 10.8, RUB: 90, BRL: 5.0, AUD: 1.55, CAD: 1.37,
          PLN: 4.0, TRY: 32, KRW: 1340, JPY: 155 });
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

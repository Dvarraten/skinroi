// Money formatting shared by every page: thousands separators and a real
// minus sign in front of the currency symbol ("−$4.77", never "$-4.77").
const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// 1234.5 → "1,234.50"
export const formatAmount = (value) => twoDecimals.format(num(value));

// 1234.5 → "$1,234.50", -4.77 → "−$4.77"
export const formatUsd = (value, symbol = '$') => {
  const n = num(value);
  return `${n < 0 ? '−' : ''}${symbol}${twoDecimals.format(Math.abs(n))}`;
};

// 12 → "+$12.00", -4.77 → "−$4.77"
export const formatSignedUsd = (value, symbol = '$') => {
  const n = num(value);
  return `${n < 0 ? '−' : '+'}${symbol}${twoDecimals.format(Math.abs(n))}`;
};

// 5.123 → "+5.1%", -5.4 → "−5.4%"
export const formatSignedPercent = (value, digits = 1) => {
  const n = num(value);
  return `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(digits)}%`;
};

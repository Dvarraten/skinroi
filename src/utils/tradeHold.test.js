import { tradeHoldEndsAt, tradeHoldStatus, TRADE_HOLD_MS } from './tradeHold';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);

test('hold ends 7 days after the trade', () => {
  expect(tradeHoldEndsAt(NOW)).toBe(NOW + TRADE_HOLD_MS);
  expect(tradeHoldEndsAt(new Date(NOW).toISOString())).toBe(NOW + TRADE_HOLD_MS);
});

test('unknown time means no hold', () => {
  expect(tradeHoldEndsAt(null)).toBeNull();
  expect(tradeHoldEndsAt('not a date')).toBeNull();
  expect(tradeHoldStatus(undefined, NOW).onHold).toBe(false);
});

test('labels count down in days and hours', () => {
  expect(tradeHoldStatus(NOW - 2 * HOUR, NOW)).toMatchObject({ onHold: true, label: '6d 22h' });
  expect(tradeHoldStatus(NOW - 6 * 24 * HOUR, NOW).label).toBe('1d');
  expect(tradeHoldStatus(NOW - (7 * 24 - 5) * HOUR, NOW).label).toBe('5h');
  expect(tradeHoldStatus(NOW - (7 * 24 * HOUR - 10 * 60 * 1000), NOW).label).toBe('<1h');
});

test('hold is over after 7 days', () => {
  expect(tradeHoldStatus(NOW - 8 * 24 * HOUR, NOW)).toMatchObject({ onHold: false, label: null });
});

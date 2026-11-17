// Steam trade protection: items received in a trade can't be traded or sold
// for 7 days after the trade was accepted. The extension tells us when each
// trade was accepted (`detectedAt`), so the hold is worked out from that
// instead of asking the user.
export const TRADE_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Epoch ms when the hold on an item received at `receivedAt` ends, or null
// when the time is unknown.
export function tradeHoldEndsAt(receivedAt) {
  const t = typeof receivedAt === 'number' ? receivedAt : new Date(receivedAt || NaN).getTime();
  return Number.isFinite(t) && t > 0 ? t + TRADE_HOLD_MS : null;
}

// { onHold, endsAt, label } for a chip. label is "6d 4h", "5h", "<1h" while on
// hold and null once it is over (or the time is unknown).
export function tradeHoldStatus(receivedAt, now = Date.now()) {
  const endsAt = tradeHoldEndsAt(receivedAt);
  if (endsAt == null || endsAt <= now) return { onHold: false, endsAt, label: null };
  const left = endsAt - now;
  const days = Math.floor(left / DAY);
  const hours = Math.floor((left % DAY) / HOUR);
  let label;
  if (days > 0) label = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  else label = hours > 0 ? `${hours}h` : '<1h';
  return { onHold: true, endsAt, label };
}

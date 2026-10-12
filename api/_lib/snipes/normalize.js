// Shared helpers for turning marketplace data into comparable items.
// Every source is keyed by market_hash_name + Doppler phase, because a
// Phase 2 and a Ruby share a market_hash_name but differ massively in price.

const PHASE_ALIASES = {
  phase1: 'Phase 1', p1: 'Phase 1',
  phase2: 'Phase 2', p2: 'Phase 2',
  phase3: 'Phase 3', p3: 'Phase 3',
  phase4: 'Phase 4', p4: 'Phase 4',
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  blackpearl: 'Black Pearl',
  emerald: 'Emerald',
};

// "phase-2", "Phase 2", "P2", "black_pearl" → canonical name, or null.
export function normalizePhase(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PHASE_ALIASES[compact] || null;
}

// Doppler and Gamma Doppler need a phase to be priced correctly.
export function needsPhase(name) {
  return /\bDoppler\b/i.test(name || '');
}

export function itemKey(name, phase) {
  return phase ? `${name}|${phase}` : name;
}

export function isStatTrak(name) {
  return /StatTrak™/.test(name || '');
}

export function isSouvenir(name) {
  return /^Souvenir /.test(name || '');
}

export function toNumber(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

// Unix seconds, unix ms or ISO string → ms epoch.
export function toMillis(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const asNum = Number(v);
  if (Number.isFinite(asNum)) return toMillis(asNum);
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`${res.status} ${res.statusText} from ${new URL(url).host}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

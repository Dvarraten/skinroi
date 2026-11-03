// Doppler / Gamma Doppler phase for a portfolio item, so sell prices are
// looked up per phase (a Ruby and a Phase 2 share one market_hash_name but
// differ hugely in price). Mirrored in src/utils/sellPrices.js for the site;
// keep the two in step.
//
// The phase comes from the item name ("★ Karambit | Doppler Phase 2 (Factory
// New)", as the Add Item autocomplete writes it) or from the paint index the
// extension reads when a trade comes in.

// Paint index → phase. 852–855 are the Doppler phases on the newer knives,
// 1119–1123 the Glock-18 Gamma Doppler.
export const PAINT_INDEX_PHASES = {
  415: 'Ruby', 416: 'Sapphire', 417: 'Black Pearl',
  418: 'Phase 1', 419: 'Phase 2', 420: 'Phase 3', 421: 'Phase 4',
  852: 'Phase 1', 853: 'Phase 2', 854: 'Phase 3', 855: 'Phase 4',
  568: 'Emerald', 569: 'Phase 1', 570: 'Phase 2', 571: 'Phase 3', 572: 'Phase 4',
  1119: 'Emerald', 1120: 'Phase 1', 1121: 'Phase 2', 1122: 'Phase 3', 1123: 'Phase 4',
};

const PHASE_IN_NAME = /\b((?:Gamma )?Doppler) (Phase [1-4]|Ruby|Sapphire|Black Pearl|Emerald)\b/;

export function needsPhase(name) {
  return /\bDoppler\b/.test(name || '');
}

// item → { key, name, phase, paintIndex }. `name` is the real market_hash_name
// (phase removed), `key` is name + phase and is what prices are stored under.
export function sellPriceTarget(item) {
  const raw = typeof item?.itemName === 'string' ? item.itemName.trim() : '';
  let name = raw;
  let phase = null;
  const m = raw.match(PHASE_IN_NAME);
  if (m) {
    phase = m[2];
    name = raw.replace(m[0], m[1]);
  }
  const paintIndex = Number.isInteger(item?.paintIndex) ? item.paintIndex : null;
  if (!phase && needsPhase(name) && paintIndex != null) phase = PAINT_INDEX_PHASES[paintIndex] || null;
  return { key: phase ? `${name}|${phase}` : name, name, phase, paintIndex };
}

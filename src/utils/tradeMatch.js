// Finds the portfolio item an outgoing Steam trade entry is. Items added
// through Trades or the Steam import carry the Steam `assetid`, which stays
// the same while the item sits in the inventory, so that is an exact match
// and needs no choice from the user. Items added by hand have no assetid:
// for those we fall back to the same name, then to near names.
import { nameMatchScore } from './nameMatch';

const isActive = (it) => it && !it.sold && !it.isTransaction;

// Returns { exact, candidates }. `exact` is the item with the same assetid
// (or null). `candidates` is the fallback list when there is no exact match:
// same-name items first (ones without an assetid before ones with one, oldest
// first), else names at least 90 % alike, each tagged with matchType.
export function matchOutgoing(entry, items = []) {
  const active = items.filter(isActive);
  if (entry?.assetid != null) {
    const exact = active.find((it) => it.assetid != null && String(it.assetid) === String(entry.assetid));
    if (exact) return { exact, candidates: [] };
  }

  const name = (entry?.marketHashName || '').toLowerCase();
  const sameName = active
    .filter((it) => (it.itemName || '').toLowerCase() === name)
    .sort((a, b) =>
      (a.assetid != null) - (b.assetid != null)
      || (a.datePurchased || '').localeCompare(b.datePurchased || ''));
  if (sameName.length) {
    return { exact: null, candidates: sameName.map((it) => ({ ...it, matchType: 'name' })) };
  }

  const fuzzy = [];
  for (const it of active) {
    const score = nameMatchScore(entry?.marketHashName || '', it.itemName || '');
    if (score >= 0.9) fuzzy.push({ ...it, matchType: 'fuzzy', matchScore: score });
  }
  fuzzy.sort((a, b) => b.matchScore - a.matchScore);
  return { exact: null, candidates: fuzzy.slice(0, 10) };
}

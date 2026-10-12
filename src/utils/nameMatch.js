// Fuzzy name matching for Tracked match in Handle Items (Steam name vs the
// name the user typed when tracking the item).

const WEAR_LEVELS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
function getWearLevel(name) {
  return WEAR_LEVELS.find(w => (name || '').includes(w)) ?? null;
}

// Lowercase, drop ★/™, the trailing wear and punctuation, so small typing
// differences ("Karambit" vs "★ Karambit") don't matter.
function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\s*\((factory new|minimal wear|field-tested|well-worn|battle-scarred)\)\s*$/, '')
    .replace(/[★™]/g, ' ')
    .replace(/[-.]/g, '')
    .replace(/[,:'"/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function similarity(a, b) {
  const len = Math.max(a.length, b.length);
  return len === 0 ? 0 : 1 - levenshtein(a, b) / len;
}

// 0..1 similarity between a Steam name and a tracked item name. The weapon
// and the skin are compared separately and the lower score wins, so
// "Navaja Knife | Gamma Doppler" never matches "Butterfly Knife | Gamma Doppler".
export function nameMatchScore(steamName, trackerName) {
  const sw = getWearLevel(steamName);
  const tw = getWearLevel(trackerName);
  if (sw && tw && sw !== tw) return 0;
  const a = normalizeName(steamName).split('|').map(t => t.trim());
  const b = normalizeName(trackerName).split('|').map(t => t.trim());
  if (a.length !== b.length) return similarity(a.join(' '), b.join(' '));
  return Math.min(...a.map((part, i) => similarity(part, b[i])));
}

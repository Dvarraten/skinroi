// Skin name autocomplete input backed by /public/items.json (fetched once,
// cached at module scope). Supports abbreviated queries like "but dop fn"
// matching "★ Butterfly Knife | Doppler (Factory New)".
import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import PasteButton from "./PasteButton";

// ─── Lazy-loaded index ──────────────────────────────────────────────────────
// items.json now lives in /public so it is fetched at runtime instead of
// being bundled into the JS. Cached at module scope so we only download
// + index it once for the whole app session.
let _indexCache = null;
let _loadPromise = null;

const EXTERIORS_CANON = [
  { name: "Factory New",    abbr: "fn" },
  { name: "Minimal Wear",   abbr: "mw" },
  { name: "Field-Tested",   abbr: "ft" },
  { name: "Well-Worn",      abbr: "ww" },
  { name: "Battle-Scarred", abbr: "bs" },
];

const DOPPLER_PHASES = [
  'Doppler Phase 1', 'Doppler Phase 2', 'Doppler Phase 3', 'Doppler Phase 4',
  'Doppler Ruby', 'Doppler Sapphire', 'Doppler Black Pearl',
  'Gamma Doppler Phase 1', 'Gamma Doppler Phase 2', 'Gamma Doppler Phase 3', 'Gamma Doppler Phase 4',
  'Gamma Doppler Emerald',
];

const CATEGORY_ORDER = ["weapon", "finish", "exterior", "direct"];
const CATEGORY_LABEL = {
  weapon:   "Weapon",
  finish:   "Skin",
  exterior: "Exterior",
  direct:   "Item",
};

function makeAcronym(name) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toLowerCase();
}

function buildEntry(name, extra = {}) {
  return {
    name,
    lower: name.toLowerCase(),
    acronym: makeAcronym(name),
    ...extra,
  };
}

function buildIndex(itemsData) {
  const weapons = new Map(); // weapon name → needs ★
  const finishes = new Set();
  const directNames = new Set();
  const weaponFinishMap = new Map(); // weapon → Set<finish>
  for (const v of Object.values(itemsData)) {
    if (v.weapon) {
      const hasStar = v['full-name']?.startsWith('★');
      weapons.set(v.weapon, weapons.get(v.weapon) || hasStar);
      if (v.finish) {
        if (!weaponFinishMap.has(v.weapon)) weaponFinishMap.set(v.weapon, new Set());
        weaponFinishMap.get(v.weapon).add(v.finish);
      }
    }
    if (v.finish) finishes.add(v.finish);
  }
  for (const p of DOPPLER_PHASES) finishes.add(p);
  for (const v of Object.values(itemsData)) {
    if (!v.weapon && !v.finish && v['full-name']) directNames.add(v['full-name']);
  }
  return {
    weapon:         [...weapons.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([n, star]) => buildEntry(n, { star })),
    finish:         [...finishes].sort().map((n) => buildEntry(n)),
    exterior:       EXTERIORS_CANON.map((e) => buildEntry(e.name, { abbr: e.abbr })),
    direct:         [...directNames].sort().map((n) => buildEntry(n)),
    weaponFinishMap,
  };
}

function loadIndex() {
  if (_indexCache) return Promise.resolve(_indexCache);
  if (_loadPromise) return _loadPromise;
  const url = `${process.env.PUBLIC_URL || ""}/items.json`;
  _loadPromise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      _indexCache = buildIndex(data);
      return _indexCache;
    })
    .catch((err) => {
      _loadPromise = null; // allow retry on next mount
      throw err;
    });
  return _loadPromise;
}

// ─── Matching ───────────────────────────────────────────────────────────────
function scoreEntry(entry, q) {
  if (!q) return 0;
  if (entry.lower === q) return 1000;
  if (entry.abbr && entry.abbr === q) return 900;          // "fn" === "fn"
  if (entry.lower.startsWith(q)) return 700;               // "fac" → "Factory New"
  if (entry.abbr && entry.abbr.startsWith(q)) return 500;  // "f" → "fn" → "Factory New"
  if (entry.acronym && entry.acronym.startsWith(q)) return 400; // "bk" → "Butterfly Knife"
  if (entry.lower.includes(q)) return 200;                 // "rang" → "Boreal Forest" no, but "phase" → "Doppler Phase 1" etc.
  return 0;
}

function buildSuggestions(index, query, usedCategories, tags) {
  if (!query || !index) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const weaponTag = tags?.find(t => t.category === 'weapon');
  const allowedFinishes = weaponTag && index.weaponFinishMap
    ? index.weaponFinishMap.get(weaponTag.name)
    : null;

  const out = [];
  for (const cat of CATEGORY_ORDER) {
    if (cat !== "direct" && usedCategories.has(cat)) continue;
    // Suppress standalone items once a weapon is selected — they're not skins
    if (cat === "direct" && weaponTag) continue;
    let entries = index[cat];
    if (cat === 'finish' && allowedFinishes) {
      entries = entries.filter(e => {
        if (allowedFinishes.has(e.name)) return true;
        // Include Doppler phases when weapon has base Doppler/Gamma Doppler finish
        if (allowedFinishes.has('Doppler') && e.name.startsWith('Doppler')) return true;
        if (allowedFinishes.has('Gamma Doppler') && e.name.startsWith('Gamma Doppler')) return true;
        return false;
      });
    }
    for (const e of entries) {
      const score = scoreEntry(e, q);
      if (score > 0) out.push({ category: cat, name: e.name, score, star: e.star });
    }
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  return out.slice(0, 12);
}

// ─── Tag → display string ───────────────────────────────────────────────────
function combineTagsToValue(tags) {
  const byCat = {};
  for (const t of tags) byCat[t.category] = t;
  let s = "";
  if (byCat.weapon)   s = byCat.weapon.star ? `★ ${byCat.weapon.name}` : byCat.weapon.name;
  if (byCat.finish)   s = s ? `${s} | ${byCat.finish.name}` : byCat.finish.name;
  if (byCat.exterior) s = s ? `${s} (${byCat.exterior.name})` : `(${byCat.exterior.name})`;
  return s;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function ItemAutoComplete({ value, onChange, placeholder, theme }) {
  const [tags, setTags]                 = useState([]);
  const [currentInput, setCurrentInput] = useState(value || "");
  const [index, setIndex]               = useState(_indexCache);
  const [loading, setLoading]           = useState(!_indexCache);
  const [loadError, setLoadError]       = useState(null);

  const [suggestions, setSuggestions]     = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const wrapperRef = useRef(null);
  const inputRef   = useRef(null);

  const usedCategories = new Set(tags.map((t) => t.category));

  // Lazy-load index once
  useEffect(() => {
    let cancelled = false;
    if (_indexCache) {
      setIndex(_indexCache);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadIndex()
      .then((idx) => {
        if (!cancelled) {
          setIndex(idx);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err?.message || String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // External reset: parent cleared value (e.g. after submit) → clear tags
  useEffect(() => {
    if (value === "" && (tags.length > 0 || currentInput)) {
      setTags([]);
      setCurrentInput("");
      setSuggestions([]);
      setShowDropdown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Outside-click closes dropdown
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const refreshSuggestions = (input, usedOverride, tagsOverride) => {
    const used = usedOverride || usedCategories;
    const activeTags = tagsOverride !== undefined ? tagsOverride : tags;
    const s = buildSuggestions(index, input, used, activeTags);
    setSuggestions(s);
    setShowDropdown(s.length > 0);
    setSelectedIndex(s.length > 0 ? 0 : -1);
  };

  // ─ Mutations: each one updates state AND notifies parent ─
  const emit = (nextTags, nextInput) => {
    const derived = nextTags.length > 0
      ? combineTagsToValue(nextTags)
      : nextInput;
    if (derived !== value) onChange(derived);
  };

  const handleInputChange = (e) => {
    const v = e.target.value;
    setCurrentInput(v);
    refreshSuggestions(v);
    emit(tags, v);
  };

  const addTag = (suggestion) => {
    if (suggestion.category === "direct") {
      setTags([]);
      setCurrentInput(suggestion.name);
      setSuggestions([]);
      setShowDropdown(false);
      setSelectedIndex(0);
      onChange(suggestion.name);
      inputRef.current?.focus();
      return;
    }
    const next = [
      ...tags.filter((t) => t.category !== suggestion.category),
      { category: suggestion.category, name: suggestion.name, star: suggestion.star },
    ].sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    );
    setTags(next);
    setCurrentInput("");
    setSuggestions([]);
    setShowDropdown(false);
    setSelectedIndex(0);
    emit(next, "");
    inputRef.current?.focus();
  };

  const removeTag = (categoryToRemove) => {
    const next = tags.filter((t) => t.category !== categoryToRemove);
    setTags(next);
    emit(next, currentInput);
    if (currentInput) {
      refreshSuggestions(currentInput, new Set(next.map((t) => t.category)), next);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Backspace on empty input pops the last tag
    if (e.key === "Backspace" && !currentInput && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1].category);
      return;
    }

    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((p) => (p < suggestions.length - 1 ? p + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((p) => (p > 0 ? p - 1 : suggestions.length - 1));
        break;
      case "Enter":
      case "Tab":
      case " ":
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          addTag(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleFocus = () => {
    if (currentInput) refreshSuggestions(currentInput);
  };

  const handlePaste = (val) => {
    setTags([]);
    setCurrentInput(val);
    refreshSuggestions(val, new Set());
    emit([], val);
    inputRef.current?.focus();
  };

  // ─ Render ─
  // Derive focus-within border from the theme's focus:border-* class so it
  // matches the theme accent instead of being hardcoded indigo.
  const focusWithin = '';
  const wrapperClasses = `flex flex-wrap items-center gap-1.5 w-full ${
    theme?.input ?? "bg-slate-800/60 border-slate-600/50"
  } rounded-lg pl-2 pr-9 py-1.5 min-h-[36px] border ${focusWithin} transition-colors cursor-text`;

  return (
    <div ref={wrapperRef} className="relative">
      <div className={wrapperClasses} onClick={() => inputRef.current?.focus()}>
        {tags.map((tag) => (
          <span
            key={tag.category}
            className={`inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-md bg-white/10 ${theme?.text || 'text-white'} text-sm border border-white/5`}
            title={CATEGORY_LABEL[tag.category]}
          >
            <span className="text-[9px] uppercase tracking-wider opacity-60">
              {CATEGORY_LABEL[tag.category]}
            </span>
            <span className="text-sm">{tag.name}</span>
            <button
              type="button"
              onMouseDown={(e) => {
                // mousedown so the focus-blur dance doesn't swallow the click
                e.preventDefault();
                e.stopPropagation();
                removeTag(tag.category);
              }}
              className={`ml-0.5 ${theme?.textSecondary || 'text-slate-300'} ${theme?.textHover || 'hover:text-white'} p-0.5 rounded hover:bg-white/10`}
              aria-label={`Remove ${CATEGORY_LABEL[tag.category]} tag`}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={currentInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={
            tags.length === 0
              ? loading ? "Loading items…" : placeholder
              : "Add tag…"
          }
          autoComplete="off"
          className={`flex-1 min-w-[100px] bg-transparent border-none outline-none ${theme?.text || 'text-white'} placeholder-slate-500 px-1 py-1 text-sm`}
        />
      </div>
      <PasteButton onPaste={handlePaste} />

      {showDropdown && suggestions.length > 0 && (
        <div
          className={`absolute z-50 left-0 right-0 mt-1 ${
            theme?.card ?? "bg-slate-800"
          } border ${
            theme?.cardBorder ?? "border-slate-700"
          } rounded-lg shadow-xl max-h-72 overflow-y-auto`}
        >
          {suggestions.map((s, i) => (
            <div
              key={`${s.category}:${s.name}`}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer transition-colors ${
                i === selectedIndex
                  ? `bg-white/10 ${theme?.text || 'text-white'}`
                  : `${theme?.textSecondary || 'text-slate-200'} hover:bg-white/5`
              }`}
            >
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-xs font-mediumr text-slate-400 shrink-0">
                {CATEGORY_LABEL[s.category]}
              </div>
            </div>
          ))}
        </div>
      )}

      {loadError && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-red-900/40 border border-red-500/40 rounded-lg px-3 py-2 text-xs text-red-200">
          Failed to load item list: {loadError}
        </div>
      )}
    </div>
  );
}

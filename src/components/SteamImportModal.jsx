// One-click import of the signed-in user's public CS2 inventory.
//
// Reads GET /api/inventory/state?steamInventory=1 (Steam's public inventory
// endpoint, cached 10 min on the server), groups identical items, and adds
// the ticked ones to the portfolio with the buy price the user types. Items
// already tracked by assetid are left out; items with the same name as an
// unsold tracked item start unticked, since they may be the same copy.
import React, { useEffect, useMemo, useState } from "react";
import { X, RefreshCw, Search, Download, AlertTriangle } from "lucide-react";
import PlatformPicker from "./PlatformPicker";
import { PLATFORMS } from "../utils/platforms";

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || "";
const BUY_PLATFORMS = PLATFORMS.filter((p) => p.value !== "other");

// Same-name copies become one row, so 40 cases are one price, not 40.
// Copies with a known float stay separate, since their prices differ.
export function groupInventory(rows, items) {
  const tracked = new Set(items.filter((i) => i.assetid).map((i) => String(i.assetid)));
  const unsoldNames = new Set(items.filter((i) => !i.sold && !i.isTransaction).map((i) => i.itemName));
  const groups = new Map();
  for (const r of rows) {
    if (tracked.has(r.assetid)) continue;
    const key = r.floatValue != null ? `${r.name}#${r.assetid}` : r.name;
    const g = groups.get(key);
    if (g) g.copies.push(r);
    else groups.set(key, { key, name: r.name, iconUrl: r.iconUrl, floatValue: r.floatValue ?? null, copies: [r], maybeTracked: unsoldNames.has(r.name) });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function SteamImportModal({ theme, items, addItemDirect, onClose }) {
  const [state, setState] = useState({ loading: true, error: null, rows: [], fetchedAt: null });
  const [prices, setPrices] = useState({});
  const [picked, setPicked] = useState({});
  const [platform, setPlatform] = useState("csfloat");
  const [search, setSearch] = useState("");
  const [done, setDone] = useState(null);

  const load = async (fresh = false) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${BASE}/api/inventory/state?steamInventory=1${fresh ? "&fresh=1" : ""}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setState({ loading: false, error: null, rows: data.items || [], fetchedAt: data.fetchedAt || null });
    } catch (e) {
      setState({ loading: false, error: e.message, rows: [], fetchedAt: null });
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = useMemo(() => groupInventory(state.rows, items), [state.rows, items]);

  // Tick everything except possible duplicates once the list arrives.
  useEffect(() => {
    setPicked(Object.fromEntries(groups.map((g) => [g.key, !g.maybeTracked])));
  }, [groups]);

  const visible = useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return groups;
    return groups.filter((g) => terms.every((t) => g.name.toLowerCase().includes(t)));
  }, [groups, search]);

  const priceOf = (g) => {
    const v = parseFloat(prices[g.key]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const chosen = groups.filter((g) => picked[g.key]);
  const ready = chosen.filter((g) => priceOf(g) != null);
  const readyCount = ready.reduce((n, g) => n + g.copies.length, 0);
  const missingCount = chosen.length - ready.length;
  const allVisiblePicked = visible.length > 0 && visible.every((g) => picked[g.key]);

  const importNow = () => {
    let added = 0;
    for (const g of ready) {
      for (const c of g.copies) {
        const id = addItemDirect({
          itemName: c.name,
          purchasePrice: priceOf(g),
          platform,
          iconUrl: c.iconUrl,
          assetid: c.assetid,
          floatValue: c.floatValue ?? null,
          paintSeed: c.paintSeed ?? null,
        });
        if (id != null) added++;
      }
    }
    setDone(added);
  };

  const input = `px-2 py-1.5 rounded-lg text-sm border ${theme.input} ${theme.text} focus:outline-none`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Import from Steam"
        onMouseDown={(e) => e.stopPropagation()}
        className={`pop-in w-full max-w-3xl max-h-[90vh] flex flex-col ${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-2xl overflow-hidden`}
      >
        <div className={`flex items-start gap-3 px-5 py-4 border-b ${theme.panelBorder}`}>
          <div className="min-w-0">
            <h2 className={`font-semibold ${theme.text}`}>Import from Steam</h2>
            <p className={`text-xs mt-0.5 ${theme.subtext}`}>
              Your public CS2 inventory. Items you already track are left out. Enter what you paid per item; rows without a price are skipped.
            </p>
          </div>
          <button onClick={onClose} className={`ml-auto p-1 rounded-lg ${theme.subtext} ${theme.textHover}`} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {done != null ? (
          <div className="p-8 text-center space-y-4">
            <p className={`text-sm ${theme.text}`}>
              Added <span className="font-mono">{done}</span> item{done === 1 ? "" : "s"} to your portfolio.
            </p>
            <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium border ${theme.cardBorder} ${theme.text} hover:bg-white/5 active:scale-[0.97]`}>
              Done
            </button>
          </div>
        ) : state.loading ? (
          <p className={`p-8 text-sm text-center ${theme.subtext}`}>Reading your Steam inventory…</p>
        ) : state.error ? (
          <div className="p-8 text-center space-y-4">
            <p className="text-sm text-loss flex items-start justify-center gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {state.error}
            </p>
            <button onClick={() => load(true)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${theme.cardBorder} ${theme.text} hover:bg-white/5`}>
              <RefreshCw size={12} /> Try again
            </button>
          </div>
        ) : groups.length === 0 ? (
          <p className={`p-8 text-sm text-center ${theme.subtext}`}>
            {state.rows.length === 0
              ? "No marketable CS2 items found in your inventory."
              : "Every item in your inventory is already tracked."}
          </p>
        ) : (
          <>
            <div className={`flex flex-wrap items-center gap-2 px-5 py-3 border-b ${theme.panelBorder}`}>
              <div className="relative flex-1 min-w-[160px]">
                <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${theme.subtext}`} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory" className={`${input} w-full pl-8`} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${theme.subtext}`}>Bought on</span>
                <div className="w-36">
                  <PlatformPicker value={platform} onChange={setPlatform} theme={theme} platforms={BUY_PLATFORMS} compact />
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className={`flex items-center gap-3 px-5 py-2 text-xs font-medium ${theme.subtext} border-b ${theme.cardBorder}`}>
                <input
                  type="checkbox"
                  checked={allVisiblePicked}
                  onChange={() => setPicked((p) => ({ ...p, ...Object.fromEntries(visible.map((g) => [g.key, !allVisiblePicked])) }))}
                  aria-label="Select all"
                />
                <span className="flex-1">Item</span>
                <span className="w-28 text-right">Paid per item</span>
              </div>
              {visible.map((g) => (
                <label key={g.key} className={`flex items-center gap-3 px-5 py-2 border-b ${theme.cardBorder} cursor-pointer ${theme.itemHoverBg || "hover:bg-white/5"}`}>
                  <input
                    type="checkbox"
                    checked={!!picked[g.key]}
                    onChange={() => setPicked((p) => ({ ...p, [g.key]: !p[g.key] }))}
                  />
                  {g.iconUrl
                    ? <img src={`${g.iconUrl}/96fx96f`} alt="" loading="lazy" className="w-10 h-8 object-contain shrink-0" />
                    : <div className="w-10 h-8 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${theme.text}`} title={g.name}>
                      {g.name}
                      {g.copies.length > 1 && <span className={`ml-1.5 font-mono text-xs ${theme.subtext}`}>×{g.copies.length}</span>}
                    </p>
                    <p className={`text-[11px] ${theme.subtext}`}>
                      {g.floatValue != null && <span className="font-mono">Float {g.floatValue.toFixed(4)}</span>}
                      {g.maybeTracked && <span className="text-warn">{g.floatValue != null ? " · " : ""}You already track one with this name</span>}
                    </p>
                  </div>
                  <div className="w-28 shrink-0 flex items-center gap-1">
                    <span className={`text-xs ${theme.subtext}`}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={prices[g.key] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPrices((p) => ({ ...p, [g.key]: v }));
                        if (v) setPicked((p) => ({ ...p, [g.key]: true }));
                      }}
                      placeholder="0.00"
                      className={`${input} w-full text-right font-mono`}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className={`flex flex-wrap items-center gap-3 px-5 py-3 border-t ${theme.panelBorder}`}>
              <p className={`text-xs ${theme.subtext}`}>
                <span className={`font-mono ${theme.text}`}>{readyCount}</span> item{readyCount === 1 ? "" : "s"} ready
                {missingCount > 0 && <> · <span className="text-warn">{missingCount} ticked without a price</span></>}
              </p>
              <button
                onClick={importNow}
                disabled={readyCount === 0}
                className={`ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${theme.cardBorder} ${theme.text} hover:bg-white/5 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none`}
              >
                <Download size={14} /> Import {readyCount > 0 ? readyCount : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

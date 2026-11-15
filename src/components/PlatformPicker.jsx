import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

// Shared dropdown for picking a buy/sell platform. Reused by AddItemForm
// (purchase platform) and ItemGrid (sell platform). The caller passes the
// list so each surface can carry its own options (e.g. AddItemForm has an
// "other" entry, the sell list does not).
//
// `platforms` shape: [{ value, label, icon?, fee? }]

function PlatformIcon({ platform, size = 14 }) {
  if (platform.icon) {
    return (
      <img
        src={platform.icon}
        alt={platform.label}
        className="rounded-sm object-contain flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.9 }}
    >
      {platform.emoji || platform.label[0]}
    </span>
  );
}

export default function PlatformPicker({ value, onChange, theme, platforms, compact = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, openUpward: false });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const selected =
    platforms.find((p) => p.value === value) || platforms[0];

  // Estimate menu height so we know whether to flip upward when near
  // the bottom of the viewport.
  const ESTIMATED_MENU_H = Math.min(320, platforms.length * 32 + 8);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openUpward = spaceBelow < ESTIMATED_MENU_H && spaceAbove > spaceBelow;
    setPos({
      top: openUpward ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      openUpward,
    });
  }, [ESTIMATED_MENU_H]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`field w-full ${compact ? 'h-7 px-2 text-xs' : 'h-9 pl-3 pr-2.5 text-sm'} flex items-center justify-between gap-2 rounded-lg border
          ${theme.input} ${theme.text}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <PlatformIcon platform={selected} size={compact ? 12 : 14} />
          <span className="truncate">{selected.label}</span>
          {selected.fee && !compact && (
            <span className={`${theme.subtext} text-xs`}>fee {selected.fee}</span>
          )}
        </span>
        <ChevronDown
          size={compact ? 11 : 14}
          className={`shrink-0 ${theme.subtext} transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: pos.openUpward ? "auto" : pos.top,
              bottom: pos.openUpward ? window.innerHeight - pos.top : "auto",
              left: pos.left,
              width: pos.width,
              zIndex: 100,
            }}
            className={`${theme.panel} border ${theme.panelBorder} rounded-lg shadow-xl max-h-80 overflow-y-auto py-1`}
            role="listbox"
          >
            {platforms.map((p) => {
              const isSelected = p.value === value;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(p.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 h-8 text-[13px]
                    ${isSelected ? theme.text : theme.textSecondary} ${theme.itemHoverBg}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <PlatformIcon platform={p} size={14} />
                    <span className="truncate">{p.label}</span>
                  </span>
                  {p.fee && (
                    <span className={`${theme.subtext} text-xs shrink-0`}>fee {p.fee}</span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

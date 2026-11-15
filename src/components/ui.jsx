// Shared form controls in the site's monochrome look: one height (36px), one
// border, focus marked on the border, selection in theme.navActive. Use these
// instead of native <select> / checkbox so every page reads the same.
import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Label above a control, with an optional hint under it or value on the right.
export function Field({ theme, label, hint, aside, className = "", children }) {
  return (
    <div className={className}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className={`text-xs font-medium ${theme.subtext}`}>{label}</span>
          {aside}
        </div>
      )}
      {children}
      {hint && <p className={`mt-1.5 text-[11px] leading-snug ${theme.subtext}`}>{hint}</p>}
    </div>
  );
}

// Text or number field. `prefix` / `suffix` sit inside the border ("$", "%").
export function Input({ theme, prefix, suffix, mono = false, className = "", disabled = false, type = "text", ...props }) {
  return (
    <div className={`field flex items-center h-9 rounded-lg border ${theme.input} ${disabled ? "opacity-50" : ""} ${className}`}>
      {prefix != null && <span className={`pl-3 -mr-1.5 text-xs select-none ${theme.subtext}`}>{prefix}</span>}
      <input
        type={type}
        disabled={disabled}
        onWheel={type === "number" ? (e) => e.currentTarget.blur() : undefined}
        {...props}
        className={`no-spin flex-1 min-w-0 w-full h-full bg-transparent px-3 text-sm ${mono || type === "number" ? "font-mono" : ""} ${theme.text} placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed`}
      />
      {suffix != null && <span className={`pr-3 -ml-1.5 text-xs select-none ${theme.subtext}`}>{suffix}</span>}
    </div>
  );
}

// Dropdown. options: [{ value, label }]. `compact` is the 32px header size.
export function Select({ theme, value, onChange, options, ariaLabel, compact = false, align = "left", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Arrow keys step through the options without opening the menu.
  const onKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === selected.value);
    const next = options[Math.max(0, Math.min(options.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next.value !== selected.value) onChange(next.value);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`field w-full flex items-center justify-between gap-2 rounded-lg border ${compact ? "h-8 pl-2.5 pr-2 text-xs" : "h-9 pl-3 pr-2.5 text-sm"} ${theme.input} ${theme.text}`}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${theme.subtext} ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute z-50 mt-1 min-w-full max-h-64 overflow-y-auto py-1 rounded-lg border shadow-xl ${align === "right" ? "right-0" : "left-0"} ${theme.panel} ${theme.panelBorder}`}
        >
          {options.map((o) => {
            const on = o.value === selected.value;
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-3 px-3 h-8 text-[13px] whitespace-nowrap ${on ? theme.text : theme.textSecondary} ${theme.itemHoverBg}`}
                >
                  {o.label}
                  {on && <Check size={13} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Two to four choices side by side. options: [{ value, label, icon? }].
export function Segmented({ theme, value, onChange, options, full = false, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`${full ? "flex" : "inline-flex"} rounded-lg border p-0.5 ${theme.cardBorder}`}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`${full ? "flex-1" : ""} flex items-center justify-center gap-1.5 px-3 h-8 rounded-md text-[13px] font-medium ${on ? theme.navActive : `${theme.subtext} ${theme.textHover}`}`}
          >
            {Icon && <Icon size={13} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// On / off row: the whole row is the switch.
export function Switch({ theme, checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange(!checked)}
      className="group w-full flex items-center justify-between gap-3 py-1.5 text-left active:!scale-100"
    >
      <span className="min-w-0">
        <span className={`block text-[13px] ${checked ? theme.text : theme.textSecondary}`}>{label}</span>
        {hint && <span className={`block text-[11px] leading-snug ${theme.subtext}`}>{hint}</span>}
      </span>
      <span
        className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${checked ? "" : "bg-zinc-500/30"}`}
        style={checked ? { backgroundColor: theme.accentColor } : undefined}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform duration-150 ${checked ? `translate-x-3.5 ${theme.bg}` : "bg-zinc-400"}`}
        />
      </span>
    </button>
  );
}

// Toggle pill for picking several of a few options (markets).
export function Chip({ theme, selected, onClick, icon, children }) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      onClick={onClick}
      className={`flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-lg border text-[13px] font-medium ${
        selected ? `${theme.navActive} border-transparent` : `${theme.cardBorder} ${theme.subtext} ${theme.textHover}`
      }`}
    >
      {icon && <img src={icon} alt="" className={`w-3.5 h-3.5 rounded-sm object-contain ${selected ? "" : "opacity-50 grayscale"}`} />}
      {children}
    </button>
  );
}

// Small section title inside a panel or form.
export function SectionTitle({ theme, children, aside }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className={`text-[13px] font-medium ${theme.text}`}>{children}</h3>
      {aside}
    </div>
  );
}

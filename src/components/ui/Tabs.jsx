// Text tab marked by a 2px accent line, like the main nav. Put tabs in a row
// with a bottom border; the line sits on that border.
import React from 'react';

export function TabButton({ label, count, isActive, onClick, theme, accentColor, badgeClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`relative py-2.5 text-sm font-medium transition-colors flex items-center gap-2 group ${
        isActive ? theme.text : `${theme.subtext} ${theme.textHover}`
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[11px] font-semibold font-mono rounded-full px-1.5 py-0.5 leading-none ${badgeClass}`}>
          {count}
        </span>
      )}
      <span
        className={`absolute -bottom-px left-0 h-[2px] w-full rounded-full origin-left transition-transform duration-200 ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
        style={{ backgroundColor: accentColor }}
      />
    </button>
  );
}

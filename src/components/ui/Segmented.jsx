// A row of mutually exclusive choices in one frame: sort order, grid / list,
// deposit / withdrawal. Same heights as Button (sm 32px, md 36px), so it
// lines up with buttons and inputs in a toolbar.
//
// items: [{ key, label, icon, active, onClick, title }]
import React from 'react';
import { useTheme } from '../../themes/ThemeContext';

const SIZES = {
  sm: 'h-[26px] px-2.5 text-xs gap-1',
  md: 'h-[30px] px-3 text-[13px] gap-1.5',
};

export default function Segmented({ items, size = 'sm', block = false, label, className = '' }) {
  const theme = useTheme();
  return (
    <div
      role="group"
      aria-label={label}
      className={`${block ? 'flex w-full' : 'inline-flex'} items-center gap-0.5 p-0.5 rounded-lg border ${theme.cardBorder} ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          title={item.title}
          aria-label={item.label ? undefined : item.title}
          aria-pressed={!!item.active}
          className={`${block ? 'flex-1' : ''} inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors ${SIZES[size] || SIZES.sm} ${
            item.active
              ? `${theme.activeBg} ${theme.text}`
              : `${theme.subtext} ${theme.textHover} ${theme.itemHoverBg}`
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

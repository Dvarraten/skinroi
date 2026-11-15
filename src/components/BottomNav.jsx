// Tab bar at the bottom of the screen on phones: every destination is one
// thumb-tap away and none hide off-screen. Desktop uses the header nav.
import React from "react";
import { NAV_ITEMS } from "./nav";

export default function BottomNav({ theme, activePage, onNavigate, pendingCount = 0 }) {
  return (
    <nav
      aria-label="Main"
      className={`md:hidden shrink-0 grid grid-cols-5 border-t ${theme.panelBorder} ${theme.panel} pb-[env(safe-area-inset-bottom)]`}
    >
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const active = (activePage || null) === key;
        const badge = key === 'handleItems' ? pendingCount : 0;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-1 h-14 min-w-0 px-1 text-[11px] font-medium transition-colors ${
              active ? theme.text : theme.subtext
            }`}
          >
            <span
              className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: theme.accentColor }}
            />
            <span className="relative">
              <Icon size={19} strokeWidth={active ? 2 : 1.75} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-loss text-white text-[10px] font-semibold leading-none tabular-nums">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

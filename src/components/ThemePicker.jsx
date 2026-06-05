// Palette button + dropdown for switching between visual themes. Receives
// the theme list and current selection from App via props.
import React from "react";
import { Palette } from "lucide-react";

export default function ThemePicker({
  themeStyles,
  setShowThemePicker,
  showThemePicker,
  setTheme,
  theme,
  themes,
  dropUp = false,
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowThemePicker((p) => !p)}
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all"
        title="Change theme"
      >
        <Palette size={18} />
      </button>

      {showThemePicker && (
        <div
          className={`absolute right-0 ${dropUp ? 'bottom-full mb-2' : 'mt-2'} w-52 ${themeStyles.panel} border ${themeStyles.panelBorder} rounded-xl shadow-2xl z-50 overflow-hidden`}
        >
          <div
            className={`px-3 py-2 text-xs font-semibold uppercase tracking-widest ${themeStyles.subtext} border-b ${themeStyles.panelBorder}`}
          >
            Choose Theme
          </div>
          {Object.entries(themes).map(([key, th]) => (
            <button
              key={key}
              onClick={() => {
                setTheme(key);
                setShowThemePicker(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${
                theme === key
                  ? `${themeStyles.text} bg-white/10`
                  : `${themeStyles.subtext} ${themeStyles.textHover} hover:bg-white/5`
              }`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ backgroundColor: th.dotColor }} />
              <span>{th.name}</span>
              {theme === key && (
                <svg
                  className={`w-4 h-4 ml-auto ${themeStyles.subtext}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

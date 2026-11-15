// Row of theme swatches for the account menu. The selected theme gets a
// ring; its name is spelled out next to the label.
import React from "react";

export default function ThemePicker({ themeStyles, themes, theme, setTheme }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <p className={`text-[13px] ${themeStyles.textSecondary}`}>
        Theme <span className={themeStyles.subtext}>· {themes[theme]?.name}</span>
      </p>
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Theme">
        {Object.entries(themes).map(([key, th]) => {
          const selected = theme === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={th.name}
              title={th.name}
              onClick={() => setTheme(key)}
              className="h-5 w-5 rounded-full border border-white/25"
              style={{
                backgroundColor: th.dotColor,
                outline: selected ? `2px solid ${themeStyles.accentColor}` : 'none',
                outlineOffset: 2,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

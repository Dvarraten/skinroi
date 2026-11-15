// Title row at the top of every page: title, an optional one-line hint and
// right-hand controls (children).
import React from "react";

export default function PageHeader({ theme, title, hint, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-6">
      <div className="min-w-0">
        <h1 className={`text-xl font-semibold tracking-tight ${theme.text}`}>{title}</h1>
        {hint && <p className={`mt-1 text-[13px] ${theme.subtext}`}>{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

// Shared page frame: scrolls, centres the content and sets the gutters.
export function Page({ children, width = "max-w-[1320px]" }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
      <div className={`${width} mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-10`}>{children}</div>
    </div>
  );
}

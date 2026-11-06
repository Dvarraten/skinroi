// Slim bar under the header while a logged-out visitor tries the demo.
import React from "react";
import steamLogo from "../assets/platforms/steam.png";

export default function DemoBanner({ theme, onLogin, onExit }) {
  return (
    <div className="px-4 pt-2 shrink-0">
      <div className={`px-4 md:px-5 py-2 rounded-xl border ${theme.panelBorder} ${theme.panel} flex flex-wrap items-center gap-x-4 gap-y-2 text-xs`}>
        <span className="font-mono text-warn">Demo</span>
        <span className={theme.textSecondary}>
          This is an example portfolio. Changes you make here are not saved, and Snipes are delayed by 15 minutes.
        </span>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={onExit} className={`${theme.subtext} ${theme.textHover} transition-colors`}>
            Exit demo
          </button>
          <button
            onClick={onLogin}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-medium transition-colors ${theme.cardBorder} ${theme.text} hover:bg-white/5 active:scale-[0.97]`}
          >
            <img src={steamLogo} alt="" className="h-3.5 w-3.5" /> Sign in with Steam
          </button>
        </div>
      </div>
    </div>
  );
}

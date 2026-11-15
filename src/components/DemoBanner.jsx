// Slim strip above the page while a logged-out visitor tries the demo.
import React from "react";
import steamLogo from "../assets/platforms/steam.png";

export default function DemoBanner({ theme, onLogin, onExit }) {
  return (
    <div className={`shrink-0 px-4 md:px-8 py-2 border-b flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ${theme.panelBorder}`}>
      <span className="font-mono text-warn">Demo</span>
      <span className={theme.subtext}>
        Example portfolio. Nothing you change is saved, and Snipes are 15 minutes behind.
      </span>
      <div className="ml-auto flex items-center gap-4">
        <button onClick={onExit} className={`${theme.subtext} ${theme.textHover} transition-colors`}>
          Exit demo
        </button>
        <button
          onClick={onLogin}
          className={`flex items-center gap-1.5 font-medium transition-colors ${theme.text} hover:opacity-80`}
        >
          <img src={steamLogo} alt="" className={`h-3.5 w-3.5 ${theme.iconOnSurface}`} /> Sign in with Steam
        </button>
      </div>
    </div>
  );
}

// Slim bar under the header while a logged-out visitor tries the demo.
import React from "react";
import steamLogo from "../assets/platforms/steam.png";
import { Button } from "./ui/Button";

export default function DemoBanner({ theme, onLogin, onExit }) {
  return (
    <div className="px-3 md:px-4 pt-2 shrink-0">
      <div className={`pl-4 pr-2 md:pl-5 py-1.5 rounded-xl border ${theme.panelBorder} ${theme.panel} flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]`}>
        <span className="text-xs font-semibold text-warn">Demo</span>
        <span className={`flex-1 min-w-[200px] ${theme.textSecondary}`}>
          This is an example portfolio. Changes you make here are not saved, and Snipes are delayed by 15 minutes.
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onExit}>Exit demo</Button>
          <Button size="sm" onClick={onLogin} icon={<img src={steamLogo} alt="" className="h-3.5 w-3.5" />}>
            Sign in with Steam
          </Button>
        </div>
      </div>
    </div>
  );
}

// Bottom-right chip shown while the signed-in portfolio couldn't be saved
// (network down, server or Redis error). useItems keeps retrying on its own;
// "Retry" sends it right away. Sits above the phone's bottom tab bar.
import React from "react";
import { CloudOff } from "lucide-react";
import { LOSS_COLOR } from "../themes/themes";

export default function SaveStatusChip({ theme, status, onRetry }) {
  if (status !== "failed") return null;
  return (
    <div
      role="status"
      className={`fixed z-50 right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 flex items-center gap-2.5 pl-3 pr-1.5 h-9 rounded-full border shadow-lg text-[13px] ${theme.card} ${theme.cardBorder}`}
    >
      <CloudOff size={14} style={{ color: LOSS_COLOR }} />
      <span className={theme.text}>Not saved</span>
      <span className={`hidden sm:inline ${theme.subtext}`}>Retrying…</span>
      <button
        onClick={onRetry}
        className={`h-6 px-2.5 rounded-full text-xs font-medium transition-colors ${theme.primary}`}
      >
        Retry
      </button>
    </div>
  );
}

// Bottom-right chip about saving the signed-in portfolio:
//   failed   — the save didn't go through (network down, server or Redis
//              error). useItems keeps retrying on its own; Retry sends now.
//   conflict — another tab saved first, so this tab loaded that list and its
//              own last change was dropped.
// Sits above the phone's bottom tab bar.
import React from "react";
import { CloudOff, RefreshCw, X } from "lucide-react";
import { LOSS_COLOR, WARN_COLOR } from "../themes/themes";

const box = "fixed z-50 right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 flex items-center gap-2.5 pl-3 pr-1.5 h-9 rounded-full border shadow-lg text-[13px]";

export default function SaveStatusChip({ theme, status, onRetry, onDismiss }) {
  if (status === "conflict") {
    return (
      <div role="status" className={`${box} ${theme.card} ${theme.cardBorder}`}>
        <RefreshCw size={14} style={{ color: WARN_COLOR }} />
        <span className={theme.text}>Changed in another tab</span>
        <span className={`hidden sm:inline ${theme.subtext}`}>Loaded it; your last change here wasn't saved</span>
        <button onClick={onDismiss} aria-label="Dismiss" className={`h-6 w-6 inline-flex items-center justify-center rounded-full ${theme.subtext} ${theme.itemHoverBg}`}>
          <X size={13} />
        </button>
      </div>
    );
  }
  if (status !== "failed") return null;
  return (
    <div role="status" className={`${box} ${theme.card} ${theme.cardBorder}`}>
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

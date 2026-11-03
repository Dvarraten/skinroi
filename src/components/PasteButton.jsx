// Icon button that reads the clipboard and forwards the trimmed text to the
// parent via onPaste. Shows a brief checkmark animation on success.
import React, { useState } from "react";
import { CheckCircle, ClipboardPaste } from "lucide-react";

export default function PasteButton({ onPaste }) {
  const [pasted, setPasted] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onPaste(text.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch (e) {}
  };

  return (
    <button
      type="button"
      onClick={handlePaste}
      title="Paste from clipboard"
      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition
        ${pasted
          ? "text-emerald-400 bg-emerald-400/10"
          : "text-slate-500 hover:text-slate-300 hover:bg-white/8"}`}
    >
      {pasted ? <CheckCircle size={13} /> : <ClipboardPaste size={13} />}
    </button>
  );
}

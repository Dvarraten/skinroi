// "Get started" checklist on Home for signed-in users who haven't finished
// setting up: 1) install the extension, 2) pair it, 3) add a first item.
// Each step gets a check when done. Install can't be detected until the
// extension pairs, so the user can also tick it by hand. Hidden for good once
// every step is done or the user closes it (per Steam account).
import React, { useEffect, useState } from "react";
import { Check, X, Puzzle, Link2, PackagePlus, Download } from "lucide-react";
import ExtensionPairPanel from "./ExtensionPairPanel";
import { Button, IconButton } from "./ui/Button";
import { PROFIT_COLOR } from "../themes/themes";

// Chrome Web Store link once the extension is published. Until then the
// install step explains how to load it unpacked.
const EXTENSION_URL = process.env.REACT_APP_EXTENSION_URL || "";

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key) => { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } };

export default function OnboardingChecklist({ theme, steamId, extension, items, onExtensionChange, onImportSteam, onAddManually }) {
  const doneKey = `skinroi-onboarding-done-${steamId}`;
  const installedKey = `skinroi-onboarding-installed-${steamId}`;
  const [hidden, setHidden] = useState(() => !!read(doneKey));
  const [installedTicked, setInstalledTicked] = useState(() => !!read(installedKey));
  const [open, setOpen] = useState(null); // 'install' | 'pair' | null

  const paired = !!extension?.connected;
  const steps = {
    install: paired || installedTicked,
    pair: paired,
    item: items.some((i) => !i.isTransaction),
  };
  const allDone = steps.install && steps.pair && steps.item;

  useEffect(() => {
    if (allDone) { write(doneKey); setHidden(true); }
  }, [allDone, doneKey]);

  if (hidden || allDone) return null;

  const close = () => { write(doneKey); setHidden(true); };
  const doneCount = Object.values(steps).filter(Boolean).length;
  // The first step that is still open gets the primary button.
  const current = ["install", "pair", "item"].find((k) => !steps[k]);

  const Step = ({ n, done, icon: Icon, title, text, children }) => (
    <li className={`flex-1 min-w-[200px] flex items-start gap-3 rounded-xl border px-3 py-2.5 ${theme.cardBorder} ${done ? "opacity-60" : ""}`}>
      <span
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center border text-[11px] font-mono ${done ? "border-transparent text-black" : `${theme.cardBorder} ${theme.subtext}`}`}
        style={done ? { backgroundColor: PROFIT_COLOR } : undefined}
        aria-label={done ? "Done" : `Step ${n}`}
      >
        {done ? <Check size={12} strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium flex items-center gap-1.5 ${theme.text} ${done ? "line-through decoration-1" : ""}`}>
          <Icon size={13} className={theme.subtext} /> {title}
        </p>
        <p className={`text-xs mt-0.5 ${theme.subtext}`}>{text}</p>
        {!done && children && <div className="flex flex-wrap gap-1.5 mt-2">{children}</div>}
      </div>
    </li>
  );

  return (
    <section className={`${theme.panel} border ${theme.panelBorder} rounded-2xl px-4 py-3`} aria-label="Get started">
      <div className="flex items-center gap-2 mb-2.5">
        <h2 className={`text-sm font-semibold ${theme.text}`}>Get started</h2>
        <span className={`text-xs font-mono ${theme.subtext}`}>{doneCount}/3</span>
        <IconButton size="xs" label="Hide checklist" className="ml-auto" onClick={close}>
          <X size={14} />
        </IconButton>
      </div>
      <ol className="flex flex-wrap gap-2">
        <Step n={1} done={steps.install} icon={Puzzle} title="Install the extension" text="SkinROI Sync for Chrome or Edge picks up your Steam trades by itself.">
          {EXTENSION_URL ? (
            <Button as="a" size="xs" variant={current === "install" ? "primary" : "secondary"} href={EXTENSION_URL} target="_blank" rel="noreferrer" icon={<Download size={12} />}>
              Get it for Chrome
            </Button>
          ) : (
            <Button size="xs" variant={current === "install" ? "primary" : "secondary"} onClick={() => setOpen(open === "install" ? null : "install")}>
              How to install
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => { write(installedKey); setInstalledTicked(true); setOpen(open === "install" ? null : open); }}
          >
            I've installed it
          </Button>
        </Step>
        <Step n={2} done={steps.pair} icon={Link2} title="Pair it with your account" text="Generate a code here and paste it into the extension popup.">
          <Button size="xs" variant={current === "pair" ? "primary" : "secondary"} onClick={() => setOpen(open === "pair" ? null : "pair")}>
            {open === "pair" ? "Hide" : "Pair now"}
          </Button>
        </Step>
        <Step n={3} done={steps.item} icon={PackagePlus} title="Add your first item" text="Import your whole Steam inventory at once, or add one by hand.">
          <Button size="xs" variant={current === "item" ? "primary" : "secondary"} onClick={onImportSteam}>Import from Steam</Button>
          <Button size="xs" variant="ghost" onClick={onAddManually}>Add manually</Button>
        </Step>
      </ol>

      {open === "install" && !steps.install && (
        <ol className={`mt-3 text-xs space-y-1 list-decimal pl-5 ${theme.textSecondary}`}>
          <li>Download the <span className="font-mono">extension</span> folder of SkinROI.</li>
          <li>Open <span className="font-mono">chrome://extensions</span> and turn on Developer mode.</li>
          <li>Click Load unpacked and pick the folder. Then pin SkinROI Sync to the toolbar.</li>
        </ol>
      )}
      {open === "pair" && !steps.pair && (
        <div className="mt-3 max-w-md">
          <ExtensionPairPanel theme={theme} extension={extension} onChange={onExtensionChange} />
        </div>
      )}
    </section>
  );
}

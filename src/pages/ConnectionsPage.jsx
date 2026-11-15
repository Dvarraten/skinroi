// Connections: link marketplace accounts with their API keys so trades come
// in with prices. Opened from the account menu. Keys go to the server once,
// are checked against the marketplace, stored encrypted and never shown again.
import React, { useState } from "react";
import { ShieldCheck, ChevronDown, ExternalLink, Check, AlertTriangle, LogIn } from "lucide-react";
import PageHeader, { Page } from "../components/PageHeader";
import useConnections from "../hooks/useConnections";
import { CONNECTION_PROVIDERS } from "../utils/connections";
import { PROFIT_COLOR, WARN_COLOR } from "../themes/themes";

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Logo({ theme, provider }) {
  if (provider.icon) {
    return <img src={provider.icon} alt="" className="w-9 h-9 rounded-lg object-contain shrink-0" />;
  }
  return (
    <span className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border text-sm font-semibold ${theme.card} ${theme.cardBorder} ${theme.textSecondary}`}>
      {provider.name[0]}
    </span>
  );
}

// One status word with a dot. Colour only means something: green works,
// amber needs the user.
function Status({ theme, state }) {
  if (state === "soon") return <span className={`text-[12px] shrink-0 whitespace-nowrap ${theme.subtext}`}>Coming soon</span>;
  if (state === "off") return <span className={`text-[12px] shrink-0 whitespace-nowrap ${theme.subtext}`}>Not connected</span>;
  const ok = state === "ok";
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 text-[12px] ${theme.textSecondary}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ok ? PROFIT_COLOR : WARN_COLOR }} />
      {ok ? "Connected" : "Needs attention"}
    </span>
  );
}

// A step screenshot; hidden until the file exists in public/connections/.
function StepImage({ theme, src }) {
  const [missing, setMissing] = useState(false);
  if (!src || missing) return null;
  return (
    <img
      src={`${process.env.PUBLIC_URL || ""}/connections/${src}`}
      alt=""
      loading="lazy"
      onError={() => setMissing(true)}
      className={`mt-2 w-full max-w-md rounded-lg border ${theme.cardBorder}`}
    />
  );
}

function ConnectForm({ theme, provider, onConnect, submitLabel = "Connect" }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConnect(provider.id, values);
      setValues({});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ready = provider.fields.every((f) => (values[f.name] || "").trim());
  return (
    <form onSubmit={submit} className="space-y-3">
      {provider.fields.map((f) => (
        <label key={f.name} className="block">
          <span className={`block text-[12px] mb-1 ${theme.subtext}`}>{f.label}</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={values[f.name] || ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            placeholder={f.placeholder}
            className={`h-9 w-full ${theme.input} border rounded-lg px-3 text-[13px] font-mono ${theme.text} placeholder-zinc-500 focus:outline-none`}
          />
        </label>
      ))}
      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-loss">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!ready || busy}
        className={`h-9 px-4 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 ${theme.primary}`}
      >
        {busy ? "Checking key…" : submitLabel}
      </button>
    </form>
  );
}

function Steps({ theme, provider }) {
  return (
    <ol className="space-y-4">
      {provider.steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[11px] font-medium tabular-nums ${theme.cardBorder} ${theme.subtext}`}>
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] leading-5 ${theme.textSecondary}`}>
              {step.text}
              {i === 0 && provider.keyUrl && (
                <a
                  href={provider.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`ml-1.5 inline-flex items-center gap-1 underline underline-offset-2 ${theme.subtext} ${theme.textHover}`}
                >
                  Open {provider.name} <ExternalLink size={11} />
                </a>
              )}
            </p>
            <StepImage theme={theme} src={step.image} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ConnectedDetails({ theme, provider, status, onConnect, onDisconnect }) {
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDisconnect(provider.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const facts = status.viaServer
    ? [["Key", "Set on the server"]]
    : [
        ["Key", status.hint || "Saved", true],
        ["Added", formatDate(status.addedAt)],
      ];

  return (
    <div className="space-y-4">
      {status.status === "error" && status.lastError && (
        <p className="flex items-start gap-1.5 text-[12px] text-warn">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {status.lastError}
        </p>
      )}
      <dl className="grid grid-cols-[88px_1fr] gap-y-1.5 text-[13px]">
        {facts.map(([k, v, mono]) => (
          <React.Fragment key={k}>
            <dt className={theme.subtext}>{k}</dt>
            <dd className={`${theme.textSecondary} ${mono ? "font-mono" : ""}`}>{v}</dd>
          </React.Fragment>
        ))}
        <dt className={theme.subtext}>Imports</dt>
        <dd className={theme.textSecondary}>{provider.imports}</dd>
      </dl>

      {replacing ? (
        <div className={`pt-4 border-t ${theme.cardBorder}`}>
          <ConnectForm
            theme={theme}
            provider={provider}
            submitLabel="Save new key"
            onConnect={async (...args) => { await onConnect(...args); setReplacing(false); }}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReplacing(true)}
            className={`h-8 px-3 rounded-lg border text-[12px] font-medium transition-colors ${theme.cardBorder} ${theme.textSecondary} ${theme.itemHoverBg}`}
          >
            {status.viaServer ? "Use my own key" : "Replace key"}
          </button>
          {!status.viaServer && (confirming ? (
            <>
              <span className={`text-[12px] ${theme.subtext}`}>Remove the key from SkinROI?</span>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="h-8 px-3 rounded-lg text-[12px] font-medium text-loss border border-loss/40 hover:bg-loss/10 transition-colors disabled:opacity-40"
              >
                {busy ? "Removing…" : "Remove"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={`h-8 px-2 text-[12px] ${theme.subtext} ${theme.textHover}`}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`h-8 px-3 text-[12px] ${theme.subtext} hover:text-loss transition-colors`}
            >
              Disconnect
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[12px] text-loss">{error}</p>}
      {!status.viaServer && (
        <p className={`text-[11px] ${theme.subtext}`}>
          Disconnecting deletes the key here. To revoke it completely, also delete it on {provider.name}.
        </p>
      )}
    </div>
  );
}

function ProviderRow({ theme, provider, status, open, onToggle, onConnect, onDisconnect }) {
  const state = !provider.available
    ? "soon"
    : !status?.connected
      ? "off"
      : status.status === "error" ? "error" : "ok";
  const expandable = provider.available && status;

  return (
    <li className={`border-t first:border-t-0 ${theme.cardBorder} ${provider.available ? "" : "opacity-60"}`}>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${expandable ? theme.itemHoverBg : "cursor-default"}`}
      >
        <Logo theme={theme} provider={provider} />
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-medium ${theme.text}`}>{provider.name}</p>
          <p className={`text-[12px] truncate ${theme.subtext}`}>{provider.imports}</p>
        </div>
        <Status theme={theme} state={state} />
        {expandable && (
          <ChevronDown size={16} className={`shrink-0 transition-transform ${theme.subtext} ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {expandable && open && (
        <div className="px-4 pb-5 pt-1 sm:pl-16">
          {status.connected ? (
            <ConnectedDetails theme={theme} provider={provider} status={status} onConnect={onConnect} onDisconnect={onDisconnect} />
          ) : (
            <div className="space-y-5">
              <Steps theme={theme} provider={provider} />
              <ConnectForm theme={theme} provider={provider} onConnect={onConnect} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function ConnectionsPage({ theme, signedIn, onLogin }) {
  const { connections, loadError, connect, disconnect } = useConnections(signedIn);
  const [openId, setOpenId] = useState(null);

  const connectedCount = connections
    ? CONNECTION_PROVIDERS.filter((p) => connections[p.id]?.connected).length
    : 0;

  return (
    <Page width="max-w-[880px]">
      <PageHeader
        theme={theme}
        title="Connections"
        hint="Link your marketplace accounts so trades come in with the price you paid or got."
      >
        {connections && (
          <span className={`text-[12px] tabular-nums ${theme.subtext}`}>
            {connectedCount} connected
          </span>
        )}
      </PageHeader>

      {!signedIn ? (
        <div className={`rounded-xl border border-dashed px-6 py-10 text-center ${theme.cardBorder}`}>
          <p className={`text-[14px] ${theme.text}`}>Sign in to connect your marketplaces</p>
          <p className={`mt-1 text-[13px] ${theme.subtext}`}>Keys are tied to your Steam account.</p>
          <button
            type="button"
            onClick={onLogin}
            className={`mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-medium ${theme.primary}`}
          >
            <LogIn size={14} /> Sign in with Steam
          </button>
        </div>
      ) : (
        <>
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 mb-4 ${theme.card} ${theme.cardBorder}`}>
            <ShieldCheck size={16} className={`shrink-0 mt-0.5 ${theme.subtext}`} />
            <p className={`text-[12px] leading-5 ${theme.subtext}`}>
              Keys are checked with the marketplace, then stored encrypted on our server and never shown again.
              SkinROI only reads your history. Where a site lets you limit what a key can do, give it read access only.
            </p>
          </div>

          {loadError && (
            <p className="mb-4 flex items-center gap-1.5 text-[12px] text-loss">
              <AlertTriangle size={13} /> Could not load your connections: {loadError}
            </p>
          )}

          <ul className={`rounded-xl border overflow-hidden ${theme.card} ${theme.cardBorder}`}>
            {CONNECTION_PROVIDERS.map((p) => (
              <ProviderRow
                key={p.id}
                theme={theme}
                provider={p}
                status={connections ? connections[p.id] || { connected: false } : null}
                open={openId === p.id}
                onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))}
                onConnect={connect}
                onDisconnect={disconnect}
              />
            ))}
          </ul>

          <p className={`mt-4 flex items-center gap-1.5 text-[12px] ${theme.subtext}`}>
            <Check size={13} /> Trades from linked sites still show up under Trades first; only exact matches are filled in for you.
          </p>
        </>
      )}
    </Page>
  );
}

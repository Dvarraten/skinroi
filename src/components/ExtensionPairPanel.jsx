// Pairing / status panel for the SkinROI browser extension.
//
// Three visual states:
//   1. Not connected — Chrome Web Store link + "Generate pairing code" button
//   2. Awaiting claim — shows the code, polls every 2s until the extension pairs
//   3. Connected — shows extension version + "last seen" + Disconnect
//
// The extension itself claims the code via POST /api/extension/claim. The
// polling here just watches for the claim so the UI updates automatically.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, RefreshCw, X, Puzzle } from 'lucide-react';

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || '';

function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ExtensionPairPanel({ theme = {}, extension = null, onChange }) {
  const [phase, setPhase] = useState('idle');   // idle | requesting | waiting | disconnecting | error
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const pollRef = useRef(null);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => clearPoll(), []);

  // Extension became connected externally (e.g. state refresh sees it) —
  // cancel the code we were waiting on.
  useEffect(() => {
    if (extension?.connected && phase === 'waiting') {
      clearPoll();
      setPhase('idle');
      setCode(null);
      setExpiresAt(null);
    }
  }, [extension?.connected, phase]);

  const generate = useCallback(async () => {
    setPhase('requesting');
    setErrorMsg(null);
    try {
      const res = await fetch(`${BASE}/api/extension/pair`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCode(data.code);
      setExpiresAt(data.expiresAt);
      setPhase('waiting');

      // Poll for claim every 2s. Server-side code is TTL-scoped so we don't
      // have to worry about polling forever — after 10 min the code 404s.
      clearPoll();
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${BASE}/api/extension/pair?code=${encodeURIComponent(data.code)}`);
          if (!r.ok) return;
          const d = await r.json();
          if (d.pending?.claimed || d.connected?.lastSeen) {
            clearPoll();
            setPhase('idle');
            setCode(null);
            if (onChange) onChange();
          }
        } catch { /* transient */ }
      }, 2000);
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.message || 'Failed to generate code');
    }
  }, [onChange]);

  const cancel = useCallback(() => {
    clearPoll();
    setPhase('idle');
    setCode(null);
    setExpiresAt(null);
    setErrorMsg(null);
  }, []);

  const disconnect = useCallback(async () => {
    if (!window.confirm('Disconnect the extension? Trade sync will stop until you pair again.')) return;
    setPhase('disconnecting');
    try {
      await fetch(`${BASE}/api/extension/pair`, { method: 'DELETE' });
      if (onChange) onChange();
    } catch (err) {
      setErrorMsg(err.message || 'Disconnect failed');
    } finally {
      setPhase('idle');
    }
  }, [onChange]);

  const card = theme.card || 'bg-slate-800/60';
  const border = theme.cardBorder || 'border-slate-700/50';
  const sub = theme.subtext || 'text-slate-400';
  const text = theme.text || 'text-white';
  const accent = theme.accentBg || 'bg-indigo-600 hover:bg-indigo-500';

  if (extension?.connected) {
    return (
      <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl ${card} border ${border}`}>
        <div className="flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Extension connected</p>
            <p className={`text-xs mt-0.5 ${sub}`}>
              {extension.extVersion ? `v${extension.extVersion} · ` : ''}
              last push {timeAgo(extension.lastSeen)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={disconnect}
          disabled={phase === 'disconnecting'}
          className={`text-xs ${sub} hover:text-red-400 transition-colors shrink-0 disabled:opacity-40`}
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (phase === 'waiting' && code) {
    const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : null;
    return (
      <div className={`flex flex-col gap-3 px-4 py-4 rounded-xl ${card} border ${border}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${text}`}>Waiting for extension…</p>
            <p className={`text-xs mt-0.5 ${sub}`}>
              Click the SkinROI Sync icon in your browser toolbar and paste the code below.
            </p>
          </div>
          <button type="button" onClick={cancel} className={`${sub} hover:text-red-400`}>
            <X size={16} />
          </button>
        </div>
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg bg-black/30 border ${border}`}>
          <code className={`font-mono text-2xl tracking-widest ${text}`}>{code}</code>
          <RefreshCw size={16} className="text-indigo-400 animate-spin" />
        </div>
        {secondsLeft !== null && (
          <p className={`text-[11px] ${sub} text-center`}>
            Code expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 px-4 py-4 rounded-xl ${card} border ${border}`}>
      <div className="flex items-start gap-2">
        <Puzzle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className={`text-sm font-semibold ${text}`}>Connect the SkinROI Sync extension</p>
          <p className={`text-xs mt-0.5 ${sub}`}>
            Real-time trade detection with no polling — install once, then pair below.
          </p>
        </div>
      </div>
      <ol className={`text-xs ${sub} space-y-1 list-none`}>
        <li className="flex items-start gap-2">
          <span className="font-bold shrink-0">1.</span>
          <span>Install the SkinROI Sync extension in Chrome or Edge.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-bold shrink-0">2.</span>
          <span>Click "Generate pairing code" and paste it into the extension popup.</span>
        </li>
      </ol>
      <button
        type="button"
        onClick={generate}
        disabled={phase === 'requesting'}
        className={`${accent} text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40`}
      >
        {phase === 'requesting' ? 'Generating…' : 'Generate pairing code'}
      </button>
      {phase === 'error' && errorMsg && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}

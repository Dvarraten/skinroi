// Modal for connecting Steam via username/password. Handles three guard flows:
// DeviceConfirmation (4) = approve in app (polls), DeviceCode (3) = TOTP,
// EmailCode (2) = email code.
import React, { useState, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Shield, Loader } from 'lucide-react';

const BASE = process.env.REACT_APP_STEAM_SYNC_URL || '';

export default function SteamLoginModal({ onClose, onSuccess, theme }) {
  const [step, setStep] = useState('credentials'); // credentials | approval | guard | done
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionKey, setSessionKey] = useState(null);
  const [, setGuardType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const panel       = theme?.panel       || 'bg-[#111827]';
  const panelBorder = theme?.panelBorder || 'border-white/10';
  const inputClass  = `w-full h-9 ${theme?.input || 'bg-slate-800 border-slate-600'} rounded-lg px-3 ${theme?.text || 'text-white'} text-sm focus:outline-none border`;
  const sub         = theme?.subtext     || 'text-slate-400';

  // Poll for app-approval completion
  useEffect(() => {
    if (step !== 'approval' || !sessionKey) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/steam-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll', sessionKey }),
        });
        const data = await res.json();
        if (data.authenticated) {
          clearInterval(pollRef.current);
          handleSuccess();
        }
        if (!res.ok) {
          clearInterval(pollRef.current);
          setError(data.error || 'Session expired');
          setStep('credentials');
        }
      } catch {}
    }, 2500);
    return () => clearInterval(pollRef.current);
  }, [step, sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuccess = () => {
    setStep('done');
    onSuccess?.();
    setTimeout(() => onClose?.(), 2000);
  };

  const submitCredentials = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/steam-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (!data.needsGuard) {
        handleSuccess();
      } else {
        setSessionKey(data.sessionKey);
        setGuardType(data.guardType);
        setStep('approval');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const btnClass = (active) =>
    `relative group flex-1 flex items-center justify-center h-9 rounded-lg text-sm font-medium border transition
    ${theme?.card} ${theme?.cardBorder} ${active ? theme?.text : theme?.subtext}
    disabled:opacity-40`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`relative w-full max-w-sm ${panel} border ${panelBorder} rounded-2xl shadow-2xl overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${panelBorder}`}>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber-400" />
            <h3 className={`font-semibold text-sm ${theme?.text || 'text-white'}`}>Connect Steam Account</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle size={32} className="text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">Connected successfully</p>
              <p className={`text-xs ${sub} text-center`}>Trade-protected items will now appear automatically.</p>
            </div>
          )}

          {/* ── App approval (DeviceConfirmation) ── */}
          {step === 'approval' && (
            <>
              <div className={`text-xs ${sub} space-y-1.5`}>
                <p className="font-medium">Approve the login in your Steam app:</p>
                <ol className="space-y-1 list-none">
                  <li className="flex items-center gap-2"><span className="text-amber-400 font-bold shrink-0">1.</span> Open Steam Mobile App</li>
                  <li className="flex items-center gap-2"><span className="text-amber-400 font-bold shrink-0">2.</span> Click <span className="font-medium">Approve</span></li>
                  <li className="flex items-center gap-2"><span className="text-amber-400 font-bold shrink-0">3.</span> Choose <span className="font-medium">Steam Mobile App (iOS, Android, etc)</span></li>
                  <li className="flex items-center gap-2"><span className="text-amber-400 font-bold shrink-0">4.</span> Choose <span className="font-medium">Ashburn, VA, US</span></li>
                  <li className="flex items-center gap-2"><span className="text-amber-400 font-bold shrink-0">5.</span> Choose <span className="font-medium">Other</span></li>
                </ol>
              </div>
              <div className="flex items-center justify-center gap-2 py-3">
                <Loader size={16} className={`animate-spin ${theme?.accent || 'text-blue-400'}`} />
                <span className={`text-xs ${sub}`}>Waiting for approval…</span>
              </div>
              {error && <div className="flex items-center gap-2 text-xs text-red-400"><AlertTriangle size={12} /> {error}</div>}
              <button
                onClick={() => { clearInterval(pollRef.current); setStep('credentials'); setError(null); }}
                className={`${btnClass(false)} w-full`}
              >
                Cancel
                <span className={`absolute bottom-0 left-0 h-[2px] w-full origin-left rounded-full transition-transform duration-200 scale-x-0 group-hover:scale-x-100 ${theme?.dot}`} />
              </button>
            </>
          )}

          {/* ── Credentials ── */}
          {step === 'credentials' && (
            <>
              <p className={`text-xs ${sub}`}>
                Enter your Steam credentials to enable automatic detection of trade-protected items.
              </p>
              <div className="space-y-2">
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Steam username" autoComplete="username" className={inputClass}
                  onKeyDown={e => e.key === 'Enter' && submitCredentials()} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password" autoComplete="current-password" className={inputClass}
                  onKeyDown={e => e.key === 'Enter' && submitCredentials()} />
              </div>
              {error && <div className="flex items-center gap-2 text-xs text-red-400"><AlertTriangle size={12} /> {error}</div>}
              <button
                onClick={submitCredentials}
                disabled={loading || !username.trim() || !password.trim()}
                className={`${btnClass(true)} w-full`}
              >
                {loading ? 'Connecting…' : 'Connect'}
                <span className={`absolute bottom-0 left-0 h-[2px] w-full origin-left rounded-full transition-transform duration-200 ${loading ? 'scale-x-100 bg-profit' : `scale-x-0 group-hover:scale-x-100 ${theme?.dot}`}`} />
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

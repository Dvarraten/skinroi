import React, { useState } from "react";
import { X, ArrowDownUp, CheckCircle } from "lucide-react";
import PlatformPicker from "./PlatformPicker";
import { PLATFORMS } from "../utils/platforms";

const TX_PLATFORMS = PLATFORMS.filter(p => p.value !== 'other');

const labelCls = "block text-xs text-slate-500 font-medium uppercase tracking-wide mb-1.5";

export default function TransactionModal({ onClose, onAdd, theme }) {
  const [type, setType] = useState('withdrawal');
  const [platform, setPlatform] = useState('csfloat');
  const [amount, setAmount] = useState('');
  const [feePercent, setFeePercent] = useState('1');
  const [success, setSuccess] = useState(false);

  const amt = parseFloat(amount) || 0;
  const feePct = parseFloat(feePercent) || 0;
  const feeAmt = amt * feePct / 100;

  const handleSubmit = () => {
    if (!amt || amt <= 0) return;
    onAdd({ type, platform, amount: amt, feePercent: feePct });
    setAmount('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const inputCls = `w-full h-9 ${theme.input} rounded-lg px-3 text-sm font-mono ${theme.text} focus:outline-none border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={e => { e.currentTarget.dataset.closeIntent = e.target === e.currentTarget ? '1' : '0'; }}
      onClick={e => { if (e.currentTarget.dataset.closeIntent === '1') onClose(); }}
    >
      <div className={`relative w-full max-w-sm ${theme.panel} border ${theme.panelBorder} rounded-2xl shadow-2xl overflow-hidden`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.panelBorder}`}>
          <div className="flex items-center gap-2">
            <ArrowDownUp size={15} className="text-slate-400" />
            <h2 className={`font-semibold ${theme.text}`}>Deposits / Withdrawals</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Type toggle */}
          <div>
            <label className={labelCls}>Type</label>
            <div className={`flex rounded-lg border ${theme.cardBorder} overflow-hidden`}>
              {[
                { value: 'withdrawal', label: 'Withdrawal' },
                { value: 'deposit',    label: 'Deposit'    },
              ].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex-1 h-9 text-sm font-medium transition-colors ${
                    type === t.value
                      ? `${theme.card} ${theme.text}`
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className={labelCls}>Platform</label>
            <PlatformPicker
              value={platform}
              onChange={setPlatform}
              theme={theme}
              platforms={TX_PLATFORMS}
            />
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono pointer-events-none">$</span>
              <input
                type="number" min="0" step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>

          {/* Fee % */}
          <div>
            <label className={labelCls}>Fee</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="100" step="0.01"
                value={feePercent}
                onChange={e => setFeePercent(e.target.value)}
                className={inputCls}
              />
              <span className={`text-sm ${theme.subtext} shrink-0`}>%</span>
            </div>
          </div>

          {/* Fee preview */}
          {amt > 0 && (
            <div className="rounded-lg px-3 py-2 bg-loss/8 border border-loss/20 flex items-center justify-between">
              <span className={`text-xs ${theme.subtext}`}>Fee deducted</span>
              <span className="text-sm font-mono font-semibold text-loss">
                −${feeAmt.toFixed(2)}
                <span className="text-loss/50 ml-1.5 text-xs">({feePct}%)</span>
              </span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!amt || amt <= 0}
            className={`relative group w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium border transition-all
              ${(!amt || amt <= 0) ? 'opacity-40 cursor-not-allowed' : ''}
              ${success
                ? 'text-profit border-profit/30 bg-profit/10'
                : `${theme.card} ${theme.cardBorder} ${theme.text}`
              }`}
          >
            {success
              ? <><CheckCircle size={14} /> Recorded!</>
              : `Record ${type === 'withdrawal' ? 'Withdrawal' : 'Deposit'}`
            }
            {!success && amt > 0 && (
              <span
                className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-200 group-hover:w-full"
                style={{ backgroundColor: theme.accentColor }}
              />
            )}
          </button>

        </div>
      </div>
    </div>
  );
}

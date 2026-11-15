// Deposits and withdrawals: the form and its history. Rendered as a tab of
// the Add page.
import React, { useState, useMemo } from "react";
import { CheckCircle, ArrowDown, ArrowUp, Bitcoin, Landmark } from "lucide-react";
import PlatformPicker from "../components/PlatformPicker";
import { PlatformBadge } from "../components/PlatformBadge";
import { PLATFORMS } from "../utils/platforms";

const TX_PLATFORMS = PLATFORMS.filter(p => p.value !== 'other');

const labelCls = "block text-xs text-slate-500 font-medium mb-1.5";

export default function TransactionPage({ onAdd, theme, items = [] }) {
  const [type, setType] = useState('withdrawal');
  const [platform, setPlatform] = useState('csfloat');
  const [method, setMethod] = useState('crypto');
  const [amount, setAmount] = useState('');
  const [feePercent, setFeePercent] = useState('1');
  const [success, setSuccess] = useState(false);

  const amt = parseFloat(amount) || 0;
  const feePct = parseFloat(feePercent) || 0;
  const feeAmt = amt * feePct / 100;

  // Past transactions (sorted by most recent)
  const transactions = useMemo(() =>
    items
      .filter(i => i.isTransaction)
      .sort((a, b) => (b.soldAt ?? 0) - (a.soldAt ?? 0)),
    [items]
  );

  const stats = useMemo(() => {
    const deposits = transactions.filter(t => t.transactionType === 'deposit');
    const withdrawals = transactions.filter(t => t.transactionType === 'withdrawal');
    const totalFees = transactions.reduce((s, t) => s + Math.abs(t.profit || 0), 0);
    return {
      depositCount: deposits.length,
      depositTotal: deposits.reduce((s, t) => s + (t.transactionAmount || 0), 0),
      withdrawalCount: withdrawals.length,
      withdrawalTotal: withdrawals.reduce((s, t) => s + (t.transactionAmount || 0), 0),
      totalFees,
    };
  }, [transactions]);

  const handleSubmit = () => {
    if (!amt || amt <= 0) return;
    onAdd({ type, platform, method, amount: amt, feePercent: feePct });
    setAmount('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const inputCls = `w-full h-9 ${theme.input} rounded-lg px-3 text-sm font-mono ${theme.text} focus:outline-none border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

  return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

          {/* Form card */}
          <div className={`md:col-span-2 ${theme.panel} border ${theme.panelBorder} rounded-xl overflow-hidden`}>

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

              <div>
                <label className={labelCls}>Platform</label>
                <PlatformPicker
                  value={platform}
                  onChange={setPlatform}
                  theme={theme}
                  platforms={TX_PLATFORMS}
                />
              </div>

              <div>
                <label className={labelCls}>Method</label>
                <div className={`flex rounded-lg border ${theme.cardBorder} overflow-hidden`}>
                  {[
                    { value: 'crypto', label: 'Crypto',        icon: Bitcoin  },
                    { value: 'bank',   label: 'Bank transfer', icon: Landmark },
                  ].map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={`flex-1 h-9 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                        method === m.value
                          ? `${theme.card} ${theme.text}`
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <m.icon size={13} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

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

              {amt > 0 && (
                <div className="rounded-lg px-3 py-2 bg-loss/8 border border-loss/20 flex items-center justify-between">
                  <span className={`text-xs ${theme.subtext}`}>Fee deducted</span>
                  <span className="text-sm font-mono font-semibold text-loss">
                    −${feeAmt.toFixed(2)}
                    <span className="text-loss/50 ml-1.5 text-xs">({feePct}%)</span>
                  </span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!amt || amt <= 0}
                className={`relative group w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium border transition
                  ${(!amt || amt <= 0) ? 'opacity-40 cursor-not-allowed' : ''}
                  ${success
                    ? 'text-profit border-profit/30 bg-profit/10'
                    : `border-transparent ${theme.primary}`
                  }`}
              >
                {success
                  ? <><CheckCircle size={14} /> Recorded!</>
                  : `Record ${type}`
                }
              </button>
            </div>
          </div>

          {/* History */}
          <div className={`md:col-span-3 ${theme.panel} border ${theme.panelBorder} rounded-xl overflow-hidden flex flex-col`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.panelBorder}`}>
              <h2 className={`text-sm font-semibold ${theme.text}`}>History</h2>
              <span className={`text-xs font-mono ${theme.subtext}`}>
                in ${stats.depositTotal.toFixed(2)}
                <span className="mx-1.5 opacity-40">·</span>
                out ${stats.withdrawalTotal.toFixed(2)}
                <span className="mx-1.5 opacity-40">·</span>
                <span className={stats.totalFees > 0 ? 'text-loss' : ''}>fees −${stats.totalFees.toFixed(2)}</span>
              </span>
            </div>

            {transactions.length === 0 ? (
              <div className={`flex-1 flex items-center justify-center py-10 text-sm ${theme.subtext}`}>
                No transactions yet.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className={`text-xs font-medium ${theme.subtext}`}>
                    <tr className={`border-b ${theme.cardBorder}`}>
                      <th className="text-left px-4 py-2 font-semibold">Type</th>
                      <th className="text-left px-3 py-2 font-semibold">Platform</th>
                      <th className="text-left px-3 py-2 font-semibold">Method</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                      <th className="text-right px-3 py-2 font-semibold">Fee</th>
                      <th className="text-right px-4 py-2 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => {
                      const isCrypto = (t.transactionMethod ?? 'crypto') === 'crypto';
                      return (
                        <tr key={t.id} className={`border-b ${theme.cardBorder} hover:bg-white/[0.02] transition-colors`}>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${t.transactionType === 'deposit' ? 'text-profit' : 'text-loss'}`}>
                              {t.transactionType === 'deposit' ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                              {t.transactionType}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {t.platform && <PlatformBadge platform={t.platform} size="xs" />}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 text-xs ${theme.textSecondary}`}>
                              {isCrypto ? <Bitcoin size={11} /> : <Landmark size={11} />}
                              {isCrypto ? 'Crypto' : 'Bank'}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right font-mono text-xs ${theme.text}`}>
                            ${t.transactionAmount?.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-xs font-mono font-semibold text-loss">
                              −${Math.abs(t.profit || 0).toFixed(2)}
                              <span className="text-loss/50 ml-1">({t.transactionFeePercent}%)</span>
                            </span>
                          </td>
                          <td className={`px-4 py-2 text-right text-xs font-mono ${theme.subtext}`}>
                            {t.dateSold ? new Date(t.dateSold).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
  );
}

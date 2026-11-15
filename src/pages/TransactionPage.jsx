// Deposits and withdrawals: the form and its history. Rendered as a tab of
// the Add page.
import React, { useState, useMemo } from "react";
import { Check, ArrowDownLeft, ArrowUpRight, Bitcoin, Landmark } from "lucide-react";
import PlatformPicker from "../components/PlatformPicker";
import { PlatformBadge } from "../components/PlatformBadge";
import { Field, Input, Segmented } from "../components/ui";
import { PLATFORMS } from "../utils/platforms";

const TX_PLATFORMS = PLATFORMS.filter(p => p.value !== 'other');

const TYPES = [
  { value: 'withdrawal', label: 'Withdrawal', icon: ArrowUpRight },
  { value: 'deposit',    label: 'Deposit',    icon: ArrowDownLeft },
];
const METHODS = [
  { value: 'crypto', label: 'Crypto',        icon: Bitcoin  },
  { value: 'bank',   label: 'Bank transfer', icon: Landmark },
];

const usd = (n) => `$${(n || 0).toFixed(2)}`;

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
    const sum = (kind) => transactions
      .filter(t => t.transactionType === kind)
      .reduce((s, t) => s + (t.transactionAmount || 0), 0);
    return {
      depositTotal: sum('deposit'),
      withdrawalTotal: sum('withdrawal'),
      totalFees: transactions.reduce((s, t) => s + Math.abs(t.profit || 0), 0),
    };
  }, [transactions]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (amt <= 0) return;
    onAdd({ type, platform, method, amount: amt, feePercent: feePct });
    setAmount('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">

      <form onSubmit={handleSubmit} className={`md:col-span-2 ${theme.panel} border ${theme.panelBorder} rounded-xl p-5 flex flex-col gap-4`}>
        <Segmented theme={theme} full value={type} onChange={setType} options={TYPES} ariaLabel="Type" />

        <Field theme={theme} label="Platform">
          <PlatformPicker value={platform} onChange={setPlatform} theme={theme} platforms={TX_PLATFORMS} />
        </Field>

        <Field theme={theme} label="Paid by">
          <Segmented theme={theme} full value={method} onChange={setMethod} options={METHODS} ariaLabel="Paid by" />
        </Field>

        <div className="flex items-start gap-3">
          <Field theme={theme} label="Amount" className="flex-1 min-w-0">
            <Input
              theme={theme} type="number" min="0" step="0.01" prefix="$"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            />
          </Field>
          <Field theme={theme} label="Fee" className="w-[112px] shrink-0">
            <Input
              theme={theme} type="number" min="0" max="100" step="0.01" suffix="%"
              value={feePercent} onChange={e => setFeePercent(e.target.value)}
            />
          </Field>
        </div>

        <dl className={`border-t pt-3 space-y-1.5 text-[13px] ${theme.panelBorder} ${theme.subtext}`}>
          <div className="flex items-center justify-between">
            <dt>Fee</dt>
            <dd className={`font-mono ${feeAmt > 0 ? 'text-loss' : ''}`}>−{usd(feeAmt)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>{type === 'deposit' ? 'Lands on the platform' : 'You receive'}</dt>
            <dd className={`font-mono ${theme.text}`}>{usd(Math.max(0, amt - feeAmt))}</dd>
          </div>
        </dl>

        <button
          type="submit"
          disabled={amt <= 0 && !success}
          className={`w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium border disabled:opacity-40 disabled:cursor-not-allowed
            ${success ? `${theme.cardBorder} text-profit` : `border-transparent ${theme.primary}`}`}
        >
          {success ? <><Check size={15} /> Recorded</> : `Record ${type}`}
        </button>
      </form>

      {/* History */}
      <div className={`md:col-span-3 ${theme.panel} border ${theme.panelBorder} rounded-xl overflow-hidden`}>
        <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 border-b ${theme.panelBorder}`}>
          <h2 className={`text-sm font-semibold ${theme.text}`}>History</h2>
          {transactions.length > 0 && (
            <span className={`flex gap-3 text-xs ${theme.subtext}`}>
              <span>In <span className={`font-mono ${theme.textSecondary}`}>{usd(stats.depositTotal)}</span></span>
              <span>Out <span className={`font-mono ${theme.textSecondary}`}>{usd(stats.withdrawalTotal)}</span></span>
              <span>Fees <span className="font-mono text-loss">−{usd(stats.totalFees)}</span></span>
            </span>
          )}
        </div>

        {transactions.length === 0 ? (
          <p className={`px-5 py-10 text-center text-[13px] ${theme.subtext}`}>
            No deposits or withdrawals yet. Their fees count against your profit.
          </p>
        ) : (
          <ul className="overflow-y-auto max-h-[560px]">
            {transactions.map(t => {
              const deposit = t.transactionType === 'deposit';
              const crypto = (t.transactionMethod ?? 'crypto') === 'crypto';
              const Arrow = deposit ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={t.id} className={`flex items-center gap-3 px-5 py-2.5 border-b last:border-b-0 ${theme.panelBorder}`}>
                  <span className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full border ${theme.panelBorder} ${theme.subtext}`}>
                    <Arrow size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium ${theme.text}`}>{deposit ? 'Deposit' : 'Withdrawal'}</p>
                    <p className={`text-xs ${theme.subtext}`}>
                      {crypto ? 'Crypto' : 'Bank transfer'}
                      {t.dateSold && ` · ${new Date(t.dateSold).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  </div>
                  {t.platform && (
                    <span className={`hidden sm:block ${theme.textSecondary}`}><PlatformBadge platform={t.platform} size="xs" /></span>
                  )}
                  <div className="w-24 text-right">
                    <p className={`font-mono text-[13px] ${theme.text}`}>{usd(t.transactionAmount)}</p>
                    <p className="font-mono text-xs text-loss">−{usd(Math.abs(t.profit || 0))}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

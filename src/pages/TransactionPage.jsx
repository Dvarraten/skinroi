import React, { useState, useMemo } from "react";
import { ArrowDownUp, CheckCircle, ArrowDown, ArrowUp, Bitcoin, Landmark } from "lucide-react";
import PlatformPicker from "../components/PlatformPicker";
import { PlatformBadge } from "../components/PlatformBadge";
import { PLATFORMS } from "../utils/platforms";
import { Page, PageHeader, StatCard } from "../components/ui/Page";
import { Button } from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { formatUsd } from "../utils/format";

const TX_PLATFORMS = PLATFORMS.filter(p => p.value !== 'other');

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

  const labelCls = `block text-xs font-medium mb-1.5 ${theme.subtext}`;
  const inputCls = `w-full h-9 ${theme.input} rounded-lg px-3 text-sm font-mono ${theme.text} focus:outline-none border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

  return (
    <Page width="max-w-5xl">
      <PageHeader
        title="Transactions"
        description="Record deposits and withdrawals, so the fees you pay to move money count toward your profit."
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Deposits" icon={<ArrowDown size={13} className="text-profit" />}
          value={formatUsd(stats.depositTotal)} hint={`${stats.depositCount} recorded`}
        />
        <StatCard
          label="Withdrawals" icon={<ArrowUp size={13} className="text-loss" />}
          value={formatUsd(stats.withdrawalTotal)} hint={`${stats.withdrawalCount} recorded`}
        />
        <StatCard
          label="Total fees paid" icon={<ArrowDownUp size={13} className={theme.subtext} />}
          value={formatUsd(-stats.totalFees)} tone={stats.totalFees > 0 ? 'loss' : null} hint="across all transactions"
        />
      </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">

          {/* Form card */}
          <section className={`md:col-span-2 ${theme.panel} border ${theme.panelBorder} rounded-2xl p-5`}>
            <h2 className={`text-[15px] font-semibold mb-4 ${theme.text}`}>Record a transaction</h2>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Type</label>
                <Segmented
                  block size="md" label="Type"
                  items={[
                    { key: 'withdrawal', label: 'Withdrawal', icon: <ArrowUp size={13} /> },
                    { key: 'deposit',    label: 'Deposit',    icon: <ArrowDown size={13} /> },
                  ].map(t => ({ ...t, active: type === t.key, onClick: () => setType(t.key) }))}
                />
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
                <Segmented
                  block size="md" label="Method"
                  items={[
                    { key: 'crypto', label: 'Crypto',        icon: <Bitcoin size={13} /> },
                    { key: 'bank',   label: 'Bank transfer', icon: <Landmark size={13} /> },
                  ].map(m => ({ ...m, active: method === m.key, onClick: () => setMethod(m.key) }))}
                />
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
                    {formatUsd(-feeAmt)}
                    <span className="text-loss/50 ml-1.5 text-xs">({feePct}%)</span>
                  </span>
                </div>
              )}

              <Button
                variant={success ? "success" : "primary"}
                block
                onClick={handleSubmit}
                disabled={(!amt || amt <= 0) && !success}
                icon={success ? <CheckCircle size={15} /> : null}
              >
                {success ? 'Recorded' : `Record ${type === 'withdrawal' ? 'withdrawal' : 'deposit'}`}
              </Button>
            </div>
          </section>

          {/* History */}
          <section className={`md:col-span-3 ${theme.panel} border ${theme.panelBorder} rounded-2xl overflow-hidden flex flex-col`}>
            <div className={`flex items-baseline justify-between px-5 py-4 border-b ${theme.panelBorder}`}>
              <h2 className={`text-[15px] font-semibold ${theme.text}`}>History</h2>
              <span className={`text-xs ${theme.subtext}`}>{transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}</span>
            </div>

            {transactions.length === 0 ? (
              <div className={`flex-1 flex items-center justify-center px-5 py-12 text-sm text-center ${theme.subtext}`}>
                No transactions yet. Record your first one with the form.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className={`text-xs font-medium ${theme.subtext}`}>
                    <tr className={`border-b ${theme.cardBorder}`}>
                      <th className="text-left px-5 py-2.5 font-medium">Type</th>
                      <th className="text-left px-3 py-2.5 font-medium">Platform</th>
                      <th className="text-left px-3 py-2.5 font-medium">Method</th>
                      <th className="text-right px-3 py-2.5 font-medium">Amount</th>
                      <th className="text-right px-3 py-2.5 font-medium">Fee</th>
                      <th className="text-right px-5 py-2.5 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => {
                      const isCrypto = (t.transactionMethod ?? 'crypto') === 'crypto';
                      return (
                        <tr key={t.id} className={`border-b last:border-b-0 ${theme.cardBorder} ${theme.itemHoverBg} transition-colors`}>
                          <td className="px-5 py-2.5">
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
                            {formatUsd(t.transactionAmount)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-xs font-mono font-semibold text-loss">
                              {formatUsd(-Math.abs(t.profit || 0))}
                              <span className="text-loss/50 ml-1">({t.transactionFeePercent}%)</span>
                            </span>
                          </td>
                          <td className={`px-5 py-2.5 text-right text-xs ${theme.subtext} whitespace-nowrap`}>
                            {t.dateSold ? new Date(t.dateSold).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
    </Page>
  );
}

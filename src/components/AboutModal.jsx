import React from 'react';
import { RefreshCw, TrendingUp, Layers, Tag, Globe, BarChart3 } from 'lucide-react';
import logoSrc from '../utils/skinroi-logo.svg';
import logoLightSrc from '../utils/skinroi-logo-light.svg';

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Steam Sync',
    desc: 'Inventory changes detected automatically. Connect in Handle Items to track trade-protected skins before the hold lifts.',
  },
  {
    icon: TrendingUp,
    title: 'P&L Tracking',
    desc: 'Accurate profit after platform fees — CSFloat, Buff163, Youpin, CS.MONEY, DMarket and more.',
  },
  {
    icon: Layers,
    title: 'Trade Hold Queue',
    desc: 'Pending tab for items in the 7-day Steam hold. Mark received when they clear.',
  },
  {
    icon: Tag,
    title: 'Smart Autocomplete',
    desc: 'Fuzzy skin search. Type "kara fade fn" to find Karambit | Fade (Factory New) instantly.',
  },
  {
    icon: Globe,
    title: 'Currency Converter',
    desc: 'Live exchange rates between any two currencies, synced across every price input.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    desc: 'Cumulative P&L chart, period filters, win rate, and a 30-day daily heatmap.',
  },
];

export default function AboutModal({ theme }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className={`max-w-2xl mx-auto ${theme?.panel} border ${theme?.panelBorder} rounded-2xl shadow-lg overflow-hidden`}>
        {/* Header with logo */}
        <div className={`flex items-center px-6 py-5 border-b ${theme?.panelBorder}`}>
          <img
            src={theme?.name === 'Light' ? logoLightSrc : logoSrc}
            alt="SkinROI"
            style={{ height: '48px', width: 'auto' }}
          />
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Description */}
          <p className={`text-sm leading-relaxed ${theme?.textSecondary}`}>
            Personal profit &amp; loss tracker for buying and selling CS2 skins across
            third-party markets. Connects to your Steam inventory to detect trades automatically
            and shows your real returns after platform fees.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className={`${theme?.card} border ${theme?.cardBorder} rounded-xl p-4 flex flex-col gap-2`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-white/8">
                    <Icon size={14} className={theme?.accent} />
                  </div>
                  <span className={`text-sm font-semibold ${theme?.text}`}>{title}</span>
                </div>
                <p className={`text-xs leading-relaxed ${theme?.subtext}`}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className={`border-t ${theme?.panelBorder} pt-4`}>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Not affiliated with or endorsed by Valve Corporation. Counter-Strike, CS2, and
              Steam are trademarks of Valve Corporation. Skin metadata via{' '}
              <a
                href="https://github.com/ByMykel/CSGO-API"
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 hover:text-slate-400 underline underline-offset-2"
              >
                ByMykel/CSGO-API
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

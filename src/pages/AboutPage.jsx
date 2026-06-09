import React from 'react';
import { Home, PlusCircle, Package, ArrowLeftRight, BarChart3, Globe, Tag, RefreshCw } from 'lucide-react';
import logoSrc from '../utils/skinroi-logo.svg';
import logoLightSrc from '../utils/skinroi-logo-light.svg';

const PAGES = [
  { icon: Home,          title: 'Home',         desc: 'Portfolio overview — stats, item grid, currency converter, recent sales.' },
  { icon: PlusCircle,    title: 'Add Item',      desc: 'Log a new purchase with autocomplete search, price, date, and platform.' },
  { icon: Package,       title: 'Handle Items',  desc: 'Steam sync — confirm incoming items, record sales with live profit preview.' },
  { icon: ArrowLeftRight,title: 'Transactions',  desc: 'Log fees and deposits not tied to a specific skin.' },
  { icon: BarChart3,     title: 'Analytics',     desc: 'P&L chart, win rate, weekly/monthly profit, and a 90-day sale heatmap.' },
];

const FEATURES = [
  {
    icon: Globe,
    title: 'Currency Converter',
    desc: 'Live exchange rates between any two currencies. The right-side currency drives all price inputs across the app — switch to CNY and every field shows yuan.',
  },
  {
    icon: Tag,
    title: 'Smart Autocomplete',
    desc: 'Fuzzy skin search powered by a local skin list. Type shortcuts like "m9 dop mw" to instantly find M9 Bayonet | Doppler (Minimal Wear).',
  },
  {
    icon: RefreshCw,
    title: 'Steam Sync',
    desc: 'Paste a Steam mobile refresh token once and the app auto-detects new purchases from your trade history and inventory diff. Tokens last ~6 months.',
  },
];

export default function AboutPage({ theme }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className={`max-w-2xl mx-auto ${theme?.panel} border ${theme?.panelBorder} rounded-2xl shadow-lg overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center px-6 py-5 border-b ${theme?.panelBorder}`}>
          <img
            src={theme?.name === 'Light' ? logoLightSrc : logoSrc}
            alt="SkinROI"
            style={{ height: '48px', width: 'auto' }}
          />
        </div>

        <div className="px-6 py-6 space-y-7">
          {/* Description */}
          <p className={`text-sm leading-relaxed ${theme?.textSecondary}`}>
            Personal profit &amp; loss tracker for buying and selling CS2 skins across
            third-party markets. Connects to your Steam inventory to detect trades automatically
            and shows your real returns after platform fees.
          </p>

          {/* Pages guide */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${theme?.subtext} mb-3`}>Pages</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PAGES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className={`${theme?.card} border ${theme?.cardBorder} rounded-xl p-3 flex gap-3 items-start`}
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-white/8 mt-0.5">
                    <Icon size={13} className={theme?.accent} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${theme?.text}`}>{title}</p>
                    <p className={`text-[11px] leading-snug ${theme?.subtext} mt-0.5`}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${theme?.subtext} mb-3`}>Features</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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

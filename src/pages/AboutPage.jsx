import React from 'react';
import { LogIn, Puzzle, Inbox, ShieldCheck, KeyRound, HardDrive } from 'lucide-react';
import { PLATFORMS } from '../utils/platforms';

const STEPS = [
  {
    icon: LogIn,
    title: 'Sign in with Steam',
    desc: 'Steam OpenID confirms who you are. SkinROI never sees your password, and your portfolio is saved to your account.',
  },
  {
    icon: Puzzle,
    title: 'Pair the extension',
    desc: 'Generate a code under Handle Items and paste it into the SkinROI Chrome extension. Pairing takes a few seconds.',
  },
  {
    icon: Inbox,
    title: 'Confirm your trades',
    desc: 'Accepted trades show up in Handle Items with float, paint seed and stickers. Confirm a buy or a sale and the numbers update.',
  },
];

const PAGES = [
  { title: 'Home',         desc: 'Portfolio value, profit, your items, recent sales, and the current lowest Buff163 and CSFloat price for every unsold item.' },
  { title: 'Add item',     desc: 'Log a purchase by hand with skin search, price, date and market.' },
  { title: 'Handle items', desc: 'Trades detected by the extension. CSFloat trades are prefilled with the price you paid or received.' },
  { title: 'Transactions', desc: 'Deposits and withdrawals that are not tied to a single skin, so your cash flow adds up.' },
  { title: 'Snipes',       desc: 'Live CSFloat and DMarket listings priced below Buff163, filtered by fees, return and liquidity.' },
  { title: 'Analytics',    desc: 'Profit over time, win rate, weekly and monthly results and a 90-day sales heatmap.' },
];

const TRUST = [
  {
    icon: KeyRound,
    title: 'No Steam password or API key',
    desc: 'The extension reads trades with the Steam session already in your browser. Nothing you type in is stored.',
  },
  {
    icon: ShieldCheck,
    title: 'Your account only',
    desc: 'The extension refuses to sync if the Steam account in your browser differs from the one you paired.',
  },
  {
    icon: HardDrive,
    title: 'Works without an account',
    desc: 'As a guest, everything stays in your browser. Export or import your portfolio as CSV at any time.',
  },
];

const SOURCES = [
  { name: 'Steam',          use: 'Sign-in, trade offers and inventory, read by the extension' },
  { name: 'CSFloat',        use: 'Your trades, listings and lowest prices' },
  { name: 'DMarket',        use: 'Listings for Snipes' },
  { name: 'Buff163',        use: 'Reference prices and lowest listings' },
  { name: 'ByMykel/CSGO-API', use: 'Skin names and images', href: 'https://github.com/ByMykel/CSGO-API' },
  { name: 'ExchangeRate-API', use: 'Live currency rates', href: 'https://www.exchangerate-api.com' },
];

function SectionTitle({ theme, children, hint }) {
  return (
    <div className="mb-4">
      <h2 className={`text-base font-semibold ${theme?.text}`}>{children}</h2>
      {hint && <p className={`text-sm mt-1 ${theme?.subtext}`}>{hint}</p>}
    </div>
  );
}

export default function AboutPage({ theme }) {
  const markets = PLATFORMS.filter((p) => p.icon);
  const rule = `border-t ${theme?.panelBorder}`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto">
        {/* ── Intro ─────────────────────────────────────────────────── */}
        <header className="pb-10">
          <p className={`text-sm ${theme?.subtext}`}>About SkinROI</p>
          <h1 className={`mt-3 text-2xl sm:text-3xl font-semibold tracking-tight leading-tight ${theme?.text}`}>
            Know what your CS2 skins really return.
          </h1>
          <p className={`mt-4 text-sm sm:text-base leading-relaxed max-w-2xl ${theme?.textSecondary}`}>
            SkinROI tracks every skin you buy and sell across third-party markets and shows
            your profit after platform fees. A Chrome extension picks up your Steam trades,
            so you spend less time typing prices and more time trading.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <span className={`text-xs ${theme?.subtext}`}>Fees built in for</span>
            <div className="flex flex-wrap items-center gap-3">
              {markets.map((p) => (
                <span key={p.value} className="flex items-center gap-1.5" title={`${p.label} · ${p.fee} fee`}>
                  <img src={p.icon} alt="" className="h-4 w-4 rounded-sm object-contain" />
                  <span className={`text-xs ${theme?.textSecondary}`}>{p.label}</span>
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section className={`${rule} py-10`}>
          <SectionTitle theme={theme} hint="From sign-in to synced trades in about a minute.">
            How it works
          </SectionTitle>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className={`${theme?.card} border ${theme?.cardBorder} rounded-xl p-4`}>
                <div className="flex items-center justify-between">
                  <Icon size={16} className={theme?.subtext} />
                  <span className={`text-xs tabular-nums ${theme?.subtext}`}>{String(i + 1).padStart(2, '0')}</span>
                </div>
                <p className={`mt-4 text-sm font-medium ${theme?.text}`}>{title}</p>
                <p className={`mt-1.5 text-xs leading-relaxed ${theme?.subtext}`}>{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Pages ─────────────────────────────────────────────────── */}
        <section className={`${rule} py-10`}>
          <SectionTitle theme={theme}>What's inside</SectionTitle>
          <dl>
            {PAGES.map(({ title, desc }, i) => (
              <div
                key={title}
                className={`grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-1 sm:gap-6 py-3 ${i > 0 ? rule : ''}`}
              >
                <dt className={`text-sm font-medium ${theme?.text}`}>{title}</dt>
                <dd className={`text-sm leading-relaxed ${theme?.subtext}`}>{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Privacy ───────────────────────────────────────────────── */}
        <section className={`${rule} py-10`}>
          <SectionTitle theme={theme}>Privacy and security</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRUST.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon size={16} className={theme?.subtext} />
                <p className={`mt-3 text-sm font-medium ${theme?.text}`}>{title}</p>
                <p className={`mt-1.5 text-xs leading-relaxed ${theme?.subtext}`}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Data sources ──────────────────────────────────────────── */}
        <section className={`${rule} py-10`}>
          <SectionTitle theme={theme} hint="Prices can lag the markets by a few minutes. Always check the listing before you buy.">
            Data sources
          </SectionTitle>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {SOURCES.map(({ name, use, href }) => (
              <li key={name} className={`flex items-baseline justify-between gap-4 py-2.5 ${rule}`}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-sm shrink-0 underline underline-offset-2 decoration-1 ${theme?.text}`}
                  >
                    {name}
                  </a>
                ) : (
                  <span className={`text-sm shrink-0 ${theme?.text}`}>{name}</span>
                )}
                <span className={`text-xs text-right ${theme?.subtext}`}>{use}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className={`${rule} pt-6 pb-4`}>
          <p className={`text-xs leading-relaxed max-w-xl ${theme?.subtext}`}>
            SkinROI is an independent project and is not affiliated with or endorsed by Valve
            Corporation or any of the markets listed. Counter-Strike, CS2 and Steam are trademarks
            of Valve Corporation. Nothing here is financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
}

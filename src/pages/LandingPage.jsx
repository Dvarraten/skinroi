// Landing page for logged-out visitors: what SkinROI does, three features
// with screenshots, pricing, and the ways in (Steam sign-in, demo, guest).
import React from "react";
import { Check, ArrowRight } from "lucide-react";
import steamLogo from "../assets/platforms/steam.png";
import logoSrc from "../utils/skinroi-logo.svg";
import logoLightSrc from "../utils/skinroi-logo-light.svg";

const SHOTS = `${process.env.PUBLIC_URL || ""}/landing`;

const FEATURES = [
  {
    title: "Snipes under market price",
    text: "New CSFloat and DMarket listings are checked against YouPin, Buff163 and CSFloat within a minute. You see the profit after fees and how fast the item sells again.",
    image: `${SHOTS}/snipes.webp`,
    alt: "Snipes page listing deals with buy price, sell market and profit",
  },
  {
    title: "Your real profit, after fees",
    text: "Track every skin you hold and sell. SkinROI takes each market's fee into account and shows the live lowest price on YouPin and CSFloat next to what you paid.",
    image: `${SHOTS}/portfolio.webp`,
    alt: "Analytics page with a profit curve, return and latest sales",
  },
  {
    title: "Trades show up by themselves",
    text: "The SkinROI Sync extension notices accepted Steam trades and lists them under Trades with float, pattern and stickers. Import your current inventory in one click.",
    image: `${SHOTS}/handle.webp`,
    alt: "Trades page with incoming Steam trades ready to add",
  },
];

// No price is decided yet: everything is free while in beta.
const PLAN_POINTS = [
  "Portfolio tracking with fees and ROI",
  "Real-time Snipes across four markets",
  "Trade sync with the browser extension",
  "One-click Steam inventory import",
];

function Shot({ src, alt, theme, eager = false }) {
  return (
    <div className={`rounded-xl border ${theme.panelBorder} overflow-hidden`}>
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} className="w-full h-auto block" />
    </div>
  );
}

export default function LandingPage({ theme, isDark = true, onLogin, onDemo, onGuest }) {
  const primary = `inline-flex items-center justify-center gap-2.5 h-11 px-5 rounded-lg text-sm font-medium transition-colors ${theme.primary}`;
  const secondary = `inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-medium border ${theme.cardBorder} ${theme.text} ${theme.itemHoverBg} transition-colors`;
  const steam = (size) => <img src={steamLogo} alt="" className={`${size} ${theme.iconOnPrimary}`} />;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <header className={`border-b ${theme.panelBorder}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center">
          <img src={isDark ? logoSrc : logoLightSrc} alt="SkinROI" className="h-11 w-auto" />
          <div className="ml-auto flex items-center gap-5">
            <button onClick={onDemo} className={`text-[13px] font-medium ${theme.subtext} ${theme.textHover} transition-colors`}>
              Demo
            </button>
            <button onClick={onLogin} className={`flex items-center gap-1.5 text-[13px] font-medium ${theme.text} hover:opacity-80 transition-opacity`}>
              <img src={steamLogo} alt="" className={`h-3.5 w-3.5 ${theme.iconOnSurface}`} /> Sign in
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-6">
        {/* Hero */}
        <section className="max-w-6xl mx-auto pt-16 md:pt-24 text-center">
          <h1 className={`mx-auto max-w-3xl text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] ${theme.text}`}>
            Find CS2 skins below market price, in real time.
          </h1>
          <p className={`mx-auto mt-6 max-w-xl text-base leading-relaxed ${theme.subtext}`}>
            SkinROI compares new listings across CSFloat, DMarket, YouPin and Buff163 as they appear, and tracks what your skins really earn after fees.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={onLogin} className={primary}>
              {steam("h-5 w-5")} Sign in with Steam
            </button>
            <button onClick={onDemo} className={secondary}>
              Try the demo <ArrowRight size={15} />
            </button>
          </div>
          <p className={`mt-5 text-xs ${theme.subtext}`}>
            Free during the beta. Steam sign-in only shares your public profile; we never see your password.{" "}
            <button onClick={onGuest} className={`underline underline-offset-2 ${theme.textHover}`}>
              Or continue without an account
            </button>
          </p>
          <div className="mt-14 md:mt-16">
            <Shot src={`${SHOTS}/overview.webp`} alt="SkinROI portfolio with holding value, profit curve and item cards" theme={theme} eager />
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto py-20 md:py-28 space-y-20 md:space-y-28" aria-label="Features">
          {FEATURES.map(({ title, text, image, alt }, i) => (
            <div key={title} className="grid md:grid-cols-[1fr_1.5fr] gap-8 md:gap-14 items-center">
              <div className={i % 2 ? "md:order-2" : ""}>
                <p className={`text-xs font-mono ${theme.subtext}`}>{String(i + 1).padStart(2, "0")}</p>
                <h2 className={`mt-3 text-2xl md:text-3xl font-semibold tracking-tight ${theme.text}`}>{title}</h2>
                <p className={`mt-4 text-sm leading-relaxed max-w-md ${theme.subtext}`}>{text}</p>
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>
                <Shot src={image} alt={alt} theme={theme} />
              </div>
            </div>
          ))}
        </section>

        {/* Pricing */}
        <section className={`max-w-6xl mx-auto py-16 md:py-20 border-t ${theme.panelBorder} grid md:grid-cols-2 gap-10 items-start`} aria-label="Pricing">
          <div>
            <h2 className={`text-2xl md:text-3xl font-semibold tracking-tight ${theme.text}`}>Pricing</h2>
            <p className={`mt-6 font-mono font-medium leading-none text-6xl ${theme.text}`}>$0</p>
            <p className={`mt-3 text-sm ${theme.subtext}`}>Every feature, while SkinROI is in beta.</p>
          </div>
          <div>
            <ul className={`border-t ${theme.panelBorder}`}>
              {PLAN_POINTS.map((p) => (
                <li key={p} className={`flex items-center gap-3 py-3 border-b text-sm ${theme.panelBorder} ${theme.textSecondary}`}>
                  <Check size={15} className="text-profit shrink-0" /> {p}
                </li>
              ))}
            </ul>
            <button onClick={onLogin} className={`${primary} mt-6`}>
              {steam("h-5 w-5")} Sign in with Steam
            </button>
            <p className={`mt-4 text-xs max-w-sm ${theme.subtext}`}>
              Paid plans may come after the beta. Beta users hear about it first, and nothing is charged without asking.
            </p>
          </div>
        </section>
      </main>

      <footer className={`px-4 md:px-6 py-8 border-t ${theme.panelBorder}`}>
        <div className={`max-w-6xl mx-auto flex flex-wrap gap-x-6 gap-y-2 text-xs ${theme.subtext}`}>
          <span>© {new Date().getFullYear()} SkinROI</span>
          <span>Not affiliated with Valve, Steam or any marketplace.</span>
          <button onClick={onDemo} className={`ml-auto ${theme.textHover}`}>Try the demo</button>
        </div>
      </footer>
    </div>
  );
}

// Landing page for logged-out visitors: what SkinROI does, three features
// with screenshots, pricing, and the ways in (Steam sign-in, demo, guest).
import React from "react";
import { Crosshair, LineChart, RefreshCw, Check, ArrowRight } from "lucide-react";
import steamLogo from "../assets/platforms/steam.png";
import logoSrc from "../utils/skinroi-logo.svg";
import logoLightSrc from "../utils/skinroi-logo-light.svg";
import { STEAM_BUTTON_CLASS } from "../themes/themes";

const SHOTS = `${process.env.PUBLIC_URL || ""}/landing`;

const FEATURES = [
  {
    icon: Crosshair,
    title: "Snipes under market price",
    text: "New CSFloat and DMarket listings are checked against YouPin, Buff163 and CSFloat within a minute. You see the profit after fees and how fast the item sells again.",
    image: `${SHOTS}/snipes.webp`,
    alt: "Snipes page listing deals with buy price, sell market and profit",
  },
  {
    icon: LineChart,
    title: "Your real profit, after fees",
    text: "Track every skin you hold and sell. SkinROI takes each market's fee into account and shows the live lowest price on YouPin and CSFloat next to what you paid.",
    image: `${SHOTS}/portfolio.webp`,
    alt: "Profit analytics with a 30-day profit chart, invested amount and total profit",
  },
  {
    icon: RefreshCw,
    title: "Trades show up by themselves",
    text: "The SkinROI Sync extension notices accepted Steam trades and puts them in Handle items with float, pattern and stickers. Import your current inventory in one click.",
    image: `${SHOTS}/handle.webp`,
    alt: "Handle items page with incoming trades ready to add",
  },
];

// No price is decided yet: everything is free while in beta.
const PLAN_POINTS = [
  "Portfolio tracking with fees and ROI",
  "Real-time Snipes across four markets",
  "Trade sync with the browser extension",
  "One-click Steam inventory import",
];

function Shot({ src, alt, theme }) {
  return (
    <div className={`rounded-2xl border ${theme.panelBorder} ${theme.panel} overflow-hidden shadow-2xl`}>
      <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
    </div>
  );
}

export default function LandingPage({ theme, onLogin, onDemo, onGuest }) {
  const logo = theme?.name === "Light" ? logoLightSrc : logoSrc;
  const primary = `inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium ${STEAM_BUTTON_CLASS} border border-white/10 text-white transition-colors active:scale-[0.97]`;
  const secondary = `inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border ${theme.cardBorder} ${theme.text} hover:bg-white/5 transition-colors active:scale-[0.97]`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Top bar */}
      <header className="px-4 pt-3">
        <div className={`max-w-6xl mx-auto px-4 md:px-5 h-14 flex items-center rounded-2xl shadow-lg ${theme.header}`}>
          <img src={logo} alt="SkinROI" style={{ height: "52px", width: "auto" }} />
          <div className="ml-auto flex items-center gap-4">
            <button onClick={onDemo} className={`text-[13px] font-medium ${theme.subtext} ${theme.textHover} transition-colors`}>
              Try the demo
            </button>
            <button onClick={onLogin} className={`flex items-center gap-1.5 text-[13px] font-medium ${theme.text}`}>
              <img src={steamLogo} alt="" className="h-3.5 w-3.5" /> Sign in
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-6">
        {/* Hero */}
        <section className="max-w-6xl mx-auto pt-14 md:pt-20 pb-12 grid md:grid-cols-[1fr_1.15fr] gap-10 items-center">
          <div>
            <p className={`text-xs font-mono ${theme.accent} mb-4`}>CS2 skin trading, measured</p>
            <h1 className={`text-4xl md:text-5xl font-semibold tracking-tight leading-[1.08] ${theme.text}`}>
              Find CS2 skins below market price, in real time.
            </h1>
            <p className={`mt-5 text-base leading-relaxed max-w-lg ${theme.textSecondary}`}>
              SkinROI compares new listings across CSFloat, DMarket, YouPin and Buff163 as they appear, and tracks what your skins really earn after fees.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onLogin} className={primary}>
                <img src={steamLogo} alt="" className="h-5 w-5" /> Sign in with Steam
              </button>
              <button onClick={onDemo} className={secondary}>
                Try the demo <ArrowRight size={15} />
              </button>
            </div>
            <p className={`mt-4 text-xs ${theme.subtext}`}>
              Free during the beta. Steam sign-in only shares your public profile; we never see your password.{" "}
              <button onClick={onGuest} className={`underline underline-offset-2 ${theme.textHover}`}>
                Or continue without an account
              </button>
            </p>
          </div>
          <Shot src={`${SHOTS}/overview.webp`} alt="SkinROI home with portfolio value, profit chart and item cards" theme={theme} />
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto py-12 space-y-16 md:space-y-24" aria-label="Features">
          {FEATURES.map(({ icon: Icon, title, text, image, alt }, i) => (
            <div key={title} className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div className={i % 2 ? "md:order-2" : ""}>
                <div className={`w-9 h-9 rounded-lg border ${theme.cardBorder} flex items-center justify-center mb-4`}>
                  <Icon size={17} className={theme.accent} />
                </div>
                <h2 className={`text-2xl font-semibold tracking-tight ${theme.text}`}>{title}</h2>
                <p className={`mt-3 text-sm leading-relaxed max-w-md ${theme.textSecondary}`}>{text}</p>
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>
                <Shot src={image} alt={alt} theme={theme} />
              </div>
            </div>
          ))}
        </section>

        {/* Pricing */}
        <section className="max-w-6xl mx-auto py-16" aria-label="Pricing">
          <h2 className={`text-2xl font-semibold tracking-tight text-center ${theme.text}`}>Pricing</h2>
          <div className={`mt-8 mx-auto max-w-md rounded-2xl border ${theme.panelBorder} ${theme.panel} p-6`}>
            <div className="flex items-baseline gap-2">
              <p className={`text-sm font-medium ${theme.text}`}>Beta</p>
              <span className={`text-xs ${theme.subtext}`}>all features</span>
            </div>
            <p className={`mt-3 text-4xl font-semibold font-mono ${theme.text}`}>
              $0 <span className={`text-sm font-sans font-normal ${theme.subtext}`}>while in beta</span>
            </p>
            <ul className="mt-5 space-y-2">
              {PLAN_POINTS.map((p) => (
                <li key={p} className={`flex items-start gap-2 text-sm ${theme.textSecondary}`}>
                  <Check size={15} className="text-profit shrink-0 mt-0.5" /> {p}
                </li>
              ))}
            </ul>
            <button onClick={onLogin} className={`${primary} w-full mt-6`}>
              <img src={steamLogo} alt="" className="h-5 w-5" /> Sign in with Steam
            </button>
            <p className={`mt-3 text-[11px] text-center ${theme.subtext}`}>
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

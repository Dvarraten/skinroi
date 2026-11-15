// The SkinROI logo: an S cut out of a rounded tile, then the name. Drawn in
// the text colour, so it follows the theme without separate files.
import React from "react";

export const LogoMark = ({ size = 26, className = "" }) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <mask id="skinroi-mark-s">
      <rect width="48" height="48" fill="white" />
      <path
        d="M32.5 15.5H21.25a5.25 5.25 0 0 0 0 10.5h5.5a5.25 5.25 0 0 1 0 10.5H15.5"
        fill="none"
        stroke="black"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
    </mask>
    <rect x="3" y="3" width="42" height="42" rx="11" fill="currentColor" mask="url(#skinroi-mark-s)" />
  </svg>
);

const Logo = ({ theme, size = 26, className = "" }) => (
  <span
    role="img"
    aria-label="SkinROI"
    className={`inline-flex items-center gap-2.5 select-none ${theme.text} ${className}`}
  >
    <LogoMark size={size} />
    <span
      aria-hidden="true"
      className="font-semibold leading-none tracking-[-0.03em]"
      style={{ fontSize: Math.round(size * 0.74) }}
    >
      skin<span className={`font-medium ${theme.subtext}`}>roi</span>
    </span>
  </span>
);

export default Logo;

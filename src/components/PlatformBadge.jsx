// PlatformBadge  — colored pill (icon + label) for a buy/sell platform.
// PlatformConfig — shared color + icon map used by PlatformBadge and callers
//                  that need raw config (e.g. building dropdown options).
import React from "react";

import buff163Icon  from "../assets/platforms/buff163.webp";
import csfloatIcon  from "../assets/platforms/csfloat.webp";
import csmoneyIcon  from "../assets/platforms/csmoney.webp";

import skinswapIcon from "../assets/platforms/skinswap.webp";
import youpinIcon   from "../assets/platforms/youpin.webp";
import dmarketIcon  from "../assets/platforms/dmarket.webp";
import skinsIcon    from "../assets/platforms/skins.webp";

// Colors sourced from SAP Fiori Morning Horizon chart palette
// sapChart_OrderedColor_* from SAP/theming-base-content
const PLATFORM_CONFIG = {
  buff163:  { label: "Buff163",  icon: buff163Icon  },
  csfloat:  { label: "CSFloat",  icon: csfloatIcon  },

  csmoney:  { label: "CS.MONEY", icon: csmoneyIcon  },
  skinswap: { label: "SkinSwap", icon: skinswapIcon },
  dmarket:  { label: "DMarket",  icon: dmarketIcon  },
  youpin:   { label: "Youpin",    icon: youpinIcon  },
  skins:    { label: "Skins.com", icon: skinsIcon   },
  tradeit:  { label: "Tradeit",   icon: null        },
  facebook: { label: "Facebook", icon: null         },
  other:    { label: "Other",    icon: null         },
};

export function PlatformBadge({ platform, size = "sm" }) {
  if (!platform) return null;
  const key = platform.toLowerCase();
  const config = PLATFORM_CONFIG[key] ?? PLATFORM_CONFIG.other;
  const imgSize = size === "xs" ? "w-3.5 h-3.5" : "w-4 h-4";
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${textSize}`}
    >
      {config.icon && (
        <img
          src={config.icon}
          alt={config.label}
          className={`${imgSize} rounded-sm object-contain flex-shrink-0`}
        />
      )}
      {config.label}
    </span>
  );
}

export default PLATFORM_CONFIG;
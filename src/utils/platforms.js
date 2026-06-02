// Shared platform list used by AddItemForm, ItemGrid, and HandleItemsModal.
import buff163Icon  from "../assets/platforms/buff163.webp";
import csfloatIcon  from "../assets/platforms/csfloat.webp";
import csmoneyIcon  from "../assets/platforms/csmoney.webp";
import skinswapIcon from "../assets/platforms/skinswap.webp";
import youpinIcon   from "../assets/platforms/youpin.webp";
import dmarketIcon  from "../assets/platforms/dmarket.webp";
import skinsIcon    from "../assets/platforms/skins.webp";

export const PLATFORMS = [
  { value: "buff163",  label: "Buff163",   icon: buff163Icon,  fee: "1.5%" },
  { value: "csfloat",  label: "CSFloat",   icon: csfloatIcon,  fee: "2%"   },
  { value: "csmoney",  label: "CS.MONEY",  icon: csmoneyIcon,  fee: "5%"   },
  { value: "skinswap", label: "SkinSwap",  icon: skinswapIcon, fee: "5%"   },
  { value: "dmarket",  label: "DMarket",   icon: dmarketIcon,  fee: "5%"   },
  { value: "youpin",   label: "Youpin",    icon: youpinIcon,   fee: "0.5%" },
  { value: "skins",    label: "Skins.com", icon: skinsIcon,    fee: "1%"   },
  { value: "other",    label: "Other",     icon: null,         fee: "0%", emoji: "🔧" },
];

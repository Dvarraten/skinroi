// The app's destinations, in menu order. Header (desktop) and BottomNav
// (phones) both render this list, so a page is added in one place.
// "Add item" is an action, not a place: it is the primary button in the
// header. "About" lives in the account menu.
import { Home, Inbox, Crosshair, BarChart3, ArrowDownUp } from "lucide-react";

export const NAV_ITEMS = [
  { key: null,           label: 'Home',         icon: Home        },
  { key: 'handleItems',  label: 'Handle items', icon: Inbox       },
  { key: 'snipes',       label: 'Snipes',       icon: Crosshair   },
  { key: 'analytics',    label: 'Analytics',    icon: BarChart3   },
  { key: 'transactions', label: 'Transactions', icon: ArrowDownUp },
];

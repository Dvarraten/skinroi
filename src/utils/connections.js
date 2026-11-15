// Marketplaces a user can link on the Connections page. `fields` must match
// PROVIDERS in api/_lib/connections.js. Step screenshots live in
// public/connections/{id}-{n}.png; a step whose image is missing simply
// shows no picture, so they can be added one at a time.
import csfloatIcon from "../assets/platforms/csfloat.webp";
import dmarketIcon from "../assets/platforms/dmarket.webp";

export const CONNECTION_PROVIDERS = [
  {
    id: "csfloat",
    name: "CSFloat",
    icon: csfloatIcon,
    available: true,
    imports: "Prices for your CSFloat trades in Trades, and auto add / sell for exact matches.",
    keyUrl: "https://csfloat.com/profile",
    fields: [
      { name: "apiKey", label: "API key", placeholder: "Paste your CSFloat API key" },
    ],
    steps: [
      { text: "Sign in at csfloat.com with the same Steam account you use here.", image: "csfloat-1.png" },
      { text: "Open your profile and go to the Developers tab.", image: "csfloat-2.png" },
      { text: "Click New key, name it SkinROI and copy the key.", image: "csfloat-3.png" },
      { text: "Paste it below and click Connect. We check it against your Steam account before saving." },
    ],
  },
  {
    id: "skinport",
    name: "Skinport",
    icon: null,
    available: true,
    imports: "Your Skinport purchases and sales. Matching them to Trades comes in the next update.",
    keyUrl: "https://skinport.com/account",
    fields: [
      { name: "clientId", label: "Client ID", placeholder: "Client ID" },
      { name: "clientSecret", label: "Client secret", placeholder: "Client secret" },
    ],
    steps: [
      { text: "Sign in at skinport.com.", image: "skinport-1.png" },
      { text: "Open Settings and find the API section.", image: "skinport-2.png" },
      { text: "Generate an API key and copy the Client ID and the Client secret.", image: "skinport-3.png" },
      { text: "Paste both below and click Connect." },
    ],
  },
  { id: "dmarket", name: "DMarket", icon: dmarketIcon, available: false, imports: "Sold items and filled buy orders." },
  { id: "waxpeer", name: "Waxpeer", icon: null, available: false, imports: "Your trade and sale history." },
  { id: "bitskins", name: "BitSkins", icon: null, available: false, imports: "Your purchases and sales." },
];

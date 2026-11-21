import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Error reporting: off unless REACT_APP_SENTRY_DSN is set at build time
// (Vercel env var). Sentry is loaded as its own chunk only then, so it adds
// nothing to the bundle otherwise. No IPs or cookies are sent.
if (process.env.REACT_APP_SENTRY_DSN) {
  import("@sentry/react")
    .then((Sentry) => Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.REACT_APP_VERCEL_ENV || process.env.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    }))
    .catch(() => {});
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

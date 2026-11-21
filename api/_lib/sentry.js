// Error reporting for the API functions. Off unless SENTRY_DSN is set in
// Vercel; then any error a handler throws is sent to Sentry (with the route
// and Vercel environment) before Vercel turns it into a 500.
// @sentry/node is only loaded when a DSN is set, so it costs nothing
// otherwise. Errors a handler catches itself and answers with a 500 aren't
// seen here; call reportError(err, { where }) in those spots if wanted.

let sentryPromise = null;

function getSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  if (!sentryPromise) {
    sentryPromise = import('@sentry/node')
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.VERCEL_ENV || 'development',
          tracesSampleRate: 0,
          sendDefaultPii: false,
        });
        return Sentry;
      })
      .catch(() => null);
  }
  return sentryPromise;
}

export async function reportError(err, context = {}) {
  const Sentry = await getSentry();
  if (!Sentry) return;
  Sentry.captureException(err, { tags: context });
  await Sentry.flush(2000).catch(() => {});
}

// Wraps a Vercel handler: errors are reported, then re-thrown as before.
export function withSentry(handler) {
  return async function sentryHandler(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      await reportError(err, { route: String(req?.url || '').split('?')[0], method: req?.method });
      throw err;
    }
  };
}

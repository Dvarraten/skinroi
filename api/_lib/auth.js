// HMAC-signed session cookie that ties a Steam ID to the browser for 30 days.
// The cookie is HttpOnly and Secure (on HTTPS), so it is not accessible to JS.
// Exports: setSessionCookie, clearSessionCookie, getSessionSteamId.
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'cs2-session';
const MAX_AGE_S = 30 * 24 * 60 * 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is not set');
  return s;
}

function sign(steamId) {
  const ts = Date.now();
  const payload = `${steamId}.${ts}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [steamId, ts, sig] = parts;
  // Reject malformed signatures before allocating Buffers.
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;
  const payload = `${steamId}.${ts}`;
  const expected = createHmac('sha256', secret()).update(payload).digest('hex');
  if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  if (Date.now() - parseInt(ts) > MAX_AGE_S * 1000) return null;
  return steamId;
}

function parseCookies(str = '') {
  return Object.fromEntries(
    str.split(';')
      .map(c => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k.trim(), v.join('=').trim()])
  );
}

function cookieFlags(req) {
  // Prefer the forwarded protocol header set by Vercel/reverse proxies. Fall
  // back to APP_URL for environments that set it but don't forward the header.
  const proto = ((req?.headers?.['x-forwarded-proto'] || '').split(',')[0] || '').trim();
  const isSecure = proto === 'https' || (!proto && (process.env.APP_URL || '').startsWith('https'));
  return `HttpOnly; Path=/; Max-Age=${MAX_AGE_S}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
}

export function setSessionCookie(res, steamId, req) {
  const token = sign(steamId);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; ${cookieFlags(req)}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

export function getSessionSteamId(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME] || null);
}

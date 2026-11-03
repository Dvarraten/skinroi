// GET /api/auth/callback — Steam posts back here after login.
// We verify the assertion with Steam, then set a signed session cookie.
import { setSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  const query = req.query || {};

  // Re-validate the OpenID assertion with Steam.
  const verifyParams = new URLSearchParams({ ...query, 'openid.mode': 'check_authentication' });
  let text;
  try {
    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });
    text = await verifyRes.text();
  } catch (err) {
    return res.status(502).send('Could not reach Steam to verify login');
  }

  if (!text.includes('is_valid:true')) {
    return res.status(401).send('Steam login validation failed');
  }

  const claimedId = query['openid.claimed_id'] || '';
  const match = claimedId.match(/\/(\d{17})$/);
  if (!match) return res.status(400).send('Invalid Steam ID in response');
  const steamId = match[1];

  setSessionCookie(res, steamId, req);
  res.redirect(302, '/');
}

import { getSessionSteamId } from '../_lib/auth.js';
import { getProfile } from '../_lib/profile.js';
import { withSentry } from '../_lib/sentry.js';

async function handler(req, res) {
  const steamId = getSessionSteamId(req);
  res.setHeader('Cache-Control', 'no-store');
  if (!steamId) return res.json({ user: null });
  const { avatarUrl, personaName } = await getProfile(steamId);
  res.json({ user: { steamId, avatarUrl, personaName } });
}

export default withSentry(handler);

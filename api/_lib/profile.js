// Fetches a Steam user's display name and avatar URL from the public profile
// XML endpoint and caches the result in Redis for 24 hours.
import { Redis } from '@upstash/redis';

const PROFILE_TTL = 86400; // 24 hours

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Pulls the avatar + name out of either the ?xml=1 response or the normal
// profile HTML. Steam sometimes drops the CDATA wrapper or serves the HTML
// page instead of XML, so both shapes are accepted.
export function parseProfile(text) {
  const tag = (name) =>
    text.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`))?.[1]?.trim() || null;
  const avatarUrl =
    tag('avatarFull') ||
    tag('avatarMedium') ||
    text.match(/<link rel="image_src" href="([^"]+)"/)?.[1] ||
    text.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ||
    null;
  const personaName =
    tag('steamID') ||
    text.match(/<span class="actual_persona_name">([^<]+)<\/span>/)?.[1] ||
    null;
  return { avatarUrl, personaName };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return res.ok ? res.text() : '';
}

async function fetchFromSteam(steamId) {
  const base = `https://steamcommunity.com/profiles/${steamId}`;
  try {
    const profile = parseProfile(await fetchText(`${base}/?xml=1`));
    if (profile.avatarUrl) return profile;
    // XML gave nothing usable: try the regular profile page.
    const fromHtml = parseProfile(await fetchText(`${base}/`));
    return {
      avatarUrl: fromHtml.avatarUrl,
      personaName: profile.personaName || fromHtml.personaName,
    };
  } catch {
    return { avatarUrl: null, personaName: null };
  }
}

export async function getProfile(steamId) {
  const redis = getRedis();
  const key = `skinroi:profile:${steamId}`;

  if (redis) {
    const cached = await redis.get(key).catch(() => null);
    if (cached) return cached;
  }

  const profile = await fetchFromSteam(steamId);

  if (redis && profile.avatarUrl) {
    redis.set(key, profile, { ex: PROFILE_TTL }).catch(() => {});
  }

  return profile;
}

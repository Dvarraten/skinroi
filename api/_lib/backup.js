// Daily backup of every user's portfolio to a second Upstash database, so a
// bad save, a bug or a suspended main database can't lose the data.
//
// Runs as a Vercel cron (vercel.json) on GET /api/items?backup=1. Vercel
// sends `Authorization: Bearer $CRON_SECRET`; anything else gets 401.
// Needs env vars:
//   CRON_SECRET                 any long random string (Vercel adds it to cron calls)
//   BACKUP_REDIS_REST_URL       second Upstash database (free plan is fine)
//   BACKUP_REDIS_REST_TOKEN
// Without the backup database it answers 503 and copies nothing.
//
// Copies skinroi:items:{steamId} (and the value history when present) to
//   backup:{YYYY-MM-DD}:skinroi:items:{steamId}   kept KEEP_DAYS days
//   backup:latest:skinroi:items:{steamId}         no TTL, never older than a day
// An empty portfolio never replaces a non-empty `latest` copy, so a wiped
// list can always be brought back. Restore with scripts/restore-backup.js.
//
// Cost on the main database: one SCAN page per ~200 keys plus one MGET per
// 50 users, once a day. That's a few commands and the portfolio's size in
// bandwidth (tens to hundreds of KB), next to nothing on the free plan.

import { Redis } from '@upstash/redis';
import { getRedis } from './redis.js';

export const KEEP_DAYS = 30;
const PATTERNS = ['skinroi:items:*', 'skinroi:valuehist:*'];

function backupClient() {
  const url = process.env.BACKUP_REDIS_REST_URL;
  const token = process.env.BACKUP_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

async function scanAll(redis, match) {
  const keys = [];
  let cursor = '0';
  for (let i = 0; i < 100; i += 1) {
    const [next, batch] = await redis.scan(cursor, { match, count: 200 });
    keys.push(...batch);
    cursor = String(next);
    if (cursor === '0') break;
  }
  return keys;
}

const isEmpty = (v) => v == null || (Array.isArray(v) && v.length === 0);

// The keys to write for one source key, given what `latest` holds now.
export function backupWrites(key, value, latestValue, day) {
  if (value == null) return [];
  const writes = [{ key: `backup:${day}:${key}`, value, ttl: KEEP_DAYS * 24 * 60 * 60 }];
  // Keep the last non-empty copy as `latest`.
  if (!(isEmpty(value) && !isEmpty(latestValue))) writes.push({ key: `backup:latest:${key}`, value });
  return writes;
}

export async function runBackup(now = new Date()) {
  const target = backupClient();
  if (!target) return { ok: false, status: 503, error: 'BACKUP_REDIS_REST_URL / _TOKEN not set' };
  const source = getRedis();
  const day = now.toISOString().slice(0, 10);

  const keys = (await Promise.all(PATTERNS.map((p) => scanAll(source, p)))).flat();
  let copied = 0;
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, i + 50);
    const [values, latest] = await Promise.all([
      source.mget(...chunk),
      target.mget(...chunk.map((k) => `backup:latest:${k}`)),
    ]);
    const pipe = target.pipeline();
    let n = 0;
    chunk.forEach((key, j) => {
      for (const w of backupWrites(key, values[j], latest[j], day)) {
        if (w.ttl) pipe.set(w.key, w.value, { ex: w.ttl });
        else pipe.set(w.key, w.value);
        n += 1;
      }
    });
    if (n) await pipe.exec();
    copied += chunk.filter((_, j) => values[j] != null).length;
  }
  await target.set('backup:last-run', { at: now.toISOString(), keys: copied });
  return { ok: true, status: 200, day, keys: copied };
}

export async function handleBackup(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const result = await runBackup();
    return res.status(result.status).json(result);
  } catch (err) {
    console.error('[backup] failed', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

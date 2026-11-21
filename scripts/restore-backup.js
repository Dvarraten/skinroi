#!/usr/bin/env node
// Restore a portfolio from the backup database (see api/_lib/backup.js).
//
//   npm run backup -- list                         users with a backup + last run
//   npm run backup -- list <steamId>               that user's backup days and sizes
//   npm run backup -- restore <steamId> <day|latest> --yes
//
// Reads UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN) and
// BACKUP_REDIS_REST_URL/TOKEN from the environment or .env.local
// (`vercel env pull .env.local`). Before restoring, the current portfolio is
// copied to backup:pre-restore:{time}:skinroi:items:{steamId} in the backup
// database, so a restore can itself be undone.
const fs = require('fs');
const path = require('path');
const { Redis } = require('@upstash/redis');

function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

function client(url, token, label) {
  if (!url || !token) {
    console.error(`Missing ${label} env vars.`);
    process.exit(1);
  }
  return new Redis({ url, token });
}

async function scanAll(redis, match) {
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, { match, count: 500 });
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== '0');
  return keys.sort();
}

const describe = (v) => (Array.isArray(v) ? `${v.length} items` : v == null ? 'missing' : typeof v);

async function main() {
  loadEnvFile();
  const [cmd, steamId, day] = process.argv.slice(2);
  const backup = client(process.env.BACKUP_REDIS_REST_URL, process.env.BACKUP_REDIS_REST_TOKEN, 'BACKUP_REDIS_REST_URL/_TOKEN');

  if (cmd === 'list' && !steamId) {
    console.log('Last run:', await backup.get('backup:last-run'));
    const keys = await scanAll(backup, 'backup:latest:skinroi:items:*');
    for (const k of keys) console.log(k.split(':').pop(), describe(await backup.get(k)));
    return;
  }
  if (cmd === 'list') {
    const keys = await scanAll(backup, `backup:*:skinroi:items:${steamId}`);
    for (const k of keys) console.log(k.split(':')[1].padEnd(12), describe(await backup.get(k)));
    return;
  }
  if (cmd === 'restore' && steamId && day) {
    const value = await backup.get(`backup:${day}:skinroi:items:${steamId}`);
    if (!Array.isArray(value)) {
      console.error(`No backup for ${steamId} on ${day}. Try: list ${steamId}`);
      process.exit(1);
    }
    const main = client(
      process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
      process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
      'UPSTASH_REDIS_REST_URL/_TOKEN',
    );
    const key = `skinroi:items:${steamId}`;
    const current = await main.get(key);
    console.log(`Current: ${describe(current)}  →  backup ${day}: ${describe(value)}`);
    if (!process.argv.includes('--yes')) {
      console.log('Dry run. Add --yes to restore.');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (current != null) await backup.set(`backup:pre-restore:${stamp}:${key}`, current);
    await main.set(key, value);
    // Bump the version so open tabs reload instead of saving their old list.
    await main.incr(`skinroi:items-ver:${steamId}`);
    console.log('Restored. Reload the site.');
    return;
  }
  console.log('Usage: npm run backup -- list [steamId] | restore <steamId> <day|latest> --yes');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

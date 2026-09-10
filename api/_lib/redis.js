// Shared Upstash Redis client factory. Cached at the module level so warm
// serverless instances reuse the same TCP connection between invocations.

import { Redis } from '@upstash/redis';

let _client = null;

export function getRedis() {
  if (_client) return _client;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.STORAGE_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.STORAGE_KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Upstash Redis env vars missing — expected UPSTASH_REDIS_REST_URL/TOKEN ' +
        'or KV_REST_API_URL/TOKEN. Configure via Vercel → Storage → Upstash.'
    );
  }
  _client = new Redis({ url, token });
  return _client;
}

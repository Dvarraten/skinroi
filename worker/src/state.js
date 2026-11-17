// Small JSON files under worker/.state/ that survive restarts: the pairing
// secret and the CSFloat rate-limit gate (last call time, pause).

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR } from './config.js';

export function fileStore(name, dir = STATE_DIR) {
  const path = join(dir, `${name}.json`);
  return {
    path,
    read() {
      try {
        return JSON.parse(readFileSync(path, 'utf8')) || {};
      } catch {
        return {};
      }
    },
    write(value) {
      mkdirSync(dir, { recursive: true });
      // Write then rename, so a crash never leaves half a file.
      writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2));
      renameSync(`${path}.tmp`, path);
    },
  };
}

// In-memory store with the same shape, for tests.
export function memoryStore(initial = {}) {
  let value = { ...initial };
  return { read: () => ({ ...value }), write: (v) => { value = { ...v }; } };
}

// Pairs the worker with a pairing code from SkinROI's account menu, like the
// extension does, and saves the secret to worker/.state/pairing.json.
//   npm run pair -- ABCD-EFGH
//
// Note: the server keeps one "connected extension" per account, so this makes
// the site show the worker as the connection and resets its pairedAt. The
// extension's own secret keeps working. Copying the extension's secret into
// .env (see README) avoids both.

import { config } from './config.js';
import { claimCode } from './skinroi.js';
import { fileStore } from './state.js';

const code = (process.argv[2] || '').trim().toUpperCase();
if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) {
  console.error('Usage: npm run pair -- ABCD-EFGH  (code from the account menu on skinroi.com)');
  process.exit(1);
}
const normalized = code.includes('-') ? code : `${code.slice(0, 4)}-${code.slice(4)}`;
try {
  const { secret, steamId } = await claimCode({ baseUrl: config.skinroiUrl, code: normalized });
  fileStore('pairing').write({ secret, steamId, pairedAt: Date.now() });
  console.log(`Paired with Steam ID ${steamId}. Start the worker with: npm start`);
} catch (err) {
  console.error(`Pairing failed: ${err.message}`);
  process.exit(1);
}

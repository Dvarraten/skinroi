// First run: opens a visible browser with the worker's own profile so you can
// sign in to csfloat.com (via Steam) once. Cookies stay in worker/.profile and
// the worker reuses them headless. Close the window when you're done.

import { chromium } from 'playwright';
import { config, PROFILE_DIR } from './config.js';
import { launchOptions } from './browser.js';

const context = await chromium.launchPersistentContext(PROFILE_DIR, launchOptions({ headless: false }));
const page = context.pages()[0] || (await context.newPage());
await page.goto(`${config.csfloatOrigin}/`);
console.log('Sign in to CSFloat in the window (top right, "Sign in through Steam").');
console.log('Close the browser window when you see your avatar. The login is saved in worker/.profile.');
await new Promise((resolve) => context.on('close', resolve));
console.log('Saved. Start the worker with: npm start');

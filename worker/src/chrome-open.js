// Windows only: is the user's normal Chrome running? Then the extension does
// the CSFloat work itself and the worker sits the round out, so CSFloat isn't
// called twice from the same IP and SkinROI's Redis isn't written twice.
// Playwright's own Chromium is also called chrome.exe, so it is excluded by path.
// Only Chrome with an open window counts: after the last window closes, Chrome
// often keeps chrome.exe processes alive in the background (other extensions,
// "Continue running background apps"), which used to block every round.

import { execFile } from 'node:child_process';

const PS = "(Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -notlike '*ms-playwright*' } | Measure-Object).Count";

export function isChromeOpen() {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS], { timeout: 15_000, windowsHide: true },
      (err, stdout) => resolve(!err && Number(String(stdout).trim()) > 0));
  });
}

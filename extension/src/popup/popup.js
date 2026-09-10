// Popup controller — the small UI shown when the user clicks the extension
// icon. Handles pairing, disconnecting, showing activity, and a "Sync now"
// button that pokes the background service worker.

import { DEFAULT_BASE_URL, EXT_VERSION } from '../lib/config.js';
import {
  getPairing,
  savePairing,
  clearPairing,
  setBaseUrl,
  getActivity,
} from '../lib/storage.js';
import { claimCode } from '../lib/skinroi.js';
import { getSteamIdFromCookie } from '../lib/steam.js';

const $ = (sel) => document.querySelector(sel);

async function render() {
  const { baseUrl, secret, steamId, pairedAt } = await getPairing();
  $('#version').textContent = `v${EXT_VERSION}`;
  $('#base-url').value = baseUrl || DEFAULT_BASE_URL;
  $('#skinroi-link').href = baseUrl || DEFAULT_BASE_URL;

  if (secret && steamId) {
    $('#paired-section').classList.remove('hidden');
    $('#unpaired-section').classList.add('hidden');
    $('#steam-id').textContent = steamId;
    $('#paired-at').textContent = pairedAt ? new Date(pairedAt).toLocaleString() : '—';

    const cookieSteamId = await getSteamIdFromCookie();
    const el = $('#steam-session');
    if (!cookieSteamId) {
      el.textContent = 'Not signed in';
      el.style.color = 'var(--danger)';
    } else if (cookieSteamId !== steamId) {
      el.textContent = `Mismatch: ${cookieSteamId}`;
      el.style.color = 'var(--danger)';
    } else {
      el.textContent = 'Active';
      el.style.color = 'var(--accent)';
    }

    await renderActivity();
  } else {
    $('#paired-section').classList.add('hidden');
    $('#unpaired-section').classList.remove('hidden');
  }
}

async function renderActivity() {
  const list = await getActivity();
  const ul = $('#activity');
  ul.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No activity yet';
    ul.appendChild(li);
    return;
  }
  for (const entry of list.slice(0, 20)) {
    const li = document.createElement('li');
    const when = new Date(entry.at).toLocaleTimeString();
    let text;
    let cls = 'ok';
    if (entry.kind === 'push') {
      const t = entry.total ?? entry.accepted ?? 0;
      const a = entry.accepted ?? 0;
      text = `Detected ${a} new trade${a === 1 ? '' : 's'}${t !== a ? ` (${t} seen)` : ''}`;
    } else if (entry.kind === 'baseline') {
      text = entry.message || 'Historical trades seeded';
    } else if (entry.kind === 'info') {
      text = entry.message || '';
    } else if (entry.kind === 'error') {
      text = entry.message || 'Error';
      cls = 'err';
    } else {
      text = JSON.stringify(entry);
    }
    li.className = cls;
    li.innerHTML = `<span>${text}</span><span>${when}</span>`;
    ul.appendChild(li);
  }
}

$('#pair').addEventListener('click', async () => {
  const err = $('#pair-error');
  err.classList.add('hidden');
  const raw = $('#code-input').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(raw)) {
    err.textContent = 'Code must be 8 characters (XXXX-XXXX).';
    err.classList.remove('hidden');
    return;
  }
  const code = raw.includes('-') ? raw : `${raw.slice(0, 4)}-${raw.slice(4)}`;
  try {
    const result = await claimCode(code);
    await savePairing({ secret: result.secret, steamId: result.steamId });
    await render();
    // Kick off an immediate poll so the user sees activity right away.
    chrome.runtime.sendMessage({ type: 'runPollNow' });
  } catch (e) {
    err.textContent = e.message || 'Pairing failed';
    err.classList.remove('hidden');
  }
});

$('#unpair').addEventListener('click', async () => {
  if (!confirm('Disconnect the extension from SkinROI? Your portfolio stays intact.')) return;
  await clearPairing();
  await render();
});

$('#poll-now').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'runPollNow' }, () => renderActivity());
});

$('#save-base-url').addEventListener('click', async () => {
  const url = $('#base-url').value.trim().replace(/\/+$/, '');
  if (!url) return;
  await setBaseUrl(url);
  await render();
});

render();

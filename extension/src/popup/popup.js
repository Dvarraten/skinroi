// Popup controller: the small window behind the extension icon.
// Three views: Connect (not paired yet), Status (paired: is it working, check
// now, recent trades) and Settings (account, disconnect, developer options).

import { DEFAULT_BASE_URL, EXT_VERSION, POLL_INTERVAL_MIN } from '../lib/config.js';
import {
  getPairing,
  savePairing,
  clearPairing,
  setBaseUrl,
  getActivity,
  getLastPoll,
  getVerboseLogging,
  setVerboseLogging,
} from '../lib/storage.js';
import { claimCode } from '../lib/skinroi.js';
import { getSteamIdFromCookie } from '../lib/steam.js';
import { csfloatPausedUntil } from '../lib/csfloat.js';

const STEAM_LOGIN_URL = 'https://steamcommunity.com/login/home/';
const DAY_MS = 24 * 60 * 60 * 1000;

const $ = (sel) => document.querySelector(sel);
const show = (el, on) => el.classList.toggle('hidden', !on);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let settingsOpen = false;
let paired = false;
let baseUrl = DEFAULT_BASE_URL;

const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// "14:05" today, "Nov 12" on other days.
const shortWhen = (t) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString()
    ? clock(t)
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const ago = (t) => {
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

const openTab = (url) => chrome.tabs.create({ url });

// ── Views ───────────────────────────────────────────────────────────────────

async function render() {
  const pairing = await getPairing();
  baseUrl = pairing.baseUrl || DEFAULT_BASE_URL;
  paired = !!(pairing.secret && pairing.steamId);

  show($('#settings-view'), settingsOpen);
  show($('#connect-view'), !settingsOpen && !paired);
  show($('#status-view'), !settingsOpen && paired);
  $('#settings-toggle').setAttribute('aria-expanded', String(settingsOpen));
  $('#settings-toggle').title = settingsOpen ? 'Back' : 'Settings';

  if (settingsOpen) return renderSettings(pairing);
  if (paired) return renderStatus(pairing);
  $('#code-input').focus();
  return undefined;
}

async function renderSettings({ steamId, pairedAt }) {
  show($('#account-block'), paired);
  $('#steam-id').textContent = steamId || '';
  $('#paired-at').textContent = pairedAt
    ? new Date(pairedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
  show($('#unpair'), true);
  show($('#unpair-confirm'), false);
  $('#base-url').value = baseUrl;
  $('#verbose-logging').checked = await getVerboseLogging();
  $('#version').textContent = `SkinROI Sync ${EXT_VERSION}`;
}

// What the status line says, worst problem first. `action` is a button that
// fixes it; without one the user only has to wait.
function statusFrom({ steamId, cookieSteamId, lastPoll, lastError }) {
  if (!cookieSteamId) {
    return {
      tone: 'warn',
      title: 'Sign in to Steam',
      detail: 'Trades can be read once this browser is signed in to Steam.',
      action: { label: 'Open Steam', url: STEAM_LOGIN_URL },
    };
  }
  if (cookieSteamId !== steamId) {
    return {
      tone: 'bad',
      title: 'Wrong Steam account',
      detail: 'This browser is signed in to another Steam account than the one connected to SkinROI. Nothing is synced until they match.',
      action: { label: 'Open Steam', url: STEAM_LOGIN_URL },
    };
  }
  if (lastPoll && !lastPoll.ok) {
    if (lastPoll.reason === 'push_failed') {
      return {
        tone: 'bad',
        title: "Can't reach SkinROI",
        detail: `${String(lastError || 'The last sync was not accepted').replace(/[.\s]+$/, '')}. Tried ${ago(lastPoll.at)}.`,
      };
    }
    return {
      tone: 'warn',
      title: "Steam didn't answer",
      detail: `Tried ${ago(lastPoll.at)}. The next try is within ${POLL_INTERVAL_MIN} minutes.`,
    };
  }
  return {
    tone: 'ok',
    title: 'Syncing your trades',
    detail: lastPoll
      ? `Checked ${ago(lastPoll.at)}. Checks every ${POLL_INTERVAL_MIN} minutes.`
      : 'The first check starts within a minute.',
  };
}

async function renderStatus({ steamId }) {
  const [cookieSteamId, lastPoll, activity, pausedUntil] = await Promise.all([
    getSteamIdFromCookie(),
    getLastPoll(),
    getActivity(),
    csfloatPausedUntil(),
  ]);
  const lastError = activity.find((e) => e.kind === 'error')?.message || '';
  const status = statusFrom({ steamId, cookieSteamId, lastPoll, lastError });

  $('#status-dot').className = `dot ${status.tone}`;
  $('#status-title').textContent = status.title;
  $('#status-detail').textContent = status.detail;

  // A problem the user can fix gets the filled button; checking again comes second.
  const actionBtn = $('#status-action');
  show(actionBtn, !!status.action);
  if (status.action) {
    actionBtn.textContent = status.action.label;
    actionBtn.onclick = () => openTab(status.action.url);
  }
  $('#poll-now').classList.toggle('primary', !status.action);
  show($('#open-site'), !status.action);

  const note = $('#csfloat-note');
  show(note, !!pausedUntil);
  if (pausedUntil) {
    note.textContent = `CSFloat asked us to slow down, so its prices and listings are paused until ${clock(pausedUntil)}. Trades still sync.`;
  }

  renderActivity(activity);
  renderProblems(activity);
}

// Messages the "check now" button already answers on its own line.
const NOISE = new Set(['No new trades detected', 'Poll already running']);

function renderActivity(list) {
  const ul = $('#activity');
  ul.replaceChildren();
  let rows = 0;
  for (const entry of list) {
    if (rows >= 30) break;
    if (entry.kind === 'push') {
      const items = Array.isArray(entry.items) ? entry.items : [];
      if (items.length === 0) {
        const n = entry.accepted ?? 0;
        const li = el('li', 'quiet');
        li.append(el('span', 'dir'), el('span', 'name', `${n} new trade${n === 1 ? '' : 's'}`), el('span', 'when', shortWhen(entry.at)));
        ul.appendChild(li);
        rows += 1;
      }
      for (const item of items) {
        const incoming = item.type === 'incoming';
        const li = el('li');
        const dir = el('span', `dir ${incoming ? 'in' : 'out'}`, incoming ? '↓' : '↑');
        dir.title = incoming ? 'Received' : 'Sent';
        const name = el('span', 'name', item.marketHashName || 'Unknown item');
        name.title = name.textContent;
        const at = item.detectedAt ? new Date(item.detectedAt).getTime() : entry.at;
        li.append(dir, name, el('span', 'when', shortWhen(Number.isNaN(at) ? entry.at : at)));
        ul.appendChild(li);
        rows += 1;
      }
    } else if (entry.kind === 'info' && entry.message && !NOISE.has(entry.message)) {
      const li = el('li', 'quiet');
      li.append(el('span', 'dir'), el('span', 'name', entry.message), el('span', 'when', shortWhen(entry.at)));
      ul.appendChild(li);
      rows += 1;
    }
  }
  if (rows === 0) {
    ul.appendChild(el('li', 'empty', `Nothing yet. A trade you accept on Steam shows up here within ${POLL_INTERVAL_MIN} minutes.`));
  }
}

// Errors from the last 24 hours, with repeats of the same message folded into
// one line. Closed by default: the status line already names what matters.
function renderProblems(list) {
  const cutoff = Date.now() - DAY_MS;
  const seen = new Map();
  for (const entry of list) {
    if (entry.kind !== 'error' || entry.at < cutoff) continue;
    const message = entry.message || 'Error';
    const hit = seen.get(message);
    if (hit) hit.count += 1;
    else seen.set(message, { message, count: 1, at: entry.at });
  }
  const problems = [...seen.values()];
  const box = $('#problems');
  show(box, problems.length > 0);
  if (problems.length === 0) return;
  const total = problems.reduce((sum, p) => sum + p.count, 0);
  $('#problems-count').textContent = `${total} problem${total === 1 ? '' : 's'} in the last 24 hours`;
  const ul = $('#problems-list');
  ul.replaceChildren();
  for (const p of problems) {
    const li = el('li');
    li.append(el('span', '', p.count > 1 ? `${p.message} (${p.count} times)` : p.message), el('span', '', shortWhen(p.at)));
    ul.appendChild(li);
  }
}

// ── Connect ─────────────────────────────────────────────────────────────────

// Keeps the field as XXXX-XXXX whatever is typed or pasted.
function formatCode(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
const codeComplete = (value) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value);

async function pair() {
  const input = $('#code-input');
  const button = $('#pair');
  const error = $('#pair-error');
  if (!codeComplete(input.value) || button.dataset.busy) return;
  show(error, false);
  button.dataset.busy = '1';
  button.disabled = true;
  button.textContent = 'Connecting…';
  try {
    const result = await claimCode(input.value);
    await savePairing({ secret: result.secret, steamId: result.steamId });
    input.value = '';
    // Check right away so the status line has something to say.
    chrome.runtime.sendMessage({ type: 'runPollNow' }, () => { void chrome.runtime.lastError; render(); });
    await render();
  } catch (e) {
    error.textContent = pairErrorText(e);
    show(error, true);
    input.select();
  } finally {
    delete button.dataset.busy;
    button.textContent = 'Connect';
    button.disabled = !codeComplete(input.value);
  }
}

function pairErrorText(e) {
  const message = String(e?.message || '');
  if (/failed to fetch|networkerror/i.test(message)) return "Couldn't reach SkinROI. Check your connection and try again.";
  if (/already_claimed/i.test(message)) return 'That code has already been used. Generate a new one on SkinROI.';
  if (/invalid|expired|not found|unknown/i.test(message)) return 'That code is wrong or has expired. Generate a new one on SkinROI.';
  return message || 'Connecting failed. Try a new code.';
}

$('#code-input').addEventListener('input', (e) => {
  const input = e.target;
  input.value = formatCode(input.value);
  show($('#pair-error'), false);
  $('#pair').disabled = !codeComplete(input.value);
  // A pasted code is complete at once: connect without another click.
  if (e.inputType === 'insertFromPaste' && codeComplete(input.value)) pair();
});
$('#pair-form').addEventListener('submit', (e) => { e.preventDefault(); pair(); });
$('#open-site-connect').addEventListener('click', () => openTab(baseUrl));

// ── Status ──────────────────────────────────────────────────────────────────

function pollResultText(response) {
  if (!response?.ok) return 'The check failed. Try again in a moment.';
  const r = response.result || {};
  if (r.skipped === 'in_flight') return 'A check is already running.';
  if (r.skipped === 'not_logged_in_to_steam') return 'Sign in to Steam first.';
  if (r.skipped === 'steam_id_mismatch') return 'This browser is on another Steam account.';
  if (r.skipped === 'push_failed') return "Couldn't send the trades to SkinROI.";
  if (r.skipped) return "Steam didn't answer. Try again in a moment.";
  const n = r.accepted || 0;
  return n > 0 ? `${n} new trade${n === 1 ? '' : 's'} sent to SkinROI.` : 'No new trades.';
}

$('#poll-now').addEventListener('click', () => {
  const button = $('#poll-now');
  const result = $('#poll-result');
  button.disabled = true;
  button.textContent = 'Checking…';
  result.textContent = '';
  chrome.runtime.sendMessage({ type: 'runPollNow' }, async (response) => {
    void chrome.runtime.lastError;
    await render();
    button.disabled = false;
    button.textContent = 'Check for trades now';
    result.textContent = pollResultText(response);
  });
});
$('#open-site').addEventListener('click', () => openTab(baseUrl));

// ── Settings ────────────────────────────────────────────────────────────────

$('#settings-toggle').addEventListener('click', () => {
  settingsOpen = !settingsOpen;
  render();
});

$('#unpair').addEventListener('click', () => {
  show($('#unpair'), false);
  show($('#unpair-confirm'), true);
});
$('#unpair-no').addEventListener('click', () => {
  show($('#unpair'), true);
  show($('#unpair-confirm'), false);
});
$('#unpair-yes').addEventListener('click', async () => {
  await clearPairing();
  settingsOpen = false;
  await render();
});

$('#base-url-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('#base-url').value.trim().replace(/\/+$/, '');
  if (!url) return;
  await setBaseUrl(url);
  baseUrl = url;
  $('#base-url-saved').textContent = 'Saved.';
});

$('#verbose-logging').addEventListener('change', async (e) => {
  await setVerboseLogging(e.target.checked);
});

render();

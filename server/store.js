/**
 * Tiny persistent JSON store with atomic writes.
 *
 * Replaces the original in-memory object so unlocks, payment state and the
 * leaderboard survive restarts. For higher scale, swap this module for a real
 * database — the interface (getters/mutators below) is intentionally small.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT = { unlocks: {}, payments: {}, scores: [], rewards: {} };

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

function load() {
  try { return { ...DEFAULT, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { return JSON.parse(JSON.stringify(DEFAULT)); }
}

let cache = load();
let writeQueued = false;

function persist() {
  // Debounced atomic write: serialize to a temp file then rename.
  if (writeQueued) return;
  writeQueued = true;
  setImmediate(() => {
    writeQueued = false;
    try {
      ensureDir();
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(cache));
      fs.renameSync(tmp, FILE);
    } catch (e) { console.error('store persist failed:', e.message); }
  });
}

module.exports = {
  hasUnlock: (uid) => Boolean(uid && cache.unlocks[uid]),
  grantUnlock: (uid) => { if (uid) { cache.unlocks[uid] = true; persist(); } },

  getPayment: (id) => cache.payments[id] || null,
  setPayment: (id, data) => { cache.payments[id] = { ...cache.payments[id], ...data }; persist(); },

  /** Insert a validated score and return the current top-N leaderboard. */
  addScore: (entry) => { cache.scores.push(entry); cache.scores.sort((a, b) => b.score - a.score); if (cache.scores.length > 1000) cache.scores.length = 1000; persist(); },
  topScores: (n = 20, dailyOnly = false, day = null) =>
    cache.scores
      .filter((s) => (dailyOnly ? s.daily && s.day === day : true))
      .slice(0, n)
      .map(({ name, score, coins, distance, ts }) => ({ name, score, coins, distance, ts })),

  /** Reward ledger, per user, reset each UTC day. Tracks payouts + dedupe sets. */
  getLedger: (uid, day) => {
    const l = cache.rewards[uid];
    if (!l || l.day !== day) return { day, claimedPi: 0, runs: {}, ads: {}, payouts: [] };
    return l;
  },
  saveLedger: (uid, ledger) => { cache.rewards[uid] = ledger; persist(); },
};

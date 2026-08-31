/**
 * Tiny persistent JSON store with atomic writes.
 *
 * Replaces the original in-memory object so unlocks, payment state, the
 * leaderboard, the local node identity and Node Challenge state survive
 * restarts. For higher scale, swap this module for a real database — the
 * interface (getters/mutators below) is intentionally small.
 *
 * Schema is versioned (`schemaVersion`) and migrated forward on load. Bounded
 * retention is applied on every persist so the file cannot grow without limit.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const log = require('./log');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'store.json');

const SCHEMA_VERSION = 2;

// Retention knobs (env-tunable; all bounded).
const CHALLENGE_RETENTION_DAYS = clampInt(process.env.CHALLENGE_RETENTION_DAYS, 30, 1, 365);
const SESSION_RETENTION_MS = clampInt(process.env.SESSION_RETENTION_HOURS, 48, 1, 24 * 30) * 3600 * 1000;
const MAX_SCORES = 1000;
const MAX_LEADERBOARD_ENTRIES = 500; // per challenge

function clampInt(v, dflt, lo, hi) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

const DEFAULT = () => ({
  schemaVersion: SCHEMA_VERSION,
  unlocks: {},
  payments: {},
  scores: [],
  rewards: {},
  node: null, // { id, secret, createdAt } — populated by server/node/identity.js
  challenge: {
    sessions: {},      // runId -> session record
    leaderboards: {},   // challengeId -> { challengeId, day, entries: [] }
    counters: {},       // "YYYY-MM-DD" -> { verified, rejected }
  },
});

/** Reject keys that could pollute Object.prototype when used as a map key. */
function safeKey(k) {
  return typeof k === 'string' && k !== '__proto__' && k !== 'prototype' && k !== 'constructor';
}

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

function migrate(raw) {
  const base = DEFAULT();
  if (!raw || typeof raw !== 'object') return base;
  // v1 had no schemaVersion and no node/challenge namespaces.
  const merged = {
    ...base,
    ...raw,
    challenge: { ...base.challenge, ...(raw.challenge || {}) },
  };
  merged.challenge.sessions = merged.challenge.sessions || {};
  merged.challenge.leaderboards = merged.challenge.leaderboards || {};
  merged.challenge.counters = merged.challenge.counters || {};
  merged.schemaVersion = SCHEMA_VERSION;
  return merged;
}

function load() {
  try {
    return migrate(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    return DEFAULT();
  }
}

let cache = load();
let writeQueued = false;

/** Drop retention-expired data. Runs before each persist; cheap and bounded. */
function prune() {
  if (cache.scores.length > MAX_SCORES) cache.scores.length = MAX_SCORES;

  const cutoffDay = daysAgoKey(CHALLENGE_RETENTION_DAYS);
  for (const id of Object.keys(cache.challenge.leaderboards)) {
    const lb = cache.challenge.leaderboards[id];
    if (lb && typeof lb.day === 'string' && lb.day < cutoffDay) {
      delete cache.challenge.leaderboards[id];
    } else if (lb && Array.isArray(lb.entries) && lb.entries.length > MAX_LEADERBOARD_ENTRIES) {
      lb.entries.sort((a, b) => b.score - a.score);
      lb.entries.length = MAX_LEADERBOARD_ENTRIES;
    }
  }
  for (const day of Object.keys(cache.challenge.counters)) {
    if (day < cutoffDay) delete cache.challenge.counters[day];
  }
  const sessionCutoff = Date.now() - SESSION_RETENTION_MS;
  for (const runId of Object.keys(cache.challenge.sessions)) {
    const s = cache.challenge.sessions[runId];
    if (!s || (s.issuedAt || 0) < sessionCutoff) delete cache.challenge.sessions[runId];
  }
}

function serialize() {
  // node.secret stays in the file (it must survive restart) but never leaves
  // the store module via an API — see server/node/identity.js publicView().
  return JSON.stringify(cache);
}

function persist() {
  if (writeQueued) return;
  writeQueued = true;
  setImmediate(() => {
    writeQueued = false;
    try {
      prune();
      ensureDir();
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, serialize());
      fs.renameSync(tmp, FILE);
    } catch (e) {
      log.error('store.error', { op: 'persist', message: e.message });
    }
  });
}

/** Synchronous flush for graceful shutdown — no debounce. */
function flushSync() {
  try {
    prune();
    ensureDir();
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, serialize());
    fs.renameSync(tmp, FILE);
    return true;
  } catch (e) {
    log.error('store.error', { op: 'flushSync', message: e.message });
    return false;
  }
}

// ---- date helpers (UTC) --------------------------------------------------
function dayKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function daysAgoKey(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return dayKey(d);
}

module.exports = {
  SCHEMA_VERSION,
  flushSync,
  dayKey,

  // ---- existing surface (unchanged behaviour) --------------------------
  hasUnlock: (uid) => Boolean(uid && cache.unlocks[uid]),
  grantUnlock: (uid) => { if (uid && safeKey(uid)) { cache.unlocks[uid] = true; persist(); } },

  getPayment: (id) => (safeKey(id) ? cache.payments[id] || null : null),
  setPayment: (id, data) => {
    if (!safeKey(id)) return;
    cache.payments[id] = { ...cache.payments[id], ...data };
    persist();
  },

  addScore: (entry) => {
    cache.scores.push(entry);
    cache.scores.sort((a, b) => b.score - a.score);
    if (cache.scores.length > MAX_SCORES) cache.scores.length = MAX_SCORES;
    persist();
  },
  topScores: (n = 20, dailyOnly = false, day = null) =>
    cache.scores
      .filter((s) => (dailyOnly ? s.daily && s.day === day : true))
      .slice(0, n)
      .map(({ name, score, coins, distance, ts }) => ({ name, score, coins, distance, ts })),

  getLedger: (uid, day) => {
    const l = cache.rewards[uid];
    if (!l || l.day !== day) return { day, claimedPi: 0, runs: {}, ads: {}, payouts: [] };
    return l;
  },
  saveLedger: (uid, ledger) => { if (safeKey(uid)) { cache.rewards[uid] = ledger; persist(); } },

  // ---- node identity --------------------------------------------------
  getNode: () => cache.node,
  setNode: (node) => { cache.node = node; persist(); },

  // ---- Node Challenge: run sessions ----------------------------------
  getSession: (runId) => (safeKey(runId) ? cache.challenge.sessions[runId] || null : null),
  putSession: (session) => {
    if (!session || !safeKey(session.runId)) return;
    cache.challenge.sessions[session.runId] = session;
    persist();
  },

  // ---- Node Challenge: verified leaderboard -------------------------
  getChallengeLeaderboard: (challengeId) =>
    (safeKey(challengeId) ? cache.challenge.leaderboards[challengeId] || null : null),
  /**
   * Upsert a verified entry, keeping the best score per identity and one entry
   * per runId. Returns the stored leaderboard board.
   */
  upsertChallengeEntry: (challengeId, day, entry) => {
    if (!safeKey(challengeId)) return null;
    let board = cache.challenge.leaderboards[challengeId];
    if (!board) { board = { challengeId, day, entries: [] }; cache.challenge.leaderboards[challengeId] = board; }
    // one row per runId
    if (board.entries.some((e) => e.runId === entry.runId)) { persist(); return board; }
    const existingIdx = board.entries.findIndex((e) => e.identityKey === entry.identityKey);
    if (existingIdx >= 0) {
      if (entry.score > board.entries[existingIdx].score) board.entries[existingIdx] = entry;
    } else {
      board.entries.push(entry);
    }
    board.entries.sort((a, b) => b.score - a.score || a.verifiedAt - b.verifiedAt);
    if (board.entries.length > MAX_LEADERBOARD_ENTRIES) board.entries.length = MAX_LEADERBOARD_ENTRIES;
    persist();
    return board;
  },

  // ---- Node Challenge: daily verify/reject counters ----------------
  getCounters: (day) => cache.challenge.counters[day] || { verified: 0, rejected: 0 },
  bumpCounter: (day, kind) => {
    if (!safeKey(day) || (kind !== 'verified' && kind !== 'rejected')) return;
    const c = cache.challenge.counters[day] || { verified: 0, rejected: 0 };
    c[kind] += 1;
    cache.challenge.counters[day] = c;
    persist();
  },

  // ---- test-only: reset in-memory cache from disk ------------------
  _reload: () => { cache = load(); },
};

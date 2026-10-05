/**
 * Deterministic Node Challenge derivation.
 *
 * A "challenge" is a shared, reproducible course: everyone who plays the same
 * challenge id plays the exact same seeded layout under the same rules, so
 * server-verified scores are directly comparable.
 *
 * ── Challenge id ────────────────────────────────────────────────────────────
 *   daily:<UTC-date>:v<RULES_VERSION>          e.g. "daily:2026-08-31:v1"
 *   practice:<UTC-date>:v<RULES_VERSION>       (not leaderboard-eligible)
 *
 * The UTC date is taken from SERVER time — the browser cannot select an easier
 * day or an arbitrary seed.
 *
 * ── Seed derivation (documented, reproducible) ─────────────────────────────
 *   material = "pi-runner/node-challenge|<type>|<UTC-date>|rules=<R>|sim=<S>"
 *   digest   = HMAC-SHA256(key = NAMESPACE_KEY, message = material)
 *   seed     = digest.readUInt32BE(0)              // 32-bit unsigned
 *
 *   NAMESPACE_KEY defaults to a FIXED PUBLIC STRING so that every Pi Runner
 *   node on Earth derives the *same* daily seed with no shared secret — this is
 *   what makes a future cross-node "same course everywhere" challenge possible.
 *
 *   Setting NODE_CHALLENGE_SECRET overrides the key. Use it only for private,
 *   single-node (NODE_LOCAL) challenges where you want the seed unpredictable
 *   until the day begins. A custom secret makes your leaderboard incomparable
 *   with other nodes — by design.
 *
 * Weak PRNGs (Math.random, Date-based) are deliberately NOT used: the seed must
 * be a pure function of (namespace, date, versions).
 */
'use strict';
const crypto = require('crypto');
const { RULES_VERSION, SIMULATION_VERSION } = require('../version');

const PUBLIC_NAMESPACE_KEY = 'pi-runner/node-challenge/public-namespace/v1';
const NAMESPACE = 'pi-runner/node-challenge';

const TYPES = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  NODE_LOCAL: 'node-local',
  PRACTICE: 'practice',
});

const LEADERBOARD_ELIGIBLE = new Set([TYPES.DAILY, TYPES.WEEKLY, TYPES.NODE_LOCAL]);

function namespaceKey() {
  const s = process.env.NODE_CHALLENGE_SECRET;
  return s && s.length >= 8 ? s : PUBLIC_NAMESPACE_KEY;
}

/** Whether this node derives seeds from the shared public namespace. */
function usesPublicNamespace() {
  const s = process.env.NODE_CHALLENGE_SECRET;
  return !(s && s.length >= 8);
}

// ---- UTC calendar helpers ------------------------------------------------
function utcDateKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function startOfUtcDay(d = new Date()) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
}
function isoWeekKey(d = new Date()) {
  // ISO-8601 week number, UTC.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Derive the deterministic 32-bit seed for a challenge. */
function deriveSeed(type, periodKey) {
  const material = `${NAMESPACE}|${type}|${periodKey}|rules=${RULES_VERSION}|sim=${SIMULATION_VERSION}`;
  const digest = crypto.createHmac('sha256', namespaceKey()).update(material).digest();
  return digest.readUInt32BE(0) >>> 0;
}

/**
 * Build the challenge descriptor for a given type at a given instant.
 * @param {string} type   one of TYPES
 * @param {Date}   now    server time (defaults to new Date())
 */
function buildChallenge(type = TYPES.DAILY, now = new Date()) {
  if (!Object.values(TYPES).includes(type)) type = TYPES.DAILY;

  let periodKey;
  let startsAt;
  let endsAt;
  if (type === TYPES.WEEKLY) {
    periodKey = isoWeekKey(now);
    const t = new Date(now);
    const day = t.getUTCDay() || 7;
    const monday = startOfUtcDay(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - (day - 1))));
    startsAt = monday;
    endsAt = monday + 7 * 86400000;
  } else {
    periodKey = utcDateKey(now);
    startsAt = startOfUtcDay(now);
    endsAt = startsAt + 86400000;
  }

  const id = `${type}:${periodKey}:v${RULES_VERSION}`;
  return {
    id,
    type,
    seed: deriveSeed(type, periodKey),
    rulesVersion: RULES_VERSION,
    simulationVersion: SIMULATION_VERSION,
    periodKey,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    createdAt: new Date(now).toISOString(),
    status: 'active',
    leaderboardEligible: LEADERBOARD_ELIGIBLE.has(type),
    seedNamespace: usesPublicNamespace() ? 'public' : 'node-private',
  };
}

/** The challenge that is currently live for competitive play (DAILY). */
function currentChallenge(now = new Date()) {
  return buildChallenge(TYPES.DAILY, now);
}

/**
 * Parse a challenge id back into a descriptor, validating it against the CURRENT
 * rules/version and time window. Returns null if the id is malformed.
 */
function parseChallengeId(id, now = new Date()) {
  if (typeof id !== 'string' || id.length > 64) return null;
  const m = /^([a-z-]+):([0-9A-Za-z-]+):v(\d+)$/.exec(id);
  if (!m) return null;
  const [, type, periodKey, rulesV] = m;
  if (!Object.values(TYPES).includes(type)) return null;

  // Re-derive from the parsed period so a stale/foreign id still yields its seed.
  const seed = deriveSeed(type, periodKey);
  let startsAt;
  let endsAt;
  if (type === TYPES.WEEKLY) {
    startsAt = null; endsAt = null; // window not reconstructed for weekly ids here
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
    const [y, mo, da] = periodKey.split('-').map(Number);
    const s = Date.UTC(y, mo - 1, da);
    startsAt = new Date(s).toISOString();
    endsAt = new Date(s + 86400000).toISOString();
  } else {
    startsAt = null; endsAt = null;
  }

  return {
    id,
    type,
    seed,
    rulesVersion: Number(rulesV),
    simulationVersion: SIMULATION_VERSION,
    periodKey,
    startsAt,
    endsAt,
    leaderboardEligible: LEADERBOARD_ELIGIBLE.has(type),
    isCurrentRules: Number(rulesV) === RULES_VERSION,
  };
}

/** Is `id` the challenge that is currently open for competitive submission? */
function isCurrent(id, now = new Date()) {
  return id === currentChallenge(now).id;
}

module.exports = {
  TYPES,
  buildChallenge,
  currentChallenge,
  parseChallengeId,
  isCurrent,
  deriveSeed,
  usesPublicNamespace,
  utcDateKey,
  isoWeekKey,
};

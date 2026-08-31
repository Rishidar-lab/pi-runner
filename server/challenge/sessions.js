/**
 * Node Challenge run sessions.
 *
 * A competitive run is not a free-floating score submission — the server issues
 * it. `POST /api/challenge/start` mints a session bound to the current challenge
 * with an unpredictable runId and an expiry. The client must play the seed it
 * was issued and submit before the session expires. A runId can be submitted
 * once.
 *
 * State machine (enforced):
 *   ISSUED ──▶ STARTED ──▶ SUBMITTED ──▶ VERIFIED
 *      │           │            └───────▶ REJECTED
 *      └───────────┴──────────────────▶ EXPIRED   (lazily, once past expiresAt)
 */
'use strict';
const crypto = require('crypto');
const store = require('../store');
const node = require('../node/identity');
const { currentChallenge } = require('./challenge');
const { RULES_VERSION, SIMULATION_VERSION, TAPE_VERSION } = require('../version');

const RUN_TTL_MS = clampInt(process.env.CHALLENGE_RUN_TTL_MINUTES, 20, 2, 180) * 60 * 1000;

function clampInt(v, dflt, lo, hi) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

const STATES = Object.freeze({
  ISSUED: 'ISSUED',
  STARTED: 'STARTED',
  SUBMITTED: 'SUBMITTED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
});

const TRANSITIONS = {
  ISSUED: new Set(['STARTED', 'SUBMITTED', 'EXPIRED']),
  STARTED: new Set(['SUBMITTED', 'EXPIRED']),
  SUBMITTED: new Set(['VERIFIED', 'REJECTED']),
  VERIFIED: new Set([]),
  REJECTED: new Set([]),
  EXPIRED: new Set([]),
};

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].has(to));
}

/** Create a new run session for the currently-live challenge. */
function issue(now = new Date()) {
  const challenge = currentChallenge(now);
  const runId = crypto.randomBytes(16).toString('hex');
  const issuedAt = now.getTime();
  const session = {
    runId,
    challengeId: challenge.id,
    challengeType: challenge.type,
    seed: challenge.seed,
    rulesVersion: RULES_VERSION,
    simulationVersion: SIMULATION_VERSION,
    tapeVersion: TAPE_VERSION,
    status: STATES.ISSUED,
    issuedAt,
    expiresAt: issuedAt + RUN_TTL_MS,
    startedAt: null,
    submittedAt: null,
    resolvedAt: null,
    // token lets the server confirm it issued this exact (runId, seed, challenge)
    token: node.sign(`${runId}|${challenge.id}|${challenge.seed}|${issuedAt}`),
    nodeIdShort: node.publicView().idShort,
    identityKey: null,
    result: null,
  };
  store.putSession(session);
  return session;
}

/** Load a session, applying a lazy EXPIRED transition if past its deadline. */
function get(runId, now = Date.now()) {
  const s = store.getSession(runId);
  if (!s) return null;
  if ((s.status === STATES.ISSUED || s.status === STATES.STARTED) && now > s.expiresAt) {
    s.status = STATES.EXPIRED;
    s.resolvedAt = now;
    store.putSession(s);
  }
  return s;
}

function transition(session, to, patch = {}) {
  if (!canTransition(session.status, to)) {
    throw new Error(`illegal session transition ${session.status} -> ${to}`);
  }
  Object.assign(session, patch, { status: to });
  store.putSession(session);
  return session;
}

/** Verify the server actually issued this session as-is (anti-forgery). */
function tokenValid(session) {
  return node.verify(
    `${session.runId}|${session.challengeId}|${session.seed}|${session.issuedAt}`,
    session.token,
  );
}

/** Public, client-safe view of a session. */
function view(session) {
  return {
    runId: session.runId,
    challengeId: session.challengeId,
    seed: session.seed,
    status: session.status,
    issuedAt: new Date(session.issuedAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    rulesVersion: session.rulesVersion,
    simulationVersion: session.simulationVersion,
    tapeVersion: session.tapeVersion,
  };
}

module.exports = {
  STATES,
  RUN_TTL_MS,
  issue,
  get,
  transition,
  canTransition,
  tokenValid,
  view,
};

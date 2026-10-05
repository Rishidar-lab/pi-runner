/**
 * Node Challenge HTTP surface.
 *
 *   GET  /api/challenge/current      the live challenge (id + deterministic seed)
 *   POST /api/challenge/start        mint a server-issued run session
 *   POST /api/challenge/submit       submit an input tape -> authoritative replay
 *   GET  /api/challenge/leaderboard  VERIFIED-only rankings for a challenge
 *   GET  /api/challenge/me           one identity's standing in a challenge
 *   GET  /api/node/status            local node dashboard data
 *
 * The browser is never trusted for score/distance/coins/rank/eligibility. The
 * only authority is server-side re-simulation in ./replay.js.
 */
'use strict';
const express = require('express');

const log = require('../log');
const store = require('../store');
const node = require('../node/identity');
const { rateLimit } = require('../security');
const { currentChallenge } = require('./challenge');
const sessions = require('./sessions');
const tape = require('./tape');
const replay = require('./replay');
const identity = require('./identity');
const { getCoordinator } = require('./coordinator');
const { APP_VERSION, SIMULATION_VERSION, RULES_VERSION, TAPE_VERSION } = require('../version');

const START_TIME = Date.now();

function publicChallengeView(c) {
  return {
    id: c.id,
    type: c.type,
    seed: c.seed,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    rulesVersion: c.rulesVersion,
    simulationVersion: c.simulationVersion,
    seedNamespace: c.seedNamespace,
  };
}

function todaySummary() {
  const day = store.dayKey(new Date());
  const counters = store.getCounters(day);
  const board = store.getChallengeLeaderboard(currentChallenge().id);
  const best = board && board.entries.length
    ? board.entries.reduce((m, e) => Math.max(m, e.score), 0)
    : 0;
  return {
    day,
    verifiedRuns: counters.verified,
    rejectedRuns: counters.rejected,
    bestVerifiedScore: best,
  };
}

function makeRouter() {
  const router = express.Router();
  const coordinator = getCoordinator();

  // Route-scoped body limit for tape submission (tighter than the global limit).
  const tapeJson = express.json({ limit: process.env.CHALLENGE_BODY_LIMIT || '192kb' });

  const readLimit = rateLimit({ windowMs: 60_000, max: 120, name: 'challenge-read' });
  const startLimit = rateLimit({ windowMs: 60_000, max: 30, name: 'challenge-start' });
  const submitLimit = rateLimit({ windowMs: 60_000, max: 20, name: 'challenge-submit' });

  // ---- current challenge ------------------------------------------------
  router.get('/api/challenge/current', readLimit, (_req, res) => {
    const c = currentChallenge();
    res.json({ ok: true, challenge: publicChallengeView(c) });
  });

  // ---- start a run session -------------------------------------------
  router.post('/api/challenge/start', startLimit, (_req, res) => {
    try {
      const session = sessions.issue();
      log.info('challenge.run_issued', {
        runId: session.runId,
        challengeId: session.challengeId,
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
      res.json({
        ok: true,
        run: {
          runId: session.runId,
          challengeId: session.challengeId,
          seed: session.seed,
          issuedAt: new Date(session.issuedAt).toISOString(),
          expiresAt: new Date(session.expiresAt).toISOString(),
          rulesVersion: session.rulesVersion,
          simulationVersion: session.simulationVersion,
          tapeVersion: session.tapeVersion,
        },
      });
    } catch (e) {
      log.error('challenge.start_error', { message: e.message });
      res.status(500).json({ ok: false, error: 'could not start run' });
    }
  });

  // ---- submit an input tape -----------------------------------------
  router.post('/api/challenge/submit', submitLimit, tapeJson, async (req, res) => {
    const body = req.body || {};

    // 1) structural validation before spending CPU on replay
    const shape = tape.validate(body);
    if (!shape.ok) {
      return res.status(400).json({ ok: false, verified: false, reason: shape.reason });
    }
    const t = shape.tape;

    // 2) the run session must exist and be one we issued
    const session = sessions.get(t.runId);
    if (!session || !sessions.tokenValid(session)) {
      return res.status(404).json({ ok: false, verified: false, reason: 'INVALID_RUN_ID' });
    }

    // 2a) idempotent replays of an already-resolved run
    if (session.status === sessions.STATES.VERIFIED) {
      return res.json({ ok: true, verified: true, idempotent: true, result: session.result });
    }
    if (session.status === sessions.STATES.REJECTED) {
      return res.json({
        ok: false, verified: false, idempotent: true,
        reason: (session.result && session.result.reason) || 'REPLAY_MISMATCH',
      });
    }
    if (session.status === sessions.STATES.SUBMITTED) {
      return res.status(409).json({ ok: false, verified: false, reason: 'RUN_IN_PROGRESS' });
    }
    if (session.status === sessions.STATES.EXPIRED) {
      return res.status(409).json({ ok: false, verified: false, reason: 'RUN_EXPIRED' });
    }
    if (session.status !== sessions.STATES.ISSUED && session.status !== sessions.STATES.STARTED) {
      return res.status(409).json({ ok: false, verified: false, reason: 'RUN_ALREADY_USED' });
    }

    // 3) the tape must describe the exact run we issued
    if (t.challengeId !== session.challengeId) {
      return res.status(400).json({ ok: false, verified: false, reason: 'CHALLENGE_MISMATCH' });
    }
    if (t.seed !== session.seed) {
      return res.status(400).json({ ok: false, verified: false, reason: 'SEED_MISMATCH' });
    }
    if (t.simulationVersion !== session.simulationVersion) {
      return res.status(400).json({ ok: false, verified: false, reason: 'VERSION_MISMATCH' });
    }

    // 4) bind an identity (verified Pi, or explicit local)
    const who = await identity.resolve({ accessToken: body.accessToken, localName: body.localName });
    if (!who.ok) {
      return res.status(401).json({ ok: false, verified: false, reason: who.reason });
    }

    // 5) advance the state machine and re-simulate
    sessions.transition(session, sessions.STATES.STARTED, { startedAt: Date.now() });
    sessions.transition(session, sessions.STATES.SUBMITTED, {
      submittedAt: Date.now(),
      identityKey: who.identity.identityKey,
    });
    log.info('challenge.run_submitted', { runId: t.runId, challengeId: t.challengeId });

    let verification;
    try {
      verification = await replay.verify(t);
    } catch (e) {
      log.error('challenge.replay_error', { runId: t.runId, message: e.message });
      sessions.transition(session, sessions.STATES.REJECTED, {
        resolvedAt: Date.now(),
        result: { reason: 'REPLAY_ERROR' },
      });
      coordinator.recordRejectedRun({ challengeId: t.challengeId, reason: 'REPLAY_ERROR' });
      return res.status(500).json({ ok: false, verified: false, reason: 'REPLAY_ERROR' });
    }

    if (!verification.ok) {
      sessions.transition(session, sessions.STATES.REJECTED, {
        resolvedAt: Date.now(),
        result: { reason: verification.reason },
      });
      coordinator.recordRejectedRun({ challengeId: t.challengeId, reason: verification.reason });
      log.warn('challenge.verify_fail', {
        runId: t.runId, challengeId: t.challengeId,
        reason: verification.reason, latencyMs: verification.latencyMs,
      });
      // Reason code only — server's authoritative numbers are not disclosed.
      return res.json({ ok: false, verified: false, reason: verification.reason });
    }

    const a = verification.authoritative;
    const entry = {
      runId: t.runId,
      challengeId: t.challengeId,
      identityKey: who.identity.identityKey,
      identityKind: who.identity.kind,
      uid: who.identity.uid,
      username: who.identity.username,
      score: a.score,
      distance: a.distance,
      coins: a.coins,
      nodeIdShort: node.publicView().idShort,
      verifiedAt: Date.now(),
    };
    coordinator.publishVerifiedRun(entry);

    const result = {
      score: a.score,
      distance: a.distance,
      coins: a.coins,
      challengeId: t.challengeId,
      verifiedAt: new Date(entry.verifiedAt).toISOString(),
    };
    sessions.transition(session, sessions.STATES.VERIFIED, {
      resolvedAt: entry.verifiedAt,
      result,
    });

    const standing = coordinator.getIdentityStanding(t.challengeId, who.identity.identityKey);
    log.info('challenge.verify_ok', {
      runId: t.runId, challengeId: t.challengeId,
      score: a.score, rank: standing.rank, latencyMs: verification.latencyMs,
    });

    res.json({
      ok: true,
      verified: true,
      result,
      rank: standing.found ? standing.rank : null,
      totalRanked: standing.total || null,
      identityKind: who.identity.kind,
      nodeIdShort: entry.nodeIdShort,
      latencyMs: verification.latencyMs,
    });
  });

  // ---- verified leaderboard -----------------------------------------
  router.get('/api/challenge/leaderboard', readLimit, (req, res) => {
    const challengeId = typeof req.query.challengeId === 'string' && req.query.challengeId
      ? req.query.challengeId
      : currentChallenge().id;
    const board = coordinator.getLeaderboard(challengeId, { limit: req.query.limit });
    res.json({ ok: true, ...board });
  });

  // ---- one identity's standing -------------------------------------
  router.get('/api/challenge/me', readLimit, (req, res) => {
    const challengeId = typeof req.query.challengeId === 'string' && req.query.challengeId
      ? req.query.challengeId
      : currentChallenge().id;
    let identityKey = null;
    const uid = typeof req.query.uid === 'string' ? req.query.uid : '';
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    if (/^(pi|local):/.test(uid)) identityKey = uid;
    else if (name) identityKey = `local:${identity.sanitizeName(name).toLowerCase().replace(/\s+/g, '-') || 'player'}`;
    if (!identityKey) return res.status(400).json({ ok: false, error: 'uid or name required' });
    res.json({ ok: true, ...coordinator.getIdentityStanding(challengeId, identityKey) });
  });

  // ---- node status / dashboard ------------------------------------
  router.get('/api/node/status', readLimit, (_req, res) => {
    const view = node.publicView();
    res.json({
      ok: true,
      node: {
        id: view.id,
        idShort: view.idShort,
        label: view.label,
        status: 'ONLINE',
        appVersion: APP_VERSION,
        simulationVersion: SIMULATION_VERSION,
        rulesVersion: RULES_VERSION,
        tapeVersion: TAPE_VERSION,
        uptimeSeconds: Math.round((Date.now() - START_TIME) / 1000),
        createdAt: new Date(view.createdAt).toISOString(),
        persistentStorage: true,
        localIdentityAllowed: identity.localIdentityAllowed(),
      },
      challenge: publicChallengeView(currentChallenge()),
      today: todaySummary(),
    });
  });

  return router;
}

module.exports = { makeRouter, START_TIME };

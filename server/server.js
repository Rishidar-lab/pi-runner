/**
 * Pi Runner — backend.
 *
 * Serves the built frontend (../public) and implements:
 *   - POST /api/me               identity verification (Bearer access token)
 *   - POST /api/approve          server-side payment approval  (idempotent)
 *   - POST /api/complete         server-side payment completion (idempotent)
 *   - GET  /api/unlock-status    returning-Pioneer unlock check
 *   - POST /api/score            leaderboard submit (re-simulated to validate)
 *   - GET  /api/leaderboard      top scores (all-time or daily)
 *   - POST /api/ads/verify       rewarded-ad verification (server-checked adId)
 *   - POST /api/rewards/claim    A2U reward claim (re-simulated + capped)
 *   - GET  /api/rewards/status   reward config / per-user status
 *
 *   Node Challenge (server/challenge/routes.js):
 *   - GET  /api/challenge/current       deterministic daily challenge + seed
 *   - POST /api/challenge/start         server-issued run session
 *   - POST /api/challenge/submit        input tape -> authoritative replay
 *   - GET  /api/challenge/leaderboard   VERIFIED-only rankings
 *   - GET  /api/challenge/me            one identity's standing
 *   - GET  /api/node/status             local node dashboard data
 *   - GET  /api/health                 liveness + version surface
 *
 * Secrets: PI_API_KEY / PI_WALLET_PASSPHRASE / NODE_CHALLENGE_SECRET are read
 * from the environment and never sent to clients.
 */
'use strict';
const express = require('express');
const path = require('path');
const store = require('./store');
const pi = require('./pi');
const leaderboard = require('./leaderboard');
const rewards = require('./rewards');
const log = require('./log');
const node = require('./node/identity');
const { securityHeaders, rateLimit } = require('./security');
const challengeRoutes = require('./challenge/routes');
const { currentChallenge } = require('./challenge/challenge');
const { APP_VERSION, SIMULATION_VERSION, RULES_VERSION, TAPE_VERSION } = require('./version');

const app = express();
const PORT = process.env.PORT || 3000;
// Containers need 0.0.0.0 for port mapping; the SoloHost compose file only
// publishes the port on 127.0.0.1. Override with BIND_HOST if needed.
const HOST = process.env.BIND_HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(securityHeaders);
app.use(express.json({ limit: '256kb' }));

// A gentle blanket limiter for the API; individual challenge routes add tighter
// per-endpoint limits of their own.
app.use('/api/', rateLimit({ windowMs: 60_000, max: 240, name: 'api' }));

// Node Challenge + node status routes.
app.use(challengeRoutes.makeRouter());

app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));

function requireApiKey(res) {
  if (!pi.hasApiKey()) {
    res.status(500).json({
      error: 'PI_API_KEY is not set. Register your app at pi://develop.pinet.com in the ' +
             'Pi Browser, copy the API key, and set it as an environment variable.',
    });
    return false;
  }
  return true;
}

// ---- health -------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'pi-runner',
    version: APP_VERSION,
    simulationVersion: SIMULATION_VERSION,
    rulesVersion: RULES_VERSION,
    tapeVersion: TAPE_VERSION,
    nodeChallenge: true,
    challengeId: currentChallenge().id,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// ---- identity -------------------------------------------------------------
app.post('/api/me', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken || typeof accessToken !== 'string') return res.status(400).json({ error: 'Missing accessToken' });
    const user = await pi.verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid or expired access token' });
    return res.json({ ok: true, user: { uid: user.uid, username: user.username } });
  } catch (e) { log.error('pi.error', { route: '/api/me', message: e.message }); return res.status(500).json({ error: 'Server error verifying user' }); }
});

// ---- payments (idempotent) ------------------------------------------------
app.post('/api/approve', async (req, res) => {
  if (!requireApiKey(res)) return;
  try {
    const { paymentId, uid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });

    const existing = store.getPayment(paymentId);
    if (existing && existing.status && existing.status !== 'created') {
      return res.json({ ok: true, idempotent: true, status: existing.status });
    }
    store.setPayment(paymentId, { uid: uid || null, status: 'approving' });
    const r = await pi.approvePayment(paymentId);
    if (!r.ok) { store.setPayment(paymentId, { status: 'created' }); return res.status(r.status).json({ error: 'Approve failed', detail: r.data }); }
    store.setPayment(paymentId, { status: 'approved' });
    return res.json({ ok: true, payment: r.data });
  } catch (e) { log.error('pi.error', { route: '/api/approve', message: e.message }); return res.status(500).json({ error: 'Server error approving payment' }); }
});

app.post('/api/complete', async (req, res) => {
  if (!requireApiKey(res)) return;
  try {
    const { paymentId, txid, uid } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });

    const existing = store.getPayment(paymentId);
    if (existing && existing.status === 'completed') {
      return res.json({ ok: true, idempotent: true, granted: store.hasUnlock(existing.uid || uid) });
    }
    const r = await pi.completePayment(paymentId, txid);
    if (!r.ok) return res.status(r.status).json({ error: 'Complete failed', detail: r.data });

    const owner = uid || (existing && existing.uid) || null;
    if (owner) store.grantUnlock(owner);
    store.setPayment(paymentId, { uid: owner, status: 'completed' });
    return res.json({ ok: true, granted: Boolean(owner), payment: r.data });
  } catch (e) { log.error('pi.error', { route: '/api/complete', message: e.message }); return res.status(500).json({ error: 'Server error completing payment' }); }
});

app.get('/api/unlock-status', (req, res) => {
  const uid = req.query.uid;
  res.json({ unlocked: store.hasUnlock(typeof uid === 'string' ? uid : null) });
});

// ---- leaderboard (classic, re-simulated) --------------------------------
app.post('/api/score', async (req, res) => {
  try {
    const result = await leaderboard.verify(req.body || {});
    if (!result.ok) return res.status(400).json({ ok: false, reason: result.reason, serverScore: result.serverScore });

    const body = req.body;
    const name = sanitizeName(body.username) || 'Pioneer';
    const day = body.daily ? currentDay() : null;
    store.addScore({
      name, uid: body.uid || null, score: Number(body.score), coins: Number(body.coins) || 0,
      distance: Number(body.distance) || 0, daily: Boolean(body.daily), day, verified: true, ts: Date.now(),
    });
    return res.json({ ok: true, verified: true });
  } catch (e) { log.error('server.error', { route: '/api/score', message: e.message }); return res.status(500).json({ ok: false, error: 'Server error validating score' }); }
});

app.get('/api/leaderboard', (req, res) => {
  const n = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const daily = req.query.daily === '1';
  res.json({ ok: true, scores: store.topScores(n, daily, currentDay()) });
});

// ---- play-to-earn ---------------------------------------------------------
app.post('/api/ads/verify', async (req, res) => {
  if (!requireApiKey(res)) return;
  try {
    const result = await rewards.grantAdReward(req.body || {});
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (e) { log.error('server.error', { route: '/api/ads/verify', message: e.message }); return res.status(500).json({ ok: false, error: 'ad verify error' }); }
});

app.post('/api/rewards/claim', async (req, res) => {
  if (!requireApiKey(res)) return;
  try {
    const result = await rewards.claim(req.body || {});
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (e) { log.error('server.error', { route: '/api/rewards/claim', message: e.message }); return res.status(500).json({ ok: false, error: 'reward claim error' }); }
});

app.get('/api/rewards/status', (req, res) => {
  const uid = typeof req.query.uid === 'string' ? req.query.uid : null;
  if (!uid) return res.json(rewards.status('')); // config-only view
  res.json(rewards.status(uid));
});

function sanitizeName(s) { return typeof s === 'string' ? s.replace(/[^\w@.\- ]/g, '').slice(0, 24) : ''; }
function currentDay() { const d = new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`; }

// SPA fallback for any non-API route.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---- boot + graceful shutdown ------------------------------------------
const nodeView = node.publicView();
const server = app.listen(PORT, HOST, () => {
  log.info('server.start', {
    host: HOST,
    port: Number(PORT),
    appVersion: APP_VERSION,
    simulationVersion: SIMULATION_VERSION,
    node: nodeView.label,
    challengeId: currentChallenge().id,
    piApiKey: pi.hasApiKey() ? 'set' : 'absent',
    localIdentityAllowed: !pi.hasApiKey() || process.env.NODE_CHALLENGE_DEMO === '1',
  });
  // Keep the friendly console line for humans running `npm start`.
  console.log(`Pi Runner (${nodeView.label}) on http://localhost:${PORT}  ·  challenge ${currentChallenge().id}`);
  if (!pi.hasApiKey()) console.log('Note: PI_API_KEY not set — Pi login/payments disabled; Node Challenge runs locally.');
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('server.shutdown', { signal });
  server.close(() => {
    const flushed = store.flushSync();
    log.info('server.stopped', { flushed });
    process.exit(0);
  });
  // Hard cap so a hung connection can't block the container.
  setTimeout(() => { store.flushSync(); process.exit(0); }, 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };

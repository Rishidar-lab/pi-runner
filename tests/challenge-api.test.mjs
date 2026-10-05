/**
 * Node Challenge HTTP integration tests — drives the real Express app.
 *
 * Covers: health, current challenge, start/submit happy path, every rejection
 * reason surfaced by the route, leaderboard (VERIFIED-only, ranked, deduped,
 * challenge-isolated), /api/challenge/me, /api/node/status, oversized/invalid
 * payloads, and persistence across a store reload.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = join(ROOT, 'server', 'data-test-api');
rmSync(process.env.DATA_DIR, { recursive: true, force: true });
process.env.PORT = '0';
process.env.NODE_CHALLENGE_DEMO = '1';
process.env.DISABLE_RATE_LIMIT = '1';
process.env.LOG_LEVEL = 'error';

const { server } = require(join(ROOT, 'server', 'server.js'));
const { SIMULATION_VERSION, TAPE_VERSION } = require(join(ROOT, 'server', 'version.js'));
const store = require(join(ROOT, 'server', 'store.js'));
const challenge = require(join(ROOT, 'server', 'challenge', 'challenge.js'));
const FIXED = 1 / 120;

let BASE;
async function core() {
  const factory = require(join(ROOT, 'server', 'pirun_core_node.js'));
  return factory();
}
const api = async (p, opt) => {
  const r = await fetch(BASE + p, opt);
  return { status: r.status, body: await r.json() };
};
const post = (p, obj) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

/** Start a session, play its seed, and return { run, payload, played }. */
async function playChallenge(M, script = {}, name = 'Tester') {
  const run = (await api('/api/challenge/start', { method: 'POST' })).body.run;
  const r = new M.Runner();
  r.reset(run.seed >>> 0, false, 0);
  r.start();
  const tapeSteps = [];
  const tapeCmds = [];
  let step = 0;
  for (; step < 200000 && r.state() !== 4; step++) {
    if (script[step] !== undefined) { r.input(script[step]); tapeSteps.push(step); tapeCmds.push(script[step]); }
    r.advance(FIXED);
  }
  const played = { score: r.score(), distance: r.distance(), coins: r.coins() };
  r.delete();
  const payload = {
    runId: run.runId, challengeId: run.challengeId, seed: run.seed,
    simulationVersion: run.simulationVersion, tapeVersion: run.tapeVersion,
    steps: step, tapeSteps, tapeCmds, claimed: played, localName: name,
  };
  return { run, payload, played };
}

before(async () => {
  await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
  BASE = `http://127.0.0.1:${server.address().port}`;
});

test('GET /api/health returns a safe version surface', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'pi-runner');
  assert.equal(body.nodeChallenge, true);
  assert.equal(body.simulationVersion, SIMULATION_VERSION);
  assert.ok(!JSON.stringify(body).toLowerCase().includes('secret'));
});

test('GET /api/challenge/current exposes id + deterministic seed only', async () => {
  const { body } = await api('/api/challenge/current');
  assert.equal(body.ok, true);
  assert.match(body.challenge.id, /^daily:\d{4}-\d{2}-\d{2}:v1$/);
  assert.ok(Number.isInteger(body.challenge.seed));
  assert.equal(body.challenge.id, challenge.currentChallenge().id);
});

test('start -> play -> submit verifies and ranks the run', async () => {
  const M = await core();
  const { payload, played } = await playChallenge(M, { 40: 1, 200: 3, 380: 2 }, 'Alice');
  const { status, body } = await post('/api/challenge/submit', payload);
  assert.equal(status, 200);
  assert.equal(body.verified, true);
  assert.equal(body.result.score, played.score);
  assert.equal(body.result.distance, played.distance);
  assert.equal(body.rank, 1);
  assert.equal(body.identityKind, 'local');
});

test('re-submitting the same run is idempotent, not a duplicate leaderboard row', async () => {
  const M = await core();
  const { payload } = await playChallenge(M, { 50: 2, 250: 1 }, 'Bob');
  const first = await post('/api/challenge/submit', payload);
  assert.equal(first.body.verified, true);
  const second = await post('/api/challenge/submit', payload);
  assert.equal(second.body.verified, true);
  assert.equal(second.body.idempotent, true);

  const lb = (await api('/api/challenge/leaderboard')).body;
  assert.equal(lb.entries.filter((e) => e.username === 'Bob (local)').length, 1);
});

test('unknown runId -> INVALID_RUN_ID', async () => {
  const M = await core();
  const { payload } = await playChallenge(M, { 40: 1 });
  const { status, body } = await post('/api/challenge/submit', { ...payload, runId: 'b'.repeat(32) });
  assert.equal(status, 404);
  assert.equal(body.reason, 'INVALID_RUN_ID');
});

test('inflated score -> SCORE_MISMATCH and the run does NOT reach the board', async () => {
  const M = await core();
  const { payload } = await playChallenge(M, { 60: 1, 300: 2 }, 'Mallory');
  payload.claimed.score += 250000;
  const { body } = await post('/api/challenge/submit', payload);
  assert.equal(body.verified, false);
  assert.equal(body.reason, 'SCORE_MISMATCH');
  const lb = (await api('/api/challenge/leaderboard')).body;
  assert.equal(lb.entries.some((e) => e.username === 'Mallory (local)'), false);
});

test('seed mismatch and challenge mismatch are rejected before replay', async () => {
  const M = await core();
  const a = await playChallenge(M, { 40: 1 });
  const seedRes = await post('/api/challenge/submit', { ...a.payload, seed: (a.payload.seed ^ 1) >>> 0 });
  assert.equal(seedRes.body.reason, 'SEED_MISMATCH');

  const b = await playChallenge(M, { 40: 1 });
  const chRes = await post('/api/challenge/submit', { ...b.payload, challengeId: 'daily:2000-01-01:v1' });
  assert.equal(chRes.body.reason, 'CHALLENGE_MISMATCH');
});

test('version mismatch is rejected', async () => {
  const M = await core();
  const { payload } = await playChallenge(M, { 40: 1 });
  const { body } = await post('/api/challenge/submit', { ...payload, simulationVersion: '0.0.0-old' });
  assert.equal(body.reason, 'VERSION_MISMATCH');
});

test('malformed / oversized tapes are rejected with 400', async () => {
  const M = await core();
  const { payload } = await playChallenge(M, { 40: 1 });

  assert.equal((await post('/api/challenge/submit', {})).status, 400);
  assert.equal((await post('/api/challenge/submit', { ...payload, tapeCmds: [9, 9, 9] })).body.reason, 'INVALID_INPUT_TAPE');

  const huge = Array.from({ length: 5000 }, (_, i) => i);
  const big = { ...payload, steps: 6000, tapeSteps: huge, tapeCmds: huge.map(() => 1) };
  assert.equal((await post('/api/challenge/submit', big)).body.reason, 'TAPE_TOO_LONG');

  // raw invalid JSON
  const raw = await fetch(BASE + '/api/challenge/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json',
  });
  assert.ok(raw.status >= 400);
});

test('leaderboard is VERIFIED-only, ranked by score, and challenge-isolated', async () => {
  const M = await core();
  // three genuine runs from distinct identities
  const p1 = await playChallenge(M, { 40: 1, 400: 2, 800: 1 }, 'Runner1');
  const p2 = await playChallenge(M, { 30: 2 }, 'Runner2');
  const p3 = await playChallenge(M, { 45: 1, 260: 3, 520: 2, 900: 1 }, 'Runner3');
  for (const p of [p1, p2, p3]) {
    const res = await post('/api/challenge/submit', p.payload);
    assert.equal(res.body.verified, true);
  }
  const lb = (await api('/api/challenge/leaderboard')).body;
  assert.ok(lb.entries.every((e) => e.verified === true));
  for (let i = 1; i < lb.entries.length; i++) {
    assert.ok(lb.entries[i - 1].score >= lb.entries[i].score, 'sorted by score desc');
    assert.equal(lb.entries[i].rank, i + 1);
  }
  // a different challenge id yields an empty board (isolation)
  const other = (await api('/api/challenge/leaderboard?challengeId=daily:2000-01-01:v1')).body;
  assert.equal(other.count, 0);
});

test('GET /api/challenge/me returns a standing for a known local player', async () => {
  const { body } = await api('/api/challenge/me?name=Alice');
  assert.equal(body.found, true);
  assert.ok(body.rank >= 1);
  assert.equal((await api('/api/challenge/me')).status, 400);
});

test('GET /api/node/status shows node + challenge + today counters, no secrets', async () => {
  const { body } = await api('/api/node/status');
  assert.equal(body.ok, true);
  assert.match(body.node.id, /^[a-f0-9]{32}$/);
  assert.equal(body.node.status, 'ONLINE');
  assert.ok(body.today.verifiedRuns >= 1);
  assert.ok(body.today.rejectedRuns >= 1);
  assert.equal(body.node.persistentStorage, true);
  assert.equal(JSON.stringify(body).includes('data-test-api'), false, 'no filesystem path leak');
});

test('verified entries survive a store reload (persistence)', async () => {
  store.flushSync();
  store._reload();
  const lb = (await api('/api/challenge/leaderboard')).body;
  assert.ok(lb.count >= 3, 'leaderboard rebuilt from disk');
});

after(async () => {
  await new Promise((r) => server.close(r));
  await new Promise((r) => setImmediate(r));
  try { rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

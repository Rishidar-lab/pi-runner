/**
 * Backend payment-state + leaderboard-verification tests (Node built-in runner).
 *
 * These exercise the real store idempotency logic and the leaderboard verifier
 * (which loads the Node-target WASM core) — no network calls to Pi are made;
 * the Pi API wrapper is only invoked through the routes, which we don't hit here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Isolate the store's data file to a temp dir so tests don't touch real data.
process.env.DATA_DIR = join(ROOT, 'server', 'data-test');

const store = require(join(ROOT, 'server', 'store.js'));
const leaderboard = require(join(ROOT, 'server', 'leaderboard.js'));

test('payment state machine: created -> approved -> completed grants unlock', () => {
  const id = 'pay_test_1';
  const uid = 'user_abc';
  assert.equal(store.getPayment(id), null, 'no payment yet');

  store.setPayment(id, { uid, status: 'approving' });
  store.setPayment(id, { status: 'approved' });
  assert.equal(store.getPayment(id).status, 'approved');
  assert.equal(store.hasUnlock(uid), false, 'not unlocked until completion');

  // completion grants the unlock
  store.grantUnlock(uid);
  store.setPayment(id, { status: 'completed' });
  assert.equal(store.getPayment(id).status, 'completed');
  assert.equal(store.hasUnlock(uid), true, 'unlock granted after completion');
});

test('unlock is idempotent (double completion stays granted, single owner)', () => {
  const uid = 'user_idem';
  store.grantUnlock(uid);
  store.grantUnlock(uid);
  assert.equal(store.hasUnlock(uid), true);
});

test('leaderboard.verify rejects malformed submissions', async () => {
  assert.equal((await leaderboard.verify(null)).ok, false);
  assert.equal((await leaderboard.verify({ seed: 'x' })).ok, false);
  const bad = await leaderboard.verify({ seed: 1, steps: -5, tapeSteps: [], tapeCmds: [], score: 0, coins: 0, distance: 0 });
  assert.equal(bad.ok, false);
});

test('leaderboard.verify accepts a genuine run and rejects an inflated score', async () => {
  // Reproduce a real run with the SAME node core, capturing seed/tape/score.
  const factory = require(join(ROOT, 'server', 'pirun_core_node.js'));
  const M = await factory();
  const r = new M.Runner();
  const seed = 4242;
  r.reset(seed, false, 0); r.start();
  const tapeSteps = [], tapeCmds = [];
  const FIXED = 1 / 120;
  let step = 0;
  for (; step < 1200 && r.state() !== 4; step++) {
    if (step === 60) { r.input(1); tapeSteps.push(step); tapeCmds.push(1); }
    if (step === 200) { r.input(2); tapeSteps.push(step); tapeCmds.push(2); }
    r.advance(FIXED);
  }
  const genuine = {
    seed, unlockShield: false, skin: 0, steps: step,
    tapeSteps, tapeCmds, score: r.score(), coins: r.coins(), distance: r.distance(),
  };
  r.delete();

  const good = await leaderboard.verify(genuine);
  assert.equal(good.ok, true, 'genuine run verifies');
  assert.equal(good.serverScore, genuine.score, 'server recomputes the same score');

  const cheated = { ...genuine, score: genuine.score + 999999 };
  const bad = await leaderboard.verify(cheated);
  assert.equal(bad.ok, false, 'inflated score is rejected');
  assert.equal(bad.reason, 'score mismatch');
});

test.after(() => {
  // best-effort cleanup of the test data dir
  try { require('node:fs').rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

/**
 * Play-to-earn anti-abuse tests.
 *
 * Verifies the reward engine's guarantees WITHOUT a real wallet (payouts are
 * recorded as "pending" when no wallet is configured):
 *   - a genuine run earns the expected, capped amount
 *   - a tampered score is rejected (re-simulation mismatch)
 *   - the same run can't be claimed twice (idempotency)
 *   - the daily cap is enforced
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXED = 1 / 120;

// Isolate state so the suite is idempotent across consecutive runs: the claim
// ledger lives in this dir, and store.js debounces its writes via setImmediate,
// so a leftover store.json from a prior run would poison idempotency. Wipe it
// before loading the reward engine so every run starts from a clean ledger.
process.env.DATA_DIR = join(ROOT, 'server', 'data-rewards-test');
rmSync(process.env.DATA_DIR, { recursive: true, force: true });

// Configure the reward economics deterministically for the test.
process.env.REWARDS_ENABLED = '1';
process.env.REWARD_PI_PER_TOKEN = '0.01';   // Pi per verified score point
process.env.REWARD_DAILY_CAP_PI = '1';
process.env.REWARD_MIN_CLAIM_PI = '0.01';

const rewards = require(join(ROOT, 'server', 'rewards.js'));

async function core() {
  const factory = require(join(ROOT, 'server', 'pirun_core_node.js'));
  return factory();
}

function playRun(M, seed, script = {}) {
  const r = new M.Runner();
  r.reset(seed, false, 0); r.start();
  const tapeSteps = [], tapeCmds = [];
  let step = 0;
  for (; step < 4000 && r.state() !== 4; step++) {
    if (script[step] !== undefined) { r.input(script[step]); tapeSteps.push(step); tapeCmds.push(script[step]); }
    r.advance(FIXED);
  }
  const run = {
    uid: 'user_reward_test', seed, unlockShield: false, skin: 0, steps: step,
    tapeSteps, tapeCmds, score: r.score(), coins: r.coins(), distance: r.distance(),
  };
  r.delete();
  return run;
}

test('genuine run earns a capped, verified reward (pending without wallet)', async () => {
  const M = await core();
  const run = playRun(M, 20260801, { 60: 1, 200: 2 });
  const expected = Math.min(1, Math.round(run.score * 0.01 * 1e6) / 1e6);

  const res = await rewards.claim(run);
  assert.equal(res.ok, true, 'claim succeeds for a genuine run');
  assert.equal(res.pending, true, 'no wallet configured -> recorded as pending');
  assert.equal(res.amountPi, expected, 'amount = min(cap, verifiedScore * rate)');
});

test('a tampered score is rejected', async () => {
  const M = await core();
  const run = playRun(M, 555, { 40: 2 });
  const cheated = { ...run, uid: 'cheater_1', score: run.score + 100000 };
  const res = await rewards.claim(cheated);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unverified_run');
});

test('the same run cannot be claimed twice', async () => {
  const M = await core();
  const run = playRun(M, 99, { 50: 1 });
  run.uid = 'user_idem_reward';
  const first = await rewards.claim(run);
  assert.equal(first.ok, true);
  const second = await rewards.claim(run);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already_claimed');
});

test('daily cap is enforced across distinct runs', async () => {
  const M = await core();
  const uid = 'user_cap';
  // Claim distinct genuine runs until the cap blocks further payouts.
  let blocked = false;
  for (let i = 0; i < 12 && !blocked; i++) {
    const run = playRun(M, 1000 + i, { 45: (i % 2) ? 1 : 2 });
    run.uid = uid;
    const res = await rewards.claim(run);
    if (!res.ok && (res.reason === 'daily_cap_reached' || res.reason === 'below_minimum')) blocked = true;
    else if (res.ok) assert.ok(res.claimedTodayPi <= 1 + 1e-9, 'never exceeds the daily cap');
  }
  const st = rewards.status(uid);
  assert.ok(st.claimedTodayPi <= 1 + 1e-9, 'claimed total stays within the daily cap');
  assert.ok(st.remainingTodayPi >= 0, 'remaining never negative');
});

test.after(async () => {
  // Flush store.js's debounced (setImmediate) write so the removal below isn't
  // undone by a still-pending persist that would re-create the directory.
  await new Promise((resolve) => setImmediate(resolve));
  try { rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

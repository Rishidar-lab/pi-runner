/**
 * Authoritative replay verification tests.
 *
 * A genuine run (played with the committed node core) must verify. Every kind of
 * tampering must be rejected with a meaningful reason code:
 *   altered score / distance / coins, dropped inputs, injected inputs,
 *   inflated step count, wrong seed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = join(ROOT, 'server', 'data-test-replay');

const replay = require(join(ROOT, 'server', 'challenge', 'replay.js'));
const { SIMULATION_VERSION, TAPE_VERSION } = require(join(ROOT, 'server', 'version.js'));
const FIXED = 1 / 120;

async function core() {
  const factory = require(join(ROOT, 'server', 'pirun_core_node.js'));
  return factory();
}

/** Play a genuine run and return a fully-formed, valid tape object. */
function play(M, seed, script = {}) {
  const r = new M.Runner();
  r.reset(seed >>> 0, false, 0);
  r.start();
  const tapeSteps = [];
  const tapeCmds = [];
  let step = 0;
  for (; step < 200000 && r.state() !== 4; step++) {
    if (script[step] !== undefined) { r.input(script[step]); tapeSteps.push(step); tapeCmds.push(script[step]); }
    r.advance(FIXED);
  }
  const tape = {
    runId: 'a'.repeat(32),
    challengeId: 'daily:2026-08-31:v1',
    seed: seed >>> 0,
    simulationVersion: SIMULATION_VERSION,
    tapeVersion: TAPE_VERSION,
    steps: step,
    tapeSteps,
    tapeCmds,
    claimed: { score: r.score(), distance: r.distance(), coins: r.coins() },
  };
  r.delete();
  return tape;
}

test('a genuine run verifies and reproduces score/distance/coins', async () => {
  const M = await core();
  const tape = play(M, 42, { 20: 1, 120: 2, 240: 1 });
  const v = await replay.verify(tape);
  assert.equal(v.ok, true, `expected ok, got ${v.reason}`);
  assert.equal(v.authoritative.score, tape.claimed.score);
  assert.equal(v.authoritative.distance, tape.claimed.distance);
  assert.equal(v.authoritative.coins, tape.claimed.coins);
  assert.equal(v.authoritative.endState, 4, 'run ended in GameOver');
});

test('an inflated score is rejected with SCORE_MISMATCH', async () => {
  const M = await core();
  const tape = play(M, 12345, { 60: 2, 200: 1 });
  tape.claimed.score += 99999;
  const v = await replay.verify(tape);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'SCORE_MISMATCH');
});

test('an altered distance is rejected with DISTANCE_MISMATCH', async () => {
  const M = await core();
  const tape = play(M, 222333, { 40: 1 });
  tape.claimed.distance += 500;
  const v = await replay.verify(tape);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'DISTANCE_MISMATCH');
});

test('altered coins are rejected with COINS_MISMATCH', async () => {
  const M = await core();
  const tape = play(M, 987654, { 30: 3, 220: 1, 400: 2 });
  tape.claimed.coins += 7;
  const v = await replay.verify(tape);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'COINS_MISMATCH');
});

test('a wrong seed reproduces a different run and is rejected', async () => {
  const M = await core();
  const tape = play(M, 42, { 20: 1, 300: 2 });
  tape.seed = (tape.seed ^ 0xABCDE) >>> 0;
  const v = await replay.verify(tape);
  assert.equal(v.ok, false, 'a different course cannot match the claimed totals');
});

// Seed 42 is input-sensitive: no input survives to tick 1156 (score 221);
// a lane change at tick 20 makes it crash at 939 (Left -> score 168, Right -> 158).
test('dropping recorded inputs changes the run and is rejected', async () => {
  const M = await core();
  const tape = play(M, 42, { 20: 1, 120: 2, 240: 1 });
  assert.ok(tape.tapeSteps.length >= 1, 'inputs were recorded');
  tape.tapeSteps = [];
  tape.tapeCmds = [];
  const v = await replay.verify(tape);
  assert.equal(v.ok, false, 'the input-free run does not match the claimed totals');
});

test('injecting an extra input changes the run and is rejected', async () => {
  const M = await core();
  const tape = play(M, 42, {}); // genuine no-input run, claims tick 1156
  tape.tapeSteps = [20];
  tape.tapeCmds = [1]; // a lane change the player never made
  const v = await replay.verify(tape);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'FINAL_TICK_MISMATCH');
});

test('flipping a recorded command is rejected with SCORE_MISMATCH', async () => {
  const M = await core();
  const tape = play(M, 42, { 20: 1 }); // Left @20 -> score 168
  assert.equal(tape.tapeCmds[0], 1);
  tape.tapeCmds[0] = 2; // Right @20 -> score 158, same tick count
  const v = await replay.verify(tape);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'SCORE_MISMATCH');
});

test('an inflated step count is rejected with FINAL_TICK_MISMATCH', async () => {
  const M = await core();
  const tape = play(M, 31337, { 55: 1, 210: 2 });
  tape.steps += 400; // claim the run lasted longer than it did
  const v = await replay.verify(tape);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'FINAL_TICK_MISMATCH');
});

test('a truncated run that never crashed is rejected as incomplete', async () => {
  const M = await core();
  const tape = play(M, 909090, { 45: 1 });
  tape.steps = Math.max(1, tape.steps - 120); // stop a second before the crash
  const v = await replay.verify(tape);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'REPLAY_INCOMPLETE');
});

test('verification is repeatable (determinism)', async () => {
  const M = await core();
  const tape = play(M, 246810, { 40: 1, 260: 2, 500: 1 });
  const a = await replay.verify(tape);
  const b = await replay.verify(tape);
  assert.deepEqual(a.authoritative, b.authoritative);
});

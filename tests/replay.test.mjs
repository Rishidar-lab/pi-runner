/**
 * Replay determinism test.
 *
 * The game-over "Watch Replay" feature resets the core with the finished run's
 * seed + skin + shield, then feeds the recorded input tape at the recorded step
 * indices. Because the core is deterministic, replaying MUST reproduce the exact
 * same final score / distance / end state as the original run. This test drives
 * the same logic the client uses in stepReplay().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXED = 1 / 120;

async function core() {
  const factory = require(join(ROOT, 'server', 'pirun_core_node.js'));
  return factory();
}

// Play a run with a scripted tape; capture seed + tape + final result.
function playAndRecord(M, seed, script) {
  const r = new M.Runner();
  r.reset(seed, false, 0); r.start();
  const tapeSteps = [], tapeCmds = [];
  let step = 0;
  for (; step < 4000 && r.state() !== 4; step++) {
    if (script[step] !== undefined) { r.input(script[step]); tapeSteps.push(step); tapeCmds.push(script[step]); }
    r.advance(FIXED);
  }
  const run = { seed, steps: step, tapeSteps, tapeCmds, score: r.score(), distance: r.distance(), state: r.state() };
  r.delete();
  return run;
}

// Replay exactly what the client does in startReplay()/stepReplay().
function replay(M, run) {
  const r = new M.Runner();
  r.reset(run.seed, false, 0); r.start();
  let idx = 0;
  for (let step = 0; step < run.steps && r.state() === 2; step++) {
    while (idx < run.tapeSteps.length && run.tapeSteps[idx] === step) { r.input(run.tapeCmds[idx]); idx++; }
    r.advance(FIXED);
  }
  const out = { score: r.score(), distance: r.distance(), state: r.state() };
  r.delete();
  return out;
}

test('replay reproduces the original run exactly (a run that ends in a crash)', async () => {
  const M = await core();
  // A tape that moves around a bit; standing patterns will eventually crash.
  const script = { 40: 1, 120: 2, 260: 3, 400: 1, 700: 2 };
  const run = playAndRecord(M, 0xABCDEF, script);
  const rp = replay(M, run);
  assert.equal(rp.score, run.score, 'replay score matches original');
  assert.equal(rp.distance, run.distance, 'replay distance matches original');
  assert.equal(rp.state, run.state, 'replay ends in the same state');
});

test('replay is repeatable and seed-faithful', async () => {
  const M = await core();
  const run = playAndRecord(M, 12321, { 30: 2, 90: 1, 150: 3, 300: 2 });
  const a = replay(M, run);
  const b = replay(M, run);
  assert.deepEqual(a, b, 'two replays of the same run are identical');
});

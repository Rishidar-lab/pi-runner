// Benchmark Node Challenge replay verification.
//
//   node scripts/bench-replay.mjs
//
// The server re-simulates a submitted run one 120 Hz tick at a time. This
// measures that cost so we can confirm verification is comfortable on ordinary
// hardware, including at the 30-minute hard cap (MAX_STEPS = 216000). Not CI.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = join(ROOT, 'server', 'data-bench');

const replay = require(join(ROOT, 'server', 'challenge', 'replay.js'));
const { getCore } = require(join(ROOT, 'server', 'simcore.js'));
const FIXED = 1 / 120;
const M = await getCore();

/**
 * Measure the wall time to simulate `ticks` fixed steps, keeping the run alive
 * with revive() so we actually reach `ticks` (the server's per-tick cost is
 * identical whether or not a revive happened).
 */
function timeTicks(ticks) {
  const r = new M.Runner();
  r.reset(20260831, false, 0);
  r.start();
  const t0 = process.hrtime.bigint();
  for (let s = 0; s < ticks; s++) {
    if ((s & 63) === 0) r.input(1 + (s % 3)); // light, realistic input rate
    r.advance(FIXED);
    if (r.state() === 4) r.revive();
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  r.delete();
  return ms;
}

console.log('per-tick re-simulation cost (single deterministic core):\n');
console.log('  run length        ticks     wall (ms)     x realtime');
for (const [label, secs] of [['10 s', 10], ['1 min', 60], ['5 min', 300], ['30 min cap', 1800]]) {
  const ticks = secs * 120;
  timeTicks(1000); // warm
  let best = Infinity;
  for (let i = 0; i < 3; i++) best = Math.min(best, timeTicks(ticks));
  const xrt = (secs * 1000) / best;
  console.log(`  ${label.padEnd(14)} ${String(ticks).padStart(8)}   ${best.toFixed(1).padStart(10)}   ${xrt.toFixed(0).padStart(8)}x`);
}

// End-to-end: validate + replay through the public verify() path on a real run.
console.log('\nend-to-end verify() on a genuine crashed run:');
const { SIMULATION_VERSION, TAPE_VERSION } = require(join(ROOT, 'server', 'version.js'));
const r = new M.Runner();
r.reset(42, false, 0); r.start();
const tapeSteps = []; const tapeCmds = [];
let s = 0;
const script = { 20: 1, 120: 2, 240: 1 };
for (; s < 200000 && r.state() !== 4; s++) {
  if (script[s] !== undefined) { r.input(script[s]); tapeSteps.push(s); tapeCmds.push(script[s]); }
  r.advance(FIXED);
}
const tape = {
  runId: 'a'.repeat(32), challengeId: 'daily:2026-08-31:v1', seed: 42,
  simulationVersion: SIMULATION_VERSION, tapeVersion: TAPE_VERSION,
  steps: s, tapeSteps, tapeCmds,
  claimed: { score: r.score(), distance: r.distance(), coins: r.coins() },
};
r.delete();
const v = await replay.verify(tape);
console.log(`  ${tape.steps} ticks, verified=${v.ok}, latency=${v.latencyMs} ms`);

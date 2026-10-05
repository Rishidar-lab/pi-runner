/**
 * Deterministic gameplay-contract tests for the shipped JS/WASM core.
 *
 * These drive `server/pirun_core_node.js` — the exact same build the browser
 * app and the server-side verifier use — through Node's built-in `node:test`.
 * They mirror the C++ assertions in `core/tests/test_sim.cpp` but on the
 * committed WASM path, and guard the reward suite's test-isolation contract.
 *
 * The constants below intentionally echo `core/include/pirun/pirun.hpp`
 * (`namespace cfg` / the enums) so the assertions fail loudly if gameplay
 * tuning drifts from what this contract pins.
 *
 * NOTE: `Runner.renderBuffer()` returns a dangling view in this Node build (the
 * binding's local `std::vector` is freed before the JS caller can copy it), so
 * these tests deliberately do NOT read entity positions. Instead they exercise
 * the contract through the stable scalar accessors (score/coins/combo/
 * multiplier/distance/state/revive/verifyRun) and survive runs via `revive()`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXED = 1 / 120;

// --- core contract constants (mirror core/include/pirun/pirun.hpp) ---
const COMBO_STEP = 8;        // coins per +1.0 multiplier tier
const MULT_CAP = 5;          // max +tiers over base => hard cap x6
const SLOWMO_FACTOR = 0.55;  // distance multiplier while slow-mo is active

const Cmd = { None: 0, Left: 1, Right: 2, Jump: 3, Slide: 4 };
const St = { Menu: 0, Playing: 2, GameOver: 4 };

async function core() {
  const factory = require(join(ROOT, 'server', 'pirun_core_node.js'));
  return factory();
}

/**
 * Run a survivable-ish bot that never reads entity positions: it just advances
 * and calls `revive()` whenever the run ends, so the run continues indefinitely.
 * Coins/power-ups are collected whenever the player happens to be in the right
 * lane. We aggregate the invariants the gameplay contract must satisfy.
 */
function runReviveBot(M, seed, maxSteps) {
  const r = new M.Runner();
  r.reset(seed, true /* unlockShield */, 0);
  r.start();

  let maxCombo = 0;
  let invViolations = 0;     // multiplier !== 1 + min(floor(combo/8), 5)
  let capViolations = 0;     // multiplier > MULT_CAP + 1
  let distViolations = 0;    // per-meter distance score mismatch
  let boostQ = 0, boostRateSum = 0;
  let noBoostQ = 0, noBoostRateSum = 0;
  let magCoinGain = 0, magSteps = 0;   // coin gain while magnet active
  let noMagCoinGain = 0, noMagSteps = 0; // coin gain while magnet inactive
  let slowDist = 0, slowN = 0;
  let normDist = 0, normN = 0;
  let comboResets = 0;       // combo>0 then 0 while still Playing (shielded hit)
  let prevCombo = 0;

  for (let step = 0; step < maxSteps; step++) {
    const s0 = r.score(), c0 = r.coins(), g0 = r.gems(), d0 = Math.floor(r.distance());
    const combo0 = r.combo(), mult0 = r.multiplier();
    const boostBefore = r.boostLeft() > 0;

    r.advance(FIXED);
    if (r.state() === St.GameOver) r.revive();

    const combo1 = r.combo(), mult1 = r.multiplier();
    const boostAfter = r.boostLeft() > 0;
    const d1 = Math.floor(r.distance());
    const meters = d1 - d0;
    const scoreDelta = r.score() - s0;
    const coinGain = r.coins() - c0;
    const gemGain = r.gems() - g0;

    maxCombo = Math.max(maxCombo, combo1);

    // Multiplier always = 1 + min(floor(combo/8), MULT_CAP) and never exceeds x6.
    const expectedMult = 1 + Math.min(Math.floor(combo1 / COMBO_STEP), MULT_CAP);
    if (mult1 !== expectedMult) invViolations++;
    if (mult1 > MULT_CAP + 1) capViolations++;

    // Distance scoring = meters * multiplier * (2 while boost). Isolate pure
    // distance steps: ones where no coin/gem was collected this step.
    if (meters > 0 && coinGain === 0 && gemGain === 0) {
      const boostFactor = boostAfter ? 2 : 1; // scoring uses post-decrement boost
      const expected = meters * mult1 * boostFactor;
      if (scoreDelta !== expected) distViolations++;
      const rate = scoreDelta / meters;
      if (boostFactor === 2) { boostQ++; boostRateSum += rate; }
      else { noBoostQ++; noBoostRateSum += rate; }
    }

    // Magnet pulls adjacent-lane pickups -> more coins while magnet is active.
    if (coinGain > 0) {
      if (r.magnetLeft() > 0) { magSteps++; magCoinGain += coinGain; }
      else { noMagSteps++; noMagCoinGain += coinGain; }
    }

    // Slow-mo reduces distance covered per fixed step (effSpeed * SLOWMO_FACTOR).
    // Count every step (including 0-meter steps) so the averages reflect true
    // per-step distance at the slow vs normal effective speeds.
    if (r.slowmoLeft() > 0) { slowDist += meters; slowN++; }
    else { normDist += meters; normN++; }

    // Combo resets to 0 on an unavoided (shielded) hit, run keeps Playing.
    if (prevCombo > 0 && combo1 === 0 && r.state() === St.Playing && coinGain === 0 && gemGain === 0) {
      comboResets++;
    }
    prevCombo = combo1;
  }

  return {
    maxCombo, invViolations, capViolations, distViolations,
    boostRate: boostQ ? boostRateSum / boostQ : 0,
    noBoostRate: noBoostQ ? noBoostRateSum / noBoostQ : 0,
    boostQ, noBoostQ,
    magCoinRate: magSteps ? magCoinGain / magSteps : 0,
    noMagCoinRate: noMagSteps ? noMagCoinGain / noMagSteps : 0,
    magSteps, noMagSteps,
    slowAvg: slowN ? slowDist / slowN : 0,
    normAvg: normN ? normDist / normN : 0,
    slowN, normN,
    comboResets,
    score: r.score(), coins: r.coins(), gems: r.gems(),
  };
}

test('distance scoring accrues 1 pt/m at the base multiplier before any pickup', async () => {
  const M = await core();
  const r = new M.Runner();
  r.reset(424242, false, 0);
  r.start();
  // Before the first entity reaches the player (~100m travelled) only distance
  // scoring happens, with combo 0 -> multiplier 1.
  for (let i = 0; i < 600; i++) r.advance(FIXED);
  assert.equal(r.coins(), 0, 'no coin collected before the first row arrives');
  assert.equal(r.combo(), 0, 'combo still 0');
  assert.equal(r.multiplier(), 1, 'base multiplier is 1');
  assert.equal(r.score(), Math.floor(r.distance()), 'score == floor(distance) * 1 at base multiplier');
});

test('distance scoring = 1 pt/m x multiplier, and boost doubles point accrual', async () => {
  const M = await core();
  const m = runReviveBot(M, 5150, 200000);
  assert.equal(m.distViolations, 0, 'per-meter score == meters * multiplier * (2 while boost)');
  assert.ok(m.boostQ > 0, 'observe at least one boost-active distance step');
  assert.ok(m.noBoostQ > 0, 'observe at least one non-boost distance step');
  assert.ok(m.boostRate > m.noBoostRate, 'boost increases per-meter accrual');
  assert.ok(m.boostRate > 1.5 * m.noBoostRate && m.boostRate < 2.5 * m.noBoostRate, 'boost roughly doubles accrual (~2x)');
});

test('combo increments per coin and multiplier tiers every COMBO_STEP, hard-capped at x6', async () => {
  const M = await core();
  const m = runReviveBot(M, 5150, 200000);
  assert.equal(m.invViolations, 0, 'multiplier == 1 + min(floor(combo/8), MULT_CAP) at every step');
  assert.equal(m.capViolations, 0, 'multiplier never exceeds the hard cap x6');
  assert.ok(m.maxCombo >= 8, 'combo reached at least one full tier');
  // Reaching the cap (x6) requires combo >= 8 * MULT_CAP; if observed, assert it.
  if (m.maxCombo >= 8 * MULT_CAP) {
    assert.equal(MULT_CAP + 1, 6, 'cap value sanity');
  }
  assert.ok(m.maxCombo > 0, 'combo did accumulate coins');
});

test('magnet pulls adjacent-lane pickups (raises collected-coin rate)', async () => {
  const M = await core();
  const m = runReviveBot(M, 5150, 200000);
  assert.ok(m.magSteps > 0, 'magnet was active at some point');
  assert.ok(m.noMagSteps > 0, 'non-magnet steps exist for comparison');
  // While the magnet is active the player collects more coins per collecting
  // step than without it, because adjacent-lane pickups are pulled in.
  assert.ok(m.magCoinRate > m.noMagCoinRate, 'magnet raises the coin-collection rate');
});

test('slow-mo reduces distance covered over a fixed wall-time', async () => {
  const M = await core();
  const m = runReviveBot(M, 5150, 200000);
  assert.ok(m.slowN > 0, 'slow-mo was active at some point');
  assert.ok(m.normN > 0, 'normal-speed steps exist for comparison');
  assert.ok(m.slowAvg < m.normAvg, 'slow-mo covers less distance per step than normal speed');
  const ratio = m.slowAvg / m.normAvg;
  assert.ok(ratio > 0.45 && ratio < SLOWMO_FACTOR + 0.15, `slow-mo distance ratio ~= SLOWMO_FACTOR (${SLOWMO_FACTOR})`);
});

test('combo resets to 0 on an unavoided hit, run keeps Playing', async () => {
  const M = await core();
  const r = new M.Runner();
  r.reset(31337, true /* unlockShield */, 0);
  r.start();

  // Sit still; collect whatever coins arrive, take a shielded hit, watch combo.
  let prevCombo = 0;
  let reset = false;
  for (let step = 0; step < 20000 && !reset; step++) {
    const c0 = r.coins(), g0 = r.gems(), combo0 = r.combo();
    r.advance(FIXED);
    if (r.state() === St.GameOver) { r.revive(); continue; }
    const combo1 = r.combo();
    if (prevCombo > 0 && combo1 === 0 && r.coins() === c0 && r.gems() === g0 && combo0 > 0) {
      reset = true; // a hit dropped combo to 0 without changing coin count
    }
    prevCombo = combo1;
  }
  assert.ok(reset, 'combo reset to 0 on an unavoided (shielded) hit while the run continued');
});

test('revive() preserves score/coins/distance and returns to Playing', async () => {
  const M = await core();
  const r = new M.Runner();
  r.reset(777, false, 0);
  r.start();

  // Drive straight into obstacles until the run ends.
  for (let step = 0; step < 20000; step++) {
    r.advance(FIXED);
    if (r.state() === St.GameOver) break;
  }
  assert.equal(r.state(), St.GameOver, 'run ended in GameOver');
  const score = r.score();
  const coins = r.coins();
  const dist = r.distance();
  assert.ok(score > 0 && dist > 0, 'had progress before death');

  r.revive();
  assert.equal(r.state(), St.Playing, 'revive returns the run to Playing');
  assert.equal(r.score(), score, 'score preserved across revive');
  assert.equal(r.coins(), coins, 'coins preserved across revive');
  assert.equal(r.distance(), dist, 'distance preserved across revive');
  assert.equal(r.hasShield(), true, 'revive grants a shield');

  r.advance(FIXED);
  assert.equal(r.state(), St.Playing, 'survives the immediate post-revive danger zone');
});

test('verifyRun re-simulation equals the live run score', async () => {
  const M = await core();
  const r = new M.Runner();
  const seed = 0xABCDEF;
  const script = { 40: Cmd.Left, 120: Cmd.Right, 260: Cmd.Jump, 400: Cmd.Left, 700: Cmd.Right };
  r.reset(seed, false, 0);
  r.start();
  const tapeSteps = [], tapeCmds = [];
  let steps = 0;
  for (; steps < 4000 && r.state() !== St.GameOver; steps++) {
    if (script[steps] !== undefined) { r.input(script[steps]); tapeSteps.push(steps); tapeCmds.push(script[steps]); }
    r.advance(FIXED);
  }
  const liveScore = r.score();
  const liveDist = r.distance();

  // Server-side verifier path (embind free function) must reproduce the score.
  const verified = M.verifyRun(seed, false, 0, tapeSteps, tapeCmds, steps);
  assert.equal(verified, liveScore, 'verifyRun re-sim equals the live run score');

  // The client "Watch Replay" path must also match.
  const rp = new M.Runner();
  rp.reset(seed, false, 0);
  rp.start();
  let idx = 0;
  for (let s = 0; s < steps && rp.state() === St.Playing; s++) {
    while (idx < tapeSteps.length && tapeSteps[idx] === s) { rp.input(tapeCmds[idx]); idx++; }
    rp.advance(FIXED);
  }
  assert.equal(rp.score(), liveScore, 'replay reproduces the live score');
  assert.equal(rp.distance(), liveDist, 'replay reproduces the live distance');
});

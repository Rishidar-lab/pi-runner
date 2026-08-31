/**
 * Server-side AUTHORITATIVE replay for Node Challenge runs.
 *
 * The browser is never trusted for score / distance / coins. Given a seed and
 * the recorded input tape, we drive the exact same deterministic C++/WASM core
 * the client ran, one fixed 120 Hz tick at a time, and read the resulting score
 * ourselves. A run is VERIFIED only if our reproduction matches every claimed
 * number.
 *
 * Competitive parity: challenge runs are ALWAYS simulated with unlockShield=false
 * and skin=0, so a cosmetic purchase can never change the outcome.
 */
'use strict';
const { getCore } = require('../simcore');

const FIXED_DT = 1 / 120; // must equal cfg::FIXED_DT in the C++ core
const STATE_GAMEOVER = 4;  // pirun::GameState::GameOver

const REASONS = Object.freeze({
  REPLAY_MISMATCH: 'REPLAY_MISMATCH',
  SCORE_MISMATCH: 'SCORE_MISMATCH',
  DISTANCE_MISMATCH: 'DISTANCE_MISMATCH',
  COINS_MISMATCH: 'COINS_MISMATCH',
  REPLAY_INCOMPLETE: 'REPLAY_INCOMPLETE',
  FINAL_TICK_MISMATCH: 'FINAL_TICK_MISMATCH',
});

/**
 * Deterministically reproduce a run. The returned object contains ONLY
 * deterministic fields — timing is returned separately by verify().
 * @returns {Promise<{authoritative:object, ms:number}>}
 */
async function reproduce({ seed, tapeSteps, tapeCmds, steps }) {
  const M = await getCore();
  const r = new M.Runner();
  const t0 = process.hrtime.bigint();
  try {
    r.reset(seed >>> 0, false, 0);
    r.start();
    let idx = 0;
    let s = 0;
    for (; s < steps && r.state() !== STATE_GAMEOVER; s++) {
      while (idx < tapeSteps.length && tapeSteps[idx] === s) {
        r.input(tapeCmds[idx]);
        idx++;
      }
      r.advance(FIXED_DT);
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return {
      authoritative: {
        score: r.score(),
        coins: r.coins(),
        distance: r.distance(),
        gems: r.gems(),
        endState: r.state(),
        ticks: s,
      },
      ms,
    };
  } finally {
    r.delete();
  }
}

/**
 * Verify a validated tape against its claimed outcome.
 * @param {object} tape  output of challenge/tape.js validate()
 * @returns {Promise<{ ok:true, authoritative:object, latencyMs:number }
 *                  | { ok:false, reason:string, authoritative?:object, latencyMs:number }>}
 */
async function verify(tape) {
  const { authoritative, ms } = await reproduce(tape);
  const latencyMs = Math.round(ms * 100) / 100;

  // The genuine client submits exactly when the run ends (GameOver) at tick
  // `steps`. A tape that does not reproduce that end-state is truncated,
  // padded, or tampered.
  if (authoritative.endState !== STATE_GAMEOVER) {
    return { ok: false, reason: REASONS.REPLAY_INCOMPLETE, authoritative, latencyMs };
  }
  if (authoritative.ticks !== tape.steps) {
    return { ok: false, reason: REASONS.FINAL_TICK_MISMATCH, authoritative, latencyMs };
  }

  const c = tape.claimed;
  if (authoritative.score !== c.score) {
    return { ok: false, reason: REASONS.SCORE_MISMATCH, authoritative, latencyMs };
  }
  if (authoritative.distance !== c.distance) {
    return { ok: false, reason: REASONS.DISTANCE_MISMATCH, authoritative, latencyMs };
  }
  if (authoritative.coins !== c.coins) {
    return { ok: false, reason: REASONS.COINS_MISMATCH, authoritative, latencyMs };
  }

  return { ok: true, authoritative, latencyMs };
}

module.exports = { reproduce, verify, REASONS, FIXED_DT };

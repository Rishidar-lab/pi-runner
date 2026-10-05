/**
 * Server-side score verification via deterministic re-simulation.
 *
 * The client submits { seed, unlockShield, skin, tapeSteps[], tapeCmds[],
 * steps, score }. We replay the exact same C++ core (compiled to WASM for Node)
 * from that seed + input tape and recompute the score. A run is trusted only if
 * the recomputed score matches the claim. This is why the core is deterministic.
 */
'use strict';
const path = require('path');

let corePromise = null;
function getCore() {
  if (!corePromise) {
    // Built by scripts/build-wasm.sh (node target).
    const factory = require(path.join(__dirname, 'pirun_core_node.js'));
    corePromise = factory();
  }
  return corePromise;
}

const MAX_STEPS = 120 * 60 * 60; // 1 hour of play at 120 Hz — a generous ceiling
const MAX_TAPE = 8192;

/** Basic structural validation of a submission before we spend CPU replaying it. */
function validateShape(body) {
  if (!body || typeof body !== 'object') return 'missing body';
  const { seed, steps, tapeSteps, tapeCmds, score, coins, distance } = body;
  if (!Number.isFinite(seed)) return 'bad seed';
  if (!Number.isInteger(steps) || steps < 0 || steps > MAX_STEPS) return 'bad steps';
  if (!Array.isArray(tapeSteps) || !Array.isArray(tapeCmds)) return 'bad tape';
  if (tapeSteps.length !== tapeCmds.length) return 'tape length mismatch';
  if (tapeSteps.length > MAX_TAPE) return 'tape too long';
  for (let i = 0; i < tapeSteps.length; i++) {
    if (!Number.isInteger(tapeSteps[i]) || tapeSteps[i] < 0 || tapeSteps[i] > steps) return 'bad tape step';
    if (!Number.isInteger(tapeCmds[i]) || tapeCmds[i] < 0 || tapeCmds[i] > 4) return 'bad tape cmd';
  }
  if (![score, coins, distance].every(Number.isFinite)) return 'bad totals';
  return null;
}

/**
 * @returns {Promise<{ ok: boolean, serverScore?: number, reason?: string }>}
 */
async function verify(body) {
  const shapeErr = validateShape(body);
  if (shapeErr) return { ok: false, reason: shapeErr };

  const core = await getCore();
  const serverScore = core.verifyRun(
    Number(body.seed), Boolean(body.unlockShield), Number(body.skin) | 0,
    body.tapeSteps, body.tapeCmds, Number(body.steps),
  );

  // Identical arithmetic on both sides -> exact match expected.
  if (serverScore !== Number(body.score)) {
    return { ok: false, serverScore, reason: 'score mismatch' };
  }
  return { ok: true, serverScore };
}

module.exports = { verify };

/**
 * Node Challenge input-tape validation & hardening.
 *
 * A submission must carry everything needed to EXACTLY reproduce the run:
 *   runId, challengeId, seed, simulationVersion, tapeVersion,
 *   steps (total fixed ticks), tapeSteps[]/tapeCmds[] (the input tape),
 *   claimed { score, distance, coins }.
 *
 * We validate structure and bounds cheaply here, BEFORE spending CPU on
 * re-simulation. Never eval or deserialize client data as code.
 */
'use strict';
const { TAPE_VERSION, isTapeCompatible, isSimulationCompatible } = require('../version');

// Bounds. The client caps its own tape at 4096 entries and a run is fixed-step
// at 120 Hz; 216000 steps == 30 minutes, a generous ceiling for one run.
const MAX_TAPE = 4096;
const MAX_STEPS = 120 * 60 * 30;
const MAX_INPUTS_PER_STEP = 8; // lane/jump/slide spam guard
const VALID_CMDS = new Set([1, 2, 3, 4]); // Left, Right, Jump, Slide (0/None rejected)

const REASONS = Object.freeze({
  INVALID_INPUT_TAPE: 'INVALID_INPUT_TAPE',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  TAPE_TOO_LONG: 'TAPE_TOO_LONG',
  RUN_TOO_LONG: 'RUN_TOO_LONG',
});

function isFiniteNumber(n) { return typeof n === 'number' && Number.isFinite(n); }
function isUint(n) { return Number.isInteger(n) && n >= 0; }

/**
 * @returns {{ ok: true, tape: object } | { ok: false, reason: string, detail?: string }}
 */
function validate(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'missing body' };
  }

  const {
    runId, challengeId, seed, simulationVersion, tapeVersion,
    steps, tapeSteps, tapeCmds, claimed,
  } = body;

  if (typeof runId !== 'string' || !/^[a-f0-9]{32}$/.test(runId)) {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'bad runId' };
  }
  if (typeof challengeId !== 'string' || challengeId.length > 64 ||
      !/^[a-z-]+:[0-9A-Za-z-]+:v\d+$/.test(challengeId)) {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'bad challengeId' };
  }
  if (!isTapeCompatible(tapeVersion)) {
    return { ok: false, reason: REASONS.VERSION_MISMATCH, detail: `tapeVersion (want ${TAPE_VERSION})` };
  }
  if (!isSimulationCompatible(simulationVersion)) {
    return { ok: false, reason: REASONS.VERSION_MISMATCH, detail: 'simulationVersion' };
  }
  if (!isFiniteNumber(seed) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'bad seed' };
  }
  if (!isUint(steps) || steps === 0) {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'bad steps' };
  }
  if (steps > MAX_STEPS) {
    return { ok: false, reason: REASONS.RUN_TOO_LONG, detail: `steps > ${MAX_STEPS}` };
  }
  if (!Array.isArray(tapeSteps) || !Array.isArray(tapeCmds)) {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'tape not arrays' };
  }
  if (tapeSteps.length !== tapeCmds.length) {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'tape length mismatch' };
  }
  if (tapeSteps.length > MAX_TAPE) {
    return { ok: false, reason: REASONS.TAPE_TOO_LONG, detail: `> ${MAX_TAPE} entries` };
  }

  // Tick ordering: non-decreasing, in-range, bounded burst per tick.
  let prev = -1;
  let runLen = 0;
  for (let i = 0; i < tapeSteps.length; i++) {
    const s = tapeSteps[i];
    const c = tapeCmds[i];
    if (!Number.isInteger(s) || s < 0 || s >= steps) {
      return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: `tapeSteps[${i}] out of range` };
    }
    if (!Number.isInteger(c) || !VALID_CMDS.has(c)) {
      return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: `tapeCmds[${i}] invalid` };
    }
    if (s < prev) {
      return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'tape not ordered' };
    }
    runLen = s === prev ? runLen + 1 : 0;
    if (runLen >= MAX_INPUTS_PER_STEP) {
      return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'input spam on a single tick' };
    }
    prev = s;
  }

  if (!claimed || typeof claimed !== 'object') {
    return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: 'missing claimed totals' };
  }
  for (const k of ['score', 'distance', 'coins']) {
    if (!isFiniteNumber(claimed[k]) || !Number.isInteger(claimed[k]) || claimed[k] < 0) {
      return { ok: false, reason: REASONS.INVALID_INPUT_TAPE, detail: `claimed.${k} invalid` };
    }
  }

  return {
    ok: true,
    tape: {
      runId,
      challengeId,
      seed,
      simulationVersion,
      tapeVersion: Number(tapeVersion),
      steps,
      tapeSteps,
      tapeCmds,
      claimed: {
        score: claimed.score,
        distance: claimed.distance,
        coins: claimed.coins,
      },
    },
  };
}

module.exports = { validate, REASONS, MAX_TAPE, MAX_STEPS };

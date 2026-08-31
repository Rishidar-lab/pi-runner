/**
 * Explicit version surface for Pi Runner.
 *
 * These are deliberately independent of package.json so that competitive replay
 * verification can fail *safely* across incompatible builds. Bump rules:
 *
 *   APP_VERSION         — user-facing release. Cosmetic; never gates verification.
 *   SIMULATION_VERSION  — bump whenever the C++ core's deterministic behaviour
 *                         changes (scoring, RNG, spawn logic, timestep). A run
 *                         recorded under a different SIMULATION_VERSION must NOT
 *                         be trusted, because the server would re-simulate it
 *                         under different rules.
 *   RULES_VERSION       — bump when Node Challenge rules change (seed derivation,
 *                         eligibility window, identity binding). Part of the
 *                         deterministic challenge id, so a bump starts a fresh
 *                         challenge/leaderboard for the day.
 *   TAPE_VERSION        — bump when the input-tape wire format changes.
 *
 * Compatibility policy: EXACT match required for SIMULATION_VERSION and
 * TAPE_VERSION (fail closed). RULES_VERSION is carried in the challenge id, so an
 * old-rules run simply targets an old challenge id that is no longer "current".
 */
'use strict';

const APP_VERSION = '2.1.0';
const SIMULATION_VERSION = '1.0.0';
const RULES_VERSION = 1;
const TAPE_VERSION = 1;

/** The committed C++/WASM core this build re-simulates with. See SIMULATION_VERSION. */
function isSimulationCompatible(v) {
  return typeof v === 'string' && v === SIMULATION_VERSION;
}

function isTapeCompatible(v) {
  return Number(v) === TAPE_VERSION;
}

function isRulesCompatible(v) {
  return Number(v) === RULES_VERSION;
}

module.exports = {
  APP_VERSION,
  SIMULATION_VERSION,
  RULES_VERSION,
  TAPE_VERSION,
  isSimulationCompatible,
  isTapeCompatible,
  isRulesCompatible,
};

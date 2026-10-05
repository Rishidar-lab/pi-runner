/**
 * Shared handle to the deterministic C++ simulation core, compiled to
 * WebAssembly for Node (`server/pirun_core_node.js`, committed self-contained).
 *
 * This is the SAME build the browser and the leaderboard verifier use. There is
 * exactly one gameplay implementation in this project; every server-side replay
 * path goes through here.
 */
'use strict';
const path = require('path');

let corePromise = null;

/** Instantiate the WASM core exactly once for the process. */
function getCore() {
  if (!corePromise) {
    const factory = require(path.join(__dirname, 'pirun_core_node.js'));
    corePromise = factory();
  }
  return corePromise;
}

module.exports = { getCore };

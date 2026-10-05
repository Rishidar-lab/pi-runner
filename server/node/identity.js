/**
 * Local SoloHost node identity.
 *
 * This is NOT a Pi blockchain validator identity and makes no consensus claims.
 * It is simply a stable, per-installation identifier for *this* Pi Runner node,
 * generated once on first boot and persisted so it survives container restarts.
 *
 * Properties:
 *   - cryptographically random (crypto.randomBytes), generated exactly once;
 *   - not derived from hostname, MAC, or any hardware fingerprint;
 *   - `id` is safe to display; `secret` never leaves this process (used to sign
 *     run tokens so a client cannot forge a challenge session).
 */
'use strict';
const crypto = require('crypto');
const store = require('../store');
const log = require('../log');
const { APP_VERSION, SIMULATION_VERSION } = require('../version');

let cached = null;

function ensure() {
  if (cached) return cached;
  const existing = store.getNode();
  if (existing && existing.id && existing.secret) {
    cached = existing;
    return cached;
  }
  const node = {
    id: crypto.randomBytes(16).toString('hex'),       // 128-bit public id
    secret: crypto.randomBytes(32).toString('hex'),   // HMAC key, never exposed
    createdAt: Date.now(),
  };
  store.setNode(node);
  cached = node;
  log.info('node.identity_created', { nodeIdShort: shortId(node.id), createdAt: node.createdAt });
  return cached;
}

function shortId(id) {
  return String(id || '').slice(0, 6).toUpperCase();
}

/** The HMAC key for signing run tokens. Server-side only. */
function signingKey() {
  return Buffer.from(ensure().secret, 'hex');
}

/** Sign an opaque payload string, returning a short hex tag. */
function sign(payload) {
  return crypto.createHmac('sha256', signingKey()).update(String(payload)).digest('hex');
}

function verify(payload, tag) {
  const expected = sign(payload);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(tag || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Public, secret-free view for the UI / status endpoints. */
function publicView() {
  const n = ensure();
  return {
    id: n.id,
    idShort: shortId(n.id),
    label: `Node ${shortId(n.id)}`,
    createdAt: n.createdAt,
    appVersion: APP_VERSION,
    simulationVersion: SIMULATION_VERSION,
  };
}

module.exports = { ensure, publicView, shortId, sign, verify };

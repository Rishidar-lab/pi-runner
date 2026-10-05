/**
 * App wallet for App-to-User (A2U) π payouts.
 *
 * Real payouts require Pi's official `pi-backend` package (which wraps the
 * Stellar SDK to sign transactions) AND the app wallet passphrase. Both are
 * provided at deploy time — NEVER committed:
 *   - `npm i pi-backend` on the host
 *   - env PI_API_KEY  (already used elsewhere)
 *   - env PI_WALLET_PASSPHRASE  (the app wallet's secret; keep it secret)
 *
 * If either is missing, the wallet reports `configured() === false` and reward
 * claims are recorded in the ledger as "pending" instead of paying out — so the
 * game runs safely with payouts dark until you finish Pi approval + funding.
 *
 * The A2U sequence (per Pi docs) is: createPayment -> submitPayment (on-chain,
 * signed by the app wallet) -> completePayment(txid). `pi-backend` exposes all
 * three; we just orchestrate + guard against double-payment.
 */
'use strict';

let piNetwork = null;
let initTried = false;

function init() {
  if (initTried) return piNetwork;
  initTried = true;
  const seed = process.env.PI_WALLET_PASSPHRASE || '';
  const apiKey = process.env.PI_API_KEY || '';
  if (!seed || !apiKey) return (piNetwork = null);
  try {
    // Optional dependency — only present on a configured production host.
    // eslint-disable-next-line global-require, import/no-unresolved
    const PiNetwork = require('pi-backend');
    piNetwork = new PiNetwork(apiKey, seed);
  } catch (e) {
    console.warn('[wallet] pi-backend not installed — A2U payouts disabled:', e.message);
    piNetwork = null;
  }
  return piNetwork;
}

function configured() {
  return process.env.REWARDS_ENABLED === '1' && Boolean(init());
}

/**
 * Pay `amount` π to `uid`. Returns { ok, paymentId?, txid?, reason? }.
 * Idempotency is enforced upstream (rewards.js) via a unique idempotencyKey and
 * the ledger; here we additionally use onIncompletePayment recovery via metadata.
 */
async function payout({ uid, amount, memo, metadata }) {
  const pi = init();
  if (!pi) return { ok: false, reason: 'wallet_not_configured' };
  try {
    const paymentId = await pi.createPayment({ amount, memo, metadata, uid });
    const txid = await pi.submitPayment(paymentId);
    const completed = await pi.completePayment(paymentId, txid);
    return { ok: true, paymentId, txid, payment: completed };
  } catch (e) {
    return { ok: false, reason: 'payout_failed', message: e && e.message ? e.message : String(e) };
  }
}

module.exports = { configured, payout };

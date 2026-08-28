/**
 * Thin wrapper over the Pi Platform API. Keeps the API-key header rule in one
 * place and the secret strictly server-side.
 *
 *   USER access token -> "Authorization: Bearer <accessToken>"  (from Pi.authenticate)
 *   SERVER API key     -> "Authorization: Key <PI_API_KEY>"      (Developer Portal)
 */
'use strict';
const PI_API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com/v2';
const PI_API_KEY = process.env.PI_API_KEY || '';

function hasApiKey() { return Boolean(PI_API_KEY); }

async function verifyUser(accessToken) {
  const r = await fetch(`${PI_API_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  return r.json();
}

async function approvePayment(paymentId) {
  const r = await fetch(`${PI_API_BASE}/payments/${paymentId}/approve`, {
    method: 'POST', headers: { Authorization: `Key ${PI_API_KEY}` },
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function completePayment(paymentId, txid) {
  const r = await fetch(`${PI_API_BASE}/payments/${paymentId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// ---- Pi Ad Network -------------------------------------------------------
// Verify a rewarded ad server-side. A reward may be granted ONLY when the
// returned mediator_ack_status is "granted" (never trust the client result).
async function getAdNetworkStatus(adId) {
  const r = await fetch(`${PI_API_BASE}/ads_network/status/${encodeURIComponent(adId)}`, {
    headers: { Authorization: `Key ${PI_API_KEY}` },
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
function adGranted(statusData) {
  return Boolean(statusData && statusData.mediator_ack_status === 'granted');
}

// ---- App-to-User (A2U) payments -----------------------------------------
// Real π payouts to users. This creates the payment record and completes it
// once the on-chain transaction is submitted. Submitting the transaction
// requires the app wallet's secret and the Pi/Stellar SDK; see server/wallet.js.
async function createA2UPayment({ uid, amount, memo, metadata }) {
  const r = await fetch(`${PI_API_BASE}/payments`, {
    method: 'POST',
    headers: { Authorization: `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment: { amount, memo, metadata, uid } }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
async function completeA2UPayment(paymentId, txid) {
  const r = await fetch(`${PI_API_BASE}/payments/${paymentId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
async function cancelA2UPayment(paymentId) {
  const r = await fetch(`${PI_API_BASE}/payments/${paymentId}/cancel`, {
    method: 'POST', headers: { Authorization: `Key ${PI_API_KEY}` },
  });
  return { ok: r.ok, status: r.status };
}

module.exports = {
  hasApiKey, verifyUser, approvePayment, completePayment, PI_API_BASE,
  getAdNetworkStatus, adGranted, createA2UPayment, completeA2UPayment, cancelA2UPayment,
};

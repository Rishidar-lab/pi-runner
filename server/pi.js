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

module.exports = { hasApiKey, verifyUser, approvePayment, completePayment, PI_API_BASE };

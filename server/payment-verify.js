/**
 * Pure payment-validation logic — unit-testable without booting the server.
 * The browser is untrusted: a payment is honored only when Pi's own PaymentDTO
 * matches the authoritative product catalog AND the verified buyer.
 */
'use strict';
const { getProduct } = require('./products');

/**
 * @param {object} payment  Pi PaymentDTO (from GET /payments/{id})
 * @param {string} uid      authoritative uid (from verified access token)
 * @param {string} productId
 * @param {string} expectedNet  expected network, e.g. "mainnet" | "testnet"
 * @returns {{ ok: boolean, reason?: string }}
 */
function validatePaymentForProduct(payment, uid, productId, expectedNet) {
  const product = getProduct(productId);
  if (!product) return { ok: false, reason: 'unknown_product' };
  if (!payment) return { ok: false, reason: 'payment_not_found' };
  if (payment.user_uid !== uid) return { ok: false, reason: 'payment_owner_mismatch' };
  if (Number(payment.amount) !== product.amount) return { ok: false, reason: 'amount_mismatch' };
  if (payment.memo !== product.memo) return { ok: false, reason: 'memo_mismatch' };
  if (payment.direction && payment.direction.toLowerCase() !== 'u2a') return { ok: false, reason: 'wrong_direction' };
  if (payment.network && payment.network.toLowerCase() !== String(expectedNet).toLowerCase()) {
    return { ok: false, reason: 'wrong_network' };
  }
  const st = payment.status || {};
  if (st.developer_completed) return { ok: false, reason: 'already_completed' };
  if (st.cancelled || st.user_cancelled) return { ok: false, reason: 'payment_cancelled' };
  return { ok: true };
}

module.exports = { validatePaymentForProduct };

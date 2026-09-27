/**
 * Authoritative product catalog — the SERVER is the source of truth for what is
 * sold and at what price. The client may cache a copy for display, but every
 * payment is validated against this catalog before approval (see server.js
 * /api/approve). Changing a price here changes what the server will honor;
 * the client cannot influence it.
 */
'use strict';

const PRODUCTS = {
  gold_shield_unlock_v1: {
    amount: 1, // π — the only product; cosmetic + one starting shield, never pay-to-win
    memo: 'Unlock Gold Orb + Shield in Kurinji Run',
  },
};

function getProduct(id) {
  return PRODUCTS[id] || null;
}

function listProducts() {
  // Public, safe-to-serve catalog (no secrets).
  return Object.fromEntries(
    Object.entries(PRODUCTS).map(([id, p]) => [id, { amount: p.amount }]),
  );
}

module.exports = { PRODUCTS, getProduct, listProducts };

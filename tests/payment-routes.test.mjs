/**
 * Adversarial route-level payment tests (Node built-in runner).
 *
 * These boot the REAL Express app (server/server.js) with the Pi Platform API
 * wrapper (server/pi.js) replaced by an in-process mock, so no network calls
 * are made to Pi. They prove the server-authoritative invariant end-to-end at
 * the HTTP layer:
 *
 *   THE CLIENT NEVER DETERMINES WHETHER A PAYMENT IS SUFFICIENT.
 *
 * Covered: token binding (uid derived from the verified token, client body uid
 * ignored), the server-side payments gate (off by default; mainnet locked),
 * amount/memo/buyer/network/direction/product validation, unknown/arbitrary
 * paymentIds, cancelled/incomplete payments, missing/undefined txid, approval
 * and completion idempotency/replay, complete-before-approve, and failure ->
 * no-entitlement.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Environment: payments ENABLED on TESTNET for these tests ────────────────
const DATA_DIR = mkdtempSync(join(tmpdir(), 'pirun-payroutes-'));
process.env.DATA_DIR = DATA_DIR;
process.env.PI_API_KEY = 'test-api-key';
process.env.PI_NETWORK = 'testnet';
process.env.PI_PAYMENTS_ENABLED = '1';
process.env.PI_ALLOW_MAINNET = '0';
process.env.PORT = '0'; // ephemeral port
process.env.BIND_HOST = '127.0.0.1';
process.env.LOG_LEVEL = 'error';
process.env.DISABLE_RATE_LIMIT = '1';

// ── Controllable Pi mock ────────────────────────────────────────────────────
const mock = {};
const PRODUCT_ID = 'gold_shield_unlock_v1';
const MEMO = 'Unlock Gold Orb + Shield in Kurinji Run';

function goodPayment(over = {}) {
  return {
    identifier: 'pay_default',
    user_uid: 'uid_alice',
    amount: 1,
    memo: MEMO,
    metadata: { item: PRODUCT_ID },
    direction: 'U2A',
    network: 'Testnet',
    status: {
      developer_approved: false, transaction_verified: false,
      developer_completed: false, cancelled: false, user_cancelled: false,
    },
    transaction: null,
    ...over,
  };
}

const mockPi = {
  hasApiKey: () => mock.apiKey,
  verifyUser: (t) => mock.verifyUser(t),
  getPayment: (id) => mock.getPayment(id),
  approvePayment: (id) => mock.approvePayment(id),
  completePayment: (id, txid) => mock.completePayment(id, txid),
  PI_API_BASE: 'https://mock.invalid/v2',
  getAdNetworkStatus: async () => ({ ok: true, status: 200, data: {} }),
  adGranted: () => false,
  createA2UPayment: async () => ({ ok: true, status: 200, data: {} }),
  completeA2UPayment: async () => ({ ok: true, status: 200, data: {} }),
  cancelA2UPayment: async () => ({ ok: true, status: 200 }),
};

// Inject the mock BEFORE server.js requires './pi'.
const piPath = require.resolve(join(ROOT, 'server', 'pi.js'));
require.cache[piPath] = { id: piPath, filename: piPath, loaded: true, exports: mockPi };

let base;
let serverRef;

before(async () => {
  const mod = require(join(ROOT, 'server', 'server.js'));
  serverRef = mod.server;
  await new Promise((resolve) => {
    if (serverRef.listening) return resolve();
    serverRef.once('listening', resolve);
  });
  const addr = serverRef.address();
  base = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  try { serverRef?.close(); } catch { /* ignore */ }
  try { rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

// Fresh, valid defaults before each test. Individual tests override `mock.*`.
beforeEach(() => {
  mock.apiKey = true;
  mock.verifyUser = async (t) => (t === 'good-token' ? { uid: 'uid_alice', username: 'alice' } : null);
  mock.getPayment = async (id) => ({ ok: true, status: 200, data: goodPayment({ identifier: id }) });
  mock.approvePayment = async (id) => ({ ok: true, status: 200, data: { identifier: id, status: { developer_approved: true } } });
  mock.completePayment = async (id, txid) => ({ ok: true, status: 200, data: { identifier: id, status: { developer_completed: true }, transaction: { txid } } });
  // reset the payment gate to the test default (enabled, testnet)
  process.env.PI_PAYMENTS_ENABLED = '1';
  process.env.PI_NETWORK = 'testnet';
  process.env.PI_ALLOW_MAINNET = '0';
});

async function post(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
async function get(path) {
  const r = await fetch(`${base}${path}`);
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
let n = 0;
const uid = (id = 'pay') => `${id}_${Date.now()}_${n++}`; // unique id per test

// ── APPROVE ────────────────────────────────────────────────────────────────
test('approve: genuine testnet payment is approved', async () => {
  const id = uid();
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('approve: missing access token -> 401', async () => {
  const r = await post('/api/approve', { paymentId: uid(), productId: PRODUCT_ID });
  assert.equal(r.status, 401);
});

test('approve: fake/invalid access token -> 401 (Pi /me rejects it)', async () => {
  const r = await post('/api/approve', { paymentId: uid(), productId: PRODUCT_ID, accessToken: 'forged' });
  assert.equal(r.status, 401);
});

test('approve: missing paymentId -> 400', async () => {
  const r = await post('/api/approve', { productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 400);
});

test('approve: missing productId -> 400', async () => {
  const r = await post('/api/approve', { paymentId: uid(), accessToken: 'good-token' });
  assert.equal(r.status, 400);
});

test('approve: UNDERPAY (0.001) is rejected 409 amount_mismatch', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, amount: 0.001 }) });
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'amount_mismatch');
});

test('approve: OVERPAY (2) is rejected 409 amount_mismatch', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, amount: 2 }) });
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'amount_mismatch');
});

test('approve: wrong memo -> 409 memo_mismatch', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, memo: 'free stuff' }) });
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'memo_mismatch');
});

test('approve: buyer != verified token uid -> 409 payment_owner_mismatch', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, user_uid: 'uid_mallory' }) });
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'payment_owner_mismatch');
});

test('approve: wrong network (Mainnet payment on testnet host) -> 409 wrong_network', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, network: 'Mainnet' }) });
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'wrong_network');
});

test('approve: unexpected direction (A2U) -> 409 wrong_direction', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, direction: 'A2U' }) });
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'wrong_direction');
});

test('approve: nonexistent product id -> 409 unknown_product', async () => {
  const r = await post('/api/approve', { paymentId: uid(), productId: 'diamond_hack_v9', accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'unknown_product');
});

test('approve: arbitrary paymentId Pi cannot find -> 404 (not approved)', async () => {
  mock.getPayment = async () => ({ ok: false, status: 404, data: { error: 'not_found' } });
  const r = await post('/api/approve', { paymentId: 'totally-made-up', productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 404);
});

test('approve: cancelled payment -> 409 payment_cancelled', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, status: { cancelled: true } }) });
  const r = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'payment_cancelled');
});

test('approve: malformed PaymentDTO (empty object) is rejected, never approved', async () => {
  mock.getPayment = async () => ({ ok: true, status: 200, data: {} });
  const r = await post('/api/approve', { paymentId: uid(), productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
});

test('approve: replay is idempotent (second identical approve returns idempotent)', async () => {
  const id = uid();
  const r1 = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r1.status, 200);
  const r2 = await post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r2.status, 200);
  assert.equal(r2.data.idempotent, true);
});

test('approve: concurrent duplicate approvals do not error', async () => {
  const id = uid();
  const [a, b] = await Promise.all([
    post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' }),
    post('/api/approve', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' }),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
});

test('approve: missing PI_API_KEY fails closed (500 config error)', async () => {
  mock.apiKey = false;
  const r = await post('/api/approve', { paymentId: uid(), productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 500);
});

// ── PAYMENT GATE (config safety) ────────────────────────────────────────────
test('gate: payments disabled by default -> 503 payments_disabled', async () => {
  process.env.PI_PAYMENTS_ENABLED = '0';
  const r = await post('/api/approve', { paymentId: uid(), productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 503);
  assert.equal(r.data.reason, 'payments_disabled');
});

test('gate: mainnet blocked unless PI_ALLOW_MAINNET set -> 503 mainnet_disabled', async () => {
  process.env.PI_NETWORK = 'mainnet';
  process.env.PI_ALLOW_MAINNET = '0';
  const r = await post('/api/approve', { paymentId: uid(), productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 503);
  assert.equal(r.data.reason, 'mainnet_disabled');
});

// ── COMPLETE ────────────────────────────────────────────────────────────────
test('complete: transaction not verified yet -> 409 tx_not_ready (no entitlement)', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id }) }); // tx unverified
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'tx_not_ready');
});

test('complete: missing txid -> 409 tx_not_ready (undefined txid never sent to Pi)', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, status: { transaction_verified: true }, transaction: {} }) });
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'tx_not_ready');
});

test('complete: verified tx grants entitlement exactly once (idempotent replay)', async () => {
  const id = uid();
  const buyer = 'uid_alice';
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, status: { transaction_verified: true }, transaction: { txid: 'TX123' } }) });
  const r1 = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r1.status, 200);
  assert.equal(r1.data.granted, true);
  const owns1 = await get(`/api/unlock-status?uid=${buyer}`);
  assert.equal(owns1.data.unlocked, true);

  // replay: store now says completed -> idempotent, still granted, no double state
  const r2 = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r2.status, 200);
  assert.equal(r2.data.idempotent, true);
  assert.equal(r2.data.granted, true);
});

test('complete: client body uid is IGNORED; entitlement binds to token-verified uid', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, user_uid: 'uid_alice', status: { transaction_verified: true }, transaction: { txid: 'TXBIND' } }) });
  // Attacker-style body: claim a different uid. Server must ignore it.
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token', uid: 'uid_attacker' });
  assert.equal(r.status, 200);
  const alice = await get('/api/unlock-status?uid=uid_alice');
  const attacker = await get('/api/unlock-status?uid=uid_attacker');
  assert.equal(alice.data.unlocked, true, 'token uid gets the unlock');
  assert.equal(attacker.data.unlocked, false, 'body uid gets nothing');
});

test('complete: underpaid but tx-verified payment is still rejected 409 amount_mismatch', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, amount: 0.001, status: { transaction_verified: true }, transaction: { txid: 'TXUNDER' } }) });
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'amount_mismatch');
});

test('complete: buyer mismatch on verified tx -> 409 payment_owner_mismatch', async () => {
  const id = uid();
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, user_uid: 'uid_mallory', status: { transaction_verified: true }, transaction: { txid: 'TXOWN' } }) });
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  assert.equal(r.data.reason, 'payment_owner_mismatch');
});

test('complete: missing access token -> 401', async () => {
  const r = await post('/api/complete', { paymentId: uid(), productId: PRODUCT_ID });
  assert.equal(r.status, 401);
});

test('complete: Pi complete fails and payment not completed -> error, NO entitlement', async () => {
  const id = uid();
  const buyer = 'uid_bob';
  mock.verifyUser = async (t) => (t === 'good-token' ? { uid: buyer, username: 'bob' } : null);
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, user_uid: buyer, status: { transaction_verified: true }, transaction: { txid: 'TXFAIL' } }) });
  mock.completePayment = async () => ({ ok: false, status: 502, data: { error: 'pi_down' } });
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 502);
  const owns = await get(`/api/unlock-status?uid=${buyer}`);
  assert.equal(owns.data.unlocked, false, 'failed completion grants nothing');
});

test('complete: Pi already developer_completed -> reconciled idempotently (single grant)', async () => {
  const id = uid();
  const buyer = 'uid_carol';
  mock.verifyUser = async (t) => (t === 'good-token' ? { uid: buyer, username: 'carol' } : null);
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, user_uid: buyer, amount: 1, memo: MEMO, status: { developer_completed: true, transaction_verified: true }, transaction: { txid: 'TXDONE' } }) });
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 200);
  const owns = await get(`/api/unlock-status?uid=${buyer}`);
  assert.equal(owns.data.unlocked, true);
});

test('complete: cancelled payment gives no entitlement', async () => {
  const id = uid();
  const buyer = 'uid_dave';
  mock.verifyUser = async (t) => (t === 'good-token' ? { uid: buyer, username: 'dave' } : null);
  mock.getPayment = async () => ({ ok: true, status: 200, data: goodPayment({ identifier: id, user_uid: buyer, status: { transaction_verified: true, cancelled: true }, transaction: { txid: 'TXCXL' } }) });
  const r = await post('/api/complete', { paymentId: id, productId: PRODUCT_ID, accessToken: 'good-token' });
  assert.equal(r.status, 409);
  const owns = await get(`/api/unlock-status?uid=${buyer}`);
  assert.equal(owns.data.unlocked, false);
});

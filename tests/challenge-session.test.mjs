/**
 * Node Challenge run-session lifecycle tests.
 *
 *   - a fresh session is ISSUED, has an unpredictable 128-bit runId, an expiry,
 *     and a valid node-signed token
 *   - an unknown runId resolves to null
 *   - a session past its deadline lazily becomes EXPIRED on load
 *   - the state machine rejects illegal transitions
 *   - a tampered session token fails verification
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = join(ROOT, 'server', 'data-test-session');
rmSync(process.env.DATA_DIR, { recursive: true, force: true });

const sessions = require(join(ROOT, 'server', 'challenge', 'sessions.js'));
const store = require(join(ROOT, 'server', 'store.js'));

test('issue() creates an ISSUED session with a random runId and valid token', () => {
  const s = sessions.issue();
  assert.equal(s.status, 'ISSUED');
  assert.match(s.runId, /^[a-f0-9]{32}$/);
  assert.ok(s.expiresAt > s.issuedAt);
  assert.equal(sessions.tokenValid(s), true);

  const s2 = sessions.issue();
  assert.notEqual(s.runId, s2.runId, 'runIds are unique');
});

test('get() returns null for an unknown runId', () => {
  assert.equal(sessions.get('0'.repeat(32)), null);
});

test('a session past expiresAt becomes EXPIRED on load', () => {
  const s = sessions.issue();
  s.expiresAt = Date.now() - 1000;
  store.putSession(s);
  const loaded = sessions.get(s.runId);
  assert.equal(loaded.status, 'EXPIRED');
});

test('the state machine enforces legal transitions only', () => {
  assert.equal(sessions.canTransition('ISSUED', 'STARTED'), true);
  assert.equal(sessions.canTransition('ISSUED', 'SUBMITTED'), true);
  assert.equal(sessions.canTransition('STARTED', 'SUBMITTED'), true);
  assert.equal(sessions.canTransition('SUBMITTED', 'VERIFIED'), true);
  assert.equal(sessions.canTransition('SUBMITTED', 'REJECTED'), true);
  assert.equal(sessions.canTransition('ISSUED', 'VERIFIED'), false);
  assert.equal(sessions.canTransition('VERIFIED', 'REJECTED'), false);
  assert.equal(sessions.canTransition('EXPIRED', 'SUBMITTED'), false);

  const s = sessions.issue();
  assert.throws(() => sessions.transition(s, 'VERIFIED'), /illegal session transition/);
  sessions.transition(s, 'STARTED', { startedAt: Date.now() });
  sessions.transition(s, 'SUBMITTED', { submittedAt: Date.now() });
  sessions.transition(s, 'VERIFIED', { result: { score: 1 } });
  assert.equal(sessions.get(s.runId).status, 'VERIFIED');
});

test('a tampered session token fails verification', () => {
  const s = sessions.issue();
  assert.equal(sessions.tokenValid(s), true);
  s.seed = (s.seed ^ 0xffff) >>> 0; // change what was signed
  assert.equal(sessions.tokenValid(s), false);
  const s2 = sessions.issue();
  s2.token = 'deadbeef'.repeat(8);
  assert.equal(sessions.tokenValid(s2), false);
});

test('sessions survive a store reload (persistence)', () => {
  const s = sessions.issue();
  store.flushSync();
  store._reload();
  const loaded = sessions.get(s.runId);
  assert.ok(loaded, 'session reloaded from disk');
  assert.equal(loaded.runId, s.runId);
  assert.equal(sessions.tokenValid(loaded), true);
});

test.after(async () => {
  await new Promise((r) => setImmediate(r));
  try { rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

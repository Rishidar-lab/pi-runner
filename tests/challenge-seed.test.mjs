/**
 * Deterministic Node Challenge seed / id tests.
 *
 *   - same UTC day  -> identical challenge (id + seed), regardless of wall clock
 *   - different UTC day -> different challenge and (with overwhelming odds)
 *     a different seed
 *   - the seed is a pure HMAC of (namespace, date, rules, sim) — no Math.random
 *   - a custom NODE_CHALLENGE_SECRET changes the derived seed (node-private)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = join(ROOT, 'server', 'data-test-seed');

const challenge = require(join(ROOT, 'server', 'challenge', 'challenge.js'));

test('same UTC day -> identical challenge id and seed at any hour', () => {
  const morning = challenge.buildChallenge('daily', new Date('2026-08-31T00:07:00Z'));
  const evening = challenge.buildChallenge('daily', new Date('2026-08-31T23:52:00Z'));
  assert.equal(morning.id, 'daily:2026-08-31:v1');
  assert.equal(morning.id, evening.id);
  assert.equal(morning.seed, evening.seed);
  assert.equal(morning.startsAt, '2026-08-31T00:00:00.000Z');
  assert.equal(morning.endsAt, '2026-09-01T00:00:00.000Z');
});

test('different UTC day -> different challenge id and seed', () => {
  const a = challenge.buildChallenge('daily', new Date('2026-08-31T12:00:00Z'));
  const b = challenge.buildChallenge('daily', new Date('2026-09-01T12:00:00Z'));
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.seed, b.seed);
});

test('seed is a stable pure function (repeatable across calls)', () => {
  const s1 = challenge.deriveSeed('daily', '2026-08-31');
  const s2 = challenge.deriveSeed('daily', '2026-08-31');
  assert.equal(s1, s2);
  assert.ok(Number.isInteger(s1) && s1 >= 0 && s1 <= 0xffffffff, 'seed is a uint32');
});

test('changing the challenge type changes the seed for the same period', () => {
  assert.notEqual(
    challenge.deriveSeed('daily', '2026-08-31'),
    challenge.deriveSeed('practice', '2026-08-31'),
  );
});

test('a node-private NODE_CHALLENGE_SECRET changes the derived seed', () => {
  const publicSeed = challenge.deriveSeed('daily', '2026-08-31');
  assert.equal(challenge.usesPublicNamespace(), true);

  process.env.NODE_CHALLENGE_SECRET = 'super-secret-node-key-123';
  // require a fresh module instance to pick up the env change
  delete require.cache[require.resolve(join(ROOT, 'server', 'challenge', 'challenge.js'))];
  delete require.cache[require.resolve(join(ROOT, 'server', 'version.js'))];
  const priv = require(join(ROOT, 'server', 'challenge', 'challenge.js'));

  assert.equal(priv.usesPublicNamespace(), false);
  const privateSeed = priv.deriveSeed('daily', '2026-08-31');
  assert.notEqual(publicSeed, privateSeed);

  delete process.env.NODE_CHALLENGE_SECRET;
  delete require.cache[require.resolve(join(ROOT, 'server', 'challenge', 'challenge.js'))];
});

test('parseChallengeId round-trips a current id and rejects junk', () => {
  const cur = challenge.currentChallenge(new Date('2026-08-31T10:00:00Z'));
  const parsed = challenge.parseChallengeId(cur.id, new Date('2026-08-31T10:00:00Z'));
  assert.equal(parsed.seed, cur.seed);
  assert.equal(parsed.isCurrentRules, true);
  assert.equal(challenge.parseChallengeId('nonsense'), null);
  assert.equal(challenge.parseChallengeId('../../etc/passwd'), null);
  assert.equal(challenge.parseChallengeId('daily:2026-08-31:v1' + 'x'.repeat(80)), null);
});

/**
 * Local node identity tests.
 *
 *   - an id is generated once and is a 128-bit hex string
 *   - the id survives a store reload (persisted, not regenerated)
 *   - publicView never exposes the signing secret
 *   - sign/verify round-trips and rejects tampering
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = join(ROOT, 'server', 'data-test-node');
rmSync(process.env.DATA_DIR, { recursive: true, force: true });

const node = require(join(ROOT, 'server', 'node', 'identity.js'));
const store = require(join(ROOT, 'server', 'store.js'));

test('node id is generated once as a 128-bit hex string', () => {
  const a = node.ensure();
  const b = node.ensure();
  assert.match(a.id, /^[a-f0-9]{32}$/);
  assert.equal(a.id, b.id, 'stable within a process');
  assert.match(a.secret, /^[a-f0-9]{64}$/);
});

test('node id survives a store reload (not regenerated)', () => {
  const before = node.ensure().id;
  store.flushSync();
  store._reload();
  // clear the module-level cache to force a fresh read from the reloaded store
  delete require.cache[require.resolve(join(ROOT, 'server', 'node', 'identity.js'))];
  const node2 = require(join(ROOT, 'server', 'node', 'identity.js'));
  assert.equal(node2.ensure().id, before, 'id persisted across reload');
});

test('publicView exposes no secret', () => {
  const v = node.publicView();
  assert.ok(!('secret' in v), 'no secret field');
  assert.equal(v.idShort.length, 6);
  assert.equal(v.label, `Node ${v.idShort}`);
  assert.equal(JSON.stringify(v).includes(node.ensure().secret), false);
});

test('sign/verify round-trips and rejects tampering', () => {
  const tag = node.sign('run|daily:2026-08-31:v1|123|456');
  assert.equal(node.verify('run|daily:2026-08-31:v1|123|456', tag), true);
  assert.equal(node.verify('run|daily:2026-08-31:v1|123|457', tag), false);
  assert.equal(node.verify('run|daily:2026-08-31:v1|123|456', 'ff'.repeat(32)), false);
});

test.after(async () => {
  await new Promise((r) => setImmediate(r));
  try { rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

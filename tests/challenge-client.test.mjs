/**
 * Frontend Node Challenge client tests.
 *
 * Drives the SHIPPED, transpiled client module (public/game/nodeChallenge.js) —
 * the exact code the browser loads — against a live server instance. Confirms
 * the full browser round-trip (current -> start -> play -> submit -> leaderboard
 * -> node status) and the pure display helpers.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.DATA_DIR = join(ROOT, 'server', 'data-test-client');
rmSync(process.env.DATA_DIR, { recursive: true, force: true });
process.env.PORT = '0';
process.env.NODE_CHALLENGE_DEMO = '1';
process.env.DISABLE_RATE_LIMIT = '1';
process.env.LOG_LEVEL = 'error';

const { server } = require(join(ROOT, 'server', 'server.js'));
const FIXED = 1 / 120;

// The transpiled client the browser actually ships. It has no relative imports,
// so we can load it directly as an ES module (this package.json is CJS, which
// otherwise makes a bare `import` of a .js file fail).
const clientSrc = readFileSync(join(ROOT, 'public', 'game', 'nodeChallenge.js'), 'utf8');
const {
  NodeChallengeClient, reasonText, timeRemaining, challengeLabel,
} = await import(`data:text/javascript;base64,${Buffer.from(clientSrc).toString('base64')}`);

let client;
async function core() {
  const factory = require(join(ROOT, 'server', 'pirun_core_node.js'));
  return factory();
}

before(async () => {
  await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
  client = new NodeChallengeClient(`http://127.0.0.1:${server.address().port}`);
});

test('current() returns the deterministic challenge', async () => {
  const c = await client.current();
  assert.match(c.id, /^daily:\d{4}-\d{2}-\d{2}:v1$/);
  assert.equal(typeof c.seed, 'number');
  assert.equal(c.seedNamespace, 'public');
});

test('full browser round-trip: start -> play -> submit -> verified', async () => {
  const M = await core();
  const ticket = await client.start();
  assert.match(ticket.runId, /^[a-f0-9]{32}$/);

  const r = new M.Runner();
  r.reset(ticket.seed >>> 0, false, 0);
  r.start();
  const tapeSteps = [];
  const tapeCmds = [];
  const script = { 30: 1, 140: 3, 300: 2, 520: 1 };
  let steps = 0;
  for (; steps < 200000 && r.state() !== 4; steps++) {
    if (script[steps] !== undefined) { r.input(script[steps]); tapeSteps.push(steps); tapeCmds.push(script[steps]); }
    r.advance(FIXED);
  }
  const claimed = { score: r.score(), distance: r.distance(), coins: r.coins() };
  r.delete();

  const res = await client.submit({
    ticket, steps, tapeSteps, tapeCmds, ...claimed, localName: 'ClientTester',
  });
  assert.equal(res.ok, true);
  assert.equal(res.verified, true);
  assert.equal(res.result.score, claimed.score);
  assert.ok(res.rank >= 1);
  assert.equal(res.identityKind, 'local');

  const board = await client.leaderboard();
  assert.ok(board.entries.some((e) => e.username === 'ClientTester (local)' && e.verified === true));

  const status = await client.nodeStatus();
  assert.equal(status.node.status, 'ONLINE');
  assert.ok(status.today.verifiedRuns >= 1);
});

test('submit surfaces the node reason code on a tampered run', async () => {
  const M = await core();
  const ticket = await client.start();
  const r = new M.Runner();
  r.reset(ticket.seed >>> 0, false, 0); r.start();
  let steps = 0;
  for (; steps < 200000 && r.state() !== 4; steps++) r.advance(FIXED);
  const claimed = { score: r.score() + 123456, distance: r.distance(), coins: r.coins() };
  r.delete();
  const res = await client.submit({ ticket, steps, tapeSteps: [], tapeCmds: [], ...claimed, localName: 'X' });
  assert.equal(res.verified, false);
  assert.equal(res.reason, 'SCORE_MISMATCH');
  assert.match(reasonText(res.reason), /re-simulated/);
});

test('display helpers', () => {
  assert.equal(challengeLabel('daily:2026-08-31:v1'), 'daily · Aug 31');
  assert.equal(challengeLabel('garbage'), 'garbage');
  assert.equal(timeRemaining(new Date(Date.now() + 2 * 3600_000 + 5 * 60_000).toISOString()).startsWith('2h'), true);
  assert.equal(timeRemaining(new Date(Date.now() - 1000).toISOString()), 'closed');
  assert.match(reasonText('AUTH_REQUIRED'), /Sign in/);
  assert.match(reasonText('totally-unknown'), /rejected/);
});

after(async () => {
  await new Promise((r) => server.close(r));
  await new Promise((r) => setImmediate(r));
  try { rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

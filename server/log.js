/**
 * Minimal structured logger — one JSON object per line, no dependencies.
 *
 * Never pass secrets or bulky client payloads through here. In particular:
 * access tokens, PI_API_KEY, wallet passphrases, and full input tapes must NOT
 * be logged. Callers pass small, already-safe field bags.
 */
'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const THRESHOLD = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

// Defensive redaction: drop obviously-sensitive keys if a caller slips up.
const REDACT = new Set([
  'accessToken', 'access_token', 'apiKey', 'api_key', 'PI_API_KEY',
  'passphrase', 'PI_WALLET_PASSPHRASE', 'secret', 'authorization', 'cookie',
  'tapeSteps', 'tapeCmds', 'tape',
]);

function safeFields(fields) {
  if (!fields || typeof fields !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.has(k)) { out[k] = '[redacted]'; continue; }
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function emit(level, event, fields) {
  if (LEVELS[level] < THRESHOLD) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    svc: 'pi-runner',
    event,
    ...safeFields(fields),
  });
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  debug: (event, fields) => emit('debug', event, fields),
  info: (event, fields) => emit('info', event, fields),
  warn: (event, fields) => emit('warn', event, fields),
  error: (event, fields) => emit('error', event, fields),
};

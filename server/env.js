/**
 * Minimal .env loader — no dependencies.
 *
 * Loads KEY=VALUE lines from ../.env into process.env, but ONLY for variables
 * that are not already set in the real environment (real env always wins).
 * Values are never logged. Missing .env is fine (local play needs none of it).
 */
'use strict';
const fs = require('fs');
const path = require('path');

try {
  const text = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  // No .env file — run with the real environment (local play needs nothing).
}

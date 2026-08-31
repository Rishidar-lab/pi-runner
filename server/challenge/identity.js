/**
 * Player identity binding for Node Challenge submissions.
 *
 * Two paths, never confused:
 *
 *   pi     — a verified Pi identity. Requires a Pi access token AND a server
 *            PI_API_KEY; the token is verified against the Pi Platform API.
 *            uid is the real Pi uid; username is the real Pi username.
 *
 *   local  — an unauthenticated local player on this SoloHost node. uid is
 *            ALWAYS prefixed "local:" and the display name is suffixed
 *            " (local)" so it can never be mistaken for a verified Pi user.
 *
 * The local path is allowed when this node has no Pi credentials at all (the
 * normal local-first SoloHost case) or when NODE_CHALLENGE_DEMO=1 is set for a
 * credentialled node that wants to demo without signing in. It is NOT a
 * verification bypass — every run is still re-simulated regardless of identity.
 */
'use strict';
const pi = require('../pi');

function localIdentityAllowed() {
  return !pi.hasApiKey() || process.env.NODE_CHALLENGE_DEMO === '1';
}

function sanitizeName(s) {
  return typeof s === 'string' ? s.replace(/[^\w.\- ]/g, '').trim().slice(0, 24) : '';
}

/**
 * @returns {Promise<{ ok:true, identity:object } | { ok:false, reason:string }>}
 */
async function resolve({ accessToken, localName }) {
  if (accessToken && typeof accessToken === 'string' && pi.hasApiKey()) {
    const user = await pi.verifyUser(accessToken).catch(() => null);
    if (!user || !user.uid) return { ok: false, reason: 'AUTH_INVALID' };
    return {
      ok: true,
      identity: {
        kind: 'pi',
        uid: String(user.uid),
        username: sanitizeName(user.username) || 'Pioneer',
        identityKey: `pi:${user.uid}`,
        verified: true,
      },
    };
  }

  if (!localIdentityAllowed()) {
    return { ok: false, reason: 'AUTH_REQUIRED' };
  }

  const name = sanitizeName(localName) || 'Player';
  // Stable per-name local key so the same local player keeps one leaderboard row.
  const key = name.toLowerCase().replace(/\s+/g, '-') || 'player';
  return {
    ok: true,
    identity: {
      kind: 'local',
      uid: `local:${key}`,
      username: `${name} (local)`,
      identityKey: `local:${key}`,
      verified: false,
    },
  };
}

module.exports = { resolve, localIdentityAllowed, sanitizeName };

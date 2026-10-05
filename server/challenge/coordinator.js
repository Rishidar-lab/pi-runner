/**
 * Challenge coordination — the seam between "this node verifies its own runs"
 * (today) and "a network of nodes shares one challenge and one leaderboard"
 * (future).
 *
 * These are INTERFACES with a working local implementation, not a fake network.
 * Nothing here talks to another machine. The point is that today's local code
 * does not calcify into something a federation layer can't slot behind.
 *
 *   ChallengeCoordinator      — where challenges and verified results live.
 *   LeaderboardProvider       — read model for rankings.
 *   NodeFederationAdapter     — (future) transport to pe/parent coordinators.
 *
 * Default wiring: LocalChallengeCoordinator, backed by the local JSON store.
 * A future PiNetworkChallengeCoordinator would implement the same surface and
 * push verified, node-signed results to a shared coordinator — the routes and
 * verification pipeline would not change.
 */
'use strict';
const store = require('../store');
const node = require('../node/identity');
const { currentChallenge, parseChallengeId, isCurrent } = require('./challenge');

/** @interface */
class ChallengeCoordinator {
  /** @returns {object} descriptor for the challenge currently open for play. */
  getCurrentChallenge(_now) { throw new Error('not implemented'); }
  /** @returns {object|null} descriptor for an arbitrary challenge id. */
  getChallenge(_id, _now) { throw new Error('not implemented'); }
  /** Persist a verified run result. @returns {object} the updated board. */
  publishVerifiedRun(_entry) { throw new Error('not implemented'); }
  /** Record that a run failed verification (metrics only). */
  recordRejectedRun(_info) { throw new Error('not implemented'); }
  /** @returns {object} leaderboard view for a challenge id. */
  getLeaderboard(_challengeId, _opts) { throw new Error('not implemented'); }
  /** @returns {'local'} identifier of the coordination backend in use. */
  get backend() { throw new Error('not implemented'); }
}

class LocalChallengeCoordinator extends ChallengeCoordinator {
  get backend() { return 'local'; }

  getCurrentChallenge(now = new Date()) {
    return currentChallenge(now);
  }

  getChallenge(id, now = new Date()) {
    if (isCurrent(id, now)) return { ...currentChallenge(now), isCurrent: true };
    const parsed = parseChallengeId(id, now);
    return parsed ? { ...parsed, isCurrent: false } : null;
  }

  publishVerifiedRun(entry) {
    const day = store.dayKey(new Date());
    const board = store.upsertChallengeEntry(entry.challengeId, day, entry);
    store.bumpCounter(day, 'verified');
    return board;
  }

  recordRejectedRun(_info) {
    store.bumpCounter(store.dayKey(new Date()), 'rejected');
  }

  getLeaderboard(challengeId, opts = {}) {
    const limit = Math.min(100, Math.max(1, parseInt(opts.limit, 10) || 20));
    const board = store.getChallengeLeaderboard(challengeId);
    const entries = board ? board.entries.slice() : [];
    entries.sort((a, b) => b.score - a.score || a.verifiedAt - b.verifiedAt);
    return {
      challengeId,
      scope: 'local-node',
      nodeIdShort: node.publicView().idShort,
      count: entries.length,
      entries: entries.slice(0, limit).map((e, i) => ({
        rank: i + 1,
        username: e.username,
        identityKind: e.identityKind,
        score: e.score,
        distance: e.distance,
        coins: e.coins,
        verified: true,
        nodeIdShort: e.nodeIdShort,
        verifiedAt: new Date(e.verifiedAt).toISOString(),
      })),
    };
  }

  /** Rank + best row for one identity within a challenge. */
  getIdentityStanding(challengeId, identityKey) {
    const board = store.getChallengeLeaderboard(challengeId);
    if (!board) return { challengeId, found: false };
    const sorted = board.entries.slice().sort((a, b) => b.score - a.score || a.verifiedAt - b.verifiedAt);
    const idx = sorted.findIndex((e) => e.identityKey === identityKey);
    if (idx < 0) return { challengeId, found: false, total: sorted.length };
    const e = sorted[idx];
    return {
      challengeId,
      found: true,
      rank: idx + 1,
      total: sorted.length,
      score: e.score,
      distance: e.distance,
      coins: e.coins,
      username: e.username,
      verifiedAt: new Date(e.verifiedAt).toISOString(),
    };
  }
}

/** @interface — reserved for a future read-through federated ranking source. */
class LeaderboardProvider {
  getLeaderboard(_challengeId, _opts) { throw new Error('not implemented'); }
}

/** @interface — reserved for a future node-to-coordinator transport. */
class NodeFederationAdapter {
  /** Announce this node to a coordinator. */
  register(_descriptor) { throw new Error('not implemented'); }
  /** Push a node-signed verified result upstream. */
  submitVerifiedRun(_signedEntry) { throw new Error('not implemented'); }
  /** Pull the shared challenge definition from upstream. */
  fetchChallenge(_now) { throw new Error('not implemented'); }
}

let singleton = null;
/** The coordinator this process uses. Local-only today. */
function getCoordinator() {
  if (!singleton) singleton = new LocalChallengeCoordinator();
  return singleton;
}

module.exports = {
  ChallengeCoordinator,
  LocalChallengeCoordinator,
  LeaderboardProvider,
  NodeFederationAdapter,
  getCoordinator,
};

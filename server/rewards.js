/**
 * Play-to-earn rewards engine.
 *
 * Anti-abuse is the whole point here:
 *   1. Every claim re-simulates the run with the deterministic core (leaderboard
 *      verifier) — a manipulated client score is rejected before any payout.
 *   2. A hard per-user DAILY CAP (real π) bounds total emissions.
 *   3. Idempotency: each run can be claimed once (keyed by seed+steps+score),
 *      and each rewarded-ad adId is honored once.
 *   4. Payout only happens through the app wallet (wallet.js); if the wallet is
 *      not configured the claim is recorded as "pending" so nothing is minted.
 *
 * Real π is paid ONLY via A2U through the wallet. Rewarded-ad perks are in-game
 * only (shield / double coins) and never mint π.
 */
'use strict';
const leaderboard = require('./leaderboard');
const store = require('./store');
const pi = require('./pi');
const wallet = require('./wallet');

const CFG = {
  enabled: () => process.env.REWARDS_ENABLED === '1',
  adsEnabled: () => process.env.PI_ADS_ENABLED === '1',
  piPerToken: Number(process.env.REWARD_PI_PER_TOKEN || 0.001),
  dailyCapPi: Number(process.env.REWARD_DAILY_CAP_PI || 0.25),
  minClaimPi: Number(process.env.REWARD_MIN_CLAIM_PI || 0.05),
};

function currentDay() { const d = new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`; }
function round6(n) { return Math.round(n * 1e6) / 1e6; }
function runSig(b) { return `${b.seed}:${b.steps}:${b.score}`; }

/** Rewarded-ad grant: verify the adId with Pi, honor once. Perks are in-game. */
async function grantAdReward(body) {
  if (!CFG.adsEnabled()) return { ok: false, reason: 'ads_disabled' };
  const { uid, adId, kind } = body || {};
  if (!uid || !adId || !['revive', 'double_coins'].includes(kind)) return { ok: false, reason: 'bad_request' };

  const day = currentDay();
  const ledger = store.getLedger(uid, day);
  if (ledger.ads[adId]) return { ok: true, kind, idempotent: true };

  const res = await pi.getAdNetworkStatus(adId);
  if (!res.ok || !pi.adGranted(res.data)) return { ok: false, reason: 'ad_not_granted' };

  ledger.ads[adId] = true;
  store.saveLedger(uid, ledger);
  return { ok: true, kind, granted: true };
}

/**
 * Claim real-π rewards for a finished run.
 * @returns {Promise<object>} result with { ok, paid, amountPi, remainingToday, ... }
 */
async function claim(body) {
  if (!CFG.enabled()) return { ok: false, reason: 'rewards_disabled' };
  const { uid } = body || {};
  if (!uid || typeof uid !== 'string') return { ok: false, reason: 'login_required' };

  // 1) anti-cheat: the run must re-simulate to the claimed score.
  const verified = await leaderboard.verify(body);
  if (!verified.ok) return { ok: false, reason: 'unverified_run', detail: verified.reason };

  const day = currentDay();
  const ledger = store.getLedger(uid, day);

  // 2) idempotency: one claim per run.
  const sig = runSig(body);
  if (ledger.runs[sig]) return { ok: false, reason: 'already_claimed' };

  // 3) compute capped earnings from the RE-SIMULATED score (not client coins,
  //    which are not verified) — this is what makes the payout cheat-proof.
  const earnBase = Math.max(0, Number(verified.serverScore) || 0);
  const gross = round6(earnBase * CFG.piPerToken);
  const remaining = round6(Math.max(0, CFG.dailyCapPi - ledger.claimedPi));
  const amount = round6(Math.min(gross, remaining));

  if (remaining <= 0) return { ok: false, reason: 'daily_cap_reached', remainingToday: 0 };
  if (amount < CFG.minClaimPi) {
    return { ok: false, reason: 'below_minimum', minClaimPi: CFG.minClaimPi, earnable: amount };
  }

  // Mark the run claimed up-front (prevents double-submit races) before payout.
  ledger.runs[sig] = true;
  store.saveLedger(uid, ledger);

  // 4) payout via the app wallet, or record as pending if no wallet.
  const memo = 'Pi Runner reward';
  const metadata = { type: 'p2e_reward', day, sig, score: earnBase };
  let payout = { ok: false, reason: 'wallet_not_configured' };
  if (wallet.configured()) {
    payout = await wallet.payout({ uid, amount, memo, metadata });
    if (!payout.ok) {
      // roll back the claim so the user can retry later
      delete ledger.runs[sig];
      store.saveLedger(uid, ledger);
      return { ok: false, reason: 'payout_failed', detail: payout.reason };
    }
  }

  ledger.claimedPi = round6(ledger.claimedPi + amount);
  ledger.payouts.push({ amount, ts: Date.now(), sig, txid: payout.txid || null, pending: !payout.ok });
  store.saveLedger(uid, ledger);

  return {
    ok: true,
    paid: Boolean(payout.ok),
    pending: !payout.ok, // recorded but not yet paid (no wallet configured)
    amountPi: amount,
    txid: payout.txid || null,
    claimedTodayPi: ledger.claimedPi,
    remainingTodayPi: round6(CFG.dailyCapPi - ledger.claimedPi),
  };
}

function status(uid) {
  const day = currentDay();
  const ledger = store.getLedger(uid, day);
  return {
    enabled: CFG.enabled(),
    walletConfigured: wallet.configured(),
    dailyCapPi: CFG.dailyCapPi,
    minClaimPi: CFG.minClaimPi,
    piPerToken: CFG.piPerToken,
    claimedTodayPi: ledger.claimedPi,
    remainingTodayPi: round6(Math.max(0, CFG.dailyCapPi - ledger.claimedPi)),
  };
}

module.exports = { claim, grantAdReward, status, CFG, currentDay, runSig, round6 };

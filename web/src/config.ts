/**
 * Global configuration + feature flags.
 *
 * Pi integration is intentionally gated so the game ships and plays with zero
 * Pi setup, and payments stay OFF until the full server-verified flow is proven
 * in the Pi sandbox. Flip flags here (or via build-time env inlining) only when
 * the corresponding backend pieces are ready.
 */
export const FLAGS = {
  /** Attempt Pi SDK auth when running inside the Pi Browser. Safe: it degrades
   *  gracefully to "open in Pi Browser" everywhere else. */
  PI_AUTH_ENABLED: true,
  /** Pi payments for cosmetics. Keep FALSE until auth + server approve/complete
   *  + cancel + error handling are verified in the Pi sandbox. Never pay-to-win. */
  PI_PAYMENTS_ENABLED: false,
  /** Use the Pi sandbox network during development. Set false only after the app
   *  is approved for Mainnet payments in the Developer Portal. */
  PI_SANDBOX: true,
  /** Submit runs to the backend leaderboard (server re-simulates to validate). */
  LEADERBOARD_ENABLED: true,
  /** Pi Ad Network rewarded ads ("watch ad to revive / double coins").
   *  Requires Pi Core Team monetization approval. Rewards are granted only after
   *  server-side adId verification. Keep FALSE until approved + tested. */
  PI_ADS_ENABLED: false,
  /** Play-to-earn: real π rewards paid to users via App-to-User (A2U) payments.
   *  Requires Pi approval + a funded app wallet on the server. Every claim is
   *  gated by server re-simulation (anti-cheat) + a daily cap. Keep FALSE until
   *  the wallet + approval are in place. */
  REWARDS_ENABLED: false,
} as const;

/**
 * Play-to-earn economics (tunable). These are the *maximums* the server will
 * ever honor; the backend re-simulates each run and enforces the daily cap, so
 * a manipulated client can never mint more than this.
 */
export const REWARDS = {
  /** Real Pi earned per point of the server-verified run score (cheat-proof:
   *  the backend re-simulates the run, so only legitimately-earned score pays). */
  piPerToken: 0.001,
  /** Hard per-user daily payout cap (real Pi). */
  dailyCapPi: 0.25,
  /** Minimum balance before a user can claim (reduces dust payouts). */
  minClaimPi: 0.05,
  /** Rewarded-ad perks (soft, in-game only — never real Pi). */
  ad: { reviveShield: true, doubleCoins: true },
} as const;

/** The single optional cosmetic sold for Pi. Cosmetic + a starting shield only. */
export const GOLD_UNLOCK = {
  id: 'gold_shield_unlock_v1',
  amount: 1, // π
  memo: 'Unlock Gold Orb + Shield in Pi Runner',
  price: '1 π',
} as const;

export const LANE_COUNT = 3;

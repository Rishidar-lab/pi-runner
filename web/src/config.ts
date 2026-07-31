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
} as const;

/** The single optional cosmetic sold for Pi. Cosmetic + a starting shield only. */
export const GOLD_UNLOCK = {
  id: 'gold_shield_unlock_v1',
  amount: 1, // π
  memo: 'Unlock Gold Orb + Shield in Pi Runner',
  price: '1 π',
} as const;

export const LANE_COUNT = 3;

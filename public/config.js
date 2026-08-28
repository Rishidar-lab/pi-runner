export const FLAGS = {
    PI_AUTH_ENABLED: true,
    PI_PAYMENTS_ENABLED: false,
    PI_SANDBOX: true,
    LEADERBOARD_ENABLED: true,
    PI_ADS_ENABLED: false,
    REWARDS_ENABLED: false
};
export const REWARDS = {
    piPerToken: 0.001,
    dailyCapPi: 0.25,
    minClaimPi: 0.05,
    ad: {
        reviveShield: true,
        doubleCoins: true
    }
};
export const GOLD_UNLOCK = {
    id: 'gold_shield_unlock_v1',
    amount: 1,
    memo: 'Unlock Gold Orb + Shield in Pi Runner',
    price: '1 π'
};
export const LANE_COUNT = 3;

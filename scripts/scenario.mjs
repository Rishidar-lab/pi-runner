#!/usr/bin/env node
/**
 * Kurinji Run — scenario model (NOT a forecast).
 *
 * Every input is an explicit, labelled assumption. Outputs are scenarios.
 * Reproducible: fixed seed, deterministic PRNG (mulberry32).
 *
 * Usage: node scripts/scenario.mjs [--days=90] [--json]
 */
'use strict';

// ---- labelled assumptions (override via argv or edit) --------------------
const ASSUMPTIONS = {
  days: 90,
  sessionsPerDay: [50, 500],          // min–max uniform (weak adoption scenario)
  decayPerWeek: 0.02,                  // weak-retention stress: -2% sessions/week
  adApproval: false,                   // Pi Core Team monetisation approval
  adRevenuePer1kSessionsPi: 1,         // scenario only — no official rate card
  cosmeticConversionPct: 0.5,          // scenario only
  cosmeticPricePi: 1,
  payoutsPer1kSessionsPi: 0.5,         // A2U cost if ever enabled (disabled by default)
  hostingCostPerMonthInr: 0,            // local hosting
  nodeRunning: false,
  nodeElectricityPerMonthInr: 303,     // 60 W @ ₹7/kWh labelled assumption
  tariffInrPerKwh: 7,
};

// ---- deterministic PRNG ---------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runScenario(label, overrides = {}) {
  const A = { ...ASSUMPTIONS, ...overrides };
  const rand = mulberry32(20260927);
  let sessions = 0, adRevenue = 0, cosmeticRevenue = 0, payouts = 0;
  for (let d = 0; d < A.days; d++) {
    const weekDecay = Math.pow(1 - A.decayPerWeek, d / 7);
    const today = Math.round((A.sessionsPerDay[0] + rand() * (A.sessionsPerDay[1] - A.sessionsPerDay[0])) * weekDecay);
    sessions += today;
    if (A.adApproval) adRevenue += (today / 1000) * A.adRevenuePer1kSessionsPi;
    cosmeticRevenue += today * (A.cosmeticConversionPct / 100) * A.cosmeticPricePi;
    payouts += (today / 1000) * A.payoutsPer1kSessionsPi;
  }
  const months = A.days / 30;
  const hosting = A.hostingCostPerMonthInr * months;
  const electricity = A.nodeRunning ? A.nodeElectricityPerMonthInr * months : 0;
  const costInr = hosting + electricity;
  // Only on-chain revenue counts; ad revenue is scenario-only until approval.
  const onChainPi = cosmeticRevenue - payouts;
  return { label, days: A.days, sessions, adRevenuePi: +adRevenue.toFixed(2), cosmeticRevenuePi: +cosmeticRevenue.toFixed(2), payoutsPi: +payouts.toFixed(2), onChainNetPi: +onChainPi.toFixed(2), costInr: +costInr.toFixed(2), note: A.adApproval ? 'ad-approval scenario' : 'no-ad-approval scenario' };
}

const scenarios = [
  runScenario('base (no ad approval, weak decay)'),
  runScenario('ad approval ON', { adApproval: true }),
  runScenario('zero revenue (all monetisation off)', { adApproval: false, cosmeticConversionPct: 0 }),
  runScenario('weak retention + low conversion', { cosmeticConversionPct: 0.1, decayPerWeek: 0.05 }),
  runScenario('node running (cost only)', { nodeRunning: true }),
  runScenario('ad 10x + conversion 10x (sensitivity)', { adApproval: true, adRevenuePer1kSessionsPi: 10, cosmeticConversionPct: 5 }),
];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ generated: new Date().toISOString(), disclaimer: 'SCENARIOS — not forecasts. Assumptions are labelled in docs/ECONOMICS.md §2.', assumptions: ASSUMPTIONS, scenarios }, null, 2));
} else {
  console.log('Kurinji Run — scenario model (SCENARIOS, not forecasts)');
  console.log('Generated:', new Date().toISOString());
  console.log('Assumptions:', JSON.stringify(ASSUMPTIONS));
  for (const s of scenarios) console.log(JSON.stringify(s));
}

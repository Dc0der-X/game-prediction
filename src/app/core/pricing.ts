/**
 * Plans and pricing. Keep these numbers in sync with the Cloud Functions
 * params PRICE_MONTH_USD / PRICE_YEAR_USD and your PayPal billing plan.
 */
export const PRICING = {
  trialDays: 7,
  monthlyUsd: 12,
  yearlyUsd: 99,
};

export const FREE_FEATURES = [
  'All 5 practice tables with play money',
  'Unlimited practice – no timer, no limits',
  'The Table Rules for every game',
];

export const PRO_FEATURES = [
  'Session Coach for real-money play: bankroll plan, timer, stop-win & stop-loss',
  'Session history with honest profit/loss tracking',
  'Strategy Lab – test any system on 9,000 simulated sessions',
  'Daily lock and self-exclusion controls',
];

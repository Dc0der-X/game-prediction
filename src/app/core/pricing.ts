/**
 * Plans and pricing. Keep these numbers in sync with PRICE_DAY_USD /
 * PRICE_MONTH_USD / PRICE_YEAR_USD in payments-worker/wrangler.toml.
 */
export type PlanId = 'day' | 'month' | 'year';

export interface Plan {
  id: PlanId;
  name: string;
  usd: number;
  days: number;
  per: string;
  /** Short line under the price. */
  blurb: string;
  badge?: string;
}

export const PLANS: Plan[] = [
  { id: 'day', name: 'Day Pass', usd: 20, days: 1, per: 'day', blurb: '24 hours of full access. Perfect for one casino night.' },
  { id: 'month', name: 'Monthly', usd: 140, days: 30, per: 'month', blurb: '30 days of signals for every session.', badge: 'Recommended' },
  { id: 'year', name: 'Yearly', usd: 999, days: 365, per: 'year', blurb: 'A full year. The lowest price per day.', badge: 'Best value' },
];

export const PRICING = {
  /** Free access after sign-up, in hours. */
  trialHours: 3,
  dayUsd: 20,
  monthlyUsd: 140,
  yearlyUsd: 999,
};

/** Price per day, for comparing plans. */
export const perDay = (p: Plan) => Math.round((p.usd / p.days) * 100) / 100;

/** Saving compared with buying Day Passes, in %. */
export const savingVsDay = (p: Plan) => Math.round((1 - perDay(p) / PRICING.dayUsd) * 100);

export const FREE_FEATURES = [
  'All 5 practice tables with play money',
  'Practice signals – see how the coach works',
  'Unlimited practice – no timer',
];

export const PRO_FEATURES = [
  'Live signals: the side and the amount for every bet',
  'Your session plan from the amount you bring',
  'Target and loss alerts, check-ins and the STOP sign',
  'Session history and your winnings wall',
  'Strategy Lab and every table',
];

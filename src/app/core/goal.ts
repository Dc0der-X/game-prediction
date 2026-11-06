/**
 * Compounding goal planner.
 *
 * One session a day, and each session's profit target is a share of the amount played
 * (SESSION_LIMITS.targetShare). If every session plays the whole current balance and hits
 * its target, the balance compounds: start × (1 + share)^n. The tracker always uses the
 * player's real session results, so it shows where they truly are.
 */
import { SESSION_LIMITS } from './strategies';

export interface Goal {
  /** Amount at the start of the plan. */
  start: number;
  /** Amount the player wants to reach. */
  target: number;
  /** When the goal was set (ms) – sessions from then on count towards it. */
  setAt: number;
}

export interface GoalStep {
  n: number;
  from: number;
  gain: number;
  to: number;
}

export const goalShare = () => SESSION_LIMITS.targetShare;

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Sessions needed to grow `start` into `target` at the session target. */
export function sessionsNeeded(start: number, target: number, share = goalShare()): number {
  if (!(start > 0) || !(target > start)) return 0;
  return Math.ceil(Math.log(target / start) / Math.log(1 + share) - 1e-9);
}

/** Every compounding step from `start` until `target` is reached (capped for display). */
export function goalSteps(start: number, target: number, share = goalShare(), max = 400): GoalStep[] {
  const steps: GoalStep[] = [];
  let from = start;
  for (let n = 1; n <= max && from < target; n++) {
    const gain = r2(from * share);
    const to = r2(Math.min(from + gain, Math.max(target, from + gain)));
    steps.push({ n, from: r2(from), gain, to });
    from = to;
  }
  return steps;
}

/** Planned balance after `n` sessions. */
export function plannedAfter(start: number, n: number, share = goalShare()): number {
  return r2(start * Math.pow(1 + share, n));
}

export interface GoalProgress {
  /** Start + the real results of every session since the goal was set. */
  balance: number;
  /** Sessions played towards the goal. */
  played: number;
  /** Sessions that ended up. */
  wins: number;
  /** 0–100 share of the way from start to target. */
  pct: number;
  /** Sessions still needed from today's balance. */
  left: number;
  /** Today's suggested amount and its target. */
  nextAmount: number;
  nextGain: number;
  /** The plan's balance for the same number of sessions. */
  planned: number;
  reached: boolean;
}

export function goalProgress(goal: Goal, sessions: { net: number; startedAt: number }[]): GoalProgress {
  const mine = sessions.filter((s) => s.startedAt >= goal.setAt).sort((a, b) => a.startedAt - b.startedAt);
  const balance = r2(Math.max(0, goal.start + mine.reduce((a, s) => a + s.net, 0)));
  const reached = balance >= goal.target;
  const span = goal.target - goal.start;
  const pct = span > 0 ? Math.max(0, Math.min(100, Math.round(((balance - goal.start) / span) * 100))) : 100;
  const nextAmount = r2(Math.max(balance, 0));
  return {
    balance,
    played: mine.length,
    wins: mine.filter((s) => s.net > 0).length,
    pct,
    left: reached ? 0 : sessionsNeeded(Math.max(balance, 1), goal.target),
    nextAmount,
    nextGain: r2(nextAmount * goalShare()),
    planned: plannedAfter(goal.start, mine.length),
    reached,
  };
}

/** Checks a goal entered by the player. Returns an error message or ''. */
export function goalError(start: number | null, target: number | null): string {
  if (!start || start < 50) return 'Start with 50 or more.';
  if (!target || target <= start) return 'Your goal should be bigger than your starting amount.';
  if (target > start * 1000) return 'Pick a goal up to 1,000× your starting amount.';
  return '';
}

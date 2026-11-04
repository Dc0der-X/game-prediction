/**
 * Staking strategies and the Table Rules.
 *
 * A staking strategy only decides HOW MUCH to bet next. None of them change
 * the house edge – they only change how wins and losses are spread out.
 * The Strategy Lab lets players prove this to themselves with play money.
 */
import { GameDef, getBet } from './games';

export type StrategyId = 'flat' | 'ladder' | 'martingale' | 'fibonacci' | 'dalembert' | 'paroli';

export interface StrategyInfo {
  id: StrategyId;
  name: string;
  summary: string;
  realMoney: boolean; // allowed by the Table Rules for real-money sessions
}

export const STRATEGIES: StrategyInfo[] = [
  {
    id: 'flat',
    name: 'Flat (Table Rules)',
    summary: 'Same stake every round. Smallest expected loss and the mildest bad days.',
    realMoney: true,
  },
  {
    id: 'ladder',
    name: 'Recovery Ladder (old app rule)',
    summary: 'Steps 4-6-10-16-26-40-60 after each loss, back to 4 after a win. Many small wins, rare big losses.',
    realMoney: false,
  },
  {
    id: 'martingale',
    name: 'Martingale',
    summary: 'Double after every loss. Wins most sessions, but one bad streak wipes out weeks.',
    realMoney: false,
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    summary: 'Move one step up the 1-1-2-3-5-8… sequence after a loss, two steps back after a win.',
    realMoney: false,
  },
  {
    id: 'dalembert',
    name: "D'Alembert",
    summary: 'Add one unit after a loss, remove one after a win.',
    realMoney: false,
  },
  {
    id: 'paroli',
    name: 'Paroli',
    summary: 'Double after a win (up to 3 in a row), reset after a loss.',
    realMoney: false,
  },
];

const LADDER = [4, 6, 10, 16, 26, 40, 60];
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

/** Tracks the next stake for a strategy. */
export class StakeTracker {
  private step = 0;
  private current: number;
  constructor(public strategy: StrategyId, public unit: number) {
    this.current = unit;
  }

  next(): number {
    switch (this.strategy) {
      case 'flat':
        return this.unit;
      case 'ladder':
        return round2((LADDER[Math.min(this.step, LADDER.length - 1)] / 4) * this.unit);
      case 'fibonacci':
        return this.unit * FIB[Math.min(this.step, FIB.length - 1)];
      case 'dalembert':
        return this.unit * (this.step + 1);
      case 'paroli':
        return this.unit * Math.pow(2, this.step);
      case 'martingale':
        return this.current;
    }
  }

  /** net = profit/loss of the round in money (0 means push). */
  record(net: number) {
    if (net === 0) return;
    const won = net > 0;
    switch (this.strategy) {
      case 'ladder':
        this.step = won ? 0 : this.step + 1;
        break;
      case 'fibonacci':
        this.step = won ? Math.max(0, this.step - 2) : this.step + 1;
        break;
      case 'dalembert':
        this.step = won ? Math.max(0, this.step - 1) : this.step + 1;
        break;
      case 'paroli':
        this.step = won && this.step < 2 ? this.step + 1 : 0;
        break;
      case 'martingale':
        this.current = won ? this.unit : this.current * 2;
        break;
    }
  }

  reset() {
    this.step = 0;
    this.current = this.unit;
  }
}

/* ------------------------------------------------------------------ */
/* The Table Rules – one discipline for every game                     */
/* ------------------------------------------------------------------ */

export const TABLE_RULES = [
  { title: 'Bring a budget, not a target', text: 'Only play with money you are fine losing today. That amount is your bankroll.' },
  { title: 'Only the best bet', text: 'Each game has one bet with the lowest house edge. Play that bet and nothing else.' },
  { title: 'Small, flat stakes', text: 'The coach sizes your stake from your budget. It never goes up after a loss.' },
  { title: 'Hard stops', text: 'The coach sets a profit target, a loss limit and a timer. Whichever comes first, you stop.' },
  { title: 'One real session a day', text: 'After a real-money session the coach locks until tomorrow. Practice stays open.' },
];

export const SESSION_LIMITS = {
  unitPct: 0.02,
  stopWinUnits: 5, // +10% of bankroll
  stopLossUnits: 10, // -20% of bankroll
  minMinutes: 10,
  maxMinutes: 20,
  defaultMinutes: 15,
};

export interface SessionPlan {
  gameId: string;
  betId: string;
  betLabel: string;
  edge: number;
  bankroll: number;
  unit: number;
  stopWin: number;
  stopLoss: number;
  minutes: number;
  maxRounds: number;
  expectedLoss: number;
}

export function planSession(game: GameDef, bankroll: number, minutes: number): SessionPlan {
  const m = clamp(minutes, SESSION_LIMITS.minMinutes, SESSION_LIMITS.maxMinutes);
  const unit = Math.max(1, Math.floor(bankroll * SESSION_LIMITS.unitPct));
  const bet = getBet(game, game.bestBet)!;
  const maxRounds = Math.max(5, Math.round((game.roundsPerHour * m) / 60));
  return {
    gameId: game.id,
    betId: bet.id,
    betLabel: bet.label,
    edge: bet.edge,
    bankroll,
    unit,
    stopWin: unit * SESSION_LIMITS.stopWinUnits,
    stopLoss: unit * SESSION_LIMITS.stopLossUnits,
    minutes: m,
    maxRounds,
    expectedLoss: round2(maxRounds * unit * bet.edge),
  };
}

/* ------------------------------------------------------------------ */
/* Monte-Carlo simulator used by the Strategy Lab                      */
/* ------------------------------------------------------------------ */

export interface SimConfig {
  game: GameDef;
  betId: string;
  strategy: StrategyId;
  bankroll: number;
  unit: number;
  stopWin: number; // 0 = none
  stopLoss: number; // 0 = none (bankroll is still the hard floor)
  rounds: number;
  sessions: number;
}

export interface SimResult {
  sessions: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgNet: number;
  worstTenth: number;
  worst: number;
  bustRate: number;
  /** Average amount staked per session. */
  avgWagered: number;
  /** The true long-run cost per session: average stake volume x house edge. Noise-free. */
  expectedCost: number;
  monthAheadRate: number;
  monthAvg: number;
  histogram: { from: number; to: number; count: number }[];
}

export function simulate(cfg: SimConfig): SimResult {
  const nets: number[] = [];
  const tracker = new StakeTracker(cfg.strategy, cfg.unit);
  let busts = 0;
  let wagered = 0;
  const edge = getBet(cfg.game, cfg.betId)?.edge ?? 0;
  for (let s = 0; s < cfg.sessions; s++) {
    tracker.reset();
    let bank = cfg.bankroll;
    for (let r = 0; r < cfg.rounds; r++) {
      const stake = Math.min(tracker.next(), bank);
      if (stake <= 0) break;
      wagered += stake;
      const o = cfg.game.play();
      const net = stake * cfg.game.settle(cfg.betId, o);
      bank += net;
      tracker.record(net);
      const p = bank - cfg.bankroll;
      if (cfg.stopWin && p >= cfg.stopWin) break;
      if (cfg.stopLoss && p <= -cfg.stopLoss) break;
      if (bank <= 0) break;
    }
    if (bank <= 0) busts++;
    nets.push(round2(bank - cfg.bankroll));
  }

  const wins = nets.filter((x) => x > 0);
  const losses = nets.filter((x) => x < 0);
  const sorted = [...nets].sort((a, b) => a - b);

  // Group sessions into 30-day "months" to show the long-run picture.
  const months: number[] = [];
  for (let i = 0; i + 30 <= nets.length; i += 30) {
    months.push(nets.slice(i, i + 30).reduce((a, b) => a + b, 0));
  }

  return {
    sessions: nets.length,
    winRate: wins.length / nets.length,
    avgWin: wins.length ? avg(wins) : 0,
    avgLoss: losses.length ? avg(losses) : 0,
    avgNet: avg(nets),
    worstTenth: sorted[Math.floor(sorted.length / 10)],
    worst: sorted[0],
    bustRate: busts / nets.length,
    avgWagered: wagered / nets.length,
    expectedCost: (wagered / nets.length) * edge,
    monthAheadRate: months.length ? months.filter((m) => m > 0).length / months.length : 0,
    monthAvg: months.length ? avg(months) : 0,
    histogram: histogram(nets, 12),
  };
}

function histogram(xs: number[], bins: number) {
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const width = (max - min) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const x of xs) out[Math.min(bins - 1, Math.floor((x - min) / width))].count++;
  return out;
}

export const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
export const round2 = (x: number) => Math.round(x * 100) / 100;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

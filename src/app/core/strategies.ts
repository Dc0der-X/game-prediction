/**
 * Staking strategies and the Table Rules.
 *
 * A staking strategy only decides HOW MUCH to bet next. None of them change
 * the house edge – they only change how wins and losses are spread out.
 * The Strategy Lab lets players prove this to themselves with play money.
 */
import { GameDef, Outcome, getBet, sideOf } from './games';

export type StrategyId = 'flat' | 'original' | 'ladder' | 'martingale' | 'fibonacci' | 'dalembert' | 'paroli';

export interface StrategyInfo {
  id: StrategyId;
  name: string;
  summary: string;
  realMoney: boolean; // allowed by the Table Rules for real-money sessions
}

export const STRATEGIES: StrategyInfo[] = [
  {
    id: 'flat',
    name: 'Flat',
    summary: 'Same stake every round, one side. The lowest-cost option and the mildest bad days.',
    realMoney: true,
  },
  {
    id: 'original',
    name: 'Neural Signals (TableWise system)',
    summary: 'Our signal system: reads the last results at your table and sets the side and the amount for every bet. In real play every bet is capped at your safety limit.',
    realMoney: true,
  },
  {
    id: 'ladder',
    name: 'Recovery Ladder',
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

/** Anything that decides the next stake (and, optionally, which side to bet). */
export interface Staker {
  next(): number;
  /** Which bet to place next; most systems always use the default bet. */
  bet(defaultBet: string): string;
  record(net: number, outcome?: Outcome): void;
  reset(): void;
}

export function makeStaker(strategy: StrategyId, unit: number, game: GameDef): Staker {
  return strategy === 'original' ? new OriginalSystem(unit, game) : new StakeTracker(strategy, unit);
}

/** Tracks the next stake for a strategy. */
export class StakeTracker implements Staker {
  private step = 0;
  private current: number;
  constructor(public strategy: StrategyId, public unit: number) {
    this.current = unit;
  }

  bet(defaultBet: string): string {
    return defaultBet;
  }

  next(): number {
    switch (this.strategy) {
      case 'flat':
      case 'original':
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
  record(net: number, _outcome?: Outcome) {
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

/**
 * The previous app's rule, ported line-for-line from its prediction pages.
 *
 * Side ("S" = same as last result, "O" = opposite):
 *   win  → keep the pattern that just won (S stays on the result, O flips again)
 *   loss → 1st loss: follow the last result (S); 2nd loss: bet the opposite (O); then repeat
 * Stake (in tokens of unit/4):
 *   ATTACK   4-2-3-4-5-6-8-10, one step up per win; any loss → RETRENCH
 *   RETRENCH 4-6-10-16-26-40-60, one step up per loss, one step down per win
 *            (two steps after two wins in a row), back to ATTACK from the bottom;
 *            resets to the first step when the running total is −150 tokens or worse.
 * Zero / tie results are skipped, as in the old app.
 */
export class OriginalSystem implements Staker {
  private static ATTACK = [4, 2, 3, 4, 5, 6, 8, 10];
  private static RETRENCH = [4, 6, 10, 16, 26, 40, 60];

  private sides: [string, string] | null;
  private nextSide = 0; // index into sides
  private lastPattern: 'S' | 'O' = 'S';
  private looseCount = 0;
  private mode: 'ATTACK' | 'RETRENCH' = 'ATTACK';
  private idx = 0;
  private token = 4;
  private acc = 0;
  private prevCorrect = false;
  private consecutiveCorrects = true;

  constructor(private unit: number, private game: GameDef) {
    this.sides = game.sides ?? null;
  }

  reset() {
    this.nextSide = 0;
    this.lastPattern = 'S';
    this.looseCount = 0;
    this.mode = 'ATTACK';
    this.idx = 0;
    this.token = 4;
    this.acc = 0;
    this.prevCorrect = false;
    this.consecutiveCorrects = true;
  }

  /** Start fresh from the last result seen at the table: the first bet follows it (S pattern). */
  seed(sideId: string | null) {
    this.reset();
    if (this.sides && sideId) {
      const i = this.sides.indexOf(sideId);
      if (i >= 0) this.nextSide = i;
    }
  }

  /** Current mode, for display. */
  get state() {
    return { mode: this.mode, token: this.token, pattern: this.lastPattern };
  }

  next(): number {
    return round2((this.token / 4) * this.unit);
  }

  bet(defaultBet: string): string {
    return this.sides ? this.sides[this.nextSide] : defaultBet;
  }

  record(_net: number, outcome?: Outcome) {
    if (!this.sides || !outcome) return;
    const s = sideOf(this.game, outcome);
    this.recordResult(s === null ? null : this.sides.indexOf(s) === this.nextSide);
  }

  /** true = the signalled side won, false = the other side won, null = zero / tie (skipped). */
  recordResult(correct: boolean | null) {
    if (!this.sides || correct === null) return;
    const happened = correct ? this.nextSide : 1 - this.nextSide;
    const opposite = 1 - happened;

    // --- which side next ---
    if (correct) {
      this.looseCount = 0;
      if (this.lastPattern === 'S') {
        this.nextSide = happened;
        this.lastPattern = 'S';
      } else {
        this.nextSide = opposite;
        this.lastPattern = 'O';
      }
    } else {
      this.looseCount++;
      if (this.looseCount < 2) {
        this.lastPattern = 'S';
        this.nextSide = happened;
      } else if (this.looseCount === 2) {
        this.lastPattern = 'O';
        this.nextSide = opposite;
      } else {
        this.lastPattern = 'S';
        this.looseCount = 1;
        this.nextSide = happened;
      }
    }

    // --- how much next ---
    const A = OriginalSystem.ATTACK;
    const R = OriginalSystem.RETRENCH;
    if (correct) {
      this.acc += this.token;
      if (this.mode === 'RETRENCH') {
        if (this.idx === 0) {
          this.mode = 'ATTACK';
          this.idx = 0;
          this.token = A[0];
        } else if (this.prevCorrect && this.consecutiveCorrects) {
          this.consecutiveCorrects = false;
          if (this.idx > 1) {
            this.idx -= 2;
            this.token = R[this.idx];
          } else {
            this.mode = 'ATTACK';
            this.idx = 0;
            this.token = A[0];
          }
        } else {
          this.consecutiveCorrects = true;
          if (this.idx > 0) this.idx--;
          this.token = R[this.idx];
        }
      } else {
        if (this.idx < 7) this.idx++;
        this.token = A[this.idx];
      }
    } else {
      this.acc -= this.token;
      if (this.mode === 'ATTACK') {
        this.mode = 'RETRENCH';
        this.idx = 0;
        this.token = R[0];
      } else {
        if (this.acc <= -150 && this.idx > 5) this.idx = -1;
        if (this.idx < 6) this.idx++;
        this.token = R[this.idx];
      }
    }
    this.prevCorrect = correct;
  }
}

/* ------------------------------------------------------------------ */
/* The Table Rules – one discipline for every game                     */
/* ------------------------------------------------------------------ */

export const TABLE_RULES = [
  { title: 'Enter your amount', text: "Tell the coach how much you brought today. It sets your bet size, your profit target and your maximum loss from that." },
  { title: 'Tell it what came', text: 'Tap the last result at your table. The coach shows exactly where to bet next and how much.' },
  { title: 'Take the profit', text: 'Hit your profit target and you stop. Once you are up, 2 losses in a row also means stop – you leave with profit.' },
  { title: '3 losses? Change table', text: 'Three losses in a row and you stop at that table. Move to a new table and start fresh, or end the session.' },
  { title: 'Never past your limit', text: 'No bet can take you past your maximum loss. A STOP check-in comes every 5 minutes, and one real session a day.' },
]

export const SESSION_LIMITS = {
  /** A STOP check-in appears every this many minutes during a session. */
  checkinMinutes: 5,
  /** After a big profit (this share of the target or more), 2 losses in a row ends the session. */
  profitLockAt: 0.6,
  profitLockLosses: 2,
  /** This many losses in a row: stop and change table. */
  changeTableLosses: 3,
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
  // Generous round cap: the timer and the stop rules end sessions, not a tiny round count.
  const maxRounds = Math.max(20, Math.round(((game.roundsPerHour * m) / 60) * 2));
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
  const tracker = makeStaker(cfg.strategy, cfg.unit, cfg.game);
  let busts = 0;
  let wagered = 0;
  const edge = getBet(cfg.game, cfg.betId)?.edge ?? 0;
  for (let s = 0; s < cfg.sessions; s++) {
    tracker.reset();
    let bank = cfg.bankroll;
    for (let r = 0; r < cfg.rounds; r++) {
      const room = cfg.stopLoss ? cfg.stopLoss + (bank - cfg.bankroll) : Infinity;
      const stake = round2(Math.min(tracker.next(), bank, room));
      if (stake <= 0) break;
      wagered += stake;
      const betId = tracker.bet(cfg.betId);
      const o = cfg.game.play();
      const net = stake * cfg.game.settle(betId, o);
      bank += net;
      tracker.record(net, o);
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

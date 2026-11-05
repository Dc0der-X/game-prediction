/**
 * Staking strategies and the Table Rules.
 *
 * A staking strategy only decides HOW MUCH to bet next. None of them change
 * the house edge – they only change how wins and losses are spread out.
 * The Strategy Lab lets players prove this to themselves with play money.
 */
import { GameDef, Outcome, getBet, sideOf } from './games';

export type StrategyId = 'neural' | 'flat' | 'original' | 'ladder' | 'martingale' | 'fibonacci' | 'dalembert' | 'paroli';

export interface StrategyInfo {
  id: StrategyId;
  name: string;
  summary: string;
  realMoney: boolean; // allowed by the Table Rules for real-money sessions
}

export const STRATEGIES: StrategyInfo[] = [
  {
    id: 'neural',
    name: 'Neural Signals',
    summary: 'Our signal system: reads the last results at your table and sets the side and the amount for every bet.',
    realMoney: true,
  },
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
  /** True while the system is watching results before it places a bet. */
  readonly watching?: boolean;
  /** Feed a result seen while watching (side id, or null for zero/tie). */
  observe?(sideId: string | null): void;
  next(): number;
  /** Which bet to place next; most systems always use the default bet. */
  bet(defaultBet: string): string;
  record(net: number, outcome?: Outcome): void;
  reset(): void;
}

export function makeStaker(strategy: StrategyId, unit: number, game: GameDef): Staker {
  if (strategy === 'neural' && game.sides) return new NeuralSystem(unit, game);
  if (strategy === 'original') return new OriginalSystem(unit, game);
  return new StakeTracker(strategy === 'neural' ? 'flat' : strategy, unit);
}

/* ------------------------------------------------------------------ */
/* The Neural Strategy (from the book of the same name)                */
/* ------------------------------------------------------------------ */

/** Betting series as multiples of the base bet: 5 8 13 20 35 50 75 100 for a 5 base. */
export const NEURAL_SERIES = [1, 1.6, 2.6, 4, 7, 10, 15, 20];
/** Session bankroll = the sum of the series (306 for a 5 base, rounded to 300 in the book). */
export const NEURAL_BANKROLL_UNITS = NEURAL_SERIES.reduce((a, b) => a + b, 0);

/** Bet size for a level, rounded like casino chips (whole numbers from a base of 2 up). */
export function neuralStake(base: number, level: number): number {
  const raw = base * NEURAL_SERIES[Math.max(0, Math.min(7, level))];
  return base >= 2 ? Math.round(raw) : Math.round(raw * 2) / 2;
}

/**
 * The Neural Strategy:
 *  1. Watch two results. Same twice → bet it to repeat. Different → bet the
 *     alternation; after an alternating bet loses, bet only the opposite of
 *     the losing bet (the side that is dominating).
 *  2. Start at level 1. Loss → up one level. Win → down one level; two wins in
 *     a row, or two of the last three, → down two levels.
 *  3. Losing the level-5 bet → switch to the other side and bet level 6.
 *     After a switch: a win drops two levels, the next consecutive win one
 *     level, then two, and so on; a loss raises one level. After three wins
 *     the normal rules apply again. Switch again on a level-5 loss once you
 *     have won three times or made five bets since the last switch.
 *  Ties (Baccarat) change nothing. Zero and other house results count as a loss.
 */
export class NeuralSystem implements Staker {
  private sides: [string, string];
  private seen: number[] = [];
  private mode: 'observe' | 'repeat' | 'alternate' = 'observe';
  private side = 0;
  level = 0;
  private recent: boolean[] = [];
  switched = false;
  private winsSinceSwitch = 0;
  private betsSinceSwitch = 0;
  private switchWinStreak = 0;
  switches = 0;

  constructor(private base: number, private game: GameDef) {
    this.sides = game.sides!;
  }

  get watching(): boolean {
    return this.mode === 'observe';
  }

  /** How many results have been watched so far (0–2). */
  get watched(): number {
    return this.seen.length;
  }

  get pattern(): 'watching' | 'repeating' | 'alternating' {
    return this.mode === 'observe' ? 'watching' : this.mode === 'repeat' ? 'repeating' : 'alternating';
  }

  reset() {
    this.seen = [];
    this.mode = 'observe';
    this.side = 0;
    this.level = 0;
    this.recent = [];
    this.switched = false;
    this.winsSinceSwitch = 0;
    this.betsSinceSwitch = 0;
    this.switchWinStreak = 0;
    this.switches = 0;
  }

  observe(sideId: string | null) {
    if (this.mode !== 'observe' || sideId === null) return;
    const i = this.sides.indexOf(sideId);
    if (i < 0) return;
    this.seen.push(i);
    if (this.seen.length === 2) {
      const [a, b] = this.seen;
      if (a === b) {
        this.mode = 'repeat';
        this.side = a;
      } else {
        this.mode = 'alternate';
        this.side = 1 - b; // continue the alternation: p b → bet p
      }
    }
  }

  bet(defaultBet: string): string {
    return this.mode === 'observe' ? defaultBet : this.sides[this.side];
  }

  next(): number {
    return this.mode === 'observe' ? 0 : neuralStake(this.base, this.level);
  }

  record(net: number, outcome?: Outcome) {
    if (this.mode === 'observe') {
      if (outcome) this.observe(sideOf(this.game, outcome));
      return;
    }
    this.recordResult(net > 0 ? true : net < 0 ? false : null);
  }

  /** true = bet won, false = bet lost (including zero), null = tie / push. */
  recordResult(won: boolean | null) {
    if (this.mode === 'observe' || won === null) return;
    if (this.switched) this.betsSinceSwitch++;

    if (won) {
      if (this.mode === 'alternate') this.side = 1 - this.side;
      if (this.switched) {
        const drop = this.switchWinStreak % 2 === 0 ? 2 : 1;
        this.switchWinStreak++;
        this.winsSinceSwitch++;
        this.level = Math.max(0, this.level - drop);
        if (this.winsSinceSwitch >= 3) this.switched = false; // back to the general rules
      } else {
        const r = [...this.recent.slice(-2), true];
        const twoInRow = r.length >= 2 && r[r.length - 2];
        const twoOfThree = r.length >= 3 && r.filter((x) => x).length >= 2;
        this.level = Math.max(0, this.level - (twoInRow || twoOfThree ? 2 : 1));
      }
      this.recent.push(true);
      return;
    }

    // Lost
    this.recent.push(false);
    this.switchWinStreak = 0;
    const lostLevel5 = this.level === 4;
    const mayFlip = !this.switched || this.winsSinceSwitch >= 3 || this.betsSinceSwitch >= 5;
    if (lostLevel5 && mayFlip) {
      // Switch sides: bet the opposite of what we have been betting, at level 6.
      const lostSide = this.side;
      this.mode = 'repeat';
      this.side = 1 - lostSide;
      this.level = 5;
      this.switched = true;
      this.winsSinceSwitch = 0;
      this.betsSinceSwitch = 0;
      this.switches++;
      return;
    }
    if (this.mode === 'alternate') {
      // The alternation broke: bet only the opposite of the losing bet from now on.
      this.mode = 'repeat';
      this.side = 1 - this.side;
    }
    this.level = Math.min(7, this.level + 1);
  }
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
      case 'neural':
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
  /** 'book' = Neural Strategy book settings, 'protected' = half the risk, '' = older plans. */
  mode?: NeuralMode | '';
  /** The 8 bet sizes of the Neural series for this session. */
  series?: number[];
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

export type NeuralMode = 'book' | 'protected';

/**
 * Neural Strategy session (book rules): the amount is the session bankroll,
 * the base bet is bankroll / 61.2 (the series total), the target is 1/3 of the
 * bankroll and the session ends if the bankroll is lost. "Protected" halves
 * the risk: target 1/6, stop at half the bankroll.
 */
export function planNeural(game: GameDef, amount: number, minutes: number, mode: NeuralMode): SessionPlan {
  const raw = amount / NEURAL_BANKROLL_UNITS;
  // Round like the book: a 300 bankroll gives a 5 base (series total 306, "rounded to 300").
  const base = raw >= 2 ? Math.round(raw) : Math.max(0.5, Math.round(raw * 2) / 2);
  const bet = getBet(game, game.bestBet)!;
  const book = mode === 'book';
  const stopWin = Math.round(amount / (book ? 3 : 6));
  const stopLoss = book ? amount : Math.round(amount / 2);
  return {
    mode,
    series: NEURAL_SERIES.map((_, i) => neuralStake(base, i)),
    gameId: game.id,
    betId: bet.id,
    betLabel: bet.label,
    edge: bet.edge,
    bankroll: amount,
    unit: base,
    stopWin,
    stopLoss,
    minutes,
    maxRounds: 150,
    expectedLoss: 0,
  };
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
  let busts = 0;
  let wagered = 0;
  const edge = getBet(cfg.game, cfg.betId)?.edge ?? 0;
  for (let s = 0; s < cfg.sessions; s++) {
    const tracker = makeStaker(cfg.strategy, cfg.unit, cfg.game);
    let bank = cfg.bankroll;
    for (let r = 0; r < cfg.rounds; r++) {
      if (tracker.watching) {
        tracker.observe?.(sideOf(cfg.game, cfg.game.play()));
        continue;
      }
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

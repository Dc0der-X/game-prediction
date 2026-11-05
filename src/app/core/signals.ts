/**
 * Signal engine: turns a betting system into "Bet X on Y" instructions with
 * stop rules. Used by the Session Coach (the player taps what came at their
 * real table) and by the practice tables.
 *
 * Systems
 *   neural    The Neural Strategy (from the book): watch 2 results, bet the
 *             repeating / alternating pattern with the 8-level series, switch
 *             sides after a level-5 loss. Quit at +1/3 of the session bankroll
 *             or when the session bankroll is gone; stop a choppy game early.
 *   original  The previous app's S/O + Attack/Retrench rule.
 *   flat      Same bet every round.
 * Every bet is capped so a session can never lose more than its loss limit.
 */
import { GameDef, GameId, Outcome, getBet, sideOf } from './games';
import { NeuralSystem, OriginalSystem, SESSION_LIMITS, StakeTracker, round2 } from './strategies';

export type SystemId = 'neural' | 'original' | 'flat';
export type RoundResult = 'won' | 'lost' | 'void';
export type StopReason = 'stop-win' | 'stop-loss' | 'profit-lock' | 'change-table' | 'choppy';

export interface Signal {
  /** True while the system is still watching results (no bet yet). */
  watching: boolean;
  betId: string;
  betLabel: string;
  stake: number;
  mode: 'ATTACK' | 'RETRENCH' | 'FLAT' | 'NEURAL';
  /** Neural Strategy level, 1–8. */
  level: number;
  pattern: 'watching' | 'repeating' | 'alternating' | '';
  /** True right after a side switch (special step-down rules apply). */
  switched: boolean;
  /** True when the system wanted more but the loss limit capped the bet. */
  capped: boolean;
}

/** What a zero / tie / triple / seven does to an even-money bet in each game. */
export const VOID_RESULT: Record<GameId, { label: string; short: string; mult: number }> = {
  baccarat: { label: 'Tie', short: 'T', mult: 0 },
  'dragon-tiger': { label: 'Tie', short: 'T', mult: -0.5 },
  roulette: { label: 'Zero', short: '0', mult: -1 },
  sicbo: { label: 'Triple', short: '★', mult: -1 },
  // Craps: a 12 on the come-out pushes Don't Pass (Pass loses – handled in applySide).
  craps: { label: '12 (bar)', short: '12', mult: 0 },
};

export const SYSTEMS: { id: SystemId; name: string; summary: string }[] = [
  {
    id: 'neural',
    name: 'Neural Strategy',
    summary: 'Reads the pattern from the last results and sets the side and the amount for every bet.',
  },
  {
    id: 'flat',
    name: 'Flat',
    summary: 'Same bet and amount every round. The lowest-cost option.',
  },
];

export interface SignalRound {
  betId: string;
  stake: number;
  net: number;
  result: RoundResult;
  /** The side that came (null for zero / tie / triple / seven). */
  came?: string | null;
}

/** Saved events, so a session can be rebuilt exactly after a refresh. */
export type SignalEvent =
  | { t: 'start'; side: string | null }
  | { t: 'watch'; side: string | null }
  | { t: 'round'; side: string | null };

/** Rounds after which an unprofitable Neural session counts as "choppy" (book: about 60 decisions). */
export const CHOPPY_AFTER = 60;

export class SignalEngine {
  private orig: OriginalSystem | null = null;
  private neural: NeuralSystem | null = null;
  rounds: SignalRound[] = [];
  net = 0;
  peak = 0;
  /** Losses in a row at the current table. */
  streak = 0;
  /** Number of the current table (1 = first table this session). */
  table = 1;
  /** The choppy-game warning is shown once per session. */
  choppyShown = false;

  constructor(
    public game: GameDef,
    public system: SystemId,
    public unit: number,
    public stopWin: number,
    public stopLoss: number
  ) {
    this.start(null);
  }

  get sides(): [string, string] | null {
    return this.game.sides ?? null;
  }

  get watching(): boolean {
    return !!this.neural?.watching;
  }

  get watched(): number {
    return this.neural?.watched ?? 0;
  }

  /** Begin (or begin again at a new table) from the last result seen there. */
  start(lastSide: string | null) {
    this.orig = null;
    this.neural = null;
    if (this.game.sides && this.system === 'original') {
      this.orig = new OriginalSystem(this.unit, this.game);
      this.orig.seed(lastSide);
    } else if (this.game.sides && this.system === 'neural') {
      this.neural = new NeuralSystem(this.unit, this.game);
      if (lastSide) this.neural.observe(lastSide);
    }
    this.streak = 0;
  }

  /** A result seen while the Neural Strategy is watching (before its first bet). */
  observe(side: string | null) {
    this.neural?.observe(side);
  }

  /** Player changed table: new pattern, fresh stake, streak cleared; money totals carry on. */
  changeTable(lastSide: string | null) {
    this.table++;
    this.start(lastSide);
  }

  /** The next instruction. */
  signal(): Signal {
    const base = { level: 0, pattern: '' as Signal['pattern'], switched: false };
    if (this.neural?.watching) {
      return { ...base, watching: true, betId: '', betLabel: '', stake: 0, mode: 'NEURAL', pattern: 'watching', capped: false };
    }
    let betId = this.game.bestBet;
    let raw = this.unit;
    let mode: Signal['mode'] = 'FLAT';
    if (this.neural) {
      betId = this.neural.bet(this.game.bestBet);
      raw = this.neural.next();
      mode = 'NEURAL';
      base.level = this.neural.level + 1;
      base.pattern = this.neural.pattern as Signal['pattern'];
      base.switched = this.neural.switched;
    } else if (this.orig) {
      betId = this.orig.bet(this.game.bestBet);
      raw = this.orig.next();
      mode = this.orig.state.mode as Signal['mode'];
    }
    const room = this.stopLoss + this.net; // how much can still be lost before the loss limit
    const stake = round2(Math.max(0, Math.min(raw, room)));
    return { ...base, watching: false, betId, betLabel: getBet(this.game, betId)?.label ?? betId, stake, mode, capped: raw > room };
  }

  winMultiplier(betId: string) {
    return betId === 'banker' ? 0.95 : 1;
  }

  /** Real play: the player taps which side came (null = zero / tie / triple / seven). */
  applySide(came: string | null): SignalRound | null {
    if (this.watching) {
      this.observe(came);
      return null;
    }
    const sig = this.signal();
    const result: RoundResult = came === null ? 'void' : came === sig.betId ? 'won' : 'lost';
    const voidMult = this.game.id === 'craps' && sig.betId === 'pass' ? -1 : VOID_RESULT[this.game.id].mult;
    const mult = result === 'won' ? this.winMultiplier(sig.betId) : result === 'lost' ? -1 : voidMult;
    return this.push({ betId: sig.betId, stake: sig.stake, net: round2(sig.stake * mult), result, came });
  }

  /** Practice tables: a dealt outcome. Returns null while the system is still watching. */
  applyOutcome(o: Outcome): SignalRound | null {
    const came = sideOf(this.game, o);
    if (this.watching) {
      this.observe(came);
      return null;
    }
    const sig = this.signal();
    const result: RoundResult = came === null ? 'void' : came === sig.betId ? 'won' : 'lost';
    return this.push({ betId: sig.betId, stake: sig.stake, net: round2(sig.stake * this.game.settle(sig.betId, o)), result, came });
  }

  private push(r: SignalRound): SignalRound {
    // Neural Strategy: ties change nothing; zero and other house results count as a lost bet.
    this.neural?.recordResult(r.net > 0 ? true : r.net < 0 ? false : null);
    this.orig?.recordResult(r.result === 'void' ? null : r.result === 'won');
    this.rounds.push(r);
    this.net = round2(this.net + r.net);
    this.peak = Math.max(this.peak, this.net);
    if (r.net < 0) this.streak++;
    else if (r.net > 0) this.streak = 0;
    return r;
  }

  /** Has the session been well up (enough that 2 losses in a row should end it)? */
  get inBigProfit(): boolean {
    return this.peak >= this.stopWin * SESSION_LIMITS.profitLockAt;
  }

  /** Which stop rule (if any) applies now. */
  check(): StopReason | null {
    if (this.net >= this.stopWin) return 'stop-win';
    if (this.net <= -this.stopLoss + 0.001) return 'stop-loss';
    if (this.system === 'neural') {
      // Book advice: a long, choppy game that is going nowhere is better called off.
      if (!this.choppyShown && this.rounds.length >= CHOPPY_AFTER && this.net < this.stopWin * 0.25) {
        this.choppyShown = true;
        return 'choppy';
      }
      return null;
    }
    if (this.inBigProfit && this.streak >= SESSION_LIMITS.profitLockLosses) return 'profit-lock';
    if (this.streak >= SESSION_LIMITS.changeTableLosses) return 'change-table';
    return null;
  }

  /** Rebuilds everything from saved events (e.g. after a page refresh). */
  static replay(engine: SignalEngine, events: SignalEvent[]): SignalEngine {
    let first = true;
    for (const e of events) {
      if (e.t === 'start') {
        if (first) engine.start(e.side);
        else engine.changeTable(e.side);
        first = false;
      } else if (e.t === 'watch') {
        engine.observe(e.side);
      } else {
        engine.applySide(e.side);
      }
    }
    if (engine.rounds.length >= CHOPPY_AFTER) engine.choppyShown = true;
    return engine;
  }
}

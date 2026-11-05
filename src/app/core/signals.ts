/**
 * Signal engine: the original S/O + Attack/Retrench rule, turned into
 * "Bet X on Y" instructions with discipline rules. Used by the Session Coach
 * (the player taps what came at their real table) and the practice tables.
 *
 * Discipline (checked after every round, in this order):
 *   stop-win      profit target reached                       → STOP, cash out
 *   stop-loss     maximum loss reached                        → STOP for today
 *   profit-lock   was well up (60% of target), then 2 losses   → STOP, keep the profit
 *   change-table  3 losses in a row at this table             → STOP here; new table or end
 * Every bet is capped so the session can never go past the maximum loss.
 */
import { GameDef, GameId, Outcome, getBet, sideOf } from './games';
import { OriginalSystem, SESSION_LIMITS, StakeTracker, round2 } from './strategies';

export type SystemId = 'original' | 'flat';
export type RoundResult = 'won' | 'lost' | 'void';
export type StopReason = 'stop-win' | 'stop-loss' | 'profit-lock' | 'change-table';

export interface Signal {
  betId: string;
  betLabel: string;
  stake: number;
  mode: 'ATTACK' | 'RETRENCH' | 'FLAT';
  /** True when the system wanted more but the maximum loss capped the bet. */
  capped: boolean;
}

/** What a zero / tie / triple / seven does to an even-money bet in each game. */
export const VOID_RESULT: Record<GameId, { label: string; short: string; mult: number }> = {
  baccarat: { label: 'Tie', short: 'T', mult: 0 },
  'dragon-tiger': { label: 'Tie', short: 'T', mult: -0.5 },
  roulette: { label: 'Zero', short: '0', mult: -1 },
  sicbo: { label: 'Triple', short: '★', mult: -1 },
  lucky7: { label: 'Seven', short: '7', mult: -1 },
};

export const SYSTEMS: { id: SystemId; name: string; summary: string }[] = [
  {
    id: 'original',
    name: 'Neural Signals',
    summary: 'Reads what came at your table and tells you the side and the amount for every bet.',
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
export type SignalEvent = { t: 'start'; side: string | null } | { t: 'round'; side: string | null };

export class SignalEngine {
  private orig: OriginalSystem | null = null;
  rounds: SignalRound[] = [];
  net = 0;
  peak = 0;
  /** Losses in a row at the current table. */
  streak = 0;
  /** Number of the current table (1 = first table this session). */
  table = 1;

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

  /** Begin (or begin again at a new table) from the last result seen there. */
  start(lastSide: string | null) {
    if (this.system === 'original' && this.game.sides) {
      this.orig = this.orig ?? new OriginalSystem(this.unit, this.game);
      this.orig.seed(lastSide);
    } else {
      this.orig = null;
    }
    this.streak = 0;
  }

  /** Player changed table: new pattern, fresh stake, streak cleared; money totals carry on. */
  changeTable(lastSide: string | null) {
    this.table++;
    this.start(lastSide);
  }

  /** The next instruction. */
  signal(): Signal {
    const betId = this.orig ? this.orig.bet(this.game.bestBet) : this.game.bestBet;
    const raw = this.orig ? this.orig.next() : this.unit;
    const room = this.stopLoss + this.net; // how much can still be lost before the maximum loss
    const stake = round2(Math.max(0, Math.min(raw, room)));
    return {
      betId,
      betLabel: getBet(this.game, betId)?.label ?? betId,
      stake,
      mode: this.orig ? this.orig.state.mode : 'FLAT',
      capped: raw > room,
    };
  }

  winMultiplier(betId: string) {
    return betId === 'banker' ? 0.95 : 1;
  }

  /** Real play: the player taps which side came (null = zero / tie / triple / seven). */
  applySide(came: string | null): SignalRound {
    const sig = this.signal();
    const result: RoundResult = came === null ? 'void' : came === sig.betId ? 'won' : 'lost';
    const mult = result === 'won' ? this.winMultiplier(sig.betId) : result === 'lost' ? -1 : VOID_RESULT[this.game.id].mult;
    return this.push({ betId: sig.betId, stake: sig.stake, net: round2(sig.stake * mult), result, came });
  }

  /** Practice tables: a dealt outcome. */
  applyOutcome(o: Outcome): SignalRound {
    const sig = this.signal();
    const came = sideOf(this.game, o);
    const result: RoundResult = came === null ? 'void' : came === sig.betId ? 'won' : 'lost';
    return this.push({ betId: sig.betId, stake: sig.stake, net: round2(sig.stake * this.game.settle(sig.betId, o)), result, came });
  }

  private push(r: SignalRound): SignalRound {
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

  /** Which discipline rule (if any) says stop now. */
  check(): StopReason | null {
    if (this.net >= this.stopWin) return 'stop-win';
    if (this.net <= -this.stopLoss + 0.001) return 'stop-loss';
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
      } else {
        engine.applySide(e.side);
      }
    }
    return engine;
  }
}

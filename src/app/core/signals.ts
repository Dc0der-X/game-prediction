/**
 * Signal engine: turns a betting system into "Bet X on Y" instructions with
 * stop rules. Used by the Session Coach (the player taps what came at their
 * real table) and by the practice tables.
 *
 * Every player gets Neural Signals: the SOS side rule (Same, Opposite, Same)
 * with the 8-step ladder. The same session rules apply to everyone:
 *   target reached          → cash out
 *   halfway up, then half   → cash out (keep the profit)
 *   of the best given back
 *   3 losses in a row       → move to a fresh table (ladder back to step 1)
 *   safety limit reached    → session complete
 * Bets are never cut down: before each bet the coach checks that the bet fits inside the safety
 * limit, and the session ends BEFORE a ladder bet that would not fit. Each signal says in advance
 * what happens if it misses (next bet / fresh table / session ends).
 * ('original' and 'flat' remain only so older saved sessions still load.)
 */
import { GameDef, GameId, Outcome, getBet, sideOf } from './games';
import { NeuralSystem, OriginalSystem, SESSION_LIMITS, StakeTracker, round2 } from './strategies';

export type SystemId = 'neural' | 'original' | 'flat';
export type RoundResult = 'won' | 'lost' | 'void';
export type StopReason = 'stop-win' | 'stop-loss' | 'profit-lock' | 'change-table';

export interface Signal {
  /** True while the system is still watching results (no bet yet). */
  watching: boolean;
  betId: string;
  betLabel: string;
  stake: number;
  mode: 'ATTACK' | 'RETRENCH' | 'FLAT' | 'NEURAL';
  /** Ladder step, 1–8. */
  level: number;
  pattern: 'same' | 'opposite' | '';
  /** Change from the previous bet at this table: +3, -2, 0 (null for the first bet). */
  change: number | null;
  /** Kept for older screens; always false now. */
  switched: boolean;
  /** Kept for older screens; bets are never cut down any more (the session stops first). */
  capped: boolean;
  /**
   * What happens if THIS bet misses, known before it is placed:
   *   continue     – the next ladder bet still fits inside the safety limit
   *   fresh-table  – 3rd miss in a row: move to a fresh table, ladder back to step 1
   *   stop         – the next bet would not fit inside the safety limit: the session ends there
   */
  ifMiss: 'continue' | 'fresh-table' | 'stop';
  /** The bet that would follow a miss (null when the session would stop). */
  ifMissStake: number | null;
  /** Money still available before the safety limit. */
  room: number;
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
  { id: 'neural', name: 'Neural Signals', summary: 'Reads your table and gives you the side and the amount for every bet.' },
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
  /** Index in `rounds` where the current table started. */
  tableStart = 0;

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
      this.neural.seed(lastSide);
    }
    this.streak = 0;
    this.tableStart = this.rounds.length;
  }

  /** Older saved sessions: a "watched" result now simply re-seeds the table. */
  observe(side: string | null) {
    if (this.rounds.length === this.tableStart) this.start(side);
  }

  /** Player changed table: new pattern, fresh stake, streak cleared; money totals carry on. */
  changeTable(lastSide: string | null) {
    this.table++;
    this.start(lastSide);
  }

  /** The next instruction. */
  signal(): Signal {
    const base = { level: 0, pattern: '' as Signal['pattern'], switched: false };
    let betId = this.game.bestBet;
    let raw = this.unit;
    let mode: Signal['mode'] = 'FLAT';
    if (this.neural) {
      betId = this.neural.bet();
      raw = this.neural.next();
      mode = 'NEURAL';
      base.level = this.neural.level + 1;
      base.pattern = this.neural.pattern;
    } else if (this.orig) {
      betId = this.orig.bet(this.game.bestBet);
      raw = this.orig.next();
      mode = this.orig.state.mode as Signal['mode'];
    }
    const room = round2(this.stopLoss + this.net); // how much can still be lost before the safety limit
    // Safety net only – check() ends the session before a bet that would not fit.
    const stake = round2(Math.max(0, Math.min(raw, room)));
    const prev = this.rounds.length > this.tableStart ? this.rounds[this.rounds.length - 1].stake : null;
    const roomAfterMiss = room - stake;
    let ifMiss: Signal['ifMiss'];
    let ifMissStake: number | null;
    if (this.streak + 1 >= SESSION_LIMITS.changeTableLosses) {
      ifMissStake = this.firstStake();
      ifMiss = ifMissStake > roomAfterMiss + 0.001 ? 'stop' : 'fresh-table';
    } else {
      ifMissStake = this.neural ? this.neural.stakeAt(Math.min(7, this.neural.level + 1)) : raw;
      ifMiss = ifMissStake > roomAfterMiss + 0.001 ? 'stop' : 'continue';
    }
    if (ifMiss === 'stop') ifMissStake = null;
    return {
      ...base, watching: false, betId, betLabel: getBet(this.game, betId)?.label ?? betId, stake, mode,
      capped: raw > room + 0.001, change: prev === null ? null : round2(stake - prev),
      ifMiss, ifMissStake, room,
    };
  }

  /** The first ladder bet (what a fresh table starts with). */
  private firstStake(): number {
    return this.neural ? this.neural.stakeAt(0) : this.unit;
  }

  /** The ladder's next bet before any safety check. */
  private rawNext(): number {
    if (this.neural) return this.neural.next();
    if (this.orig) return this.orig.next();
    return this.unit;
  }

  winMultiplier(betId: string) {
    return betId === 'banker' ? 0.95 : 1;
  }

  /** Real play: the player taps which side came (null = zero / tie / triple / seven). */
  applySide(came: string | null): SignalRound | null {
    const sig = this.signal();
    const result: RoundResult = came === null ? 'void' : came === sig.betId ? 'won' : 'lost';
    const voidMult = this.game.id === 'craps' && sig.betId === 'pass' ? -1 : VOID_RESULT[this.game.id].mult;
    const mult = result === 'won' ? this.winMultiplier(sig.betId) : result === 'lost' ? -1 : voidMult;
    return this.push({ betId: sig.betId, stake: sig.stake, net: round2(sig.stake * mult), result, came });
  }

  /** Practice tables: a dealt outcome. Returns null while the system is still watching. */
  applyOutcome(o: Outcome): SignalRound | null {
    const came = sideOf(this.game, o);
    const sig = this.signal();
    const result: RoundResult = came === null ? 'void' : came === sig.betId ? 'won' : 'lost';
    return this.push({ betId: sig.betId, stake: sig.stake, net: round2(sig.stake * this.game.settle(sig.betId, o)), result, came });
  }

  private push(r: SignalRound): SignalRound {
    // Ties change nothing; zero and other house results count as a lost bet for the ladder.
    this.neural?.recordRound(r.net, r.result === 'void' ? null : r.result === 'won');
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

  /** Which session rule (if any) applies now. The same for every game and every player. */
  check(): StopReason | null {
    if (this.net >= this.stopWin - 0.001) return 'stop-win';
    if (this.net <= -this.stopLoss + 0.001) return 'stop-loss';
    // Lock in profit: halfway to the target, then half of the best point given back → cash out.
    if (this.inBigProfit && this.net <= this.peak * (1 - SESSION_LIMITS.profitLockGiveBack)) return 'profit-lock';
    const room = this.stopLoss + this.net;
    if (this.streak >= SESSION_LIMITS.changeTableLosses) {
      // A fresh table only if its first bet still fits inside the safety limit.
      return this.firstStake() > room + 0.001 ? 'stop-loss' : 'change-table';
    }
    // The next ladder bet would not fit inside the safety limit: end the session before it.
    if (this.rawNext() > room + 0.001) return 'stop-loss';
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
    return engine;
  }
}

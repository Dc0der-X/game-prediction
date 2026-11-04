/**
 * Signal engine: turns a staking system into "Bet X on Y" instructions with
 * hard limits. Used by the practice tables (play money) and the Session Coach
 * (real money), so both behave exactly the same.
 */
import { GameDef, GameId, Outcome, getBet, sideOf } from './games';
import { OriginalSystem, StakeTracker, round2 } from './strategies';

export type SystemId = 'original' | 'flat';
export type RoundResult = 'won' | 'lost' | 'void';

export interface Signal {
  betId: string;
  betLabel: string;
  stake: number;
  mode: 'ATTACK' | 'RETRENCH' | 'FLAT';
  /** True when the system wanted more but the loss limit capped the bet. */
  capped: boolean;
}

/** What a zero / tie / triple / seven does to an even-money bet in each game. */
export const VOID_RESULT: Record<GameId, { label: string; mult: number }> = {
  baccarat: { label: 'Tie', mult: 0 },
  'dragon-tiger': { label: 'Tie', mult: -0.5 },
  roulette: { label: 'Zero', mult: -1 },
  sicbo: { label: 'Triple', mult: -1 },
  lucky7: { label: 'Seven', mult: -1 },
};

export const SYSTEMS: { id: SystemId; name: string; summary: string }[] = [
  {
    id: 'original',
    name: 'TableWise Signals',
    summary: 'Picks the side every round (Same/Opposite) and steps the stake with Attack/Retrench. Capped at your loss limit.',
  },
  {
    id: 'flat',
    name: 'Flat',
    summary: 'Same bet and stake every round. Lowest cost, mildest bad days.',
  },
];

export interface SignalRound {
  betId: string;
  stake: number;
  net: number;
  result: RoundResult;
}

export class SignalEngine {
  private orig: OriginalSystem | null = null;
  private flat: StakeTracker | null = null;

  constructor(
    public game: GameDef,
    public system: SystemId,
    public unit: number,
    public stopWin: number,
    public stopLoss: number
  ) {
    this.reset();
  }

  reset() {
    if (this.system === 'original' && this.game.sides) {
      this.orig = new OriginalSystem(this.unit, this.game);
      this.flat = null;
    } else {
      this.orig = null;
      this.flat = new StakeTracker('flat', this.unit);
    }
  }

  /** The next instruction, given the session's current profit/loss. */
  signal(net: number): Signal {
    const betId = this.orig ? this.orig.bet(this.game.bestBet) : this.game.bestBet;
    const raw = this.orig ? this.orig.next() : this.unit;
    const room = this.stopLoss + net; // how much can still be lost before the stop
    const stake = round2(Math.max(0, Math.min(raw, room)));
    return {
      betId,
      betLabel: getBet(this.game, betId)?.label ?? betId,
      stake,
      mode: this.orig ? this.orig.state.mode : 'FLAT',
      capped: raw > room,
    };
  }

  /** Payout per unit when the signalled bet wins (Banker pays 0.95). */
  winMultiplier(betId: string) {
    return betId === 'banker' ? 0.95 : 1;
  }

  /** Records a round the player reports (real money). Returns the money won or lost. */
  apply(result: RoundResult, net: number): SignalRound {
    const sig = this.signal(net);
    const mult =
      result === 'won' ? this.winMultiplier(sig.betId) : result === 'lost' ? -1 : VOID_RESULT[this.game.id].mult;
    const delta = round2(sig.stake * mult);
    this.orig?.recordResult(result === 'void' ? null : result === 'won');
    return { betId: sig.betId, stake: sig.stake, net: delta, result };
  }

  /** Records a round played on a practice table. */
  applyOutcome(o: Outcome, net: number): SignalRound {
    const sig = this.signal(net);
    const side = sideOf(this.game, o);
    const result: RoundResult = side === null ? 'void' : side === sig.betId ? 'won' : 'lost';
    const delta = round2(sig.stake * this.game.settle(sig.betId, o));
    this.orig?.recordResult(result === 'void' ? null : result === 'won');
    return { betId: sig.betId, stake: sig.stake, net: delta, result };
  }

  /** Rebuilds the engine state from saved rounds (e.g. after a page refresh). */
  replay(rounds: { result?: RoundResult }[]) {
    this.reset();
    for (const r of rounds) {
      if (r.result) this.orig?.recordResult(r.result === 'void' ? null : r.result === 'won');
    }
  }

  /** Has the session hit a limit? */
  stopReason(net: number): 'stop-win' | 'stop-loss' | null {
    if (net >= this.stopWin) return 'stop-win';
    if (net <= -this.stopLoss + 0.001) return 'stop-loss';
    return null;
  }
}

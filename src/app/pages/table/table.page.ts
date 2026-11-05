import { Component, OnDestroy, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { StopSignComponent } from '../../shared/stop-sign.component';
import { AccountService } from '../../core/account.service';
import {
  BetType, Card, GameDef, Outcome, RANKS, RED_NUMBERS, SUITS, getBet, getGame, isRedSuit, pct, sideOf,
} from '../../core/games';
import { NEURAL_BANKROLL_UNITS, SESSION_LIMITS, makeStaker, round2 } from '../../core/strategies';
import { Signal, SignalEngine } from '../../core/signals';

const START_BALANCE = 1000;
const BALANCE_KEY = 'tw.practiceBalance';

interface Settled { betId: string; label: string; stake: number; net: number }

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [IonicModule, RouterLink, NgFor, NgIf, NgClass, NgSwitch, NgSwitchCase, AsyncPipe, DecimalPipe, FormsModule, TopbarComponent, StopSignComponent],
  templateUrl: './table.page.html',
  styleUrls: ['./table.page.scss'],
})
export class TablePage implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  access$ = inject(AccountService).access$;

  game!: GameDef;
  chips = [1, 5, 10, 25, 100];
  chip = 1;
  balance = START_BALANCE;
  bets: Record<string, number> = {};
  lastBets: Record<string, number> = {};
  outcome: Outcome | null = null;
  settled: Settled[] = [];
  roundNet = 0;
  history: Outcome[] = [];
  dealing = false;
  showNumbers = false;

  // Session stats for this table visit
  rounds = 0;
  wagered = 0;
  net = 0;
  expectedLoss = 0;

  // Auto-play the signals
  autoResult: { rounds: number; net: number; maxStake: number } | null = null;

  // Signal mode: the same signals + STOP rules as the real-money coach, with play money.
  signalsOn = true;
  engine: SignalEngine | null = null;
  sigNet = 0;
  sigRounds = 0;
  nextCheckinAt = 0;
  checkinIn = 0; // seconds until the next STOP check-in
  stopSign: 'final' | 'checkin' | 'table' | null = null;
  stopReason = '';
  signalError = '';
  private clock: any;

  numbers = Array.from({ length: 36 }, (_, i) => i + 1);
  pct = pct;
  RANKS = RANKS;
  SUITS = SUITS;

  private sub: Subscription;
  private timer: any;

  constructor() {
    this.balance = this.loadBalance();
    this.sub = this.route.paramMap.subscribe((p) => {
      const g = getGame(p.get('game'));
      if (!g) {
        this.router.navigateByUrl('/lobby');
        return;
      }
      this.game = g;
      this.resetTable();
      if (this.signalsOn) this.newSignalSession();
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    clearTimeout(this.timer);
    clearInterval(this.clock);
  }

  /* ---------------- Signals ---------------- */

  get signal(): Signal | null {
    return this.engine ? this.engine.signal() : null;
  }

  /** Practice amount = twice the ladder for this chip (as in real play); same target and safety limit. */
  get amount() {
    return Math.round(this.chip * NEURAL_BANKROLL_UNITS * 2);
  }

  get stopLoss() {
    return Math.round(this.amount * SESSION_LIMITS.safetyShare);
  }

  get stopWin() {
    return Math.round(this.amount * SESSION_LIMITS.targetShare);
  }

  /** Starts a fresh practice signal session (new limits from the current chip). */
  newSignalSession() {
    this.engine = new SignalEngine(this.game, 'neural', this.chip, this.stopWin, this.stopLoss);
    this.sigNet = 0;
    this.sigRounds = 0;
    this.stopSign = null;
    this.signalError = '';
    this.nextCheckinAt = Date.now() + 15 * 60_000;
    clearInterval(this.clock);
    this.clock = setInterval(() => {
      if (!this.signalsOn) return;
      this.checkinIn = Math.max(0, Math.round((this.nextCheckinAt - Date.now()) / 1000));
      if (this.checkinIn === 0 && !this.stopSign) {
        this.stopSign = 'checkin';
        this.nextCheckinAt = Date.now() + 15 * 60_000;
      }
    }, 1000);
  }

  setChip(c: number) {
    this.chip = c;
    // The signal unit follows the chip until the first signal round is played.
    if (this.signalsOn && this.sigRounds === 0) this.newSignalSession();
  }

  toggleSignals() {
    this.signalsOn = !this.signalsOn;
    this.bets = {};
    if (this.signalsOn) this.newSignalSession();
    else clearInterval(this.clock);
  }

  playSignal() {
    if (this.dealing || this.stopSign || !this.engine) return;
    const sig = this.engine.signal();
    if (sig.stake > this.balance) {
      this.signalError = 'Top up your play chips to place this signal.';
      return;
    }
    this.signalError = '';
    this.bets = { [sig.betId]: sig.stake };
    this.dealing = true;
    this.outcome = null;
    this.settled = [];
    this.timer = setTimeout(() => {
      const o = this.game.play();
      const round = this.engine!.applyOutcome(o);
      if (round) this.settleRound(o, { [round.betId]: round.stake });
      this.sigNet = this.engine!.net;
      this.sigRounds++;
      this.lastBets = {};
      this.bets = {};
      this.dealing = false;
      const hit = this.engine!.check();
      if (hit === 'change-table') {
        this.stopSign = 'table';
      } else if (hit) {
        this.stopReason = hit === 'stop-win' ? 'Target hit!' : hit === 'stop-loss' ? 'Safety limit reached.' : "You're ahead – lock it in.";
        this.stopSign = 'final';
      }
    }, 650);
  }

  /** After 3 misses: a fresh table starts from the last result, with the same totals. */
  switchTable() {
    this.engine?.changeTable(this.history[0] ? sideOf(this.game, this.history[0]) : null);
    this.stopSign = null;
  }

  get levelLabel(): string {
    const s = this.signal;
    if (!s) return '';
    return `Step ${s.level}/8 · ${s.pattern === 'opposite' ? 'swing' : 'ride the run'}`;
  }

  get streakLights(): boolean[] {
    const limit = this.engine?.inBigProfit ? SESSION_LIMITS.profitLockLosses : SESSION_LIMITS.changeTableLosses;
    return Array.from({ length: limit }, (_, i) => i < (this.engine?.streak ?? 0));
  }

  get checkinClock() {
    return `${Math.floor(this.checkinIn / 60)}:${String(this.checkinIn % 60).padStart(2, '0')}`;
  }

  get checkinHint() {
    if (this.sigNet > 0) return 'You are up. In real play, this is a great moment to cash out on top.';
    return 'Quick check-in. Keep practising as long as you like.';
  }

  /* ---------------- Betting ---------------- */

  get totalBet() {
    return Object.values(this.bets).reduce((a, b) => a + b, 0);
  }

  get bestBet(): BetType {
    return getBet(this.game, this.game.bestBet)!;
  }

  betLabel(id: string) {
    return getBet(this.game, id)?.label ?? id;
  }

  place(betId: string) {
    if (this.dealing || this.signalsOn) return;
    if (this.totalBet + this.chip > this.balance) return;
    this.bets = { ...this.bets, [betId]: (this.bets[betId] || 0) + this.chip };
  }

  clearBets() {
    if (!this.dealing) this.bets = {};
  }

  rebet() {
    const total = Object.values(this.lastBets).reduce((a, b) => a + b, 0);
    if (!this.dealing && total && total <= this.balance) this.bets = { ...this.lastBets };
  }

  deal() {
    if (this.dealing || !this.totalBet) return;
    this.dealing = true;
    this.outcome = null;
    this.settled = [];
    this.timer = setTimeout(() => {
      const o = this.game.play();
      this.settleRound(o, this.bets);
      this.lastBets = { ...this.bets };
      this.bets = {};
      this.dealing = false;
    }, 650);
  }

  private settleRound(o: Outcome, bets: Record<string, number>) {
    const settled: Settled[] = [];
    let roundNet = 0;
    for (const [betId, stake] of Object.entries(bets)) {
      const net = round2(stake * this.game.settle(betId, o));
      roundNet += net;
      settled.push({ betId, label: this.betLabel(betId), stake, net });
      this.wagered += stake;
      this.expectedLoss += stake * (getBet(this.game, betId)?.edge ?? 0);
    }
    this.outcome = o;
    this.settled = settled;
    this.roundNet = round2(roundNet);
    this.net = round2(this.net + roundNet);
    this.rounds++;
    this.history = [o, ...this.history].slice(0, 40);
    this.setBalance(this.balance + roundNet);
  }

  /* ---------------- Auto-play a strategy ---------------- */

  autoPlay(n: number) {
    if (this.dealing) return;
    const tracker = makeStaker('neural', this.chip, this.game);
    if (this.history[0]) (tracker as any).seed?.(sideOf(this.game, this.history[0]));
    let total = 0;
    let maxStake = 0;
    let played = 0;
    let last: Outcome | null = null;
    for (let i = 0; i < n; i++) {
      const stake = Math.min(tracker.next(), this.balance);
      if (stake <= 0) break;
      maxStake = Math.max(maxStake, stake);
      const o = this.game.play();
      const bets = { [tracker.bet(this.game.bestBet)]: stake };
      this.settleRound(o, bets);
      const net = this.roundNet;
      tracker.record(net, o);
      total += net;
      played++;
      last = o;
    }
    this.outcome = last;
    this.autoResult = { rounds: played, net: round2(total), maxStake };
  }

  /* ---------------- Balance ---------------- */

  resetBalance() {
    this.setBalance(START_BALANCE);
    this.resetTable();
    if (this.signalsOn) this.newSignalSession();
  }

  private resetTable() {
    this.bets = {};
    this.lastBets = {};
    this.outcome = null;
    this.settled = [];
    this.history = [];
    this.rounds = 0;
    this.wagered = 0;
    this.net = 0;
    this.expectedLoss = 0;
    this.autoResult = null;
  }

  private loadBalance(): number {
    try {
      const v = Number(localStorage.getItem(BALANCE_KEY));
      return Number.isFinite(v) && v > 0 ? v : START_BALANCE;
    } catch {
      return START_BALANCE;
    }
  }

  private setBalance(v: number) {
    this.balance = round2(Math.max(0, v));
    try {
      localStorage.setItem(BALANCE_KEY, String(this.balance));
    } catch {}
  }

  /* ---------------- View helpers ---------------- */

  isRed(c: Card) {
    return isRedSuit(c.suit);
  }

  numberTone(n: number) {
    return n === 0 ? 'tone-green' : RED_NUMBERS.has(n) ? 'tone-red' : 'tone-black';
  }

  betTone(id: string) {
    const map: Record<string, string> = {
      player: 'blue', banker: 'red', tie: 'green', dragon: 'red', tiger: 'blue',
      red: 'red', black: 'black', small: 'blue', big: 'red', pass: 'blue', dontpass: 'red',
    };
    return map[id] || '';
  }
}

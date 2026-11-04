import { Component, OnDestroy, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe, NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { AccountService } from '../../core/account.service';
import {
  BetType, Card, GameDef, Outcome, RANKS, RED_NUMBERS, SUITS, getBet, getGame, isRedSuit, pct,
} from '../../core/games';
import { STRATEGIES, StakeTracker, StrategyId, round2 } from '../../core/strategies';

const START_BALANCE = 1000;
const BALANCE_KEY = 'tw.practiceBalance';

interface Settled { betId: string; label: string; stake: number; net: number }

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [IonicModule, RouterLink, NgFor, NgIf, NgClass, NgSwitch, NgSwitchCase, AsyncPipe, DecimalPipe, FormsModule, TopbarComponent],
  templateUrl: './table.page.html',
  styleUrls: ['./table.page.scss'],
})
export class TablePage implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  access$ = inject(AccountService).access$;

  game!: GameDef;
  chips = [5, 10, 25, 100, 500];
  chip = 10;
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

  // Auto-play (strategy tester)
  strategies = STRATEGIES;
  strategy: StrategyId = 'flat';
  autoResult: { rounds: number; net: number; maxStake: number } | null = null;

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
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    clearTimeout(this.timer);
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
    if (this.dealing) return;
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
    const tracker = new StakeTracker(this.strategy, this.chip);
    let total = 0;
    let maxStake = 0;
    let played = 0;
    let last: Outcome | null = null;
    for (let i = 0; i < n; i++) {
      const stake = Math.min(tracker.next(), this.balance);
      if (stake <= 0) break;
      maxStake = Math.max(maxStake, stake);
      const o = this.game.play();
      const bets = { [this.game.bestBet]: stake };
      this.settleRound(o, bets);
      const net = this.roundNet;
      tracker.record(net);
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
      red: 'red', black: 'black', small: 'blue', big: 'red', seven: 'gold',
    };
    return map[id] || '';
  }
}

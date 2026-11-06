import { Component, OnDestroy, inject } from '@angular/core';
import { DecimalPipe, NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { LiveDealerComponent } from './live-dealer.component';
import { CasinoDealer, dealerFor } from '../../core/dealers';
import { Card, GameDef, Outcome, RANKS, RED_NUMBERS, SUITS, getBet, getGame, isRedSuit, sideOf } from '../../core/games';
import { NEURAL_BANKROLL_UNITS, SESSION_LIMITS, round2, smallestUnit } from '../../core/strategies';
import { SignalEngine } from '../../core/signals';

type Phase = 'betting' | 'closing' | 'dealing' | 'result';

const BALANCE_KEY = 'tw.practiceBalance';
const START_BALANCE = 1000;
/** European wheel, clockwise from 0. */
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

/** How each game is played – shown in the Rules tab. */
const RULES: Record<string, string[]> = {
  baccarat: [
    'Bet on Player, Banker or Tie before the timer runs out.',
    'The dealer gives two cards to Player and two to Banker. Card values: A = 1, 2–9 face value, 10/J/Q/K = 0. Only the last digit of the total counts (7 + 8 = 5).',
    'A third card may be drawn by fixed rules – you never decide anything.',
    'Closest to 9 wins. Player pays 1:1, Banker pays 0.95:1 (5% commission), Tie pays 8:1 and Player/Banker bets are returned on a tie.',
  ],
  roulette: [
    'Bet on Red/Black, Odd/Even, 1–18/19–36 (pay 1:1) or a dozen (pays 2:1) before the timer runs out.',
    'The dealer spins the wheel and the ball – 37 pockets, 0 to 36.',
    'Zero is green: every outside bet loses on 0.',
    'The winning number is announced and paid straight away.',
  ],
  'dragon-tiger': [
    'One card to Dragon, one to Tiger. The higher card wins (Ace is low, King is high).',
    'Dragon and Tiger pay 1:1. On a tie you get half of a Dragon/Tiger bet back. Tie pays 11:1.',
    'Rounds are very fast – that is why the signals need extra discipline here.',
  ],
  sicbo: [
    'Three dice are shaken. Small = total 4–10, Big = total 11–17, both pay 1:1.',
    'Any triple (three of the same) makes Small and Big lose. Any Triple pays 30:1.',
  ],
  craps: [
    'One "line decision" per round. Come-out roll: 7 or 11 → Pass wins; 2 or 3 → Don\'t Pass wins; 12 → Pass loses, Don\'t Pass is a push.',
    'Any other number becomes the point. The dice roll until the point (Pass wins) or a 7 (Don\'t Pass wins).',
    'Pass and Don\'t Pass both pay 1:1.',
  ],
};

interface Placed { [betId: string]: number }

@Component({
  selector: 'app-live',
  standalone: true,
  imports: [IonicModule, RouterLink, NgIf, NgFor, NgClass, NgSwitch, NgSwitchCase, DecimalPipe, TopbarComponent, LiveDealerComponent],
  templateUrl: './live.page.html',
  styleUrls: ['./live.page.scss'],
})
export class LivePage implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sub: Subscription;
  private timers: any[] = [];
  private ticker: any;

  game!: GameDef;
  RANKS = RANKS;
  SUITS = SUITS;
  dealer!: CasinoDealer;
  line = '';

  // Round state
  phase: Phase = 'betting';
  round = 1;
  betSeconds = 15;
  left = 15;
  outcome: Outcome | null = null;
  history: Outcome[] = [];

  // Money (play money)
  chips = [1, 5, 10, 25, 100];
  chip = 5;
  balance = START_BALANCE;
  bets: Placed = {};
  lastBets: Placed = {};
  roundNet: number | null = null;

  // Animations
  wheelDeg = 0;
  ballDeg = 0;
  ballSettled = false;
  cardsShown: { who: 'P' | 'B' | 'D' | 'T'; card: Card }[] = [];
  dice: number[] = [1, 1, 1];
  shaking = false;
  crapsRolls: [number, number][] = [];
  crapsPoint = 0;

  // Signals + training
  signalsOn = true;
  training = true;
  tab: 'signal' | 'rules' = 'signal';
  engine!: SignalEngine;
  signalBase = 1;
  sessionNote = '';
  rules: string[] = [];

  constructor() {
    this.balance = this.loadBalance();
    this.sub = this.route.paramMap.subscribe((p) => {
      const g = getGame(p.get('game'));
      if (!g) {
        this.router.navigateByUrl('/lobby');
        return;
      }
      this.game = g;
      this.rules = RULES[g.id] ?? [];
      this.dealer = dealerFor(g.id);
      this.newSignals(null);
      this.history = [];
      this.startRound();
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.clearTimers();
  }

  /* ---------------- Round loop ---------------- */

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    clearInterval(this.ticker);
  }

  private startRound() {
    this.clearTimers();
    this.phase = 'betting';
    this.outcome = null;
    this.roundNet = null;
    this.bets = {};
    this.cardsShown = [];
    this.crapsRolls = [];
    this.crapsPoint = 0;
    this.ballSettled = false;
    this.left = this.betSeconds;
    this.say('Place your bets, please');
    const end = Date.now() + this.betSeconds * 1000;
    this.ticker = setInterval(() => {
      this.left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (this.left === 5) this.say('Last bets…');
      if (this.left <= 0) {
        clearInterval(this.ticker);
        this.closeBets();
      }
    }, 200);
  }

  /** Player is ready before the timer ends. */
  dealNow() {
    if (this.phase !== 'betting') return;
    clearInterval(this.ticker);
    this.closeBets();
  }

  private closeBets() {
    this.phase = 'closing';
    this.say('No more bets');
    this.later(1200, () => this.deal());
  }

  private deal() {
    this.phase = 'dealing';
    const o = this.game.play();
    let ms = 3500;
    switch (this.game.id) {
      case 'roulette': ms = this.spin(o); break;
      case 'baccarat': ms = this.dealBaccarat(o); break;
      case 'dragon-tiger': ms = this.dealDragonTiger(o); break;
      case 'sicbo': ms = this.shake(o); break;
      case 'craps': ms = this.rollCraps(o); break;
    }
    this.later(ms, () => this.settle(o));
  }

  private settle(o: Outcome) {
    this.phase = 'result';
    this.outcome = o;
    this.history = [o, ...this.history].slice(0, 60);
    let net = 0;
    for (const [betId, stake] of Object.entries(this.bets)) net += stake * this.game.settle(betId, o);
    net = round2(net);
    const staked = Object.values(this.bets).reduce((a, b) => a + b, 0);
    this.roundNet = staked ? net : null;
    if (staked) {
      this.setBalance(this.balance + net);
      this.lastBets = { ...this.bets };
    }
    this.say(this.announce(o) + (net > 0 ? ' – congratulations!' : ''));
    this.advanceSignals(o);
    this.round++;
    this.later(4000, () => this.startRound());
  }

  /* ---------------- Game animations ---------------- */

  private spin(o: Outcome): number {
    const n = o.data.n as number;
    const i = WHEEL.indexOf(n);
    const step = 360 / WHEEL.length;
    // Wheel turns clockwise several times and stops with the winning pocket at the top; the ball runs the other way.
    const base = Math.ceil(this.wheelDeg / 360) * 360;
    this.wheelDeg = base + 5 * 360 - i * step;
    this.ballDeg = this.ballDeg - 8 * 360 - (((this.ballDeg % 360) + 360) % 360);
    this.say('Spinning…');
    this.later(5200, () => (this.ballSettled = true));
    return 5600;
  }

  wheelPockets = WHEEL.map((n, i) => ({
    n,
    angle: (i * 360) / WHEEL.length,
    tone: n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black',
  }));

  private dealBaccarat(o: Outcome): number {
    const p: Card[] = o.data.player;
    const b: Card[] = o.data.banker;
    const order: { who: 'P' | 'B'; card: Card }[] = [
      { who: 'P', card: p[0] }, { who: 'B', card: b[0] }, { who: 'P', card: p[1] }, { who: 'B', card: b[1] },
    ];
    if (p[2]) order.push({ who: 'P', card: p[2] });
    if (b[2]) order.push({ who: 'B', card: b[2] });
    order.forEach((c, k) => this.later(700 + k * 850, () => (this.cardsShown = [...this.cardsShown, c])));
    return 900 + order.length * 850;
  }

  private dealDragonTiger(o: Outcome): number {
    this.later(700, () => (this.cardsShown = [{ who: 'D', card: o.data.dragon }]));
    this.later(1600, () => (this.cardsShown = [...this.cardsShown, { who: 'T', card: o.data.tiger }]));
    return 2400;
  }

  private shake(o: Outcome): number {
    this.shaking = true;
    const t = setInterval(() => (this.dice = [1 + ((Math.random() * 6) | 0), 1 + ((Math.random() * 6) | 0), 1 + ((Math.random() * 6) | 0)]), 90);
    this.timers.push(t as any);
    this.later(2600, () => {
      clearInterval(t);
      this.shaking = false;
      this.dice = o.data.dice;
    });
    return 3000;
  }

  private rollCraps(o: Outcome): number {
    const rolls: [number, number][] = o.data.rolls;
    const shown = rolls.slice(-8);
    shown.forEach((r, k) =>
      this.later(600 + k * 900, () => {
        this.crapsRolls = [...this.crapsRolls, r];
        if (k === 0 && rolls.length > 1) this.crapsPoint = o.data.point;
        this.say(k === 0 ? `Come-out roll: ${r[0] + r[1]}` : `${r[0] + r[1]}`);
      })
    );
    return 900 + shown.length * 900;
  }

  /* ---------------- Betting ---------------- */

  place(betId: string, amount = this.chip) {
    if (this.phase !== 'betting') return;
    if (this.totalBet + amount > this.balance + 1e-9) {
      this.say('Not enough chips – top up your balance');
      return;
    }
    this.bets = { ...this.bets, [betId]: round2((this.bets[betId] || 0) + amount) };
  }

  clearBets() {
    if (this.phase === 'betting') this.bets = {};
  }

  rebet() {
    if (this.phase !== 'betting') return;
    const total = Object.values(this.lastBets).reduce((a, b) => a + b, 0);
    if (total && total <= this.balance) this.bets = { ...this.lastBets };
  }

  /** One tap: place exactly what the signal says. */
  followSignal() {
    const s = this.signal;
    if (!s || this.phase !== 'betting' || s.stake <= 0) return;
    this.bets = {};
    this.place(s.betId, s.stake);
  }

  get totalBet() {
    return round2(Object.values(this.bets).reduce((a, b) => a + b, 0));
  }

  resetBalance() {
    this.setBalance(START_BALANCE);
  }

  /* ---------------- Signals ---------------- */

  private newSignals(last: string | null) {
    // Practice tables have $1 chips and a $1 minimum: the ladder in whole chips (3, 5, 8, 12 ...).
    this.signalBase = smallestUnit({ minBet: 1, chip: this.chips[0] });
    const amount = this.signalBase * NEURAL_BANKROLL_UNITS * 2;
    this.engine = new SignalEngine(this.game, 'neural', this.signalBase,
      Math.round(amount * SESSION_LIMITS.targetShare), Math.round(amount * SESSION_LIMITS.safetyShare));
    this.engine.start(last);
    this.sessionNote = '';
  }

  get signal() {
    return this.engine && this.game.sides ? this.engine.signal() : null;
  }

  private advanceSignals(o: Outcome) {
    if (!this.engine || !this.game.sides) return;
    this.engine.applyOutcome(o);
    const hit = this.engine.check();
    if (hit === 'change-table') {
      this.sessionNote = `3 misses in a row – fresh table: in real play move to another table. The ladder starts again at 1.5.`;
      this.engine.changeTable(sideOf(this.game, o));
    } else if (hit) {
      const n = this.engine.net;
      this.sessionNote = hit === 'stop-win' || (hit === 'profit-lock' && n > 0)
        ? `In real play: CASH OUT now (${n > 0 ? '+' : ''}${n}). Practice continues with a fresh session.`
        : `In real play: session complete (${n}). Practice continues with a fresh session.`;
      this.newSignals(sideOf(this.game, o));
    }
  }

  get coachTip(): string {
    const s = this.signal;
    if (!this.training) return '';
    switch (this.phase) {
      case 'betting':
        if (!s) return 'Pick a bet and a chip, then wait for the dealer.';
        if (this.bets[s.betId] === s.stake && Object.keys(this.bets).length === 1) return `Perfect – exactly the signal. Now wait for "No more bets".`;
        return `The signal says ${s.betLabel} ${s.stake}. Tap "Follow the signal" or place it yourself before the timer ends.`;
      case 'closing':
        return 'Bets are closed – hands off. This is where discipline starts.';
      case 'dealing':
        return 'Watch the result. Never add a bet you did not plan.';
      default:
        return this.roundNet === null ? 'No bet this round – that is fine. Wait for your signal.' :
          this.roundNet > 0 ? 'Win! The ladder steps down – the next bet gets smaller.' :
          this.roundNet < 0 ? 'Miss. The ladder steps up one – follow the next signal calmly.' : 'Push – your stake comes back.';
    }
  }

  /* ---------------- View helpers ---------------- */

  private say(text: string) {
    this.line = text;
  }

  private announce(o: Outcome): string {
    switch (this.game.id) {
      case 'roulette': {
        const n = o.data.n;
        return n === 0 ? 'Zero, green' : `${n} ${RED_NUMBERS.has(n) ? 'red' : 'black'}`;
      }
      case 'baccarat': return o.data.winner === 'T' ? `Tie, ${o.data.pt} all` : `${o.data.winner === 'P' ? 'Player' : 'Banker'} wins, ${Math.max(o.data.pt, o.data.bt)} over ${Math.min(o.data.pt, o.data.bt)}`;
      case 'dragon-tiger': return o.data.winner === 'X' ? 'Tie' : `${o.data.winner === 'D' ? 'Dragon' : 'Tiger'} wins`;
      case 'sicbo': return o.data.triple ? `Triple ${o.data.dice[0]}!` : `${o.data.total}, ${o.data.total <= 10 ? 'small' : 'big'}`;
      case 'craps': return o.data.winner === 'pass' ? 'Pass Line wins' : o.data.winner === 'dontpass' ? "Don't Pass wins" : '12 – bar';
      default: return o.text;
    }
  }

  cardsOf(who: string) {
    return this.cardsShown.filter((c) => c.who === who).map((c) => c.card);
  }

  /** Running baccarat total of the cards on the table. */
  total(who: 'P' | 'B'): number {
    return this.cardsOf(who).reduce((a, c) => (a + (c.rank >= 10 ? 0 : c.rank)) % 10, 0);
  }

  isRed(c: Card) {
    return isRedSuit(c.suit);
  }

  betLabel(id: string) {
    return getBet(this.game, id)?.label ?? id;
  }

  betTone(id: string) {
    const map: Record<string, string> = {
      player: 'blue', banker: 'red', tie: 'green', dragon: 'red', tiger: 'blue', red: 'red', black: 'black',
      small: 'blue', big: 'red', pass: 'blue', dontpass: 'red', triple: 'gold',
    };
    return map[id] || 'gold';
  }

  get ringOffset(): number {
    const c = 2 * Math.PI * 22;
    return c * (1 - this.left / this.betSeconds);
  }

  phaseLabel(): string {
    return { betting: 'PLACE YOUR BETS', closing: 'NO MORE BETS', dealing: this.game.id === 'roulette' ? 'SPINNING' : 'DEALING', result: 'RESULT' }[this.phase];
  }

  trackIdx = (i: number) => i;

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
}

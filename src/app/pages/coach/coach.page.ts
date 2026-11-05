import { Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Timestamp } from '@angular/fire/firestore';
import { firstValueFrom, filter } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { StopSignComponent } from '../../shared/stop-sign.component';
import { ConfettiComponent } from '../../shared/confetti.component';
import { NeuralFieldComponent } from '../../shared/neural-field.component';
import { AccountService } from '../../core/account.service';
import { EndReason, SessionsService } from '../../core/sessions.service';
import { GAMES, GameDef, getBet, getGame, pct } from '../../core/games';
import { SESSION_LIMITS, SessionPlan, planSession, round2, simulate } from '../../core/strategies';
import { SYSTEMS, Signal, SignalEngine, SignalEvent, StopReason, SystemId, VOID_RESULT } from '../../core/signals';

type Stage = 'checking' | 'locked' | 'excluded' | 'setup' | 'first' | 'live' | 'newtable' | 'done';

interface LiveState {
  v: 2;
  uid: string;
  casino: string;
  system: SystemId;
  plan: SessionPlan;
  startedAt: number;
  nextCheckinAt: number;
  events: SignalEvent[];
}

interface Bead {
  side: string | null;
  tone: string;
  label: string;
  mark: 'won' | 'lost' | 'void' | 'seed';
}

const LIVE_KEY = 'tw.liveSession';
const MIN = 60_000;

/** Colour of each side's disc / bead. */
export const SIDE_TONE: Record<string, string> = {
  red: 'red', black: 'black', banker: 'red', player: 'blue', dragon: 'red', tiger: 'blue',
  small: 'blue', big: 'red', low: 'blue', high: 'red',
};

@Component({
  selector: 'app-coach',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, NgFor, NgClass, DecimalPipe, DatePipe,
    TopbarComponent, StopSignComponent, ConfettiComponent, NeuralFieldComponent],
  templateUrl: './coach.page.html',
  styleUrls: ['./coach.page.scss'],
})
export class CoachPage implements OnDestroy {
  @ViewChild(NeuralFieldComponent) field?: NeuralFieldComponent;
  private account = inject(AccountService);
  private sessions = inject(SessionsService);

  stage: Stage = 'checking';
  excludedUntil: Date | null = null;
  uid = '';

  games = GAMES;
  systems = SYSTEMS;
  limits = SESSION_LIMITS;
  pct = pct;
  quickAmounts = [100, 200, 500, 1000];

  gameId = 'roulette';
  system: SystemId = 'original';
  casino = '';
  casinoSuggestions = ['Evolution live tables', 'Ezugi', 'Pragmatic Play Live', 'Playtech Live', 'Other online casino', 'Land-based casino'];
  bankroll: number | null = null;
  minutes = SESSION_LIMITS.defaultMinutes;
  pledge = false;
  afford = false;

  live: LiveState | null = null;
  engine: SignalEngine | null = null;
  remaining = 0;
  endReason: EndReason | null = null;
  saveError = '';
  stopSign: 'final' | 'checkin' | 'table' | null = null;
  /** Short "+8" / "-4" pop after each round. */
  flash: { id: number; text: string; kind: 'won' | 'lost' | 'void' } | null = null;
  private flashTimer: any;
  /** Short "reading the table" phase between a result and the next signal. */
  thinking = false;
  private thinkTimer: any;
  /** Animated (counting) bet amount shown in the signal. */
  shownStake = 0;
  private countRaf = 0;
  private tick: any;
  private costCache = new Map<string, number>();

  constructor() {
    try {
      this.casino = localStorage.getItem('tw.lastCasino') || '';
    } catch {}
    this.init();
  }

  ngOnDestroy() {
    clearInterval(this.tick);
    clearTimeout(this.flashTimer);
    clearTimeout(this.thinkTimer);
    cancelAnimationFrame(this.countRaf);
  }

  private async init() {
    const user = await firstValueFrom(this.account.user$.pipe(filter((u) => !!u)));
    this.uid = user!.uid;
    const access = await firstValueFrom(this.account.access$);
    if (access.selfExcludedUntil) {
      this.excludedUntil = access.selfExcludedUntil;
      this.stage = 'excluded';
      return;
    }
    const saved = this.restore();
    if (saved && saved.v === 2 && saved.uid === this.uid && Date.now() > saved.startedAt + saved.plan.minutes * MIN + 60_000) {
      // A session left open from an earlier visit: close it quietly instead of greeting the player with STOP.
      this.live = saved;
      this.engine = SignalEngine.replay(this.makeEngine(saved), saved.events);
      if (this.engine.rounds.length) await this.finish('time', true);
      else this.clearPersisted();
      this.live = null;
      this.engine = null;
      this.stage = (await this.sessions.playedToday(this.uid)) ? 'locked' : 'setup';
      return;
    }
    if (saved && saved.v === 2 && saved.uid === this.uid) {
      this.live = saved;
      this.engine = SignalEngine.replay(this.makeEngine(saved), saved.events);
      this.stage = saved.events.length ? 'live' : 'first';
      this.countTo(this.engine.signal().stake);
      this.startTimer();
      return;
    }
    this.stage = (await this.sessions.playedToday(this.uid)) ? 'locked' : 'setup';
  }

  /* ================= Setup ================= */

  get game(): GameDef {
    return getGame(this.gameId)!;
  }

  get plan(): SessionPlan | null {
    if (!this.bankroll || this.bankroll < 10) return null;
    return planSession(this.game, this.bankroll, this.minutes);
  }

  sidesLabel(g: GameDef): string {
    if (this.system === 'original' && g.sides) return g.sides.map((id) => getBet(g, id)!.label).join(' or ');
    return getBet(g, g.bestBet)!.label;
  }

  expectedCost(p: SessionPlan): number {
    const key = `${p.gameId}|${p.bankroll}|${p.minutes}|${this.system}`;
    if (!this.costCache.has(key)) {
      const r = simulate({
        game: this.game, betId: this.game.bestBet, strategy: this.system, bankroll: p.bankroll, unit: p.unit,
        stopWin: p.stopWin, stopLoss: p.stopLoss, rounds: p.maxRounds, sessions: 3000,
      });
      this.costCache.set(key, round2(r.expectedCost));
    }
    return this.costCache.get(key)!;
  }

  start() {
    const plan = this.plan;
    if (!plan || !this.pledge || !this.afford) return;
    const casino = this.casino.trim().slice(0, 80) || 'Unspecified';
    try {
      localStorage.setItem('tw.lastCasino', casino);
    } catch {}
    const now = Date.now();
    this.live = { v: 2, uid: this.uid, casino, system: this.system, plan, startedAt: now,
      nextCheckinAt: now + SESSION_LIMITS.checkinMinutes * MIN, events: [] };
    this.engine = this.makeEngine(this.live);
    this.endReason = null;
    this.stopSign = null;
    this.persist();
    this.stage = 'first';
    this.startTimer();
  }

  private makeEngine(l: LiveState) {
    return new SignalEngine(getGame(l.plan.gameId)!, l.system, l.plan.unit, l.plan.stopWin, l.plan.stopLoss);
  }

  /* ================= Table ================= */

  get liveGame(): GameDef {
    return getGame(this.live!.plan.gameId)!;
  }

  /** The two sides + the zero/tie button, in board order. */
  get choices(): { id: string | null; label: string; tone: string }[] {
    const g = this.liveGame;
    const v = VOID_RESULT[g.id];
    const sides = (g.sides ?? [g.bestBet]).map((id) => ({ id, label: getBet(g, id)!.label, tone: SIDE_TONE[id] || 'gold' }));
    return [sides[0], { id: null, label: v.label, tone: 'green' }, ...sides.slice(1)];
  }

  /** First result at a (new) table: the pattern starts from it. */
  begin(side: string | null) {
    if (!this.live || !this.engine) return;
    const isNewTable = this.stage === 'newtable';
    this.live.events.push({ t: 'start', side });
    if (isNewTable) this.engine.changeTable(side);
    else this.engine.start(side);
    this.persist();
    this.stage = 'live';
    this.stopSign = null;
    this.reveal();
  }

  get signal(): Signal | null {
    return this.engine ? this.engine.signal() : null;
  }

  get net(): number {
    return this.engine?.net ?? 0;
  }

  get roundsPlayed(): number {
    return this.engine?.rounds.length ?? 0;
  }

  get wins(): number {
    return (this.engine?.rounds ?? []).filter((r) => r.result === 'won').length;
  }

  /** What came: record it, show the next bet, then apply the discipline rules. */
  came(side: string | null) {
    if (!this.live || !this.engine || this.stage !== 'live' || this.stopSign || this.thinking) return;
    this.live.events.push({ t: 'round', side });
    const r = this.engine.applySide(side);
    this.persist();
    this.pop(r.net > 0 ? `+${r.net}` : r.net < 0 ? `${r.net}` : 'Push', r.result === 'won' ? 'won' : r.net < 0 ? 'lost' : 'void');
    this.buzz(r.result === 'won' ? 20 : r.net < 0 ? [40, 60, 40] : 10);

    const hit = this.engine.check();
    if (hit === 'change-table') {
      this.stopSign = 'table';
    } else if (hit) {
      this.finish(hit);
    } else if (this.roundsPlayed >= this.live.plan.maxRounds) {
      this.finish('rounds');
    } else {
      this.reveal();
    }
  }

  /** "Reading the table" for a moment, then show the next signal with a pulse and a counting amount. */
  private reveal() {
    clearTimeout(this.thinkTimer);
    this.thinking = true;
    this.thinkTimer = setTimeout(() => {
      this.thinking = false;
      this.field?.pulse();
      this.countTo(this.signal?.stake ?? 0);
    }, 750);
  }

  private countTo(target: number) {
    cancelAnimationFrame(this.countRaf);
    const from = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      const e = 1 - Math.pow(1 - k, 3);
      this.shownStake = Math.round((from + (target - from) * e) * 100) / 100;
      if (k < 1) this.countRaf = requestAnimationFrame(step);
    };
    this.countRaf = requestAnimationFrame(step);
  }

  undo() {
    if (!this.live || this.stage !== 'live') return;
    const i = this.live.events.map((e) => e.t).lastIndexOf('round');
    if (i < 0) return;
    this.live.events.splice(i, 1);
    this.engine = SignalEngine.replay(this.makeEngine(this.live), this.live.events);
    this.persist();
  }

  /** Player chose to move to a new table after 3 losses. */
  moveTable() {
    this.stopSign = null;
    this.stage = 'newtable';
  }

  /* ---------- Percentages (all relative to today's amount) ---------- */

  pctOf(v: number): number {
    const b = this.live?.plan.bankroll || 1;
    return Math.round((v / b) * 1000) / 10;
  }

  get pnlPct(): number {
    return this.pctOf(this.net);
  }

  get betPct(): number {
    return this.pctOf(this.signal?.stake ?? 0);
  }

  /** Progress towards the profit target, 0–100. */
  get targetPct(): number {
    if (!this.live) return 0;
    return Math.max(0, Math.min(100, Math.round((this.net / this.live.plan.stopWin) * 100)));
  }

  /** Share of the safety limit already used, 0–100. */
  get riskPct(): number {
    if (!this.live) return 0;
    return Math.max(0, Math.min(100, Math.round((-this.net / this.live.plan.stopLoss) * 100)));
  }

  get winRate(): number {
    const r = (this.engine?.rounds ?? []).filter((x) => x.result !== 'void');
    return r.length ? Math.round((r.filter((x) => x.result === 'won').length / r.length) * 100) : 0;
  }

  modeName(m: string): string {
    return m === 'ATTACK' ? 'Momentum' : m === 'RETRENCH' ? 'Recovery' : '';
  }

  private pop(text: string, kind: 'won' | 'lost' | 'void') {
    clearTimeout(this.flashTimer);
    this.flash = { id: Date.now(), text, kind };
    this.flashTimer = setTimeout(() => (this.flash = null), 1100);
  }

  private buzz(pattern: number | number[]) {
    try {
      navigator.vibrate?.(pattern);
    } catch {}
  }

  /* ---------- Board ---------- */

  /** Results at the current table, newest last, for the scoreboard road. */
  get beads(): Bead[] {
    if (!this.live || !this.engine) return [];
    const g = this.liveGame;
    const out: Bead[] = [];
    let roundIdx = 0;
    for (const e of this.live.events) {
      if (e.t === 'start') {
        out.length = 0;
        if (e.side) out.push(this.bead(g, e.side, 'seed'));
      } else {
        const r = this.engine.rounds[roundIdx++];
        out.push(this.bead(g, e.side, r ? r.result : 'void'));
      }
    }
    return out;
  }

  private bead(g: GameDef, side: string | null, mark: Bead['mark']): Bead {
    if (side === null) return { side, tone: 'green', label: VOID_RESULT[g.id].short, mark };
    return { side, tone: SIDE_TONE[side] || 'gold', label: getBet(g, side)!.label.charAt(0), mark };
  }

  /** Scoreboard columns of 6 slots, like a casino road (null = empty slot). */
  get road(): (Bead | null)[][] {
    const b = this.beads;
    const n = Math.max(24, Math.ceil((b.length + 1) / 6) * 6 + 6);
    const cols: (Bead | null)[][] = [];
    for (let i = 0; i < n; i += 6) cols.push(Array.from({ length: 6 }, (_, j) => b[i + j] ?? null));
    return cols;
  }

  /* ---------- Discipline display ---------- */

  get inProfitMode(): boolean {
    return !!this.engine?.inBigProfit;
  }

  get streakLimit(): number {
    return this.inProfitMode ? SESSION_LIMITS.profitLockLosses : SESSION_LIMITS.changeTableLosses;
  }

  get lights(): boolean[] {
    const s = this.engine?.streak ?? 0;
    return Array.from({ length: this.streakLimit }, (_, i) => i < s);
  }

  /** 0..100 position of the result between max loss (0) and profit target (100). */
  get meter(): number {
    if (!this.live) return 50;
    const { stopLoss, stopWin } = this.live.plan;
    return Math.max(0, Math.min(100, ((this.net + stopLoss) / (stopLoss + stopWin)) * 100));
  }

  get zeroAt(): number {
    if (!this.live) return 50;
    const { stopLoss, stopWin } = this.live.plan;
    return (stopLoss / (stopLoss + stopWin)) * 100;
  }

  /** Chips in the animated stack for the current bet. */
  get chipStack(): number[] {
    const s = this.signal;
    if (!s || !this.live) return [];
    const n = Math.max(1, Math.min(14, Math.round((s.stake / this.live.plan.unit) * 2)));
    return Array.from({ length: n }, (_, i) => i);
  }

  get toneOfBet(): string {
    return SIDE_TONE[this.signal?.betId ?? ''] || 'gold';
  }

  get hint(): string {
    if (!this.live || !this.engine || !this.signal) return '';
    const p = this.live.plan;
    const left = p.maxRounds - this.roundsPlayed;
    if (this.signal.capped) return `Bet capped at ${this.signal.stake} – that's all that's left before your maximum loss.`;
    if (left <= 3) return `${left} round${left === 1 ? '' : 's'} left in this session.`;
    if (this.inProfitMode && this.engine.streak === 1) return `Strong profit. Protect it – the coach is watching the next result.`;
    if (!this.inProfitMode && this.engine.streak === 2) return 'Stay calm. Follow the signal – the coach will tell you if this table turns cold.';
    if (this.signal.mode === 'RETRENCH') return 'Recovery in progress. Stick to the amount shown.';
    if (this.net > 0) return `${this.targetPct}% of the way to your profit target.`;
    return 'Place this bet, wait for the result, then tap what came.';
  }

  /* ---------- Timer ---------- */

  private startTimer() {
    clearInterval(this.tick);
    const update = () => {
      if (!this.live || (this.stage !== 'live' && this.stage !== 'first' && this.stage !== 'newtable')) return;
      const now = Date.now();
      const end = this.live.startedAt + this.live.plan.minutes * MIN;
      this.remaining = Math.max(0, Math.round((end - now) / 1000));
      if (this.remaining === 0) {
        this.finish('time');
      } else if (this.stage === 'live' && now >= this.live.nextCheckinAt && !this.stopSign) {
        this.live.nextCheckinAt = now + SESSION_LIMITS.checkinMinutes * MIN;
        this.persist();
        this.stopSign = 'checkin';
      }
    };
    update();
    this.tick = setInterval(update, 1000);
  }

  get clock(): string {
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Stroke offset for the timer ring (circumference 2πr, r = 26). */
  get ringOffset(): number {
    if (!this.live) return 0;
    const c = 2 * Math.PI * 26;
    return c * (1 - this.remaining / (this.live.plan.minutes * 60));
  }

  /* ---------- STOP signs ---------- */

  get checkinReason(): string {
    return this.net > 0 ? "Time check – you're up." : this.net < 0 ? "Time check – you're down." : 'Time check.';
  }

  get checkinHint(): string {
    const mins = Math.ceil(this.remaining / 60);
    if (this.net > 0) return 'The best moment to leave is while you are ahead. Stopping now keeps this profit.';
    if (this.net < 0) return `Don't chase it. Stopping now keeps the loss small. If you continue, your limits stay on (${mins} min left).`;
    return `Take a breath. Stop now, or continue for up to ${mins} more minutes.`;
  }

  get finalReason(): string {
    switch (this.endReason) {
      case 'stop-win': return 'Profit target reached.';
      case 'profit-lock': return 'Two losses in a row after a profit.';
      case 'stop-loss': return 'Maximum loss reached.';
      case 'change-table': return 'Three losses in a row.';
      case 'time': return 'Time is up.';
      case 'rounds': return 'Round limit reached.';
      default: return 'Session over.';
    }
  }

  get finalTitle(): string {
    return this.net > 0 ? 'STOP & CASH OUT' : 'STOP PLAYING NOW';
  }

  get finalHint(): string {
    if (this.net > 0) return `You're up ${this.pnlPct}% on your amount. Cash out and close the casino tab now – this is how profit is kept.`;
    return 'Close the casino tab now. No switching tables, no starting again – the coach is locked until tomorrow.';
  }

  get endTitle(): string {
    switch (this.endReason) {
      case 'stop-win': return 'Target hit. You left a winner.';
      case 'profit-lock': return this.net > 0 ? 'Profit kept. Well played.' : 'Session closed.';
      case 'stop-loss': return 'Maximum loss reached. Today is done.';
      case 'change-table': return 'Session ended after 3 losses.';
      case 'time': return 'Time is up.';
      case 'rounds': return 'Round limit reached.';
      case 'checkin': return 'You stopped at the check-in. Good call.';
      default: return 'Session ended.';
    }
  }

  continuePlaying() {
    this.stopSign = null;
  }

  async finish(reason: EndReason, quiet = false) {
    if (!this.live || this.stage === 'done') return;
    clearInterval(this.tick);
    clearTimeout(this.thinkTimer);
    this.thinking = false;
    this.endReason = reason;
    if (!quiet) {
      this.stage = 'done';
      this.stopSign = reason === 'manual' || reason === 'checkin' ? null : 'final';
    }
    const p = this.live.plan;
    const rounds = this.engine?.rounds ?? [];
    try {
      await this.sessions.save(this.uid, {
        gameId: p.gameId,
        betId: this.live.system === 'original' ? 'signals' : p.betId,
        system: this.live.system,
        casino: this.live.casino || 'Unspecified',
        bankroll: p.bankroll,
        unit: p.unit,
        stopWin: p.stopWin,
        stopLoss: p.stopLoss,
        minutes: p.minutes,
        rounds: rounds.map((r) => ({ stake: r.stake, net: r.net, betId: r.betId, result: r.result })),
        net: this.net,
        endReason: reason,
        startedAt: Timestamp.fromMillis(this.live.startedAt),
        endedAt: Timestamp.now(),
      });
      this.clearPersisted();
    } catch {
      this.saveError = 'Could not save this session (are you offline?). It will stay on this device.';
    }
  }

  newSession() {
    this.live = null;
    this.engine = null;
    this.stopSign = null;
    this.stage = 'setup';
    this.init();
  }

  /* ---------- Persistence ---------- */

  private persist() {
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify(this.live));
    } catch {}
  }

  private restore(): LiveState | null {
    try {
      const raw = localStorage.getItem(LIVE_KEY);
      return raw ? (JSON.parse(raw) as LiveState) : null;
    } catch {
      return null;
    }
  }

  private clearPersisted() {
    try {
      localStorage.removeItem(LIVE_KEY);
    } catch {}
  }
}

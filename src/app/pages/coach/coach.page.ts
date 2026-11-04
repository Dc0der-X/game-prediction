import { Component, OnDestroy, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Timestamp } from '@angular/fire/firestore';
import { firstValueFrom, filter } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { StopSignComponent } from '../../shared/stop-sign.component';
import { AccountService } from '../../core/account.service';
import { EndReason, SessionsService } from '../../core/sessions.service';
import { GAMES, GameDef, getBet, getGame, pct } from '../../core/games';
import { SESSION_LIMITS, SessionPlan, TABLE_RULES, planSession, round2, simulate } from '../../core/strategies';
import { RoundResult, SYSTEMS, Signal, SignalEngine, SignalRound, SystemId, VOID_RESULT } from '../../core/signals';

type Stage = 'checking' | 'locked' | 'excluded' | 'setup' | 'live' | 'done';

interface LiveState {
  uid: string;
  casino: string;
  system: SystemId;
  plan: SessionPlan;
  startedAt: number;
  nextCheckinAt: number;
  rounds: SignalRound[];
}

const LIVE_KEY = 'tw.liveSession';
const MIN = 60_000;

@Component({
  selector: 'app-coach',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, NgFor, DecimalPipe, DatePipe, TopbarComponent, StopSignComponent],
  templateUrl: './coach.page.html',
  styleUrls: ['./coach.page.scss'],
})
export class CoachPage implements OnDestroy {
  private account = inject(AccountService);
  private sessions = inject(SessionsService);

  stage: Stage = 'checking';
  excludedUntil: Date | null = null;
  uid = '';

  games = GAMES;
  rules = TABLE_RULES;
  limits = SESSION_LIMITS;
  systems = SYSTEMS;
  pct = pct;

  gameId = 'baccarat';
  system: SystemId = 'original';
  casino = '';
  casinoSuggestions = ['Evolution live tables', 'Ezugi', 'Pragmatic Play Live', 'Playtech Live', 'Other online casino', 'Land-based casino'];
  bankroll: number | null = null;
  minutes = SESSION_LIMITS.defaultMinutes;
  affordable = false;
  promise = false;

  live: LiveState | null = null;
  engine: SignalEngine | null = null;
  remaining = 0; // seconds
  endReason: EndReason | null = null;
  saveError = '';
  /** Which STOP sign is showing, if any. */
  stopSign: 'final' | 'checkin' | null = null;
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
    if (saved && saved.uid === this.uid) {
      // Sessions saved by an older version have no system / check-in time.
      this.live = {
        ...saved,
        system: saved.system ?? 'flat',
        nextCheckinAt: saved.nextCheckinAt ?? Date.now() + SESSION_LIMITS.checkinMinutes * MIN,
      };
      this.engine = this.makeEngine(this.live);
      this.engine.replay(this.live.rounds);
      this.stage = 'live';
      this.startTimer();
      return;
    }
    this.stage = (await this.sessions.playedToday(this.uid)) ? 'locked' : 'setup';
  }

  /* ---------------- Setup ---------------- */

  get game(): GameDef {
    return getGame(this.gameId)!;
  }

  get plan(): SessionPlan | null {
    if (!this.bankroll || this.bankroll < 10) return null;
    return planSession(this.game, this.bankroll, this.minutes);
  }

  /** "Red / Black" for the signal system, or the single best bet for flat. */
  sidesLabel(g: GameDef, system: SystemId): string {
    if (system === 'original' && g.sides) return g.sides.map((id) => getBet(g, id)!.label).join(' / ');
    return getBet(g, g.bestBet)!.label;
  }

  /** Average cost of a full session with this plan – simulated once and cached. */
  expectedCost(p: SessionPlan): number {
    const key = `${p.gameId}|${p.bankroll}|${p.minutes}|${this.system}`;
    if (!this.costCache.has(key)) {
      const r = simulate({
        game: this.game,
        betId: this.game.bestBet,
        strategy: this.system,
        bankroll: p.bankroll,
        unit: p.unit,
        stopWin: p.stopWin,
        stopLoss: p.stopLoss,
        rounds: p.maxRounds,
        sessions: 3000,
      });
      this.costCache.set(key, round2(r.expectedCost));
    }
    return this.costCache.get(key)!;
  }

  start() {
    const plan = this.plan;
    if (!plan || !this.affordable || !this.promise) return;
    const casino = this.casino.trim().slice(0, 80) || 'Unspecified';
    try {
      localStorage.setItem('tw.lastCasino', casino);
    } catch {}
    const now = Date.now();
    this.live = {
      uid: this.uid,
      casino,
      system: this.system,
      plan,
      startedAt: now,
      nextCheckinAt: now + SESSION_LIMITS.checkinMinutes * MIN,
      rounds: [],
    };
    this.engine = this.makeEngine(this.live);
    this.endReason = null;
    this.stopSign = null;
    this.persist();
    this.stage = 'live';
    this.startTimer();
  }

  private makeEngine(l: LiveState) {
    return new SignalEngine(getGame(l.plan.gameId)!, l.system, l.plan.unit, l.plan.stopWin, l.plan.stopLoss);
  }

  /* ---------------- Live ---------------- */

  get net(): number {
    return round2((this.live?.rounds ?? []).reduce((a, r) => a + r.net, 0));
  }

  get signal(): Signal | null {
    return this.engine ? this.engine.signal(this.net) : null;
  }

  /** 0..100 position of the P&L between stop-loss (0) and stop-win (100). */
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

  get liveGame(): GameDef {
    return getGame(this.live!.plan.gameId)!;
  }

  get voidLabel(): string {
    return VOID_RESULT[this.liveGame.id].label;
  }

  get detail(): string {
    if (!this.live || !this.signal) return '';
    const p = this.live.plan;
    const n = this.live.rounds.length;
    const left = p.maxRounds - n;
    const toWin = round2(p.stopWin - this.net);
    const toLoss = round2(p.stopLoss + this.net);
    if (left <= 3) return `${left} round${left === 1 ? '' : 's'} left in this session.`;
    if (this.signal.capped) return `Bet capped at ${this.signal.stake} – that is all that's left before your loss limit.`;
    if (this.signal.mode === 'RETRENCH') return `Recovery mode. Stop at -${p.stopLoss}: ${toLoss} left before the loss limit.`;
    if (this.signal.mode === 'ATTACK' && n) return `Attack mode. ${toWin} more to your +${p.stopWin} target, then STOP.`;
    return `Round ${n + 1} of ${p.maxRounds}. Place it, wait for the result, then tap below.`;
  }

  record(result: RoundResult) {
    if (!this.live || !this.engine || this.stage !== 'live' || this.stopSign) return;
    const round = this.engine.apply(result, this.net);
    this.live.rounds.push(round);
    this.persist();
    const hit = this.engine.stopReason(this.net);
    if (hit) this.finish(hit);
    else if (this.live.rounds.length >= this.live.plan.maxRounds) this.finish('rounds');
  }

  undo() {
    if (!this.live || !this.engine || this.stage !== 'live') return;
    this.live.rounds.pop();
    this.engine.replay(this.live.rounds);
    this.persist();
  }

  private startTimer() {
    clearInterval(this.tick);
    const update = () => {
      if (!this.live || this.stage !== 'live') return;
      const now = Date.now();
      const end = this.live.startedAt + this.live.plan.minutes * MIN;
      this.remaining = Math.max(0, Math.round((end - now) / 1000));
      if (this.remaining === 0) {
        this.finish('time');
      } else if (now >= this.live.nextCheckinAt && !this.stopSign) {
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

  /* ---------------- STOP sign ---------------- */

  get checkinReason(): string {
    if (this.net > 0) return `Time check – you're up.`;
    if (this.net < 0) return `Time check – you're down.`;
    return 'Time check.';
  }

  get checkinHint(): string {
    const mins = Math.ceil(this.remaining / 60);
    if (this.net > 0) return 'The best moment to leave is while you are ahead. Stopping now keeps this result.';
    if (this.net < 0)
      return `Don't chase it. Stopping now keeps the loss small. If you continue, every bet stays capped at your limit (${mins} min left).`;
    return `Take a breath. Stop now, or continue for up to ${mins} more minutes.`;
  }

  continuePlaying() {
    this.stopSign = null;
  }

  /** Ends the session (limit, timer, check-in or manual) and saves it. */
  async finish(reason: EndReason) {
    if (!this.live || this.stage !== 'live') return;
    clearInterval(this.tick);
    this.endReason = reason;
    this.stage = 'done';
    // A limit, the timer or the round cap shows the big STOP sign.
    this.stopSign = reason === 'manual' || reason === 'checkin' ? null : 'final';
    const p = this.live.plan;
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
        rounds: this.live.rounds.map((r) => ({ stake: r.stake, net: r.net, betId: r.betId, result: r.result })),
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

  get finalReason(): string {
    switch (this.endReason) {
      case 'stop-win': return 'Win target reached.';
      case 'stop-loss': return 'Loss limit reached.';
      case 'time': return 'Time is up.';
      case 'rounds': return 'Round limit reached.';
      default: return 'Session over.';
    }
  }

  get finalHint(): string {
    return this.endReason === 'stop-win'
      ? 'Leave the table now and keep it. Close the casino tab – no "one more round".'
      : 'Close the casino tab now. No switching tables, no starting again – the coach is locked until tomorrow.';
  }

  get endTitle(): string {
    switch (this.endReason) {
      case 'stop-win': return 'STOP. Target reached – you left a winner.';
      case 'stop-loss': return 'STOP. Loss limit reached – today is done.';
      case 'time': return 'STOP. Time is up.';
      case 'rounds': return 'STOP. Round limit reached.';
      case 'checkin': return 'You stopped at the check-in. Good call.';
      default: return 'Session ended.';
    }
  }

  /* ---------------- Persistence (survives refresh) ---------------- */

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

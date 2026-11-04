import { Component, OnDestroy, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Timestamp } from '@angular/fire/firestore';
import { firstValueFrom, filter } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { AccountService } from '../../core/account.service';
import { EndReason, RoundEntry, SessionsService } from '../../core/sessions.service';
import { GAMES, GameDef, getGame, pct } from '../../core/games';
import { SESSION_LIMITS, SessionPlan, TABLE_RULES, planSession, round2 } from '../../core/strategies';

type Stage = 'checking' | 'locked' | 'excluded' | 'setup' | 'live' | 'done';

interface LiveState {
  uid: string;
  casino: string;
  plan: SessionPlan;
  startedAt: number;
  rounds: RoundEntry[];
}

const LIVE_KEY = 'tw.liveSession';

@Component({
  selector: 'app-coach',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, NgFor, DecimalPipe, DatePipe, TopbarComponent],
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
  pct = pct;

  gameId = 'baccarat';
  casino = '';
  casinoSuggestions = ['Evolution live tables', 'Ezugi', 'Pragmatic Play Live', 'Playtech Live', 'Other online casino', 'Land-based casino'];
  bankroll: number | null = null;
  minutes = SESSION_LIMITS.defaultMinutes;
  affordable = false;
  promise = false;

  live: LiveState | null = null;
  remaining = 0; // seconds
  endReason: EndReason | null = null;
  saveError = '';
  private tick: any;

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
      this.live = saved;
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

  start() {
    const plan = this.plan;
    if (!plan || !this.affordable || !this.promise) return;
    const casino = this.casino.trim().slice(0, 80) || 'Unspecified';
    try {
      localStorage.setItem('tw.lastCasino', casino);
    } catch {}
    this.live = { uid: this.uid, casino, plan, startedAt: Date.now(), rounds: [] };
    this.endReason = null;
    this.persist();
    this.stage = 'live';
    this.startTimer();
  }

  /* ---------------- Live ---------------- */

  get net(): number {
    return round2((this.live?.rounds ?? []).reduce((a, r) => a + r.net, 0));
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

  /** Payout for a win on the plan's bet (Banker pays 0.95). */
  get winMultiplier(): number {
    return this.live?.plan.betId === 'banker' ? 0.95 : 1;
  }

  /** What a tie does to the stake, or null if the game has no tie button. */
  get tieMultiplier(): number | null {
    const g = this.live?.plan.gameId;
    if (g === 'baccarat') return 0;
    if (g === 'dragon-tiger') return -0.5;
    return null;
  }

  record(mult: number) {
    if (!this.live || this.stage !== 'live') return;
    const stake = this.live.plan.unit;
    this.live.rounds.push({ stake, net: round2(stake * mult) });
    this.persist();
    const { stopWin, stopLoss, maxRounds } = this.live.plan;
    if (this.net >= stopWin) this.finish('stop-win');
    else if (this.net <= -stopLoss) this.finish('stop-loss');
    else if (this.live.rounds.length >= maxRounds) this.finish('rounds');
  }

  undo() {
    if (!this.live || this.stage !== 'live') return;
    this.live.rounds.pop();
    this.persist();
  }

  private startTimer() {
    clearInterval(this.tick);
    const update = () => {
      if (!this.live) return;
      const end = this.live.startedAt + this.live.plan.minutes * 60_000;
      this.remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      if (this.remaining === 0) this.finish('time');
    };
    update();
    this.tick = setInterval(update, 1000);
  }

  get clock(): string {
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async finish(reason: EndReason) {
    if (!this.live || this.stage !== 'live') return;
    clearInterval(this.tick);
    this.endReason = reason;
    this.stage = 'done';
    const p = this.live.plan;
    try {
      await this.sessions.save(this.uid, {
        gameId: p.gameId,
        betId: p.betId,
        casino: this.live.casino || 'Unspecified',
        bankroll: p.bankroll,
        unit: p.unit,
        stopWin: p.stopWin,
        stopLoss: p.stopLoss,
        minutes: p.minutes,
        rounds: this.live.rounds,
        net: this.net,
        endReason: reason,
        startedAt: Timestamp.fromMillis(this.live.startedAt),
        endedAt: Timestamp.now(),
      });
      this.clearPersisted();
    } catch (e: any) {
      this.saveError = 'Could not save this session (are you offline?). It will stay on this device.';
    }
  }

  /** The coach's current instruction, shown big on screen. */
  get instruction(): { title: string; detail: string } {
    if (!this.live) return { title: '', detail: '' };
    const p = this.live.plan;
    const n = this.live.rounds.length;
    const last = n ? this.live.rounds[n - 1].net : 0;
    const left = p.maxRounds - n;
    let detail = `Round ${n + 1} of ${p.maxRounds}. Place it, wait for the result, then tap below.`;
    if (n && last < 0) detail = 'Lost one – that is normal. Same stake again. Never raise it to win it back.';
    if (n && last > 0) detail = 'Nice. Same stake again – do not let a win push your bet up.';
    if (this.net >= p.stopWin * 0.6 && this.net < p.stopWin) detail = 'You are close to your target. Same stake – the coach will tell you when to leave.';
    if (left <= 3) detail = `${left} round${left === 1 ? '' : 's'} left in this session.`;
    return { title: `Bet ${p.unit} on ${p.betLabel}`, detail };
  }

  get endTitle(): string {
    switch (this.endReason) {
      case 'stop-win': return 'STOP. Target reached – leave the table now.';
      case 'stop-loss': return 'STOP. Loss limit reached – today is done.';
      case 'time': return 'STOP. Time is up – leave the table now.';
      case 'rounds': return 'STOP. Round limit reached – leave the table.';
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

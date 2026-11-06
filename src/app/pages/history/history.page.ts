import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { firstValueFrom, filter } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { AccountService } from '../../core/account.service';
import { RealSession, SessionsService } from '../../core/sessions.service';
import { getBet, getGame } from '../../core/games';
import { round2 } from '../../core/strategies';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [IonicModule, RouterLink, NgFor, NgIf, DatePipe, DecimalPipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page">
        <p class="tw-eyebrow">Real-money sessions</p>
        <h1 class="title">Your history</h1>

        <div *ngIf="loading" class="tw-card"><ion-spinner></ion-spinner></div>

        <div *ngIf="!loading && !sessions.length" class="tw-card">
          <h3>No sessions yet</h3>
          <p class="tw-muted">Sessions you run with the Session Coach show up here with an honest running total.</p>
          <ion-button routerLink="/coach">Plan a session</ion-button>
        </div>

        <ng-container *ngIf="!loading && sessions.length">
          <section class="wall">
            <div class="wall-main">
              <p class="tw-eyebrow">Your winnings wall</p>
              <div class="won">+{{ totalWon | number: '1.0-0' }}</div>
              <p class="tw-small">won across {{ winCount }} winning session{{ winCount === 1 ? '' : 's' }}</p>
            </div>
            <div class="trophies">
              <div><strong>{{ targetHits }}</strong><span>targets hit</span></div>
              <div><strong>+{{ best | number: '1.0-0' }}</strong><span>best session</span></div>
              <div><strong>{{ bestStreak }}</strong><span>wins in a row</span></div>
            </div>
          </section>

          <div class="tw-stats">
            <div class="tw-stat"><div class="label">Sessions</div><div class="value">{{ sessions.length }}</div></div>
            <div class="tw-stat"><div class="label">Winning sessions</div><div class="value">{{ winRate | number: '1.0-0' }}%</div></div>
            <div class="tw-stat"><div class="label">Overall result</div>
              <div class="value" [class.tw-pos]="total > 0" [class.tw-neg]="total < 0">{{ total > 0 ? '+' : '' }}{{ total | number: '1.0-2' }}</div></div>
            <div class="tw-stat"><div class="label">Total wagered</div><div class="value">{{ wagered | number: '1.0-0' }}</div></div>
            <div class="tw-stat"><div class="label">Stuck to the plan</div><div class="value">{{ discipline | number: '1.0-0' }}%</div></div>
          </div>

          <div class="tw-card chart-card">
            <p class="tw-eyebrow">Running total</p>
            <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" class="chart" role="img"
                 [attr.aria-label]="'Running total after ' + sessions.length + ' sessions: ' + total">
              <line [attr.x1]="0" [attr.x2]="W" [attr.y1]="zeroY" [attr.y2]="zeroY" class="zero" />
              <polyline [attr.points]="points" class="line" />
            </svg>
            <p class="tw-muted tw-small">
              Every session you finish adds to this line. Cash out on top and keep the line climbing.
            </p>
          </div>

          <div class="tw-card list" *ngIf="byCasino.length > 1">
            <p class="tw-eyebrow">By casino</p>
            <div class="row" *ngFor="let c of byCasino">
              <span>{{ c.name }}</span><span class="tw-muted">{{ c.count }} sessions</span><span></span><span></span>
              <span class="r" [class.tw-pos]="c.net > 0" [class.tw-neg]="c.net < 0">{{ c.net > 0 ? '+' : '' }}{{ c.net | number: '1.0-2' }}</span>
            </div>
          </div>

          <div class="tw-card list">
            <div class="row head tw-small tw-muted"><span>Date</span><span>Game</span><span>Rounds</span><span>Ended by</span><span class="r">Result</span></div>
            <div class="row" *ngFor="let s of sessions">
              <span>{{ s.startedAt.toDate() | date: 'MMM d, HH:mm' }}</span>
              <span>{{ gameName(s.gameId) }} <span class="tw-muted">· {{ betName(s.gameId, s.betId) }}</span>
                <div class="tw-muted tw-small">{{ s.casino || 'Unspecified' }}</div></span>
              <span>{{ s.rounds.length }}</span>
              <span class="tw-muted">{{ reason(s.endReason) }}</span>
              <span class="r" [class.tw-pos]="s.net > 0" [class.tw-neg]="s.net < 0">{{ s.net > 0 ? '+' : '' }}{{ s.net | number: '1.0-2' }}</span>
            </div>
          </div>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [`
    .title { margin: 0 0 18px; }
    .wall { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; align-items: center; margin-bottom: 16px; padding: 22px;
      border-radius: 22px; position: relative; overflow: hidden;
      background: radial-gradient(120% 120% at 0% 0%, rgba(var(--tw-accent-rgb), .22), transparent 60%), linear-gradient(160deg, var(--tw-felt-2), var(--tw-felt));
      border: 1px solid rgba(var(--tw-accent-rgb), .45); }
    @media (max-width: 640px) { .wall { grid-template-columns: 1fr; } }
    .won { font-family: var(--tw-mono); font-size: clamp(44px, 9vw, 72px); font-weight: 800; line-height: 1; color: var(--tw-pos-text);
      text-shadow: 0 0 30px rgba(47, 224, 143, .45); }
    .trophies { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .trophies div { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px 6px; border-radius: 14px; background: rgba(0,0,0,.25); }
    .trophies strong { font-family: var(--tw-mono); font-size: 22px; color: var(--tw-gold-2); }
    .trophies span { font-size: 12px; color: rgba(var(--tw-ink-rgb), .75); }
    .chart-card, .list { margin-top: 16px; }
    .chart { width: 100%; height: 180px; display: block; }
    .chart .zero { stroke: var(--tw-line-strong); stroke-dasharray: 4 4; stroke-width: 1; vector-effect: non-scaling-stroke; }
    .chart .line { fill: none; stroke: var(--tw-gold); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .row { display: grid; grid-template-columns: 1.1fr 1.6fr .6fr 1fr .8fr; gap: 8px; padding: 10px 0;
      border-bottom: 1px solid var(--tw-line); font-size: 14px; align-items: center; }
    .row:last-child { border-bottom: 0; }
    .r { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    @media (max-width: 640px) {
      .row { grid-template-columns: 1fr 1fr; }
      .row.head { display: none; }
    }
  `],
})
export class HistoryPage {
  private account = inject(AccountService);
  private svc = inject(SessionsService);
  sessions: RealSession[] = [];
  loading = true;
  total = 0;
  wagered = 0;
  winRate = 0;
  discipline = 0;
  W = 600;
  H = 180;
  points = '';
  byCasino: { name: string; count: number; net: number }[] = [];
  totalWon = 0;
  winCount = 0;
  targetHits = 0;
  best = 0;
  bestStreak = 0;
  zeroY = 90;

  constructor() {
    this.load();
  }

  private async load() {
    const user = await firstValueFrom(this.account.user$.pipe(filter((u) => !!u)));
    this.sessions = await this.svc.list(user!.uid);
    this.loading = false;
    const s = this.sessions;
    if (!s.length) return;
    this.total = round2(s.reduce((a, x) => a + x.net, 0));
    this.wagered = s.reduce((a, x) => a + x.rounds.reduce((b, r) => b + r.stake, 0), 0);
    this.winRate = (s.filter((x) => x.net > 0).length / s.length) * 100;
    // "Stuck to the plan" = ended by a stop, a check-in, the timer or the round limit rather than quitting midway.
    this.discipline = (s.filter((x) => x.endReason !== 'manual').length / s.length) * 100;
    const wins = s.filter((x) => x.net > 0);
    this.totalWon = round2(wins.reduce((a, x) => a + x.net, 0));
    this.winCount = wins.length;
    this.targetHits = s.filter((x) => x.endReason === 'stop-win').length;
    this.best = Math.max(0, ...s.map((x) => x.net));
    let run = 0;
    for (const x of [...s].reverse()) {
      run = x.net > 0 ? run + 1 : 0;
      this.bestStreak = Math.max(this.bestStreak, run);
    }
    const map = new Map<string, { name: string; count: number; net: number }>();
    for (const x of s) {
      const name = x.casino || 'Unspecified';
      const e = map.get(name) ?? { name, count: 0, net: 0 };
      e.count++;
      e.net = round2(e.net + x.net);
      map.set(name, e);
    }
    this.byCasino = [...map.values()].sort((a, b) => b.count - a.count);
    this.buildChart();
  }

  private buildChart() {
    const chrono = [...this.sessions].reverse();
    const cum: number[] = [0];
    for (const x of chrono) cum.push(cum[cum.length - 1] + x.net);
    const min = Math.min(0, ...cum);
    const max = Math.max(0, ...cum);
    const span = max - min || 1;
    const pad = 10;
    const y = (v: number) => pad + ((max - v) / span) * (this.H - pad * 2);
    const x = (i: number) => (i / Math.max(1, cum.length - 1)) * this.W;
    this.points = cum.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    this.zeroY = y(0);
  }

  gameName(id: string) {
    return getGame(id)?.name ?? id;
  }
  betName(gameId: string, betId: string) {
    if (betId === 'signals') return 'Signals';
    const g = getGame(gameId);
    return g ? getBet(g, betId)?.label ?? betId : betId;
  }
  reason(r: string) {
    return ({ 'stop-win': 'Target hit', 'stop-loss': 'Safety limit', time: 'Timer', rounds: 'Full session', checkin: 'Cashed out at check-in', 'profit-lock': 'Cashed out on top', 'change-table': 'Fresh table', manual: 'Cashed out' } as Record<string, string>)[r] ?? r;
  }
}

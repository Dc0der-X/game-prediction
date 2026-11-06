import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { firstValueFrom, filter } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { GameCardComponent } from '../../shared/game-card.component';
import { CountryPickerComponent } from '../../shared/country-picker.component';
import { MoneyPipe } from '../../shared/money.pipe';
import { AccountService } from '../../core/account.service';
import { RealSession, SessionsService } from '../../core/sessions.service';
import { MoneyService, amountsFor, tableFor } from '../../core/money';
import { SESSION_LIMITS, planNeural } from '../../core/strategies';
import { SIGNAL_GAMES, getGame } from '../../core/games';
import { Goal, goalProgress } from '../../core/goal';
import { staggerIn } from '../../shared/motion';

/**
 * "My TableWise" – the logo's page once signed in: who you are, your numbers, today, your goal,
 * how the plan works in your own currency, the do's and don'ts, and every game one tap away.
 */
@Component({
  selector: 'app-me',
  standalone: true,
  imports: [IonicModule, RouterLink, NgIf, NgFor, AsyncPipe, DatePipe, DecimalPipe, MoneyPipe, TopbarComponent, GameCardComponent, CountryPickerComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page me" #page>
        <!-- Who -->
        <header class="who" data-in>
          <div class="avatar" aria-hidden="true">{{ initials }}</div>
          <div class="who-txt">
            <p class="tw-eyebrow">{{ greeting }}</p>
            <h1>{{ firstName || 'Your table' }}</h1>
            <p class="mail">{{ email }}</p>
          </div>
          <div class="who-side">
            <ng-container *ngIf="access$ | async as a">
              <a class="pass" routerLink="/pro" *ngIf="a.onTrial">Free trial · ends {{ a.trialEndsAt | date: 'shortTime' }}</a>
              <a class="pass pro" routerLink="/account" *ngIf="a.isPaid">Pro · until {{ a.paidUntil | date: 'mediumDate' }}</a>
              <a class="pass go" routerLink="/pro" *ngIf="!a.hasPro">Get a pass</a>
            </ng-container>
            <app-country-picker></app-country-picker>
          </div>
        </header>

        <!-- Numbers -->
        <section class="stats" data-in>
          <div class="tw-glass"><span>Sessions</span><strong>{{ sessions.length }}</strong></div>
          <div class="tw-glass"><span>Winning sessions</span><strong>{{ winRate }}%</strong></div>
          <div class="tw-glass"><span>Net result</span><strong [class.tw-pos]="net > 0" [class.tw-neg]="net < 0">{{ net | money: cur : true }}</strong></div>
          <div class="tw-glass"><span>Best session</span><strong class="tw-pos">{{ best | money: cur : true }}</strong></div>
        </section>

        <div class="two">
          <!-- Today -->
          <section class="today tw-glass" data-in>
            <p class="tw-eyebrow">Today</p>
            <ng-container *ngIf="todayCount; else fresh">
              <h2>{{ todayNet > 0 ? 'Done for the day – well played' : 'Fresh start tomorrow' }}</h2>
              <div class="big" [class.tw-pos]="todayNet > 0" [class.tw-neg]="todayNet < 0">{{ todayNet | money: cur : true }}</div>
              <p class="muted">{{ todayCount }} session{{ todayCount === 1 ? '' : 's' }} today. {{ todayNet > 0 ? 'Protecting a win is how amounts grow.' : 'A calm head and a new table tomorrow.' }}</p>
              <a class="tw-cta ghost" routerLink="/history">See my sessions</a>
            </ng-container>
            <ng-template #fresh>
              <h2>Your table is ready</h2>
              <p class="muted">One calm 30-minute session. Bring your amount, follow the signal, cash out on cue.</p>
              <a class="tw-cta" routerLink="/coach">Open the Signal Room</a>
            </ng-template>
          </section>

          <!-- Goal -->
          <section class="goal tw-glass" data-in>
            <p class="tw-eyebrow">My goal</p>
            <ng-container *ngIf="goal; else noGoal">
              <h2>{{ goal.start | money: cur }} → {{ goal.target | money: cur }}</h2>
              <div class="bar"><i [style.width.%]="goalPct"></i></div>
              <p class="muted">{{ goalPct }}% there · {{ goalLeft }} winning session{{ goalLeft === 1 ? '' : 's' }} to go</p>
              <a class="tw-cta ghost" routerLink="/goal">Open my goal</a>
            </ng-container>
            <ng-template #noGoal>
              <h2>Set a goal</h2>
              <p class="muted">See how +5% sessions compound – step by step to the amount you want.</p>
              <a class="tw-cta ghost" routerLink="/goal">Plan my goal</a>
            </ng-template>
          </section>
        </div>

        <!-- How the plan works -->
        <section class="plan tw-glass" data-in>
          <p class="tw-eyebrow">How your plan works</p>
          <h2>With {{ example | money: cur }} at your table</h2>
          <div class="plan-grid">
            <div><span>First bet</span><strong>{{ firstBet | money: cur }}</strong></div>
            <div class="good"><span>Target</span><strong>{{ target | money: cur : true }}</strong></div>
            <div><span>Safety limit</span><strong>{{ limit | money: cur }}</strong></div>
            <div><span>Session</span><strong>{{ minutes }} min</strong></div>
          </div>
          <div class="ladder" aria-label="Bet steps">
            <i *ngFor="let a of ladder; let i = index" [class.on]="i === 0">{{ a | money: cur }}</i>
          </div>
          <ol class="steps">
            <li><b>Tap what came</b> at your table – the signal gives the side and the exact bet.</li>
            <li><b>A miss</b> moves one step up the ladder; <b>a win</b> steps back down.</li>
            <li><b>3 misses in a row</b> – move to a fresh table, back to the first bet.</li>
            <li><b>Target hit</b> – cash out. <b>Safety limit</b> – the session ends before any bet could pass it.</li>
          </ol>
        </section>

        <!-- Do / don't -->
        <section class="rules" data-in>
          <div class="tw-glass do">
            <h3>Do</h3>
            <ul>
              <li>Bet exactly what the signal shows</li>
              <li>Cash out the moment your target is hit</li>
              <li>Move tables after 3 misses in a row</li>
              <li>Take the 20-minute breather</li>
              <li>Stop for the day after a win – grow it tomorrow</li>
            </ul>
          </div>
          <div class="tw-glass dont">
            <h3>Don't</h3>
            <ul>
              <li>Raise bets to win back a miss</li>
              <li>Skip signals or play your own hunches</li>
              <li>Play with money you need for bills</li>
              <li>Chase a loss with another session today</li>
              <li>Play tired, rushed or after drinks</li>
            </ul>
          </div>
        </section>

        <!-- Games -->
        <section class="games" data-in>
          <div class="games-head">
            <div><p class="tw-eyebrow">Tables</p><h2>Every game, one tap away</h2></div>
            <a class="link" routerLink="/lobby">Practice free →</a>
          </div>
          <div class="games-row">
            <app-game-card *ngFor="let g of games" [game]="g" (pick)="open(g.id)"></app-game-card>
          </div>
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    .me { max-width: 1080px; }
    .who { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin: 6px 0 18px;
      h1 { margin: 0; font-size: clamp(32px, 5vw, 44px); } .tw-eyebrow { margin: 0 0 2px; } .mail { margin: 2px 0 0; color: var(--tw-muted); font-size: 14px; } }
    .avatar { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; flex: none;
      background: var(--tw-accent-grad); color: var(--tw-on-accent); font: 700 24px/1 var(--tw-serif); box-shadow: 0 10px 26px rgba(var(--tw-accent-rgb), .3); }
    .who-txt { flex: 1; min-width: 180px; }
    .who-side { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .pass { display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px;
      background: rgba(var(--tw-accent-rgb), .12); color: var(--tw-gold-2); border: 1px solid rgba(var(--tw-accent-rgb), .45);
      &.pro { background: rgba(54, 184, 137, .14); color: var(--tw-pos-text); border-color: rgba(54, 184, 137, .45); }
      &.go { background: var(--tw-accent-grad); color: var(--tw-on-accent); border: 0; } }

    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px;
      div { padding: 16px; } span { display: block; color: var(--tw-muted); font-size: 13px; margin-bottom: 6px; }
      strong { font: 800 26px/1 var(--tw-font); font-variant-numeric: tabular-nums; } }
    @media (max-width: 700px) { .stats { grid-template-columns: repeat(2, 1fr); } }

    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    @media (max-width: 760px) { .two { grid-template-columns: 1fr; } }
    .today, .goal, .plan { padding: 22px; h2 { margin: 2px 0 8px; font-size: clamp(22px, 3vw, 28px); } }
    .muted { color: var(--tw-muted); line-height: 1.5; margin: 6px 0 14px; }
    .big { font: 800 36px/1.1 var(--tw-font); font-variant-numeric: tabular-nums; }
    .bar { height: 10px; border-radius: 999px; background: rgba(var(--tw-ink-rgb), .08); overflow: hidden; margin: 10px 0 4px;
      i { display: block; height: 100%; border-radius: 999px; background: var(--tw-accent-grad); } }

    .plan { margin-bottom: 14px; }
    .plan-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 8px 0 14px;
      div { padding: 12px; border-radius: 14px; background: rgba(var(--tw-ink-rgb), .04); border: 1px solid var(--tw-line); text-align: center; }
      span { display: block; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--tw-muted); margin-bottom: 4px; }
      strong { font: 700 22px/1 var(--tw-font); font-variant-numeric: tabular-nums; } .good strong { color: var(--tw-green); } }
    @media (max-width: 700px) { .plan-grid { grid-template-columns: repeat(2, 1fr); } }
    .ladder { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px;
      i { font-style: normal; padding: 6px 10px; border-radius: 10px; background: rgba(var(--tw-ink-rgb), .05); border: 1px solid var(--tw-line); font: 600 13px var(--tw-mono);
        &.on { background: var(--tw-accent-grad); color: var(--tw-on-accent); border-color: transparent; } } }
    .steps { margin: 0; padding-left: 20px; display: grid; gap: 8px; color: rgba(var(--tw-ink-rgb), .86); line-height: 1.5; b { color: var(--tw-text); } }

    .rules { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 26px;
      > div { padding: 20px 22px; } h3 { margin: 0 0 10px; font: 700 20px var(--tw-serif); }
      ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
      li { position: relative; padding-left: 28px; line-height: 1.45; }
      .do li::before { content: '✓'; position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center;
        font-size: 12px; font-weight: 800; background: rgba(54, 184, 137, .18); color: var(--tw-pos-text); }
      .dont li::before { content: '✕'; position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center;
        font-size: 11px; font-weight: 800; background: rgba(240, 82, 97, .16); color: var(--tw-neg-text); } }
    @media (max-width: 700px) { .rules { grid-template-columns: 1fr; } }

    .games-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 12px;
      h2 { margin: 2px 0 0; font-size: clamp(24px, 3.4vw, 32px); } .link { color: var(--tw-gold); font-weight: 700; text-decoration: none; } }
    .games-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    @media (max-width: 760px) {
      .games-row { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -16px; padding: 4px 16px 10px; scrollbar-width: none;
        &::-webkit-scrollbar { display: none; } app-game-card { flex: 0 0 58%; scroll-snap-align: start; } }
    }
  `],
})
export class MePage implements AfterViewInit {
  private account = inject(AccountService);
  private svc = inject(SessionsService);
  private money = inject(MoneyService);
  private router = inject(Router);
  @ViewChild('page', { static: true }) page!: ElementRef<HTMLElement>;

  access$ = this.account.access$;
  games = SIGNAL_GAMES.map((id) => getGame(id)!);
  minutes = SESSION_LIMITS.sessionMinutes;
  sessions: RealSession[] = [];
  firstName = '';
  email = '';
  goal: Goal | null = null;
  goalPct = 0;
  goalLeft = 0;

  constructor() {
    this.load();
  }

  ngAfterViewInit() {
    requestAnimationFrame(() => staggerIn(this.page.nativeElement, '[data-in]'));
  }

  private async load() {
    const user = await firstValueFrom(this.account.user$.pipe(filter((u) => !!u)));
    const profile = await firstValueFrom(this.account.profile$);
    this.firstName = (profile?.name || user!.displayName || '').trim().split(/\s+/)[0] || '';
    this.email = profile?.email || user!.email || '';
    this.sessions = await this.svc.list(user!.uid).catch(() => []);
    this.goal = profile?.goal ?? null;
    if (this.goal) {
      const pr = goalProgress(this.goal, this.sessions.map((s) => ({ net: s.net, startedAt: s.startedAt.toMillis() })));
      const span = this.goal.target - this.goal.start;
      this.goalPct = span > 0 ? Math.max(0, Math.min(100, Math.round(((pr.balance - this.goal.start) / span) * 100))) : 0;
      this.goalLeft = pr.left;
    }
  }

  get cur(): string {
    return this.money.currency;
  }

  get initials(): string {
    const src = this.firstName || this.email || 'T';
    return src.slice(0, 1).toUpperCase();
  }

  get greeting(): string {
    const h = new Date().getHours();
    return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  get net(): number {
    return Math.round(this.sessions.reduce((a, s) => a + s.net, 0) * 100) / 100;
  }

  get best(): number {
    return this.sessions.reduce((m, s) => Math.max(m, s.net), 0);
  }

  get winRate(): number {
    return this.sessions.length ? Math.round((this.sessions.filter((s) => s.net > 0).length / this.sessions.length) * 100) : 0;
  }

  private get today(): RealSession[] {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.sessions.filter((s) => s.startedAt.toMillis() >= start.getTime());
  }

  get todayCount(): number {
    return this.today.length;
  }

  get todayNet(): number {
    return Math.round(this.today.reduce((a, s) => a + s.net, 0) * 100) / 100;
  }

  /** The example amount: the goal's next step, else the first quick amount for this currency. */
  get example(): number {
    return amountsFor(this.cur).quick[1];
  }

  private get plan() {
    return planNeural(getGame('roulette')!, this.example, this.minutes, 'book', tableFor(this.cur));
  }

  get ladder(): number[] {
    return this.plan.series ?? [];
  }

  get firstBet(): number {
    return this.ladder[0] ?? 0;
  }

  get target(): number {
    return this.plan.stopWin;
  }

  get limit(): number {
    return this.plan.stopLoss;
  }

  open(id: string) {
    this.router.navigate(['/coach'], { queryParams: { game: id } });
  }
}

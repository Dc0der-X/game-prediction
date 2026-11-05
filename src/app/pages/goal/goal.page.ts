import { Component, inject } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { firstValueFrom, filter } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { AccountService } from '../../core/account.service';
import { SessionsService } from '../../core/sessions.service';
import { Goal, GoalProgress, goalError, goalProgress, goalShare, goalSteps, plannedAfter, sessionsNeeded } from '../../core/goal';

interface Pt { x: number; y: number }

@Component({
  selector: 'app-goal',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, NgFor, DecimalPipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page" *ngIf="ready">
        <p class="tw-eyebrow">My goal</p>

        <!-- ============ Set a goal ============ -->
        <ng-container *ngIf="!goal || editing">
          <h1>Where do you want to be?</h1>
          <p class="tw-muted lead">Set a goal and the compounding calculator turns it into a session-by-session plan.
            Each session aims for +{{ sharePct }}% of what you play with – and every win grows the next one.</p>

          <div class="setup">
            <section class="tw-card form">
              <label class="money-field"><span>I'm starting with</span>
                <input class="money" type="number" inputmode="decimal" min="50" [(ngModel)]="start" aria-label="Starting amount" /></label>
              <label class="money-field"><span>My goal</span>
                <input class="money goal-in" type="number" inputmode="decimal" [(ngModel)]="target" aria-label="Goal amount" /></label>
              <div class="quick">
                <button *ngFor="let m of [2, 3, 5, 10]" (click)="target = (start || 0) * m" [class.on]="target === (start || 0) * m">×{{ m }}</button>
              </div>
              <p class="tw-error" *ngIf="formError && touched">{{ formError }}</p>
              <div class="tw-row">
                <button class="go" (click)="save()" [disabled]="!!formError">Set my goal</button>
                <button class="link" *ngIf="goal" (click)="editing = false">Cancel</button>
              </div>
            </section>

            <section class="tw-card preview" *ngIf="!formError">
              <p class="tw-eyebrow">Your plan</p>
              <div class="big-n"><strong>{{ previewSessions }}</strong><span>winning sessions to go from
                {{ start | number: '1.0-2' }} to {{ target | number: '1.0-2' }}</span></div>
              <svg viewBox="0 0 600 170" class="chart" preserveAspectRatio="none" role="img" aria-label="Plan curve">
                <polyline [attr.points]="line(previewCurve)" class="plan" />
                <circle *ngFor="let p of previewCurve.slice(-1)" [attr.cx]="p.x" [attr.cy]="p.y" r="6" class="end" />
              </svg>
              <div class="mini-steps">
                <div *ngFor="let s of previewSteps"><span>#{{ s.n }}</span><span>{{ s.from | number: '1.0-2' }}</span>
                  <b>+{{ s.gain | number: '1.0-2' }}</b><span>→ {{ s.to | number: '1.0-2' }}</span></div>
              </div>
            </section>
          </div>
        </ng-container>

        <!-- ============ Goal tracker ============ -->
        <ng-container *ngIf="goal && !editing && prog as pr">
          <h1>{{ pr.reached ? 'Goal reached! 🎉' : (goal.start | number: '1.0-0') + ' → ' + (goal.target | number: '1.0-0') }}</h1>

          <div class="track">
            <section class="tw-card hero">
              <div class="hero-top">
                <div>
                  <span class="tw-muted tw-small">Where you are</span>
                  <div class="bal">{{ pr.balance | number: '1.0-2' }}</div>
                  <span class="gain" *ngIf="pr.balance > goal.start">+{{ pr.balance - goal.start | number: '1.0-2' }} since you started</span>
                </div>
                <div class="ring" [style.--p]="pr.pct">
                  <span>{{ pr.pct }}%</span>
                </div>
              </div>
              <div class="bar"><i [style.width.%]="pr.pct"></i></div>
              <div class="stats">
                <div><strong>{{ pr.played }}</strong><span>session{{ pr.played === 1 ? '' : 's' }} played</span></div>
                <div><strong>{{ pr.wins }}</strong><span>winning session{{ pr.wins === 1 ? '' : 's' }}</span></div>
                <div><strong>{{ pr.left }}</strong><span>win{{ pr.left === 1 ? '' : 's' }} to your goal</span></div>
              </div>
            </section>

            <section class="tw-card next" *ngIf="!pr.reached">
              <p class="tw-eyebrow">Today's step</p>
              <div class="step-line">
                <div><span>Play with</span><strong>{{ pr.nextAmount | number: '1.0-2' }}</strong></div>
                <div class="arrow">→</div>
                <div><span>Target</span><strong class="tw-pos">+{{ pr.nextGain | number: '1.0-2' }}</strong></div>
                <div class="arrow">→</div>
                <div><span>New balance</span><strong>{{ pr.nextAmount + pr.nextGain | number: '1.0-2' }}</strong></div>
              </div>
              <a class="go" routerLink="/coach" [queryParams]="{ amount: pr.nextAmount }">Start today's session</a>
            </section>
            <section class="tw-card next" *ngIf="pr.reached">
              <p class="tw-eyebrow">You did it</p>
              <p>You reached {{ goal.target | number: '1.0-2' }}. Cash it out, then set your next goal.</p>
              <button class="go" (click)="newGoal()">Set my next goal</button>
            </section>
          </div>

          <section class="tw-card">
            <div class="chart-head"><p class="tw-eyebrow">Plan vs. your sessions</p>
              <span class="legend"><i class="l-plan"></i> plan <i class="l-real"></i> you</span></div>
            <svg viewBox="0 0 600 190" class="chart" preserveAspectRatio="none" role="img" aria-label="Plan and real progress">
              <line x1="0" x2="600" [attr.y1]="goalY" [attr.y2]="goalY" class="goal-line" />
              <polyline [attr.points]="line(planCurve)" class="plan dashed" />
              <polyline *ngIf="realCurve.length > 1" [attr.points]="line(realCurve)" class="real" />
              <circle *ngFor="let p of realCurve" [attr.cx]="p.x" [attr.cy]="p.y" r="4.5" class="dot" />
            </svg>
          </section>

          <section class="tw-card">
            <details>
              <summary>Every step of your plan ({{ steps.length }})</summary>
              <div class="steps">
                <div class="row head"><span>Session</span><span>Play with</span><span>Target</span><span>After</span></div>
                <div class="row" *ngFor="let s of steps" [class.done]="s.n <= pr.wins" [class.now]="s.n === pr.wins + 1">
                  <span>#{{ s.n }}</span><span>{{ s.from | number: '1.0-2' }}</span><span class="tw-pos">+{{ s.gain | number: '1.0-2' }}</span><span>{{ s.to | number: '1.0-2' }}</span>
                </div>
              </div>
            </details>
          </section>

          <p class="tw-muted tw-small foot">The plan counts winning sessions, one a day. Your tracker uses your real session results,
            so it always shows exactly where you are. <button class="link" (click)="edit()">Change goal</button></p>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [`
    h1 { font-size: clamp(28px, 4.5vw, 42px); margin: 0 0 8px; }
    .lead { max-width: 680px; }
    .setup, .track { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 16px; margin: 20px 0 16px; }
    @media (max-width: 820px) { .setup, .track { grid-template-columns: minmax(0, 1fr); } }
    .money-field { display: grid; gap: 6px; margin-bottom: 14px; font-size: 14px; color: var(--tw-muted); }
    .money { width: 100%; height: 64px; border-radius: 16px; border: 1px solid var(--tw-line-strong); background: var(--tw-bg-2);
      color: var(--tw-text); font: 800 32px/1 var(--tw-mono); padding: 0 16px; }
    .goal-in { color: var(--tw-gold-2); }
    .quick { display: flex; gap: 8px; margin: -4px 0 14px; }
    .quick button { flex: 1; height: 40px; border-radius: 999px; border: 1px solid var(--tw-line-strong); background: transparent;
      color: var(--tw-text); font: 700 15px var(--tw-font); cursor: pointer; }
    .quick button.on { background: var(--tw-gold); color: #031019; border-color: var(--tw-gold); }
    .go { display: inline-flex; align-items: center; justify-content: center; height: 52px; padding: 0 26px; border-radius: 999px; border: 0;
      background: linear-gradient(135deg, var(--tw-gold-2), var(--tw-gold)); color: #031019; font: 800 16px var(--tw-font);
      text-decoration: none; cursor: pointer; box-shadow: 0 12px 30px rgba(var(--tw-accent-rgb), .3); }
    .go[disabled] { opacity: .5; cursor: default; }
    .link { background: none; border: 0; color: var(--tw-gold); font: inherit; cursor: pointer; padding: 0; }
    .big-n { display: flex; align-items: baseline; gap: 12px; margin: 4px 0 6px; }
    .big-n strong { font: 800 56px/1 var(--tw-display); color: var(--tw-gold-2); }
    .big-n span { color: var(--tw-muted); }
    .chart { width: 100%; height: 170px; display: block; margin: 8px 0; }
    .plan { fill: none; stroke: var(--tw-gold); stroke-width: 3; }
    .plan.dashed { stroke-dasharray: 7 6; opacity: .75; }
    .real { fill: none; stroke: var(--tw-green); stroke-width: 3.5; }
    .dot { fill: var(--tw-green); }
    .end { fill: var(--tw-gold-2); }
    .goal-line { stroke: rgba(255,255,255,.18); stroke-dasharray: 3 5; }
    .mini-steps { display: grid; gap: 4px; font-family: var(--tw-mono); font-size: 13px; }
    .mini-steps div { display: grid; grid-template-columns: 44px 1fr 1fr 1fr; gap: 8px; color: var(--tw-muted); }
    .mini-steps b { color: var(--tw-green); }
    .hero-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .bal { font: 800 46px/1.05 var(--tw-mono); color: var(--tw-gold-2); }
    .gain { color: var(--tw-green); font-weight: 700; font-size: 14px; }
    .ring { --p: 0; width: 92px; height: 92px; border-radius: 50%; flex: none; display: grid; place-items: center;
      background: conic-gradient(var(--tw-green) calc(var(--p) * 1%), rgba(255,255,255,.08) 0); }
    .ring span { width: 72px; height: 72px; border-radius: 50%; background: var(--tw-card); display: grid; place-items: center;
      font: 800 20px var(--tw-mono); }
    .bar { height: 10px; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; margin: 16px 0; }
    .bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #1db87a, var(--tw-green));
      box-shadow: 0 0 14px rgba(47,224,143,.5); transition: width .6s ease; }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .stats div { display: flex; flex-direction: column; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.04); }
    .stats strong { font: 800 22px var(--tw-mono); } .stats span { font-size: 12px; color: var(--tw-muted); }
    .step-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 6px 0 18px; }
    .step-line div { display: flex; flex-direction: column; }
    .step-line span { font-size: 12px; color: var(--tw-muted); }
    .step-line strong { font: 800 26px var(--tw-mono); }
    .step-line .arrow { color: var(--tw-muted); font-size: 22px; }
    .chart-head { display: flex; justify-content: space-between; align-items: center; }
    .legend { font-size: 12px; color: var(--tw-muted); display: flex; align-items: center; gap: 6px; }
    .legend i { display: inline-block; width: 18px; height: 3px; border-radius: 2px; }
    .l-plan { background: var(--tw-gold); } .l-real { background: var(--tw-green); }
    summary { cursor: pointer; font-weight: 700; }
    .steps { display: grid; gap: 2px; margin-top: 12px; max-height: 360px; overflow: auto; font-family: var(--tw-mono); font-size: 14px; }
    .row { display: grid; grid-template-columns: 70px 1fr 1fr 1fr; gap: 8px; padding: 7px 10px; border-radius: 8px; }
    .row.head { color: var(--tw-muted); font-family: var(--tw-font); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    .row.done { background: rgba(47,224,143,.08); }
    .row.now { background: rgba(var(--tw-accent-rgb), .16); box-shadow: inset 0 0 0 1px var(--tw-gold); }
    .tw-card { margin-bottom: 16px; }
    .foot { margin-top: 4px; }
  `],
})
export class GoalPage {
  private account = inject(AccountService);
  private sessionsSvc = inject(SessionsService);

  ready = false;
  uid = '';
  goal: Goal | null = null;
  prog: GoalProgress | null = null;
  editing = false;
  touched = false;
  start: number | null = 200;
  target: number | null = 1000;
  sharePct = Math.round(goalShare() * 100);
  steps: ReturnType<typeof goalSteps> = [];
  planCurve: Pt[] = [];
  realCurve: Pt[] = [];
  goalY = 20;

  constructor() {
    this.load();
  }

  private async load() {
    const user = await firstValueFrom(this.account.user$.pipe(filter((u) => !!u)));
    this.uid = user!.uid;
    const profile = await firstValueFrom(this.account.profile$);
    this.goal = profile?.goal ?? null;
    if (this.goal) await this.track();
    this.ready = true;
  }

  private async track() {
    const g = this.goal!;
    const sessions = (await this.sessionsSvc.list(this.uid).catch(() => [])).map((s) => ({
      net: s.net,
      startedAt: s.startedAt.toMillis(),
    }));
    this.prog = goalProgress(g, sessions);
    this.steps = goalSteps(g.start, g.target);
    // Chart: plan (dashed) and the real running balance, on the same scale.
    const mine = sessions.filter((s) => s.startedAt >= g.setAt).sort((a, b) => a.startedAt - b.startedAt);
    const real: number[] = [g.start];
    for (const s of mine) real.push(Math.max(0, real[real.length - 1] + s.net));
    const n = Math.max(this.steps.length, real.length - 1, 1);
    const plan = Array.from({ length: n + 1 }, (_, i) => Math.min(plannedAfter(g.start, i), Math.max(g.target, plannedAfter(g.start, i))));
    const top = Math.max(g.target, ...real, ...plan) * 1.04;
    const bottom = Math.min(g.start, ...real) * 0.96;
    const map = (v: number, i: number): Pt => ({ x: (i / n) * 600, y: 180 - ((v - bottom) / (top - bottom || 1)) * 170 });
    this.planCurve = plan.map(map);
    this.realCurve = real.map(map);
    this.goalY = map(g.target, 0).y;
  }

  get formError(): string {
    return goalError(this.start, this.target);
  }

  get previewSessions(): number {
    return sessionsNeeded(this.start!, this.target!);
  }

  get previewSteps() {
    const all = goalSteps(this.start!, this.target!);
    return all.length <= 6 ? all : [...all.slice(0, 4), all[all.length - 1]];
  }

  get previewCurve(): Pt[] {
    const n = Math.max(1, this.previewSessions);
    const top = this.target! * 1.04;
    const bottom = this.start! * 0.96;
    return Array.from({ length: n + 1 }, (_, i) => {
      const v = Math.min(plannedAfter(this.start!, i), this.target!);
      return { x: (i / n) * 600, y: 165 - ((v - bottom) / (top - bottom)) * 155 };
    });
  }

  line(pts: Pt[]): string {
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  async save() {
    this.touched = true;
    if (this.formError) return;
    const goal: Goal = { start: Math.round(this.start! * 100) / 100, target: Math.round(this.target! * 100) / 100, setAt: Date.now() };
    await this.account.setGoal(this.uid, goal);
    this.goal = goal;
    this.editing = false;
    await this.track();
  }

  edit() {
    this.start = this.prog?.balance || this.goal?.start || 200;
    this.target = this.goal?.target ?? 1000;
    this.editing = true;
  }

  newGoal() {
    const bal = this.prog?.balance ?? this.goal?.target ?? 200;
    this.start = Math.round(bal);
    this.target = Math.round(bal * 2);
    this.editing = true;
  }
}

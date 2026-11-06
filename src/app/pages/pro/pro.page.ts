import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccountService } from '../../core/account.service';
import { PaymentsService } from '../../core/payments.service';
import { PLANS, PRICING, PRO_FEATURES, Plan, PlanId, perDay, savingVsDay } from '../../core/pricing';
import { TopbarComponent } from '../../shared/topbar.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-pro',
  standalone: true,
  imports: [IonicModule, RouterLink, NgIf, NgFor, NgClass, AsyncPipe, DatePipe, DecimalPipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page">
        <ng-container *ngIf="access$ | async as a">
          <header class="head">
            <p class="tw-eyebrow">TableWise Pro</p>
            <h1 *ngIf="a.isPaid && !a.paymentPending">You're on Pro until {{ a.paidUntil | date: 'MMM d, h:mm a' }}</h1>
            <h1 *ngIf="a.paymentPending">Your pass is on – enjoy!</h1>
            <h1 *ngIf="!a.isPaid && a.onTrial">Keep your signals going</h1>
            <h1 *ngIf="!a.isPaid && !a.onTrial && !a.onHold">Pick your pass and jump back in</h1>
            <h1 *ngIf="a.onHold">Your pass is paused</h1>
            <p class="tw-note" *ngIf="!a.isPaid && a.trialBlocked && !a.onHold">This network has already used its free hours. A pass unlocks everything instantly.</p>
            <p class="tw-muted lead">Every pass unlocks live signals, your session plan, the cash-out alerts and your winnings wall.
              Pay once – no auto-renewal.</p>
          </header>

          <div class="tw-note good" *ngIf="a.paymentPending">
            You're all set – the Signal Room is open. We're confirming your payment in the background (usually a few minutes).
            <a routerLink="/coach">Go to the Signal Room →</a>
          </div>
          <div class="tw-note" *ngIf="a.onHold">
            We haven't received your payment yet. Finish it on the checkout page and your pass switches back on automatically –
            or pick a pass below to pay again.
          </div>
          <div class="tw-note" *ngIf="startNote">{{ startNote }}</div>

          <div class="plans" role="radiogroup" aria-label="Choose a pass">
            <button *ngFor="let p of plans" class="plan" role="radio" [attr.aria-checked]="selected === p.id"
                    [class.on]="selected === p.id" [ngClass]="'plan-' + p.id" (click)="choose(p.id)">
              <span class="badge" *ngIf="p.badge">{{ p.badge }}</span>
              <span class="name">{{ p.name }}</span>
              <span class="price"><small>$</small>{{ p.usd }}<em>/{{ p.per }}</em></span>
              <span class="per">\${{ perDay(p) | number: '1.2-2' }} a day<b *ngIf="savingVsDay(p) > 0"> · save {{ savingVsDay(p) }}%</b></span>
              <span class="blurb">{{ p.blurb }}</span>
              <span class="radio" aria-hidden="true"></span>
            </button>
          </div>

          <section class="checkout tw-card">
            <div class="summary">
              <div>
                <p class="tw-eyebrow">Your pass</p>
                <h2>{{ plan.name }} · \${{ plan.usd }}</h2>
                <ul><li *ngFor="let f of features">{{ f }}</li></ul>
              </div>
            </div>
            <div class="pay">
              <div class="tw-error" *ngIf="error">{{ error }}</div>
              <ng-container *ngIf="!waitingRef; else waiting">
                <button class="pay-btn" (click)="pay('card')" [disabled]="!!busy || (!payments.configured && !demo)">
                  {{ busy === 'card' ? 'Opening checkout…' : 'Pay by card – \$' + plan.usd }}</button>
                <p class="tw-small tw-muted methods">Visa · Mastercard · Apple Pay · Google Pay · bank transfer</p>
                <button class="pay-btn alt" (click)="pay('crypto')" [disabled]="!!busy || (!payments.configured && !demo)">
                  {{ busy === 'crypto' ? 'Opening checkout…' : 'Pay with crypto – \$' + plan.usd }}</button>
                <p class="tw-small tw-muted methods">BTC · ETH · USDT · USDC and more</p>
                <p class="tw-small tw-muted instant">⚡ Your pass switches on automatically the moment your payment arrives.</p>
              </ng-container>
              <ng-template #waiting>
                <div class="wait" *ngIf="!(access$ | async)?.isPaid || (access$ | async)?.paymentPending">
                  <div class="spin" aria-hidden="true"></div>
                  <div>
                    <strong>Finish your payment in the new tab</strong>
                    <p class="tw-small tw-muted">This page switches your pass on by itself as soon as the payment arrives –
                      usually a few minutes.</p>
                  </div>
                </div>
                <div class="tw-note good" *ngIf="(access$ | async)?.isPaid && !(access$ | async)?.paymentPending">
                  Payment received – your pass is on! <a routerLink="/coach">Go to the Signal Room →</a>
                </div>
                <div class="tw-row wait-actions">
                  <button class="link" (click)="paid()" [disabled]="!!busy">I've paid – switch my pass on now</button>
                  <a class="link" *ngIf="checkoutUrl" [href]="checkoutUrl" target="_blank" rel="noopener">Reopen checkout</a>
                  <button class="link muted" (click)="waitingRef = ''">Choose another way to pay</button>
                </div>
              </ng-template>
              <p class="tw-note" *ngIf="demo">Demo: no real payment – the pass switches on instantly and "confirms" after a few seconds.</p>
              <p class="tw-note" *ngIf="!payments.configured && !demo">Checkout is not configured yet. Admin: set <code>payments.apiUrl</code> (README → Payments).</p>
              <p class="secure">🔒 Secure hosted checkout. We never see your card or wallet keys.</p>
            </div>
          </section>

          <p class="tw-muted tw-small fine">
            Passes add to any time you have left. TableWise gives signals and session guidance; it does not take bets
            or hold money. 18+ only.
          </p>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [`
    .head h1 { font-size: clamp(28px, 4.5vw, 42px); margin: 0 0 8px; text-wrap: balance; }
    .lead { max-width: 640px; }
    .plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 26px 0 18px; }
    @media (max-width: 820px) { .plans { grid-template-columns: 1fr; } }
    .plan { position: relative; text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 22px 20px 20px;
      border-radius: 20px; border: 1px solid var(--tw-line-strong); background: var(--tw-card); color: var(--tw-text);
      font: inherit; cursor: pointer; transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
    .plan:hover { transform: translateY(-2px); }
    .plan.on { border-color: var(--tw-gold); box-shadow: 0 0 0 1px var(--tw-gold), 0 18px 50px rgba(var(--tw-accent-rgb), .18); }
    .plan-year { background: linear-gradient(160deg, rgba(245, 199, 106, .14), var(--tw-card) 55%); }
    .plan-month { background: linear-gradient(160deg, rgba(var(--tw-accent-rgb), .12), var(--tw-card) 55%); }
    .badge { position: absolute; top: -11px; left: 18px; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;
      letter-spacing: .06em; text-transform: uppercase; background: var(--tw-gold); color: #031019; }
    .plan-year .badge { background: var(--tw-money); color: #1a1205; }
    .name { font-weight: 700; font-size: 17px; }
    .price { font-family: var(--tw-display); font-size: 46px; font-weight: 800; line-height: 1; }
    .price small { font-size: 22px; vertical-align: top; margin-right: 2px; }
    .price em { font-style: normal; font-size: 16px; font-weight: 600; color: var(--tw-muted); margin-left: 4px; }
    .per { font-family: var(--tw-mono); font-size: 13px; color: var(--tw-gold-2); }
    .per b { color: var(--tw-green); font-weight: 700; }
    .blurb { font-size: 14px; color: var(--tw-muted); }
    .radio { position: absolute; top: 20px; right: 18px; width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--tw-line-strong); }
    .plan.on .radio { border-color: var(--tw-gold); background: radial-gradient(circle, var(--tw-gold) 45%, transparent 50%); }
    .checkout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px; }
    @media (max-width: 760px) { .checkout { grid-template-columns: 1fr; } }
    .checkout h2 { margin: 0 0 8px; }
    .checkout ul { padding-left: 18px; line-height: 1.8; margin: 0; }
    .pay-label { font-size: 13px; color: var(--tw-muted); margin: 0 0 8px; font-weight: 600; }
    .pay-btn { width: 100%; max-width: 380px; height: 54px; border-radius: 999px; border: 0; cursor: pointer;
      background: linear-gradient(135deg, var(--tw-gold-2), var(--tw-gold)); color: #031019; font: inherit; font-size: 17px; font-weight: 800;
      box-shadow: 0 12px 30px rgba(var(--tw-accent-rgb), .3); }
    .pay-btn[disabled] { opacity: .6; cursor: default; }
    .instant { margin: 10px 0 0; }
    .methods { margin: 6px 0 14px; }
    .pay-btn.alt { background: var(--tw-card-2); color: var(--tw-text); border: 1px solid var(--tw-line-strong); box-shadow: none; }
    .wait { display: flex; gap: 14px; align-items: center; padding: 14px; border-radius: 14px; background: var(--tw-card-2);
      border: 1px solid var(--tw-line-strong); max-width: 420px; }
    .wait p { margin: 4px 0 0; }
    .spin { width: 28px; height: 28px; flex: none; border-radius: 50%; border: 3px solid rgba(var(--tw-accent-rgb), .25);
      border-top-color: var(--tw-gold); animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .wait-actions { gap: 16px; margin-top: 12px; flex-wrap: wrap; }
    .link { background: none; border: 0; padding: 0; color: var(--tw-gold); font: inherit; font-size: 14px; cursor: pointer; text-decoration: none; }
    .link.muted { color: var(--tw-muted); }
    .tw-note.good { border-color: rgba(46, 204, 113, .5); }
    .secure { font-size: 12px; color: var(--tw-muted); margin-top: 12px; }
    .fine { margin-top: 18px; max-width: 760px; }
    code { color: var(--tw-gold-2); }
  `],
})
export class ProPage {
  private account = inject(AccountService);
  private router = inject(Router);
  payments = inject(PaymentsService);
  access$ = this.account.access$;
  plans = PLANS;
  pricing = PRICING;
  features = PRO_FEATURES;
  perDay = perDay;
  savingVsDay = savingVsDay;
  demo = environment.demoMode;
  selected: PlanId = 'month';
  busy: '' | 'card' | 'crypto' | 'start' = '';
  error = '';
  startNote = '';
  /** Checkout opened in a new tab and not confirmed yet. */
  waitingRef = '';
  checkoutUrl = '';

  constructor() {
    const ref = inject(ActivatedRoute).snapshot.queryParamMap.get('paid');
    if (ref) this.start(ref);
  }

  get plan(): Plan {
    return PLANS.find((p) => p.id === this.selected)!;
  }

  choose(id: PlanId) {
    this.selected = id;
    this.error = '';
  }

  /** Opens PayGate.to in a new tab; this page waits and switches the pass on when the payment lands. */
  async pay(method: 'card' | 'crypto') {
    this.error = '';
    this.startNote = '';
    if (this.demo) {
      this.account.demoStartPass(this.selected);
      this.router.navigateByUrl('/coach');
      return;
    }
    this.busy = method;
    // Open the tab now (in the click) so pop-up blockers allow it, then point it at the checkout.
    const tab = window.open('', '_blank');
    try {
      const { url, ref } = await this.payments.checkout(this.selected, method);
      this.waitingRef = ref;
      this.checkoutUrl = url;
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (e: any) {
      tab?.close();
      this.error = e.message;
    } finally {
      this.busy = '';
    }
  }

  /** "I've paid": switch the pass on now; the payment confirms it. */
  async paid() {
    if (!this.waitingRef) return;
    this.busy = 'start';
    await this.start(this.waitingRef);
    this.busy = '';
  }

  /** Switch the pass on now, then send the player to their table. */
  private async start(ref: string) {
    try {
      const status = await this.payments.startPass(ref);
      if (status === 'pending' || status === 'paid' || status === 'active') {
        this.router.navigateByUrl('/coach');
      } else if (status === 'confirming') {
        this.startNote = "Thanks! We're seeing your payment come through – your pass switches on automatically within a few minutes. You can stay on this page.";
      } else if (status === 'waiting') {
        this.startNote = "Thanks! Your earlier checkout is still confirming – this pass switches on automatically as soon as it's received.";
      } else {
        this.startNote = "We haven't received this payment yet. Once it arrives, your pass switches on automatically.";
      }
    } catch (e: any) {
      this.startNote = 'Thanks! Your pass switches on automatically as soon as the payment is received.';
    }
  }
}

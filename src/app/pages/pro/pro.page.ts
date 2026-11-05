import { Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
            <h1 *ngIf="a.isPaid">You're on Pro until {{ a.paidUntil | date: 'MMM d, h:mm a' }}</h1>
            <h1 *ngIf="!a.isPaid && a.onTrial">Keep your signals going</h1>
            <h1 *ngIf="!a.isPaid && !a.onTrial && !a.trialBlocked">Your free hours are up. Pick your pass.</h1>
            <h1 *ngIf="!a.isPaid && a.trialBlocked">Pick your pass to start</h1>
            <p class="tw-note" *ngIf="!a.isPaid && a.trialBlocked">Free hours are limited to 2 accounts per network, and this network has
              already used them. A pass unlocks everything straight away.</p>
            <p class="tw-muted lead">Every pass unlocks live signals, your session plan, the STOP alerts and your winnings wall.
              Buy once – no auto-renewal, no surprises.</p>
          </header>

          <div class="tw-note" *ngIf="paidReturn && !a.isPaid">
            Thanks! Crypto payments unlock automatically once the network confirms them – usually 5–30 minutes.
          </div>
          <div class="tw-note" *ngIf="done">Payment confirmed – Pro is active. Enjoy your session.</div>

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
              <ng-container *ngIf="payments.configured">
                <p class="pay-label" *ngIf="payments.paypalEnabled">PayPal or card</p>
                <div #paypal class="paypal"></div>
                <ng-container *ngIf="payments.cryptoEnabled">
                  <p class="pay-label">Crypto – BTC, ETH, USDT and 100+ more</p>
                  <button class="crypto" (click)="crypto()" [disabled]="busy">{{ busy ? 'Opening checkout…' : 'Pay \$' + plan.usd + ' with crypto' }}</button>
                </ng-container>
              </ng-container>
              <p class="tw-note" *ngIf="demo">Checkout is switched off in this demo. In the live app this box shows PayPal / card and crypto checkout for the pass you picked.</p>
              <p class="tw-note" *ngIf="!payments.configured && !demo">Checkout is not configured yet. Admin: set <code>payments.apiUrl</code> (README → Payments).</p>
              <p class="secure">🔒 Payments are processed by PayPal and NOWPayments. We never see your card or wallet keys.</p>
            </div>
          </section>

          <p class="tw-muted tw-small fine">
            Passes start when payment is confirmed and add to any time you have left. TableWise gives signals and session
            discipline; it does not take bets, and no system removes the house edge – some sessions lose.
            18+ only. Play only with money you can afford to lose.
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
    .paypal { margin-bottom: 14px; max-width: 380px; }
    .crypto { width: 100%; max-width: 380px; height: 50px; border-radius: 999px; border: 1px solid var(--tw-line-strong);
      background: var(--tw-card-2); color: var(--tw-text); font: inherit; font-weight: 700; cursor: pointer; }
    .crypto[disabled] { opacity: .6; }
    .secure { font-size: 12px; color: var(--tw-muted); margin-top: 12px; }
    .fine { margin-top: 18px; max-width: 760px; }
    code { color: var(--tw-gold-2); }
  `],
})
export class ProPage implements OnDestroy {
  @ViewChild('paypal') paypalEl?: ElementRef<HTMLElement>;
  private account = inject(AccountService);
  payments = inject(PaymentsService);
  access$ = this.account.access$;
  paidReturn = inject(ActivatedRoute).snapshot.queryParamMap.has('paid');
  plans = PLANS;
  pricing = PRICING;
  features = PRO_FEATURES;
  perDay = perDay;
  savingVsDay = savingVsDay;
  demo = environment.demoMode;
  selected: PlanId = 'month';
  busy = false;
  error = '';
  done = false;
  private renderTimer: any;

  constructor() {
    this.renderPayPal();
  }

  ngOnDestroy() {
    clearTimeout(this.renderTimer);
  }

  get plan(): Plan {
    return PLANS.find((p) => p.id === this.selected)!;
  }

  choose(id: PlanId) {
    this.selected = id;
    this.error = '';
    this.renderPayPal();
  }

  /** (Re)draws the PayPal buttons for the selected pass. */
  private renderPayPal() {
    if (!this.payments.paypalEnabled) return;
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => {
      if (!this.paypalEl) return;
      this.payments
        .renderPayPal(this.paypalEl.nativeElement, this.selected, () => (this.done = true), (msg) => (this.error = msg))
        .catch((e) => (this.error = e.message));
    }, 250);
  }

  async crypto() {
    this.busy = true;
    this.error = '';
    try {
      window.location.href = await this.payments.cryptoCheckout(this.selected);
    } catch (e: any) {
      this.error = e.message;
      this.busy = false;
    }
  }
}

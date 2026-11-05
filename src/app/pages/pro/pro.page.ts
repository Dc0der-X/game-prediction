import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccountService } from '../../core/account.service';
import { PaymentsService } from '../../core/payments.service';
import { FREE_FEATURES, PRICING, PRO_FEATURES } from '../../core/pricing';
import { TopbarComponent } from '../../shared/topbar.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-pro',
  standalone: true,
  imports: [IonicModule, RouterLink, NgIf, NgFor, AsyncPipe, DatePipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page">
        <ng-container *ngIf="access$ | async as a">
          <p class="tw-eyebrow">TableWise Pro</p>
          <h1 class="title">
            {{ a.isPaid ? 'You are on Pro' : a.onTrial ? 'Your free trial ends in ' + a.daysLeft + ' day' + (a.daysLeft === 1 ? '' : 's') : 'Your free trial has ended' }}
          </h1>
          <p class="tw-muted" *ngIf="a.isPaid">Paid until {{ a.paidUntil | date: 'mediumDate' }}. Thank you for supporting TableWise.</p>
          <div class="tw-note" *ngIf="paidReturn && !a.isPaid">
            Thanks! Crypto payments activate automatically once the network confirms them – usually 5–30 minutes.
            This page updates by itself.
          </div>

          <div class="plans">
            <div class="tw-card">
              <h3>Free</h3>
              <div class="price">$0</div>
              <ul><li *ngFor="let f of free">{{ f }}</li></ul>
              <ion-button fill="outline" routerLink="/lobby">Go to tables</ion-button>
            </div>

            <div class="tw-card felt pro">
              <span class="tw-pill gold">Most popular</span>
              <h3>Pro</h3>
              <div class="price">\${{ pricing.monthlyUsd }}<span>/month</span></div>
              <p class="tw-small">or \${{ pricing.yearlyUsd }}/year with crypto – save {{ yearlySaving }}%</p>
              <ul><li *ngFor="let f of pro">{{ f }}</li></ul>

              <ng-container *ngIf="!a.isPaid">
                <div class="tw-error" *ngIf="error">{{ error }}</div>
                <div class="tw-note" *ngIf="done">Payment confirmed – Pro is active. Enjoy!</div>

                <p class="pay-label" *ngIf="payments.paypalEnabled">Pay monthly with PayPal or card</p>
                <div #paypal class="paypal"></div>

                <ng-container *ngIf="payments.cryptoEnabled">
                  <p class="pay-label">Pay with crypto (BTC, ETH, USDT and 100+ more)</p>
                  <div class="tw-row">
                    <ion-button (click)="crypto(1)" [disabled]="busy">1 month · \${{ pricing.monthlyUsd }}</ion-button>
                    <ion-button fill="outline" (click)="crypto(12)" [disabled]="busy">12 months · \${{ pricing.yearlyUsd }}</ion-button>
                  </div>
                </ng-container>

                <p class="tw-note" *ngIf="demo">
                  Checkout is switched off in this demo. In the live app this box shows the PayPal subscribe button and
                  crypto checkout (1 month \${{ pricing.monthlyUsd }} / 12 months \${{ pricing.yearlyUsd }}).
                </p>
                <p class="tw-note" *ngIf="!payments.configured && !demo">
                  Checkout is not configured yet. Admin: set <code>payments.apiUrl</code> in the environment file
                  (see README → Payments).
                </p>
              </ng-container>
            </div>
          </div>

          <p class="tw-muted tw-small">
            PayPal subscriptions renew monthly and can be cancelled any time in your PayPal account – Pro stays active
            until the end of the paid month. Crypto payments are one-off and do not renew. TableWise is an entertainment
            and self-control tool: it does not predict results and cannot make you money.
          </p>
        </ng-container>
      </div>
    </ion-content>
  `,
  styles: [`
    .title { font-size: clamp(28px, 4.5vw, 40px); margin: 0 0 8px; }
    .plans { display: grid; grid-template-columns: 1fr 1.3fr; gap: 16px; margin: 24px 0; align-items: start; }
    @media (max-width: 760px) { .plans { grid-template-columns: 1fr; } }
    h3 { font-size: 22px; margin: 8px 0 4px; }
    .price { font-size: 40px; font-weight: 800; font-family: var(--tw-display); }
    .price span { font-size: 16px; color: var(--tw-muted); font-family: var(--tw-font); font-weight: 500; }
    ul { padding-left: 18px; line-height: 1.7; }
    .pro { border-width: 2px; }
    .pay-label { font-size: 13px; color: rgba(255,255,255,.8); margin: 18px 0 8px; font-weight: 600; }
    .paypal { max-width: 360px; }
    code { color: var(--tw-gold-2); }
  `],
})
export class ProPage implements AfterViewInit {
  @ViewChild('paypal') paypalEl?: ElementRef<HTMLElement>;
  private account = inject(AccountService);
  payments = inject(PaymentsService);
  access$ = this.account.access$;
  paidReturn = inject(ActivatedRoute).snapshot.queryParamMap.has('paid');
  pricing = PRICING;
  demo = environment.demoMode;
  free = FREE_FEATURES;
  pro = PRO_FEATURES;
  yearlySaving = Math.round((1 - PRICING.yearlyUsd / (PRICING.monthlyUsd * 12)) * 100);
  busy = false;
  error = '';
  done = false;

  ngAfterViewInit() {
    const uid = this.account.uid;
    if (!this.payments.paypalEnabled || !uid) return;
    // Wait one tick so the *ngIf block containing #paypal is rendered.
    setTimeout(() => {
      if (!this.paypalEl) return;
      this.payments
        .renderPayPal(
          this.paypalEl.nativeElement,
          uid,
          () => (this.done = true),
          (msg) => (this.error = msg)
        )
        .catch((e) => (this.error = e.message));
    }, 300);
  }

  async crypto(months: 1 | 12) {
    this.busy = true;
    this.error = '';
    try {
      window.location.href = await this.payments.cryptoCheckout(months);
    } catch (e: any) {
      this.error = e.message;
      this.busy = false;
    }
  }
}

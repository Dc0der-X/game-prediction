import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe, LowerCasePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { take } from 'rxjs';
import { AccountService } from '../../core/account.service';
import { TopbarComponent } from '../../shared/topbar.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, NgFor, AsyncPipe, DatePipe, DecimalPipe, LowerCasePipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page narrow" *ngIf="profile$ | async as p">
        <h1>Your account</h1>

        <div class="tw-card" *ngIf="access$ | async as a">
          <p class="tw-eyebrow">Plan</p>
          <h3 *ngIf="a.isAdmin">Admin – full access</h3>
          <h3 *ngIf="!a.isAdmin && a.isPaid && !a.paymentPending">Pro · until {{ a.paidUntil | date: 'mediumDate' }}</h3>
          <h3 *ngIf="!a.isAdmin && a.paymentPending">Pro · on – payment confirming</h3>
          <h3 *ngIf="!a.isAdmin && a.onHold">Pass paused – payment not received yet</h3>
          <h3 *ngIf="!a.isAdmin && a.onTrial">Free trial · ends {{ a.trialEndsAt | date: 'mediumDate' }}</h3>
          <h3 *ngIf="!a.isAdmin && !a.hasPro && !a.onHold">Free</h3>
          <ion-button size="small" routerLink="/pro" *ngIf="!a.isPaid && !a.isAdmin">Get a pass</ion-button>
        </div>

        <a class="tw-card goal-card" routerLink="/goal">
          <p class="tw-eyebrow">My goal</p>
          <h3 *ngIf="p.goal">{{ p.goal.start | number: '1.0-0' }} → {{ p.goal.target | number: '1.0-0' }}</h3>
          <h3 *ngIf="!p.goal">Set a goal – see how your wins compound</h3>
          <span class="tw-small go-link">Open the compounding calculator →</span>
        </a>

        <div class="tw-card">
          <p class="tw-eyebrow">Details</p>
          <label class="tw-field"><span>Email</span><input class="tw-input" [value]="p.email" disabled /></label>
          <label class="tw-field"><span>Name</span><input class="tw-input" [(ngModel)]="name" /></label>
          <label class="tw-field"><span>Phone</span><input class="tw-input" [(ngModel)]="phone" /></label>
          <label class="tw-field"><span>Telegram</span><input class="tw-input" [(ngModel)]="telegram" /></label>
          <div class="tw-note" *ngIf="saved">Saved.</div>
          <ion-button size="small" (click)="save(p.uid)">Save</ion-button>
        </div>

        <div class="tw-card danger" *ngIf="access$ | async as a">
          <p class="tw-eyebrow">Take a break</p>
          <ng-container *ngIf="a.selfExcludedUntil; else lock">
            <h3>Real-money sessions are locked until {{ a.selfExcludedUntil | date: 'medium' }}</h3>
            <p class="tw-muted tw-small">The lock cannot be shortened. Practice tables stay open.</p>
          </ng-container>
          <ng-template #lock>
            <p class="tw-muted tw-small">
              Lock the Session Coach for a while. Once set, the lock cannot be removed early – not even by support.
            </p>
            <div class="tw-row" *ngIf="!pendingDays">
              <ion-button *ngFor="let d of [1, 7, 30, 180]" size="small" fill="outline" color="danger" (click)="pendingDays = d">{{ lockLabel(d) }}</ion-button>
            </div>
            <div class="tw-note" *ngIf="pendingDays">
              Lock real-money sessions for {{ lockLabel(pendingDays) }}? This cannot be undone.
              <div class="tw-row" style="margin-top: 8px">
                <ion-button size="small" color="danger" (click)="exclude(p.uid, pendingDays)">Yes, lock for {{ lockLabel(pendingDays) }}</ion-button>
                <ion-button size="small" fill="clear" (click)="pendingDays = 0">Cancel</ion-button>
              </div>
            </div>
          </ng-template>
        </div>

        <ion-button fill="clear" color="medium" (click)="logout()">Log out</ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    h1 { margin: 0 0 16px; }
    .tw-card { margin-bottom: 16px; }
    h3 { margin: 0 0 8px; font-size: 18px; }
    .danger { border-color: rgba(224,82,82,.3); }
    .goal-card { display: block; text-decoration: none; color: inherit; border-color: rgba(var(--tw-accent-rgb), .45);
      background: linear-gradient(160deg, rgba(var(--tw-accent-rgb), .12), var(--tw-card) 60%); }
    .go-link { color: var(--tw-gold); font-weight: 700; }
  `],
})
export class AccountPage {
  private account = inject(AccountService);
  private router = inject(Router);
  profile$ = this.account.profile$;
  access$ = this.account.access$;
  name = '';
  phone = '';
  telegram = '';
  saved = false;

  constructor() {
    this.profile$.pipe(take(1)).subscribe((p) => {
      if (!p) return;
      this.name = p.name || '';
      this.phone = p.phone || '';
      this.telegram = p.telegram || '';
    });
  }

  async save(uid: string) {
    await this.account.updateDetails(uid, { name: this.name.trim(), phone: this.phone.trim(), telegram: this.telegram.trim() });
    this.saved = true;
    setTimeout(() => (this.saved = false), 2500);
  }

  /** Days chosen, waiting for the confirm tap (browser dialogs are blocked in some apps). */
  pendingDays = 0;

  async exclude(uid: string, days: number) {
    await this.account.selfExclude(uid, days);
    this.pendingDays = 0;
  }

  lockLabel(days: number) {
    return days === 1 ? '24 hours' : days === 180 ? '6 months' : `${days} days`;
  }

  async logout() {
    await this.account.signOut();
    this.router.navigateByUrl('/home');
  }
}

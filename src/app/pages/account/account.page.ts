import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe, LowerCasePipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { take } from 'rxjs';
import { AccountService } from '../../core/account.service';
import { TopbarComponent } from '../../shared/topbar.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, AsyncPipe, DatePipe, LowerCasePipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page narrow" *ngIf="profile$ | async as p">
        <h1>Your account</h1>

        <div class="tw-card" *ngIf="access$ | async as a">
          <p class="tw-eyebrow">Plan</p>
          <h3 *ngIf="a.isAdmin">Admin – full access</h3>
          <h3 *ngIf="!a.isAdmin && a.isPaid">Pro · paid until {{ a.paidUntil | date: 'mediumDate' }}</h3>
          <h3 *ngIf="!a.isAdmin && a.onTrial">Free trial · ends {{ a.trialEndsAt | date: 'mediumDate' }}</h3>
          <h3 *ngIf="!a.isAdmin && !a.hasPro">Free</h3>
          <p class="tw-muted tw-small" *ngIf="p.paypalStatus">PayPal subscription: {{ p.paypalStatus | lowercase }}</p>
          <ion-button size="small" routerLink="/pro" *ngIf="!a.isPaid && !a.isAdmin">See Pro plans</ion-button>
        </div>

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
            <div class="tw-row">
              <ion-button size="small" fill="outline" color="danger" (click)="exclude(p.uid, 1)">24 hours</ion-button>
              <ion-button size="small" fill="outline" color="danger" (click)="exclude(p.uid, 7)">7 days</ion-button>
              <ion-button size="small" fill="outline" color="danger" (click)="exclude(p.uid, 30)">30 days</ion-button>
              <ion-button size="small" fill="outline" color="danger" (click)="exclude(p.uid, 180)">6 months</ion-button>
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

  async exclude(uid: string, days: number) {
    const ok = confirm(`Lock real-money sessions for ${days === 1 ? '24 hours' : days + ' days'}? This cannot be undone.`);
    if (ok) await this.account.selfExclude(uid, days);
  }

  async logout() {
    await this.account.signOut();
    this.router.navigateByUrl('/home');
  }
}

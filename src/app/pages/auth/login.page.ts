import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccountService, authErrorMessage } from '../../core/account.service';
import { TopbarComponent } from '../../shared/topbar.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page narrow">
        <div class="tw-card">
          <p class="tw-eyebrow">Welcome back</p>
          <h1>Log in</h1>
          <form (ngSubmit)="submit()" #f="ngForm">
            <label class="tw-field"><span>Email</span>
              <input class="tw-input" type="email" name="email" [(ngModel)]="email" required autocomplete="email" /></label>
            <label class="tw-field"><span>Password</span>
              <input class="tw-input" type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
            <div class="tw-error" *ngIf="error">{{ error }}</div>
            <div class="tw-note" *ngIf="info">{{ info }}</div>
            <ion-button expand="block" type="submit" [disabled]="busy || !f.valid">{{ busy ? 'Logging in…' : 'Log in' }}</ion-button>
          </form>
          <div class="tw-row links">
            <button class="link" type="button" (click)="forgot()">Forgot password?</button>
            <span class="tw-spacer"></span>
            <a routerLink="/signup" [queryParams]="{ next: next }">Create an account</a>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    h1 { margin: 0 0 18px; }
    .links { margin-top: 14px; font-size: 14px; }
    .link { background: none; border: 0; color: var(--tw-gold); font: inherit; padding: 0; cursor: pointer; }
  `],
})
export class LoginPage {
  private account = inject(AccountService);
  private router = inject(Router);
  next = inject(ActivatedRoute).snapshot.queryParamMap.get('next') || '/lobby';
  email = '';
  password = '';
  busy = false;
  error = '';
  info = '';

  async submit() {
    this.busy = true;
    this.error = this.info = '';
    try {
      await this.account.signIn(this.email, this.password);
      this.router.navigateByUrl(safeNext(this.next));
    } catch (e) {
      this.error = authErrorMessage(e);
    } finally {
      this.busy = false;
    }
  }

  async forgot() {
    this.error = this.info = '';
    if (!this.email) {
      this.error = 'Enter your email above first.';
      return;
    }
    try {
      await this.account.resetPassword(this.email);
      this.info = 'If that email has an account, a reset link is on its way.';
    } catch (e) {
      this.error = authErrorMessage(e);
    }
  }
}

/** Only allow in-app redirects after login. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/lobby';
}

import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccountService, authErrorMessage } from '../../core/account.service';
import { TopbarComponent } from '../../shared/topbar.component';
import { environment } from 'src/environments/environment';
import { GoogleButtonComponent } from '../../shared/google-button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, TopbarComponent, GoogleButtonComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page narrow">
        <div class="tw-card">
          <p class="tw-eyebrow">Welcome back</p>
          <h1>Log in</h1>
          <p class="tw-note" *ngIf="demo">Demo: any email and a 6+ character password work.
            Use an email with <strong>admin</strong> in it (e.g. admin&#64;tablewise.test) to open the admin dashboard.</p>
          <app-google-button [busy]="gBusy" (pressed)="google()"></app-google-button>
          <div class="or"><span>or with email</span></div>
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
    .or { display: flex; align-items: center; gap: 10px; margin: 18px 0 14px; color: var(--tw-muted); font-size: 13px; }
    .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--tw-line-strong); }
    .link { background: none; border: 0; color: var(--tw-gold); font: inherit; padding: 0; cursor: pointer; }
  `],
})
export class LoginPage {
  private account = inject(AccountService);
  private router = inject(Router);
  next = inject(ActivatedRoute).snapshot.queryParamMap.get('next') || '/lobby';
  demo = environment.demoMode;
  email = '';
  password = '';
  busy = false;
  gBusy = false;
  error = '';
  info = '';

  async google() {
    this.gBusy = true;
    this.error = '';
    try {
      await this.account.signInWithGoogle();
      this.router.navigateByUrl(safeNext(this.next));
    } catch (e) {
      this.error = authErrorMessage(e);
    } finally {
      this.gBusy = false;
    }
  }

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

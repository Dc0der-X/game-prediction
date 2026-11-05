import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccountService, authErrorMessage } from '../../core/account.service';
import { PRICING, PRO_FEATURES } from '../../core/pricing';
import { TopbarComponent } from '../../shared/topbar.component';
import { safeNext } from './login.page';
import { GoogleButtonComponent } from '../../shared/google-button.component';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, NgFor, TopbarComponent, GoogleButtonComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page wrap">
        <div class="pitch">
          <p class="tw-eyebrow">{{ trialHours }} hours of full access, free</p>
          <h1>Win smarter. Keep more.</h1>
          <ul>
            <li *ngFor="let f of features">{{ f }}</li>
          </ul>
          <p class="tw-muted tw-small">No card needed. Practice tables stay free forever.</p>
        </div>

        <div class="tw-card">
          <h2>Create your account</h2>
          <app-google-button [busy]="gBusy" (pressed)="google()"></app-google-button>
          <p class="tw-muted tw-small consent">By continuing you confirm you're 18+ and agree to the <a routerLink="/terms">terms</a>.
            We only keep your name and email.</p>
          <div class="or"><span>or with email</span></div>
          <form (ngSubmit)="submit()" #f="ngForm">
            <label class="tw-field"><span>Name</span>
              <input class="tw-input" name="name" [(ngModel)]="name" required autocomplete="name" /></label>
            <label class="tw-field"><span>Email</span>
              <input class="tw-input" type="email" name="email" [(ngModel)]="email" required email autocomplete="email" /></label>
            <label class="tw-field"><span>Password (6+ characters)</span>
              <input class="tw-input" type="password" name="password" [(ngModel)]="password" required minlength="6" autocomplete="new-password" /></label>
            <label class="tw-check"><input type="checkbox" name="age" [(ngModel)]="age" required />
              <span>I am 18 or older and gambling is legal where I live.</span></label>
            <label class="tw-check"><input type="checkbox" name="terms" [(ngModel)]="terms" required />
              <span>I agree to the <a routerLink="/terms">terms</a>.</span></label>
            <div class="tw-error" *ngIf="error">{{ error }}</div>
            <ion-button expand="block" type="submit" [disabled]="busy || !f.valid || !age || !terms">
              {{ busy ? 'Creating account…' : 'Start my free trial' }}</ion-button>
          </form>
          <p class="tw-small tw-muted">Already have an account? <a routerLink="/login" [queryParams]="{ next: next }">Log in</a></p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
    @media (max-width: 820px) { .wrap { grid-template-columns: 1fr; } }
    .pitch h1 { font-size: clamp(28px, 4vw, 40px); margin: 0 0 16px; }
    .pitch ul { padding-left: 18px; line-height: 1.7; }
    h2 { margin: 0 0 16px; }
    .consent { margin: 10px 0 0; }
    .or { display: flex; align-items: center; gap: 10px; margin: 18px 0 14px; color: var(--tw-muted); font-size: 13px; }
    .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--tw-line-strong); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 420px) { .two { grid-template-columns: 1fr; } }
  `],
})
export class SignupPage {
  private account = inject(AccountService);
  private router = inject(Router);
  next = inject(ActivatedRoute).snapshot.queryParamMap.get('next') || '/coach';
  trialHours = PRICING.trialHours;
  features = PRO_FEATURES;
  name = '';
  email = '';
  password = '';
  age = false;
  terms = false;
  busy = false;
  gBusy = false;
  error = '';

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
    this.error = '';
    try {
      await this.account.signUp({
        name: this.name.trim(),
        email: this.email,
        password: this.password,
        phone: '',
        telegram: '',
      });
      this.router.navigateByUrl(safeNext(this.next));
    } catch (e) {
      this.error = authErrorMessage(e);
    } finally {
      this.busy = false;
    }
  }
}

import { Component, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccountService } from '../core/account.service';
import { environment } from 'src/environments/environment';
import { THEMES, ThemeId, ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [IonicModule, RouterLink, RouterLinkActive, NgIf, NgFor, AsyncPipe],
  template: `
    <ion-header class="ion-no-border">
      <div class="demo" *ngIf="demo">Demo · sample data, saved only in this browser · no real money or payments</div>
      <div class="bar">
        <a class="brand" routerLink="/coach">
          <span class="mark">♠</span><span>TableWise</span>
        </a>
        <div class="right" *ngIf="access$ | async as a">
          <button class="theme-btn" (click)="picker = !picker" [attr.aria-expanded]="picker" aria-label="Choose your colour theme">
            <span [style.background]="'linear-gradient(135deg,' + currentSwatch[0] + ' 50%,' + currentSwatch[1] + ' 50%)'"></span>
          </button>
          <ng-container *ngIf="a.signedIn; else guest">
            <a *ngIf="a.isAdmin" class="tw-pill gold" routerLink="/admin">Admin</a>
            <a *ngIf="!a.isAdmin && a.onTrial" class="tw-pill gold" routerLink="/pro">Free · {{ left(a.trialEndsAt) }} left</a>
            <a *ngIf="!a.isAdmin && a.isPaid" class="tw-pill green" routerLink="/account">Pro</a>
            <a *ngIf="!a.isAdmin && !a.hasPro" class="tw-pill gold" routerLink="/pro">Go Pro</a>
            <a class="icon" routerLink="/account" aria-label="Account"><ion-icon name="person-circle-outline"></ion-icon></a>
          </ng-container>
          <ng-template #guest>
            <a class="tw-pill" routerLink="/login">Log in</a>
            <a class="tw-pill gold" routerLink="/signup">Free trial</a>
          </ng-template>
        </div>
      </div>
      <div class="picker" *ngIf="picker" role="dialog" aria-label="Colour theme">
        <p>Make it yours</p>
        <button *ngFor="let t of themes" [class.on]="theme.current === t.id" (click)="pick(t.id)">
          <span class="sw" [style.background]="'linear-gradient(135deg,' + t.swatch[0] + ' 50%,' + t.swatch[1] + ' 50%)'"></span>
          <span><strong>{{ t.name }}</strong><small>{{ t.feel }}</small></span>
        </button>
      </div>
      <nav class="tabs">
        <a routerLink="/coach" routerLinkActive="on" class="primary">Signal Room</a>
        <a routerLink="/lobby" routerLinkActive="on">Practice</a>
        <a routerLink="/history" routerLinkActive="on">History</a>
      </nav>
    </ion-header>
  `,
  styles: [
    `
      ion-header { position: relative; background: var(--tw-bg); border-bottom: 1px solid var(--tw-line); }
      .demo { background: var(--tw-gold); color: #031019; text-align: center; font-size: 12px; font-weight: 700; padding: 5px 12px; }
      .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px;
        max-width: 1080px; margin: 0 auto; padding: 12px 16px 6px; }
      .brand { display: flex; align-items: center; gap: 8px; color: var(--tw-text); text-decoration: none;
        font-family: var(--tw-display); font-size: 20px; font-weight: 700; }
      .mark { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
        background: var(--tw-gold); color: #031019; font-size: 18px; }
      .right { display: flex; align-items: center; gap: 8px; }
      .right a { text-decoration: none; }
      .icon { color: var(--tw-text); font-size: 28px; display: flex; }
      .theme-btn { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--tw-line-strong); background: var(--tw-card-2);
        display: grid; place-items: center; cursor: pointer; padding: 0; }
      .theme-btn span { width: 20px; height: 20px; border-radius: 50%; display: block; box-shadow: 0 0 0 2px rgba(255,255,255,.15); }
      .picker { position: absolute; right: max(16px, calc((100vw - 1080px) / 2 + 16px)); top: 58px; z-index: 50; width: 260px;
        padding: 12px; border-radius: 16px; background: var(--tw-card); border: 1px solid var(--tw-line-strong);
        box-shadow: 0 20px 50px rgba(0,0,0,.5); display: grid; gap: 6px; }
      .picker p { margin: 0 0 4px; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--tw-gold); }
      .picker button { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 12px; border: 1px solid transparent;
        background: transparent; color: var(--tw-text); font: inherit; text-align: left; cursor: pointer; }
      .picker button:hover { background: var(--tw-card-2); }
      .picker button.on { border-color: var(--tw-gold); background: var(--tw-card-2); }
      .picker .sw { width: 30px; height: 30px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px rgba(255,255,255,.15); }
      .picker strong { display: block; font-size: 14px; } .picker small { color: var(--tw-muted); font-size: 12px; }
      .tabs { display: flex; gap: 4px; overflow-x: auto; max-width: 1080px; margin: 0 auto;
        padding: 4px 12px 8px; scrollbar-width: none; }
      .tabs::-webkit-scrollbar { display: none; }
      .tabs a { flex: none; padding: 8px 12px; border-radius: 999px; color: var(--tw-muted);
        text-decoration: none; font-size: 14px; font-weight: 600; }
      .tabs a.on { background: var(--tw-card-2); color: var(--tw-gold-2); }
      .tabs a.primary { color: var(--tw-gold-2); }
      .tabs a.primary::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        background: var(--tw-green); margin-right: 7px; vertical-align: middle; box-shadow: 0 0 8px var(--tw-green); }
    `,
  ],
})
export class TopbarComponent {
  access$ = inject(AccountService).access$;
  router = inject(Router);
  demo = environment.demoMode;
  theme = inject(ThemeService);
  themes = THEMES;
  picker = false;

  get currentSwatch(): [string, string] {
    return THEMES.find((t) => t.id === this.theme.current)!.swatch;
  }

  pick(id: ThemeId) {
    this.theme.set(id);
    this.picker = false;
  }

  left(end: Date | null): string {
    const m = Math.max(0, Math.floor(((end?.getTime() ?? 0) - Date.now()) / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
}

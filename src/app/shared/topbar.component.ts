import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccountService } from '../core/account.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [IonicModule, RouterLink, RouterLinkActive, NgIf, AsyncPipe],
  template: `
    <ion-header class="ion-no-border">
      <div class="bar">
        <a class="brand" routerLink="/lobby">
          <span class="mark">♠</span><span>TableWise</span>
        </a>
        <div class="right" *ngIf="access$ | async as a">
          <ng-container *ngIf="a.signedIn; else guest">
            <a *ngIf="a.isAdmin" class="tw-pill gold" routerLink="/admin">Admin</a>
            <a *ngIf="!a.isAdmin && a.onTrial" class="tw-pill gold" routerLink="/pro">Trial · {{ a.daysLeft }}d left</a>
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
      <nav class="tabs">
        <a routerLink="/lobby" routerLinkActive="on">Tables</a>
        <a routerLink="/rules" routerLinkActive="on">Table Rules</a>
        <a routerLink="/coach" routerLinkActive="on">Session Coach</a>
        <a routerLink="/lab" routerLinkActive="on">Strategy Lab</a>
        <a routerLink="/history" routerLinkActive="on">History</a>
      </nav>
    </ion-header>
  `,
  styles: [
    `
      ion-header { background: var(--tw-bg); border-bottom: 1px solid var(--tw-line); }
      .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px;
        max-width: 1080px; margin: 0 auto; padding: 12px 16px 6px; }
      .brand { display: flex; align-items: center; gap: 8px; color: var(--tw-text); text-decoration: none;
        font-family: var(--tw-display); font-size: 20px; font-weight: 700; }
      .mark { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
        background: var(--tw-gold); color: #1b1405; font-size: 18px; }
      .right { display: flex; align-items: center; gap: 8px; }
      .right a { text-decoration: none; }
      .icon { color: var(--tw-text); font-size: 28px; display: flex; }
      .tabs { display: flex; gap: 4px; overflow-x: auto; max-width: 1080px; margin: 0 auto;
        padding: 4px 12px 8px; scrollbar-width: none; }
      .tabs::-webkit-scrollbar { display: none; }
      .tabs a { flex: none; padding: 8px 12px; border-radius: 999px; color: var(--tw-muted);
        text-decoration: none; font-size: 14px; font-weight: 600; }
      .tabs a.on { background: var(--tw-card-2); color: var(--tw-gold-2); }
    `,
  ],
})
export class TopbarComponent {
  access$ = inject(AccountService).access$;
  router = inject(Router);
}

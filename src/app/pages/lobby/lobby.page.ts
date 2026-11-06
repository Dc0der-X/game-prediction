import { Component, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TopbarComponent } from '../../shared/topbar.component';
import { GAMES, getBet } from '../../core/games';
import { AccountService } from '../../core/account.service';
import { dealerFor } from '../../core/dealers';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [IonicModule, RouterLink, NgFor, NgIf, AsyncPipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page">
        <section class="hero tw-card felt">
          <div>
            <p class="tw-eyebrow">Practice lobby</p>
            <h1>Live dealer tables, free play money.</h1>
            <p class="tw-muted">
              A dealer, a betting timer and real round rhythm – just like a live casino – with the same signals and a training
              coach. Get the feel here, then take the signals to your real table.
            </p>
          </div>
          <div class="hero-cta" *ngIf="access$ | async as a">
            <ion-button *ngIf="!a.signedIn" routerLink="/signup">Start free – 3 hours</ion-button>
            <ion-button *ngIf="a.signedIn && a.hasPro" routerLink="/coach">Open the Signal Room</ion-button>
            <ion-button *ngIf="a.signedIn && !a.hasPro" routerLink="/pro">Get your pass</ion-button>
            <ion-button fill="clear" routerLink="/rules">How it works</ion-button>
          </div>
        </section>

        <h2 class="section">Tables</h2>
        <div class="tw-grid">
          <a class="table" *ngFor="let g of games; let i = index" [routerLink]="['/live', g.id]">
            <div class="img" [style.background-image]="'url(' + dealer(g).image + ')'"
              [style.background-position]="dealer(g).focusX + '% 22%'">
              <span class="dealer-tag">{{ dealer(g).tableName }}</span>
            </div>
            <div class="body">
              <div class="tw-row">
                <h3>{{ g.name }}</h3>
                <span class="tw-spacer"></span>
                <span class="tw-pill live"><i></i> LIVE</span>
              </div>
              <p class="tw-muted tw-small">{{ g.blurb }}</p>
              <p class="tw-small">Dealer <strong>{{ dealer(g).name }}</strong></p>
              <p class="tw-small">Signals on <strong class="tw-gold">{{ sidesLabel(g) }}</strong></p>
              <span class="play">Join the live table →</span>
            </div>
          </a>
        </div>

        <p class="tw-muted tw-small foot">
          18+ only. Play within your budget.
        </p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .hero { display: grid; gap: 16px; grid-template-columns: 1.6fr 1fr; align-items: center; padding: 28px; }
      .hero h1 { font-size: clamp(26px, 4vw, 38px); margin: 0 0 8px; }
      .hero-cta { display: flex; flex-direction: column; gap: 6px; }
      @media (max-width: 720px) { .hero { grid-template-columns: 1fr; padding: 20px; } }
      .section { margin: 32px 0 14px; font-size: 22px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
      .section span { font-family: var(--tw-font); font-weight: 500; }
      .table { display: block; text-decoration: none; color: inherit; background: var(--tw-card);
        border: 1px solid var(--tw-line); border-radius: var(--tw-radius); overflow: hidden;
        transition: transform .15s ease, border-color .15s ease; }
      .table:hover { transform: translateY(-3px); border-color: rgba(var(--tw-accent-rgb), .45); }
      .dealer-tag { position: absolute; left: 10px; bottom: 10px; z-index: 1; padding: 2px 9px; border-radius: 6px; font-size: 11px; font-weight: 800;
        letter-spacing: .12em; color: #1a1205; background: linear-gradient(180deg, #e9c873, #b8913c); }
      .img { height: 150px; background-size: cover; background-position: center; position: relative; }
      .img::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(10,19,16,.9)); }
      .rank { position: absolute; top: 10px; left: 10px; z-index: 1; background: rgba(0,0,0,.6);
        padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; }
      .body { padding: 14px 16px 16px; }
      .body h3 { margin: 0; font-size: 19px; }
      .body p { margin: 8px 0 0; }
      .play { display: inline-block; margin-top: 12px; color: var(--tw-gold); font-weight: 700; font-size: 14px; }
      .foot { margin-top: 32px; }
      .tw-pill.live { background: rgba(255, 59, 78, .15); color: #ff8a96; border-color: rgba(255, 59, 78, .5); font-weight: 800; letter-spacing: .08em; }
      .tw-pill.live i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ff3b4e; margin-right: 4px; box-shadow: 0 0 8px #ff3b4e; }
    `,
  ],
})
export class LobbyPage {
  access$ = inject(AccountService).access$;
  games = GAMES;

  dealer(g: (typeof GAMES)[number]) {
    return dealerFor(g.id);
  }

  sidesLabel(g: (typeof GAMES)[number]) {
    return (g.sides ?? [g.bestBet]).map((id) => getBet(g, id)!.label).join(' / ');
  }
}

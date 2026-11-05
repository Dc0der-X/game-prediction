import { Component, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TopbarComponent } from '../../shared/topbar.component';
import { GAMES, getBet, pct } from '../../core/games';
import { AccountService } from '../../core/account.service';

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
            <h1>Pick a table. Play-money is unlimited.</h1>
            <p class="tw-muted">
              Real odds, real payouts, fair shuffles. Learn every game here first –
              then use the Session Coach when you play for real.
            </p>
          </div>
          <div class="hero-cta" *ngIf="access$ | async as a">
            <ion-button *ngIf="!a.signedIn" routerLink="/signup">Start 7-day free Pro trial</ion-button>
            <ion-button *ngIf="a.signedIn && a.hasPro" routerLink="/coach">Open Session Coach</ion-button>
            <ion-button *ngIf="a.signedIn && !a.hasPro" routerLink="/pro">Unlock Pro</ion-button>
            <ion-button fill="clear" routerLink="/rules">Read the Table Rules</ion-button>
          </div>
        </section>

        <h2 class="section">Tables <span class="tw-muted tw-small">ranked by house edge – lower is better</span></h2>
        <div class="tw-grid">
          <a class="table" *ngFor="let g of games; let i = index" [routerLink]="['/table', g.id]">
            <div class="img" [style.background-image]="'url(' + g.image + ')'">
              <span class="rank">#{{ i + 1 }}</span>
            </div>
            <div class="body">
              <div class="tw-row">
                <h3>{{ g.name }}</h3>
                <span class="tw-spacer"></span>
                <span class="tw-pill" [class.green]="edge(g) < 0.02" [class.gold]="edge(g) >= 0.02 && edge(g) < 0.05"
                      [class.red]="edge(g) >= 0.05">{{ pct(edge(g)) }} edge</span>
              </div>
              <p class="tw-muted tw-small">{{ g.blurb }}</p>
              <p class="tw-small">Best bet: <strong class="tw-gold">{{ bestLabel(g) }}</strong></p>
              <span class="play">Enter table →</span>
            </div>
          </a>
        </div>

        <p class="tw-muted tw-small foot">
          18+ only. No betting system beats the house edge – TableWise helps you play for fun with
          limits. Need help? <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a>
          · <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener">Gamblers Anonymous</a>
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
      .table:hover { transform: translateY(-3px); border-color: rgba(92,225,255,.45); }
      .img { height: 130px; background-size: cover; background-position: center; position: relative; }
      .img::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(10,19,16,.9)); }
      .rank { position: absolute; top: 10px; left: 10px; z-index: 1; background: rgba(0,0,0,.6);
        padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; }
      .body { padding: 14px 16px 16px; }
      .body h3 { margin: 0; font-size: 19px; }
      .body p { margin: 8px 0 0; }
      .play { display: inline-block; margin-top: 12px; color: var(--tw-gold); font-weight: 700; font-size: 14px; }
      .foot { margin-top: 32px; }
    `,
  ],
})
export class LobbyPage {
  access$ = inject(AccountService).access$;
  // Sorted by the house edge of each game's best bet.
  games = [...GAMES].sort((a, b) => this.edge(a) - this.edge(b));
  pct = pct;

  edge(g: (typeof GAMES)[number]) {
    return getBet(g, g.bestBet)!.edge;
  }
  bestLabel(g: (typeof GAMES)[number]) {
    return getBet(g, g.bestBet)!.label;
  }
}

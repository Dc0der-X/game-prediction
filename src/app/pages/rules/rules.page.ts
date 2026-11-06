import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TopbarComponent } from '../../shared/topbar.component';
import { TABLE_RULES } from '../../core/strategies';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [IonicModule, RouterLink, NgFor, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page">
        <p class="tw-eyebrow">How it works</p>
        <h1 class="title">Tap. Bet. Cash out on top.</h1>
        <p class="lead tw-muted">
          You don't need to learn anything. Open your live table, tap what came, and bet exactly what the signal shows.
          The coach handles the side, the amount and the moment to cash out.
        </p>

        <ol class="rules">
          <li *ngFor="let r of rules; let i = index" class="tw-card">
            <span class="n">{{ i + 1 }}</span>
            <div><h3>{{ r.title }}</h3><p class="tw-muted">{{ r.text }}</p></div>
          </li>
        </ol>

        <div class="tw-row">
          <ion-button routerLink="/coach">Open the Signal Room</ion-button>
          <ion-button fill="outline" routerLink="/lobby">Warm up on a practice table</ion-button>
        </div>

        <p class="tw-muted tw-small foot">18+. Play within your budget – the coach keeps every bet inside your safety limit.
          Need a break? Use the pause option in your account, or talk to
          <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a>.</p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .title { font-size: clamp(30px, 5vw, 44px); margin: 0 0 10px; }
      .lead { max-width: 720px; font-size: 17px; }
      .rules { list-style: none; padding: 0; display: grid; gap: 12px; margin: 24px 0; }
      .rules li { display: flex; gap: 16px; align-items: flex-start; }
      .rules h3 { margin: 2px 0 4px; font-size: 18px; }
      .rules p { margin: 0; }
      .n { flex: none; width: 36px; height: 36px; border-radius: 50%; background: var(--tw-gold); color: var(--tw-on-accent);
        display: grid; place-items: center; font-weight: 800; }
      .foot { margin-top: 28px; max-width: 720px; }
    `,
  ],
})
export class RulesPage {
  rules = TABLE_RULES;
}

import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TopbarComponent } from '../../shared/topbar.component';
import { GAMES, getBet, pct } from '../../core/games';
import { STRATEGIES, TABLE_RULES } from '../../core/strategies';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [IonicModule, RouterLink, NgFor, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page">
        <p class="tw-eyebrow">One rule set for every game</p>
        <h1 class="title">The Table Rules</h1>
        <p class="lead tw-muted">
          Every casino game has a built-in house edge and each round is independent – no system changes that.
          What you <em>can</em> control is how much you risk, how long you play and when you walk away. TableWise
          Signals tell you where and how much to bet, and the STOP rules make sure you leave on time.
        </p>

        <ol class="rules">
          <li *ngFor="let r of rules; let i = index" class="tw-card">
            <span class="n">{{ i + 1 }}</span>
            <div><h3>{{ r.title }}</h3><p class="tw-muted">{{ r.text }}</p></div>
          </li>
        </ol>

        <h2>House edge by game</h2>
        <div class="tw-card table-wrap">
          <table>
            <thead><tr><th>Game</th><th>Lowest-edge bet</th><th>House edge</th><th>Avoid</th></tr></thead>
            <tbody>
              <tr *ngFor="let g of games">
                <td>{{ g.name }}</td>
                <td class="tw-gold">{{ best(g).label }}</td>
                <td>{{ pct(best(g).edge) }}</td>
                <td class="tw-muted">{{ avoid(g) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>What each system really costs</h2>
        <div class="tw-card">
          <p>
            Baccarat Banker, 9,000+ simulated 20-round sessions with a $200 budget, $4 base stake and STOP at +$20 / -$40.
            The STOP rules cap every system at the same worst session. Systems that step up after losses win
            <strong>more often</strong> but stake more, so their average cost is a little higher.
          </p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>System</th><th>Winning sessions</th><th>Average cost per session</th><th>Worst session</th></tr></thead>
              <tbody>
                <tr class="good"><td>TableWise Signals</td><td>64%</td><td>-$0.98</td><td>-$40 (STOP)</td></tr>
                <tr><td>Flat</td><td>48%</td><td>-$0.80</td><td>-$40 (STOP)</td></tr>
                <tr><td>Martingale</td><td>63%</td><td>-$0.92</td><td>-$40 (STOP)</td></tr>
              </tbody>
            </table>
          </div>
          <p class="tw-muted tw-small">No system changes the house edge. Run your own numbers in the <a routerLink="/lab">Strategy Lab</a>.</p>
        </div>

        <h2>Systems you can test with play money</h2>
        <div class="tw-grid">
          <div class="tw-card" *ngFor="let s of strategies">
            <h3>{{ s.name }}</h3>
            <p class="tw-muted tw-small">{{ s.summary }}</p>
            <span class="tw-pill" [class.green]="s.realMoney" [class.red]="!s.realMoney">
              {{ s.realMoney ? 'Used by the Session Coach' : 'Practice only' }}</span>
          </div>
        </div>

        <div class="tw-card help">
          <h3>When it stops being fun</h3>
          <p class="tw-muted">
            Chasing losses, borrowing to play or hiding it from others are warning signs. Use the self-exclusion
            lock in your account and talk to someone:
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener">BeGambleAware</a> ·
            <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener">GamCare</a> ·
            <a href="https://www.ncpgambling.org/help-treatment/" target="_blank" rel="noopener">1-800-GAMBLER (US)</a> ·
            <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener">Gamblers Anonymous</a>
          </p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .title { font-size: clamp(30px, 5vw, 44px); margin: 0 0 10px; }
      .lead { max-width: 720px; font-size: 17px; }
      h2 { margin: 36px 0 14px; }
      .rules { list-style: none; padding: 0; display: grid; gap: 12px; margin: 24px 0; }
      .rules li { display: flex; gap: 16px; align-items: flex-start; }
      .rules h3 { margin: 2px 0 4px; font-size: 18px; }
      .rules p { margin: 0; }
      .n { flex: none; width: 36px; height: 36px; border-radius: 50%; background: var(--tw-gold); color: #031019;
        display: grid; place-items: center; font-weight: 800; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--tw-line); white-space: nowrap; }
      th { color: var(--tw-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
      tr.good td { color: #7fe0b0; font-weight: 600; }
      .help { margin-top: 32px; border-color: rgba(224,82,82,.35); }
    `,
  ],
})
export class RulesPage {
  rules = TABLE_RULES;
  strategies = STRATEGIES;
  games = GAMES;
  pct = pct;
  best(g: (typeof GAMES)[number]) {
    return getBet(g, g.bestBet)!;
  }
  avoid(g: (typeof GAMES)[number]) {
    const worst = [...g.bets].sort((a, b) => b.edge - a.edge)[0];
    return worst.edge - this.best(g).edge < 0.001
      ? 'Every bet has the same edge'
      : `${worst.label} (${pct(worst.edge)})`;
  }
}

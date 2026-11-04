import { Component } from '@angular/core';
import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TopbarComponent } from '../../shared/topbar.component';
import { GAMES, GameDef, getGame, pct } from '../../core/games';
import { STRATEGIES, SimResult, StrategyId, simulate } from '../../core/strategies';

@Component({
  selector: 'app-lab',
  standalone: true,
  imports: [IonicModule, FormsModule, NgFor, NgIf, DecimalPipe, TopbarComponent],
  template: `
    <app-topbar></app-topbar>
    <ion-content>
      <div class="tw-page">
        <p class="tw-eyebrow">Strategy Lab</p>
        <h1 class="title">Test any system on 9,000 sessions</h1>
        <p class="tw-muted lead">
          Same random engine as the practice tables. Pick a system and see what happens over months, not minutes.
          Compare any system against Flat to see what it really costs you.
        </p>

        <div class="layout">
          <div class="tw-card">
            <label class="tw-field"><span>Game</span>
              <select class="tw-select" [(ngModel)]="gameId" (ngModelChange)="betId = game.bestBet">
                <option *ngFor="let g of games" [value]="g.id">{{ g.name }}</option>
              </select></label>
            <label class="tw-field"><span>Bet</span>
              <select class="tw-select" [(ngModel)]="betId">
                <option *ngFor="let b of game.bets" [value]="b.id">{{ b.label }} ({{ b.pays }}, {{ pct(b.edge) }} edge)</option>
              </select></label>
            <label class="tw-field"><span>System</span>
              <select class="tw-select" [(ngModel)]="strategy">
                <option *ngFor="let s of strategies" [value]="s.id">{{ s.name }}</option>
              </select></label>
            <div class="two">
              <label class="tw-field"><span>Budget</span><input class="tw-input" type="number" [(ngModel)]="bankroll" min="10" /></label>
              <label class="tw-field"><span>Base stake</span><input class="tw-input" type="number" [(ngModel)]="unit" min="1" /></label>
              <label class="tw-field"><span>Stop when up (0 = never)</span><input class="tw-input" type="number" [(ngModel)]="stopWin" min="0" /></label>
              <label class="tw-field"><span>Stop when down (0 = never)</span><input class="tw-input" type="number" [(ngModel)]="stopLoss" min="0" /></label>
              <label class="tw-field"><span>Rounds per session</span><input class="tw-input" type="number" [(ngModel)]="rounds" min="1" max="500" /></label>
            </div>
            <ion-button expand="block" (click)="run()" [disabled]="busy">{{ busy ? 'Simulating…' : 'Run 9,000 sessions' }}</ion-button>
          </div>

          <div class="tw-card felt" *ngIf="result as r; else empty">
            <h3>{{ strategyName }} · {{ game.name }}</h3>
            <div class="tw-stats">
              <div class="tw-stat"><div class="label">Winning sessions</div><div class="value">{{ r.winRate * 100 | number: '1.0-1' }}%</div></div>
              <div class="tw-stat"><div class="label">Average win</div><div class="value tw-pos">+{{ r.avgWin | number: '1.2-2' }}</div></div>
              <div class="tw-stat"><div class="label">Average loss</div><div class="value tw-neg">{{ r.avgLoss | number: '1.2-2' }}</div></div>
              <div class="tw-stat"><div class="label">Average per session</div>
                <div class="value" [class.tw-neg]="r.avgNet < 0" [class.tw-pos]="r.avgNet > 0">{{ r.avgNet | number: '1.2-2' }}</div></div>
              <div class="tw-stat key"><div class="label">Real cost per session</div><div class="value tw-neg">-{{ r.expectedCost | number: '1.2-2' }}</div></div>
              <div class="tw-stat"><div class="label">Average staked per session</div><div class="value">{{ r.avgWagered | number: '1.0-0' }}</div></div>
              <div class="tw-stat"><div class="label">Worst 1-in-10 session</div><div class="value tw-neg">{{ r.worstTenth | number: '1.0-0' }}</div></div>
              <div class="tw-stat"><div class="label">Lost whole budget</div><div class="value">{{ r.bustRate * 100 | number: '1.0-1' }}%</div></div>
              <div class="tw-stat"><div class="label">Ahead after 30 sessions</div><div class="value">{{ r.monthAheadRate * 100 | number: '1.0-0' }}%</div></div>
              <div class="tw-stat"><div class="label">Average 30-session total</div>
                <div class="value" [class.tw-neg]="r.monthAvg < 0" [class.tw-pos]="r.monthAvg > 0">{{ r.monthAvg | number: '1.0-0' }}</div></div>
            </div>

            <p class="tw-eyebrow hist-title">Distribution of session results</p>
            <div class="hist" role="img" aria-label="Histogram of session results">
              <div *ngFor="let b of r.histogram" class="bar" [class.neg]="b.to <= 0" [style.height.%]="(b.count / maxBin) * 100"
                   [title]="(b.from | number: '1.0-0') + ' to ' + (b.to | number: '1.0-0') + ': ' + b.count + ' sessions'"></div>
            </div>
            <div class="hist-axis tw-small tw-muted">
              <span>{{ r.histogram[0].from | number: '1.0-0' }}</span><span>losses red · wins green</span><span>{{ r.histogram[r.histogram.length - 1].to > 0 ? '+' : '' }}{{ r.histogram[r.histogram.length - 1].to | number: '1.0-0' }}</span>
            </div>

            <p class="tw-note">{{ verdict(r) }}</p>
          </div>
          <ng-template #empty>
            <div class="tw-card felt">
              <h3>How to read the results</h3>
              <p class="tw-small">"Winning sessions" is how often you walk away up. "Real cost per session" is what you really
                pay to play (amount staked × house edge) – it doesn't change with luck. A system that wins most sessions
                can still cost more if it stakes more.</p>
            </div>
          </ng-template>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .title { margin: 0 0 8px; font-size: clamp(28px, 4.5vw, 38px); }
    .lead { max-width: 720px; }
    .layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; margin-top: 18px; align-items: start; }
    @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; }
    .two .tw-field span { min-height: 34px; }
    h3 { margin-top: 0; }
    .tw-stat { background: rgba(0,0,0,.22); }
    .tw-stat .value { font-size: 19px; }
    .tw-stat.key { border-color: rgba(232,194,106,.6); }
    .hist-title { margin-top: 18px; }
    .hist { display: flex; align-items: flex-end; gap: 3px; height: 120px; }
    .bar { flex: 1; background: var(--tw-green); border-radius: 4px 4px 0 0; min-height: 2px; }
    .bar.neg { background: var(--tw-red); }
    .hist-axis { display: flex; justify-content: space-between; margin-top: 4px; }
  `],
})
export class LabPage {
  games = GAMES;
  strategies = STRATEGIES;
  pct = pct;
  gameId = 'baccarat';
  betId = 'banker';
  strategy: StrategyId = 'ladder';
  bankroll = 200;
  unit = 4;
  stopWin = 20;
  stopLoss = 40;
  rounds = 20;
  busy = false;
  result: SimResult | null = null;
  maxBin = 1;
  strategyName = '';

  get game(): GameDef {
    return getGame(this.gameId)!;
  }

  run() {
    this.busy = true;
    // Let the button repaint before the CPU-heavy loop.
    setTimeout(() => {
      this.result = simulate({
        game: this.game,
        betId: this.betId,
        strategy: this.strategy,
        bankroll: Math.max(1, Number(this.bankroll) || 0),
        unit: Math.max(1, Number(this.unit) || 0),
        stopWin: Math.max(0, Number(this.stopWin) || 0),
        stopLoss: Math.max(0, Number(this.stopLoss) || 0),
        rounds: Math.min(500, Math.max(1, Number(this.rounds) || 1)),
        sessions: 9000,
      });
      this.maxBin = Math.max(...this.result.histogram.map((b) => b.count), 1);
      this.strategyName = STRATEGIES.find((s) => s.id === this.strategy)!.name;
      this.busy = false;
    }, 30);
  }

  verdict(r: SimResult): string {
    const wins = Math.round(r.winRate * 100);
    const cost = r.expectedCost.toFixed(2);
    const lead = r.avgNet >= 0 ? 'This sample came out ahead by luck – run it again. ' : '';
    if (r.winRate > 0.6)
      return `${lead}You win ${wins}% of sessions, but the real cost is ${cost} per session: the losing sessions are much bigger than the wins, and bigger stakes after losses mean more money exposed to the house edge.`;
    return `${lead}You win ${wins}% of sessions and the real cost is ${cost} per session – the price of playing. Smaller, flat stakes keep it lowest.`;
  }
}

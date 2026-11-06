import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';

/**
 * Full-screen "STOP PLAYING NOW" sign.
 *  kind="final"   – a limit or the timer was hit; the only way out is the stop button.
 *  kind="checkin" – the regular interval check-in; the player may stop or continue.
 */
import { formatMoney } from '../core/money';
@Component({
  selector: 'app-stop-sign',
  standalone: true,
  imports: [NgIf, DecimalPipe],
  template: `
    <div class="backdrop" role="alertdialog" aria-modal="true" aria-labelledby="stop-title">
      <div class="panel" [class.final]="kind === 'final'" [class.amber]="icon === 'switch'" [class.green]="icon === 'cash'">
        <div class="octagon" aria-hidden="true" *ngIf="icon === 'stop'"><span>STOP</span></div>
        <div class="switch" aria-hidden="true" *ngIf="icon === 'switch'">⇄</div>
        <div class="cash" aria-hidden="true" *ngIf="icon === 'cash'">{{ symbol }}</div>
        <h2 id="stop-title">{{ title || (kind === 'final' ? 'SESSION COMPLETE' : 'QUICK CHECK-IN') }}</h2>
        <p class="reason">{{ reason }}</p>
        <div class="net" *ngIf="net !== null" [class.pos]="net > 0" [class.neg]="net < 0">
          {{ shownNet }}
        </div>
        <p class="hint">{{ hint }}</p>
        <div class="actions">
          <button class="stop" (click)="stop.emit()">{{ stopLabel }}</button>
          <button class="cont" *ngIf="kind === 'checkin'" (click)="continue.emit()">{{ continueLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px;
      background: rgba(5, 8, 7, 0.82); backdrop-filter: blur(4px); animation: fade .2s ease-out;
    }
    .panel {
      width: min(440px, 100%); text-align: center; padding: 28px 22px 22px; border-radius: 22px;
      background: var(--tw-card); border: 2px solid rgba(224, 82, 82, .55); box-shadow: 0 30px 80px rgba(0,0,0,.6);
      animation: pop .25s ease-out;
    }
    .panel.final { border-color: var(--tw-red); }
    .panel.amber { border-color: rgba(245, 199, 106, .7); }
    .panel.amber h2 { color: var(--tw-money); }
    .panel.amber .stop { background: transparent; color: var(--tw-muted); border: 1px solid var(--tw-line-strong); font-weight: 600; }
    .panel.amber .cont { background: var(--tw-money); color: #1a1205; border: 0; font-weight: 800; }
    .panel.green { border-color: rgba(46, 204, 113, .7); }
    .panel.green h2 { color: #6ff0a8; }
    .panel.green .stop { background: #2ecc71; color: #04210f; border: 0; font-weight: 800; }
    .panel.green .cont { background: transparent; color: var(--tw-muted); border: 1px solid var(--tw-line-strong); font-weight: 600; }
    .cash { width: 120px; height: 120px; margin: 0 auto 14px; border-radius: 50%; display: grid; place-items: center;
      font-size: 60px; font-weight: 900; color: #04210f; background: radial-gradient(circle at 35% 30%, #b9ffd6, #2ecc71);
      box-shadow: 0 0 0 6px rgba(46,204,113,.18), 0 0 46px rgba(46,204,113,.5); animation: pulse 1.2s ease-in-out infinite alternate; }
    .switch { width: 120px; height: 120px; margin: 0 auto 14px; border-radius: 50%; display: grid; place-items: center;
      font-size: 56px; color: #1a1205; background: radial-gradient(circle at 35% 30%, #ffe3a3, var(--tw-money));
      box-shadow: 0 0 0 6px rgba(245,199,106,.18), 0 0 40px rgba(245,199,106,.45); animation: spin 2.4s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .octagon {
      width: 132px; height: 132px; margin: 0 auto 14px; display: grid; place-items: center;
      background: #d62d2d; color: #fff; font-weight: 900; font-size: 40px; letter-spacing: .04em;
      clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
      box-shadow: inset 0 0 0 6px #fff;
      animation: pulse 1.2s ease-in-out infinite alternate;
    }
    .octagon span { font-family: var(--tw-font); }
    h2 { margin: 0 0 8px; font-family: var(--tw-font); font-weight: 900; font-size: 26px; color: #ff9b9b; letter-spacing: .02em; }
    .reason { margin: 0 0 8px; font-weight: 600; }
    .net { font-size: 38px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .net.pos { color: var(--tw-green); } .net.neg { color: var(--tw-text); opacity: .85; }
    .hint { color: var(--tw-muted); font-size: 14px; margin: 8px 0 18px; }
    .actions { display: grid; gap: 8px; }
    button { height: 52px; border-radius: 999px; border: 0; font: inherit; font-weight: 800; font-size: 16px; cursor: pointer; }
    .stop { background: #d62d2d; color: #fff; }
    .cont { background: transparent; color: var(--tw-muted); border: 1px solid var(--tw-line-strong); font-weight: 600; }
    @keyframes fade { from { opacity: 0 } }
    @keyframes pop { from { transform: scale(.92); opacity: 0 } }
    @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.05) } }
    @media (prefers-reduced-motion: reduce) { .octagon, .panel, .backdrop, .switch { animation: none; } }
  `],
})
export class StopSignComponent {
  @Input() kind: 'final' | 'checkin' = 'final';
  @Input() title = '';
  @Input() icon: 'stop' | 'switch' | 'cash' = 'stop';
  @Input() reason = '';
  @Input() hint = '';
  @Input() net: number | null = null;
  /** Currency of `net` (ISO code); amounts then show as "+₹54". */
  @Input() currency = 'USD';

  get shownNet(): string {
    return formatMoney(this.net ?? 0, this.currency, true);
  }

  get symbol(): string {
    return formatMoney(0, this.currency).replace(/[\d\s.,]/g, '') || '$';
  }
  @Input() stopLabel = 'I have stopped';
  @Input() continueLabel = 'Continue';
  @Output() stop = new EventEmitter<void>();
  @Output() continue = new EventEmitter<void>();
}

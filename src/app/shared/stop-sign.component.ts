import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe, NgIf } from '@angular/common';

/**
 * Full-screen "STOP PLAYING NOW" sign.
 *  kind="final"   – a limit or the timer was hit; the only way out is the stop button.
 *  kind="checkin" – the regular interval check-in; the player may stop or continue.
 */
@Component({
  selector: 'app-stop-sign',
  standalone: true,
  imports: [NgIf, DecimalPipe],
  template: `
    <div class="backdrop" role="alertdialog" aria-modal="true" aria-labelledby="stop-title">
      <div class="panel" [class.final]="kind === 'final'">
        <div class="octagon" aria-hidden="true"><span>STOP</span></div>
        <h2 id="stop-title">{{ title || (kind === 'final' ? 'STOP PLAYING NOW' : 'STOP PLAYING NOW?') }}</h2>
        <p class="reason">{{ reason }}</p>
        <div class="net" *ngIf="net !== null" [class.pos]="net > 0" [class.neg]="net < 0">
          {{ net > 0 ? '+' : '' }}{{ net | number: '1.0-2' }}
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
    .net.pos { color: var(--tw-green); } .net.neg { color: var(--tw-red); }
    .hint { color: var(--tw-muted); font-size: 14px; margin: 8px 0 18px; }
    .actions { display: grid; gap: 8px; }
    button { height: 52px; border-radius: 999px; border: 0; font: inherit; font-weight: 800; font-size: 16px; cursor: pointer; }
    .stop { background: #d62d2d; color: #fff; }
    .cont { background: transparent; color: var(--tw-muted); border: 1px solid var(--tw-line-strong); font-weight: 600; }
    @keyframes fade { from { opacity: 0 } }
    @keyframes pop { from { transform: scale(.92); opacity: 0 } }
    @keyframes pulse { from { transform: scale(1) } to { transform: scale(1.05) } }
    @media (prefers-reduced-motion: reduce) { .octagon, .panel, .backdrop { animation: none; } }
  `],
})
export class StopSignComponent {
  @Input() kind: 'final' | 'checkin' = 'final';
  @Input() title = '';
  @Input() reason = '';
  @Input() hint = '';
  @Input() net: number | null = null;
  @Input() stopLabel = 'I have stopped';
  @Input() continueLabel = 'Continue';
  @Output() stop = new EventEmitter<void>();
  @Output() continue = new EventEmitter<void>();
}

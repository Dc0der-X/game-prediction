import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { NgIf } from '@angular/common';
import { CasinoDealer, DealerPhase } from '../../core/dealers';

/**
 * Live-table dealer, filmed like a live casino stream: the dealer's own photo from the character
 * registry with a camera that follows the round –
 *   betting  slow push-in while bets are placed
 *   closing  quick move to the dealer's face + "No more bets" sweep
 *   dealing  camera drops to the table (her hands) and drifts with the action
 *   result   pulls back to the full shot with a soft light
 * If a short video clip is listed for her in the registry for a phase, it plays instead.
 * Never distorted (object-fit: cover); if the photo cannot load her name plate is shown instead.
 */
@Component({
  selector: 'app-live-dealer',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="dealer" *ngIf="dealer" [class]="'dealer ph-' + phase">
      <div class="frame" [style.--fx]="dealer.focusX + '%'">
        <div class="cam-rig">
          <video *ngIf="clip; else still" [src]="clip" autoplay muted playsinline [loop]="phase === 'betting'"
            [attr.aria-label]="dealer.role + ' ' + dealer.name" (error)="clipFailed = true"></video>
          <ng-template #still>
            <img *ngIf="!failed" [src]="dealer.image" [alt]="dealer.role + ' ' + dealer.name"
              [style.object-position]="dealer.focusX + '% 30%'" (error)="failed = true" />
            <div *ngIf="failed" class="plate-only">{{ dealer.tableName }}</div>
          </ng-template>
        </div>
        <div class="sweep" *ngIf="phase === 'closing'"><span>No more bets</span></div>
        <div class="flash" *ngIf="phase === 'result'"></div>
        <span class="cam"><i></i> LIVE</span>
        <span class="tag">{{ dealer.tableName }}</span>
      </div>
      <div class="bubble" *ngIf="line">{{ line }}</div>
    </div>
  `,
  styles: [`
    .dealer { position: relative; width: 100%; margin: 0 auto; }
    .frame { position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 16px; overflow: hidden; background: #120c08;
      border: 1px solid rgba(201, 162, 74, .45); box-shadow: 0 22px 50px rgba(0,0,0,.55); transition: border-color .4s ease, box-shadow .4s ease; }
    img, video { display: block; width: 100%; height: 100%; object-fit: cover; }

    /* The camera: one transform per phase, eased between phases like a real camera operator. */
    .cam-rig { width: 100%; height: 100%; transform-origin: var(--fx) 35%;
      transition: transform 1.1s cubic-bezier(.3, .7, .2, 1), transform-origin 1.1s ease; }
    .ph-betting .cam-rig { animation: push 15s linear forwards; }
    .ph-betting img { animation: breathe 6s ease-in-out infinite; transform-origin: 50% 70%; }
    .ph-closing .cam-rig { transform: scale(1.16); transform-origin: var(--fx) 4%; transition-duration: .55s; }
    .ph-dealing .cam-rig { transform-origin: var(--fx) 92%; animation: table 3.2s ease-in-out infinite; transform: scale(1.14); }
    .ph-result .cam-rig { transform: scale(1); }
    @keyframes push { from { transform: scale(1); } to { transform: scale(1.06); } }
    @keyframes breathe { 50% { transform: scale(1.012); } }
    @keyframes table { 0%, 100% { transform: scale(1.14) translateX(0); } 50% { transform: scale(1.17) translateX(-1.5%); } }

    .ph-closing .frame { border-color: rgba(255, 77, 109, .8); box-shadow: 0 0 0 2px rgba(255, 77, 109, .35), 0 22px 50px rgba(0,0,0,.55); }
    .ph-result .frame { border-color: rgba(233, 200, 115, .9); }
    .sweep { position: absolute; left: 0; right: 0; bottom: 18%; z-index: 1; display: grid; place-items: center; pointer-events: none; }
    .sweep span { padding: 6px 18px; border-radius: 8px; background: rgba(150, 18, 40, .88); color: #fff; font-weight: 800; letter-spacing: .14em;
      text-transform: uppercase; font-size: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.4); animation: sweep .55s cubic-bezier(.2, .8, .2, 1); }
    @keyframes sweep { from { transform: translateX(-120%) skewX(-12deg); opacity: 0; } }
    .flash { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(70% 60% at var(--fx) 30%, rgba(255, 226, 150, .45), transparent 70%);
      animation: flash 1.4s ease-out forwards; }
    @keyframes flash { from { opacity: 1; } to { opacity: 0; } }

    .frame::after { content: ''; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(180deg, transparent 72%, rgba(6, 41, 26, .55)); }
    .plate-only { height: 100%; display: grid; place-items: center; color: #e9c873; font: 700 28px/1 Georgia, serif; letter-spacing: .12em; }
    .cam { position: absolute; top: 10px; left: 10px; z-index: 2; padding: 3px 8px; border-radius: 6px; background: rgba(0,0,0,.55);
      color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .1em; }
    .cam i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #ff3b4e; margin-right: 4px; box-shadow: 0 0 8px #ff3b4e;
      animation: rec 1.6s ease-in-out infinite; }
    @keyframes rec { 50% { opacity: .35; } }
    .tag { position: absolute; bottom: 10px; left: 10px; z-index: 2; padding: 3px 10px; border-radius: 6px; background: linear-gradient(180deg, #e9c873, #b8913c);
      color: #1a1205; font-size: 12px; font-weight: 800; letter-spacing: .12em; }
    .bubble { position: absolute; left: 50%; top: -8px; transform: translate(-50%, -100%); z-index: 3; white-space: nowrap; padding: 8px 14px;
      border-radius: 14px; background: #fff; color: #121418; font-weight: 700; font-size: 14px; box-shadow: 0 10px 24px rgba(0,0,0,.35);
      animation: pop .25s ease-out; }
    .bubble::after { content: ''; position: absolute; left: 50%; bottom: -7px; border: 7px solid transparent; border-top-color: #fff; border-bottom: 0; transform: translateX(-50%); }
    @keyframes pop { from { transform: translate(-50%, -90%) scale(.9); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .cam-rig, img, .cam i, .sweep span, .flash { animation: none !important; transition: none !important; }
      .cam-rig { transform: none !important; }
    }
  `],
})
export class LiveDealerComponent implements OnChanges {
  @Input() dealer!: CasinoDealer;
  @Input() line = '';
  @Input() phase: DealerPhase = 'betting';
  failed = false;
  clipFailed = false;

  /** Video clip for the current phase, if the registry lists one for this dealer. */
  get clip(): string | null {
    return this.clipFailed ? null : this.dealer?.clips?.[this.phase] ?? null;
  }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['dealer']) this.failed = false;
    if (ch['dealer'] || ch['phase']) this.clipFailed = false;
  }
}

import { Component, Input, OnChanges } from '@angular/core';
import { NgIf } from '@angular/common';

/**
 * Live-table dealer. Uses a real photo when one is in src/assets/dealers (see dealers.json):
 *   - one photo per dealer: sofia.jpg / maya.png / elena.webp / lina.jpg
 *   - or one 4-panel group photo team.(jpg|png|webp): Sofia, Maya, Elena, Lina left to right
 * Otherwise an illustrated croupier (SVG). The dealer "speaks" through a bubble.
 */
@Component({
  selector: 'app-live-dealer',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="dealer" [class.working]="working">
      <img *ngIf="photo && !panel" class="photo" [src]="photo" [alt]="'Dealer ' + name" (error)="photo = null" />
      <div *ngIf="photo && panel" class="photo panel" role="img" [attr.aria-label]="'Dealer ' + name"
        [style.background-image]="'url(' + photo + ')'" [style.background-position]="panel"></div>
      <svg *ngIf="!photo" viewBox="0 0 220 230" role="img" [attr.aria-label]="'Dealer ' + name">
        <defs>
          <linearGradient id="skin" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f1c7a3" /><stop offset="1" stop-color="#d9a57f" /></linearGradient>
          <linearGradient id="hair" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3b2418" /><stop offset="1" stop-color="#1e120b" /></linearGradient>
          <linearGradient id="vest" x1="0" x2="1"><stop offset="0" stop-color="#16181d" /><stop offset="1" stop-color="#262a33" /></linearGradient>
        </defs>
        <!-- hair back + bun -->
        <ellipse cx="110" cy="58" rx="44" ry="48" fill="url(#hair)" />
        <circle cx="110" cy="14" r="17" fill="url(#hair)" />
        <!-- neck -->
        <rect x="98" y="92" width="24" height="24" rx="8" fill="url(#skin)" />
        <!-- body: shirt, waistcoat, bow tie -->
        <path d="M40 230 C42 160 70 120 110 116 C150 120 178 160 180 230 Z" fill="#f5f6f8" />
        <path d="M58 230 C62 175 80 140 100 128 L110 160 L120 128 C140 140 158 175 162 230 Z" fill="url(#vest)" />
        <circle cx="110" cy="172" r="3" fill="#c9a24a" /><circle cx="110" cy="190" r="3" fill="#c9a24a" /><circle cx="110" cy="208" r="3" fill="#c9a24a" />
        <path d="M96 118 L110 124 L96 132 Z M124 118 L110 124 L124 132 Z" fill="#b3192e" /><circle cx="110" cy="124" r="4" fill="#8f1224" />
        <!-- name badge -->
        <rect x="128" y="160" width="30" height="11" rx="2" fill="#c9a24a" /><text x="143" y="168.5" font-size="7" text-anchor="middle" fill="#1a1205" font-family="sans-serif" font-weight="700">{{ name.toUpperCase() }}</text>
        <!-- arms -->
        <g class="arm left"><path d="M52 190 C40 200 38 214 60 222 L92 214" stroke="#f5f6f8" stroke-width="16" fill="none" stroke-linecap="round" /><circle cx="94" cy="213" r="8" fill="url(#skin)" /></g>
        <g class="arm right"><path d="M168 190 C180 200 182 214 160 222 L128 214" stroke="#f5f6f8" stroke-width="16" fill="none" stroke-linecap="round" /><circle cx="126" cy="213" r="8" fill="url(#skin)" /></g>
        <!-- face -->
        <ellipse cx="110" cy="66" rx="33" ry="38" fill="url(#skin)" />
        <path d="M77 60 C80 30 140 26 143 60 C135 44 118 38 104 40 C92 42 82 50 77 60 Z" fill="url(#hair)" />
        <g class="eyes"><ellipse cx="97" cy="66" rx="4" ry="4.5" fill="#2b1d16" /><ellipse cx="123" cy="66" rx="4" ry="4.5" fill="#2b1d16" />
          <circle cx="98.4" cy="64.6" r="1.2" fill="#fff" /><circle cx="124.4" cy="64.6" r="1.2" fill="#fff" /></g>
        <path d="M90 56 Q97 52 104 56 M116 56 Q123 52 130 56" stroke="#3b2418" stroke-width="2" fill="none" stroke-linecap="round" />
        <path d="M108 72 Q110 80 112 72" stroke="#c48b66" stroke-width="1.6" fill="none" />
        <path d="M100 86 Q110 93 120 86" stroke="#a8434f" stroke-width="3" fill="none" stroke-linecap="round" />
        <circle cx="90" cy="80" r="5" fill="#e79a8f" opacity=".35" /><circle cx="130" cy="80" r="5" fill="#e79a8f" opacity=".35" />
      </svg>
      <div class="bubble" *ngIf="line">{{ line }}</div>
    </div>
  `,
  styles: [`
    .dealer { position: relative; width: 100%; max-width: 230px; margin: 0 auto; }
    svg { display: block; width: 100%; height: auto; filter: drop-shadow(0 18px 30px rgba(0,0,0,.45)); }
    .eyes { animation: blink 5s infinite; transform-origin: 110px 66px; }
    @keyframes blink { 0%, 95%, 100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
    .arm { transition: transform .4s ease; }
    .working .arm.right { animation: deal 1s ease-in-out infinite; transform-origin: 168px 190px; }
    .working .arm.left { animation: deal 1s ease-in-out infinite .5s; transform-origin: 52px 190px; }
    @keyframes deal { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-9deg) translateY(-4px); } }
    .photo { display: block; width: 100%; aspect-ratio: 3 / 4; object-fit: cover; object-position: top center; border-radius: 18px 18px 0 0;
      -webkit-mask-image: linear-gradient(180deg, #000 78%, transparent); mask-image: linear-gradient(180deg, #000 78%, transparent);
      filter: drop-shadow(0 18px 30px rgba(0,0,0,.45)); animation: breathe 5s ease-in-out infinite; transform-origin: 50% 100%; }
    @keyframes breathe { 50% { transform: scale(1.012); } }
    .panel { background-repeat: no-repeat; background-size: 400% auto; }
    .working .photo { animation: lean 1.6s ease-in-out infinite; }
    @keyframes lean { 50% { transform: translateY(2px) rotate(-.6deg); } }
    .bubble { position: absolute; left: 50%; top: -6px; transform: translate(-50%, -100%); white-space: nowrap; padding: 8px 14px;
      border-radius: 14px; background: #fff; color: #121418; font-weight: 700; font-size: 14px; box-shadow: 0 10px 24px rgba(0,0,0,.35);
      animation: pop .25s ease-out; }
    .bubble::after { content: ''; position: absolute; left: 50%; bottom: -7px; border: 7px solid transparent; border-top-color: #fff; border-bottom: 0; transform: translateX(-50%); }
    @keyframes pop { from { transform: translate(-50%, -90%) scale(.9); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .eyes, .working .arm { animation: none; } }
  `],
})
export class LiveDealerComponent implements OnChanges {
  @Input() name = 'Sofia';
  @Input() line = '';
  @Input() working = false;
  /** Photo URL for this dealer, or null for the illustrated dealer. */
  photo: string | null = null;
  /** For the 4-panel group photo: which part of it shows this dealer (CSS background-position). */
  panel: string | null = null;

  ngOnChanges() {
    const key = this.name.toLowerCase();
    dealerPhotos().then((list) => {
      if (this.name.toLowerCase() !== key) return; // dealer changed meanwhile
      const own = list.find((f) => f.split('.')[0] === key);
      const team = list.find((f) => f.split('.')[0] === 'team');
      const i = TEAM_ORDER.indexOf(key);
      if (own) {
        this.photo = `assets/dealers/${own}`;
        this.panel = null;
      } else if (team && i >= 0) {
        this.photo = `assets/dealers/${team}`;
        this.panel = `${(i / 3) * 100}% ${TEAM_TOP}%`;
      } else {
        this.photo = null;
        this.panel = null;
      }
    });
  }
}

/** Left-to-right order of the dealers in the group photo. */
const TEAM_ORDER = ['sofia', 'maya', 'elena', 'lina'];
/** Vertical crop of the group photo: 0 = top edge, 100 = bottom (keeps face to hands in view). */
const TEAM_TOP = 22;

let photoList: Promise<string[]> | null = null;
/** The dealer photos that exist (assets/dealers/dealers.json, e.g. ["sofia.jpg"]). Loaded once. */
function dealerPhotos(): Promise<string[]> {
  if (!photoList) {
    photoList = fetch('assets/dealers/dealers.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => (Array.isArray(l) ? l.filter((x) => typeof x === 'string') : []))
      .catch(() => []);
  }
  return photoList;
}

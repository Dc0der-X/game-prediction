import { Component, Input } from '@angular/core';
import { NgSwitch, NgSwitchCase } from '@angular/common';

/** A gold line-art emblem for each game: roulette wheel, baccarat cards, dragon | tiger, sic bo dice, craps dice. */
@Component({
  selector: 'app-game-emblem',
  standalone: true,
  imports: [NgSwitch, NgSwitchCase],
  template: `
    <span class="em" [style.width.px]="size" [style.height.px]="size" aria-hidden="true" [ngSwitch]="game">
      <!-- Roulette: wheel with spokes and the ball -->
      <svg *ngSwitchCase="'roulette'" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="15" class="s" /><circle cx="20" cy="20" r="10" class="s thin" /><circle cx="20" cy="20" r="3.2" class="f" />
        <path class="s thin" d="M20 5v5M20 30v5M5 20h5M30 20h5M9.4 9.4l3.5 3.5M27.1 27.1l3.5 3.5M30.6 9.4l-3.5 3.5M12.9 27.1l-3.5 3.5" />
        <circle cx="27.5" cy="12" r="1.9" class="ball" />
      </svg>
      <!-- Baccarat: two playing cards -->
      <svg *ngSwitchCase="'baccarat'" viewBox="0 0 40 40">
        <rect x="7" y="9" width="15" height="22" rx="2.5" class="s" transform="rotate(-12 14.5 20)" />
        <rect x="17" y="8" width="15" height="22" rx="2.5" class="s card" transform="rotate(10 24.5 19)" />
        <path class="f" d="M24.6 14.2c1.8 2.3 4 3.6 4 5.6 0 1.4-1.1 2.3-2.3 2.3-.7 0-1.3-.3-1.7-.8.3 1.2.8 2.1 1.5 2.7h-3c.7-.6 1.2-1.5 1.5-2.7-.4.5-1 .8-1.7.8-1.2 0-2.3-.9-2.3-2.3 0-2 2.2-3.3 4-5.6z" transform="rotate(10 24.5 19)" />
      </svg>
      <!-- Dragon Tiger: a split coin, D | T -->
      <svg *ngSwitchCase="'dragon-tiger'" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" class="s" /><path class="s thin" d="M20 4v32" />
        <text x="11.8" y="25.4" class="t" text-anchor="middle">D</text><text x="28.2" y="25.4" class="t" text-anchor="middle">T</text>
      </svg>
      <!-- Sic Bo: three dice -->
      <svg *ngSwitchCase="'sicbo'" viewBox="0 0 40 40">
        <rect x="5" y="17" width="13" height="13" rx="3" class="s" /><rect x="22" y="17" width="13" height="13" rx="3" class="s" />
        <rect x="13.5" y="5" width="13" height="13" rx="3" class="s card" />
        <circle cx="20" cy="11.5" r="1.6" class="f" /><circle cx="8.8" cy="20.8" r="1.4" class="f" /><circle cx="14.2" cy="26.2" r="1.4" class="f" />
        <circle cx="25.8" cy="20.8" r="1.4" class="f" /><circle cx="31.2" cy="20.8" r="1.4" class="f" /><circle cx="25.8" cy="26.2" r="1.4" class="f" /><circle cx="31.2" cy="26.2" r="1.4" class="f" />
      </svg>
      <!-- Craps: a pair of dice, one tilted -->
      <svg *ngSwitchCase="'craps'" viewBox="0 0 40 40">
        <rect x="5" y="13" width="15" height="15" rx="3.2" class="s" transform="rotate(-10 12.5 20.5)" />
        <rect x="20" y="11" width="15" height="15" rx="3.2" class="s card" transform="rotate(12 27.5 18.5)" />
        <g transform="rotate(-10 12.5 20.5)"><circle cx="9" cy="17" r="1.5" class="f" /><circle cx="12.5" cy="20.5" r="1.5" class="f" /><circle cx="16" cy="24" r="1.5" class="f" /></g>
        <g transform="rotate(12 27.5 18.5)"><circle cx="24" cy="15" r="1.5" class="f" /><circle cx="31" cy="15" r="1.5" class="f" /><circle cx="24" cy="22" r="1.5" class="f" /><circle cx="31" cy="22" r="1.5" class="f" /></g>
      </svg>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .em { display: grid; place-items: center; border-radius: 50%; color: #f6d892;
      background: radial-gradient(circle at 35% 28%, rgba(255, 236, 180, .22), rgba(10, 11, 14, .78) 70%);
      box-shadow: inset 0 0 0 1.5px rgba(227, 185, 101, .75), 0 6px 18px rgba(0, 0, 0, .45);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    svg { width: 70%; height: 70%; overflow: visible; }
    .s { fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
    .s.thin { stroke-width: 1.5; opacity: .85; }
    .s.card { fill: rgba(10, 11, 14, .65); }
    .f { fill: currentColor; stroke: none; }
    .ball { fill: #fff8e6; }
    .t { fill: currentColor; font: 700 15px Georgia, 'Playfair Display', serif; }
  `],
})
export class GameEmblemComponent {
  @Input({ required: true }) game!: string;
  @Input() size = 44;
}

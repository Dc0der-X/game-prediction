import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { NgIf } from '@angular/common';
import { GameDef } from '../core/games';
import { dealerFor } from '../core/dealers';
import { pop, tilt } from './motion';

/** A game as a dealer card: her photo, the game, a gold ring when picked. Leans toward the pointer. */
@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [NgIf],
  template: `
    <button #el type="button" class="gc" [class.on]="selected" [class.lg]="size === 'lg'" (click)="choose()"
      [attr.aria-pressed]="selected" [attr.aria-label]="game.name + ' with dealer ' + dealer.name">
      <img [src]="dealer.image" alt="" [style.object-position]="dealer.focusX + '% 22%'" loading="lazy" />
      <span class="shade"></span>
      <span class="shine"></span>
      <span class="txt">
        <strong>{{ game.name }}</strong>
        <small>{{ dealer.name }}'s table</small>
      </span>
      <span class="check" *ngIf="selected" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </button>
  `,
  styles: [`
    :host { display: block; }
    .gc { position: relative; width: 100%; aspect-ratio: 4 / 5; border: 0; padding: 0; border-radius: 22px; overflow: hidden; cursor: pointer;
      background: #101215; color: #fff; text-align: left; transform-style: preserve-3d;
      box-shadow: 0 16px 36px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.08); transition: box-shadow .25s ease; }
    .gc.lg { aspect-ratio: 3 / 4; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.04); transition: transform .5s ease; }
    .gc:hover img { transform: scale(1.09); }
    .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(6,7,9,.92) 100%); }
    .shine { position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.18) 48%, transparent 62%);
      transform: translateX(-120%); transition: transform .8s ease; }
    .gc:hover .shine, .gc.on .shine { transform: translateX(120%); }
    .txt { position: absolute; left: 16px; right: 16px; bottom: 14px; display: grid; gap: 2px; }
    strong { font: 700 22px/1.1 var(--tw-serif); letter-spacing: -.01em; }
    small { font-size: 13px; color: rgba(255,255,255,.75); }
    .gc.on { box-shadow: 0 18px 40px rgba(0,0,0,.5), 0 0 0 2px #e3b965, 0 0 30px rgba(227,185,101,.35); }
    .check { position: absolute; top: 12px; right: 12px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
      background: linear-gradient(135deg, #f8df9c, #dcae52 50%, #b5852f); color: #1a1205; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
    .check svg { width: 18px; height: 18px; }
    .gc:focus-visible { outline: 2px solid #f6d892; outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) { img, .shine { transition: none; } }
  `],
})
export class GameCardComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) game!: GameDef;
  @Input() selected = false;
  @Input() size: 'md' | 'lg' = 'md';
  @Output() pick = new EventEmitter<void>();
  @ViewChild('el', { static: true }) el!: ElementRef<HTMLElement>;
  private untilt = () => {};

  get dealer() {
    return dealerFor(this.game.id);
  }

  ngAfterViewInit() {
    this.untilt = tilt(this.el.nativeElement, 6);
  }

  ngOnDestroy() {
    this.untilt();
  }

  choose() {
    pop(this.el.nativeElement);
    this.pick.emit();
  }
}

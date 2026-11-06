import { Component, EventEmitter, Output, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Country, MoneyService, allCountries } from '../core/money';

/**
 * "🇮🇳 India · ₹" pill. Tapping it opens a searchable list of every country; the choice is remembered,
 * and every amount in the app switches to that currency.
 */
@Component({
  selector: 'app-country-picker',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  template: `
    <button type="button" class="pill" (click)="open = true" [attr.aria-label]="'Country: ' + money.country.name + '. Change'">
      <span class="flag" aria-hidden="true">{{ money.country.flag }}</span>
      <span>{{ money.country.name }}</span>
      <b>{{ symbol }}</b>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
    </button>

    <div class="backdrop" *ngIf="open" (click)="open = false"></div>
    <div class="sheet" *ngIf="open" role="dialog" aria-label="Choose your country">
      <div class="head">
        <h3>Where do you play from?</h3>
        <p>Amounts and bets follow your country's currency and table sizes.</p>
        <input class="tw-input" type="search" [(ngModel)]="q" placeholder="Search country or currency" aria-label="Search country" autofocus />
      </div>
      <div class="list">
        <button type="button" *ngFor="let c of filtered" [class.on]="c.code === money.country.code" (click)="choose(c)">
          <span class="flag" aria-hidden="true">{{ c.flag }}</span>
          <span class="name">{{ c.name }}</span>
          <span class="cur">{{ c.currency }}</span>
        </button>
        <p class="none" *ngIf="!filtered.length">No match – try the currency code (e.g. INR).</p>
      </div>
      <button type="button" class="close" (click)="open = false">Close</button>
    </div>
  `,
  styles: [`
    .pill { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 12px 6px 10px; border-radius: 999px; cursor: pointer;
      background: rgba(var(--tw-ink-rgb), .06); border: 1px solid var(--tw-line-strong); color: var(--tw-text); font: 600 14px/1 var(--tw-font); }
    .pill b { color: var(--tw-gold-2); font-weight: 800; }
    .pill svg { width: 16px; height: 16px; opacity: .7; }
    .flag { font-size: 18px; line-height: 1; }
    .backdrop { position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,.55); backdrop-filter: blur(3px); animation: fade .2s ease; }
    .sheet { position: fixed; z-index: 1201; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(460px, calc(100vw - 24px));
      max-height: min(640px, calc(100vh - 40px)); display: flex; flex-direction: column; border-radius: 22px; overflow: hidden;
      background: var(--tw-card); border: 1px solid var(--tw-line-strong); box-shadow: 0 30px 80px rgba(0,0,0,.6); animation: rise .28s cubic-bezier(.2,.8,.2,1); }
    .head { padding: 20px 20px 12px; }
    h3 { margin: 0 0 4px; font: 700 22px/1.2 var(--tw-serif); }
    .head p { margin: 0 0 12px; color: var(--tw-muted); font-size: 14px; }
    .list { overflow-y: auto; padding: 0 8px 8px; }
    .list button { width: 100%; display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 8px 12px; border: 0; border-radius: 12px;
      background: transparent; color: var(--tw-text); font: 500 15px/1.2 var(--tw-font); cursor: pointer; text-align: left; }
    .list button:hover { background: rgba(var(--tw-ink-rgb), .06); }
    .list button.on { background: rgba(var(--tw-accent-rgb), .14); }
    .name { flex: 1; }
    .cur { font: 600 12px/1 var(--tw-mono); color: var(--tw-muted); }
    .none { color: var(--tw-muted); padding: 12px; }
    .close { margin: 0; min-height: 48px; border: 0; border-top: 1px solid var(--tw-line); background: transparent; color: var(--tw-gold-2); font: 700 15px var(--tw-font); cursor: pointer; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes rise { from { opacity: 0; transform: translate(-50%, -46%); } }
    @media (prefers-reduced-motion: reduce) { .backdrop, .sheet { animation: none; } }
  `],
})
export class CountryPickerComponent {
  money = inject(MoneyService);
  @Output() changed = new EventEmitter<Country>();
  open = false;
  q = '';
  private all = allCountries();

  get symbol(): string {
    try {
      return (0).toLocaleString(undefined, { style: 'currency', currency: this.money.currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 } as Intl.NumberFormatOptions).replace(/[\d\s.,]/g, '') || this.money.currency;
    } catch {
      return this.money.currency;
    }
  }

  get filtered(): Country[] {
    const q = this.q.trim().toLowerCase();
    if (!q) return this.all;
    return this.all.filter((c) => c.name.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }

  choose(c: Country) {
    this.money.setCountry(c.code);
    this.open = false;
    this.q = '';
    this.changed.emit(c);
  }
}

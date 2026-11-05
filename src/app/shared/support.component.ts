import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { AccountService } from '../core/account.service';
import { environment } from 'src/environments/environment';

/** Floating chat button: Telegram or WhatsApp, with the account email pre-filled for the agent or bot. */
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [NgIf, AsyncPipe],
  template: `
    <div class="wrap">
      <div class="panel" *ngIf="open" role="dialog" aria-label="Chat with support">
        <p class="h">Chat with us</p>
        <p class="sub">Signals, passes or payments – Telegram answers instantly, 24/7.</p>
        <ng-container *ngIf="profile$ | async as p; else guest">
          <a class="opt tg" [class.off]="!tg" [attr.href]="tg ? tgLink(p.email) : null" target="_blank" rel="noopener">
            <span class="ico">✈</span><span><strong>Telegram</strong><small>{{ tg ? 'Instant reply · @' + tg : 'Not connected yet' }}</small></span>
          </a>
          <a class="opt wa" [class.off]="!wa" [attr.href]="wa ? waLink(p.email) : null" target="_blank" rel="noopener">
            <span class="ico">✆</span><span><strong>WhatsApp</strong><small>{{ wa ? '+' + wa : 'Not connected yet' }}</small></span>
          </a>
        </ng-container>
        <ng-template #guest>
          <a class="opt tg" [class.off]="!tg" [attr.href]="tg ? tgLink('') : null" target="_blank" rel="noopener">
            <span class="ico">✈</span><span><strong>Telegram</strong><small>{{ tg ? 'Instant reply · @' + tg : 'Not connected yet' }}</small></span>
          </a>
          <a class="opt wa" [class.off]="!wa" [attr.href]="wa ? waLink('') : null" target="_blank" rel="noopener">
            <span class="ico">✆</span><span><strong>WhatsApp</strong><small>{{ wa ? '+' + wa : 'Not connected yet' }}</small></span>
          </a>
        </ng-template>
      </div>
      <button class="fab" (click)="open = !open" [attr.aria-expanded]="open" aria-label="Chat with support">
        <span *ngIf="!open">💬</span><span *ngIf="open">✕</span><b *ngIf="!open">Help</b>
      </button>
    </div>
  `,
  styles: [`
    .wrap { position: fixed; z-index: 900; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(16px, env(safe-area-inset-bottom, 0px));
      display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .fab { height: 52px; min-width: 52px; padding: 0 16px; border-radius: 999px; border: 0; cursor: pointer; display: flex; align-items: center; gap: 8px;
      background: var(--tw-gold); color: #031019; font: 800 15px/1 var(--tw-font); box-shadow: 0 10px 30px rgba(0,0,0,.45), 0 0 24px rgba(var(--tw-accent-rgb), .35); }
    .fab span { font-size: 20px; }
    .panel { width: 290px; padding: 16px; border-radius: 18px; background: var(--tw-card); border: 1px solid var(--tw-line-strong);
      box-shadow: 0 24px 60px rgba(0,0,0,.55); display: grid; gap: 8px; animation: up .18s ease-out; }
    @keyframes up { from { transform: translateY(8px); opacity: 0; } }
    .h { margin: 0; font-weight: 800; font-size: 16px; color: var(--tw-text); }
    .sub { margin: 0 0 4px; font-size: 13px; color: var(--tw-muted); }
    .opt { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; text-decoration: none; color: var(--tw-text);
      background: var(--tw-card-2); border: 1px solid var(--tw-line); }
    .opt:hover { border-color: var(--tw-gold); }
    .opt.off { opacity: .55; pointer-events: none; }
    .ico { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 18px; color: #fff; flex: none; }
    .tg .ico { background: #2aabee; } .wa .ico { background: #25d366; }
    .opt strong { display: block; font-size: 14px; } .opt small { color: var(--tw-muted); font-size: 12px; }
    @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
  `],
})
export class SupportComponent {
  profile$ = inject(AccountService).profile$;
  tg = environment.support.telegram;
  wa = environment.support.whatsapp;
  open = false;

  private text(email: string) {
    return `Hi TableWise, I need help.${email ? ' My account: ' + email : ''}`;
  }

  tgLink(email: string) {
    return `https://t.me/${this.tg}?text=${encodeURIComponent(this.text(email))}`;
  }

  waLink(email: string) {
    return `https://wa.me/${this.wa}?text=${encodeURIComponent(this.text(email))}`;
  }
}

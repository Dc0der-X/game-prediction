import { Component, OnDestroy, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Subscription, filter } from 'rxjs';
import { AccountService } from '../core/account.service';

interface Tab {
  label: string;
  icon: string;
  link: string;
  /** URL prefixes that light this tab up. */
  match: string[];
}

/**
 * Bottom tab bar for phones (one-handed use). Shown when signed in, on screens up to 720px wide;
 * the top menu takes over on wider screens. While shown, <html> gets .tw-tabbar-on (see global.scss).
 */
@Component({
  selector: 'app-tabbar',
  standalone: true,
  imports: [IonicModule, RouterLink, NgFor, NgIf],
  template: `
    <nav class="tabbar" *ngIf="show" aria-label="Main">
      <a *ngFor="let t of tabs" [routerLink]="t.link" [class.on]="isOn(t)" [attr.aria-current]="isOn(t) ? 'page' : null">
        <ion-icon [name]="t.icon + (isOn(t) ? '' : '-outline')" aria-hidden="true"></ion-icon>
        <span>{{ t.label }}</span>
      </a>
    </nav>
  `,
  styles: [`
    .tabbar { display: none; }
    @media (max-width: 720px) {
      .tabbar { position: fixed; z-index: 800; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(5, 1fr);
        padding: 6px 6px max(8px, env(safe-area-inset-bottom, 0px)); background: var(--tw-card);
        border-top: 1px solid var(--tw-line-strong); box-shadow: 0 -10px 30px rgba(0, 0, 0, .18); }
      a { display: grid; justify-items: center; gap: 2px; padding: 6px 0 2px; border-radius: 12px; color: var(--tw-muted);
        text-decoration: none; font-size: 11px; font-weight: 600; }
      ion-icon { font-size: 23px; }
      a.on { color: var(--tw-gold); }
      a.on span { font-weight: 800; }
    }
  `],
})
export class TabbarComponent implements OnDestroy {
  private router = inject(Router);
  private subs: Subscription[] = [];
  private signedIn = false;
  url = this.router.url;

  tabs: Tab[] = [
    { label: 'Signals', icon: 'radio-button-on', link: '/coach', match: ['/coach'] },
    { label: 'Goal', icon: 'flag', link: '/goal', match: ['/goal'] },
    { label: 'Practice', icon: 'grid', link: '/lobby', match: ['/lobby', '/live', '/table'] },
    { label: 'History', icon: 'time', link: '/history', match: ['/history'] },
    { label: 'Profile', icon: 'person-circle', link: '/account', match: ['/account', '/pro'] },
  ];

  constructor() {
    this.subs.push(
      inject(AccountService).access$.subscribe((a) => {
        this.signedIn = !!a.signedIn;
        this.publish();
      }),
      this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
        this.url = e.urlAfterRedirects;
        this.publish();
      }),
    );
  }

  /** Only on the app's own pages, when signed in (not on landing, sign-in or legal pages). */
  get show(): boolean {
    return this.signedIn && this.tabs.some((t) => this.isOn(t));
  }

  isOn(t: Tab): boolean {
    return t.match.some((m) => this.url === m || this.url.startsWith(m + '/') || this.url.startsWith(m + '?'));
  }

  private publish() {
    // global.scss turns this into --tw-tabbar-h on phones, so floating buttons sit above the bar.
    document.documentElement.classList.toggle('tw-tabbar-on', this.show);
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
  }
}

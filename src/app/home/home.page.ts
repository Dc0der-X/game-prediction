import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { AccountService } from '../core/account.service';
import { environment } from 'src/environments/environment';
import { GAMES, getBet, pct } from '../core/games';
import { FREE_FEATURES, PLANS, PRICING, PRO_FEATURES, perDay, savingVsDay } from '../core/pricing';
import { FeedItem, SessionsService } from '../core/sessions.service';
import { THEMES, ThemeService } from '../core/theme.service';
import { getGame } from '../core/games';
import { TABLE_RULES } from '../core/strategies';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  private fs = inject(Firestore, { optional: true }) as Firestore;
  private fb = inject(FormBuilder);
  access$ = inject(AccountService).access$;

  menuOpen = false;
  games = GAMES;
  rules = TABLE_RULES;
  pricing = PRICING;
  plans = PLANS;
  perDay = perDay;
  savingVsDay = savingVsDay;
  theme = inject(ThemeService);
  themes = THEMES;
  demo = environment.demoMode;
  feed: FeedItem[] = [];
  /** Share of recent sessions that ended at their target – from real results only. */
  hitRate: number | null = null;
  private sessions = inject(SessionsService);
  free = FREE_FEATURES;
  pro = PRO_FEATURES;
  pct = pct;
  year = new Date().getFullYear();

  faqs = [
    {
      q: 'What does TableWise do?',
      a: 'It sits beside your live casino table. You tap the last results, and it gives you a signal for every bet – which side and exactly how much – based on the amount you brought. It tracks your target and tells you when to cash out or stop.',
    },
    {
      q: 'Which games does it work with?',
      a: 'Roulette (red/black), Baccarat (player/banker), Dragon Tiger, Sic Bo (small/big) and Lucky 7 – at any online or land-based casino.',
    },
    {
      q: 'Does it guarantee wins?',
      a: 'No. Casino games are random and the house keeps an edge, so some sessions lose. TableWise gives every bet a plan and makes sure you stop at your target or your limit instead of chasing.',
    },
    {
      q: 'How much does it cost?',
      a: `The first ${PRICING.trialHours} hours are free, no card. Then a Day Pass is $${PRICING.dayUsd}, a month is $${PRICING.monthlyUsd} and a year is $${PRICING.yearlyUsd}. Passes never auto-renew. Pay with PayPal, card or crypto.`,
    },
    {
      q: 'Can I try it without money?',
      a: 'Yes. The practice tables are free forever with play money, and they show the same signals.',
    },
    {
      q: 'Who can use TableWise?',
      a: 'Adults 18+ in places where online casino games are legal. TableWise does not take bets or hold money – you play at your own licensed casino.',
    },
  ];

  contactFG = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    number: [''],
    message: ['', Validators.required],
  });
  sent = false;
  sending = false;

  constructor() {
    this.sessions.feed(30).then((items) => {
      this.feed = items.slice(0, 12);
      const done = items.filter((i) => i.endReason === 'stop-win' || i.endReason === 'stop-loss' || i.net !== 0);
      this.hitRate = done.length >= 5 ? Math.round((done.filter((i) => i.endReason === 'stop-win').length / done.length) * 100) : null;
    });
  }

  gameName(id: string) {
    return getGame(id)?.name ?? id;
  }

  ago(t: number) {
    const m = Math.max(1, Math.round((Date.now() - t) / 60000));
    return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  }

  bestEdge(g: (typeof GAMES)[number]) {
    return getBet(g, g.bestBet)!.edge;
  }

  scrollTo(id: string) {
    this.menuOpen = false;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  async onSubmit() {
    if (this.contactFG.invalid) {
      this.contactFG.markAllAsTouched();
      return;
    }
    this.sending = true;
    try {
      const v = this.contactFG.value;
      if (environment.demoMode) {
        this.sent = true;
        this.contactFG.reset();
        return;
      }
      await addDoc(collection(this.fs, 'Contact'), {
        name: (v.name || '').slice(0, 100),
        email: (v.email || '').slice(0, 200),
        number: (v.number || '').slice(0, 40),
        message: (v.message || '').slice(0, 2000),
        createdAt: Date.now(),
      });
      this.sent = true;
      this.contactFG.reset();
    } finally {
      this.sending = false;
    }
  }
}

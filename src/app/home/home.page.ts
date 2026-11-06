import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { AccountService } from '../core/account.service';
import { environment } from 'src/environments/environment';
import { GAMES, SIGNAL_GAMES, getBet, pct } from '../core/games';
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
  signalGames = SIGNAL_GAMES.map((id) => getGame(id)!);
  rules = TABLE_RULES;
  pricing = PRICING;
  plans = PLANS;
  perDay = perDay;
  savingVsDay = savingVsDay;
  theme = inject(ThemeService);
  themes = THEMES;
  demo = environment.demoMode;
  feed: FeedItem[] = [];
  /** Number of cash-outs shared in the last 24 hours. */
  cashouts24h: number | null = null;
  private sessions = inject(SessionsService);
  free = FREE_FEATURES;
  pro = PRO_FEATURES;
  pct = pct;
  year = new Date().getFullYear();

  faqs = [
    {
      q: 'What does TableWise do?',
      a: 'It sits beside your live casino table. Tap what came, and it gives you a signal for every bet – which side and exactly how much – based on the amount you brought. It fills your target live and tells you the moment to cash out.',
    },
    {
      q: 'Which games does it work with?',
      a: 'Baccarat (player/banker), Craps (pass/don\'t pass), Roulette (red/black) and Sic Bo (small/big) – at any online or land-based casino. Dragon Tiger is on the free practice tables.',
    },
    {
      q: 'Why does it tell me to cash out?',
      a: 'Because the best sessions end on top. When your target is hit – or you are well up and the table cools – the coach tells you to cash out, so the win stays yours. Every bet also stays inside a safety limit, so one session never decides your week.',
    },
    {
      q: 'How much does it cost?',
      a: `The first ${PRICING.trialHours} hours are free, no card. Then a Day Pass is $${PRICING.dayUsd}, a month is $${PRICING.monthlyUsd} and a year is $${PRICING.yearlyUsd}. Passes never auto-renew. Pay by card or crypto – your pass switches on the moment you pay.`,
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
      const n = items.filter((i) => i.createdAt > Date.now() - 86_400_000).length;
      this.cashouts24h = n > 0 ? n : null;
    });
  }

  gameName(id: string) {
    return getGame(id)?.name ?? id;
  }

  ago(t: number) {
    const m = Math.max(1, Math.round((Date.now() - t) / 60000));
    return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  }

  sidesOf(g: (typeof GAMES)[number]) {
    return (g.sides ?? [g.bestBet]).map((id) => getBet(g, id)!.label).join(' / ');
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

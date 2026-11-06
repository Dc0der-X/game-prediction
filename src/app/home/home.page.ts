import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import { FormBuilder, Validators } from '@angular/forms';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { AccountService } from '../core/account.service';
import { environment } from 'src/environments/environment';
import { GAMES, SIGNAL_GAMES, getBet, pct } from '../core/games';
import { FREE_FEATURES, PLANS, PRICING, PRO_FEATURES, perDay, savingVsDay } from '../core/pricing';
import { FeedItem, SessionsService } from '../core/sessions.service';
import { THEMES, ThemeService } from '../core/theme.service';
import { getGame } from '../core/games';
import { TABLE_RULES, smallestUnit } from '../core/strategies';
import { CASINO_DEALERS } from '../core/dealers';
import { MoneyService, formatMoney, tableFor } from '../core/money';
import { float, reducedMotion, revealOnView, tilt } from '../shared/motion';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements AfterViewInit, OnDestroy {
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
  dealers = CASINO_DEALERS;
  private money = inject(MoneyService);
  private router = inject(Router);
  private cleanups: (() => void)[] = [];
  @ViewChild('hero', { static: true }) hero!: ElementRef<HTMLElement>;
  @ViewChild('page', { static: true }) page!: ElementRef<HTMLElement>;

  /** The hero's example bet, in the visitor's currency (₹30, $3 …). */
  get demoBet(): string {
    const t = tableFor(this.money.currency);
    return formatMoney(smallestUnit(t) * 1.5, this.money.currency);
  }

  openTable(id: string) {
    this.router.navigate(['/live', id]);
  }

  ngAfterViewInit() {
    const h = this.hero.nativeElement;
    this.cleanups.push(revealOnView(this.page.nativeElement));
    h.querySelectorAll<HTMLElement>('.dcard').forEach((c) => this.cleanups.push(tilt(c, 7)));
    if (reducedMotion()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(h.querySelectorAll('[data-h]'), { y: 30, opacity: 0, duration: 0.8, stagger: 0.09 })
      .from(h.querySelectorAll('.dcard'), { y: 90, rotation: 0, opacity: 0, duration: 1, stagger: 0.1, clearProps: 'opacity' }, 0.15)
      .from(h.querySelectorAll('.tw-pcard'), { y: -60, rotationY: 180, opacity: 0, duration: 0.9, stagger: 0.12 }, 0.5)
      .from(h.querySelector('.sig-chip'), { scale: 0.7, opacity: 0, duration: 0.6, ease: 'back.out(2)' }, 0.9)
      .from(h.querySelectorAll('.hero-coin'), { scale: 0, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'back.out(3)' }, 1.0);
    tl.add(() => {
      float(h.querySelectorAll('.hero-coin'), 12, 2.6);
      float(h.querySelector('.sig-chip')!, 6, 3.4);
      float(h.querySelectorAll('.tw-pcard'), 8, 3.8);
      gsap.to(h.querySelectorAll('.hero-coin'), { rotationY: 360, duration: 4, ease: 'none', repeat: -1, stagger: 0.6 });
    });
  }

  ngOnDestroy() {
    this.cleanups.forEach((f) => f());
    gsap.killTweensOf(this.hero.nativeElement.querySelectorAll('*'));
  }

  faqs = [
    {
      q: 'What does TableWise do?',
      a: 'It sits beside your live casino table. Tap what came, and it gives you a signal for every bet – which side and exactly how much – based on the amount you brought. It fills your target live and tells you the moment to cash out.',
    },
    {
      q: 'Which games does it work with?',
      a: 'Baccarat (player/banker), Roulette (red/black), Dragon Tiger (dragon/tiger), Sic Bo (small/big) and Craps (pass/don\'t pass) – at any online or land-based casino.',
    },
    {
      q: 'Why does it tell me to cash out?',
      a: 'Because the best sessions end on top. When your target is hit you can cash out – or keep riding while it wins, and the first miss after it cashes you out with the win locked in. Every bet stays inside a safety limit, so one session never decides your week.',
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

import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { AccountService } from '../core/account.service';
import { environment } from 'src/environments/environment';
import { GAMES, getBet, pct } from '../core/games';
import { FREE_FEATURES, PRICING, PRO_FEATURES } from '../core/pricing';
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
  free = FREE_FEATURES;
  pro = PRO_FEATURES;
  pct = pct;
  year = new Date().getFullYear();

  faqs = [
    {
      q: 'Can TableWise predict results or make me money?',
      a: 'No – and anyone who says they can is selling something. Every round of these games is independent and every bet has a house edge. TableWise helps you play for fun with small, controlled stakes so losses stay small.',
    },
    {
      q: 'So why does the coach help?',
      a: 'Most money is lost by playing too long, betting too big and chasing losses. The coach fixes all three: it tells you exactly what to bet and how much, when to stop, and locks after one session a day.',
    },
    {
      q: 'Is practice really unlimited?',
      a: 'Yes. Practice tables use play money, so there is no timer and no limit. Real-money sessions are the only thing the coach limits.',
    },
    {
      q: 'How do I pay?',
      a: `PayPal (monthly subscription, cancel any time) or crypto – BTC, ETH, USDT and more – for 1 or 12 months. The first ${PRICING.trialDays} days are free with no card.`,
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

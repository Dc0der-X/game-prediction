import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { environment } from 'src/environments/environment';
import { PlanId } from './pricing';

/**
 * Checkout through PayGate.to: card (Visa, Mastercard, Apple Pay, Google Pay) or crypto.
 *
 * The browser only starts a checkout (and can say "I've paid"). The worker (/payments-worker,
 * free Cloudflare Worker) grants the pass only from PayGate's RSA-signed payment callback;
 * "I've paid" switches it on for up to 60 minutes meanwhile, then it pauses by itself.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private auth = inject(Auth, { optional: true }) as Auth;
  private cfg = environment.payments;

  get configured() {
    return !!this.cfg.apiUrl;
  }

  /** POST to the payments worker with the user's Firebase ID token. */
  private async call<T>(path: string, body: unknown): Promise<T> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Please log in first.');
    const token = await user.getIdToken();
    const res = await fetch(this.cfg.apiUrl.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Checkout is busy right now. Please try again.');
    return data as T;
  }

  /** Creates a PayGate.to checkout (card or crypto) for a pass. */
  checkout(plan: PlanId, method: 'card' | 'crypto'): Promise<{ url: string; ref: string }> {
    return this.call<{ url: string; ref: string }>('/checkout', { plan, method });
  }

  /**
   * The buyer is back from checkout: switch the pass on now.
   * 'pending' = on while the payment confirms, 'paid' / 'active' = confirmed,
   * 'waiting' = an earlier checkout is still unconfirmed, 'confirming' = switches on as soon as the payment
   * is seen, 'hold' / 'expired' = payment not received.
   */
  async startPass(ref: string): Promise<'pending' | 'paid' | 'active' | 'waiting' | 'confirming' | 'hold' | 'expired'> {
    const res = await this.call<{ status: any }>('/pass/start', { ref });
    return res.status;
  }
}

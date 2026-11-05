import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { environment } from 'src/environments/environment';
import { PlanId } from './pricing';

/**
 * Checkout (card or crypto through one hosted checkout page).
 *
 * The browser only starts a checkout and tells the worker the buyer is back. The worker
 * (/payments-worker, free Cloudflare Worker) switches the pass on straight away for up to
 * 60 minutes while the payment confirms; only the payment provider's signed confirmation
 * grants the full pass. No confirmation → the pass goes on hold by itself.
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

  /** Creates a hosted checkout for a pass and returns its URL. */
  async checkout(plan: PlanId): Promise<string> {
    const res = await this.call<{ url: string }>('/checkout', { plan });
    return res.url;
  }

  /**
   * The buyer is back from checkout: switch the pass on now.
   * 'pending' = on while the payment confirms, 'paid' / 'active' = confirmed,
   * 'waiting' = an earlier checkout is still unconfirmed, 'hold' / 'expired' = payment not received.
   */
  async startPass(ref: string): Promise<'pending' | 'paid' | 'active' | 'waiting' | 'hold' | 'expired'> {
    const res = await this.call<{ status: any }>('/pass/start', { ref });
    return res.status;
  }
}

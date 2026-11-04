import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { environment } from 'src/environments/environment';

declare global {
  interface Window {
    paypal?: any;
  }
}

/**
 * Checkout. The browser never decides who has paid: it only starts a checkout.
 * The payments worker (/payments-worker, free Cloudflare Worker) verifies every
 * payment with PayPal / NOWPayments and then writes the user's plan, which
 * Firestore rules make read-only for customers.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private auth = inject(Auth);
  private sdkPromise: Promise<any> | null = null;
  private cfg = environment.payments;

  get configured() {
    return !!this.cfg.apiUrl;
  }

  get paypalEnabled() {
    return this.configured && !!(this.cfg.paypalClientId && this.cfg.paypalPlanId);
  }

  get cryptoEnabled() {
    return this.configured && this.cfg.cryptoEnabled;
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
    if (!res.ok) throw new Error(data.error || 'Payment server error. Please try again.');
    return data as T;
  }

  private loadPayPal(): Promise<any> {
    if (window.paypal) return Promise.resolve(window.paypal);
    if (!this.sdkPromise) {
      this.sdkPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src =
          'https://www.paypal.com/sdk/js?client-id=' +
          encodeURIComponent(this.cfg.paypalClientId) +
          '&vault=true&intent=subscription';
        s.onload = () => resolve(window.paypal);
        s.onerror = () => {
          this.sdkPromise = null;
          reject(new Error('Could not load PayPal. Check your connection and try again.'));
        };
        document.head.appendChild(s);
      });
    }
    return this.sdkPromise;
  }

  /** Renders the PayPal subscribe button into `el`. */
  async renderPayPal(el: HTMLElement, uid: string, onDone: () => void, onError: (msg: string) => void) {
    const paypal = await this.loadPayPal();
    el.innerHTML = '';
    await paypal
      .Buttons({
        style: { shape: 'pill', color: 'gold', layout: 'vertical', label: 'subscribe' },
        createSubscription: (_data: any, actions: any) =>
          actions.subscription.create({ plan_id: this.cfg.paypalPlanId, custom_id: uid }),
        onApprove: async (data: any) => {
          try {
            await this.call('/paypal/activate', { subscriptionId: data.subscriptionID });
            onDone();
          } catch {
            onError(
              'Payment received, but activation is still processing. It usually completes within a minute – refresh this page shortly.'
            );
          }
        },
        onError: () => onError('PayPal could not complete the payment. You have not been charged.'),
      })
      .render(el);
  }

  /** Creates a crypto invoice and returns the hosted checkout URL. */
  async cryptoCheckout(months: 1 | 12): Promise<string> {
    const res = await this.call<{ url: string }>('/crypto/invoice', { months });
    return res.url;
  }
}

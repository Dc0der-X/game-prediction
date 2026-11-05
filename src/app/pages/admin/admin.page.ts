import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import {
  Firestore, Timestamp, collection, collectionGroup, doc, getDocs, limit, orderBy, query, updateDoc,
} from '@angular/fire/firestore';
import { TopbarComponent } from '../../shared/topbar.component';
import { Profile, computeAccess } from '../../core/account.service';
import { PRICING } from '../../core/pricing';
import { getGame } from '../../core/games';
import { demoAdminData } from '../../core/demo-data';
import { environment } from 'src/environments/environment';

interface Row extends Profile {
  status: 'Admin' | 'Paid' | 'Trial' | 'Free';
  joined: Date | null;
  until: Date | null;
}

interface Payment {
  id: string;
  uid: string;
  email?: string;
  provider: 'paypal' | 'crypto' | string;
  amountUsd: number;
  createdAt?: Timestamp;
  note?: string;
}

const DAY = 86_400_000;

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [IonicModule, FormsModule, NgFor, NgIf, DatePipe, DecimalPipe, TopbarComponent],
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage {
  private fs = inject(Firestore, { optional: true }) as Firestore;
  demo = environment.demoMode;
  /** uid waiting for a second tap to confirm "Revoke" (dialogs are blocked in some browsers). */
  confirmRevoke = '';

  loading = true;
  error = '';
  tab: 'users' | 'payments' | 'activity' | 'messages' = 'users';
  search = '';

  users: Row[] = [];
  payments: Payment[] = [];
  sessions: any[] = [];
  messages: any[] = [];

  kpi = {
    total: 0, today: 0, week: 0, month: 0,
    trial: 0, paid: 0, free: 0,
    conversion: 0, revenue30: 0, revenueAll: 0, mrr: 0,
    sessionsToday: 0,
  };
  signupBars: { label: string; count: number }[] = [];
  maxBar = 1;

  constructor() {
    this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      if (this.demo) {
        const d = demoAdminData();
        let mine: any[] = [];
        try {
          mine = JSON.parse(localStorage.getItem('tw.demo.sessions') || '[]').map((x: any) => ({
            ...x, startedAt: Timestamp.fromMillis(x.startedAt),
          }));
        } catch {}
        this.users = d.users.map((p) => this.toRow(p));
        this.users.sort((a, b) => (b.joined?.getTime() ?? 0) - (a.joined?.getTime() ?? 0));
        this.payments = d.payments;
        this.sessions = [...mine, ...d.sessions].sort((a, b) => b.startedAt.toMillis() - a.startedAt.toMillis());
        this.messages = d.messages;
        this.computeKpis();
        return;
      }
      const [u, p, s, m] = await Promise.all([
        getDocs(collection(this.fs, 'users')),
        getDocs(query(collection(this.fs, 'payments'), orderBy('createdAt', 'desc'), limit(300))).catch(() => null),
        getDocs(query(collectionGroup(this.fs, 'sessions'), orderBy('startedAt', 'desc'), limit(100))).catch(() => null),
        getDocs(collection(this.fs, 'Contact')).catch(() => null),
      ]);
      this.users = u.docs.map((d) => this.toRow({ ...(d.data() as Profile), uid: d.id }));
      this.users.sort((a, b) => (b.joined?.getTime() ?? 0) - (a.joined?.getTime() ?? 0));
      this.payments = p ? p.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, 'id'>) })) : [];
      this.sessions = s ? s.docs.map((d) => ({ id: d.id, uid: d.ref.parent.parent?.id, ...d.data() })) : [];
      this.messages = m ? m.docs.map((d) => d.data()).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
      this.computeKpis();
    } catch (e: any) {
      this.error = e?.message || 'Could not load data. Check that your user has role "admin" and Firestore rules are deployed.';
    } finally {
      this.loading = false;
    }
  }

  private toRow(p: Profile): Row {
    const a = computeAccess(p);
    return {
      ...p,
      status: a.isAdmin ? 'Admin' : a.isPaid ? 'Paid' : a.onTrial ? 'Trial' : 'Free',
      joined: p.createdAt ? p.createdAt.toDate() : null,
      until: a.isPaid ? a.paidUntil : a.onTrial ? a.trialEndsAt : null,
    };
  }

  private computeKpis() {
    const now = Date.now();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const joinedSince = (ms: number) => this.users.filter((u) => u.joined && u.joined.getTime() >= ms).length;

    const customers = this.users.filter((u) => u.status !== 'Admin');
    const payers = new Set(this.payments.map((p) => p.uid));
    const trialEnded = customers.filter((u) => u.joined && u.joined.getTime() + PRICING.trialHours * 3_600_000 < now);
    const paidActive = customers.filter((u) => u.status === 'Paid');

    this.kpi = {
      total: customers.length,
      today: joinedSince(startToday.getTime()),
      week: joinedSince(now - 7 * DAY),
      month: joinedSince(now - 30 * DAY),
      trial: customers.filter((u) => u.status === 'Trial').length,
      paid: paidActive.length,
      free: customers.filter((u) => u.status === 'Free').length,
      conversion: trialEnded.length ? (trialEnded.filter((u) => payers.has(u.uid)).length / trialEnded.length) * 100 : 0,
      revenue30: this.payments
        .filter((p) => p.createdAt && p.createdAt.toMillis() >= now - 30 * DAY)
        .reduce((a, p) => a + (p.amountUsd || 0), 0),
      revenueAll: this.payments.reduce((a, p) => a + (p.amountUsd || 0), 0),
      mrr: paidActive.length * PRICING.monthlyUsd, // rough: every active pass counted as monthly
      sessionsToday: this.sessions.filter((s) => s.startedAt?.toMillis() >= startToday.getTime()).length,
    };

    // Sign-ups per day, last 30 days.
    const bars: { label: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(startToday.getTime() - i * DAY);
      const next = d.getTime() + DAY;
      bars.push({
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: this.users.filter((u) => u.joined && u.joined.getTime() >= d.getTime() && u.joined.getTime() < next).length,
      });
    }
    this.signupBars = bars;
    this.maxBar = Math.max(1, ...bars.map((b) => b.count));
  }

  get filteredUsers(): Row[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter((u) =>
      [u.name, u.email, u.phone, u.telegram, u.status].some((f) => (f || '').toLowerCase().includes(q))
    );
  }

  emailFor(uid: string) {
    if (uid?.startsWith('demo-')) return 'you (this demo)';
    return this.users.find((u) => u.uid === uid)?.email ?? uid;
  }

  gameName(id: string) {
    return getGame(id)?.name ?? id;
  }

  /** Manually give a customer Pro (e.g. paid by bank transfer). */
  async grant(u: Row, days: number) {
    const base = Math.max(Date.now(), u.planExpiresAt?.toMillis() ?? 0);
    const planExpiresAt = Timestamp.fromMillis(base + days * DAY);
    if (!this.demo) await updateDoc(doc(this.fs, 'users', u.uid), { plan: 'pro', planSource: 'admin', planExpiresAt });
    Object.assign(u, this.toRow({ ...u, plan: 'pro', planSource: 'admin', planExpiresAt }));
    this.computeKpis();
  }

  async revoke(u: Row) {
    if (this.confirmRevoke !== u.uid) {
      this.confirmRevoke = u.uid;
      return;
    }
    this.confirmRevoke = '';
    if (!this.demo) await updateDoc(doc(this.fs, 'users', u.uid), { plan: null, planExpiresAt: null });
    Object.assign(u, this.toRow({ ...u, plan: null, planExpiresAt: null }));
    this.computeKpis();
  }

  exportCsv() {
    const cols = ['name', 'email', 'phone', 'telegram', 'status', 'joined', 'until'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(',')].concat(
      this.users.map((u) =>
        [u.name, u.email, u.phone, u.telegram, u.status, u.joined?.toISOString(), u.until?.toISOString()].map(esc).join(',')
      )
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tablewise-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

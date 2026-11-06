/**
 * Sample data for the browser-only demo build (admin dashboard).
 * Mirrors scripts/seed-emulators.mjs. Everyone here is fictional.
 */
import { Timestamp } from '@angular/fire/firestore';
import { Profile } from './account.service';

const DAY = 86_400_000;

export function demoAdminData() {
  const now = Date.now();
  const ago = (d: number) => Timestamp.fromMillis(now - d * DAY);
  const people: [string, number, string | null][] = [
    ['Arjun Mehta', 1, null], ['Sofia Lopez', 2, null], ['Liam Chen', 3, null], ['Priya Nair', 5, null],
    ['Noah Smith', 9, 'crypto'], ['Emma Rossi', 12, 'crypto'], ['Kabir Shah', 14, 'crypto'], ['Mia Novak', 18, null],
    ['Omar Haddad', 20, 'crypto12'], ['Ava Brown', 23, null], ['Ravi Kumar', 26, 'crypto'], ['Lucas Silva', 29, null],
  ];
  const casinos = ['Evolution live tables', 'Ezugi', 'Pragmatic Play Live'];
  const games = ['baccarat', 'roulette', 'dragon-tiger', 'sicbo'];
  const users: Profile[] = [];
  const payments: any[] = [];
  const sessions: any[] = [];

  people.forEach(([name, daysAgo, paid], n) => {
    const uid = 'sample-' + n;
    const email = name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com';
    const created = now - daysAgo * DAY;
    const p: Profile = {
      uid, name, email, phone: `+1 555 01${10 + n}`, telegram: '', role: 'customer',
      ageConfirmed: true, createdAt: Timestamp.fromMillis(created),
    };
    if (paid) {
      const paidAt = created + 7 * DAY;
      const year = paid === 'crypto12';
      p.plan = 'pro';
      p.planSource = 'crypto';
      p.planExpiresAt = Timestamp.fromMillis(paidAt + (year ? 365 : 30) * DAY);
      payments.push({
        id: 'pay' + n, uid, email, provider: p.planSource, amountUsd: year ? 99 : 12,
        note: p.planSource === 'crypto' ? `${year ? '12 months' : '1 month'} · USDT` : 'Monthly subscription',
        createdAt: Timestamp.fromMillis(paidAt),
      });
    }
    users.push(p);
    for (let k = 0; k < 3; k++) {
      const bankroll = [100, 200, 500][(n + k) % 3];
      const unit = Math.floor(bankroll * 0.02);
      const rounds = Array.from({ length: 8 + ((n * 3 + k) % 9) }, (_, i) => ({
        stake: unit, net: (i * 7 + n + k) % 3 === 0 ? -unit : (i + k) % 2 ? unit : -unit,
      }));
      sessions.push({
        id: `s${n}${k}`, uid, gameId: games[(n + k) % games.length], casino: casinos[(n + k) % casinos.length],
        bankroll, unit, rounds, net: rounds.reduce((a, r) => a + r.net, 0),
        endReason: ['time', 'stop-win', 'checkin', 'stop-loss'][(n + k) % 4],
        startedAt: Timestamp.fromMillis(now - (k * 2 + (n % 3)) * DAY - 3_600_000 * (n + 1)),
      });
    }
  });
  sessions.sort((a, b) => b.startedAt.toMillis() - a.startedAt.toMillis());
  payments.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  const messages = [
    { name: 'Sam', email: 'sam@example.com', number: '@sam', message: 'Does the coach work with Evolution live tables?', createdAt: now - 2 * 3_600_000 },
    { name: 'Lena', email: 'lena@example.com', number: '', message: 'Can I pay for a year with USDT?', createdAt: now - DAY },
  ];
  return { users, payments, sessions, messages, ago };
}

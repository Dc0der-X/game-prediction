import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from '@angular/fire/firestore';
import { environment } from 'src/environments/environment';

export type EndReason = 'stop-win' | 'stop-loss' | 'profit-lock' | 'change-table' | 'time' | 'rounds' | 'checkin' | 'manual';

export interface RoundEntry {
  stake: number;
  net: number;
  betId?: string;
  result?: 'won' | 'lost' | 'void';
}

export interface RealSession {
  id?: string;
  gameId: string;
  betId: string;
  /** 'original' = TableWise Signals, 'flat' = flat stakes. */
  system?: string;
  /** Which online casino / table provider the session was played at. */
  casino: string;
  bankroll: number;
  unit: number;
  stopWin: number;
  stopLoss: number;
  minutes: number;
  rounds: RoundEntry[];
  net: number;
  endReason: EndReason;
  startedAt: Timestamp;
  endedAt: Timestamp;
}

const DEMO_SESSIONS = 'tw.demo.sessions';

/** Demo mode keeps sessions in this browser only. */
function demoLoad(): any[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_SESSIONS) || '[]');
  } catch {
    return [];
  }
}

/** One anonymous line in the public "recent results" feed. No names, no bets, no method. */
export interface FeedItem {
  game: string;
  net: number;
  /** Result as % of the session amount. */
  pct: number;
  minutes: number;
  endReason: string;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class SessionsService {
  private fs = inject(Firestore, { optional: true }) as Firestore;
  private demo = environment.demoMode;

  save(uid: string, s: RealSession) {
    this.publish(s);
    if (this.demo) {
      const all = demoLoad();
      all.push({ ...s, uid, id: 'd' + Date.now(), startedAt: s.startedAt.toMillis(), endedAt: s.endedAt.toMillis() });
      try {
        localStorage.setItem(DEMO_SESSIONS, JSON.stringify(all));
      } catch {}
      return Promise.resolve();
    }
    return addDoc(collection(this.fs, 'users', uid, 'sessions'), {
      ...s,
      savedAt: serverTimestamp(),
    });
  }

  /** Adds the anonymous result to the public feed (best effort). */
  private publish(s: RealSession) {
    if (this.demo || !s.rounds.length) return;
    const minutes = Math.max(1, Math.round((s.endedAt.toMillis() - s.startedAt.toMillis()) / 60000));
    addDoc(collection(this.fs, 'feed'), {
      game: s.gameId,
      net: Math.round(s.net * 100) / 100,
      pct: Math.round((s.net / (s.bankroll || 1)) * 1000) / 10,
      minutes: Math.min(minutes, 600),
      endReason: s.endReason,
      createdAt: Date.now(),
    }).catch(() => {});
  }

  /** Latest anonymous results from all players (public). */
  async feed(max = 30): Promise<FeedItem[]> {
    if (this.demo) return demoFeed();
    try {
      const snap = await getDocs(query(collection(this.fs, 'feed'), orderBy('createdAt', 'desc'), limit(max)));
      return snap.docs.map((d) => d.data() as FeedItem);
    } catch {
      return [];
    }
  }

  async list(uid: string, max = 200): Promise<RealSession[]> {
    if (this.demo) {
      return demoLoad()
        .filter((x) => x.uid === uid)
        .map((x) => ({ ...x, startedAt: Timestamp.fromMillis(x.startedAt), endedAt: Timestamp.fromMillis(x.endedAt) }))
        .sort((a, b) => b.startedAt.toMillis() - a.startedAt.toMillis())
        .slice(0, max);
    }
    const snap = await getDocs(
      query(collection(this.fs, 'users', uid, 'sessions'), orderBy('startedAt', 'desc'), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RealSession) }));
  }

  /** The coach allows one real-money session per calendar day. */
  async playedToday(uid: string): Promise<boolean> {
    // The demo lets visitors replay the coach as often as they like.
    if (this.demo) return false;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const snap = await getDocs(
      query(
        collection(this.fs, 'users', uid, 'sessions'),
        where('startedAt', '>=', Timestamp.fromDate(start)),
        limit(1)
      )
    );
    return !snap.empty;
  }
}

/** Sample feed for the browser-only demo (clearly labelled as sample data in the UI). */
function demoFeed(): FeedItem[] {
  const games = ['roulette', 'baccarat', 'dragon-tiger', 'baccarat', 'roulette', 'sicbo'];
  const now = Date.now();
  return Array.from({ length: 18 }, (_, i) => {
    const win = i % 10 !== 3 && i % 10 !== 7 && i % 10 !== 9;
    const pct = win ? 33.3 : -[78, 91, 100][i % 3];
    return {
      game: games[i % games.length],
      net: Math.round(pct * 3),
      pct,
      minutes: 22 + ((i * 7) % 31),
      endReason: win ? 'stop-win' : 'stop-loss',
      createdAt: now - (i + 1) * 23 * 60_000,
    };
  });
}

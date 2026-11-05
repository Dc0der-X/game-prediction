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

export type EndReason = 'stop-win' | 'stop-loss' | 'time' | 'rounds' | 'checkin' | 'manual';

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

@Injectable({ providedIn: 'root' })
export class SessionsService {
  private fs = inject(Firestore, { optional: true }) as Firestore;
  private demo = environment.demoMode;

  save(uid: string, s: RealSession) {
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

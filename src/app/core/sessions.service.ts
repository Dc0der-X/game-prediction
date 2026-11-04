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

export type EndReason = 'stop-win' | 'stop-loss' | 'time' | 'rounds' | 'manual';

export interface RoundEntry {
  stake: number;
  net: number;
}

export interface RealSession {
  id?: string;
  gameId: string;
  betId: string;
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

@Injectable({ providedIn: 'root' })
export class SessionsService {
  private fs = inject(Firestore);

  save(uid: string, s: RealSession) {
    return addDoc(collection(this.fs, 'users', uid, 'sessions'), {
      ...s,
      savedAt: serverTimestamp(),
    });
  }

  async list(uid: string, max = 200): Promise<RealSession[]> {
    const snap = await getDocs(
      query(collection(this.fs, 'users', uid, 'sessions'), orderBy('startedAt', 'desc'), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RealSession) }));
  }

  /** The coach allows one real-money session per calendar day. */
  async playedToday(uid: string): Promise<boolean> {
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

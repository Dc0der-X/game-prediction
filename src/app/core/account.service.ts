import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from '@angular/fire/auth';
import {
  Firestore,
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, map, of, shareReplay, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PRICING } from './pricing';

export interface Profile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  telegram?: string;
  role: 'customer' | 'admin';
  createdAt?: Timestamp | null;
  ageConfirmed?: boolean;
  /** Written only by Cloud Functions (or an admin). */
  plan?: 'pro' | null;
  planSource?: 'paypal' | 'crypto' | 'admin';
  planExpiresAt?: Timestamp | null;
  paypalStatus?: string;
  selfExcludedUntil?: Timestamp | null;
}

export interface Access {
  signedIn: boolean;
  isAdmin: boolean;
  onTrial: boolean;
  isPaid: boolean;
  hasPro: boolean;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  daysLeft: number;
  selfExcludedUntil: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function computeAccess(p: Profile | null | undefined): Access {
  if (!p) {
    return {
      signedIn: false, isAdmin: false, onTrial: false, isPaid: false, hasPro: false,
      trialEndsAt: null, paidUntil: null, daysLeft: 0, selfExcludedUntil: null,
    };
  }
  const now = Date.now();
  // createdAt is null for a moment right after sign-up (pending server timestamp).
  const created = p.createdAt ? p.createdAt.toMillis() : now;
  const trialEnds = created + PRICING.trialDays * DAY;
  const paidUntil = p.planExpiresAt ? p.planExpiresAt.toMillis() : 0;
  const isAdmin = p.role === 'admin';
  const isPaid = paidUntil > now;
  const onTrial = !isPaid && trialEnds > now;
  const end = Math.max(trialEnds, paidUntil);
  const excl = p.selfExcludedUntil ? p.selfExcludedUntil.toDate() : null;
  return {
    signedIn: true,
    isAdmin,
    onTrial,
    isPaid,
    hasPro: isAdmin || isPaid || onTrial,
    trialEndsAt: new Date(trialEnds),
    paidUntil: paidUntil ? new Date(paidUntil) : null,
    daysLeft: Math.max(0, Math.ceil((end - now) / DAY)),
    selfExcludedUntil: excl && excl.getTime() > now ? excl : null,
  };
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private auth = inject(Auth, { optional: true }) as Auth;
  private fs = inject(Firestore, { optional: true }) as Firestore;
  private demo = environment.demoMode ? new BehaviorSubject<Profile | null>(loadDemoProfile()) : null;

  // Plain listeners (not rxfire helpers): @angular/fire 7 bundles its own firebase
  // copy, and rxfire would otherwise talk to the app's top-level firebase package.
  readonly user$: Observable<User | null> = (this.demo
    ? this.demo.pipe(map((p) => (p ? ({ uid: p.uid, email: p.email } as User) : null)))
    : new Observable<User | null>((sub) => onAuthStateChanged(this.auth, (u) => sub.next(u), (e) => sub.error(e)))
  ).pipe(shareReplay({ bufferSize: 1, refCount: false }));

  readonly profile$: Observable<Profile | null> = this.demo ? this.demo.asObservable() : this.user$.pipe(
    switchMap((u) =>
      u
        ? new Observable<Profile | null>((sub) =>
            onSnapshot(
              doc(this.fs, 'users', u.uid),
              (snap) => sub.next(snap.exists() ? ({ ...(snap.data() as Profile), uid: snap.id }) : null),
              (e) => sub.error(e)
            )
          )
        : of(null)
    ),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  readonly access$: Observable<Access> = this.profile$.pipe(
    map(computeAccess),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  get uid(): string | null {
    if (this.demo) return this.demo.value?.uid ?? null;
    return this.auth.currentUser?.uid ?? null;
  }

  /* Demo mode: any email/password works; an email containing "admin" opens the admin view. */
  private setDemo(p: Profile | null) {
    try {
      if (p) localStorage.setItem(DEMO_KEY, JSON.stringify({ ...p, createdAt: p.createdAt?.toMillis(), selfExcludedUntil: p.selfExcludedUntil?.toMillis() ?? null }));
      else localStorage.removeItem(DEMO_KEY);
    } catch {}
    this.demo!.next(p);
  }

  private demoProfile(email: string, name: string): Profile {
    const admin = email.toLowerCase().includes('admin');
    return { uid: 'demo-' + (admin ? 'admin' : 'player'), name: name || (admin ? 'Admin' : 'Demo Player'),
      email: email.trim().toLowerCase(), phone: '', telegram: '', role: admin ? 'admin' : 'customer',
      ageConfirmed: true, createdAt: Timestamp.now(), selfExcludedUntil: null };
  }

  async signUp(data: { name: string; email: string; password: string; phone?: string; telegram?: string }) {
    if (this.demo) {
      const p = { ...this.demoProfile(data.email, data.name), phone: data.phone || '', telegram: data.telegram || '' };
      this.setDemo(p);
      return { uid: p.uid, email: p.email } as User;
    }
    const cred = await createUserWithEmailAndPassword(this.auth, data.email.trim(), data.password);
    await updateProfile(cred.user, { displayName: data.name });
    await this.createProfile(cred.user, data);
    return cred.user;
  }

  async signIn(email: string, password: string) {
    if (this.demo) {
      if (!email.includes('@') || password.length < 6) throw { code: 'invalid-credential' };
      const p = this.demoProfile(email, '');
      this.setDemo(p);
      return { uid: p.uid, email: p.email } as User;
    }
    const cred = await signInWithEmailAndPassword(this.auth, email.trim(), password);
    const snap = await getDoc(doc(this.fs, 'users', cred.user.uid));
    if (!snap.exists()) await this.createProfile(cred.user, { name: cred.user.displayName || '' });
    return cred.user;
  }

  resetPassword(email: string) {
    if (this.demo) return Promise.resolve();
    return sendPasswordResetEmail(this.auth, email.trim());
  }

  signOut() {
    if (this.demo) return Promise.resolve(this.setDemo(null));
    return signOut(this.auth);
  }

  updateDetails(uid: string, data: { name: string; phone: string; telegram: string }) {
    if (this.demo) return Promise.resolve(this.setDemo({ ...this.demo.value!, ...data }));
    return updateDoc(doc(this.fs, 'users', uid), data);
  }

  /** Lock real-money sessions for N days. Can be extended, never shortened. */
  selfExclude(uid: string, days: number) {
    if (this.demo) return Promise.resolve(this.setDemo({ ...this.demo.value!, selfExcludedUntil: Timestamp.fromMillis(Date.now() + days * DAY) }));
    return updateDoc(doc(this.fs, 'users', uid), {
      selfExcludedUntil: Timestamp.fromMillis(Date.now() + days * DAY),
    });
  }

  private createProfile(user: User, data: { name: string; phone?: string; telegram?: string }) {
    return setDoc(doc(this.fs, 'users', user.uid), {
      name: data.name || '',
      email: user.email,
      phone: data.phone || '',
      telegram: data.telegram || '',
      role: 'customer',
      ageConfirmed: true,
      createdAt: serverTimestamp(),
    });
  }
}

const DEMO_KEY = 'tw.demo.profile';

function loadDemoProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      ...p,
      createdAt: p.createdAt ? Timestamp.fromMillis(p.createdAt) : Timestamp.now(),
      selfExcludedUntil: p.selfExcludedUntil ? Timestamp.fromMillis(p.selfExcludedUntil) : null,
    };
  } catch {
    return null;
  }
}

export function authErrorMessage(e: any): string {
  const code: string = e?.code || '';
  if (code.includes('email-already-in-use')) return 'That email already has an account. Try logging in.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Email or password is incorrect.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a minute and try again.';
  return e?.message || 'Something went wrong. Please try again.';
}

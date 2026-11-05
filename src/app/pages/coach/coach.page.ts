import { Component, ElementRef, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { Timestamp } from '@angular/fire/firestore';
import { firstValueFrom, filter } from 'rxjs';
import { TopbarComponent } from '../../shared/topbar.component';
import { StopSignComponent } from '../../shared/stop-sign.component';
import { ConfettiComponent } from '../../shared/confetti.component';
import { NeuralFieldComponent } from '../../shared/neural-field.component';
import { AccountService } from '../../core/account.service';
import { EndReason, SessionsService } from '../../core/sessions.service';
import { GAMES, GameDef, getBet, getGame } from '../../core/games';
import { SESSION_LIMITS, SessionPlan, planNeural } from '../../core/strategies';
import { Goal, goalProgress } from '../../core/goal';
import { Signal, SignalEngine, SignalEvent, SystemId, VOID_RESULT } from '../../core/signals';

type Stage = 'checking' | 'locked' | 'excluded' | 'setup' | 'first' | 'live' | 'newtable' | 'done';

interface LiveState {
  v: 2;
  uid: string;
  casino: string;
  system: SystemId;
  plan: SessionPlan;
  /** Link to the player's live table, opened beside the signals. */
  tableUrl?: string;
  startedAt: number;
  nextCheckinAt: number;
  events: SignalEvent[];
}

interface Bead {
  side: string | null;
  tone: string;
  label: string;
  mark: 'won' | 'lost' | 'void' | 'seed';
}

const LIVE_KEY = 'tw.liveSession';
const MIN = 60_000;

/** Colour of each side's disc / bead. */
export const SIDE_TONE: Record<string, string> = {
  red: 'red', black: 'black', banker: 'red', player: 'blue', dragon: 'red', tiger: 'blue',
  small: 'blue', big: 'red', low: 'blue', high: 'red', pass: 'blue', dontpass: 'red',
};

@Component({
  selector: 'app-coach',
  standalone: true,
  imports: [IonicModule, FormsModule, RouterLink, NgIf, NgFor, NgClass, DecimalPipe, DatePipe,
    TopbarComponent, StopSignComponent, ConfettiComponent, NeuralFieldComponent],
  templateUrl: './coach.page.html',
  styleUrls: ['./coach.page.scss'],
})
export class CoachPage implements OnDestroy {
  @ViewChild(NeuralFieldComponent) field?: NeuralFieldComponent;
  @ViewChild('mini') miniEl?: ElementRef<HTMLElement>;
  private zone = inject(NgZone);
  private account = inject(AccountService);
  private sessions = inject(SessionsService);
  private route = inject(ActivatedRoute);
  /** The player's goal, with today's step (for the setup banner). */
  goal: Goal | null = null;
  goalStep: { amount: number; gain: number; left: number } | null = null;

  stage: Stage = 'checking';
  /** First name for the greeting. */
  firstName = '';
  excludedUntil: Date | null = null;
  uid = '';

  games = GAMES;
  limits = SESSION_LIMITS;
  quickAmounts = [100, 200, 500, 1000];
  minuteOptions = [30, 45, 60];

  gameId = 'baccarat';
  system: SystemId = 'neural';
  casino = '';
  tableUrl = '';
  casinoSuggestions = ['Evolution live tables', 'Ezugi', 'Pragmatic Play Live', 'Playtech Live', 'Other online casino', 'Land-based casino'];
  bankroll: number | null = null;
  minutes = 45;

  live: LiveState | null = null;
  engine: SignalEngine | null = null;
  remaining = 0;
  endReason: EndReason | null = null;
  saveError = '';
  stopSign: 'final' | 'checkin' | 'table' | null = null;
  /** Floating signal window (Document Picture-in-Picture) over the casino. */
  pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  pipOn = false;
  private pipWin: Window | null = null;
  /** Short message while watching (e.g. a zero was ignored). */
  watchNote = '';
  /** Short "+8" / "-4" pop after each round. */
  flash: { id: number; text: string; kind: 'won' | 'lost' | 'void' } | null = null;
  private flashTimer: any;
  /** Short "reading the table" phase between a result and the next signal. */
  thinking = false;
  private thinkTimer: any;
  /** Animated (counting) bet amount shown in the signal. */
  shownStake = 0;
  private countRaf = 0;
  private tick: any;

  constructor() {
    try {
      this.casino = localStorage.getItem('tw.lastCasino') || '';
      this.tableUrl = localStorage.getItem('tw.lastTableUrl') || '';
    } catch {}
    this.init();
  }

  ngOnDestroy() {
    clearInterval(this.tick);
    clearTimeout(this.flashTimer);
    clearTimeout(this.thinkTimer);
    cancelAnimationFrame(this.countRaf);
    this.pipWin?.close();
  }

  private async init() {
    const user = await firstValueFrom(this.account.user$.pipe(filter((u) => !!u)));
    this.uid = user!.uid;
    const profile = await firstValueFrom(this.account.profile$);
    this.firstName = (profile?.name || '').trim().split(/\s+/)[0] || '';
    await this.loadGoal(profile?.goal ?? null);
    const access = await firstValueFrom(this.account.access$);
    if (access.selfExcludedUntil) {
      this.excludedUntil = access.selfExcludedUntil;
      this.stage = 'excluded';
      return;
    }
    const saved = this.restore();
    if (saved && saved.v === 2 && saved.uid === this.uid && Date.now() > saved.startedAt + saved.plan.minutes * MIN + 60_000) {
      // A session left open from an earlier visit: close it quietly instead of greeting the player with STOP.
      this.live = saved;
      this.engine = SignalEngine.replay(this.makeEngine(saved), saved.events);
      if (this.engine.rounds.length) await this.finish('time', true);
      else this.clearPersisted();
      this.live = null;
      this.engine = null;
      this.stage = (await this.sessions.playedToday(this.uid)) ? 'locked' : 'setup';
      return;
    }
    if (saved && saved.v === 2 && saved.uid === this.uid) {
      this.live = saved;
      this.engine = SignalEngine.replay(this.makeEngine(saved), saved.events);
      this.stage = saved.events.length ? 'live' : 'first';
      this.countTo(this.engine.signal().stake);
      this.startTimer();
      return;
    }
    this.stage = (await this.sessions.playedToday(this.uid)) ? 'locked' : 'setup';
  }

  /** Pre-fills today's amount from ?amount= or the player's goal. */
  private async loadGoal(goal: Goal | null) {
    const q = Number(this.route.snapshot.queryParamMap.get('amount'));
    if (goal) {
      this.goal = goal;
      const list = await this.sessions.list(this.uid).catch(() => []);
      const pr = goalProgress(goal, list.map((s) => ({ net: s.net, startedAt: s.startedAt.toMillis() })));
      if (!pr.reached) this.goalStep = { amount: pr.nextAmount, gain: pr.nextGain, left: pr.left };
      if (!this.bankroll && pr.nextAmount >= 50 && !pr.reached) this.bankroll = Math.round(pr.nextAmount * 100) / 100;
    }
    if (Number.isFinite(q) && q >= 50) this.bankroll = Math.round(q * 100) / 100;
  }

  /** "Good evening, Vivek" – the setup screen speaks to the player by name. */
  get greeting(): string {
    const h = new Date().getHours();
    const part = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return this.firstName ? `${part}, ${this.firstName}` : part;
  }

  /* ================= Setup ================= */

  get game(): GameDef {
    return getGame(this.gameId)!;
  }

  get plan(): SessionPlan | null {
    if (!this.bankroll || this.bankroll < 50) return null;
    return planNeural(this.game, this.bankroll, this.minutes);
  }

  sidesLabel(g: GameDef): string {
    return (g.sides ?? [g.bestBet]).map((id) => getBet(g, id)!.label).join(' or ');
  }

  start() {
    const plan = this.plan;
    if (!plan) return;
    const casino = this.casino.trim().slice(0, 80) || 'Live table';
    const tableUrl = safeUrl(this.tableUrl);
    try {
      localStorage.setItem('tw.lastCasino', this.casino.trim().slice(0, 80));
      localStorage.setItem('tw.lastTableUrl', tableUrl);
    } catch {}
    const now = Date.now();
    this.live = { v: 2, uid: this.uid, casino, system: 'neural', plan, tableUrl, startedAt: now,
      nextCheckinAt: now + 15 * MIN, events: [] };
    this.engine = this.makeEngine(this.live);
    this.endReason = null;
    this.stopSign = null;
    this.persist();
    this.stage = 'first';
    this.startTimer();
  }

  private makeEngine(l: LiveState) {
    return new SignalEngine(getGame(l.plan.gameId)!, l.system, l.plan.unit, l.plan.stopWin, l.plan.stopLoss);
  }

  /* ================= Table ================= */

  get liveGame(): GameDef {
    return getGame(this.live!.plan.gameId)!;
  }

  /** The two sides + the zero/tie button, in board order. */
  get choices(): { id: string | null; label: string; tone: string }[] {
    const g = this.liveGame;
    const v = VOID_RESULT[g.id];
    const sides = (g.sides ?? [g.bestBet]).map((id) => ({ id, label: getBet(g, id)!.label, tone: SIDE_TONE[id] || 'gold' }));
    return [sides[0], { id: null, label: v.label, tone: 'green' }, ...sides.slice(1)];
  }

  /** The last result at a (new) table: the first signal follows it. */
  begin(side: string | null) {
    if (!this.live || !this.engine) return;
    const isNewTable = this.stage === 'newtable';
    this.live.events.push({ t: 'start', side });
    if (isNewTable) this.engine.changeTable(side);
    else this.engine.start(side);
    this.persist();
    this.stage = 'live';
    this.stopSign = null;
    this.reveal();
  }

  /** Opens the player's live table in a window beside the signals (asks for the link the first time). */
  openTable() {
    if (!this.live) return;
    if (!this.live.tableUrl) {
      const url = safeUrl(window.prompt('Paste the link to your live table:') || '');
      if (!url) return;
      this.live.tableUrl = url;
      this.persist();
      try {
        localStorage.setItem('tw.lastTableUrl', url);
      } catch {}
    }
    const w = Math.round(screen.availWidth * 0.68);
    window.open(this.live.tableUrl, 'tw-live-table', `noopener,left=0,top=0,width=${w},height=${screen.availHeight}`);
  }

  /** Floats the signal + "what came" panel in a small always-on-top window (Chrome / Edge desktop). */
  async togglePip() {
    if (this.pipOn) {
      this.pipWin?.close();
      return;
    }
    const el = this.miniEl?.nativeElement;
    const api = (window as any).documentPictureInPicture;
    if (!el || !api) return;
    const pip: Window = await api.requestWindow({ width: 380, height: 620 });
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const css = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
        const style = pip.document.createElement('style');
        style.textContent = css;
        pip.document.head.appendChild(style);
      } catch {
        if (sheet.href) {
          const link = pip.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          pip.document.head.appendChild(link);
        }
      }
    }
    for (const a of Array.from(document.documentElement.attributes)) pip.document.documentElement.setAttribute(a.name, a.value);
    pip.document.body.className = 'tw-pip';
    const own = pip.document.createElement('style');
    own.textContent = 'body.tw-pip{margin:0;padding:12px;display:grid;gap:12px;background:var(--tw-bg);color:var(--tw-text);font-family:var(--tw-font);overflow:auto}' +
      'body.tw-pip .mini{display:grid;gap:12px}body.tw-pip .signal-card{min-height:0}';
    pip.document.head.appendChild(own);
    const home = el.parentElement!;
    const marker = document.createComment('mini');
    home.insertBefore(marker, el);
    pip.document.body.appendChild(el);
    this.pipWin = pip;
    this.pipOn = true;
    pip.addEventListener('pagehide', () =>
      this.zone.run(() => {
        marker.parentNode?.insertBefore(el, marker);
        marker.remove();
        this.pipOn = false;
        this.pipWin = null;
      })
    );
  }

  /** Short alert shown in the floating window when a sign needs the full view. */
  get miniAlert(): string {
    if (this.stopSign === 'table') return 'Fresh table time';
    if (this.stopSign === 'checkin') return this.net > 0 ? "You're up – cash out?" : 'Time check';
    return this.net > 0 ? 'Cash out now!' : 'Session complete';
  }

  get signal(): Signal | null {
    return this.engine ? this.engine.signal() : null;
  }

  get net(): number {
    return this.engine?.net ?? 0;
  }

  get roundsPlayed(): number {
    return this.engine?.rounds.length ?? 0;
  }

  get wins(): number {
    return (this.engine?.rounds ?? []).filter((r) => r.result === 'won').length;
  }

  /** What came: record it, show the next bet, then apply the discipline rules. */
  came(side: string | null) {
    if (!this.live || !this.engine || this.stage !== 'live' || this.stopSign || this.thinking) return;
    this.live.events.push({ t: 'round', side });
    const r = this.engine.applySide(side);
    this.persist();
    if (!r) return;
    this.pop(r.net > 0 ? `+${r.net}` : r.net < 0 ? `${r.net}` : 'Push', r.result === 'won' ? 'won' : r.net < 0 ? 'lost' : 'void');
    this.buzz(r.result === 'won' ? 20 : r.net < 0 ? [40, 60, 40] : 10);

    const hit = this.engine.check();
    if (hit === 'change-table') {
      this.stopSign = 'table';
    } else if (hit) {
      this.finish(hit);
    } else if (this.roundsPlayed >= this.live.plan.maxRounds) {
      this.finish('rounds');
    } else {
      this.reveal();
    }
  }

  /** "Reading the table" for a moment, then show the next signal with a pulse and a counting amount. */
  private reveal() {
    clearTimeout(this.thinkTimer);
    this.thinking = true;
    this.thinkTimer = setTimeout(() => {
      this.thinking = false;
      this.field?.pulse();
      this.countTo(this.signal?.stake ?? 0);
    }, 750);
  }

  private countTo(target: number) {
    cancelAnimationFrame(this.countRaf);
    const from = this.shownStake;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      const e = 1 - Math.pow(1 - k, 3);
      this.shownStake = Math.round((from + (target - from) * e) * 100) / 100;
      if (k < 1) this.countRaf = requestAnimationFrame(step);
    };
    this.countRaf = requestAnimationFrame(step);
  }

  undo() {
    if (!this.live || this.stage !== 'live') return;
    const i = this.live.events.map((e) => e.t).lastIndexOf('round');
    if (i < 0) return;
    this.live.events.splice(i, 1);
    this.engine = SignalEngine.replay(this.makeEngine(this.live), this.live.events);
    this.persist();
  }

  /** Player chose to move to a new table after 3 losses. */
  moveTable() {
    this.stopSign = null;
    this.stage = 'newtable';
  }

  /* ---------- Percentages (all relative to today's amount) ---------- */

  pctOf(v: number): number {
    const b = this.live?.plan.bankroll || 1;
    return Math.round((v / b) * 1000) / 10;
  }

  get pnlPct(): number {
    return this.pctOf(this.net);
  }

  get betPct(): number {
    return this.pctOf(this.signal?.stake ?? 0);
  }

  /** Progress towards the profit target, 0–100. */
  get targetPct(): number {
    if (!this.live) return 0;
    return Math.max(0, Math.min(100, Math.round((this.net / this.live.plan.stopWin) * 100)));
  }

  /** How much of the safety limit is still unused. */
  get safeLeft(): number {
    if (!this.live) return 0;
    return Math.max(0, Math.round((this.live.plan.stopLoss + this.net) * 100) / 100);
  }

  /** Share of the safety limit already used, 0–100. */
  get riskPct(): number {
    if (!this.live) return 0;
    return Math.max(0, Math.min(100, Math.round((-this.net / this.live.plan.stopLoss) * 100)));
  }

  get winRate(): number {
    const r = (this.engine?.rounds ?? []).filter((x) => x.result !== 'void');
    return r.length ? Math.round((r.filter((x) => x.result === 'won').length / r.length) * 100) : 0;
  }



  private pop(text: string, kind: 'won' | 'lost' | 'void') {
    clearTimeout(this.flashTimer);
    this.flash = { id: Date.now(), text, kind };
    this.flashTimer = setTimeout(() => (this.flash = null), 1100);
  }

  private buzz(pattern: number | number[]) {
    try {
      navigator.vibrate?.(pattern);
    } catch {}
  }

  /* ---------- Board ---------- */

  /** Results at the current table, newest last, for the scoreboard road. */
  get beads(): Bead[] {
    if (!this.live || !this.engine) return [];
    const g = this.liveGame;
    const out: Bead[] = [];
    let roundIdx = 0;
    for (const e of this.live.events) {
      if (e.t === 'start') {
        out.length = 0;
        if (e.side) out.push(this.bead(g, e.side, 'seed'));
      } else if (e.t === 'watch') {
        out.push(this.bead(g, e.side, 'seed'));
      } else {
        const r = this.engine.rounds[roundIdx++];
        out.push(this.bead(g, e.side, r ? r.result : 'void'));
      }
    }
    return out;
  }

  private bead(g: GameDef, side: string | null, mark: Bead['mark']): Bead {
    if (side === null) return { side, tone: 'green', label: VOID_RESULT[g.id].short, mark };
    return { side, tone: SIDE_TONE[side] || 'gold', label: getBet(g, side)!.label.charAt(0), mark };
  }

  /** Scoreboard columns of 6 slots, like a casino road (null = empty slot). */
  get road(): (Bead | null)[][] {
    const b = this.beads;
    const n = Math.max(24, Math.ceil((b.length + 1) / 6) * 6 + 6);
    const cols: (Bead | null)[][] = [];
    for (let i = 0; i < n; i += 6) cols.push(Array.from({ length: 6 }, (_, j) => b[i + j] ?? null));
    return cols;
  }

  /* ---------- Discipline display ---------- */

  /** Chips in the animated stack for the current bet. */
  get chipStack(): number[] {
    const s = this.signal;
    if (!s || !this.live) return [];
    const n = Math.max(1, Math.min(14, Math.round((s.stake / this.live.plan.unit) * 2)));
    return Array.from({ length: n }, (_, i) => i);
  }

  /** Keeps lists stable between frames so their pop-in animations play once. */
  trackIdx = (i: number) => i;

  get voidLabel(): string {
    return this.live ? VOID_RESULT[this.liveGame.id].label : 'Zero';
  }

  /** The Neural series with the current level marked, for the ladder. */
  get ladder(): { amount: number; on: boolean; past: boolean }[] {
    const series = this.live?.plan.series ?? [];
    const lvl = (this.signal?.level ?? 1) - 1;
    return series.map((amount, i) => ({ amount, on: i === lvl, past: i < lvl }));
  }

  /** Minutes between check-ins. */
  get checkinEvery(): number {
    return 15;
  }

  get toneOfBet(): string {
    return SIDE_TONE[this.signal?.betId ?? ''] || 'gold';
  }

  get hint(): string {
    if (!this.live || !this.engine || !this.signal) return '';
    const sig = this.signal;
    if (sig.capped) return `Bet sized at ${sig.stake} to stay inside your safety limit.`;
    if (this.net > 0 && this.targetPct >= 60) return `${this.targetPct}% of your target – almost there!`;
    if (this.net > 0) return `${this.targetPct}% of the way to your target. Keep following the signal.`;
    if (sig.change !== null && sig.change > 0) return 'The ladder steps up – this bet wins back more.';
    if (sig.pattern === 'opposite') return 'The table is swinging – the signal swings with it.';
    return `${sig.betLabel} is coming – the signal rides the run.`;
  }

  /* ---------- Timer ---------- */

  private startTimer() {
    clearInterval(this.tick);
    const update = () => {
      if (!this.live || (this.stage !== 'live' && this.stage !== 'first' && this.stage !== 'newtable')) return;
      const now = Date.now();
      const end = this.live.startedAt + this.live.plan.minutes * MIN;
      this.remaining = Math.max(0, Math.round((end - now) / 1000));
      if (this.remaining === 0) {
        this.finish('time');
      } else if (this.stage === 'live' && now >= this.live.nextCheckinAt && !this.stopSign) {
        this.live.nextCheckinAt = now + this.checkinEvery * MIN;
        this.persist();
        this.stopSign = 'checkin';
      }
    };
    update();
    this.tick = setInterval(update, 1000);
  }

  get clock(): string {
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Stroke offset for the timer ring (circumference 2πr, r = 26). */
  get ringOffset(): number {
    if (!this.live) return 0;
    const c = 2 * Math.PI * 26;
    return c * (1 - this.remaining / (this.live.plan.minutes * 60));
  }

  /* ---------- STOP signs ---------- */

  get checkinTitle(): string {
    return this.net > 0 ? "YOU'RE UP – CASH OUT?" : 'TIME CHECK';
  }

  get checkinReason(): string {
    return this.net > 0 ? `You're up ${this.pnlPct}% on your amount.` : 'Quick check-in.';
  }

  get checkinHint(): string {
    const mins = Math.ceil(this.remaining / 60);
    if (this.net > 0) return 'A great moment to cash out on top. Or keep going – the coach keeps every bet sized for you.';
    return `Stay with the plan for up to ${mins} more minutes – every bet stays inside your safety limit.`;
  }

  get finalReason(): string {
    switch (this.endReason) {
      case 'stop-win': return 'Target hit!';
      case 'profit-lock': return "You're ahead – lock it in.";
      case 'stop-loss': return 'Safety limit reached – the rest of your amount is kept for next time.';
      case 'change-table': return 'Session complete.';
      case 'time': return "Time's up.";
      case 'rounds': return 'Full session played.';
      default: return 'Session complete.';
    }
  }

  get finalTitle(): string {
    return this.net > 0 ? 'CASH OUT NOW' : 'SESSION COMPLETE';
  }

  get finalHint(): string {
    if (this.net > 0) return `You're up ${this.pnlPct}% on your amount. Cash out at the casino now – the win is yours.`;
    return 'Close the casino tab for today. The coach is ready for a fresh session tomorrow.';
  }

  get endTitle(): string {
    if (this.net > 0) {
      return this.endReason === 'stop-win' ? 'Target hit. You cashed out a winner!' : 'You cashed out on top. Well played!';
    }
    return this.endReason === 'stop-loss' ? 'Session complete – amount protected.' : 'Session complete.';
  }

  continuePlaying() {
    this.stopSign = null;
  }

  async finish(reason: EndReason, quiet = false) {
    if (!this.live || this.stage === 'done') return;
    clearInterval(this.tick);
    clearTimeout(this.thinkTimer);
    this.thinking = false;
    this.endReason = reason;
    if (!quiet) {
      this.stage = 'done';
      this.stopSign = reason === 'manual' || reason === 'checkin' ? null : 'final';
    }
    const p = this.live.plan;
    const rounds = this.engine?.rounds ?? [];
    try {
      await this.sessions.save(this.uid, {
        gameId: p.gameId,
        betId: this.live.system === 'original' ? 'signals' : p.betId,
        system: this.live.system,
        casino: this.live.casino || 'Unspecified',
        bankroll: p.bankroll,
        unit: p.unit,
        stopWin: p.stopWin,
        stopLoss: p.stopLoss,
        minutes: p.minutes,
        rounds: rounds.map((r) => ({ stake: r.stake, net: r.net, betId: r.betId, result: r.result })),
        net: this.net,
        endReason: reason,
        startedAt: Timestamp.fromMillis(this.live.startedAt),
        endedAt: Timestamp.now(),
      });
      this.clearPersisted();
    } catch {
      this.saveError = 'Could not save this session (are you offline?). It will stay on this device.';
    }
  }

  newSession() {
    this.live = null;
    this.engine = null;
    this.stopSign = null;
    this.stage = 'setup';
    this.init();
  }

  /* ---------- Persistence ---------- */

  private persist() {
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify(this.live));
    } catch {}
  }

  private restore(): LiveState | null {
    try {
      const raw = localStorage.getItem(LIVE_KEY);
      return raw ? (JSON.parse(raw) as LiveState) : null;
    } catch {
      return null;
    }
  }

  private clearPersisted() {
    try {
      localStorage.removeItem(LIVE_KEY);
    } catch {}
  }
}

/** Only http(s) links can be opened as a live table. */
function safeUrl(raw: string): string {
  const v = (raw || '').trim();
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

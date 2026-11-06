/**
 * Game engine for the five practice tables.
 *
 * Every table uses a fair random generator (crypto.getRandomValues), real
 * casino payouts and the real house edge, so what players see in practice is
 * exactly what they would see at a real table over time.
 */

export type GameId = 'baccarat' | 'craps' | 'roulette' | 'dragon-tiger' | 'sicbo';

export interface Card {
  rank: number; // 1 (Ace) .. 13 (King)
  suit: number; // 0 ♠, 1 ♥, 2 ♦, 3 ♣
}

export interface BetType {
  id: string;
  label: string;
  pays: string;
  /** House edge as a fraction, e.g. 0.0106 = 1.06% */
  edge: number;
  /** Probability the bet returns money (win only), used for display. */
  hint?: string;
}

export interface Outcome {
  /** Short label shown in the result strip, e.g. "B", "17", "Small". */
  tag: string;
  /** CSS colour key for the result strip: red | black | green | gold | blue */
  tone: string;
  /** Long description, e.g. "Banker wins 7 to 4". */
  text: string;
  data: any;
}

export interface GameDef {
  id: GameId;
  name: string;
  image: string;
  blurb: string;
  /** Typical rounds per hour at a live table – used for loss estimates. */
  roundsPerHour: number;
  bets: BetType[];
  /** Lowest-house-edge bet – the only bet the Table Rules allow for real money. */
  bestBet: string;
  /** The two even-money sides used by side-picking systems (e.g. Red / Black). */
  sides?: [string, string];
  play(): Outcome;
  /** Net result per 1 unit staked: +1 win, +0.95, 0 push, -0.5, -1 loss … */
  settle(betId: string, o: Outcome): number;
}

/* ------------------------------------------------------------------ */
/* Randomness                                                          */
/* ------------------------------------------------------------------ */

export function randInt(maxExclusive: number): number {
  // Unbiased integer in [0, maxExclusive) using rejection sampling.
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % maxExclusive;
}

/** An 8-deck shoe, reshuffled when it runs low – like a real table. */
class Shoe {
  private cards: Card[] = [];
  constructor(private decks = 8) {
    this.shuffle();
  }
  private shuffle() {
    this.cards = [];
    for (let d = 0; d < this.decks; d++)
      for (let s = 0; s < 4; s++)
        for (let r = 1; r <= 13; r++) this.cards.push({ rank: r, suit: s });
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  draw(): Card {
    if (this.cards.length < 60) this.shuffle();
    return this.cards.pop() as Card;
  }
}

export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const isRedSuit = (s: number) => s === 1 || s === 2;

/* ------------------------------------------------------------------ */
/* Baccarat (8 decks, standard third-card rules)                       */
/* ------------------------------------------------------------------ */

const bacShoe = new Shoe(8);
const bacValue = (c: Card) => (c.rank >= 10 ? 0 : c.rank);
const bacTotal = (cs: Card[]) => cs.reduce((t, c) => t + bacValue(c), 0) % 10;

function playBaccarat(): Outcome {
  const p = [bacShoe.draw(), bacShoe.draw()];
  const b = [bacShoe.draw(), bacShoe.draw()];
  let pt = bacTotal(p);
  let bt = bacTotal(b);
  if (pt < 8 && bt < 8) {
    let playerThird: number | null = null;
    if (pt <= 5) {
      const c = bacShoe.draw();
      p.push(c);
      playerThird = bacValue(c);
      pt = bacTotal(p);
    }
    let bankerDraws: boolean;
    if (playerThird === null) bankerDraws = bt <= 5;
    else if (bt <= 2) bankerDraws = true;
    else if (bt === 3) bankerDraws = playerThird !== 8;
    else if (bt === 4) bankerDraws = playerThird >= 2 && playerThird <= 7;
    else if (bt === 5) bankerDraws = playerThird >= 4 && playerThird <= 7;
    else if (bt === 6) bankerDraws = playerThird === 6 || playerThird === 7;
    else bankerDraws = false;
    if (bankerDraws) {
      b.push(bacShoe.draw());
      bt = bacTotal(b);
    }
  }
  const winner = pt > bt ? 'P' : bt > pt ? 'B' : 'T';
  const text =
    winner === 'T'
      ? `Tie ${pt} – ${bt}`
      : winner === 'P'
      ? `Player wins ${pt} to ${bt}`
      : `Banker wins ${bt} to ${pt}`;
  return {
    tag: winner,
    tone: winner === 'P' ? 'blue' : winner === 'B' ? 'red' : 'green',
    text,
    data: { player: p, banker: b, pt, bt, winner },
  };
}

/* ------------------------------------------------------------------ */
/* Roulette (European, single zero)                                    */
/* ------------------------------------------------------------------ */

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function playRoulette(): Outcome {
  const n = randInt(37);
  const tone = n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black';
  return { tag: String(n), tone, text: `Ball lands on ${n} ${tone}`, data: { n } };
}

function settleRoulette(bet: string, o: Outcome): number {
  const n: number = o.data.n;
  if (bet.startsWith('n')) return Number(bet.slice(1)) === n ? 35 : -1;
  if (n === 0) return -1;
  switch (bet) {
    case 'red': return RED_NUMBERS.has(n) ? 1 : -1;
    case 'black': return !RED_NUMBERS.has(n) ? 1 : -1;
    case 'odd': return n % 2 === 1 ? 1 : -1;
    case 'even': return n % 2 === 0 ? 1 : -1;
    case 'low': return n <= 18 ? 1 : -1;
    case 'high': return n >= 19 ? 1 : -1;
    case 'd1': return n <= 12 ? 2 : -1;
    case 'd2': return n >= 13 && n <= 24 ? 2 : -1;
    case 'd3': return n >= 25 ? 2 : -1;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Dragon Tiger (8 decks, half stake lost on tie)                      */
/* ------------------------------------------------------------------ */

const dtShoe = new Shoe(8);

function playDragonTiger(): Outcome {
  const d = dtShoe.draw();
  const t = dtShoe.draw();
  const winner = d.rank > t.rank ? 'D' : t.rank > d.rank ? 'T' : 'X';
  return {
    tag: winner === 'X' ? '=' : winner,
    tone: winner === 'D' ? 'red' : winner === 'T' ? 'blue' : 'green',
    text: winner === 'X' ? 'Tie' : winner === 'D' ? 'Dragon wins' : 'Tiger wins',
    data: { dragon: d, tiger: t, winner },
  };
}

function settleDragonTiger(bet: string, o: Outcome): number {
  const w = o.data.winner;
  if (bet === 'tie') return w === 'X' ? 11 : -1;
  if (w === 'X') return -0.5;
  if (bet === 'dragon') return w === 'D' ? 1 : -1;
  if (bet === 'tiger') return w === 'T' ? 1 : -1;
  return -1;
}

/* ------------------------------------------------------------------ */
/* Sic Bo (three dice)                                                 */
/* ------------------------------------------------------------------ */

function playSicBo(): Outcome {
  const dice = [randInt(6) + 1, randInt(6) + 1, randInt(6) + 1];
  const total = dice[0] + dice[1] + dice[2];
  const triple = dice[0] === dice[1] && dice[1] === dice[2];
  const tag = triple ? '★' : total <= 10 ? 'S' : 'B';
  return {
    tag,
    tone: triple ? 'green' : total <= 10 ? 'blue' : 'red',
    text: `${dice.join(' · ')} = ${total}${triple ? ' (triple)' : total <= 10 ? ' Small' : ' Big'}`,
    data: { dice, total, triple },
  };
}

function settleSicBo(bet: string, o: Outcome): number {
  const { dice, total, triple } = o.data;
  if (bet === 'small') return !triple && total >= 4 && total <= 10 ? 1 : -1;
  if (bet === 'big') return !triple && total >= 11 && total <= 17 ? 1 : -1;
  if (bet === 'triple') return triple ? 30 : -1;
  if (bet.startsWith('die')) {
    const face = Number(bet.slice(3));
    const hits = dice.filter((d: number) => d === face).length;
    return hits === 0 ? -1 : hits;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Craps (pass / don't pass line decisions)                            */
/* ------------------------------------------------------------------ */

const roll = (): [number, number] => [randInt(6) + 1, randInt(6) + 1];

/** One full line decision: the come-out roll, then rolls until the point or a seven. */
function playCraps(): Outcome {
  const rolls: [number, number][] = [roll()];
  const first = rolls[0][0] + rolls[0][1];
  let winner: 'pass' | 'dontpass' | 'bar';
  let point = 0;
  if (first === 7 || first === 11) winner = 'pass';
  else if (first === 2 || first === 3) winner = 'dontpass';
  else if (first === 12) winner = 'bar';
  else {
    point = first;
    for (;;) {
      const r = roll();
      rolls.push(r);
      const t = r[0] + r[1];
      if (t === point) { winner = 'pass'; break; }
      if (t === 7) { winner = 'dontpass'; break; }
    }
  }
  const text =
    winner === 'bar' ? '12 on the come-out – Pass loses, Don\'t Pass pushes'
    : point === 0 ? `Come-out ${first} – ${winner === 'pass' ? 'Pass' : 'Don\'t Pass'} wins`
    : winner === 'pass' ? `Point ${point} made – Pass wins`
    : `Seven out on point ${point} – Don't Pass wins`;
  return {
    tag: winner === 'bar' ? '12' : winner === 'pass' ? 'P' : 'D',
    tone: winner === 'pass' ? 'blue' : winner === 'dontpass' ? 'red' : 'green',
    text,
    data: { rolls, point, winner },
  };
}

function settleCraps(bet: string, o: Outcome): number {
  const w = o.data.winner;
  if (bet === 'pass') return w === 'pass' ? 1 : -1;
  if (bet === 'dontpass') return w === 'dontpass' ? 1 : w === 'bar' ? 0 : -1;
  return -1;
}

/* ------------------------------------------------------------------ */
/* Game table                                                          */
/* ------------------------------------------------------------------ */

/** Games the Signal Room gives real-money signals for, best first (by simulated results). */
export const SIGNAL_GAMES: GameId[] = ['baccarat', 'craps', 'roulette', 'sicbo'];

export const GAMES: GameDef[] = [
  {
    id: 'baccarat',
    sides: ['banker', 'player'],
    name: 'Baccarat',
    image: 'assets/img/baccarat.jpeg',
    blurb: 'Player or Banker – the classic. Smooth, simple and fast to follow.',
    roundsPerHour: 70,
    bestBet: 'banker',
    bets: [
      { id: 'player', label: 'Player', pays: '1 : 1', edge: 0.0124 },
      { id: 'banker', label: 'Banker', pays: '0.95 : 1', edge: 0.0106 },
      { id: 'tie', label: 'Tie', pays: '8 : 1', edge: 0.1436, hint: 'Player/Banker bets push on a tie' },
    ],
    play: playBaccarat,
    settle: (bet, o) => {
      const w = o.data.winner;
      if (bet === 'tie') return w === 'T' ? 8 : -1;
      if (w === 'T') return 0;
      if (bet === 'player') return w === 'P' ? 1 : -1;
      if (bet === 'banker') return w === 'B' ? 0.95 : -1;
      return -1;
    },
  },
  {
    id: 'roulette',
    sides: ['red', 'black'],
    name: 'Roulette',
    image: 'assets/img/roulette.png',
    blurb: 'Red or Black on a European single-zero wheel.',
    roundsPerHour: 40,
    bestBet: 'red',
    bets: [
      { id: 'red', label: 'Red', pays: '1 : 1', edge: 1 / 37 },
      { id: 'black', label: 'Black', pays: '1 : 1', edge: 1 / 37 },
      { id: 'odd', label: 'Odd', pays: '1 : 1', edge: 1 / 37 },
      { id: 'even', label: 'Even', pays: '1 : 1', edge: 1 / 37 },
      { id: 'low', label: '1–18', pays: '1 : 1', edge: 1 / 37 },
      { id: 'high', label: '19–36', pays: '1 : 1', edge: 1 / 37 },
      { id: 'd1', label: '1st 12', pays: '2 : 1', edge: 1 / 37 },
      { id: 'd2', label: '2nd 12', pays: '2 : 1', edge: 1 / 37 },
      { id: 'd3', label: '3rd 12', pays: '2 : 1', edge: 1 / 37 },
    ],
    play: playRoulette,
    settle: settleRoulette,
  },
  {
    id: 'dragon-tiger',
    sides: ['dragon', 'tiger'],
    name: 'Dragon Tiger',
    image: 'assets/img/dragon-tiger.webp',
    blurb: 'One card each, high card wins. Quick rounds, quick wins.',
    roundsPerHour: 100,
    bestBet: 'dragon',
    bets: [
      { id: 'dragon', label: 'Dragon', pays: '1 : 1', edge: 0.0373, hint: 'Half your stake is lost on a tie' },
      { id: 'tiger', label: 'Tiger', pays: '1 : 1', edge: 0.0373, hint: 'Half your stake is lost on a tie' },
      { id: 'tie', label: 'Tie', pays: '11 : 1', edge: 0.1036 },
    ],
    play: playDragonTiger,
    settle: settleDragonTiger,
  },
  {
    id: 'sicbo',
    sides: ['small', 'big'],
    name: 'Sic Bo',
    image: 'assets/img/sic-bo.jpeg',
    blurb: 'Three dice – the signal calls Small or Big.',
    roundsPerHour: 50,
    bestBet: 'small',
    bets: [
      { id: 'small', label: 'Small 4–10', pays: '1 : 1', edge: 1 - (2 * 105) / 216, hint: 'Loses on any triple' },
      { id: 'big', label: 'Big 11–17', pays: '1 : 1', edge: 1 - (2 * 105) / 216, hint: 'Loses on any triple' },
      { id: 'triple', label: 'Any Triple', pays: '30 : 1', edge: 1 - (6 * 31) / 216 },
      ...[1, 2, 3, 4, 5, 6].map((f) => ({
        id: `die${f}`,
        label: `Single ${f}`,
        pays: '1/2/3 : 1',
        edge: 17 / 216,
      })),
    ],
    play: playSicBo,
    settle: settleSicBo,
  },
  {
    id: 'craps',
    sides: ['dontpass', 'pass'],
    name: 'Craps',
    image: 'assets/img/dice-coins.jpeg',
    blurb: 'Pass or Don\'t Pass – one signal per line decision.',
    roundsPerHour: 60,
    bestBet: 'dontpass',
    bets: [
      { id: 'dontpass', label: "Don't Pass", pays: '1 : 1', edge: 0.0136, hint: '12 on the come-out is a push' },
      { id: 'pass', label: 'Pass Line', pays: '1 : 1', edge: 0.0141 },
    ],
    play: playCraps,
    settle: settleCraps,
  },

];

/** Which even-money side an outcome landed on, or null for zero / tie / triple / seven. */
export function sideOf(game: GameDef, o: Outcome): string | null {
  const d = o.data;
  switch (game.id) {
    case 'baccarat': return d.winner === 'B' ? 'banker' : d.winner === 'P' ? 'player' : null;
    case 'roulette': return d.n === 0 ? null : RED_NUMBERS.has(d.n) ? 'red' : 'black';
    case 'dragon-tiger': return d.winner === 'D' ? 'dragon' : d.winner === 'T' ? 'tiger' : null;
    case 'sicbo': return d.triple ? null : d.total <= 10 ? 'small' : 'big';
    case 'craps': return d.winner === 'bar' ? null : d.winner;
  }
  return null;
}

export function getGame(id: string | null | undefined): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getBet(game: GameDef, betId: string): BetType | undefined {
  if (game.id === 'roulette' && betId.startsWith('n')) {
    return { id: betId, label: `Number ${betId.slice(1)}`, pays: '35 : 1', edge: 1 / 37 };
  }
  return game.bets.find((b) => b.id === betId);
}

export const pct = (x: number, digits = 2) => `${(x * 100).toFixed(digits)}%`;

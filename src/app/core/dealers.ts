import { GameId } from './games';

/**
 * Casino dealer character registry. The four images in src/assets/dealers are the official
 * visual references: each dealer is always shown on her own, at her own tables, never as a collage
 * and never replaced by another picture. scripts/check-dealers.mjs stops the build if one is missing.
 */
/** Round phases the dealer reacts to (camera moves, or a video clip when one is listed). */
export type DealerPhase = 'betting' | 'closing' | 'dealing' | 'result';

export interface CasinoDealer {
  id: 'sofia' | 'maya' | 'elena' | 'lina';
  name: string;
  /** Path of the image inside the app (src/assets/dealers). */
  image: string;
  role: string;
  visualIdentity: string;
  tableName: string;
  /** Tables this dealer runs. */
  games: GameId[];
  /** Horizontal focus of the photo (object-position x, %): keeps her face centred when cropped. */
  focusX: number;
  /**
   * Optional short video clips of this dealer per phase (e.g. closing: sofia_closing.mp4 in assets/dealers,
   * waving "no more bets"). Without a clip the photo is used with camera moves.
   */
  clips?: Partial<Record<DealerPhase, string>>;
}

export const CASINO_DEALERS: CasinoDealer[] = [
  {
    id: 'sofia',
    name: 'Sofia',
    image: 'assets/dealers/sofia_casino_dealer.png',
    role: 'Casino Dealer',
    visualIdentity: 'Brunette, long dark hair, elegant black and gold casino uniform',
    tableName: 'SOFIA',
    games: ['roulette'],
    focusX: 50,
  },
  {
    id: 'maya',
    name: 'Maya',
    image: 'assets/dealers/maya_casino_dealer.png',
    role: 'Casino Dealer',
    visualIdentity: 'Brunette, wavy brown hair, elegant red casino uniform',
    tableName: 'MAYA',
    games: ['baccarat'],
    focusX: 42,
  },
  {
    id: 'elena',
    name: 'Elena',
    image: 'assets/dealers/elena_casino_dealer.png',
    role: 'Casino Dealer',
    visualIdentity: 'Blonde hair, sophisticated black and gold casino uniform',
    tableName: 'ELENA',
    games: ['dragon-tiger'],
    focusX: 45,
  },
  {
    id: 'lina',
    name: 'Lina',
    image: 'assets/dealers/lina_casino_dealer.png',
    role: 'Casino Dealer',
    visualIdentity: 'Dark hair, elegant black and red casino uniform',
    tableName: 'LINA',
    games: ['sicbo', 'craps'],
    focusX: 50,
  },
];

/** The dealer who runs a game's table (every game has exactly one). */
export function dealerFor(game: GameId): CasinoDealer {
  return CASINO_DEALERS.find((d) => d.games.includes(game)) ?? CASINO_DEALERS[0];
}

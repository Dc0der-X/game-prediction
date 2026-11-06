import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NEURAL_SERIES, TableLimits, ladderFor, round2 } from './strategies';

/**
 * Countries, currencies and the table sizes that go with them. The player picks their country once
 * (we guess it from the browser first); every amount is then shown in that currency, and the bet
 * ladder is sized to the usual minimum bet and chips of live tables in that currency.
 */

/** ISO country → currency. Every country (and territory with its own ISO code). */
const COUNTRY_CURRENCY: Record<string, string> = toRecord(
  ('AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN ' +
    'BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:BGN BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL ' +
    'BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD CA:CAD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY ' +
    'CO:COP CR:CRC CU:CUP CV:CVE CW:ANG CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR ' +
    'EG:EGP EH:MAD ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL ' +
    'GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD ' +
    'HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD ' +
    'JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP ' +
    'LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA ' +
    'MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN ' +
    'MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD NZ:NZD OM:OMR PA:PAB ' +
    'PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PR:USD PS:ILS PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON ' +
    'RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SK:EUR SL:SLE SM:EUR SN:XOF ' +
    'SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:ANG SY:SYP SZ:SZL TC:USD TD:XAF TG:XOF TH:THB TJ:TJS TK:NZD TL:USD ' +
    'TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX US:USD UY:UYU UZ:UZS VA:EUR VC:XCD ' +
    'VE:VES VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:USD')
    .split(' ')
    .map((p) => p.split(':') as [string, string]),
);

function toRecord(pairs: [string, string][]): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of pairs) r[k] = v;
  return r;
}

/**
 * Rough units per US dollar, only used to pick sensible chip sizes (an order of magnitude is enough).
 * Currencies not listed fall back to sizes based on US dollars.
 */
const PER_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, CHF: 0.88, CAD: 1.37, AUD: 1.52, NZD: 1.66, SGD: 1.34, HKD: 7.8, JPY: 150, CNY: 7.2,
  KRW: 1350, TWD: 32, INR: 84, PKR: 280, BDT: 120, NPR: 134, LKR: 300, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  BHD: 0.38, OMR: 0.38, JOD: 0.71, ILS: 3.7, TRY: 34, EGP: 49, MAD: 10, TND: 3.1, DZD: 134, NGN: 1600, GHS: 15,
  KES: 129, UGX: 3700, TZS: 2700, ZAR: 18, ZMW: 27, BWP: 13.5, NAD: 18, MUR: 46, XOF: 600, XAF: 600, ETB: 120,
  MXN: 18, BRL: 5.5, ARS: 1000, CLP: 950, COP: 4100, PEN: 3.75, UYU: 40, PYG: 7700, BOB: 6.9, DOP: 60, CRC: 510,
  GTQ: 7.7, HNL: 25, JMD: 156, TTD: 6.8, PHP: 57, IDR: 15800, MYR: 4.5, THB: 35, VND: 25000, KHR: 4100, LAK: 21000,
  MMK: 2100, MNT: 3400, KZT: 480, UZS: 12700, AZN: 1.7, GEL: 2.7, AMD: 390, RUB: 95, UAH: 41, BYN: 3.3, PLN: 4,
  CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, RSD: 108, SEK: 10.5, NOK: 10.8, DKK: 6.9, ISK: 138, MKD: 57, ALL: 92,
  BAM: 1.8, MDL: 17.8, IRR: 42000, IQD: 1310, LBP: 89500, SYP: 13000, YER: 250, AFN: 70, MVR: 15.4, BTN: 84,
  FJD: 2.25, PGK: 3.9, XPF: 110, XCD: 2.7, BBD: 2, BSD: 1, BZD: 2, KYD: 0.83, BMD: 1, AWG: 1.8, ANG: 1.8, PAB: 1,
};

/** Live tables in these currencies usually open lower than the generic rule would give. */
const TABLE_OVERRIDES: Record<string, TableLimits> = {
  USD: { minBet: 1, chip: 1 }, EUR: { minBet: 1, chip: 1 }, GBP: { minBet: 1, chip: 1 }, CAD: { minBet: 1, chip: 1 },
  AUD: { minBet: 1, chip: 1 }, NZD: { minBet: 1, chip: 1 }, CHF: { minBet: 1, chip: 1 }, SGD: { minBet: 1, chip: 1 },
  INR: { minBet: 20, chip: 10 }, PKR: { minBet: 50, chip: 50 }, BDT: { minBet: 20, chip: 10 }, NPR: { minBet: 20, chip: 10 },
  LKR: { minBet: 50, chip: 50 }, PHP: { minBet: 20, chip: 10 }, JPY: { minBet: 100, chip: 100 }, KRW: { minBet: 1000, chip: 1000 },
};

const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** The nice chip value closest (on a log scale) to x. */
function nearestNice(x: number): number {
  return NICE.reduce((best, n) => (Math.abs(Math.log(n / x)) < Math.abs(Math.log(best / x)) ? n : best), NICE[0]);
}

/** 1 / 2 / 2.5 / 5 × 10ⁿ – amounts people actually type. */
function niceSteps(x: number): number[] {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9))));
  return [0.5, 1, 2, 2.5, 5, 10, 20].map((m) => round2(m * p));
}

/** Round up to an amount people actually type. */
function niceUp(x: number): number {
  return niceSteps(x).find((n) => n >= x - 1e-9)!;
}

/** The typed-looking amount nearest to x. */
function niceNear(x: number): number {
  return niceSteps(x).reduce((b, n) => (Math.abs(Math.log(n / x)) < Math.abs(Math.log(b / x)) ? n : b));
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
}

const flagOf = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

let regionNames: { of(code: string): string | undefined } | null = null;
function countryName(code: string): string {
  try {
    regionNames ??= new (Intl as any).DisplayNames(['en'], { type: 'region' });
    return regionNames!.of(code) || code;
  } catch {
    return code;
  }
}

/** Every country, sorted by name. */
export function allCountries(): Country[] {
  return Object.entries(COUNTRY_CURRENCY)
    .map(([code, currency]) => ({ code, name: countryName(code), flag: flagOf(code), currency }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function countryInfo(code: string): Country {
  const c = COUNTRY_CURRENCY[code] ? code : 'US';
  return { code: c, name: countryName(c), flag: flagOf(c), currency: COUNTRY_CURRENCY[c] };
}

/** Usual live-table minimum and smallest chip for a currency. */
export function tableFor(currency: string): TableLimits {
  if (TABLE_OVERRIDES[currency]) return TABLE_OVERRIDES[currency];
  // About half a US dollar: the smallest chip most live tables offer.
  const rate = PER_USD[currency] ?? 1;
  const chip = nearestNice(rate * 0.5);
  return { minBet: chip, chip };
}

/** Smallest amount that fits a session at this currency's tables, and four easy amounts to pick from. */
export function amountsFor(currency: string): { min: number; quick: number[] } {
  const t = tableFor(currency);
  const fit = ladderFor(0, t); // amount 0 → reports the smallest amount that fits
  const min = fit.needAmount || NEURAL_SERIES[0] * t.minBet * 60;
  const first = niceUp(min * 1.2);
  return { min, quick: [first, niceNear(first * 2.5), niceNear(first * 5), niceNear(first * 12.5)] };
}

/** "₹1,600", "$3", "+£54.50" – amounts in the player's currency. */
export function formatMoney(value: number, currency: string, signed = false): string {
  const v = Number.isFinite(value) ? value : 0;
  let s: string;
  try {
    s = new Intl.NumberFormat(undefined, {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0, maximumFractionDigits: Math.abs(v % 1) > 1e-9 ? 2 : 0,
    } as Intl.NumberFormatOptions).format(Math.abs(v));
  } catch {
    s = `${currency} ${Math.abs(v).toLocaleString()}`;
  }
  if (v < 0) return '−' + s;
  return signed && v > 0 ? '+' + s : s;
}

const KEY = 'tw.country';

/** Best guess of the visitor's country: the browser's language region, then its time zone. */
function guessCountry(): string {
  try {
    for (const l of navigator.languages || [navigator.language]) {
      const r = l.split('-')[1]?.toUpperCase();
      if (r && COUNTRY_CURRENCY[r]) return r;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const byZone: Record<string, string> = {
      'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Europe/London': 'GB', 'Asia/Dubai': 'AE', 'Asia/Singapore': 'SG',
      'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Kathmandu': 'NP', 'Asia/Manila': 'PH', 'Asia/Tokyo': 'JP',
      'Australia/Sydney': 'AU', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA', 'America/Toronto': 'CA',
    };
    if (byZone[tz]) return byZone[tz];
    if (tz.startsWith('Europe/')) return 'DE';
  } catch {}
  return 'US';
}

/** The player's country and currency, remembered on this device. */
@Injectable({ providedIn: 'root' })
export class MoneyService {
  /** True once the player has confirmed a country (we only guessed before). */
  chosen = false;
  private country$ = new BehaviorSubject<Country>(countryInfo('US'));
  readonly changes = this.country$.asObservable();

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    this.chosen = !!(saved && COUNTRY_CURRENCY[saved]);
    this.country$.next(countryInfo(this.chosen ? saved! : guessCountry()));
  }

  get country(): Country {
    return this.country$.value;
  }

  get currency(): string {
    return this.country$.value.currency;
  }

  setCountry(code: string) {
    this.chosen = true;
    this.country$.next(countryInfo(code));
    try {
      localStorage.setItem(KEY, this.country$.value.code);
    } catch {}
  }

  format(value: number, signed = false): string {
    return formatMoney(value, this.currency, signed);
  }
}

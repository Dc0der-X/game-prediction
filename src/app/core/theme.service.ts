import { Injectable } from '@angular/core';

export type ThemeId = 'neon' | 'royal' | 'emerald' | 'ember';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  feel: string;
  /** Two swatch colours for the picker. */
  swatch: [string, string];
}

/** Colour moods – people pick the one that feels like theirs. */
export const THEMES: ThemeOption[] = [
  { id: 'neon', name: 'Neon', feel: 'Calm focus', swatch: ['#060912', '#5ce1ff'] },
  { id: 'royal', name: 'High Roller', feel: 'Luxury & status', swatch: ['#1a0f27', '#f2c869'] },
  { id: 'emerald', name: 'Classic', feel: 'Casino comfort', swatch: ['#0d4a33', '#e8c26a'] },
  { id: 'ember', name: 'Ember', feel: 'Bold energy', swatch: ['#3a1414', '#ff9b45'] },
];

const KEY = 'tw.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  current: ThemeId = 'neon';

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    this.apply(THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : 'neon');
  }

  set(id: ThemeId) {
    this.apply(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  }

  private apply(id: ThemeId) {
    this.current = id;
    const root = document.documentElement;
    if (id === 'neon') root.removeAttribute('data-tw-theme');
    else root.setAttribute('data-tw-theme', id);
    const bg = getComputedStyle(root).getPropertyValue('--tw-bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#060912');
  }
}

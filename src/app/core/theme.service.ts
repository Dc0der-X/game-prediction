import { Injectable } from '@angular/core';

/** elite = Elite Dark (default), clean = Clean Pro (light). */
export type ThemeId = 'elite' | 'clean';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  feel: string;
  /** Two swatch colours for the picker. */
  swatch: [string, string];
}

export const THEMES: ThemeOption[] = [
  { id: 'elite', name: 'Elite Dark', feel: 'Sleek and premium', swatch: ['#09080a', '#e2b85c'] },
  { id: 'clean', name: 'Clean Pro', feel: 'Light and professional', swatch: ['#f4f6fb', '#1d4ed8'] },
];

const KEY = 'tw.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  current: ThemeId = 'elite';

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    // Older colour moods (neon, royal, emerald, ember) all move to Elite Dark.
    this.apply(saved === 'clean' ? 'clean' : 'elite');
  }

  get theme(): ThemeOption {
    return THEMES.find((t) => t.id === this.current)!;
  }

  toggle() {
    this.set(this.current === 'elite' ? 'clean' : 'elite');
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
    if (id === 'elite') root.removeAttribute('data-tw-theme');
    else root.setAttribute('data-tw-theme', id);
    const bg = getComputedStyle(root).getPropertyValue('--tw-bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#09080a');
  }
}

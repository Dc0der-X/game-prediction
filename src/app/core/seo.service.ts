import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

const SITE = 'https://aicasinopredictor.web.app';
const DEFAULT_TITLE = 'TableWise – Signals for Roulette, Baccarat & Live Casino Tables';
const DEFAULT_DESC =
  'A signal for every bet at your live table – the side and the exact amount – a session plan from the amount you bring, and a clear moment to cash out. Free for 3 hours.';

/** Sets the page title, description, canonical URL and social tags from each route's `data`. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private doc = inject(DOCUMENT);

  init() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      let r = this.route;
      while (r.firstChild) r = r.firstChild;
      const d = r.snapshot.data as { title?: string; description?: string; noindex?: boolean };
      const title = d.title ? `${d.title} | TableWise` : DEFAULT_TITLE;
      const desc = d.description || DEFAULT_DESC;
      const path = this.router.url.split('?')[0].split('#')[0];
      this.title.setTitle(title);
      this.meta.updateTag({ name: 'description', content: desc });
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ property: 'og:description', content: desc });
      this.meta.updateTag({ property: 'og:url', content: SITE + path });
      this.meta.updateTag({ name: 'robots', content: d.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' });
      let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = this.doc.createElement('link');
        link.rel = 'canonical';
        this.doc.head.appendChild(link);
      }
      link.href = SITE + path;
    });
  }
}

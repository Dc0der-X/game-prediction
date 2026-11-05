import { Component, inject } from '@angular/core';
import { ThemeService } from './core/theme.service';
import { SeoService } from './core/seo.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  // Applies the visitor's saved colour theme before the first page renders.
  private theme = inject(ThemeService);
  constructor() {
    inject(SeoService).init();
  }
}

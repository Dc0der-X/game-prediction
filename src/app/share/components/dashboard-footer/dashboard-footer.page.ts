import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-dashboard-footer',
  templateUrl: './dashboard-footer.page.html',
  styleUrls: ['./dashboard-footer.page.scss'],
})
export class DashboardFooterPage implements OnInit {
  isAdmin = false;
  allowedGames: any;
  showBaccarat = false;
  showRoulette = false;
  showSicbo = false;
  showLuckySeven = false;
  showDragon = false;
  constructor() {}

  ngOnInit() {
    if (localStorage.getItem('Role')) {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
      this.allowedGames = localStorage.getItem('allowedGames');

      if (this.allowedGames.includes('BACCARAT')) {
        this.showBaccarat = true;
      }
      if (this.allowedGames.includes('ROULETTE')) {
        this.showRoulette = true;
      }
      if (this.allowedGames.includes('SICBO')) {
        this.showSicbo = true;
      }
      if (this.allowedGames.includes('LUCKYSEVEN')) {
        this.showLuckySeven = true;
      }
      if (this.allowedGames.includes('DRAGON-TIGER')) {
        this.showDragon = true;
      }
    }
  }
}

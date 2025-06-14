import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-profile',
  templateUrl: './admin-profile.page.html',
  styleUrls: ['./admin-profile.page.scss'],
})
export class AdminProfilePage implements OnInit {
  constructor(private _router: Router) {}

  ngOnInit() {}

  onLogout() {
    localStorage.clear();
    this._router.navigateByUrl('/login');
  }
}

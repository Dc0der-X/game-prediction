import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-customer-profile',
  templateUrl: './customer-profile.page.html',
  styleUrls: ['./customer-profile.page.scss'],
})
export class CustomerProfilePage implements OnInit {
  constructor(private _router: Router) {}

  ngOnInit() {}

  onLogout() {
    localStorage.clear();
    this._router.navigateByUrl('/login');
  }
}

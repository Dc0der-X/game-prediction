import { Component, OnInit } from '@angular/core';
import { FirebaseHelperService } from 'src/app/share/data-access/firebase-helper.service';

@Component({
  selector: 'app-contact-list',
  templateUrl: './contact-list.page.html',
  styleUrls: ['./contact-list.page.scss'],
})
export class ContactListPage implements OnInit {
  contactForms: any;

  constructor(private _firebaseService: FirebaseHelperService) {}

  ngOnInit() {
    this.fetchAllContactForms();
  }

  async fetchAllContactForms() {
    this.contactForms = await this._firebaseService.getAllContactForms();
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collectionData, collection } from '@angular/fire/firestore';
import { FirebaseHelperService } from '../share/data-access/firebase-helper.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  email: any;
  password: any;
  loginFG!: FormGroup;
  // firestore: Firestore = inject(Firestore);
  constructor(
    private _router: Router,
    private _firebaseService: FirebaseHelperService
  ) {}

  ngOnInit() {
    this.buildForm();
  }

  buildForm() {
    this.loginFG = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required]),
    });
  }

  login() {
    this._firebaseService.checkUserExists(
      this.loginFG.value.email,
      this.loginFG.value.password
    );
    // this._firebaseService.getUsers('8888888888@gmail.com', '8888888888');
    // this._firebaseService.getUsers('8888888888@gmail.com', '8888888888').subscribe((res) => {
    //   console.log(res);
    // });
    // this._router.navigateByUrl('/customer-home');
  }
}

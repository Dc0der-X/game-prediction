import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FirebaseHelperService } from '../share/data-access/firebase-helper.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  toggle = true;
  contactFG!: FormGroup;
  currentTimestamp: any;
  constructor(
    private formBuilder: FormBuilder,
    private _firebaseService: FirebaseHelperService
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  toggleMobileMenu() {
    this.toggle = !this.toggle;
  }

  buildForm() {
    this.contactFG = this.formBuilder.group({
      name: ['', Validators.required],
      email: ['', Validators.required],
      number: ['', Validators.required],
      message: ['', Validators.required],
      interestedIn: ['', Validators.required],
    });
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onSubmit() {
    const currentTimestamp = new Date().getTime();
    if (!this.contactFG.valid) {
      alert('Please fill all the required info!');
      return;
    }
    console.log(this.contactFG.value);
    const newContact = {
      name: this.contactFG.value.name,
      number: this.contactFG.value.number,
      email: this.contactFG.value.email,
      message: this.contactFG.value.message,
      interestedIn: this.contactFG.value.interestedIn,
      createdAt: currentTimestamp,
    };
    const resMsg = this._firebaseService.submitContactForm(newContact);
    // console.log(resMsg);
    alert(
      'Thank you for showing your interest. Our team will get back to you on soon!'
    );
    this.contactFG.reset();
  }
}

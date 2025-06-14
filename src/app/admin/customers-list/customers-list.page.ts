import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { AlertController, IonModal, ModalController } from '@ionic/angular';
import { SpinnerVisibilityService } from 'ng-http-loader';
import { FirebaseHelperService } from 'src/app/share/data-access/firebase-helper.service';

@Component({
  selector: 'app-customers-list',
  templateUrl: './customers-list.page.html',
  styleUrls: ['./customers-list.page.scss'],
})
export class CustomersListPage implements OnInit {
  @ViewChild(IonModal) modal!: IonModal;
  isOpen = false;
  isEdit = false;
  customersData: any = [];
  customerFG!: FormGroup;
  selectedCustomerRef: any;
  today = new Date(
    new Date().getTime() - new Date().getTimezoneOffset() * 60000
  ).toISOString();
  constructor(
    private _firebaseService: FirebaseHelperService,
    public modalController: ModalController,
    private formBuilder: FormBuilder,
    private _spinner: SpinnerVisibilityService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.fetchCustomers();
    this.buildForm();
  }

  buildForm() {
    this.customerFG = this.formBuilder.group({
      name: ['', Validators.required],
      number: ['', Validators.required],
      email: ['', Validators.required],
      experie: ['', Validators.required],
      allowedGames: new FormControl([], [Validators.required]),
    });
    this.customerFG.get('allowedGames')?.setValue([]);
  }

  // setIsOpen(state: boolean) {
  //   this.isOpen = state;
  // }

  async fetchCustomers() {
    // this._spinner.show();
    // this.customersData = await this._firebaseService.getAllCustomers();
    const data = await this._firebaseService.getAllCustomers();
    // console.log(data);

    this.customersData = [];
    data.forEach((doc: any) => {
      if (doc.data().allowedGames)
        doc.data().allowedGames = doc.data().allowedGames.join('');
      this.customersData.push({ ...doc.data(), docRef: doc.ref });
    });

    console.log('Modified', this.customersData);
    this.customerFG.reset();
    // this._spinner.hide();
  }

  dismiss() {
    this.modal.dismiss(null, 'dismiss');
  }

  onEditCustomer(selectedCustomer: any) {
    console.log(selectedCustomer);
    this.selectedCustomerRef = selectedCustomer.docRef;
    console.log(this.selectedCustomerRef);
    let allowedGames = [];
    if (selectedCustomer.allowedGames) {
      allowedGames = selectedCustomer.allowedGames;
    }
    this.isEdit = true;
    this.customerFG.patchValue({
      name: selectedCustomer.name,
      number: selectedCustomer.number,
      email: selectedCustomer.email,
      experie: selectedCustomer.experie,
      allowedGames: allowedGames,
    });

    this.isOpen = true;
  }

  async onDeleteCustomer(selectedCustomer: any) {
    console.log('Customer to delete = ', selectedCustomer);
    this.selectedCustomerRef = selectedCustomer.docRef;
    console.log(this.selectedCustomerRef);

    const result = await this.alertController.create({
      mode: 'ios',
      header: 'Confirmation',
      message: 'Are you sure you want to delete this customer?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {},
        },
        {
          text: 'Confirm',
          handler: () => {
            this.deleteCustomer(selectedCustomer);
          },
        },
      ],
    });
    result.present();
  }

  async deleteCustomer(selectedCustomer: any) {
    await this._firebaseService.deleteCustomer(selectedCustomer.docRef);
    this.fetchCustomers();
  }

  openAddCustomerModal() {
    this.isOpen = true;
  }

  onSelectGames(ev: any, game: string) {
    const allowedGames = this.customerFG.value.allowedGames || [];
    if (ev.detail.checked) {
      allowedGames.push(game);
    } else {
      let index = allowedGames.findIndex((_: string) => _ === game);
      if (index > -1) {
        allowedGames.splice(index, 1);
      }
    }

    this.customerFG.get('allowedGames')?.setValue(allowedGames);
    console.log(this.customerFG.value);
  }

  addCustomer() {
    if (this.customerFG && this.customerFG.valid) {
      const newCustomer = {
        name: this.customerFG.value.name,
        number: this.customerFG.value.number,
        email: this.customerFG.value.email,
        experie: this.customerFG.value.experie,
        allowedGames: this.customerFG.value.allowedGames,
      };

      // Add newCustomer to "User" collection
      // this.firestore.collection('User').add(newCustomer);
      const resMsg = this._firebaseService.addNewCustomer(newCustomer);

      console.log(resMsg);

      // alert(resMsg);
      this.customerFG.reset();

      this.dismiss();
      this.fetchCustomers();
    }
  }

  async updateCustomer() {
    if (this.selectedCustomerRef) {
      const res = await this._firebaseService.updateCustomer(
        this.selectedCustomerRef,
        {
          name: this.customerFG.value.name,
          experie: this.customerFG.value.experie,
          allowedGames: this.customerFG.value.allowedGames,
        }
      );
      alert(res);
      this.fetchCustomers();
    } else {
      alert('Something went wrong');
    }

    this.dismiss();
  }

  onWillDismiss(modalEvent: Event) {
    this.isOpen = false;
  }
}

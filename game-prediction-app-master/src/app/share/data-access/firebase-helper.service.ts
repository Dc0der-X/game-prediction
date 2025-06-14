import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  getDoc,
  collectionData,
  addDoc,
  doc,
  DocumentReference,
  updateDoc,
  CollectionReference,
  query,
  where,
  deleteDoc,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { SpinnerVisibilityService } from 'ng-http-loader';
// import {   } from 'firebase/firestore';

@Injectable({
  providedIn: 'root',
})
export class FirebaseHelperService {
  constructor(
    private firestore: Firestore,
    private _router: Router,
    private _spinner: SpinnerVisibilityService
  ) {}

  userCollection: CollectionReference = collection(this.firestore, 'User');
  contactCollection: CollectionReference = collection(
    this.firestore,
    'Contact'
  );

  async __checkUserExists(email: any, password: any) {
    // const res = await getDocs(collection(this.firestore, 'User'));
    // console.log(res);

    // res.forEach((doc: any) => {
    //   console.log(doc.data());
    // });

    const usersSnapshot = await getDocs(collection(this.firestore, 'User'));

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      if (userData['email'] === email && userData['password'] === password) {
        return true;
      }
    }
    return false;
  }

  async checkUserExists(email: any, password: any) {
    console.log(email, password);

    // const usersRef = collection(this.firestore, 'User');
    // return collectionData(usersRef);

    this._spinner.show();

    const customersSnapshot = await getDocs(collection(this.firestore, 'User'));

    for (const userDoc of customersSnapshot.docs) {
      const userData = userDoc.data();
      const expirationDate = new Date(userData['experie']);
      const currentDate = new Date();

      console.log(expirationDate, 'Expiration Date');
      console.log(currentDate, 'Current Date');

      if (userData['Role'] == 'Admin') {
        if (userData['email'] == email && userData['password'] == password) {
          console.log('Admin Login SUCCESS');
          localStorage.setItem('Role', 'Admin');
          localStorage.setItem('UID', userData['id']);
          this._router.navigateByUrl('admin-home');
          this._spinner.hide();
          return; // Exit the loop admin is logged in
        } else {
          console.log('Email or Password is incorrect!');
        }
      } else if (userData['Role'] == 'Customer') {
        if (userData['email'] == email && userData['password'] == password) {
          if (expirationDate > currentDate) {
            console.log('Customer Login SUCCESS', userData);
            // e.preventDefault();
            localStorage.setItem('UID', userData['id']);
            localStorage.setItem('UMAIL', userData['email']);

            const baseGame = userData['allowedGames'][0];
            localStorage.setItem('allowedGames', userData['allowedGames']);

            switch (baseGame) {
              case 'BACCARAT':
                this._router.navigateByUrl('customer-home');
                break;
              case 'SICBO':
                this._router.navigateByUrl('customer-sicbo');
                break;
              case 'DRAGON-TIGER':
                this._router.navigateByUrl('customer-dragon-tiger');
                break;
              case 'ROULETTE':
                this._router.navigateByUrl('customer-roulette');
                break;
              default:
                this._router.navigateByUrl('customer-home');
                break;
            }
            this._spinner.hide();
            return; // Exit the loop since customer is logged in
          } else {
            alert(
              'It looks like your account has been expired. Please contact admin to renew and activate your account!'
            );
            this._spinner.hide();
            return;
          }
        } else {
          console.log('Email or Password is incorrect!');
        }
      }
    }
    alert(
      'Email or Password is incorrect. Please check your credentials and try again!'
    ); // This message is logged if no user matches
    this._spinner.hide();
  }

  async getAllCustomers() {
    // const customersSnapshot = await getDocs(collection(this.firestore, 'User'));
    // const customers = customersSnapshot.docs.map((doc) => ({
    //   ...doc.data(),
    //   docRef: doc.ref,
    // }));
    this._spinner.show();

    const res = await getDocs(collection(this.firestore, 'User'));
    this._spinner.hide();

    return res;
  }
  // async getAllCustomers() {
  //   const customersSnapshot = await getDocs(collection(this.firestore, 'User'));
  //   const customers = customersSnapshot.docs
  //     .map((doc) => doc.data())
  //     .filter((customer) => customer['Role'] === 'Customer');

  //   return customers;
  // }
  // async getAllCustomers() {
  //   const customersSnapshot = await getDocs(collection(this.firestore, 'User'));
  //   const customers = customersSnapshot.docs.map((doc) => doc.data());

  //   return customers;
  // }

  async addNewCustomer(customerData: any) {
    const newCustomer = {
      name: customerData.name,
      number: customerData.number,
      email: customerData.email,
      experie: customerData.experie,
      Role: 'Customer',
      password: customerData.number,
      allowedGames: customerData.allowedGames,
    };

    // Add newCustomer to "User" collection
    // this.firestore.collection('User').add(newCustomer);

    try {
      this._spinner.show();

      // const user = await this.fireAuth.createUserWithEmailAndPassword(
      //   data.email,
      //   data.password
      // );
      // console.log(user);

      // if(!user) return 'Invalid User'
      // const customerDocRef = await addDoc(
      //   this.firestore.collection('User'),
      //   newCustomer
      // );

      const res = await getDocs(
        query(
          collection(this.firestore, 'User'),
          where('email', '==', customerData.email)
        )
      );

      // console.log('===', res);
      let oldUsersLength = 0;
      res.forEach((doc) => {
        oldUsersLength++;
        // console.log(doc.data());
      });

      if (!oldUsersLength) {
        const userDocRef = await addDoc(this.userCollection, <any>newCustomer);
        return 'Customer Created';
      } else {
        alert('User with same email already exists!');
      }

      // Store the document id within the collection
      // const docId = userDocRef.id;
      // await updateDoc(userDocRef, docId, { docId });
      this._spinner.hide();
    } catch (e: any) {
      this._spinner.hide();

      return e.message;
    }
  }

  // async addCustomer(data: CustomerProfile): Promise<string> {
  //   if (!data) return 'No data';

  //   try {
  //     this._spinner.show();

  //     const user = await this.fireAuth.createUserWithEmailAndPassword(
  //       data.email,
  //       data.password
  //     );
  //     console.log(user);

  //     const customerDocRef = await addDoc(
  //       this.customerCollection,
  //       <CustomerProfile>data
  //     );
  //     const usrDocRef = await addDoc(this.userCollection, {
  //       userId: user.user?.uid,
  //       userType: 'CUSTOMER',
  //       mobile: data.mobileNumber,
  //     });
  //     this._spinner.hide();

  //     return 'User Created';
  //   } catch (e: any) {
  //     this._spinner.hide();

  //     return e.message;
  //   }
  // }

  async deleteCustomer(userId: any) {
    try {
      this._spinner.show();
      const userDocRef = doc(this.firestore, 'User', userId.id);
      await deleteDoc(userDocRef);
      this._spinner.hide();
      return 'Customer Deleted';
    } catch (e: any) {
      this._spinner.hide();
      return e.message;
    }
  }

  async submitContactForm(contactData: any) {
    // console.log(contactData);
    // return;
    // const newContactForm = {
    //   name: contactData.name,
    //   number: contactData.number,
    //   email: contactData.email,
    //   message: contactData.message,
    //   interestedIn: contactData.interestedIn,
    //   createdAt: contactData.createdAt,
    // };

    try {
      this._spinner.show();
      const contactDocRef = await addDoc(
        this.contactCollection,
        <any>contactData
      );
      this._spinner.hide();
      return 'Contact form Created';
    } catch (e: any) {
      return e.message;
    }
  }

  async getAllContactForms() {
    this._spinner.show();
    const res = await getDocs(collection(this.firestore, 'Contact'));
    const contactForms: any = [];
    res.forEach((doc) => {
      contactForms.push(doc.data());
    });
    this._spinner.hide();
    return contactForms;
  }

  async checkExpiry() {
    const umail = localStorage.getItem('UMAIL');
    const res = await getDocs(
      query(collection(this.firestore, 'User'), where('email', '==', umail))
    );

    const userData: any = [];
    res.forEach((doc) => {
      userData.push(doc.data());
    });

    console.log('Logged in User Data = ', userData);

    const currentDate = new Date(
      new Date().getTime() - new Date().getTimezoneOffset() * 60000
    ).toISOString();

    console.log('Current Date = ', currentDate);

    if (userData[0].experie < currentDate) {
      return true;
    } else {
      // console.log('User login expired!');
      return false;
    }
  }

  async updateCustomer(docRef: DocumentReference, data: any): Promise<string> {
    try {
      // this._spinner.show();

      const res = await updateDoc(docRef, data);
      // this._spinner.hide();

      return 'Customer Updated';
    } catch (e: any) {
      // this._spinner.hide();

      return e.message;
    }
  }

  // async updateEmployeeStatus(
  //   docRef: DocumentReference,
  //   status: string
  // ): Promise<string> {
  //   try {
  //     this._spinner.show();

  //     const res = await updateDoc(docRef, { status });
  //     this._spinner.hide();

  //     return 'Status Updated';
  //   } catch (e: any) {
  //     this._spinner.hide();

  //     return e.message;
  //   }
  // }
}

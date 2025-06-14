import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomerHeaderPage } from './customer-header.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule],
  declarations: [CustomerHeaderPage],
  exports: [CustomerHeaderPage],
})
export class CustomerHeaderPageModule {}

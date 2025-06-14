import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomerSicboPageRoutingModule } from './customer-sicbo-routing.module';

import { CustomerSicboPage } from './customer-sicbo.page';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';
import { CustomerHeaderPageModule } from 'src/app/share/components/customer-header/customer-header.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CustomerSicboPageRoutingModule,
    DashboardFooterPageModule,
    CustomerHeaderPageModule,
  ],
  declarations: [CustomerSicboPage],
})
export class CustomerSicboPageModule {}

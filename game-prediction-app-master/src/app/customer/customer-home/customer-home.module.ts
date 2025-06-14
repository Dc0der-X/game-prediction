import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomerHomePageRoutingModule } from './customer-home-routing.module';

import { CustomerHomePage } from './customer-home.page';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';
import { CustomerHeaderPageModule } from 'src/app/share/components/customer-header/customer-header.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CustomerHomePageRoutingModule,
    DashboardFooterPageModule,
    CustomerHeaderPageModule,
  ],
  declarations: [CustomerHomePage],
})
export class CustomerHomePageModule {}

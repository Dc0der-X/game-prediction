import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomerLuckySevenPageRoutingModule } from './customer-lucky-seven-routing.module';

import { CustomerLuckySevenPage } from './customer-lucky-seven.page';
import { CustomerHeaderPageModule } from 'src/app/share/components/customer-header/customer-header.module';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CustomerLuckySevenPageRoutingModule,
    DashboardFooterPageModule,
    CustomerHeaderPageModule,
  ],
  declarations: [CustomerLuckySevenPage],
})
export class CustomerLuckySevenPageModule {}

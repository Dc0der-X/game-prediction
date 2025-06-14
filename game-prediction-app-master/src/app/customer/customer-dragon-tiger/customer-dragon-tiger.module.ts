import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomerDragonTigerPageRoutingModule } from './customer-dragon-tiger-routing.module';

import { CustomerDragonTigerPage } from './customer-dragon-tiger.page';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';
import { CustomerHeaderPageModule } from 'src/app/share/components/customer-header/customer-header.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CustomerDragonTigerPageRoutingModule,
    DashboardFooterPageModule,
    CustomerHeaderPageModule,
  ],
  declarations: [CustomerDragonTigerPage],
})
export class CustomerDragonTigerPageModule {}

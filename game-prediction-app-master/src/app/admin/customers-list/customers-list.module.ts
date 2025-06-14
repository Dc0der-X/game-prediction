import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomersListPageRoutingModule } from './customers-list-routing.module';

import { CustomersListPage } from './customers-list.page';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CustomersListPageRoutingModule,
    ReactiveFormsModule,
    DashboardFooterPageModule,
  ],
  declarations: [CustomersListPage],
})
export class CustomersListPageModule {}

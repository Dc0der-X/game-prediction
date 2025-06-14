import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CustomerRoulettePageRoutingModule } from './customer-roulette-routing.module';

import { CustomerRoulettePage } from './customer-roulette.page';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';
import { CustomerHeaderPageModule } from 'src/app/share/components/customer-header/customer-header.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CustomerRoulettePageRoutingModule,
    DashboardFooterPageModule,
    CustomerHeaderPageModule,
  ],
  declarations: [CustomerRoulettePage],
})
export class CustomerRoulettePageModule {}

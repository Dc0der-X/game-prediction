import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AdminHomePageRoutingModule } from './admin-home-routing.module';

import { AdminHomePage } from './admin-home.page';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminHomePageRoutingModule,
    DashboardFooterPageModule,
  ],
  declarations: [AdminHomePage],
})
export class AdminHomePageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AdminProfilePageRoutingModule } from './admin-profile-routing.module';

import { AdminProfilePage } from './admin-profile.page';
import { DashboardFooterPageModule } from 'src/app/share/components/dashboard-footer/dashboard-footer.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminProfilePageRoutingModule,
    DashboardFooterPageModule,
  ],
  declarations: [AdminProfilePage],
})
export class AdminProfilePageModule {}
